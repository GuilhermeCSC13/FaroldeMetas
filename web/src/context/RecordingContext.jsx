// src/context/RecordingContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../supabaseClient";

const RecordingContext = createContext(null);

const STORAGE_BUCKET = "gravacoes";
const SEGMENT_MS = 5 * 60 * 1000;

// 🔥 MODO DEBUG: Deixamos o navegador escolher o formato padrão para evitar incompatibilidade
const MIME_TYPE_PRIMARY = ""; 

function nowIso() {
  return new Date().toISOString();
}
function safeFilePart(n) {
  return String(n).padStart(6, "0");
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function secondsToMMSS(s) {
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function RecordingProvider({ children }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timer, setTimer] = useState(0);

  const [current, setCurrent] = useState(null);

  const recorderRef = useRef(null);
  const mixedStreamRef = useRef(null);
  const displayStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioCtxRef = useRef(null);

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const segmentIntervalRef = useRef(null);

  const sessionIdRef = useRef(null);
  const partNumberRef = useRef(0);

  const stopAllRequestedRef = useRef(false);
  const rotatingRef = useRef(false);

  const uploadQueueRef = useRef([]);
  const uploadWorkerRunningRef = useRef(false);
  const uploadsInFlightRef = useRef(new Set());
  const queueDrainPromiseRef = useRef(null);
  const stopFinalizePromiseRef = useRef(null);
  const finalizeRunningRef = useRef(false);

  const buildPartPath = (reuniaoId, sessionId, partNumber) =>
    `reunioes/${reuniaoId}/${sessionId}/part_${safeFilePart(partNumber)}.webm`;

  const startTimerFn = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };
  const stopTimerFn = () => clearInterval(timerRef.current);

  const cleanupMedia = () => {
    console.log("🧹 [DEBUG] Limpando streams de mídia...");
    try {
      recorderRef.current = null;
      if (displayStreamRef.current) displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      mixedStreamRef.current = null;
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") audioCtxRef.current.close();
      audioCtxRef.current = null;
    } catch (e) {
      console.error("⚠️ [DEBUG] Erro no cleanupMedia:", e);
    }
  };

  const createStopPromise = () => {
    if (stopFinalizePromiseRef.current?.promise) return stopFinalizePromiseRef.current.promise;
    let resolve, reject;
    const promise = new Promise((r, j) => { resolve = r; reject = j; });
    stopFinalizePromiseRef.current = { promise, resolve, reject };
    return promise;
  };
  const resolveStopPromise = () => { stopFinalizePromiseRef.current?.resolve?.(); stopFinalizePromiseRef.current = null; };
  const rejectStopPromise = (err) => { stopFinalizePromiseRef.current?.reject?.(err); stopFinalizePromiseRef.current = null; };

  const runUploadWorker = async () => {
    if (uploadWorkerRunningRef.current) return;
    uploadWorkerRunningRef.current = true;
    console.log("🚀 [DEBUG] Worker de upload iniciado");

    try {
      while (uploadQueueRef.current.length > 0) {
        const item = uploadQueueRef.current[0];
        if (!item) {
          uploadQueueRef.current.shift();
          continue;
        }
        console.log(`📤 [DEBUG] Processando fila: Parte ${item.partNumber} (${item.blob.size} bytes)`);

        try {
          await uploadPart(item.blob, item.partNumber);
          console.log(`✅ [DEBUG] Parte ${item.partNumber} enviada com sucesso!`);
          uploadQueueRef.current.shift();
        } catch (err) {
          console.error(`❌ [DEBUG] ERRO FATAL no upload da parte ${item.partNumber}:`, err);
          uploadQueueRef.current.shift();
        }
      }
    } finally {
      uploadWorkerRunningRef.current = false;
      console.log("🏁 [DEBUG] Worker de upload finalizado (fila vazia)");
      if (queueDrainPromiseRef.current && uploadQueueRef.current.length === 0 && uploadsInFlightRef.current.size === 0) {
        queueDrainPromiseRef.current.resolve?.();
        queueDrainPromiseRef.current = null;
      }
    }
  };

  const enqueueUpload = (blob, partNumber) => {
    console.log(`➕ [DEBUG] Enfileirando Parte ${partNumber} - Tamanho: ${blob.size}`);
    uploadQueueRef.current.push({ blob, partNumber });
    runUploadWorker();
  };

  const waitQueueDrain = async () => {
    if (uploadQueueRef.current.length === 0 && uploadsInFlightRef.current.size === 0) return;
    console.log("⏳ [DEBUG] Aguardando esvaziar fila de uploads...");
    if (!queueDrainPromiseRef.current) {
      let resolve;
      const p = new Promise((r) => (resolve = r));
      queueDrainPromiseRef.current = { promise: p, resolve };
    }
    runUploadWorker();
    await queueDrainPromiseRef.current.promise;
    console.log("✅ [DEBUG] Fila esvaziada.");
  };

  const uploadPart = async (blob, partNumber) => {
    if (!current?.reuniaoId || !sessionIdRef.current) {
      console.warn("⚠️ [DEBUG] Upload abortado: sem ID de reunião/sessão");
      return;
    }

    const reuniaoId = current.reuniaoId;
    const sessionId = sessionIdRef.current;
    const path = buildPartPath(reuniaoId, sessionId, partNumber);
    
    console.log(`📡 [DEBUG] Iniciando upload Supabase: ${path}`);

    const uploadPromise = (async () => {
      // Tenta upload no Storage
      const { data, error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
        contentType: "video/webm",
        upsert: false,
      });

      if (upErr) {
        console.error("❌ [DEBUG] Erro storage.upload:", upErr);
        throw upErr;
      } else {
        console.log("✅ [DEBUG] Storage Upload OK:", data);
      }

      // Registra no banco
      const { error: insErr } = await supabase.from("reuniao_gravacao_partes").insert([
        {
          reuniao_id: reuniaoId,
          session_id: sessionId,
          part_number: partNumber,
          storage_bucket: STORAGE_BUCKET,
          storage_path: path,
          bytes: blob.size,
          status: "UPLOADED",
        },
      ]);
      if (insErr) {
        console.error("❌ [DEBUG] Erro insert tabela:", insErr);
        throw insErr;
      }
    })();

    uploadsInFlightRef.current.add(uploadPromise);
    try {
      await uploadPromise;
    } finally {
      uploadsInFlightRef.current.delete(uploadPromise);
    }
  };

  const createRecorder = () => {
    const stream = mixedStreamRef.current;
    if (!stream) throw new Error("Stream não inicializado");
    
    // Deixa o navegador decidir o melhor formato se o principal falhar
    let mimeType = undefined;
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
      mimeType = "video/webm;codecs=vp8,opus";
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      mimeType = "video/webm";
    }
    
    console.log(`🎥 [DEBUG] Criando MediaRecorder com mimeType: ${mimeType || "DEFAULT"}`);
    return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  };

  const startSegment = () => {
    try {
      console.log("🎬 [DEBUG] Iniciando novo segmento de gravação...");
      const rec = createRecorder();
      recorderRef.current = rec;
      const chunks = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          // console.log(`📦 [DEBUG] Chunk recebido: ${e.data.size} bytes`); // Loga muito, descomente se precisar
          chunks.push(e.data);
        }
      };

      rec.onstop = async () => {
        console.log("🛑 [DEBUG] Evento onstop disparado no recorder.");
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
          console.log(`💾 [DEBUG] Blob criado. Tamanho total: ${blob.size} bytes. Chunks: ${chunks.length}`);
          
          const partNumber = ++partNumberRef.current;
          if (blob.size > 0) {
            enqueueUpload(blob, partNumber);
          } else {
            console.warn("⚠️ [DEBUG] Blob vazio (size=0). Ignorando upload.");
          }

          if (!stopAllRequestedRef.current) startSegment();
        } catch (e) {
          console.error("❌ [DEBUG] Erro dentro do onstop:", e);
        }
      };

      // Timeslice curto (500ms) para garantir dados rápidos
      rec.start(500); 
    } catch (e) {
      console.error("❌ [DEBUG] Falha ao iniciar recorder:", e);
    }
  };

  const startRecording = async ({ reuniaoId, reuniaoTitulo }) => {
    console.log("▶️ [DEBUG] Solicitado startRecording...");
    if (!reuniaoId) throw new Error("reuniaoId obrigatório.");
    if (isRecording) return;

    stopAllRequestedRef.current = false;
    finalizeRunningRef.current = false;
    setTimer(0);

    const sessionId = `sess_${crypto?.randomUUID?.() || Date.now()}`;
    sessionIdRef.current = sessionId;
    partNumberRef.current = 0;

    setCurrent({ reuniaoId, reuniaoTitulo: reuniaoTitulo || `Reunião ${reuniaoId}`, sessionId, startedAtIso: nowIso() });

    console.log(`🆔 [DEBUG] Sessão criada: ${sessionId}`);

    // Atualiza status no banco
    await supabase.from("reunioes").update({
      status: "Em Andamento", gravacao_status: "GRAVANDO", gravacao_session_id: sessionId,
      gravacao_bucket: STORAGE_BUCKET, gravacao_prefix: `reunioes/${reuniaoId}/${sessionId}/`,
      gravacao_inicio: nowIso(), updated_at: nowIso(),
    }).eq("id", reuniaoId);

    // Pede permissão de tela
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    displayStreamRef.current = displayStream;
    micStreamRef.current = micStream;

    // Combina áudios
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const dest = audioCtx.createMediaStreamDestination();
    
    if (micStream.getAudioTracks().length > 0) {
      audioCtx.createMediaStreamSource(micStream).connect(dest);
    }
    if (displayStream.getAudioTracks().length > 0) {
      audioCtx.createMediaStreamSource(displayStream).connect(dest);
    }

    const mixedStream = new MediaStream([...displayStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    mixedStreamRef.current = mixedStream;

    // Para se o usuário parar o compartilhamento nativo
    displayStream.getVideoTracks()[0].onended = () => {
      console.log("⏹️ [DEBUG] Usuário parou compartilhamento pelo navegador.");
      stopRecording();
    };

    startSegment();
    startTimeRef.current = Date.now();
    setIsRecording(true);
    startTimerFn();
  };

  const stopRecording = async () => {
    console.log("⏹️ [DEBUG] stopRecording chamado.");
    if (stopAllRequestedRef.current) return;
    stopAllRequestedRef.current = true;
    
    const stopPromise = createStopPromise();
    
    try {
      setIsRecording(false);
      stopTimerFn();
      
      const rec = recorderRef.current;
      if (rec && rec.state === "recording") {
        console.log("🛑 [DEBUG] Forçando rec.stop()...");
        rec.stop();
      }

      await finalizeRecording();
      await stopPromise;
    } catch (e) {
      console.error("❌ [DEBUG] Erro no stopRecording:", e);
      rejectStopPromise(e);
      await finalizeRecording();
    } finally {
      resolveStopPromise();
    }
  };

  const finalizeRecording = async () => {
    console.log("💾 [DEBUG] Iniciando finalizeRecording...");
    const reuniaoId = current?.reuniaoId;
    if (!reuniaoId) { resolveStopPromise(); return; }
    if (finalizeRunningRef.current) return;
    finalizeRunningRef.current = true;

    try {
      setIsProcessing(true);
      await sleep(1000); // Espera 1s para o ultimo chunk ser processado

      await waitQueueDrain();
      
      console.log("📝 [DEBUG] Atualizando tabela reunioes para PRONTO_PROCESSAR...");
      const { error } = await supabase.from("reunioes").update({
        status: "Realizada",
        gravacao_status: "PRONTO_PROCESSAR",
        gravacao_fim: nowIso(),
        updated_at: nowIso(),
      }).eq("id", reuniaoId);

      if (error) console.error("❌ [DEBUG] Erro ao atualizar status final:", error);
      else console.log("✅ [DEBUG] Status atualizado com sucesso.");
      
      // Inserir na fila de compilação
      await supabase.from("recording_compile_queue").insert([{
        reuniao_id: reuniaoId, status: "PENDENTE", storage_bucket: STORAGE_BUCKET,
        storage_prefix: `reunioes/${reuniaoId}/${sessionIdRef.current}/`, tentativas: 0
      }]);

    } catch (e) {
      console.error("❌ [DEBUG] Erro fatal no finalize:", e);
    } finally {
      setIsProcessing(false);
      cleanupMedia();
      sessionIdRef.current = null;
      partNumberRef.current = 0;
      setCurrent(null);
      setTimer(0);
      finalizeRunningRef.current = false;
      resolveStopPromise();
      console.log("🏁 [DEBUG] Ciclo de gravação encerrado completamente.");
    }
  };

  useEffect(() => {
    const onBeforeUnload = (e) => { if (!isRecording) return; e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isRecording]);

  const value = useMemo(() => ({
    isRecording, isProcessing, timer, timerLabel: secondsToMMSS(timer), current, startRecording, stopRecording
  }), [isRecording, isProcessing, timer, current]);

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("Use dentro de RecordingProvider");
  return ctx;
}

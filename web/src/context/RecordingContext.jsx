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
const SEGMENT_MS = 5 * 60 * 1000; // 5 minutos por segmento

// ✅ Timeslice de 1s para garantir dados
const TIMESLICE_MS = 1000; 

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

// Retry simples para garantir upload
async function withRetry(fn, { retries = 3, baseDelayMs = 600 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }
  throw lastErr;
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

  // Fila de Upload
  const uploadQueueRef = useRef([]);
  const uploadWorkerRunningRef = useRef(false);
  const uploadsInFlightRef = useRef(new Set());
  const queueDrainPromiseRef = useRef(null);

  // Promise do Stop
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
    try {
      recorderRef.current = null;
      if (displayStreamRef.current) displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      mixedStreamRef.current = null;
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") audioCtxRef.current.close();
      audioCtxRef.current = null;
    } catch {}
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

  // Worker de Upload (Processa a fila)
  const runUploadWorker = async () => {
    if (uploadWorkerRunningRef.current) return;
    uploadWorkerRunningRef.current = true;

    try {
      while (uploadQueueRef.current.length > 0) {
        const item = uploadQueueRef.current[0]; // Peek
        if (!item) {
          uploadQueueRef.current.shift();
          continue;
        }

        try {
          await uploadPart(item.blob, item.partNumber);
          uploadQueueRef.current.shift(); // Remove após sucesso
        } catch (err) {
          console.error(`Falha crítica upload part ${item.partNumber}:`, err);
          uploadQueueRef.current.shift(); // Remove para não travar a fila
        }
      }
    } finally {
      uploadWorkerRunningRef.current = false;
      // Se a fila zerou e alguém está esperando (waitQueueDrain), avisa que acabou
      if (queueDrainPromiseRef.current && uploadQueueRef.current.length === 0 && uploadsInFlightRef.current.size === 0) {
        queueDrainPromiseRef.current.resolve?.();
        queueDrainPromiseRef.current = null;
      }
    }
  };

  const enqueueUpload = (blob, partNumber) => {
    uploadQueueRef.current.push({ blob, partNumber });
    runUploadWorker();
  };

  const waitQueueDrain = async () => {
    if (uploadQueueRef.current.length === 0 && uploadsInFlightRef.current.size === 0) return;
    
    if (!queueDrainPromiseRef.current) {
      let resolve;
      const p = new Promise((r) => (resolve = r));
      queueDrainPromiseRef.current = { promise: p, resolve };
    }
    
    runUploadWorker();
    await queueDrainPromiseRef.current.promise;
  };

  const uploadPart = async (blob, partNumber) => {
    // 🔥 Proteção vital: Se não tiver ID, aborta.
    // O bug era que 'sessionIdRef.current' estava null aqui.
    if (!current?.reuniaoId || !sessionIdRef.current) {
      console.warn("Upload abortado: Sem ID de sessão. (Race Condition aconteceu?)");
      return;
    }

    const reuniaoId = current.reuniaoId;
    const sessionId = sessionIdRef.current;
    const path = buildPartPath(reuniaoId, sessionId, partNumber);

    const uploadPromise = (async () => {
      // 1. Upload Storage
      await withRetry(async () => {
        const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
          contentType: "video/webm",
          upsert: false,
        });
        if (upErr) throw upErr;
      });

      // 2. Insert Table
      await withRetry(async () => {
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
        if (insErr) throw insErr;
      });
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
    
    // Tenta codecs preferidos, mas aceita padrão do navegador
    const mimeTypes = [
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9,opus",
      "video/webm"
    ];
    
    let options = {};
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        options = { mimeType: type };
        break;
      }
    }
    
    return new MediaRecorder(stream, options);
  };

  const finalizeFailClosed = async (reuniaoId, message) => {
    try {
      await supabase.from("reunioes").update({
        gravacao_status: "ERRO",
        gravacao_erro: String(message || "Falha desconhecida"),
        gravacao_fim: nowIso(),
        updated_at: nowIso(),
      }).eq("id", reuniaoId);
    } catch {}
  };

  const startSegment = () => {
    try {
      const rec = createRecorder();
      recorderRef.current = rec;
      const chunks = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      rec.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
          const partNumber = ++partNumberRef.current;

          // Só enfileira se tiver dados
          if (blob.size > 0) {
            enqueueUpload(blob, partNumber);
          }
          
          // Se não foi pedido stop total, inicia próximo segmento
          if (!stopAllRequestedRef.current) {
            startSegment();
          }
        } catch (e) {
          console.error("Erro no onstop:", e);
        }
      };

      // Inicia com timeslice para garantir chunks constantes
      rec.start(TIMESLICE_MS); 
    } catch (e) {
      console.error("Erro startSegment:", e);
    }
  };

  const rotateSegment = async () => {
    if (rotatingRef.current) return;
    rotatingRef.current = true;
    try {
      const rec = recorderRef.current;
      if (rec && rec.state === "recording") rec.stop();
    } finally {
      rotatingRef.current = false;
    }
  };

  const enqueueCompileJob = async (reuniaoId) => {
    const prefix = `reunioes/${reuniaoId}/${sessionIdRef.current}/`;
    await supabase.from("recording_compile_queue").insert([{
      reuniao_id: reuniaoId,
      status: "PENDENTE",
      storage_bucket: STORAGE_BUCKET,
      storage_prefix: prefix,
      tentativas: 0,
    }]);
  };

  const startRecording = async ({ reuniaoId, reuniaoTitulo }) => {
    if (!reuniaoId) throw new Error("reuniaoId obrigatório.");
    if (isRecording) return;

    stopAllRequestedRef.current = false;
    rotatingRef.current = false;
    finalizeRunningRef.current = false;
    setTimer(0);

    const sessionId = `sess_${crypto?.randomUUID?.() || Date.now()}`;
    sessionIdRef.current = sessionId;
    partNumberRef.current = 0;

    setCurrent({ reuniaoId, reuniaoTitulo: reuniaoTitulo || `Reunião ${reuniaoId}`, sessionId, startedAtIso: nowIso() });

    // Atualiza status no banco
    await supabase.from("reunioes").update({
      status: "Em Andamento", gravacao_status: "GRAVANDO", gravacao_session_id: sessionId,
      gravacao_bucket: STORAGE_BUCKET, gravacao_prefix: `reunioes/${reuniaoId}/${sessionId}/`,
      gravacao_inicio: nowIso(), updated_at: nowIso(),
    }).eq("id", reuniaoId);

    // Obtém streams
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    displayStreamRef.current = displayStream;
    micStreamRef.current = micStream;

    // Mixa áudio
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const dest = audioCtx.createMediaStreamDestination();
    
    if (micStream.getAudioTracks().length > 0) audioCtx.createMediaStreamSource(micStream).connect(dest);
    if (displayStream.getAudioTracks().length > 0) audioCtx.createMediaStreamSource(displayStream).connect(dest);

    const mixedStream = new MediaStream([...displayStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    mixedStreamRef.current = mixedStream;

    // Se usuário parar compartilhamento nativo
    displayStream.getVideoTracks()[0].onended = () => stopRecording();

    startSegment();

    // Loop de rotação
    clearInterval(segmentIntervalRef.current);
    segmentIntervalRef.current = setInterval(() => {
      if (!stopAllRequestedRef.current) rotateSegment();
    }, SEGMENT_MS);

    startTimeRef.current = Date.now();
    setIsRecording(true);
    startTimerFn();
  };

  // 🔥 O FIX DA "RACE CONDITION" ESTÁ AQUI
  const stopRecording = async () => {
    if (stopAllRequestedRef.current) return;
    stopAllRequestedRef.current = true;
    
    const stopPromise = createStopPromise();
    
    try {
      setIsRecording(false);
      stopTimerFn();
      clearInterval(segmentIntervalRef.current);
      
      const rec = recorderRef.current;
      
      // ✅ AQUI: Forçamos a espera pelo evento 'onstop'
      // Isso garante que o blob seja criado e entre na fila 
      // ANTES de chamarmos finalizeRecording e limparmos o sessionId.
      if (rec && rec.state === "recording") {
        await new Promise((resolve) => {
          const originalOnStop = rec.onstop;
          rec.onstop = async (e) => {
            // Executa a lógica original (criar blob, enfileirar upload)
            if (originalOnStop) await originalOnStop(e);
            // Só libera o 'await' depois que tudo isso acontecer
            resolve();
          };
          rec.stop();
        });
      }

      await finalizeRecording();
      await stopPromise;
    } catch (e) {
      console.error("stopRecording error:", e);
      rejectStopPromise(e);
      await finalizeRecording();
    } finally {
      resolveStopPromise();
    }
  };

  const finalizeRecording = async () => {
    const reuniaoId = current?.reuniaoId;
    if (!reuniaoId) { resolveStopPromise(); return; }
    if (finalizeRunningRef.current) return;
    finalizeRunningRef.current = true;

    try {
      setIsProcessing(true);

      // Agora o waitQueueDrain funciona porque o item já está na fila
      await waitQueueDrain();
      await Promise.allSettled(Array.from(uploadsInFlightRef.current));

      const duracao = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : timer;

      await withRetry(async () => {
        await supabase.from("reunioes").update({
          status: "Realizada",
          duracao_segundos: duracao,
          gravacao_fim: nowIso(),
          gravacao_status: "PRONTO_PROCESSAR",
          updated_at: nowIso(),
        }).eq("id", reuniaoId);
      });

      await enqueueCompileJob(reuniaoId);

    } catch (e) {
      console.error("finalizeRecording error:", e);
      await finalizeFailClosed(reuniaoId, e?.message);
    } finally {
      setIsProcessing(false);
      cleanupMedia();
      
      // Só limpa as referências DEPOIS de tudo enviado
      sessionIdRef.current = null;
      partNumberRef.current = 0;
      setCurrent(null);
      setTimer(0);
      finalizeRunningRef.current = false;
      resolveStopPromise();
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

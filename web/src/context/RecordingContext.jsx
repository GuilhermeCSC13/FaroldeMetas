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
const TIMESLICE_MS = 1000; // Gera dados a cada 1s

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

// --- VISUAL LOGGER COMPONENT (Interno para Debug) ---
const VisualLogger = ({ logs }) => {
  if (logs.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 10, left: 10, width: '400px', maxHeight: '300px',
      overflowY: 'auto', backgroundColor: 'rgba(0,0,0,0.85)', color: '#0f0',
      fontSize: '10px', fontFamily: 'monospace', padding: '10px', zIndex: 99999,
      pointerEvents: 'none', borderRadius: '8px', border: '1px solid #333'
    }}>
      <div style={{fontWeight:'bold', borderBottom:'1px solid #555', marginBottom:5}}>DEBUG DE GRAVAÇÃO</div>
      {logs.slice().reverse().map((l, i) => (
        <div key={i} style={{marginBottom: 2, color: l.includes('❌') ? '#ff5555' : l.includes('✅') ? '#55ff55' : '#ccc'}}>
          {l}
        </div>
      ))}
    </div>
  );
};

export function RecordingProvider({ children }) {
  const [logs, setLogs] = useState([]);
  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));

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

  // Helper para nome do arquivo
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
    addLog("🧹 Limpando streams de mídia...");
    try {
      recorderRef.current = null;
      if (displayStreamRef.current) displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      mixedStreamRef.current = null;
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") audioCtxRef.current.close();
      audioCtxRef.current = null;
    } catch(e) { addLog(`Erro cleanup: ${e.message}`); }
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

  // --- WORKER DE UPLOAD (Blindado) ---
  const runUploadWorker = async () => {
    if (uploadWorkerRunningRef.current) return;
    uploadWorkerRunningRef.current = true;
    addLog("🚀 Worker de upload iniciado");

    try {
      while (uploadQueueRef.current.length > 0) {
        const item = uploadQueueRef.current[0];
        if (!item) { uploadQueueRef.current.shift(); continue; }

        addLog(`📤 Enviando Parte ${item.partNumber} (${item.blob.size} bytes)...`);
        
        try {
          // Passamos os dados EXPLÍCITOS do item, não usamos refs globais aqui
          await uploadPart(item.blob, item.partNumber, item.reuniaoId, item.sessionId);
          addLog(`✅ Parte ${item.partNumber} enviada!`);
          uploadQueueRef.current.shift();
        } catch (err) {
          addLog(`❌ Falha upload parte ${item.partNumber}: ${err.message}`);
          uploadQueueRef.current.shift(); // Remove para não travar fila
        }
      }
    } finally {
      uploadWorkerRunningRef.current = false;
      if (queueDrainPromiseRef.current && uploadQueueRef.current.length === 0 && uploadsInFlightRef.current.size === 0) {
        queueDrainPromiseRef.current.resolve?.();
        queueDrainPromiseRef.current = null;
      }
      addLog("🏁 Worker pausado (fila vazia)");
    }
  };

  // Enfileira com SNAPSHOT dos IDs (Isso corrige o Race Condition)
  const enqueueUpload = (blob, partNumber, reuniaoId, sessionId) => {
    if (!reuniaoId || !sessionId) {
      addLog("❌ ERRO CRÍTICO: Tentativa de enqueue sem IDs!");
      return;
    }
    uploadQueueRef.current.push({ blob, partNumber, reuniaoId, sessionId });
    runUploadWorker();
  };

  const waitQueueDrain = async () => {
    if (uploadQueueRef.current.length === 0 && uploadsInFlightRef.current.size === 0) return;
    addLog("⏳ Aguardando uploads pendentes...");
    if (!queueDrainPromiseRef.current) {
      let resolve;
      const p = new Promise((r) => (resolve = r));
      queueDrainPromiseRef.current = { promise: p, resolve };
    }
    runUploadWorker();
    await queueDrainPromiseRef.current.promise;
    addLog("✅ Uploads finalizados.");
  };

  // Upload recebe IDs como argumento (independente do estado global)
  const uploadPart = async (blob, partNumber, reuniaoId, sessionId) => {
    const path = buildPartPath(reuniaoId, sessionId, partNumber);
    
    const uploadPromise = (async () => {
      // 1. Supabase Storage
      await withRetry(async () => {
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
          contentType: "video/webm", upsert: false,
        });
        if (error) throw error;
      });

      // 2. Tabela SQL
      await withRetry(async () => {
        const { error } = await supabase.from("reuniao_gravacao_partes").insert([{
          reuniao_id: reuniaoId, session_id: sessionId, part_number: partNumber,
          storage_bucket: STORAGE_BUCKET, storage_path: path, bytes: blob.size, status: "UPLOADED",
        }]);
        if (error) throw error;
      });
    })();

    uploadsInFlightRef.current.add(uploadPromise);
    try { await uploadPromise; } finally { uploadsInFlightRef.current.delete(uploadPromise); }
  };

  const createRecorder = () => {
    const stream = mixedStreamRef.current;
    if (!stream) throw new Error("Stream não existe");
    
    const mimeTypes = ["video/webm;codecs=vp8,opus", "video/webm", ""];
    let options = undefined;

    for (const type of mimeTypes) {
      if (type === "") break; // Default
      if (MediaRecorder.isTypeSupported(type)) {
        options = { mimeType: type };
        addLog(`🎥 Codec escolhido: ${type}`);
        break;
      }
    }
    return new MediaRecorder(stream, options);
  };

  const finalizeFailClosed = async (reuniaoId, message) => {
    addLog(`❌ Finalizando com erro: ${message}`);
    try {
      await supabase.from("reunioes").update({
        gravacao_status: "ERRO", gravacao_erro: String(message), gravacao_fim: nowIso(), updated_at: nowIso(),
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
          addLog(`⏹️ Segmento finalizado. Tamanho: ${blob.size} bytes`);

          // CAPTURA IDS ATUAIS PARA O ENQUEUE
          const currentReuniaoId = current?.reuniaoId;
          const currentSessionId = sessionIdRef.current;

          if (blob.size > 0 && currentReuniaoId && currentSessionId) {
            const part = ++partNumberRef.current;
            enqueueUpload(blob, part, currentReuniaoId, currentSessionId);
          } else {
            addLog("⚠️ Blob vazio ou sem sessão ativa. Ignorando.");
          }

          if (!stopAllRequestedRef.current) startSegment();
        } catch (e) {
          addLog(`❌ Erro no onstop: ${e.message}`);
        }
      };

      rec.start(TIMESLICE_MS); 
    } catch (e) {
      addLog(`❌ Erro ao iniciar recorder: ${e.message}`);
    }
  };

  const rotateSegment = async () => {
    if (rotatingRef.current) return;
    rotatingRef.current = true;
    try {
      const rec = recorderRef.current;
      if (rec && rec.state === "recording") rec.stop();
    } finally { rotatingRef.current = false; }
  };

  const enqueueCompileJob = async (reuniaoId) => {
    // Usa ID salvo ou ref se disponível.
    // Aqui assumimos que o ref ainda é válido ou passamos via arg se necessário
    // mas o compile job não é tão sensível a race condition quanto o upload
    const prefix = `reunioes/${reuniaoId}/${sessionIdRef.current || 'unknown'}/`;
    await supabase.from("recording_compile_queue").insert([{
      reuniao_id: reuniaoId, status: "PENDENTE", storage_bucket: STORAGE_BUCKET,
      storage_prefix: prefix, tentativas: 0,
    }]);
  };

  const startRecording = async ({ reuniaoId, reuniaoTitulo }) => {
    addLog("▶️ Iniciando gravação...");
    if (!reuniaoId) return;
    if (isRecording) return;

    stopAllRequestedRef.current = false;
    rotatingRef.current = false;
    finalizeRunningRef.current = false;
    setTimer(0);
    setLogs([]); // Limpa logs antigos

    const sessionId = `sess_${crypto?.randomUUID?.() || Date.now()}`;
    sessionIdRef.current = sessionId;
    partNumberRef.current = 0;

    setCurrent({ reuniaoId, reuniaoTitulo: reuniaoTitulo || `Reunião ${reuniaoId}`, sessionId, startedAtIso: nowIso() });

    await supabase.from("reunioes").update({
      status: "Em Andamento", gravacao_status: "GRAVANDO", gravacao_session_id: sessionId,
      gravacao_bucket: STORAGE_BUCKET, gravacao_prefix: `reunioes/${reuniaoId}/${sessionId}/`,
      gravacao_inicio: nowIso(), updated_at: nowIso(),
    }).eq("id", reuniaoId);

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      displayStreamRef.current = displayStream;
      micStreamRef.current = micStream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      
      if (micStream.getAudioTracks().length > 0) audioCtx.createMediaStreamSource(micStream).connect(dest);
      if (displayStream.getAudioTracks().length > 0) audioCtx.createMediaStreamSource(displayStream).connect(dest);

      const mixedStream = new MediaStream([...displayStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      mixedStreamRef.current = mixedStream;

      displayStream.getVideoTracks()[0].onended = () => {
        addLog("🛑 Compartilhamento de tela encerrado pelo usuário.");
        stopRecording();
      };

      startSegment();
      
      clearInterval(segmentIntervalRef.current);
      segmentIntervalRef.current = setInterval(() => {
        if (!stopAllRequestedRef.current) rotateSegment();
      }, SEGMENT_MS);

      startTimeRef.current = Date.now();
      setIsRecording(true);
      startTimerFn();
      addLog("✅ Gravação ativa.");
    } catch (err) {
      addLog(`❌ Erro permissões: ${err.message}`);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    addLog("⏹️ Solicitado Parar Gravação...");
    if (stopAllRequestedRef.current) return;
    stopAllRequestedRef.current = true;
    
    const stopPromise = createStopPromise();
    
    try {
      setIsRecording(false);
      stopTimerFn();
      clearInterval(segmentIntervalRef.current);
      
      const rec = recorderRef.current;
      if (rec && rec.state === "recording") {
        addLog("⏳ Forçando stop final e aguardando dados...");
        await new Promise((resolve) => {
          const originalOnStop = rec.onstop;
          rec.onstop = async (e) => {
            if (originalOnStop) await originalOnStop(e);
            resolve();
          };
          rec.stop();
        });
      }

      await finalizeRecording();
      await stopPromise;
    } catch (e) {
      addLog(`❌ Erro Stop: ${e.message}`);
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
      await waitQueueDrain();
      await Promise.allSettled(Array.from(uploadsInFlightRef.current));

      const duracao = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : timer;

      addLog("📝 Atualizando banco de dados (Realizada)...");
      await withRetry(async () => {
        const { error } = await supabase.from("reunioes").update({
          status: "Realizada", duracao_segundos: duracao, gravacao_fim: nowIso(),
          gravacao_status: "PRONTO_PROCESSAR", updated_at: nowIso(),
        }).eq("id", reuniaoId);
        if (error) throw error;
      });

      await enqueueCompileJob(reuniaoId);
      addLog("🎉 PROCESSO FINALIZADO COM SUCESSO!");

    } catch (e) {
      await finalizeFailClosed(reuniaoId, e?.message);
    } finally {
      setIsProcessing(false);
      cleanupMedia();
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

  return (
    <RecordingContext.Provider value={value}>
      {children}
      {/* Painel de Debug Visível */}
      <VisualLogger logs={logs} />
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("Use dentro de RecordingProvider");
  return ctx;
}

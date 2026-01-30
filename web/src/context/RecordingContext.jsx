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

// --- VISUAL LOGGER (Debug na Tela) ---
const VisualLogger = ({ logs }) => {
  if (logs.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 10, left: 10, width: '400px', maxHeight: '300px',
      overflowY: 'auto', backgroundColor: 'rgba(0,0,0,0.85)', color: '#0f0',
      fontSize: '10px', fontFamily: 'monospace', padding: '10px', zIndex: 99999,
      pointerEvents: 'none', borderRadius: '8px', border: '1px solid #333'
    }}>
      <div style={{fontWeight:'bold', borderBottom:'1px solid #555', marginBottom:5}}>DEBUG V2.0 (FIX STALE STATE)</div>
      {logs.slice().reverse().map((l, i) => (
        <div key={i} style={{marginBottom: 2, color: l.includes('❌') || l.includes('⚠️') ? '#ff5555' : l.includes('✅') ? '#55ff55' : '#ccc'}}>
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

  // Refs para estado mutável crítico
  const sessionIdRef = useRef(null);
  const reuniaoIdRef = useRef(null); // ✅ NOVO REF: Garante acesso ao ID sem depender do React State
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

  // --- WORKER DE UPLOAD ---
  const runUploadWorker = async () => {
    if (uploadWorkerRunningRef.current) return;
    uploadWorkerRunningRef.current = true;
    
    try {
      while (uploadQueueRef.current.length > 0) {
        const item = uploadQueueRef.current[0];
        if (!item) { uploadQueueRef.current.shift(); continue; }

        addLog(`📤 Enviando Parte ${item.partNumber} (${item.blob.size} bytes) -> Sessão: ${item.sessionId?.slice(0,8)}...`);
        
        try {
          await uploadPart(item.blob, item.partNumber, item.reuniaoId, item.sessionId);
          addLog(`✅ Parte ${item.partNumber} enviada!`);
          uploadQueueRef.current.shift();
        } catch (err) {
          addLog(`❌ Falha upload parte ${item.partNumber}: ${err.message}`);
          uploadQueueRef.current.shift();
        }
      }
    } finally {
      uploadWorkerRunningRef.current = false;
      if (queueDrainPromiseRef.current && uploadQueueRef.current.length === 0 && uploadsInFlightRef.current.size === 0) {
        queueDrainPromiseRef.current.resolve?.();
        queueDrainPromiseRef.current = null;
      }
    }
  };

  const enqueueUpload = (blob, partNumber, reuniaoId, sessionId) => {
    if (!reuniaoId || !sessionId) {
      addLog(`❌ ERRO CRÍTICO: ID Nulo no Enqueue (RID:${reuniaoId}, SID:${sessionId})`);
      return;
    }
    uploadQueueRef.current.push({ blob, partNumber, reuniaoId, sessionId });
    runUploadWorker();
  };

  const waitQueueDrain = async () => {
    if (uploadQueueRef.current.length === 0 && uploadsInFlightRef.current.size === 0) return;
    addLog("⏳ Aguardando uploads...");
    if (!queueDrainPromiseRef.current) {
      let resolve;
      const p = new Promise((r) => (resolve = r));
      queueDrainPromiseRef.current = { promise: p, resolve };
    }
    runUploadWorker();
    await queueDrainPromiseRef.current.promise;
  };

  const uploadPart = async (blob, partNumber, reuniaoId, sessionId) => {
    const path = buildPartPath(reuniaoId, sessionId, partNumber);
    const uploadPromise = (async () => {
      await withRetry(async () => {
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { contentType: "video/webm", upsert: false });
        if (error) throw error;
      });
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
      if (type === "") break;
      if (MediaRecorder.isTypeSupported(type)) {
        options = { mimeType: type };
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

  // ✅ CORREÇÃO CHAVE: Recebe IDs explicitamente para evitar Stale State
  const startSegment = (activeReuniaoId, activeSessionId) => {
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
          addLog(`⏹️ Segmento finalizado. Bytes: ${blob.size}`);

          // ✅ Usa os IDs passados como argumento, blindados contra delay do React
          if (blob.size > 0 && activeReuniaoId && activeSessionId) {
            const part = ++partNumberRef.current;
            enqueueUpload(blob, part, activeReuniaoId, activeSessionId);
          } else {
            addLog(`⚠️ Erro dados: Blob=${blob.size}, RID=${activeReuniaoId}, SID=${activeSessionId}`);
          }

          if (!stopAllRequestedRef.current) {
            // Passa os mesmos IDs para o próximo segmento
            startSegment(activeReuniaoId, activeSessionId);
          }
        } catch (e) {
          addLog(`❌ Erro onstop: ${e.message}`);
        }
      };

      rec.start(TIMESLICE_MS); 
    } catch (e) {
      addLog(`❌ Erro startSegment: ${e.message}`);
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
    setLogs([]);

    const sessionId = `sess_${crypto?.randomUUID?.() || Date.now()}`;
    
    // ✅ Atualiza Refs imediatamente (Síncrono)
    sessionIdRef.current = sessionId;
    reuniaoIdRef.current = reuniaoId;
    partNumberRef.current = 0;

    // Atualiza React State (Assíncrono - visual apenas)
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
      mixedStreamRef.current = new MediaStream([...displayStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

      displayStream.getVideoTracks()[0].onended = () => {
        addLog("🛑 Stop via navegador.");
        stopRecording();
      };

      // ✅ PASSA OS IDS EXPLÍCITOS PARA O INÍCIO DA CADEIA
      startSegment(reuniaoId, sessionId);
      
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
    addLog("⏹️ Stop solicitado...");
    if (stopAllRequestedRef.current) return;
    stopAllRequestedRef.current = true;
    
    const stopPromise = createStopPromise();
    
    try {
      setIsRecording(false);
      stopTimerFn();
      clearInterval(segmentIntervalRef.current);
      
      const rec = recorderRef.current;
      if (rec && rec.state === "recording") {
        addLog("⏳ Stop recorder...");
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
    // ✅ Usa o Ref aqui também por segurança
    const reuniaoId = reuniaoIdRef.current;
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

      addLog("📝 Finalizando banco...");
      await withRetry(async () => {
        await supabase.from("reunioes").update({
          status: "Realizada", duracao_segundos: duracao, gravacao_fim: nowIso(),
          gravacao_status: "PRONTO_PROCESSAR", updated_at: nowIso(),
        }).eq("id", reuniaoId);
      });

      await enqueueCompileJob(reuniaoId);
      addLog("🎉 SUCESSO TOTAL!");

    } catch (e) {
      await finalizeFailClosed(reuniaoId, e?.message);
    } finally {
      setIsProcessing(false);
      cleanupMedia();
      
      // Limpa refs só no final absoluto
      sessionIdRef.current = null;
      reuniaoIdRef.current = null;
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
      <VisualLogger logs={logs} />
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("Use dentro de RecordingProvider");
  return ctx;
}

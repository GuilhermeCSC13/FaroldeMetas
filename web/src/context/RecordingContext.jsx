// src/context/RecordingContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const RecordingContext = createContext(null);

const STORAGE_BUCKET = "gravacoes";
const SEGMENT_MS = 5 * 60 * 1000;
const MIME_TYPE_PRIMARY = "video/webm;codecs=vp8,opus";
const MIME_TYPE_FALLBACK = "video/webm";

function nowIso() {
  return new Date().toISOString();
}
function safeFilePart(n) {
  return String(n).padStart(6, "0");
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
function secondsToMMSS(s) {
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function RecordingProvider({ children }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timer, setTimer] = useState(0);

  // metadados da sessão atual (pra UI global + Copiloto)
  const [current, setCurrent] = useState(null);
  // current: { reuniaoId, reuniaoTitulo, sessionId, startedAtIso }

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

  // ✅ NOVO: promise para o botão ENCERRAR aguardar finalização real
  const stopFinalizePromiseRef = useRef(null); // { promise, resolve, reject }
  const stopFallbackTimeoutRef = useRef(null);

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

      const ds = displayStreamRef.current;
      if (ds) ds.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;

      const ms = micStreamRef.current;
      if (ms) ms.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;

      mixedStreamRef.current = null;

      const ac = audioCtxRef.current;
      if (ac && ac.state !== "closed") ac.close();
      audioCtxRef.current = null;
    } catch {}
  };

  const createStopPromise = () => {
    if (stopFinalizePromiseRef.current?.promise) return stopFinalizePromiseRef.current.promise;

    let resolve, reject;
    const promise = new Promise((r, j) => {
      resolve = r;
      reject = j;
    });
    stopFinalizePromiseRef.current = { promise, resolve, reject };
    return promise;
  };

  const resolveStopPromise = () => {
    try {
      stopFinalizePromiseRef.current?.resolve?.();
    } finally {
      stopFinalizePromiseRef.current = null;
    }
  };

  const rejectStopPromise = (err) => {
    try {
      stopFinalizePromiseRef.current?.reject?.(err);
    } finally {
      stopFinalizePromiseRef.current = null;
    }
  };

  const enqueueDriveJob = async (reuniaoId) => {
    const { data: r, error: e1 } = await supabase
      .from("reunioes")
      .select("id, gravacao_bucket, gravacao_prefix")
      .eq("id", reuniaoId)
      .single();
    if (e1) throw e1;

    const prefix = String(r?.gravacao_prefix || "").trim();
    if (!prefix.startsWith(`reunioes/${reuniaoId}/sess_`)) {
      throw new Error(
        `Prefix inválido: "${prefix}". Esperado: reunioes/${reuniaoId}/sess_<uuid>/`
      );
    }

    const { error: e2 } = await supabase.from("drive_upload_queue").insert([
      {
        reuniao_id: reuniaoId,
        status: "PENDENTE",
        storage_bucket: r?.gravacao_bucket || STORAGE_BUCKET,
        storage_prefix: prefix,
        last_error: null,
      },
    ]);
    if (e2) throw e2;

    await supabase.from("reunioes").update({ updated_at: nowIso() }).eq("id", reuniaoId);
  };

  const enqueueCompileJob = async (reuniaoId) => {
    const { data: r, error: e1 } = await supabase
      .from("reunioes")
      .select("id, gravacao_bucket, gravacao_prefix")
      .eq("id", reuniaoId)
      .single();
    if (e1) throw e1;

    const prefix = String(r?.gravacao_prefix || "").trim();
    if (!prefix.startsWith(`reunioes/${reuniaoId}/sess_`)) {
      throw new Error(
        `Prefix inválido: "${prefix}". Esperado: reunioes/${reuniaoId}/sess_<uuid>/`
      );
    }

    const { error: e2 } = await supabase.from("recording_compile_queue").insert([
      {
        reuniao_id: reuniaoId,
        status: "PENDENTE",
        storage_bucket: r?.gravacao_bucket || STORAGE_BUCKET,
        storage_prefix: prefix,
        tentativas: 0,
        last_error: null,
      },
    ]);
    if (e2) throw e2;

    await supabase.from("reunioes").update({ updated_at: nowIso() }).eq("id", reuniaoId);
  };

  const runUploadWorker = async () => {
    if (uploadWorkerRunningRef.current) return;
    uploadWorkerRunningRef.current = true;

    try {
      while (uploadQueueRef.current.length > 0) {
        const item = uploadQueueRef.current.shift();
        if (!item) continue;
        await uploadPart(item.blob, item.partNumber);
      }
    } finally {
      uploadWorkerRunningRef.current = false;
      if (
        queueDrainPromiseRef.current &&
        uploadQueueRef.current.length === 0 &&
        uploadsInFlightRef.current.size === 0
      ) {
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
    if (!current?.reuniaoId) return;
    if (!sessionIdRef.current) return;

    const reuniaoId = current.reuniaoId;
    const sessionId = sessionIdRef.current;
    const path = buildPartPath(reuniaoId, sessionId, partNumber);

    const uploadPromise = (async () => {
      await withRetry(async () => {
        const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
          contentType: "video/webm",
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) throw upErr;
      });

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
    if (!stream) throw new Error("Stream de gravação não inicializado.");

    let options = {};
    if (window.MediaRecorder?.isTypeSupported?.(MIME_TYPE_PRIMARY)) {
      options = { mimeType: MIME_TYPE_PRIMARY };
    } else if (window.MediaRecorder?.isTypeSupported?.(MIME_TYPE_FALLBACK)) {
      options = { mimeType: MIME_TYPE_FALLBACK };
    }
    return new MediaRecorder(stream, options);
  };

  const startSegment = () => {
    const rec = createRecorder();
    recorderRef.current = rec;

    const chunks = [];

    rec.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      chunks.push(e.data);
    };

    // ✅ onstop robusto: sempre tenta finalizar se stop geral foi pedido
    rec.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
        const partNumber = ++partNumberRef.current;

        if (blob.size > 0) enqueueUpload(blob, partNumber);

        if (!stopAllRequestedRef.current) {
          startSegment();
        } else {
          await finalizeRecording();
        }
      } catch (e) {
        console.error("rec.onstop error:", e);
        try {
          await finalizeRecording();
        } catch (err2) {
          console.error("finalize fallback error:", err2);
        }
      }
    };

    rec.start();
  };

  const rotateSegment = async () => {
    if (rotatingRef.current) return;
    rotatingRef.current = true;

    try {
      const rec = recorderRef.current;
      if (!rec) return;
      if (rec.state === "recording") rec.stop();
    } finally {
      rotatingRef.current = false;
    }
  };

  const startRecording = async ({ reuniaoId, reuniaoTitulo }) => {
    if (!reuniaoId) throw new Error("reuniaoId obrigatório.");
    if (isRecording) return;

    stopAllRequestedRef.current = false;
    rotatingRef.current = false;
    setTimer(0);

    const sessionUuid =
      crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const sessionId = `sess_${sessionUuid}`;

    sessionIdRef.current = sessionId;
    partNumberRef.current = 0;

    setCurrent({
      reuniaoId,
      reuniaoTitulo: reuniaoTitulo || `Reunião ${reuniaoId}`,
      sessionId,
      startedAtIso: nowIso(),
    });

    await supabase
      .from("reunioes")
      .update({
        status: "Em Andamento",
        gravacao_status: "GRAVANDO",
        gravacao_session_id: sessionId,
        gravacao_bucket: STORAGE_BUCKET,
        gravacao_prefix: `reunioes/${reuniaoId}/${sessionId}/`,
        gravacao_inicio: nowIso(),
        gravacao_erro: null,
      })
      .eq("id", reuniaoId);

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    displayStreamRef.current = displayStream;
    micStreamRef.current = micStream;

    const videoTrack = displayStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => stopRecording();
    }

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const dest = audioCtx.createMediaStreamDestination();
    audioCtx.createMediaStreamSource(micStream).connect(dest);

    if (displayStream.getAudioTracks().length > 0) {
      audioCtx.createMediaStreamSource(displayStream).connect(dest);
    }

    const mixedStream = new MediaStream([
      ...displayStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);
    mixedStreamRef.current = mixedStream;

    startSegment();

    clearInterval(segmentIntervalRef.current);
    segmentIntervalRef.current = setInterval(() => {
      if (!stopAllRequestedRef.current) rotateSegment();
    }, SEGMENT_MS);

    startTimeRef.current = Date.now();
    setIsRecording(true);
    startTimerFn();
  };

  // ✅ AGORA stopRecording aguarda finalizeRecording terminar (via promise)
  const stopRecording = async () => {
    if (stopAllRequestedRef.current) {
      if (stopFinalizePromiseRef.current?.promise) {
        await stopFinalizePromiseRef.current.promise;
      }
      return;
    }

    stopAllRequestedRef.current = true;
    const stopPromise = createStopPromise();

    try {
      setIsRecording(false);
      stopTimerFn();
      clearInterval(segmentIntervalRef.current);

      const rec = recorderRef.current;

      // fallback se o onstop não disparar por algum motivo
      clearTimeout(stopFallbackTimeoutRef.current);
      stopFallbackTimeoutRef.current = setTimeout(async () => {
        try {
          await finalizeRecording();
        } catch (e) {
          console.error("stop fallback finalize error:", e);
        }
      }, 2500);

      if (rec && rec.state === "recording") {
        rec.stop(); // finalize roda no onstop
      } else {
        await finalizeRecording();
      }

      await stopPromise; // ✅ espera finalização real
    } catch (e) {
      console.error("stopRecording error:", e);
      rejectStopPromise(e);
      try {
        await finalizeRecording();
      } catch {}
    } finally {
      clearTimeout(stopFallbackTimeoutRef.current);
      stopFallbackTimeoutRef.current = null;
    }
  };

  const finalizeRecording = async () => {
    if (!current?.reuniaoId) {
      resolveStopPromise();
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);

    const reuniaoId = current.reuniaoId;

    try {
      await waitQueueDrain();
      await Promise.allSettled(Array.from(uploadsInFlightRef.current));

      const duracao = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : timer;

      const { data: reuniaoAtual } = await supabase
        .from("reunioes")
        .select("gravacao_status")
        .eq("id", reuniaoId)
        .single();

      if (reuniaoAtual?.gravacao_status !== "ERRO") {
        await supabase
          .from("reunioes")
          .update({
            status: "Realizada",
            duracao_segundos: duracao,
            gravacao_fim: nowIso(),
            gravacao_status: "PRONTO_PROCESSAR",
          })
          .eq("id", reuniaoId);

        await enqueueDriveJob(reuniaoId);
        await enqueueCompileJob(reuniaoId);
      } else {
        await supabase
          .from("reunioes")
          .update({ duracao_segundos: duracao, gravacao_fim: nowIso() })
          .eq("id", reuniaoId);
      }
    } catch (e) {
      console.error("finalizeRecording error:", e);
      // se falhar finalização, marca ERRO pra não ficar GRAVANDO infinito
      try {
        await supabase
          .from("reunioes")
          .update({
            gravacao_status: "ERRO",
            gravacao_erro: String(e?.message || e),
            gravacao_fim: nowIso(),
          })
          .eq("id", reuniaoId);
      } catch {}
    } finally {
      setIsProcessing(false);

      cleanupMedia();

      sessionIdRef.current = null;
      partNumberRef.current = 0;
      startTimeRef.current = null;
      stopAllRequestedRef.current = false;
      rotatingRef.current = false;

      uploadQueueRef.current = [];
      uploadsInFlightRef.current.clear();
      queueDrainPromiseRef.current = null;

      setCurrent(null);
      setTimer(0);

      // ✅ libera o clique do ENCERRAR
      resolveStopPromise();
    }
  };

  // Evita perder gravação ao fechar/refresh
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isRecording) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isRecording]);

  const value = useMemo(
    () => ({
      isRecording,
      isProcessing,
      timer,
      timerLabel: secondsToMMSS(timer),
      current,
      startRecording,
      stopRecording,
    }),
    [isRecording, isProcessing, timer, current]
  );

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("useRecording deve ser usado dentro de RecordingProvider");
  return ctx;
}

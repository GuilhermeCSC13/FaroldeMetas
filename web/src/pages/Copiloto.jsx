// src/pages/Copiloto.jsx
import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import { Loader2, Cpu, CheckCircle, Monitor, Plus } from "lucide-react";

/**
 * CONFIG
 */
const STORAGE_BUCKET = "gravacoes"; // bucket do Supabase Storage
const SEGMENT_MS = 5 * 60 * 1000; // 5 minutos por arquivo (segmento tocável)
const MIME_TYPE_PRIMARY = "video/webm;codecs=vp8,opus";
const MIME_TYPE_FALLBACK = "video/webm";

/**
 * Helpers
 */
function nowIso() {
  return new Date().toISOString();
}
function safeFilePart(n) {
  return String(n).padStart(6, "0");
}
function secondsToMMSS(s) {
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
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
      if (attempt < retries) {
        const backoff = baseDelayMs * Math.pow(2, attempt - 1);
        await sleep(backoff);
      }
    }
  }
  throw lastErr;
}

export default function Copiloto() {
  // UI / filtros
  const [dataFiltro, setDataFiltro] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [busca, setBusca] = useState("");

  // ações
  const [acoes, setAcoes] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel: "" });
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  // gravação
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timer, setTimer] = useState(0);

  // refs (media)
  const recorderRef = useRef(null);
  const mixedStreamRef = useRef(null);
  const displayStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioCtxRef = useRef(null);

  // temporizadores
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const segmentIntervalRef = useRef(null);

  // sessão / partes
  const sessionIdRef = useRef(null);
  const partNumberRef = useRef(0);

  // flags
  const stopAllRequestedRef = useRef(false);
  const rotatingRef = useRef(false);
  const lastErrorRef = useRef(null);

  // fila de upload (para não travar encoder/UI)
  const uploadQueueRef = useRef([]); // items: { blob, partNumber }
  const uploadWorkerRunningRef = useRef(false);
  const uploadsInFlightRef = useRef(new Set()); // promises
  const queueDrainPromiseRef = useRef(null);

  // ✅ blindagem: evita setState depois que o componente desmonta
  const isMountedRef = useRef(false);
  const safeSet = (setter) => {
    if (isMountedRef.current) setter();
  };

  /**
   * Data fetch
   */
  useEffect(() => {
    isMountedRef.current = true;

    fetchReunioes();

    return () => {
      // ✅ AO SAIR DA TELA (trocar rota/aba do Farol), encerra com segurança
      // fire-and-forget (cleanup não pode await)
      try {
        if (
          (recorderRef.current && recorderRef.current.state === "recording") ||
          stopAllRequestedRef.current === false
        ) {
          // pede stop geral (vai tentar finalizar e subir o que der)
          safeStopRecording();
        }
      } catch (e) {
        // fallback bruto: para tracks pra não ficar preso
        cleanupMedia();
      }

      clearInterval(timerRef.current);
      clearInterval(segmentIntervalRef.current);
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchReunioes();
    return () => {
      clearInterval(timerRef.current);
      clearInterval(segmentIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFiltro]);

  useEffect(() => {
    if (selecionada) fetchAcoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada]);

  // ✅ Se o usuário trocar de aba do navegador / esconder a página, encerra.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && isRecording) {
        console.warn("Aba ficou oculta. Encerrando gravação para evitar travar.");
        safeStopRecording();
      }
    };

    // ✅ Se a página for “suspensa” (mobile) ou navegarem pra fora
    const onPageHide = () => {
      if (isRecording) {
        console.warn("pagehide detectado. Encerrando gravação.");
        safeStopRecording();
      }
    };

    // ✅ Evita o usuário fechar/atualizar e perder controle sem perceber
    const onBeforeUnload = (e) => {
      if (!isRecording) return;
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const fetchReunioes = async () => {
    const { data, error } = await supabase
      .from("reunioes")
      .select("*")
      .gte("data_hora", `${dataFiltro}T00:00:00`)
      .lte("data_hora", `${dataFiltro}T23:59:59`)
      .order("data_hora", { ascending: true });

    if (error) {
      console.error("fetchReunioes:", error);
      return;
    }
    safeSet(() => setReunioes(data || []));
  };

  const fetchAcoes = async () => {
    safeSet(() => setLoadingAcoes(true));
    const { data, error } = await supabase
      .from("acoes")
      .select("*")
      .eq("reuniao_id", selecionada.id)
      .order("created_at", { ascending: false });

    if (error) console.error("fetchAcoes:", error);
    safeSet(() => setAcoes(data || []));
    safeSet(() => setLoadingAcoes(false));
  };

  const salvarAcao = async () => {
    if (!novaAcao.descricao?.trim()) return;

    const payload = {
      ...novaAcao,
      reuniao_id: selecionada.id,
      status: "Aberta",
    };

    const { data, error } = await supabase
      .from("acoes")
      .insert([payload])
      .select();

    if (error) {
      console.error("salvarAcao:", error);
      return;
    }
    safeSet(() => setAcoes([data[0], ...acoes]));
    safeSet(() => setNovaAcao({ descricao: "", responsavel: "" }));
  };

  /**
   * Timer
   */
  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      safeSet(() =>
        setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000))
      );
    }, 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  /**
   * Storage path builder
   */
  const buildPartPath = (reuniaoId, sessionId, partNumber) => {
    return `reunioes/${reuniaoId}/${sessionId}/part_${safeFilePart(
      partNumber
    )}.webm`;
  };

  /**
   * >>> Drive Queue Job (apenas fila; não muda gravacao_status)
   */
  const enqueueDriveJob = async () => {
    if (!selecionada?.id) return;

    const { data: r, error: e1 } = await supabase
      .from("reunioes")
      .select("id, gravacao_bucket, gravacao_prefix")
      .eq("id", selecionada.id)
      .single();

    if (e1) throw e1;

    const prefix = String(r?.gravacao_prefix || "").trim();

    if (!prefix.startsWith(`reunioes/${selecionada.id}/sess_`)) {
      throw new Error(
        `Prefix inválido: "${prefix}". Esperado: reunioes/${selecionada.id}/sess_<uuid>/`
      );
    }

    const { error: e2 } = await supabase.from("drive_upload_queue").insert([
      {
        reuniao_id: selecionada.id,
        status: "PENDENTE",
        storage_bucket: r?.gravacao_bucket || STORAGE_BUCKET,
        storage_prefix: prefix,
        last_error: null,
      },
    ]);

    if (e2) throw e2;

    await supabase
      .from("reunioes")
      .update({ updated_at: nowIso() })
      .eq("id", selecionada.id);
  };

  /**
   * >>> Compile Queue Job (FILA para compilar vídeo + gerar ATA IA; não muda gravacao_status)
   */
  const enqueueCompileJob = async () => {
    if (!selecionada?.id) return;

    const { data: r, error: e1 } = await supabase
      .from("reunioes")
      .select("id, gravacao_bucket, gravacao_prefix")
      .eq("id", selecionada.id)
      .single();

    if (e1) throw e1;

    const prefix = String(r?.gravacao_prefix || "").trim();

    if (!prefix.startsWith(`reunioes/${selecionada.id}/sess_`)) {
      throw new Error(
        `Prefix inválido: "${prefix}". Esperado: reunioes/${selecionada.id}/sess_<uuid>/`
      );
    }

    const { error: e2 } = await supabase.from("recording_compile_queue").insert([
      {
        reuniao_id: selecionada.id,
        status: "PENDENTE",
        storage_bucket: r?.gravacao_bucket || STORAGE_BUCKET,
        storage_prefix: prefix,
        tentativas: 0,
        last_error: null,
      },
    ]);

    if (e2) throw e2;

    await supabase
      .from("reunioes")
      .update({ updated_at: nowIso() })
      .eq("id", selecionada.id);
  };

  /**
   * Upload (segmento) + metadata
   */
  const uploadPart = async (blob, partNumber) => {
    if (!selecionada?.id) return;
    if (!sessionIdRef.current) return;

    const reuniaoId = selecionada.id;
    const sessionId = sessionIdRef.current;

    const path = buildPartPath(reuniaoId, sessionId, partNumber);

    const uploadPromise = (async () => {
      await withRetry(async () => {
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, blob, {
            contentType: "video/webm",
            cacheControl: "3600",
            upsert: false,
          });
        if (upErr) throw upErr;
      });

      await withRetry(async () => {
        const { error: insErr } = await supabase
          .from("reuniao_gravacao_partes")
          .insert([
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
    } catch (e) {
      console.error("uploadPart error:", e);
      lastErrorRef.current = e;

      await supabase
        .from("reunioes")
        .update({
          gravacao_status: "ERRO",
          gravacao_erro: String(e?.message || e),
          updated_at: nowIso(),
        })
        .eq("id", reuniaoId);

      await safeStopRecording();
    } finally {
      uploadsInFlightRef.current.delete(uploadPromise);
    }
  };

  /**
   * Queue worker: processa uploads sequencialmente (sem travar o MediaRecorder)
   */
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
    if (
      uploadQueueRef.current.length === 0 &&
      uploadsInFlightRef.current.size === 0
    ) {
      return;
    }

    if (!queueDrainPromiseRef.current) {
      let resolve;
      const p = new Promise((r) => (resolve = r));
      queueDrainPromiseRef.current = { promise: p, resolve };
    }

    runUploadWorker();
    await queueDrainPromiseRef.current.promise;
  };

  /**
   * Cria MediaRecorder para o stream já mixado
   */
  const createRecorder = () => {
    const stream = mixedStreamRef.current;
    if (!stream) throw new Error("Stream de gravação não inicializado.");

    let options = {};
    if (window.MediaRecorder?.isTypeSupported?.(MIME_TYPE_PRIMARY)) {
      options = { mimeType: MIME_TYPE_PRIMARY };
    } else if (window.MediaRecorder?.isTypeSupported?.(MIME_TYPE_FALLBACK)) {
      options = { mimeType: MIME_TYPE_FALLBACK };
    }

    const recorder = new MediaRecorder(stream, options);
    return recorder;
  };

  /**
   * Inicia um segmento: recorder.start() e aguarda stop para gerar blob “tocável”
   */
  const startSegment = () => {
    const rec = createRecorder();
    recorderRef.current = rec;

    const chunks = [];

    rec.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      chunks.push(e.data);
    };

    rec.onerror = (e) => {
      console.error("MediaRecorder error:", e);
      lastErrorRef.current = e?.error || e;
    };

    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      const partNumber = ++partNumberRef.current;

      if (blob.size > 0) enqueueUpload(blob, partNumber);

      if (!stopAllRequestedRef.current) {
        try {
          startSegment();
        } catch (e) {
          console.error("Falha ao iniciar novo segmento:", e);
          lastErrorRef.current = e;
          await safeStopRecording();
        }
      } else {
        await finalizeRecording();
      }
    };

    rec.start();
  };

  /**
   * Rotaciona segmento a cada SEGMENT_MS
   */
  const rotateSegment = async () => {
    if (rotatingRef.current) return;
    rotatingRef.current = true;

    try {
      const rec = recorderRef.current;
      if (!rec) return;
      if (rec.state === "recording") {
        rec.stop();
      }
    } catch (e) {
      console.error("rotateSegment:", e);
      lastErrorRef.current = e;
      await safeStopRecording();
    } finally {
      rotatingRef.current = false;
    }
  };

  /**
   * Start recording: tela + áudio do mic (mix) e segmentação
   */
  const startRecording = async () => {
    if (!selecionada) return alert("Selecione uma reunião.");
    if (isRecording) return;

    lastErrorRef.current = null;
    stopAllRequestedRef.current = false;
    rotatingRef.current = false;
    safeSet(() => setTimer(0));

    try {
      const sessionUuid =
        crypto?.randomUUID?.() ||
        `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const sessionId = `sess_${sessionUuid}`;

      sessionIdRef.current = sessionId;
      partNumberRef.current = 0;

      await supabase
        .from("reunioes")
        .update({
          status: "Em Andamento",
          gravacao_status: "GRAVANDO",
          gravacao_session_id: sessionId,
          gravacao_bucket: STORAGE_BUCKET,
          gravacao_prefix: `reunioes/${selecionada.id}/${sessionId}/`,
          gravacao_inicio: nowIso(),
          gravacao_erro: null,
        })
        .eq("id", selecionada.id);

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      displayStreamRef.current = displayStream;
      micStreamRef.current = micStream;

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.warn("Tela encerrada pelo usuário (track ended).");
          safeStopRecording();
        };
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
      safeSet(() => setIsRecording(true));
      startTimer();
    } catch (e) {
      console.error("startRecording:", e);
      alert("Erro ao iniciar. Verifique permissões de tela e áudio.");

      if (selecionada?.id) {
        await supabase
          .from("reunioes")
          .update({
            gravacao_status: "ERRO",
            gravacao_erro: String(e?.message || e),
          })
          .eq("id", selecionada.id);
      }

      safeSet(() => setIsRecording(false));
      stopTimer();
      cleanupMedia();
    }
  };

  /**
   * Stop geral
   */
  const safeStopRecording = async () => {
    if (stopAllRequestedRef.current) return;
    stopAllRequestedRef.current = true;

    try {
      safeSet(() => setIsRecording(false));
      stopTimer();
      clearInterval(segmentIntervalRef.current);

      const rec = recorderRef.current;
      if (rec && rec.state === "recording") {
        rec.stop();
      } else {
        await finalizeRecording();
      }
    } catch (e) {
      console.error("safeStopRecording:", e);
      await finalizeRecording();
    }
  };

  const stopRecording = () => {
    safeStopRecording();
  };

  /**
   * Finalização
   */
  const finalizeRecording = async () => {
    if (!selecionada?.id) return;
    if (isProcessing) return;

    safeSet(() => setIsProcessing(true));

    try {
      await waitQueueDrain();
      await Promise.allSettled(Array.from(uploadsInFlightRef.current));

      const duracao = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : timer;

      const { data: reuniaoAtual, error: selErr } = await supabase
        .from("reunioes")
        .select("gravacao_status")
        .eq("id", selecionada.id)
        .single();

      if (selErr) console.warn("finalize select:", selErr);

      const statusAtual = reuniaoAtual?.gravacao_status;

      if (statusAtual !== "ERRO") {
        await supabase
          .from("reunioes")
          .update({
            status: "Realizada",
            duracao_segundos: duracao,
            gravacao_fim: nowIso(),
            gravacao_status: "PRONTO_PROCESSAR",
          })
          .eq("id", selecionada.id);

        await enqueueDriveJob();
        await enqueueCompileJob();
      } else {
        await supabase
          .from("reunioes")
          .update({
            duracao_segundos: duracao,
            gravacao_fim: nowIso(),
          })
          .eq("id", selecionada.id);
      }

      await fetchReunioes();
    } catch (e) {
      console.error("finalizeRecording:", e);
      if (selecionada?.id) {
        await supabase
          .from("reunioes")
          .update({
            gravacao_status: "ERRO",
            gravacao_erro: String(e?.message || e),
          })
          .eq("id", selecionada.id);
      }
    } finally {
      safeSet(() => setIsProcessing(false));

      cleanupMedia();

      sessionIdRef.current = null;
      partNumberRef.current = 0;
      startTimeRef.current = null;
      stopAllRequestedRef.current = false;
      rotatingRef.current = false;

      uploadQueueRef.current = [];
      uploadsInFlightRef.current.clear();
      queueDrainPromiseRef.current = null;
    }
  };

  /**
   * Media cleanup
   */
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
    } catch (e) {
      console.warn("cleanupMedia:", e);
    }
  };

  /**
   * UI
   */
  return (
    <Layout>
      <div className="h-screen bg-[#0f172a] text-white flex overflow-hidden">
        {/* COLUNA ESQUERDA */}
        <div className="w-7/12 flex flex-col p-6 border-r border-slate-800">
          <h1 className="text-2xl font-black text-blue-500 mb-6 flex items-center gap-2">
            <Cpu size={32} /> COPILOTO TÁTICO
          </h1>

          <div className="flex gap-2 mb-4">
            <input
              type="date"
              className="bg-slate-800 rounded-xl p-3 text-sm flex-1"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
            />
            <input
              type="text"
              placeholder="Buscar..."
              className="bg-slate-800 rounded-xl p-3 text-sm flex-1"
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-y-auto mb-6 custom-scrollbar">
            {(reunioes || [])
              .filter((r) =>
                (r.titulo || "")
                  .toLowerCase()
                  .includes((busca || "").toLowerCase())
              )
              .map((r) => (
                <div
                  key={r.id}
                  onClick={() => !isRecording && setSelecionada(r)}
                  className={`p-4 border-b border-slate-800 cursor-pointer ${
                    selecionada?.id === r.id
                      ? "bg-blue-600/10 border-l-4 border-l-blue-500"
                      : "hover:bg-slate-800"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">{r.titulo}</span>
                    <span className="text-[10px] bg-slate-700 px-2 py-1 rounded font-bold uppercase">
                      {r.gravacao_status || r.status || "Pendente"}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* CONTROLES */}
          <div className="bg-slate-800/80 p-6 rounded-3xl flex items-center justify-between border border-slate-700">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  isRecording
                    ? "bg-red-500/20 text-red-500"
                    : "bg-blue-500/20 text-blue-500"
                }`}
              >
                {isRecording ? (
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-ping" />
                ) : (
                  <Monitor size={28} />
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Tempo de Sessão
                </p>
                <p className="text-2xl font-mono font-bold leading-none">
                  {secondsToMMSS(timer)}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Segmentos: {Math.max(partNumberRef.current, 0)} (a cada 5 min)
                </p>
              </div>
            </div>

            {isProcessing ? (
              <div className="flex items-center gap-2 text-blue-400 font-bold animate-pulse">
                <Loader2 className="animate-spin" /> FINALIZANDO...
              </div>
            ) : isRecording ? (
              <button
                onClick={stopRecording}
                className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-xs hover:bg-red-50 transition-all"
              >
                ENCERRAR
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={!selecionada}
                className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs hover:bg-blue-500 disabled:opacity-20 transition-all shadow-lg shadow-blue-900/40"
              >
                INICIAR GRAVAÇÃO
              </button>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="w-5/12 p-6 flex flex-col bg-slate-900/80">
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-tighter">
              Nova Ação Direta
            </h2>

            <textarea
              className="w-full bg-slate-800 border-none rounded-2xl p-4 text-sm h-24 mb-3 outline-none focus:ring-2 ring-blue-500"
              placeholder="O que precisa ser feito?"
              value={novaAcao.descricao}
              onChange={(e) =>
                setNovaAcao({ ...novaAcao, descricao: e.target.value })
              }
            />

            <div className="flex gap-2">
              <input
                className="bg-slate-800 rounded-xl px-4 py-2 text-xs flex-1"
                placeholder="Responsável"
                value={novaAcao.responsavel}
                onChange={(e) =>
                  setNovaAcao({ ...novaAcao, responsavel: e.target.value })
                }
              />
              <button
                onClick={salvarAcao}
                className="bg-blue-600 p-2 rounded-xl hover:bg-blue-500"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
            <h2 className="text-xs font-bold text-green-500 uppercase flex items-center gap-2">
              <CheckCircle size={14} /> Ações Confirmadas
            </h2>

            {loadingAcoes ? (
              <div className="text-slate-400 text-sm">Carregando ações...</div>
            ) : (
              (acoes || []).map((a) => (
                <div
                  key={a.id}
                  className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl text-xs"
                >
                  <p className="text-slate-200">{a.descricao}</p>
                  <p className="mt-2 text-blue-400 font-bold">{a.responsavel}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

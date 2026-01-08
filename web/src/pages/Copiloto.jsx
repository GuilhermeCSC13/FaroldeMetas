import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import {
  Loader2,
  Cpu,
  CheckCircle,
  Monitor,
  Plus,
} from "lucide-react";

/**
 * CONFIG
 */
const STORAGE_BUCKET = "gravacoes"; // bucket do Supabase Storage
const CHUNK_TIMESLICE_MS = 5000; // 5s (equilíbrio bom)
const MIME_TYPE = "video/webm;codecs=vp8,opus";

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

/**
 * OBS:
 * - Não usamos variáveis globais para não “vazar estado” entre reuniões.
 * - Em caso de refresh no meio, a gravação do navegador será interrompida mesmo.
 *   O que garantimos aqui é robustez para gravações longas e encerramento correto.
 */
export default function Copiloto() {
  // UI / filtros
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [busca, setBusca] = useState("");

  // ações
  const [acoes, setAcoes] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel: "" });
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  // gravação
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // aqui é “finalização rápida”
  const [timer, setTimer] = useState(0);

  // refs (estado de gravação)
  const recorderRef = useRef(null);
  const displayStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  // sessão/chunks
  const sessionIdRef = useRef(null);
  const chunkIndexRef = useRef(0);
  const uploadsInFlightRef = useRef(new Set()); // guarda promises de upload para aguardar no stop
  const stopRequestedRef = useRef(false);
  const lastErrorRef = useRef(null);

  /**
   * Data fetch
   */
  useEffect(() => {
    fetchReunioes();
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFiltro]);

  useEffect(() => {
    if (selecionada) fetchAcoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada]);

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
    setReunioes(data || []);
  };

  const fetchAcoes = async () => {
    setLoadingAcoes(true);
    const { data, error } = await supabase
      .from("acoes")
      .select("*")
      .eq("reuniao_id", selecionada.id)
      .order("created_at", { ascending: false });

    if (error) console.error("fetchAcoes:", error);
    setAcoes(data || []);
    setLoadingAcoes(false);
  };

  const salvarAcao = async () => {
    if (!novaAcao.descricao?.trim()) return;

    const payload = {
      ...novaAcao,
      reuniao_id: selecionada.id,
      status: "Aberta",
    };

    const { data, error } = await supabase.from("acoes").insert([payload]).select();
    if (error) {
      console.error("salvarAcao:", error);
      return;
    }
    setAcoes([data[0], ...acoes]);
    setNovaAcao({ descricao: "", responsavel: "" });
  };

  /**
   * Timer
   */
  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
  };

  /**
   * Storage path builder
   */
  const buildChunkPath = (reuniaoId, sessionId, partNumber) => {
    // Ex: reunioes/123/sess_.../part_000001.webm
    return `reunioes/${reuniaoId}/${sessionId}/part_${safeFilePart(partNumber)}.webm`;
  };

  /**
   * Upload chunk (sem base64; sobe Blob direto)
   */
  const uploadChunk = async (blob) => {
    if (!selecionada?.id) return;
    if (!sessionIdRef.current) return;

    const reuniaoId = selecionada.id;
    const sessionId = sessionIdRef.current;

    const partNumber = ++chunkIndexRef.current;
    const path = buildChunkPath(reuniaoId, sessionId, partNumber);

    // upload do chunk no Storage
    const uploadPromise = (async () => {
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, blob, {
          contentType: "video/webm",
          cacheControl: "3600",
          upsert: false,
        });

      if (upErr) throw upErr;

      // registra metadata do chunk
      const { error: insErr } = await supabase
        .from("reuniao_gravacao_partes")
        .insert([{
          reuniao_id: reuniaoId,
          session_id: sessionId,
          part_number: partNumber,
          storage_bucket: STORAGE_BUCKET,
          storage_path: path,
          bytes: blob.size,
          status: "UPLOADED",
        }]);

      if (insErr) throw insErr;
    })();

    uploadsInFlightRef.current.add(uploadPromise);

    try {
      await uploadPromise;
    } catch (e) {
      console.error("uploadChunk error:", e);
      lastErrorRef.current = e;
      // se falhar, marcamos a reunião como erro de gravação
      await supabase
        .from("reunioes")
        .update({
          gravacao_status: "ERRO",
          gravacao_erro: String(e?.message || e),
          updated_at: nowIso?.() ? nowIso() : new Date().toISOString(),
        })
        .eq("id", reuniaoId);
      // encerramos a gravação para não seguir “gravando sem salvar”
      await safeStopRecording();
    } finally {
      uploadsInFlightRef.current.delete(uploadPromise);
    }
  };

  /**
   * Start recording: tela + áudio do mic (mix)
   */
  const startRecording = async () => {
    if (!selecionada) return alert("Selecione uma reunião.");
    if (isRecording) return;

    lastErrorRef.current = null;
    stopRequestedRef.current = false;
    setTimer(0);

    try {
      // cria session_id (uuid v4 via crypto)
      const sessionId = `sess_${crypto.randomUUID()}`;
      sessionIdRef.current = sessionId;
      chunkIndexRef.current = 0;

      // marca reunião como em andamento
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

      // captura streams
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      displayStreamRef.current = displayStream;
      micStreamRef.current = micStream;

      // se o usuário encerrar compartilhamento, parar gravação corretamente
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.warn("Tela encerrada pelo usuário (track ended).");
          safeStopRecording();
        };
      }

      // mix de áudio (mic + audio da tela, se existir)
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

      // valida mimeType
      let options = {};
      if (MediaRecorder.isTypeSupported(MIME_TYPE)) {
        options = { mimeType: MIME_TYPE };
      }

      const recorder = new MediaRecorder(mixedStream, options);
      recorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;
        // faz upload do chunk (não acumula em memória)
        await uploadChunk(e.data);
      };

      recorder.onstop = async () => {
        // o stop real chama finalize (abaixo)
        await finalizeRecording();
      };

      startTimeRef.current = Date.now();
      setIsRecording(true);
      startTimer();

      recorder.start(CHUNK_TIMESLICE_MS);
    } catch (e) {
      console.error("startRecording:", e);
      alert("Erro ao iniciar. Verifique permissões de tela e áudio.");
      // marca erro
      if (selecionada?.id) {
        await supabase
          .from("reunioes")
          .update({ gravacao_status: "ERRO", gravacao_erro: String(e?.message || e) })
          .eq("id", selecionada.id);
      }
      setIsRecording(false);
      stopTimer();
      cleanupMedia();
    }
  };

  /**
   * stop: solicita parada, encerra tracks, espera uploads e finaliza status rápido
   */
  const safeStopRecording = async () => {
    if (stopRequestedRef.current) return;
    stopRequestedRef.current = true;

    try {
      // parar UI
      setIsRecording(false);
      stopTimer();

      // parar recorder
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      } else {
        // se já inativo, finalize direto
        await finalizeRecording();
      }
    } catch (e) {
      console.error("safeStopRecording:", e);
      // tenta finalizar mesmo assim
      await finalizeRecording();
    } finally {
      // sempre para streams
      cleanupMedia();
    }
  };

  const stopRecording = () => {
    safeStopRecording();
  };

  /**
   * Finalização rápida: aguarda uploads em voo e marca PRONTO_PROCESSAR
   */
  const finalizeRecording = async () => {
    if (!selecionada?.id) return;
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      // aguarda uploads pendentes
      await Promise.allSettled(Array.from(uploadsInFlightRef.current));

      const duracao = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : timer;

      // Se houve erro em algum chunk, gravacao_status já foi setado ERRO
      // Caso contrário, marca como pronto para processamento assíncrono.
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
            status: "Realizada", // ou "Gravada" se preferir separar
            duracao_segundos: duracao,
            gravacao_fim: nowIso(),
            gravacao_status: "PRONTO_PROCESSAR",
          })
          .eq("id", selecionada.id);
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
          .update({ gravacao_status: "ERRO", gravacao_erro: String(e?.message || e) })
          .eq("id", selecionada.id);
      }
    } finally {
      setIsProcessing(false);
      // reseta refs de sessão
      sessionIdRef.current = null;
      chunkIndexRef.current = 0;
      startTimeRef.current = null;
      stopRequestedRef.current = false;
    }
  };

  /**
   * Media cleanup
   */
  const cleanupMedia = () => {
    try {
      const rec = recorderRef.current;
      recorderRef.current = null;

      const ds = displayStreamRef.current;
      if (ds) ds.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;

      const ms = micStreamRef.current;
      if (ms) ms.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;

      const ac = audioCtxRef.current;
      if (ac && ac.state !== "closed") ac.close();
      audioCtxRef.current = null;

      // evita “ícone preso” se algo falhar
      if (rec && rec.state !== "inactive") {
        try { rec.stop(); } catch {}
      }
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
              .filter((r) => (r.titulo || "").toLowerCase().includes((busca || "").toLowerCase()))
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
                  isRecording ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"
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

// src/pages/Copiloto.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import { Loader2, Cpu, CheckCircle, Monitor, Plus } from "lucide-react";
import { useRecording } from "../context/RecordingContext";

function secondsToMMSS(s) {
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function Copiloto() {
  const { isRecording, isProcessing, timer, startRecording, stopRecording, current } =
    useRecording();

  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [busca, setBusca] = useState("");

  const [acoes, setAcoes] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel: "" });
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  // ✅ trava de stop + fallback visual
  const [stopRequested, setStopRequested] = useState(false);
  const [stopStartedAt, setStopStartedAt] = useState(null);

  const isMountedRef = useRef(false);
  const safeSet = (fn) => {
    if (isMountedRef.current) fn();
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchReunioes();
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchReunioes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFiltro]);

  useEffect(() => {
    if (selecionada) fetchAcoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada]);

  // ✅ POLLING: enquanto gravando/finalizando, atualiza lista/status a cada 4s
  useEffect(() => {
    if (!isRecording && !isProcessing && !stopRequested) return;

    const t = setInterval(() => {
      fetchReunioes();
    }, 4000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, isProcessing, stopRequested, dataFiltro]);

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

    // ✅ se estiver gravando, mantém a reunião selecionada alinhada com current
    if ((isRecording || isProcessing || stopRequested) && current?.reuniaoId) {
      const found = (data || []).find((r) => r.id === current.reuniaoId);
      if (found) safeSet(() => setSelecionada(found));
    }
  };

  const fetchAcoes = async () => {
    if (!selecionada?.id) return;

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
    if (!selecionada?.id) return;
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

    safeSet(() => setAcoes([data?.[0], ...(acoes || [])].filter(Boolean)));
    safeSet(() => setNovaAcao({ descricao: "", responsavel: "" }));
  };

  const onStart = async () => {
    if (!selecionada?.id) return alert("Selecione uma reunião.");
    if (isRecording || isProcessing || stopRequested) return;

    try {
      await startRecording({
        reuniaoId: selecionada.id,
        reuniaoTitulo: selecionada.titulo,
      });

      await fetchReunioes();
    } catch (e) {
      console.error("startRecording (Copiloto):", e);
      alert("Erro ao iniciar. Verifique permissões de tela e áudio.");
    }
  };

  const onStop = async () => {
    if (stopRequested) return;

    try {
      setStopRequested(true);
      setStopStartedAt(Date.now());

      // ✅ aguarda o stop real do contexto
      await stopRecording();
      await fetchReunioes();
    } catch (e) {
      console.error("stopRecording (Copiloto):", e);
      alert("Erro ao encerrar a gravação. Veja o console/Render logs.");
    } finally {
      // ✅ nunca deixa a UI “sem botão”
      setStopRequested(false);
      setStopStartedAt(null);
    }
  };

  // ✅ fallback: se ficar muito tempo finalizando, avisa visualmente
  const finalizandoHaMuitoTempo = useMemo(() => {
    if (!stopStartedAt) return false;
    return Date.now() - stopStartedAt > 30000; // 30s
  }, [stopStartedAt]);

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
                (r.titulo || "").toLowerCase().includes((busca || "").toLowerCase())
              )
              .map((r) => (
                <div
                  key={r.id}
                  onClick={() => !isRecording && !isProcessing && !stopRequested && setSelecionada(r)}
                  className={`p-4 border-b border-slate-800 cursor-pointer ${
                    selecionada?.id === r.id
                      ? "bg-blue-600/10 border-l-4 border-l-blue-500"
                      : "hover:bg-slate-800"
                  } ${(isRecording || isProcessing || stopRequested) ? "opacity-80" : ""}`}
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
                <p className="text-[10px] font-bold text-slate-500 uppercase">Tempo de Sessão</p>
                <p className="text-2xl font-mono font-bold leading-none">{secondsToMMSS(timer)}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isRecording && current?.reuniaoTitulo
                    ? `Gravando: ${current.reuniaoTitulo}`
                    : "Pronto para gravar"}
                </p>

                {(isProcessing || stopRequested) && finalizandoHaMuitoTempo && (
                  <p className="text-[10px] text-amber-300 mt-1">
                    Finalização demorando… verifique logs do Render (ou a rede).
                  </p>
                )}
              </div>
            </div>

            {/* ✅ nunca “some”: sempre cai em um desses estados */}
            {(isProcessing || stopRequested) ? (
              <div className="flex items-center gap-2 text-blue-400 font-bold animate-pulse">
                <Loader2 className="animate-spin" /> FINALIZANDO...
              </div>
            ) : isRecording ? (
              <button
                onClick={onStop}
                className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-xs hover:bg-red-50 transition-all"
              >
                ENCERRAR
              </button>
            ) : (
              <button
                onClick={onStart}
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
              onChange={(e) => setNovaAcao({ ...novaAcao, descricao: e.target.value })}
            />

            <div className="flex gap-2">
              <input
                className="bg-slate-800 rounded-xl px-4 py-2 text-xs flex-1"
                placeholder="Responsável"
                value={novaAcao.responsavel}
                onChange={(e) => setNovaAcao({ ...novaAcao, responsavel: e.target.value })}
              />
              <button
                onClick={salvarAcao}
                disabled={!selecionada || !novaAcao.descricao?.trim()}
                className="bg-blue-600 p-2 rounded-xl hover:bg-blue-500 disabled:opacity-30"
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
            ) : (acoes || []).length === 0 ? (
              <div className="text-slate-400 text-sm">
                {selecionada ? "Nenhuma ação cadastrada ainda." : "Selecione uma reunião."}
              </div>
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

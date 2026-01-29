import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import {
  Loader2,
  Cpu,
  CheckCircle,
  Monitor,
  Plus,
  Lock,
  FileText,
  StickyNote,
  ListChecks,
} from "lucide-react";
import { useRecording } from "../context/RecordingContext";
import ModalDetalhesAcao from "../components/tatico/ModalDetalhesAcao";

/* =========================
   Helpers
========================= */
function secondsToMMSS(s) {
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

const toBR = (dt) =>
  dt ? new Date(dt).toLocaleString("pt-BR") : "-";

/* =========================
   Página
========================= */
export default function Copiloto() {
  const {
    isRecording,
    isProcessing,
    timer,
    startRecording,
    stopRecording,
    current,
  } = useRecording();

  const [dataFiltro, setDataFiltro] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [busca, setBusca] = useState("");

  const [acoes, setAcoes] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel: "" });
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  const [ataPrincipal, setAtaPrincipal] = useState("");
  const [ataManual, setAtaManual] = useState("");
  const [editAtaManual, setEditAtaManual] = useState(false);

  const [abaDireita, setAbaDireita] = useState("acoes"); // acoes | ata_principal | ata_manual
  const [acaoSelecionada, setAcaoSelecionada] = useState(null);

  const [showUnlock, setShowUnlock] = useState(false);
  const [senhaAdm, setSenhaAdm] = useState("");

  const isMountedRef = useRef(false);
  const safeSet = (fn) => {
    if (isMountedRef.current) fn();
  };

  /* =========================
     Lifecycle
  ========================= */
  useEffect(() => {
    isMountedRef.current = true;
    fetchReunioes();
    return () => (isMountedRef.current = false);
  }, []);

  useEffect(() => {
    fetchReunioes();
  }, [dataFiltro]);

  useEffect(() => {
    if (selecionada) {
      fetchAcoes();
      carregarAtas(selecionada);
    }
  }, [selecionada?.id]);

  /* =========================
     Reuniões
  ========================= */
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

    if (isRecording && current?.reuniaoId) {
      const found = (data || []).find((r) => r.id === current.reuniaoId);
      if (found) safeSet(() => setSelecionada(found));
    }
  };

  /* =========================
     Atas
  ========================= */
  const carregarAtas = async (r) => {
    setAtaManual(r.ata_manual || "");
    setEditAtaManual(false);

    const { data } = await supabase
      .from("tipos_reuniao")
      .select("ata_principal")
      .eq("id", r.tipo_reuniao_id)
      .single();

    setAtaPrincipal(data?.ata_principal || "");
  };

  const salvarAtaManual = async () => {
    await supabase
      .from("reunioes")
      .update({ ata_manual: ataManual })
      .eq("id", selecionada.id);

    setEditAtaManual(false);
  };

  /* =========================
     Ações
  ========================= */
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
    if (!selecionada?.id || !novaAcao.descricao?.trim()) return;

    const payload = {
      ...novaAcao,
      reuniao_id: selecionada.id,
      tipo_reuniao_id: selecionada.tipo_reuniao_id,
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

    safeSet(() =>
      setAcoes([data?.[0], ...(acoes || [])].filter(Boolean))
    );
    safeSet(() => setNovaAcao({ descricao: "", responsavel: "" }));
  };

  /* =========================
     Gravação
  ========================= */
  const onStart = async () => {
    if (!selecionada?.id) return alert("Selecione uma reunião.");
    await startRecording({
      reuniaoId: selecionada.id,
      reuniaoTitulo: selecionada.titulo,
    });
  };

  const onStop = async () => {
    await stopRecording();
    await supabase
      .from("reunioes")
      .update({ status: "Realizada" })
      .eq("id", selecionada.id);
    fetchReunioes();
  };

  /* =========================
     Reabrir com ADM
  ========================= */
  const validarSenhaAdm = async () => {
    const { data } = await supabase
      .from("usuarios_aprovadores")
      .select("id")
      .eq("senha", senhaAdm)
      .eq("nivel", "Administrador")
      .eq("ativo", true)
      .single();

    if (!data) return alert("Senha inválida");

    await supabase
      .from("reunioes")
      .update({ status: "Pendente" })
      .eq("id", selecionada.id);

    setShowUnlock(false);
    setSenhaAdm("");
    fetchReunioes();
  };

  /* =========================
     UI
  ========================= */
  return (
    <Layout>
      <div className="h-screen bg-[#0f172a] text-white flex overflow-hidden">
        {/* COLUNA ESQUERDA – ORIGINAL */}
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

          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-y-auto mb-6">
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
                  <div className="flex justify-between">
                    <span className="font-bold text-sm">{r.titulo}</span>
                    <span className="text-[10px] bg-slate-700 px-2 py-1 rounded font-bold uppercase">
                      {r.status || "Pendente"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {toBR(r.data_hora)}
                  </div>
                </div>
              ))}
          </div>

          {/* CONTROLES – ORIGINAL */}
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
                <p className="text-2xl font-mono font-bold">
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
                onClick={onStop}
                className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-xs"
              >
                ENCERRAR
              </button>
            ) : (
              <button
                onClick={onStart}
                disabled={!selecionada}
                className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs disabled:opacity-20"
              >
                INICIAR GRAVAÇÃO
              </button>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA – CAMADAS */}
        <div className="w-5/12 p-6 flex flex-col bg-slate-900/80">
          {/* TABS */}
          <div className="flex gap-2 mb-4">
            <Tab label="Ações" icon={ListChecks} active={abaDireita==="acoes"} onClick={()=>setAbaDireita("acoes")} />
            <Tab label="Ata Principal" icon={FileText} active={abaDireita==="ata_principal"} onClick={()=>setAbaDireita("ata_principal")} />
            <Tab label="Ata Manual" icon={StickyNote} active={abaDireita==="ata_manual"} onClick={()=>setAbaDireita("ata_manual")} />
          </div>

          {abaDireita === "acoes" && (
            <>
              <h2 className="text-xs font-bold text-slate-400 uppercase mb-2">
                Nova Ação Direta
              </h2>

              <textarea
                className="w-full bg-slate-800 rounded-2xl p-4 text-sm h-24 mb-3"
                placeholder="O que precisa ser feito?"
                value={novaAcao.descricao}
                onChange={(e) =>
                  setNovaAcao({ ...novaAcao, descricao: e.target.value })
                }
              />

              <div className="flex gap-2 mb-4">
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
                  disabled={!selecionada}
                  className="bg-blue-600 p-2 rounded-xl"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {loadingAcoes ? (
                  <div className="text-slate-400">Carregando...</div>
                ) : (
                  (acoes || []).map((a) => (
                    <div
                      key={a.id}
                      onClick={() => setAcaoSelecionada(a)}
                      className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl cursor-pointer"
                    >
                      <p className="text-slate-200 text-sm">{a.descricao}</p>
                      <p className="mt-2 text-blue-400 font-bold text-xs">
                        {a.responsavel}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {abaDireita === "ata_principal" && (
            <pre className="whitespace-pre-wrap text-sm text-slate-200">
              {ataPrincipal || "—"}
            </pre>
          )}

          {abaDireita === "ata_manual" && (
            <>
              {editAtaManual ? (
                <>
                  <textarea
                    className="w-full bg-slate-800 rounded-2xl p-4 text-sm h-64"
                    value={ataManual}
                    onChange={(e) => setAtaManual(e.target.value)}
                  />
                  <button
                    onClick={salvarAtaManual}
                    className="mt-3 bg-blue-600 px-4 py-2 rounded-xl text-xs font-black"
                  >
                    Salvar
                  </button>
                </>
              ) : (
                <>
                  <pre className="whitespace-pre-wrap text-sm">
                    {ataManual || "—"}
                  </pre>
                  <button
                    onClick={() => setEditAtaManual(true)}
                    className="text-xs text-blue-400 mt-2"
                  >
                    Editar
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {acaoSelecionada && (
        <ModalDetalhesAcao
          acao={acaoSelecionada}
          onClose={() => setAcaoSelecionada(null)}
          onSaved={fetchAcoes}
        />
      )}

      {showUnlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl w-[360px] text-black">
            <div className="font-black mb-2">Senha do Administrador</div>
            <input
              type="password"
              value={senhaAdm}
              onChange={(e) => setSenhaAdm(e.target.value)}
              className="w-full border rounded-xl p-3"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={validarSenhaAdm}
                className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black"
              >
                Liberar
              </button>
              <button
                onClick={() => setShowUnlock(false)}
                className="border px-4 py-2 rounded-xl text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* =========================
   UI Aux
========================= */
function Tab({ label, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black ${
        active ? "bg-blue-600" : "bg-slate-800 text-slate-400"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

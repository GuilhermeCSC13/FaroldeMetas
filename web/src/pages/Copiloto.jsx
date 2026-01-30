// src/pages/Copiloto.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import {
  Bot,
  Search,
  Calendar,
  Lock,
  FileText,
  ClipboardList,
  StickyNote,
  Plus,
  Save,
  X,
  RefreshCw,
} from "lucide-react";
import { useRecording } from "../context/RecordingContext";
import ModalDetalhesAcao from "../components/tatico/ModalDetalhesAcao";

/* =========================
   Helpers
========================= */
function nowIso() {
  return new Date().toISOString();
}

function toBR(dt) {
  try {
    return dt ? new Date(dt).toLocaleString("pt-BR") : "-";
  } catch {
    return "-";
  }
}

function norm(s) {
  return String(s || "").trim().toUpperCase();
}

function secondsToMMSS(s) {
  const mm = Math.floor((s || 0) / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor((s || 0) % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

/* =========================
   Page
========================= */
export default function Copiloto() {
  const { isRecording, isProcessing, timer, startRecording, stopRecording, current } =
    useRecording();

  // filtros esquerda
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [busca, setBusca] = useState("");

  // reuniões
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);

  // tabs direita
  const [tab, setTab] = useState("acoes"); // acoes | ata_principal | ata_manual

  // Atas
  const [ataPrincipal, setAtaPrincipal] = useState("");
  const [ataManual, setAtaManual] = useState("");
  const [editAtaManual, setEditAtaManual] = useState(false);

  // Ações
  const [loadingAcoes, setLoadingAcoes] = useState(false);
  const [acoesDaReuniao, setAcoesDaReuniao] = useState([]);
  const [acoesPendentesTipo, setAcoesPendentesTipo] = useState([]);
  const [acoesConcluidasDesdeUltima, setAcoesConcluidasDesdeUltima] = useState([]);
  const [acaoTab, setAcaoTab] = useState("reuniao"); // reuniao | backlog | desde_ultima

  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel: "" });

  // Modal Ação (Central)
  const [acaoSelecionada, setAcaoSelecionada] = useState(null);

  // Reabrir (ADM)
  const [showUnlock, setShowUnlock] = useState(false);
  const [senhaAdm, setSenhaAdm] = useState("");

  // safe set
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
    if (!selecionada?.id) return;

    // carregar atas e ações quando troca a reunião
    carregarAtas(selecionada);
    fetchAcoes(selecionada);

    // padrão: ações da reunião
    setTab("acoes");
    setAcaoTab("reuniao");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada?.id]);

  /* =========================
     Fetch Reuniões (do dia)
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

    // se está gravando, “prende” na reunião atual
    if (isRecording && current?.reuniaoId) {
      const found = (data || []).find((r) => r.id === current.reuniaoId);
      if (found) safeSet(() => setSelecionada(found));
    } else {
      // se a selecionada sumiu (troca de dia), limpa
      if (selecionada?.id) {
        const still = (data || []).some((r) => r.id === selecionada.id);
        if (!still) safeSet(() => setSelecionada(null));
      }
    }
  };

  /* =========================
     Atas
     - Principal: tipos_reuniao.ata_principal (RO)
     - Manual: reunioes.ata_manual (editável)
  ========================= */
  const carregarAtas = async (r) => {
    safeSet(() => {
      setAtaManual(String(r?.ata_manual || "").trim());
      setEditAtaManual(false);
      setAtaPrincipal("");
    });

    if (!r?.tipo_reuniao_id) return;

    const { data, error } = await supabase
      .from("tipos_reuniao")
      .select("ata_principal")
      .eq("id", r.tipo_reuniao_id)
      .maybeSingle();

    if (error) {
      console.error("carregarAtas:", error);
      return;
    }

    safeSet(() => setAtaPrincipal(String(data?.ata_principal || "").trim()));
  };

  const salvarAtaManual = async () => {
    if (!selecionada?.id) return;

    const { error } = await supabase
      .from("reunioes")
      .update({ ata_manual: ataManual, updated_at: nowIso() })
      .eq("id", selecionada.id);

    if (error) {
      alert("Erro ao salvar Ata Manual: " + (error.message || error));
      return;
    }

    setEditAtaManual(false);
    fetchReunioes();
  };

  /* =========================
     Gravação (rodapé)
  ========================= */
  const onStart = async () => {
    if (!selecionada?.id) return alert("Selecione uma reunião.");
    if (isRecording) return;

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
    try {
      await stopRecording();

      // ✅ encerrou => reunião realizada
      if (selecionada?.id) {
        await supabase.from("reunioes").update({ status: "Realizada" }).eq("id", selecionada.id);
      }

      await fetchReunioes();
      if (selecionada?.id) await fetchAcoes(selecionada);
    } catch (e) {
      console.error("stopRecording (Copiloto):", e);
      alert("Erro ao encerrar a gravação.");
    }
  };

  /* =========================
     Reabrir (senha ADM)
  ========================= */
  const validarSenhaAdm = async () => {
    if (!selecionada?.id) return;

    const senha = String(senhaAdm || "").trim();
    if (!senha) return alert("Informe a senha.");

    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("id, nivel, ativo")
      .eq("senha", senha)
      .eq("nivel", "Administrador")
      .eq("ativo", true)
      .maybeSingle();

    if (error) {
      console.error("validarSenhaAdm:", error);
      return alert("Erro ao validar senha.");
    }

    if (!data?.id) return alert("Senha inválida.");

    const { error: e2 } = await supabase
      .from("reunioes")
      .update({ status: "Pendente" })
      .eq("id", selecionada.id);

    if (e2) {
      console.error("reabrir reuniao:", e2);
      return alert("Erro ao reabrir reunião.");
    }

    setShowUnlock(false);
    setSenhaAdm("");
    fetchReunioes();
  };

  /* =========================
     AÇÕES (todas as melhorias)
     1) da reunião
     2) backlog pendente do tipo (por tipo_reuniao_id)
     3) concluídas desde última reunião do tipo
  ========================= */
  const fetchAcoes = async (r) => {
    if (!r?.id) return;

    safeSet(() => setLoadingAcoes(true));

    try {
      // 1) Ações da reunião
      const { data: daReuniao, error: e1 } = await supabase
        .from("acoes")
        .select("*")
        .eq("reuniao_id", r.id)
        .order("created_at", { ascending: false });

      if (e1) throw e1;

      // 2) Backlog pendente do tipo (tipo_reuniao_id obrigatório)
      // - status Aberta
      // - excluir as da própria reunião
      const tipoId = r.tipo_reuniao_id;

      let pendTipo = [];
      if (tipoId) {
        const { data: pend, error: e2 } = await supabase
          .from("acoes")
          .select("*")
          .eq("tipo_reuniao_id", tipoId)
          .eq("status", "Aberta")
          .or(`reuniao_id.is.null,reuniao_id.neq.${r.id}`)
          .order("created_at", { ascending: false })
          .limit(500);

        if (e2) throw e2;
        pendTipo = pend || [];
      }

      // 3) Concluídas desde a última reunião do tipo
      let concluidasDesde = [];
      if (tipoId && r.data_hora) {
        // pegar a última reunião ANTERIOR do mesmo tipo
        const { data: ultima, error: e3 } = await supabase
          .from("reunioes")
          .select("id, data_hora")
          .eq("tipo_reuniao_id", tipoId)
          .lt("data_hora", r.data_hora)
          .order("data_hora", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (e3) throw e3;

        if (ultima?.data_hora) {
          // ações concluídas depois da última reunião (data_conclusao)
          // obs: assume que existe data_conclusao no schema de acoes
          const { data: concl, error: e4 } = await supabase
            .from("acoes")
            .select("*")
            .eq("tipo_reuniao_id", tipoId)
            .eq("status", "Concluída")
            .gt("data_conclusao", ultima.data_hora)
            .order("data_conclusao", { ascending: false })
            .limit(500);

          if (e4) throw e4;

          concluidasDesde = concl || [];
        } else {
          // se não existe reunião anterior, pode ficar vazio (decisão objetiva)
          concluidasDesde = [];
        }
      }

      safeSet(() => {
        setAcoesDaReuniao(daReuniao || []);
        setAcoesPendentesTipo(pendTipo || []);
        setAcoesConcluidasDesdeUltima(concluidasDesde || []);
      });
    } catch (e) {
      console.error("fetchAcoes:", e);
      safeSet(() => {
        setAcoesDaReuniao([]);
        setAcoesPendentesTipo([]);
        setAcoesConcluidasDesdeUltima([]);
      });
    } finally {
      safeSet(() => setLoadingAcoes(false));
    }
  };

  const salvarAcao = async () => {
    if (!selecionada?.id) return;
    if (!novaAcao.descricao?.trim()) return;

    // ✅ tipo_reuniao_id obrigatório
    const payload = {
      descricao: novaAcao.descricao.trim(),
      responsavel: (novaAcao.responsavel || "Geral").trim(),
      status: "Aberta",
      reuniao_id: selecionada.id,
      tipo_reuniao_id: selecionada.tipo_reuniao_id || null,
      created_at: nowIso(),
      data_criacao: nowIso(),
    };

    const { data, error } = await supabase.from("acoes").insert([payload]).select("*");

    if (error) {
      console.error("salvarAcao:", error);
      alert("Erro ao criar ação: " + (error.message || error));
      return;
    }

    safeSet(() => {
      setNovaAcao({ descricao: "", responsavel: "" });
      setAcoesDaReuniao((prev) => [data?.[0], ...(prev || [])].filter(Boolean));
    });

    // mantém na aba de ações e lista “da reunião”
    setTab("acoes");
    setAcaoTab("reuniao");
  };

  /* =========================
     UI computed
  ========================= */
  const reunioesFiltradas = useMemo(() => {
    const q = (busca || "").toLowerCase();
    return (reunioes || []).filter((r) => (r.titulo || "").toLowerCase().includes(q));
  }, [reunioes, busca]);

  const statusLabel = (r) => {
    const st = String(r?.status || "").trim();
    return st || "Pendente";
  };

  const statusBadgeClass = (lbl) => {
    const v = norm(lbl);
    if (v === "REALIZADA") return "bg-emerald-600/15 text-emerald-700 border border-emerald-200";
    if (v === "EM ANDAMENTO") return "bg-blue-600/15 text-blue-700 border border-blue-200";
    if (v === "AGENDADA") return "bg-slate-600/10 text-slate-700 border border-slate-200";
    if (v === "PENDENTE") return "bg-slate-600/10 text-slate-700 border border-slate-200";
    return "bg-slate-600/10 text-slate-700 border border-slate-200";
  };

  const listaAtiva =
    acaoTab === "reuniao"
      ? acoesDaReuniao
      : acaoTab === "backlog"
      ? acoesPendentesTipo
      : acoesConcluidasDesdeUltima;

  return (
    <Layout>
      {/* ✅ TELA CLARA */}
      <div className="h-screen bg-[#f6f8fc] text-slate-900 flex overflow-hidden">
        {/* COLUNA ESQUERDA */}
        <div className="w-[420px] min-w-[380px] max-w-[460px] flex flex-col p-5 border-r border-slate-200 bg-white">
          {/* header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Bot size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-extrabold">
                Assistente
              </div>
              <h1 className="text-lg font-black tracking-tight truncate">
                Copiloto de Reuniões
              </h1>
            </div>
          </div>

          {/* filtros */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 ring-blue-500/30"
                value={dataFiltro}
                onChange={(e) => setDataFiltro(e.target.value)}
              />
            </div>

            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 ring-blue-500/30"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          {/* lista reuniões */}
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-y-auto">
            {reunioesFiltradas.map((r) => {
              const lbl = statusLabel(r);

              return (
                <button
                  key={r.id}
                  onClick={() => !isRecording && setSelecionada(r)}
                  className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    selecionada?.id === r.id
                      ? "bg-blue-50 border-l-4 border-l-blue-600"
                      : "border-l-4 border-l-transparent"
                  } ${isRecording ? "opacity-80 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-black text-xs truncate">
                        {r.titulo || "Sem título"}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {toBR(r.data_hora)}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-1 rounded-lg font-extrabold uppercase whitespace-nowrap ${statusBadgeClass(
                        lbl
                      )}`}
                    >
                      {lbl}
                    </span>
                  </div>
                </button>
              );
            })}

            {reunioesFiltradas.length === 0 && (
              <div className="p-6 text-xs text-slate-500">
                Nenhuma reunião nesta data.
              </div>
            )}
          </div>

          {/* CONTROLES (rodapé) */}
          <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase">
                Tempo de sessão
              </div>
              <div className="text-lg font-black font-mono leading-none">
                {secondsToMMSS(timer)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {isRecording && current?.reuniaoTitulo
                  ? `Gravando: ${current.reuniaoTitulo}`
                  : "Pronto para gravar"}
              </div>
            </div>

            {isProcessing ? (
              <div className="text-blue-700 font-extrabold text-xs animate-pulse">
                FINALIZANDO...
              </div>
            ) : isRecording ? (
              <button
                onClick={onStop}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs hover:bg-slate-800 transition-all"
              >
                ENCERRAR
              </button>
            ) : (
              <button
                onClick={onStart}
                disabled={!selecionada}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-xs hover:bg-blue-500 disabled:opacity-30 transition-all shadow-sm"
              >
                INICIAR GRAVAÇÃO
              </button>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* header reunião selecionada */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 font-extrabold uppercase">
                  Reunião selecionada
                </div>
                <div className="text-base font-black truncate">
                  {selecionada?.titulo || "—"}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Execução:{" "}
                  <span className="text-slate-900 font-bold">
                    {selecionada?.data_hora ? toBR(selecionada.data_hora) : "—"}
                  </span>
                  {selecionada?.status === "Realizada" ? (
                    <span className="ml-2 text-emerald-700 font-extrabold">
                      • REALIZADA
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-2">
                {/* tabs */}
                <TabButton
                  active={tab === "acoes"}
                  onClick={() => setTab("acoes")}
                  icon={<ClipboardList size={16} />}
                >
                  Ações
                </TabButton>
                <TabButton
                  active={tab === "ata_principal"}
                  onClick={() => setTab("ata_principal")}
                  icon={<FileText size={16} />}
                >
                  Ata Principal
                </TabButton>
                <TabButton
                  active={tab === "ata_manual"}
                  onClick={() => setTab("ata_manual")}
                  icon={<StickyNote size={16} />}
                >
                  Ata Manual
                </TabButton>

                {/* reabrir ADM */}
                {selecionada?.status === "Realizada" && !isRecording ? (
                  <button
                    onClick={() => setShowUnlock(true)}
                    className="px-3 py-2 rounded-xl border bg-white border-red-200 text-red-700 text-xs font-extrabold flex items-center gap-2 hover:bg-red-50"
                    title="Reabrir reunião (somente ADM)"
                  >
                    <Lock size={14} />
                    Reabrir (ADM)
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* conteúdo */}
          <div className="mt-4">
            {!selecionada ? (
              <div className="text-slate-600 text-sm">Selecione uma reunião.</div>
            ) : tab === "ata_principal" ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-blue-700" />
                  Ata Principal (somente leitura)
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-900 whitespace-pre-wrap leading-relaxed min-h-[420px]">
                  {ataPrincipal || "—"}
                </div>
              </div>
            ) : tab === "ata_manual" ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <StickyNote size={16} className="text-blue-700" />
                    Ata Manual (editável)
                  </div>

                  <div className="flex gap-2">
                    {editAtaManual ? (
                      <>
                        <button
                          onClick={() => {
                            setAtaManual(String(selecionada.ata_manual || "").trim());
                            setEditAtaManual(false);
                          }}
                          className="text-[12px] font-extrabold bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <X size={14} /> Cancelar
                        </button>
                        <button
                          onClick={salvarAtaManual}
                          className="text-[12px] font-extrabold bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <Save size={14} /> Salvar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditAtaManual(true)}
                        className="text-[12px] font-extrabold bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center gap-2"
                      >
                        <Save size={14} /> Editar
                      </button>
                    )}
                  </div>
                </div>

                {editAtaManual ? (
                  <textarea
                    className="w-full min-h-[420px] bg-white border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-blue-500/25"
                    value={ataManual}
                    onChange={(e) => setAtaManual(e.target.value)}
                    placeholder="Ata manual da reunião..."
                  />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-900 whitespace-pre-wrap leading-relaxed min-h-[420px]">
                    {ataManual || "—"}
                  </div>
                )}
              </div>
            ) : (
              // tab === acoes
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <ClipboardList size={16} className="text-blue-700" />
                      Ações
                    </div>
                    <div className="text-[12px] text-slate-600 mt-1">
                      Tudo por <b>tipo_reuniao_id</b> (sem texto).
                    </div>
                  </div>

                  <button
                    onClick={() => fetchAcoes(selecionada)}
                    className="text-[12px] font-extrabold bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center gap-2"
                    disabled={loadingAcoes}
                  >
                    <RefreshCw size={14} />
                    {loadingAcoes ? "Atualizando..." : "Atualizar"}
                  </button>
                </div>

                {/* Criar ação */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
                  <div className="text-[11px] font-extrabold text-slate-600 uppercase mb-2">
                    Criar nova ação
                  </div>

                  <textarea
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm outline-none focus:ring-2 ring-blue-500/25 h-24"
                    placeholder="Descreva a ação..."
                    value={novaAcao.descricao}
                    onChange={(e) => setNovaAcao((p) => ({ ...p, descricao: e.target.value }))}
                  />

                  <div className="flex gap-2 mt-2">
                    <input
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500/25"
                      placeholder="Responsável"
                      value={novaAcao.responsavel}
                      onChange={(e) => setNovaAcao((p) => ({ ...p, responsavel: e.target.value }))}
                    />
                    <button
                      onClick={salvarAcao}
                      disabled={!novaAcao.descricao?.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2"
                    >
                      <Plus size={16} /> Criar
                    </button>
                  </div>
                </div>

                {/* Sub-tabs ações */}
                <div className="flex gap-2 mb-3">
                  <Pill active={acaoTab === "reuniao"} onClick={() => setAcaoTab("reuniao")}>
                    Da reunião ({acoesDaReuniao.length})
                  </Pill>
                  <Pill active={acaoTab === "backlog"} onClick={() => setAcaoTab("backlog")}>
                    Pendências do tipo ({acoesPendentesTipo.length})
                  </Pill>
                  <Pill active={acaoTab === "desde_ultima"} onClick={() => setAcaoTab("desde_ultima")}>
                    Concluídas desde a última ({acoesConcluidasDesdeUltima.length})
                  </Pill>
                </div>

                {/* Lista */}
                {loadingAcoes ? (
                  <div className="text-slate-600 text-sm">Carregando ações...</div>
                ) : (listaAtiva || []).length === 0 ? (
                  <div className="text-slate-600 text-sm">Nenhum item nesta lista.</div>
                ) : (
                  <div className="space-y-2">
                    {(listaAtiva || []).map((a) => (
                      <AcaoCard
                        key={a.id}
                        acao={a}
                        onClick={() => setAcaoSelecionada(a)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal detalhes ação (Central) */}
      {acaoSelecionada && (
        <ModalDetalhesAcao
          acao={acaoSelecionada}
          onClose={() => setAcaoSelecionada(null)}
          onSaved={() => fetchAcoes(selecionada)}
        />
      )}

      {/* Reabrir ADM */}
      {showUnlock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl w-[360px]">
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
   UI small components
========================= */
function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-2 transition-colors ${
        active
          ? "bg-blue-600/10 border-blue-200 text-blue-800"
          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] px-3 py-2 rounded-xl font-extrabold border transition-colors ${
        active
          ? "bg-blue-600/10 border-blue-200 text-blue-800"
          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function AcaoCard({ acao, onClick }) {
  const done =
    String(acao?.status || "").toLowerCase() === "concluída" ||
    String(acao?.status || "").toLowerCase() === "concluida";

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 w-2.5 h-2.5 rounded-full ${
            done ? "bg-emerald-500" : "bg-blue-500"
          }`}
        />
        <div className="flex-1">
          <div
            className={`text-sm font-semibold ${
              done ? "line-through text-slate-400" : "text-slate-900"
            }`}
          >
            {acao?.descricao || "-"}
          </div>

          <div className="text-[12px] text-slate-600 mt-1">
            <span className="font-semibold">Responsável:</span>{" "}
            {acao?.responsavel || "Geral"}
            {acao?.data_conclusao ? (
              <span className="text-slate-500">
                {" "}
                • Conclusão: {toBR(acao.data_conclusao)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

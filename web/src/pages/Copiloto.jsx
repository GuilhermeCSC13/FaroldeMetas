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
  Plus,
  Save,
  X,
} from "lucide-react";
import { useRecording } from "../context/RecordingContext";

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

/**
 * ✅ Só “travado” quando já tem ATA principal (pauta/ata) com conteúdo real
 * ou status real “Realizada”, ou pipeline concluído.
 */
function hasAtaPrincipalReal(r) {
  const iaStatus = norm(r?.ata_ia_status);
  const okByStatus = ["PRONTO", "PRONTA", "OK", "GERADA", "FINALIZADA", "CONCLUIDA"].includes(iaStatus);

  const pauta = String(r?.pauta || "").trim(); // aqui é sua “ATA principal” no banco
  const ata = String(r?.ata || "").trim();

  const hasText = (txt) => txt && txt.replace(/\s+/g, " ").trim().length >= 40;

  return okByStatus || hasText(pauta) || hasText(ata);
}

function getTipoReuniao(r) {
  const t = r?.tipo_reuniao || r?.tipo_reuniao_legacy || r?.tipo || r?.categoria || "Geral";
  return String(t || "Geral").trim() || "Geral";
}

/* =========================
   Card Ação (leve)
========================= */
function AcaoCard({ acao, onToggle }) {
  const done =
    String(acao?.status || "").toLowerCase() === "concluída" ||
    String(acao?.status || "").toLowerCase() === "concluida";

  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={done} onChange={onToggle} className="mt-1 w-4 h-4" />
        <div className="flex-1">
          <div className={`text-sm font-semibold ${done ? "line-through text-slate-400" : "text-slate-900"}`}>
            {acao?.descricao || "-"}
          </div>
          <div className="text-[12px] text-slate-600 mt-1">
            <span className="font-semibold">Responsável:</span> {acao?.responsavel || "Geral"}
            {acao?.tipo_reuniao ? <span className="text-slate-500"> • Tipo: {acao.tipo_reuniao}</span> : null}
          </div>
          {acao?.observacao ? <div className="text-[12px] text-slate-600 mt-2">Obs: {acao.observacao}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Page
========================= */
export default function Copiloto() {
  const { isRecording, isProcessing, timer, startRecording, stopRecording, current } = useRecording();

  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [busca, setBusca] = useState("");
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);

  // Tabs direita: ✅ sem “Execuções” e sem “Ata IA”
  const [tab, setTab] = useState("ata"); // ata | acoes

  // ATA principal (vinda do banco de atas / campo pauta/ata)
  const [isEditingAta, setIsEditingAta] = useState(false);
  const [ataValue, setAtaValue] = useState("");

  // Ações (estrutura “Central de Ações” — listas separadas)
  const [loadingAcoes, setLoadingAcoes] = useState(false);
  const [acoesDaReuniao, setAcoesDaReuniao] = useState([]);
  const [acoesPendentesTipo, setAcoesPendentesTipo] = useState([]);
  const [acaoTab, setAcaoTab] = useState("reuniao"); // reuniao | backlog

  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel: "" });

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
    if (!selecionada?.id) return;

    // ✅ ATA principal: usa pauta/ata (não mostra ata IA separada)
    const principal = String(selecionada.pauta || selecionada.ata || "").trim();
    setAtaValue(principal);
    setIsEditingAta(false);

    // ✅ carrega ações
    fetchAcoes(selecionada);

    // começa na ATA
    setTab("ata");
    setAcaoTab("reuniao");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada?.id]);

  /* =========================
     Fetch Reuniões
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

    if (selecionada?.id) {
      const found = (data || []).find((r) => r.id === selecionada.id);
      if (found) safeSet(() => setSelecionada(found));
    }

    // se está gravando, prende a selecionada na reunião atual
    if (isRecording && current?.reuniaoId) {
      const found = (data || []).find((r) => r.id === current.reuniaoId);
      if (found) safeSet(() => setSelecionada(found));
    }
  };

  /* =========================
     Lock / Badge
     ✅ “Realizada” só por status real OU ATA principal real.
  ========================= */
  const isLocked = useMemo(() => {
    return (r) => {
      if (!r) return false;
      if (hasAtaPrincipalReal(r)) return true;

      const st = norm(r.status);
      const gs = norm(r.gravacao_status);

      if (st === "REALIZADA") return true;

      const doneOrPipeline = new Set([
        "PRONTO_PROCESSAR",
        "PROCESSANDO",
        "PROCESSANDO_DRIVE",
        "ENVIADO_DRIVE",
        "PRONTO",
        "CONCLUIDO",
      ]);
      if (doneOrPipeline.has(gs)) return true;

      return false;
    };
  }, []);

  const badgeLabel = (r) => {
    if (!r) return "PENDENTE";
    const st = norm(r.status);

    if (st === "REALIZADA") return "REALIZADA";
    if (st === "AGENDADA") return "AGENDADA";
    if (st === "PENDENTE") return "PENDENTE";
    if (st === "EM ANDAMENTO") return "EM ANDAMENTO";

    if (hasAtaPrincipalReal(r)) return "REALIZADA";

    const gs = norm(r.gravacao_status);
    if (gs) return gs;

    return "PENDENTE";
  };

  const badgeClass = (lbl) => {
    const v = norm(lbl);
    if (v === "REALIZADA") return "bg-emerald-600/15 text-emerald-700 border border-emerald-200";
    if (v === "EM ANDAMENTO") return "bg-blue-600/15 text-blue-700 border border-blue-200";
    if (v === "AGENDADA") return "bg-slate-600/10 text-slate-700 border border-slate-200";
    if (v === "PENDENTE") return "bg-slate-600/10 text-slate-700 border border-slate-200";
    if (v.includes("PROCESS") || v.includes("PRONTO")) return "bg-blue-600/15 text-blue-700 border border-blue-200";
    if (v === "ERRO") return "bg-red-600/15 text-red-700 border border-red-200";
    return "bg-slate-600/10 text-slate-700 border border-slate-200";
  };

  /* =========================
     Recording
  ========================= */
  const onStart = async () => {
    if (!selecionada?.id) return alert("Selecione uma reunião.");
    if (isRecording) return;

    if (isLocked(selecionada)) {
      return alert("Reunião bloqueada (já possui ata/pipeline).");
    }

    try {
      await startRecording({
        reuniaoId: selecionada.id,
        reuniaoTitulo: selecionada.titulo,
      });
      await fetchReunioes();
      setTab("ata");
    } catch (e) {
      console.error("startRecording:", e);
      alert("Erro ao iniciar. Verifique permissões de tela e áudio.");
    }
  };

  const onStop = async () => {
    try {
      await stopRecording();
      await fetchReunioes();
      if (selecionada?.id) await fetchAcoes(selecionada);
    } catch (e) {
      console.error("stopRecording:", e);
      alert("Erro ao encerrar a gravação.");
    }
  };

  /* =========================
     ATA principal (salva em pauta)
  ========================= */
  const salvarAtaPrincipal = async () => {
    if (!selecionada?.id) return;

    const { error } = await supabase
      .from("reunioes")
      .update({ pauta: ataValue, updated_at: nowIso() })
      .eq("id", selecionada.id);

    if (error) {
      alert("Erro ao salvar Ata: " + (error.message || error));
      return;
    }
    setIsEditingAta(false);
    await fetchReunioes();
  };

  /* =========================
     Ações (estrutura “Central”)
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
      safeSet(() => setAcoesDaReuniao(daReuniao || []));

      // 2) Backlog do tipo (pendentes)
      const tipo = getTipoReuniao(r);

      const { data: pendTipo, error: e2 } = await supabase
        .from("acoes")
        .select("*")
        .eq("status", "Aberta")
        .eq("tipo_reuniao", tipo)
        .order("created_at", { ascending: false })
        .limit(200);

      if (e2) throw e2;

      const filtradas = (pendTipo || []).filter((a) => !a.reuniao_id || a.reuniao_id !== r.id);
      safeSet(() => setAcoesPendentesTipo(filtradas));
    } catch (e) {
      console.error("fetchAcoes:", e);
      safeSet(() => {
        setAcoesDaReuniao([]);
        setAcoesPendentesTipo([]);
      });
    } finally {
      safeSet(() => setLoadingAcoes(false));
    }
  };

  const salvarAcao = async () => {
    if (!selecionada?.id) return;
    if (!novaAcao.descricao?.trim()) return;

    const tipo = getTipoReuniao(selecionada);

    const payload = {
      descricao: novaAcao.descricao.trim(),
      responsavel: (novaAcao.responsavel || "Geral").trim(),
      status: "Aberta",
      reuniao_id: selecionada.id,
      tipo_reuniao: tipo,
      data_criacao: nowIso(),
      created_at: nowIso(),
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

    // ✅ após criar: vai pra “Da reunião” (como você pediu)
    setTab("acoes");
    setAcaoTab("reuniao");
  };

  const toggleStatusAcao = async (acao) => {
    const novoStatus = acao.status === "Aberta" ? "Concluída" : "Aberta";

    const patch = (list) => (list || []).map((a) => (a.id === acao.id ? { ...a, status: novoStatus } : a));
    safeSet(() => {
      setAcoesDaReuniao(patch(acoesDaReuniao));
      setAcoesPendentesTipo(patch(acoesPendentesTipo));
    });

    const { error } = await supabase.from("acoes").update({ status: novoStatus }).eq("id", acao.id);
    if (error) {
      alert("Erro ao atualizar status: " + (error.message || error));
      fetchAcoes(selecionada);
    }
  };

  /* =========================
     UI computed
  ========================= */
  const reunioesFiltradas = useMemo(() => {
    const q = (busca || "").toLowerCase();
    return (reunioes || []).filter((r) => (r.titulo || "").toLowerCase().includes(q));
  }, [reunioes, busca]);

  const tipoSelecionado = selecionada ? getTipoReuniao(selecionada) : "—";

  return (
    <Layout>
      {/* ✅ Tema claro / tira “tela escura” */}
      <div className="h-screen bg-[#f6f8fc] text-slate-900 flex overflow-hidden">
        {/* COLUNA ESQUERDA */}
        <div className="w-[420px] min-w-[380px] max-w-[460px] flex flex-col p-5 border-r border-slate-200 bg-white">
          {/* ✅ nome melhor + logo melhor */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Bot size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-extrabold">Assistente</div>
              <h1 className="text-lg font-black tracking-tight truncate">Copiloto de Reuniões</h1>
            </div>
          </div>

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

          <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-y-auto">
            {reunioesFiltradas.map((r) => {
              const lbl = badgeLabel(r);
              const locked = isLocked(r);
              const tipo = getTipoReuniao(r);

              return (
                <button
                  key={r.id}
                  onClick={() => !isRecording && setSelecionada(r)}
                  className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    selecionada?.id === r.id ? "bg-blue-50 border-l-4 border-l-blue-600" : "border-l-4 border-l-transparent"
                  } ${isRecording ? "opacity-80 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-xs truncate">{r.titulo || "Sem título"}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-extrabold uppercase">
                          {tipo}
                        </span>
                        {locked && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-extrabold uppercase flex items-center gap-1">
                            <Lock size={12} /> BLOQUEADO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {toBR(r.data_hora)}
                        {typeof r.duracao_segundos === "number" && r.duracao_segundos > 0 ? (
                          <span className="text-slate-400"> • {secondsToMMSS(r.duracao_segundos)}</span>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-1 rounded-lg font-extrabold uppercase whitespace-nowrap ${badgeClass(lbl)}`}
                      title={r.gravacao_erro || ""}
                    >
                      {lbl}
                    </span>
                  </div>
                </button>
              );
            })}

            {reunioesFiltradas.length === 0 && (
              <div className="p-6 text-xs text-slate-500">Nenhuma reunião nesta data.</div>
            )}
          </div>

          {/* CONTROLES */}
          <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase">Tempo de sessão</div>
              <div className="text-lg font-black font-mono leading-none">{secondsToMMSS(timer)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {isRecording && current?.reuniaoTitulo ? `Gravando: ${current.reuniaoTitulo}` : "Pronto para gravar"}
              </div>
            </div>

            {isProcessing ? (
              <div className="text-blue-700 font-extrabold text-xs animate-pulse">FINALIZANDO...</div>
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
        <div className="flex-1 p-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 font-extrabold uppercase">Reunião selecionada</div>
                <div className="text-base font-black truncate">{selecionada?.titulo || "—"}</div>
                <div className="text-xs text-slate-600 mt-1">
                  Tipo: <span className="text-slate-900 font-bold">{tipoSelecionado}</span> • Execução:{" "}
                  <span className="text-slate-900 font-bold">
                    {selecionada?.data_hora ? toBR(selecionada.data_hora) : "—"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <TabButton active={tab === "ata"} onClick={() => setTab("ata")} icon={<FileText size={16} />}>
                  Ata Principal
                </TabButton>
                <TabButton active={tab === "acoes"} onClick={() => setTab("acoes")} icon={<ClipboardList size={16} />}>
                  Ações
                </TabButton>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {!selecionada ? (
              <div className="text-slate-600 text-sm">Selecione uma reunião.</div>
            ) : tab === "ata" ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <FileText size={16} className="text-blue-700" />
                    Ata Principal
                  </div>

                  <div className="flex gap-2">
                    {isEditingAta ? (
                      <>
                        <button
                          onClick={() => {
                            setAtaValue(String(selecionada.pauta || selecionada.ata || "").trim());
                            setIsEditingAta(false);
                          }}
                          className="text-[12px] font-extrabold bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <X size={14} /> Cancelar
                        </button>
                        <button
                          onClick={salvarAtaPrincipal}
                          className="text-[12px] font-extrabold bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <Save size={14} /> Salvar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditingAta(true)}
                        className="text-[12px] font-extrabold bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center gap-2"
                      >
                        <Save size={14} /> Editar
                      </button>
                    )}
                  </div>
                </div>

                {isEditingAta ? (
                  <textarea
                    className="w-full min-h-[420px] bg-white border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-blue-500/25"
                    value={ataValue}
                    onChange={(e) => setAtaValue(e.target.value)}
                    placeholder="Ata principal da reunião..."
                  />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-900 whitespace-pre-wrap leading-relaxed min-h-[420px]">
                    {String(ataValue || "").trim() ? ataValue : "Sem ata principal ainda."}
                  </div>
                )}
              </div>
            ) : (
              // tab === "acoes"
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <ClipboardList size={16} className="text-blue-700" />
                      Central de Ações (contexto da reunião)
                    </div>
                    <div className="text-[12px] text-slate-600 mt-1">
                      Ações da reunião + backlog pendente do tipo <b>{tipoSelecionado}</b>.
                    </div>
                  </div>

                  <button
                    onClick={() => fetchAcoes(selecionada)}
                    className="text-[12px] font-extrabold bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl"
                    disabled={loadingAcoes}
                  >
                    {loadingAcoes ? "Atualizando..." : "Atualizar"}
                  </button>
                </div>

                {/* ✅ Criar ação: mesma “estrutura” (não aparece ata/execução) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
                  <div className="text-[11px] font-extrabold text-slate-600 uppercase mb-2">Criar nova ação</div>

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

                  <div className="text-[12px] text-slate-600 mt-2">
                    Tipo aplicado automaticamente: <b className="text-slate-900">{tipoSelecionado}</b>
                  </div>
                </div>

                {/* “estrutura Central” => duas listas claras */}
                <div className="flex gap-2 mb-3">
                  <Pill active={acaoTab === "reuniao"} onClick={() => setAcaoTab("reuniao")}>
                    Ações da reunião
                  </Pill>
                  <Pill active={acaoTab === "backlog"} onClick={() => setAcaoTab("backlog")}>
                    Backlog pendente do tipo
                  </Pill>
                </div>

                {loadingAcoes ? (
                  <div className="text-slate-600 text-sm">Carregando ações...</div>
                ) : acaoTab === "reuniao" ? (
                  (acoesDaReuniao || []).length === 0 ? (
                    <div className="text-slate-600 text-sm">Nenhuma ação cadastrada nesta reunião.</div>
                  ) : (
                    <div className="space-y-2">
                      {(acoesDaReuniao || []).map((a) => (
                        <AcaoCard key={a.id} acao={a} onToggle={() => toggleStatusAcao(a)} />
                      ))}
                    </div>
                  )
                ) : (acoesPendentesTipo || []).length === 0 ? (
                  <div className="text-slate-600 text-sm">Nenhuma ação pendente para este tipo.</div>
                ) : (
                  <div className="space-y-2">
                    {(acoesPendentesTipo || []).map((a) => (
                      <AcaoCard key={a.id} acao={a} onToggle={() => toggleStatusAcao(a)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

/* =========================
   Small UI
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

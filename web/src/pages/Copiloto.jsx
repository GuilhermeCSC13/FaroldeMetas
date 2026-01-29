// src/pages/Copiloto.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import {
  Loader2,
  Cpu,
  CheckCircle,
  Monitor,
  Plus,
  Lock,
  History,
  FileText,
  Bot,
  ClipboardList,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRecording } from "../context/RecordingContext";

function secondsToMMSS(s) {
  const mm = Math.floor((Number(s || 0) || 0) / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor((Number(s || 0) || 0) % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

function norm(s) {
  return String(s || "").trim().toUpperCase();
}

// ATA “existe” (IA antiga) — seu schema atual tem reunioes.ata (texto) e drive_url etc
function hasAtaOrDrive(r) {
  if (!r) return false;
  const hasAtaText = String(r.ata || "").trim().length > 0;
  const hasDrive = !!(r.drive_url || r.drive_link || r.drive_file_id);
  const iaOk =
    ["OK", "PRONTO", "FINALIZADA", "FINALIZADO", "GERADA", "CONCLUIDA", "CONCLUÍDA"].includes(
      norm(r.ata_ia_status)
    ) && hasAtaText;
  return hasAtaText || hasDrive || iaOk;
}

function toLocalShort(isoOrTs) {
  try {
    if (!isoOrTs) return "-";
    const d = new Date(isoOrTs);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}

export default function Copiloto() {
  const { isRecording, isProcessing, timer, startRecording, stopRecording, current } =
    useRecording();

  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [busca, setBusca] = useState("");

  // EXECUÇÕES
  const [execucoes, setExecucoes] = useState([]);
  const [execSelectedId, setExecSelectedId] = useState(null);
  const [loadingExec, setLoadingExec] = useState(false);

  // ATAS POR EXECUÇÃO
  const [ataIA, setAtaIA] = useState(null); // row reunioes_atas tipo IA
  const [ataManual, setAtaManual] = useState(null); // row reunioes_atas tipo MANUAL
  const [manualDraft, setManualDraft] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  // AÇÕES
  const [tabAcoes, setTabAcoes] = useState("reuniao"); // reuniao | pendentes_tipo
  const [acoesReuniao, setAcoesReuniao] = useState([]);
  const [acoesTipo, setAcoesTipo] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel: "" });
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  // UI TABS DIREITA
  const [tabRight, setTabRight] = useState("execucoes"); // execucoes | ata_ia | ata_manual | acoes

  // ADMIN
  const [showUnlock, setShowUnlock] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockedIds, setUnlockedIds] = useState(() => new Set());

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
    if (selecionada?.id) {
      // reset seleção de exec
      setExecSelectedId(null);
      setTabRight("execucoes");
      fetchExecucoes(selecionada.id);
      fetchAcoesAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada?.id]);

  useEffect(() => {
    if (!selecionada?.id) return;
    const execId = execSelectedId || selecionada.current_execucao_id || null;
    if (!execId) {
      safeSet(() => {
        setAtaIA(null);
        setAtaManual(null);
        setManualDraft("");
      });
      return;
    }
    fetchAtas(selecionada.id, execId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execSelectedId, selecionada?.current_execucao_id]);

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

  const fetchExecucoes = async (reuniaoId) => {
    setLoadingExec(true);
    try {
      const { data, error } = await supabase
        .from("reunioes_execucoes")
        .select("*")
        .eq("reuniao_id", reuniaoId)
        .order("exec_num", { ascending: false });

      if (error) throw error;

      safeSet(() => setExecucoes(data || []));

      // se não escolheu uma execução ainda, tenta pegar a current
      const currentExec = selecionada?.current_execucao_id || null;
      if (currentExec && !execSelectedId) {
        safeSet(() => setExecSelectedId(currentExec));
      }
    } catch (e) {
      console.error("fetchExecucoes:", e);
      safeSet(() => setExecucoes([]));
    } finally {
      setLoadingExec(false);
    }
  };

  const fetchAtas = async (reuniaoId, execId) => {
    try {
      const { data, error } = await supabase
        .from("reunioes_atas")
        .select("*")
        .eq("reuniao_id", reuniaoId)
        .eq("execucao_id", execId)
        .in("tipo", ["IA", "MANUAL"]);

      if (error) throw error;

      const ia = (data || []).find((x) => String(x.tipo).toUpperCase() === "IA") || null;
      const man =
        (data || []).find((x) => String(x.tipo).toUpperCase() === "MANUAL") || null;

      safeSet(() => {
        setAtaIA(ia);
        setAtaManual(man);
        setManualDraft(String(man?.conteudo || ""));
      });
    } catch (e) {
      console.error("fetchAtas:", e);
      safeSet(() => {
        setAtaIA(null);
        setAtaManual(null);
        setManualDraft("");
      });
    }
  };

  const fetchAcoesAll = async () => {
    if (!selecionada?.id) return;

    setLoadingAcoes(true);
    try {
      // 1) ações desta reunião
      const q1 = await supabase
        .from("acoes")
        .select("*")
        .eq("reuniao_id", selecionada.id)
        .order("created_at", { ascending: false });

      if (q1.error) throw q1.error;

      // 2) backlog pendente do mesmo tipo (view)
      const tipo = String(selecionada.tipo_reuniao || "").trim();
      let pend = { data: [] };

      if (tipo) {
        const q2 = await supabase
          .from("v_acoes_pendentes_por_tipo")
          .select("*")
          .eq("tipo_reuniao", tipo)
          .order("created_at", { ascending: false });

        if (q2.error) throw q2.error;
        pend = q2;
      }

      safeSet(() => {
        setAcoesReuniao(q1.data || []);
        setAcoesTipo(pend.data || []);
      });
    } catch (e) {
      console.error("fetchAcoesAll:", e);
      safeSet(() => {
        setAcoesReuniao([]);
        setAcoesTipo([]);
      });
    } finally {
      setLoadingAcoes(false);
    }
  };

  const salvarAcao = async () => {
    if (!selecionada?.id) return;
    if (!novaAcao.descricao?.trim()) return;

    const payload = {
      descricao: novaAcao.descricao,
      responsavel: novaAcao.responsavel || null,
      status: "Aberta",
      reuniao_id: selecionada.id,
      reuniao_origem_id: selecionada.id,
      tipo_reuniao: selecionada.tipo_reuniao || null,
      data_abertura: new Date().toISOString().split("T")[0],
    };

    const { data, error } = await supabase.from("acoes").insert([payload]).select();

    if (error) {
      console.error("salvarAcao:", error);
      alert("Erro ao salvar ação.");
      return;
    }

    safeSet(() => {
      setAcoesReuniao([data?.[0], ...(acoesReuniao || [])].filter(Boolean));
      setNovaAcao({ descricao: "", responsavel: "" });
    });

    // atualiza backlog do tipo também
    fetchAcoesAll();
  };

  const saveAtaManual = async (status = "EM_EDICAO") => {
    if (!selecionada?.id) return;
    const execId = execSelectedId || selecionada.current_execucao_id;
    if (!execId) return alert("Sem execução selecionada.");

    setSavingManual(true);
    try {
      const base = {
        reuniao_id: selecionada.id,
        execucao_id: execId,
        tipo: "MANUAL",
        status,
        conteudo: manualDraft || "",
        autor_login: getLoginSalvo() || null,
        autor_nome: getLoginSalvo() || null,
      };

      if (ataManual?.id) {
        const { error } = await supabase.from("reunioes_atas").update(base).eq("id", ataManual.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("reunioes_atas").insert([base]).select();
        if (error) throw error;
        safeSet(() => setAtaManual(data?.[0] || null));
      }

      // refetch
      await fetchAtas(selecionada.id, execId);
    } catch (e) {
      console.error("saveAtaManual:", e);
      alert("Erro ao salvar ata manual.");
    } finally {
      setSavingManual(false);
    }
  };

  // ======== LOCK / UNLOCK ========

  const isLocked = useMemo(() => {
    return (r) => {
      if (!r) return false;
      if (unlockedIds.has(r.id)) return false; // admin liberou nesta sessão

      const st = norm(r.status);
      const gs = norm(r.gravacao_status);

      // se já tem ATA/Drive no registro principal, bloqueia por padrão
      if (hasAtaOrDrive(r)) return true;

      // “Realizada” bloqueia
      if (st === "REALIZADA") return true;

      // pipeline indica que já foi gravado/encaminhado
      const doneOrPipeline = new Set([
        "PRONTO_PROCESSAR",
        "PROCESSANDO",
        "PROCESSANDO_DRIVE",
        "ENVIADO_DRIVE",
        "PRONTO",
      ]);
      if (doneOrPipeline.has(gs)) return true;

      return false;
    };
  }, [unlockedIds]);

  // badge “inteligente”
  const badgeLabel = (r) => {
    if (!r) return "PENDENTE";
    if (hasAtaOrDrive(r)) return "REALIZADA";

    const gs = norm(r.gravacao_status);
    const st = norm(r.status);
    if (gs) return gs;
    if (st) return st;
    return "PENDENTE";
  };

  const badgeStyle = (label) => {
    const v = norm(label);
    if (v === "GRAVANDO") return "bg-red-600/30 text-red-200 border border-red-500/30";
    if (v === "ERRO") return "bg-red-900/40 text-red-200 border border-red-500/30";
    if (v === "REALIZADA") return "bg-green-600/20 text-green-200 border border-green-500/30";
    if (v.includes("PROCESS")) return "bg-blue-600/20 text-blue-200 border border-blue-500/30";
    if (v.includes("PRONTO")) return "bg-emerald-600/20 text-emerald-200 border border-emerald-500/30";
    return "bg-slate-700 text-slate-100 border border-slate-600";
  };

  function getLoginSalvo() {
    return (
      localStorage.getItem("inove_login") ||
      sessionStorage.getItem("inove_login") ||
      localStorage.getItem("login") ||
      sessionStorage.getItem("login") ||
      ""
    );
  }

  async function validarAdmin(senhaDigitada) {
    const login = getLoginSalvo();
    if (!login) return false;

    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("id, nivel, ativo, login")
      .eq("login", login)
      .eq("senha", senhaDigitada)
      .eq("ativo", true)
      .maybeSingle();

    if (error) return false;
    return String(data?.nivel || "").toLowerCase() === "administrador";
  }

  // ======== START / STOP ========

  const criarExecucaoAntesDeGravar = async (reuniaoId) => {
    const login = getLoginSalvo() || null;

    // RPC do histórico
    const { data, error } = await supabase.rpc("criar_execucao_reuniao", {
      p_reuniao_id: reuniaoId,
      p_criado_por_login: login,
      p_criado_por_nome: login,
    });

    if (error) throw error;

    // RPC retorna UUID da execução
    return data;
  };

  const onStart = async () => {
    if (!selecionada?.id) return alert("Selecione uma reunião.");
    if (isRecording) return;

    if (isLocked(selecionada)) {
      setShowUnlock(true);
      return;
    }

    try {
      // ✅ cria execução SEM apagar histórico
      await criarExecucaoAntesDeGravar(selecionada.id);

      await startRecording({
        reuniaoId: selecionada.id,
        reuniaoTitulo: selecionada.titulo,
      });

      await fetchReunioes();
      await fetchExecucoes(selecionada.id);
      setTabRight("execucoes");
    } catch (e) {
      console.error("startRecording (Copiloto):", e);
      alert("Erro ao iniciar. Verifique permissões de tela e áudio.");
    }
  };

  const onStop = async () => {
    try {
      await stopRecording();
      await fetchReunioes();
      if (selecionada?.id) await fetchExecucoes(selecionada.id);
    } catch (e) {
      console.error("stopRecording (Copiloto):", e);
      alert("Erro ao encerrar a gravação.");
    }
  };

  const onConfirmUnlock = async () => {
    if (!selecionada?.id) return;
    if (!senhaAdmin) return;

    setUnlocking(true);
    try {
      const ok = await validarAdmin(senhaAdmin);
      if (!ok) {
        alert("Senha inválida ou usuário não é Administrador.");
        return;
      }

      // ✅ Só libera na UI (não apaga nada). O histórico fica intacto.
      setUnlockedIds((prev) => {
        const next = new Set(prev);
        next.add(selecionada.id);
        return next;
      });

      setShowUnlock(false);
      setSenhaAdmin("");

      // opcional: já iniciar imediatamente
      await onStart();
    } catch (e) {
      console.error("unlock error:", e);
      alert("Erro ao liberar regravação.");
    } finally {
      setUnlocking(false);
    }
  };

  const reunioesFiltradas = (reunioes || []).filter((r) =>
    (r.titulo || "").toLowerCase().includes((busca || "").toLowerCase())
  );

  // ======= UI helpers =======
  const execIdAtual = execSelectedId || selecionada?.current_execucao_id || null;

  const rightTabBtn = (id, icon, label) => {
    const active = tabRight === id;
    return (
      <button
        onClick={() => setTabRight(id)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black border transition-all ${
          active
            ? "bg-blue-600/20 border-blue-500/40 text-blue-200"
            : "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <Layout>
      <div className="h-screen bg-[#0f172a] text-white flex overflow-hidden">
        {/* ===================== LEFT ===================== */}
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
            {reunioesFiltradas.map((r) => {
              const lbl = badgeLabel(r);
              const locked = isLocked(r);

              return (
                <div
                  key={r.id}
                  onClick={() => !isRecording && setSelecionada(r)}
                  className={`p-4 border-b border-slate-800 cursor-pointer ${
                    selecionada?.id === r.id
                      ? "bg-blue-600/10 border-l-4 border-l-blue-500"
                      : "hover:bg-slate-800"
                  } ${isRecording ? "opacity-80" : ""}`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-sm truncate">{r.titulo}</span>

                      {r.tipo_reuniao ? (
                        <span className="text-[10px] px-2 py-1 rounded font-black uppercase bg-slate-800 border border-slate-700 text-slate-200">
                          {r.tipo_reuniao}
                        </span>
                      ) : null}

                      {locked && (
                        <span className="text-[10px] px-2 py-1 rounded font-black uppercase bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1">
                          <Lock size={12} /> BLOQUEADO
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] px-2 py-1 rounded font-black uppercase whitespace-nowrap ${badgeStyle(
                        lbl
                      )}`}
                      title={r.gravacao_erro || ""}
                    >
                      {lbl}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                    <span>{toLocalShort(r.data_hora)}</span>
                    <span className="font-mono">
                      {r.duracao_segundos ? secondsToMMSS(r.duracao_segundos) : "--:--"}
                    </span>
                  </div>
                </div>
              );
            })}
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
              </div>
            </div>

            {isProcessing ? (
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

        {/* ===================== RIGHT ===================== */}
        <div className="w-5/12 p-6 flex flex-col bg-slate-900/80">
          {/* Header + Tabs */}
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Reunião Selecionada</p>
              <p className="text-sm font-black text-slate-100 truncate">
                {selecionada?.titulo || "—"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {selecionada?.tipo_reuniao ? `Tipo: ${selecionada.tipo_reuniao}` : "Tipo: —"}
                {" • "}
                Execução:{" "}
                {execucoes?.find((e) => e.id === execIdAtual)?.exec_num
                  ? `#${execucoes.find((e) => e.id === execIdAtual).exec_num}`
                  : "—"}
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-5 flex-wrap">
            {rightTabBtn("execucoes", <History size={16} />, "Execuções")}
            {rightTabBtn("ata_ia", <Bot size={16} />, "Ata IA")}
            {rightTabBtn("ata_manual", <FileText size={16} />, "Ata Manual")}
            {rightTabBtn("acoes", <ClipboardList size={16} />, "Ações")}
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* ===== EXECUÇÕES ===== */}
            {tabRight === "execucoes" && (
              <div className="space-y-3">
                <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
                  <p className="text-xs font-black text-slate-200 mb-1 flex items-center gap-2">
                    <History size={14} /> Histórico de Execuções
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Cada gravação gera uma execução. Nada é apagado.
                  </p>
                </div>

                {loadingExec ? (
                  <div className="text-slate-400 text-sm flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Carregando execuções...
                  </div>
                ) : execucoes.length === 0 ? (
                  <div className="text-slate-400 text-sm">
                    {selecionada ? "Nenhuma execução registrada ainda." : "Selecione uma reunião."}
                  </div>
                ) : (
                  execucoes.map((ex) => {
                    const active = (execSelectedId || selecionada?.current_execucao_id) === ex.id;
                    const lbl = norm(ex.gravacao_status || "") || "—";
                    return (
                      <button
                        key={ex.id}
                        onClick={() => setExecSelectedId(ex.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          active
                            ? "bg-blue-600/10 border-blue-500/40"
                            : "bg-slate-800/40 border-slate-800 hover:bg-slate-800/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-200">
                              Execução #{ex.exec_num}
                            </span>
                            <span className={`text-[10px] px-2 py-1 rounded font-black uppercase ${badgeStyle(lbl)}`}>
                              {lbl}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {ex.duracao_segundos ? secondsToMMSS(ex.duracao_segundos) : "--:--"}
                          </span>
                        </div>

                        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                          <span>Início: {toLocalShort(ex.iniciado_em || ex.criado_em)}</span>
                          <span>Fim: {toLocalShort(ex.finalizado_em || ex.gravacao_fim)}</span>
                        </div>

                        {(ex.drive_url || ex.drive_link) && (
                          <div className="mt-2 text-[11px] text-emerald-200">
                            Drive: {String(ex.drive_url || ex.drive_link)}
                          </div>
                        )}

                        {ex.gravacao_erro && (
                          <div className="mt-2 text-[11px] text-red-200">
                            Erro: {String(ex.gravacao_erro).slice(0, 180)}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* ===== ATA IA ===== */}
            {tabRight === "ata_ia" && (
              <div className="space-y-3">
                <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
                  <p className="text-xs font-black text-slate-200 mb-1 flex items-center gap-2">
                    <Bot size={14} /> Ata IA (por execução)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Mostra o resultado associado à execução selecionada.
                  </p>
                </div>

                {!execIdAtual ? (
                  <div className="text-slate-400 text-sm">Selecione uma execução.</div>
                ) : (
                  <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Status:{" "}
                        <b className="text-slate-200">{ataIA?.status || "PENDENTE"}</b>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Atualizado: {toLocalShort(ataIA?.atualizado_em)}
                      </span>
                    </div>

                    {/* fallback: se não tiver em reunioes_atas, mostra reunioes.ata (legado) */}
                    <div className="mt-3 whitespace-pre-wrap text-sm text-slate-100">
                      {String(ataIA?.conteudo || selecionada?.ata || "")
                        .trim() || (
                        <span className="text-slate-400">
                          Ainda não há conteúdo de ata IA para esta execução.
                        </span>
                      )}
                    </div>

                    {selecionada?.ata_ia_erro && (
                      <div className="mt-3 text-[11px] text-red-200">
                        Erro IA (legado): {String(selecionada.ata_ia_erro).slice(0, 300)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===== ATA MANUAL ===== */}
            {tabRight === "ata_manual" && (
              <div className="space-y-3">
                <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
                  <p className="text-xs font-black text-slate-200 mb-1 flex items-center gap-2">
                    <FileText size={14} /> Ata Manual (Responsável)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Editável e vinculada à execução selecionada.
                  </p>
                </div>

                {!execIdAtual ? (
                  <div className="text-slate-400 text-sm">Selecione uma execução.</div>
                ) : (
                  <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] text-slate-400">
                        Status:{" "}
                        <b className="text-slate-200">{ataManual?.status || "PENDENTE"}</b>
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => saveAtaManual("EM_EDICAO")}
                          disabled={savingManual}
                          className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-black hover:bg-slate-700 disabled:opacity-40 flex items-center gap-2"
                        >
                          {savingManual ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                          Salvar
                        </button>

                        <button
                          onClick={() => saveAtaManual("FINALIZADA")}
                          disabled={savingManual}
                          className="px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-200 text-xs font-black hover:bg-emerald-600/30 disabled:opacity-40 flex items-center gap-2"
                        >
                          <CheckCircle size={14} />
                          Finalizar
                        </button>
                      </div>
                    </div>

                    <textarea
                      className="w-full bg-slate-900/60 border border-slate-700 rounded-2xl p-4 text-sm h-64 outline-none focus:ring-2 ring-blue-500"
                      placeholder="Escreva aqui a ata manual do responsável..."
                      value={manualDraft}
                      onChange={(e) => setManualDraft(e.target.value)}
                    />

                    <div className="mt-3 text-[11px] text-slate-400">
                      Dica: use “Salvar” para rascunho e “Finalizar” para travar como versão oficial.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== AÇÕES ===== */}
            {tabRight === "acoes" && (
              <div className="space-y-3">
                <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
                  <p className="text-xs font-black text-slate-200 mb-1 flex items-center gap-2">
                    <ClipboardList size={14} /> Ações
                  </p>
                  <p className="text-[11px] text-slate-400">
                    “Da reunião” + backlog pendente do tipo de reunião.
                  </p>
                </div>

                {/* NOVA AÇÃO */}
                <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
                  <p className="text-[11px] font-black text-slate-200 mb-2">Nova ação</p>

                  <textarea
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-2xl p-3 text-sm h-24 mb-2 outline-none focus:ring-2 ring-blue-500"
                    placeholder="O que precisa ser feito?"
                    value={novaAcao.descricao}
                    onChange={(e) => setNovaAcao({ ...novaAcao, descricao: e.target.value })}
                  />

                  <div className="flex gap-2">
                    <input
                      className="bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2 text-xs flex-1 outline-none focus:ring-2 ring-blue-500"
                      placeholder="Responsável"
                      value={novaAcao.responsavel}
                      onChange={(e) => setNovaAcao({ ...novaAcao, responsavel: e.target.value })}
                    />

                    <button
                      onClick={salvarAcao}
                      disabled={!selecionada || !novaAcao.descricao?.trim()}
                      className="bg-blue-600 px-3 py-2 rounded-xl hover:bg-blue-500 disabled:opacity-30 text-xs font-black flex items-center gap-2"
                    >
                      <Plus size={16} /> Criar
                    </button>
                  </div>

                  {selecionada?.tipo_reuniao && (
                    <p className="mt-2 text-[11px] text-slate-400">
                      Tipo aplicado automaticamente: <b>{selecionada.tipo_reuniao}</b>
                    </p>
                  )}
                </div>

                {/* SUBTABS */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setTabAcoes("reuniao")}
                    className={`px-3 py-2 rounded-xl text-xs font-black border ${
                      tabAcoes === "reuniao"
                        ? "bg-blue-600/20 border-blue-500/40 text-blue-200"
                        : "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    Da reunião
                  </button>
                  <button
                    onClick={() => setTabAcoes("pendentes_tipo")}
                    className={`px-3 py-2 rounded-xl text-xs font-black border ${
                      tabAcoes === "pendentes_tipo"
                        ? "bg-blue-600/20 border-blue-500/40 text-blue-200"
                        : "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    Pendentes do tipo
                  </button>
                </div>

                {/* LISTA */}
                {loadingAcoes ? (
                  <div className="text-slate-400 text-sm flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Carregando ações...
                  </div>
                ) : tabAcoes === "reuniao" ? (
                  (acoesReuniao || []).length === 0 ? (
                    <div className="text-slate-400 text-sm">
                      {selecionada ? "Nenhuma ação nesta reunião ainda." : "Selecione uma reunião."}
                    </div>
                  ) : (
                    (acoesReuniao || []).map((a) => (
                      <div
                        key={a.id}
                        className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl text-xs"
                      >
                        <p className="text-slate-200 font-semibold">{a.descricao}</p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            Resp.: <b className="text-blue-300">{a.responsavel || "—"}</b>
                          </span>
                          <span className="uppercase font-black">{a.status || "—"}</span>
                        </div>
                        {a.data_vencimento && (
                          <div className="mt-2 text-[11px] text-slate-400">
                            Venc.: {String(a.data_vencimento)}
                          </div>
                        )}
                      </div>
                    ))
                  )
                ) : (acoesTipo || []).length === 0 ? (
                  <div className="text-slate-400 text-sm">
                    {selecionada?.tipo_reuniao
                      ? "Nenhuma ação pendente para este tipo."
                      : "Esta reunião não tem tipo definido."}
                  </div>
                ) : (
                  (acoesTipo || []).map((a) => (
                    <div
                      key={a.id}
                      className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl text-xs"
                    >
                      <p className="text-slate-200 font-semibold">{a.descricao}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          Resp.: <b className="text-blue-300">{a.responsavel || "—"}</b>
                        </span>
                        <span className="uppercase font-black">{a.status || "—"}</span>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-400">
                        Origem:{" "}
                        <b className="text-slate-200">{a.reuniao_origem_titulo || "—"}</b>{" "}
                        <span className="text-slate-500">({toLocalShort(a.reuniao_origem_data)})</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ===================== MODAL ADMIN ===================== */}
        {showUnlock && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="w-[460px] bg-slate-900 border border-slate-700 rounded-2xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <ShieldCheck size={18} />
                    Liberação de nova execução
                  </h3>
                  <p className="text-xs text-slate-400 mt-2">
                    Esta reunião já tem gravação/ata/pipeline. Para iniciar novamente, confirme a{" "}
                    <b>senha do Administrador</b>. O histórico será preservado.
                  </p>
                </div>
                <button
                  className="p-2 rounded-xl hover:bg-slate-800"
                  onClick={() => {
                    setShowUnlock(false);
                    setSenhaAdmin("");
                  }}
                  disabled={unlocking}
                >
                  <X size={18} />
                </button>
              </div>

              <input
                type="password"
                className="w-full mt-4 bg-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-blue-500"
                placeholder="Senha do Administrador"
                value={senhaAdmin}
                onChange={(e) => setSenhaAdmin(e.target.value)}
              />

              <div className="flex gap-2 mt-5 justify-end">
                <button
                  onClick={() => {
                    setShowUnlock(false);
                    setSenhaAdmin("");
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
                  disabled={unlocking}
                >
                  Cancelar
                </button>

                <button
                  onClick={onConfirmUnlock}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-500 disabled:opacity-40"
                  disabled={unlocking || !senhaAdmin}
                >
                  {unlocking ? "Liberando..." : "Liberar e iniciar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

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
  Calendar,
  Search,
  FileText,
  ClipboardList,
  BookOpen,
  Edit3,
  Save,
  X,
  User,
  Clock,
  Image as ImageIcon,
  Camera,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { useRecording } from "../context/RecordingContext";

function secondsToMMSS(s) {
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function norm(s) {
  return String(s || "").trim().toUpperCase();
}

// tenta inferir “ATA pronta” sem depender de colunas fixas
function hasAta(r) {
  if (!r) return false;
  const ataFields = [
    r.ata_url,
    r.ata_storage_path,
    r.ata_path,
    r.ata_texto,
    r.ata_markdown,
    r.ata_html,
    r.ata_pdf_url,
    r.ata_pdf_path,
    r.ata_bucket,
    r.pauta, // ✅ sua “ata IA” atual
    r.ata,   // ✅ sua “ata manual” atual
  ].filter((v) => String(v || "").trim().length > 0);

  const ataStatus = String(r.ata_status || r.status_ata || r.ata_ia_status || "").toUpperCase();
  const okByStatus = ["PRONTO", "OK", "GERADA", "FINALIZADA", "CONCLUIDA", "PRONTA"].includes(ataStatus);

  return ataFields.length > 0 || okByStatus;
}

export default function Copiloto() {
  const { isRecording, isProcessing, timer, startRecording, stopRecording, current } = useRecording();

  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [busca, setBusca] = useState("");

  // abas direita
  const [tab, setTab] = useState("execucoes"); // execucoes | ata_ia | ata_manual | acoes

  // atas (editáveis)
  const [ataIA, setAtaIA] = useState("");
  const [ataManual, setAtaManual] = useState("");
  const [savingAta, setSavingAta] = useState(false);

  // ações
  const [acoesReuniao, setAcoesReuniao] = useState([]);
  const [acoesPendentesTipo, setAcoesPendentesTipo] = useState([]);
  const [acoesTab, setAcoesTab] = useState("reuniao"); // reuniao | tipo
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  // modal ação (igual CentralAtas)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionForm, setActionForm] = useState({
    id: null,
    descricao: "",
    responsavel: "",
    data_vencimento: "",
    observacao: "",
    resultado: "",
    fotos: [],
  });
  const [newFiles, setNewFiles] = useState([]);

  // modal admin
  const [showUnlock, setShowUnlock] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [unlocking, setUnlocking] = useState(false);

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

    // hidrata textos das atas (sem perder histórico)
    safeSet(() => {
      setAtaIA(String(selecionada.pauta || ""));
      setAtaManual(String(selecionada.ata || ""));
    });

    // ações
    fetchAcoes();

    // default tab
    safeSet(() => setTab("execucoes"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada?.id]);

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

  const tipoSelecionado = useMemo(() => {
    const r = selecionada;
    if (!r) return "";
    // ✅ prioriza os campos reais do seu schema
    return String(r.tipo_reuniao || r.tipo_reuniao_legacy || "").trim();
  }, [selecionada]);

  const fetchAcoes = async () => {
    if (!selecionada?.id) return;

    safeSet(() => setLoadingAcoes(true));
    try {
      // 1) ações da reunião
      const q1 = await supabase
        .from("acoes")
        .select("*")
        .eq("reuniao_id", selecionada.id)
        .order("data_criacao", { ascending: false });

      if (q1.error) console.error("fetchAcoes reunião:", q1.error);
      safeSet(() => setAcoesReuniao(q1.data || []));

      // 2) pendentes do tipo (backlog)
      if (tipoSelecionado) {
        const q2 = await supabase
          .from("acoes")
          .select("*")
          .eq("status", "Aberta")
          .eq("tipo_reuniao", tipoSelecionado)
          .neq("reuniao_id", selecionada.id)
          .order("data_criacao", { ascending: false })
          .limit(200);

        if (q2.error) console.error("fetchAcoes tipo:", q2.error);
        safeSet(() => setAcoesPendentesTipo(q2.data || []));
      } else {
        safeSet(() => setAcoesPendentesTipo([]));
      }
    } finally {
      safeSet(() => setLoadingAcoes(false));
    }
  };

  // ✅ regra de bloqueio: se já gravou / já processou / ATA pronta → não grava de novo
  const isLocked = useMemo(() => {
    return (r) => {
      if (!r) return false;

      if (hasAta(r)) return true;

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
    if (!r) return "Pendente";
    if (hasAta(r)) return "REALIZADA";

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

  const onStart = async () => {
    if (!selecionada?.id) return alert("Selecione uma reunião.");
    if (isRecording) return;

    if (isLocked(selecionada)) {
      setShowUnlock(true);
      return;
    }

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
      await fetchReunioes();
    } catch (e) {
      console.error("stopRecording (Copiloto):", e);
      alert("Erro ao encerrar a gravação.");
    }
  };

  // ===== ADMIN UNLOCK (corrigido) =====
  function getLoginSalvo() {
    return (
      localStorage.getItem("inove_login") ||
      sessionStorage.getItem("inove_login") ||
      localStorage.getItem("login") ||
      sessionStorage.getItem("login") ||
      ""
    );
  }

  // ✅ busca usuário e compara no JS (menos frágil)
  async function validarAdmin(senhaDigitada) {
    const login = String(getLoginSalvo() || "").trim();
    if (!login) return { ok: false, reason: "Login não encontrado no navegador." };

    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("id, nivel, ativo, login, senha")
      .eq("ativo", true)
      .eq("login", login)
      .maybeSingle();

    if (error) return { ok: false, reason: "Erro ao validar usuário." };
    if (!data?.id) return { ok: false, reason: `Usuário "${login}" não encontrado/ativo.` };

    const nivel = String(data.nivel || "").toLowerCase();
    if (nivel !== "administrador") return { ok: false, reason: "Seu usuário não é Administrador." };

    const senhaBanco = String(data.senha || "").trim();
    const senhaDig = String(senhaDigitada || "").trim();

    if (!senhaBanco) return { ok: false, reason: "Usuário sem senha cadastrada no banco." };
    if (senhaBanco !== senhaDig) return { ok: false, reason: "Senha inválida." };

    return { ok: true };
  }

  // ✅ liberação sem mexer no schema:
  // volta a reunião para regravar (limpa status de gravação/pipeline)
  async function liberarRegravacao(reuniaoId) {
    const login = getLoginSalvo() || "ADMIN";

    const payload = {
      status: "Pendente",
      gravacao_status: null,
      gravacao_erro: `LIBERADO PARA REGRAVAR por ${login} em ${new Date().toISOString()}`,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("reunioes").update(payload).eq("id", reuniaoId);
    if (error) throw error;
  }

  const onConfirmUnlock = async () => {
    if (!selecionada?.id) return;
    if (!senhaAdmin) return;

    setUnlocking(true);
    try {
      const res = await validarAdmin(senhaAdmin);
      if (!res.ok) {
        alert(res.reason || "Senha inválida.");
        return;
      }

      await liberarRegravacao(selecionada.id);

      setShowUnlock(false);
      setSenhaAdmin("");
      await fetchReunioes();
      alert("Regravação liberada. Agora você pode iniciar novamente.");
    } catch (e) {
      console.error("unlock error:", e);
      alert("Erro ao liberar regravação.");
    } finally {
      setUnlocking(false);
    }
  };

  // ====== ATA IA / MANUAL ======
  const salvarAta = async (kind) => {
    if (!selecionada?.id) return;

    setSavingAta(true);
    try {
      const payload =
        kind === "ia"
          ? { pauta: ataIA, updated_at: new Date().toISOString() }
          : { ata: ataManual, updated_at: new Date().toISOString() };

      const { error } = await supabase.from("reunioes").update(payload).eq("id", selecionada.id);
      if (error) throw error;

      await fetchReunioes();

      // mantém selecionada atualizada
      safeSet(() => {
        setSelecionada((prev) => (prev ? { ...prev, ...payload } : prev));
      });

      alert("Salvo com sucesso.");
    } catch (e) {
      console.error("salvarAta error:", e);
      alert("Erro ao salvar: " + (e?.message || e));
    } finally {
      setSavingAta(false);
    }
  };

  // ====== MODAL AÇÃO (igual CentralAtas) ======
  const openNewActionModal = () => {
    setActionForm({
      id: null,
      descricao: "",
      responsavel: "",
      data_vencimento: "",
      observacao: "",
      resultado: "",
      fotos: [],
    });
    setNewFiles([]);
    setIsModalOpen(true);
  };

  const openEditActionModal = (acao) => {
    setActionForm({
      id: acao.id,
      descricao: acao.descricao || "",
      responsavel: acao.responsavel || "",
      data_vencimento: acao.data_vencimento ? String(acao.data_vencimento).slice(0, 10) : "",
      observacao: acao.observacao || "",
      resultado: acao.resultado || "",
      fotos: Array.isArray(acao.fotos) ? acao.fotos : [],
    });
    setNewFiles([]);
    setIsModalOpen(true);
  };

  const handleFileSelect = (e) => {
    if (e.target.files) setNewFiles((prev) => [...prev, ...Array.from(e.target.files)]);
  };

  const handleSaveAction = async () => {
    if (!selecionada?.id) return alert("Selecione uma reunião.");
    if (!actionForm.descricao?.trim()) return alert("A descrição é obrigatória.");

    setModalLoading(true);
    try {
      // Upload de fotos no bucket "evidencias" (igual seu CentralAtas)
      let uploadedUrls = [];
      if (newFiles.length > 0) {
        for (const file of newFiles) {
          const fileName = `evidencia-${Date.now()}-${String(file.name || "")
            .replace(/[^a-zA-Z0-9.]/g, "")
            .slice(0, 120)}`;

          const { error } = await supabase.storage.from("evidencias").upload(fileName, file);
          if (!error) {
            const { data } = supabase.storage.from("evidencias").getPublicUrl(fileName);
            if (data?.publicUrl) uploadedUrls.push(data.publicUrl);
          }
        }
      }

      const finalFotos = [...(actionForm.fotos || []), ...uploadedUrls];

      const payload = {
        descricao: actionForm.descricao,
        responsavel: actionForm.responsavel || "Geral",
        data_vencimento: actionForm.data_vencimento || null,
        observacao: actionForm.observacao || null,
        resultado: actionForm.resultado || null,
        fotos: finalFotos,
        reuniao_id: selecionada.id,
        tipo_reuniao: tipoSelecionado || null, // ✅ chave para backlog “Pendentes do tipo”
      };

      if (actionForm.id) {
        const { error } = await supabase.from("acoes").update(payload).eq("id", actionForm.id);
        if (error) throw error;
      } else {
        const insertPayload = {
          ...payload,
          status: "Aberta",
          data_criacao: new Date().toISOString(),
          data_abertura: new Date().toISOString().slice(0, 10),
        };
        const { error } = await supabase.from("acoes").insert([insertPayload]);
        if (error) throw error;
      }

      await fetchAcoes();
      setIsModalOpen(false);
    } catch (e) {
      console.error("handleSaveAction:", e);
      alert("Erro ao salvar ação: " + (e?.message || e));
    } finally {
      setModalLoading(false);
    }
  };

  const toggleStatusAcao = async (acao, e) => {
    e.stopPropagation();
    const novoStatus = acao.status === "Aberta" ? "Concluída" : "Aberta";

    const patch = (lista) => lista.map((a) => (a.id === acao.id ? { ...a, status: novoStatus } : a));
    setAcoesReuniao(patch(acoesReuniao));
    setAcoesPendentesTipo(patch(acoesPendentesTipo));

    await supabase.from("acoes").update({ status: novoStatus, data_conclusao: novoStatus === "Concluída" ? new Date().toISOString().slice(0, 10) : null }).eq("id", acao.id);
  };

  // UI: filtros
  const reunioesFiltradas = (reunioes || []).filter((r) =>
    (r.titulo || "").toLowerCase().includes((busca || "").toLowerCase())
  );

  const rightTabs = [
    { key: "execucoes", label: "Execuções", icon: ClipboardList },
    { key: "ata_ia", label: "Ata IA", icon: Cpu },
    { key: "ata_manual", label: "Ata Manual", icon: FileText },
    { key: "acoes", label: "Ações", icon: CheckCircle },
  ];

  return (
    <Layout>
      <div className="h-screen bg-[#0f172a] text-white flex overflow-hidden">
        {/* COLUNA ESQUERDA (mais estreita) */}
        <div className="w-5/12 flex flex-col p-6 border-r border-slate-800">
          <h1 className="text-2xl font-black text-blue-500 mb-6 flex items-center gap-2">
            <Cpu size={28} /> COPILOTO TÁTICO
          </h1>

          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Calendar className="absolute left-3 top-3 text-slate-400" size={16} />
              <input
                type="date"
                className="bg-slate-800 rounded-xl p-3 pl-9 text-sm w-full"
                value={dataFiltro}
                onChange={(e) => setDataFiltro(e.target.value)}
              />
            </div>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar..."
                className="bg-slate-800 rounded-xl p-3 pl-9 text-sm w-full"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
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

                      {r.tipo_reuniao && (
                        <span className="text-[10px] px-2 py-1 rounded font-black uppercase bg-slate-800 border border-slate-700 text-slate-200">
                          {String(r.tipo_reuniao).slice(0, 18)}
                        </span>
                      )}

                      {locked && (
                        <span className="text-[10px] px-2 py-1 rounded font-black uppercase bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1">
                          <Lock size={12} /> BLOQUEADO
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] px-2 py-1 rounded font-black uppercase whitespace-nowrap ${badgeStyle(lbl)}`}
                      title={r.gravacao_erro || ""}
                    >
                      {lbl}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 mt-1">
                    {r.data_hora ? new Date(r.data_hora).toLocaleString("pt-BR") : "-"}
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
                  <Monitor size={26} />
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Tempo de Sessão</p>
                <p className="text-2xl font-mono font-bold leading-none">{secondsToMMSS(timer)}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isRecording && current?.reuniaoTitulo ? `Gravando: ${current.reuniaoTitulo}` : "Pronto para gravar"}
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

        {/* COLUNA DIREITA (mais larga) */}
        <div className="w-7/12 p-6 flex flex-col bg-slate-900/80">
          <div className="mb-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Reunião selecionada</div>
            <div className="text-lg font-black">
              {selecionada?.titulo || "—"}
              {selecionada?.id ? (
                <span className="text-slate-400 text-xs font-bold ml-2">
                  {String(selecionada.id).slice(0, 6)}…
                </span>
              ) : null}
            </div>
            <div className="text-xs text-slate-400">
              Tipo: {tipoSelecionado || "—"} • {selecionada?.data_hora ? new Date(selecionada.data_hora).toLocaleString("pt-BR") : "—"}
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {rightTabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-black border transition-all flex items-center gap-2 ${
                    active
                      ? "bg-blue-600/20 border-blue-500/40 text-blue-100"
                      : "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
                  }`}
                  disabled={!selecionada}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* CONTEÚDO */}
          <div className="flex-1 bg-slate-950/20 border border-slate-800 rounded-2xl p-5 overflow-y-auto custom-scrollbar">
            {!selecionada ? (
              <div className="text-slate-400 text-sm">Selecione uma reunião para ver os detalhes.</div>
            ) : tab === "execucoes" ? (
              <div className="space-y-3">
                <div className="text-xs font-black text-slate-300 flex items-center gap-2">
                  <BookOpen size={14} /> Execuções
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Status</div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded font-black uppercase ${badgeStyle(badgeLabel(selecionada))}`}>
                      {badgeLabel(selecionada)}
                    </span>
                    <span className="text-[10px] px-2 py-1 rounded font-black uppercase bg-slate-800 border border-slate-700 text-slate-200">
                      Tipo: {tipoSelecionado || "—"}
                    </span>
                    <span className="text-[10px] px-2 py-1 rounded font-black uppercase bg-slate-800 border border-slate-700 text-slate-200">
                      Duração: {selecionada?.duracao_segundos ? secondsToMMSS(selecionada.duracao_segundos) : "—"}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-slate-400">
                    <div><b className="text-slate-300">Observações (reunião):</b></div>
                    <div className="whitespace-pre-wrap break-words">{selecionada.observacoes || "—"}</div>
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  Se aparecer <b>ERRO</b> aqui mas a ata subiu, isso é “status inconsistente”.
                  O badge já prioriza <b>REALIZADA</b> quando existe conteúdo de ata.
                </div>
              </div>
            ) : tab === "ata_ia" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-black text-slate-300 flex items-center gap-2">
                    <Cpu size={14} /> Ata IA (reunioes.pauta)
                  </div>
                  <button
                    onClick={() => salvarAta("ia")}
                    disabled={savingAta}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingAta ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Salvar
                  </button>
                </div>

                <textarea
                  className="w-full min-h-[420px] bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-blue-500 font-mono"
                  value={ataIA}
                  onChange={(e) => setAtaIA(e.target.value)}
                  placeholder="Ata gerada pela IA..."
                />
              </div>
            ) : tab === "ata_manual" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-black text-slate-300 flex items-center gap-2">
                    <FileText size={14} /> Ata Manual (reunioes.ata)
                  </div>
                  <button
                    onClick={() => salvarAta("manual")}
                    disabled={savingAta}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingAta ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Salvar
                  </button>
                </div>

                <textarea
                  className="w-full min-h-[420px] bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-blue-500"
                  value={ataManual}
                  onChange={(e) => setAtaManual(e.target.value)}
                  placeholder="Ata manual (responsável pela reunião)..."
                />
              </div>
            ) : (
              // ===== AÇÕES =====
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs font-black text-slate-300 flex items-center gap-2">
                    <CheckCircle size={14} /> Ações
                    <span className="text-[10px] text-slate-500 font-bold">
                      (Da reunião + backlog pendente do tipo)
                    </span>
                  </div>

                  <button
                    onClick={openNewActionModal}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2"
                  >
                    <Plus size={14} /> Nova ação
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setAcoesTab("reuniao")}
                    className={`px-3 py-2 rounded-xl text-xs font-black border ${
                      acoesTab === "reuniao"
                        ? "bg-blue-600/20 border-blue-500/40 text-blue-100"
                        : "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    Da reunião
                  </button>
                  <button
                    onClick={() => setAcoesTab("tipo")}
                    className={`px-3 py-2 rounded-xl text-xs font-black border ${
                      acoesTab === "tipo"
                        ? "bg-blue-600/20 border-blue-500/40 text-blue-100"
                        : "bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    Pendentes do tipo
                  </button>
                </div>

                {loadingAcoes ? (
                  <div className="text-slate-400 text-sm flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Carregando ações...
                  </div>
                ) : acoesTab === "reuniao" ? (
                  <div className="space-y-2">
                    {acoesReuniao.map((acao) => (
                      <div
                        key={acao.id}
                        onClick={() => openEditActionModal(acao)}
                        className={`p-3 border rounded-2xl cursor-pointer hover:shadow-md transition-all group ${
                          acao.status === "Concluída"
                            ? "bg-slate-900/30 opacity-70 border-slate-800"
                            : "bg-slate-800/30 border-slate-800 hover:border-blue-500/40"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={acao.status === "Concluída"}
                            onChange={(e) => toggleStatusAcao(acao, e)}
                            className="mt-1 cursor-pointer w-4 h-4"
                          />
                          <div className="flex-1">
                            <p className={`text-sm font-bold ${acao.status === "Concluída" ? "line-through text-slate-500" : "text-slate-100"}`}>
                              {acao.descricao}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              <span className="text-[10px] bg-slate-900/50 text-slate-200 px-2 py-1 rounded-lg flex items-center gap-1 border border-slate-800">
                                <User size={10} /> {acao.responsavel || "Geral"}
                              </span>
                              {acao.data_vencimento && (
                                <span className="text-[10px] text-amber-300 flex items-center gap-1">
                                  <Clock size={10} /> {new Date(acao.data_vencimento).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                              {Array.isArray(acao.fotos) && acao.fotos.length > 0 && (
                                <span className="text-[10px] text-blue-300 flex items-center gap-1">
                                  <ImageIcon size={10} /> {acao.fotos.length}
                                </span>
                              )}
                              {acao.observacao && (
                                <span className="text-[10px] text-emerald-300 flex items-center gap-1">
                                  <MessageSquare size={10} /> Obs
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {acoesReuniao.length === 0 && (
                      <div className="text-slate-400 text-sm">Nenhuma ação cadastrada para esta reunião.</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-slate-400">
                      Tipo aplicado: <b className="text-slate-200">{tipoSelecionado || "—"}</b>
                    </div>

                    {acoesPendentesTipo.map((acao) => (
                      <div
                        key={acao.id}
                        onClick={() => openEditActionModal(acao)}
                        className="p-3 bg-amber-900/10 border border-amber-800/30 rounded-2xl cursor-pointer hover:bg-amber-900/15 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={acao.status === "Concluída"}
                            onChange={(e) => toggleStatusAcao(acao, e)}
                            className="mt-1 cursor-pointer w-4 h-4"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-100">{acao.descricao}</p>
                            <div className="text-[10px] text-amber-200 mt-1">
                              Origem: {acao.data_criacao ? new Date(acao.data_criacao).toLocaleDateString("pt-BR") : "-"}
                              {acao.reuniao_id ? ` • Reunião: ${String(acao.reuniao_id).slice(0, 6)}…` : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {acoesPendentesTipo.length === 0 && (
                      <div className="text-slate-400 text-sm">Nenhuma ação pendente para este tipo.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MODAL: LIBERAÇÃO ADMIN */}
        {showUnlock && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="w-[440px] bg-slate-900 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-black text-white">Liberação de Regravação</h3>
              <p className="text-xs text-slate-400 mt-2">
                Esta reunião já foi gravada/processada (ou a Ata já existe). Para gravar novamente,
                confirme a <b>senha do Administrador</b>.
              </p>

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
                  {unlocking ? "Liberando..." : "Liberar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL AÇÃO */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] text-slate-900">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800">{actionForm.id ? "Detalhes da Ação" : "Nova Ação"}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                <div className="text-xs text-slate-500">
                  Tipo aplicado automaticamente: <b>{tipoSelecionado || "—"}</b>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">O que precisa ser feito?</label>
                  <textarea
                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                    value={actionForm.descricao}
                    onChange={(e) => setActionForm({ ...actionForm, descricao: e.target.value })}
                    placeholder="Descreva a tarefa..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Responsável</label>
                    <input
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500"
                      value={actionForm.responsavel}
                      onChange={(e) => setActionForm({ ...actionForm, responsavel: e.target.value })}
                      placeholder="Nome"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vencimento</label>
                    <input
                      type="date"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500"
                      value={actionForm.data_vencimento}
                      onChange={(e) => setActionForm({ ...actionForm, data_vencimento: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações / Comentários</label>
                  <textarea
                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none bg-slate-50"
                    value={actionForm.observacao}
                    onChange={(e) => setActionForm({ ...actionForm, observacao: e.target.value })}
                    placeholder="Detalhes extras..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    O que foi feito e evidências do que foi realizado
                  </label>
                  <textarea
                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none bg-slate-50"
                    value={actionForm.resultado}
                    onChange={(e) => setActionForm({ ...actionForm, resultado: e.target.value })}
                    placeholder="Descreva o que foi executado, resultados e referências às evidências..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Evidências (Fotos)</label>

                  {Array.isArray(actionForm.fotos) && actionForm.fotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {actionForm.fotos.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block relative aspect-square rounded-lg overflow-hidden border border-slate-200 group"
                        >
                          <img src={url} className="w-full h-full object-cover" alt="evidencia" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <ExternalLink className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" size={16} />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  <label className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors text-slate-400 hover:text-blue-500">
                    <Camera size={24} className="mb-1" />
                    <span className="text-xs font-bold">Adicionar Foto</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                  </label>
                  {newFiles.length > 0 && (
                    <p className="text-xs text-green-600 mt-1 font-bold">{newFiles.length} novos arquivos selecionados.</p>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAction}
                  disabled={modalLoading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {actionForm.id ? "Salvar Alterações" : "Criar Ação"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// src/pages/Copiloto.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import {
  Cpu,
  Monitor,
  Search,
  Calendar,
  Lock,
  Loader2,
  CheckCircle,
  Plus,
  PlayCircle,
  Headphones,
  ClipboardList,
  FileText,
  Pencil,
  Save,
  X,
  AlertTriangle,
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

function toBRDate(dt) {
  try {
    return dt ? new Date(dt).toLocaleDateString("pt-BR") : "-";
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
 * ✅ Corrige o bug “tudo Realizada”
 * Só considera que “tem ATA” se houver conteúdo relevante (não vazio/curto),
 * ou status IA pronto.
 */
function hasAtaReal(r) {
  if (!r) return false;

  // campos possíveis (no seu schema existe pauta/ata/ata_ia_status)
  const iaStatus = norm(r.ata_ia_status);
  const okByStatus = ["PRONTO", "PRONTA", "OK", "GERADA", "FINALIZADA", "CONCLUIDA"].includes(iaStatus);

  const pauta = String(r.pauta || "").trim();
  const ata = String(r.ata || "").trim();

  // evita falso positivo (ex: default "", " ", "ok", etc.)
  const hasText = (txt) => txt && txt.replace(/\s+/g, " ").trim().length >= 40;

  return okByStatus || hasText(pauta) || hasText(ata);
}

function getTipoReuniao(r) {
  // seu CSV tem tipo_reuniao e tipo_reuniao_legacy
  const t =
    r?.tipo_reuniao ||
    r?.tipo_reuniao_legacy ||
    r?.tipo ||
    r?.categoria ||
    "Geral";
  return String(t || "Geral").trim() || "Geral";
}

function getSignedOrPublicUrl(bucket, path, expiresSec = 60 * 30) {
  if (!bucket || !path) return Promise.resolve(null);
  return (async () => {
    const { data: signed, error: e1 } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSec);
    if (!e1 && signed?.signedUrl) return signed.signedUrl;

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    return pub?.publicUrl || null;
  })();
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

  // Tabs da direita
  const [tab, setTab] = useState("execucoes"); // execucoes | ata_ia | ata_manual | acoes

  // Execuções (histórico)
  const [execucoes, setExecucoes] = useState([]);
  const [loadingExec, setLoadingExec] = useState(false);
  const [mediaUrls, setMediaUrls] = useState({ video: null, audio: null });

  // ATA IA / ATA Manual (editáveis)
  const [isEditingIA, setIsEditingIA] = useState(false);
  const [isEditingManual, setIsEditingManual] = useState(false);
  const [ataIAValue, setAtaIAValue] = useState("");
  const [ataManualValue, setAtaManualValue] = useState("");

  // Ações (mesma lógica da CentralAtas: da reunião + backlog por tipo)
  const [acoesDaReuniao, setAcoesDaReuniao] = useState([]);
  const [acoesPendentesTipo, setAcoesPendentesTipo] = useState([]);
  const [loadingAcoes, setLoadingAcoes] = useState(false);
  const [acaoTab, setAcaoTab] = useState("reuniao"); // reuniao | tipo

  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel: "" });

  // Modal admin unlock
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

    // hydrate campos da direita
    setAtaIAValue(String(selecionada.pauta || selecionada.ata || "").trim());
    setAtaManualValue(String(selecionada.observacoes || "").trim());
    setIsEditingIA(false);
    setIsEditingManual(false);

    hydrateMediaUrls(selecionada);
    fetchExecucoes(selecionada.id);
    fetchAcoes(selecionada);

    // se selecionou, já cai na aba Execuções (pra “começar por aqui”)
    setTab("execucoes");
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

    // mantém selecionada se existir
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
     Media URLs (vídeo/áudio compilados)
  ========================= */
  const hydrateMediaUrls = async (r) => {
    try {
      const videoUrl = await getSignedOrPublicUrl(r.gravacao_bucket, r.gravacao_path);
      const audioUrl = await getSignedOrPublicUrl(r.gravacao_audio_bucket || r.gravacao_bucket, r.gravacao_audio_path);
      safeSet(() => setMediaUrls({ video: videoUrl, audio: audioUrl }));
    } catch (e) {
      console.error("hydrateMediaUrls:", e);
      safeSet(() => setMediaUrls({ video: null, audio: null }));
    }
  };

  /* =========================
     Execuções (histórico por session_id)
     - Cada gravação cria uma execução (session)
  ========================= */
  const fetchExecucoes = async (reuniaoId) => {
    if (!reuniaoId) return;
    safeSet(() => setLoadingExec(true));
    try {
      const { data, error } = await supabase
        .from("reuniao_gravacao_partes")
        .select("session_id, part_number, bytes, status, created_at, storage_bucket, storage_path")
        .eq("reuniao_id", reuniaoId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // agrupa por session_id
      const map = new Map();
      (data || []).forEach((p) => {
        const sid = p.session_id || "sem_session";
        if (!map.has(sid)) {
          map.set(sid, {
            session_id: sid,
            created_at: p.created_at,
            parts: 0,
            bytes: 0,
            status: p.status || null,
          });
        }
        const row = map.get(sid);
        row.parts += 1;
        row.bytes += Number(p.bytes || 0);
        // mantém data mais recente
        if (p.created_at && row.created_at && new Date(p.created_at) > new Date(row.created_at)) row.created_at = p.created_at;
      });

      const list = Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      safeSet(() => setExecucoes(list));
    } catch (e) {
      console.error("fetchExecucoes:", e);
      safeSet(() => setExecucoes([]));
    } finally {
      safeSet(() => setLoadingExec(false));
    }
  };

  /* =========================
     Ações (igual CentralAtas: da reunião + backlog por tipo)
     - a tabela acoes tem: reuniao_id, tipo_reuniao, status, observacao, resultado, fotos...
  ========================= */
  const fetchAcoes = async (r) => {
    if (!r?.id) return;

    safeSet(() => setLoadingAcoes(true));
    try {
      // 1) Ações desta reunião
      const { data: daReuniao, error: e1 } = await supabase
        .from("acoes")
        .select("*")
        .eq("reuniao_id", r.id)
        .order("created_at", { ascending: false });

      if (e1) throw e1;
      safeSet(() => setAcoesDaReuniao(daReuniao || []));

      // 2) Backlog pendente do tipo
      const tipo = getTipoReuniao(r);

      // pendentes do tipo: status Aberta, tipo_reuniao igual,
      // e NÃO pertencem à reunião atual (reuniao_id null ou diferente)
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
      // fallback: recarrega
      fetchAcoes(selecionada);
    }
  };

  /* =========================
     ATA IA / ATA Manual (salvar)
     - IA: salva em pauta (igual CentralAtas)
     - Manual: salva em observacoes (campo existe no seu CSV)
  ========================= */
  const salvarAtaIA = async () => {
    if (!selecionada?.id) return;
    const { error } = await supabase
      .from("reunioes")
      .update({ pauta: ataIAValue, updated_at: nowIso() })
      .eq("id", selecionada.id);

    if (error) {
      alert("Erro ao salvar Ata IA: " + (error.message || error));
      return;
    }
    setIsEditingIA(false);
    await fetchReunioes();
  };

  const salvarAtaManual = async () => {
    if (!selecionada?.id) return;
    const { error } = await supabase
      .from("reunioes")
      .update({ observacoes: ataManualValue, updated_at: nowIso() })
      .eq("id", selecionada.id);

    if (error) {
      alert("Erro ao salvar Ata Manual: " + (error.message || error));
      return;
    }
    setIsEditingManual(false);
    await fetchReunioes();
  };

  /* =========================
     Lock / Badge
     ✅ Reunião só é “Realizada” se:
        - status == Realizada OU gravacao_status pipeline/feito OU ata real existe
  ========================= */
  const isLocked = useMemo(() => {
    return (r) => {
      if (!r) return false;

      // se já tem ata real, trava
      if (hasAtaReal(r)) return true;

      const st = norm(r.status);
      const gs = norm(r.gravacao_status);

      if (st === "REALIZADA") return true;

      // pipeline / concluído (sem inventar “Realizada” em reunião agendada)
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

    // ✅ prioridade: status real do banco
    const st = norm(r.status);
    if (st) {
      if (st === "REALIZADA") return "REALIZADA";
      if (st === "AGENDADA") return "AGENDADA";
      if (st === "PENDENTE") return "PENDENTE";
      if (st === "EM ANDAMENTO") return "EM ANDAMENTO";
    }

    // ✅ se ata real existe, considera realizada
    if (hasAtaReal(r)) return "REALIZADA";

    // senão, mostra gravacao_status se existir
    const gs = norm(r.gravacao_status);
    if (gs) return gs;

    return "PENDENTE";
  };

  const badgeStyle = (label) => {
    const v = norm(label);
    if (v === "AGENDADA") return "bg-slate-700 text-slate-100 border border-slate-600";
    if (v === "PENDENTE") return "bg-slate-700 text-slate-100 border border-slate-600";
    if (v === "EM ANDAMENTO") return "bg-blue-600/20 text-blue-200 border border-blue-500/30";
    if (v === "GRAVANDO") return "bg-red-600/30 text-red-200 border border-red-500/30";
    if (v === "ERRO") return "bg-red-900/40 text-red-200 border border-red-500/30";
    if (v === "REALIZADA") return "bg-green-600/20 text-green-200 border border-green-500/30";
    if (v.includes("PROCESS")) return "bg-blue-600/20 text-blue-200 border border-blue-500/30";
    if (v.includes("PRONTO") || v.includes("CONCL")) return "bg-emerald-600/20 text-emerald-200 border border-emerald-500/30";
    return "bg-slate-700 text-slate-100 border border-slate-600";
  };

  /* =========================
     Start/Stop Recording
  ========================= */
  const onStart = async () => {
    if (!selecionada?.id) return alert("Selecione uma reunião.");
    if (isRecording) return;

    // trava regravação quando já foi gravada/processada/ata existe
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
      setTab("execucoes");
    } catch (e) {
      console.error("startRecording (Copiloto):", e);
      alert("Erro ao iniciar. Verifique permissões de tela e áudio.");
    }
  };

  const onStop = async () => {
    try {
      await stopRecording();
      await fetchReunioes();
      if (selecionada?.id) {
        await fetchExecucoes(selecionada.id);
        await fetchAcoes(selecionada);
      }
    } catch (e) {
      console.error("stopRecording (Copiloto):", e);
      alert("Erro ao encerrar a gravação.");
    }
  };

  /* =========================
     Admin Unlock (liberar regravação)
     ✅ Seu problema “senha inválida” normalmente é:
       - login salvo não é o mesmo campo (login vs email),
       - ou senha no banco não bate (hash),
       - ou você está no supabaseClient errado.
     Aqui eu deixei validação mais robusta (login OU email).
  ========================= */
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
    const login = String(getLoginSalvo() || "").trim();
    const senha = String(senhaDigitada || "").trim();
    if (!login || !senha) return false;

    // tenta por login OU email
    const q = await supabase
      .from("usuarios_aprovadores")
      .select("id, nivel, ativo, login, email")
      .or(`login.eq.${login},email.eq.${login}`)
      .eq("senha", senha)
      .eq("ativo", true)
      .maybeSingle();

    if (!q?.data || q?.error) return false;

    return String(q.data?.nivel || "").toLowerCase() === "administrador";
  }

  async function liberarRegravacao(reuniaoId) {
    const who = String(getLoginSalvo() || "ADMIN").trim();

    const payload = {
      status: "Pendente",
      gravacao_status: null,
      gravacao_erro: `LIBERADO PARA REGRAVAR por ${who} em ${nowIso()}`,
      updated_at: nowIso(),
    };

    const { error } = await supabase.from("reunioes").update(payload).eq("id", reuniaoId);
    if (error) throw error;
  }

  const onConfirmUnlock = async () => {
    if (!selecionada?.id) return;
    if (!senhaAdmin) return;

    setUnlocking(true);
    try {
      const ok = await validarAdmin(senhaAdmin);
      if (!ok) {
        alert("Senha inválida ou usuário não é Administrador (login/email).");
        return;
      }

      await liberarRegravacao(selecionada.id);

      setShowUnlock(false);
      setSenhaAdmin("");
      await fetchReunioes();
      alert("Regravação liberada. Agora você pode iniciar novamente.");
    } catch (e) {
      console.error("unlock error:", e);
      alert("Erro ao liberar regravação: " + (e?.message || e));
    } finally {
      setUnlocking(false);
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

  /* =========================
     Render
  ========================= */
  return (
    <Layout>
      <div className="h-screen bg-[#0b1220] text-white flex overflow-hidden">
        {/* =====================
            COLUNA ESQUERDA (mais estreita)
        ===================== */}
        <div className="w-[420px] min-w-[380px] max-w-[460px] flex flex-col p-5 border-r border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Cpu size={22} className="text-blue-400" />
            <h1 className="text-lg font-black tracking-tight text-blue-300">COPILOTO TÁTICO</h1>
          </div>

          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="date"
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 ring-blue-500/40"
                value={dataFiltro}
                onChange={(e) => setDataFiltro(e.target.value)}
              />
            </div>

            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 ring-blue-500/40"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 bg-slate-900/30 border border-slate-800 rounded-2xl overflow-y-auto custom-scrollbar">
            {reunioesFiltradas.map((r) => {
              const lbl = badgeLabel(r);
              const locked = isLocked(r);
              const tipo = getTipoReuniao(r);

              return (
                <button
                  key={r.id}
                  onClick={() => !isRecording && setSelecionada(r)}
                  className={`w-full text-left p-4 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
                    selecionada?.id === r.id ? "bg-blue-600/10 border-l-4 border-l-blue-400" : "border-l-4 border-l-transparent"
                  } ${isRecording ? "opacity-80 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-xs truncate">{r.titulo || "Sem título"}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-black uppercase">
                          {tipo || "Geral"}
                        </span>
                        {locked && (
                          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-black uppercase flex items-center gap-1">
                            <Lock size={12} /> BLOQUEADO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {toBR(r.data_hora)}
                        {typeof r.duracao_segundos === "number" && r.duracao_segundos > 0 ? (
                          <span className="text-slate-500"> • {secondsToMMSS(r.duracao_segundos)}</span>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-1 rounded-lg font-black uppercase whitespace-nowrap ${badgeStyle(lbl)}`}
                      title={r.gravacao_erro || ""}
                    >
                      {lbl}
                    </span>
                  </div>
                </button>
              );
            })}

            {reunioesFiltradas.length === 0 && (
              <div className="p-6 text-xs text-slate-400">Nenhuma reunião nesta data.</div>
            )}
          </div>

          {/* CONTROLES */}
          <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
                  isRecording ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-blue-500/10 border-blue-500/30 text-blue-300"
                }`}
              >
                {isRecording ? <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" /> : <Monitor size={20} />}
              </div>

              <div>
                <div className="text-[10px] text-slate-500 font-black uppercase">Tempo de sessão</div>
                <div className="text-lg font-black font-mono leading-none">{secondsToMMSS(timer)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {isRecording && current?.reuniaoTitulo ? `Gravando: ${current.reuniaoTitulo}` : "Pronto para gravar"}
                </div>
              </div>
            </div>

            {isProcessing ? (
              <div className="flex items-center gap-2 text-blue-300 font-black text-xs animate-pulse">
                <Loader2 className="animate-spin" size={16} /> FINALIZANDO...
              </div>
            ) : isRecording ? (
              <button
                onClick={onStop}
                className="bg-white text-slate-900 px-5 py-2.5 rounded-xl font-black text-xs hover:bg-red-50 transition-all"
              >
                ENCERRAR
              </button>
            ) : (
              <button
                onClick={onStart}
                disabled={!selecionada}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-xs hover:bg-blue-500 disabled:opacity-30 transition-all shadow-lg shadow-blue-900/30"
              >
                INICIAR GRAVAÇÃO
              </button>
            )}
          </div>
        </div>

        {/* =====================
            COLUNA DIREITA (profissional com tabs)
        ===================== */}
        <div className="flex-1 p-6 bg-[#0b1220]">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
            {/* Header reunião selecionada */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-black uppercase">Reunião selecionada</div>
                <div className="text-base font-black truncate">{selecionada?.titulo || "—"}</div>
                <div className="text-xs text-slate-400 mt-1">
                  Tipo: <span className="text-slate-200 font-bold">{tipoSelecionado}</span> • Execução:{" "}
                  <span className="text-slate-200 font-bold">{selecionada?.data_hora ? toBR(selecionada.data_hora) : "—"}</span>
                </div>
              </div>

              {/* Estado / alerta “inconsistência” */}
              <div className="flex items-center gap-2">
                {norm(selecionada?.gravacao_status) === "ERRO" && hasAtaReal(selecionada) ? (
                  <div className="flex items-center gap-2 text-[11px] text-amber-200 bg-amber-600/10 border border-amber-500/20 rounded-xl px-3 py-2">
                    <AlertTriangle size={14} />
                    Status ERRO, mas ATA existe (ok)
                  </div>
                ) : null}
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex flex-wrap gap-2">
              <TabButton active={tab === "execucoes"} onClick={() => setTab("execucoes")} icon={<PlayCircle size={16} />}>
                Execuções
              </TabButton>

              <TabButton active={tab === "ata_ia"} onClick={() => setTab("ata_ia")} icon={<FileText size={16} />}>
                Ata IA
              </TabButton>

              <TabButton active={tab === "ata_manual"} onClick={() => setTab("ata_manual")} icon={<Pencil size={16} />}>
                Ata Manual
              </TabButton>

              <TabButton active={tab === "acoes"} onClick={() => setTab("acoes")} icon={<ClipboardList size={16} />}>
                Ações
              </TabButton>
            </div>
          </div>

          {/* Conteúdo tabs */}
          <div className="mt-4">
            {!selecionada ? (
              <div className="text-slate-400 text-sm">Selecione uma reunião.</div>
            ) : tab === "execucoes" ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs font-black text-slate-200 flex items-center gap-2">
                      <PlayCircle size={16} className="text-blue-300" />
                      Histórico de Execuções
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Cada gravação gera uma execução. Nada é apagado.
                    </div>
                  </div>
                  <button
                    onClick={() => fetchExecucoes(selecionada.id)}
                    className="text-[11px] font-black bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-xl"
                    disabled={loadingExec}
                  >
                    {loadingExec ? "Atualizando..." : "Atualizar"}
                  </button>
                </div>

                {/* players */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2">
                      <PlayCircle size={14} /> Vídeo compilado
                    </div>
                    {mediaUrls.video ? (
                      <video controls className="w-full rounded-xl bg-black">
                        <source src={mediaUrls.video} type="video/webm" />
                      </video>
                    ) : (
                      <div className="text-xs text-slate-400">Sem vídeo compilado ainda (gravacao_path vazio).</div>
                    )}
                  </div>

                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2">
                      <Headphones size={14} /> Áudio compilado
                    </div>
                    {mediaUrls.audio ? (
                      <audio controls className="w-full">
                        <source src={mediaUrls.audio} type="audio/webm" />
                      </audio>
                    ) : (
                      <div className="text-xs text-slate-400">Sem áudio compilado ainda (gravacao_audio_path vazio).</div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {loadingExec ? (
                    <div className="text-slate-400 text-sm">Carregando execuções...</div>
                  ) : execucoes.length === 0 ? (
                    <div className="text-slate-400 text-sm">Sem execuções registradas ainda.</div>
                  ) : (
                    execucoes.map((e) => (
                      <div key={e.session_id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-200 truncate">
                              Sessão: <span className="text-slate-300 font-mono">{e.session_id}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              Última parte: {toBR(e.created_at)} • Partes:{" "}
                              <span className="text-slate-200 font-bold">{e.parts}</span> • Tamanho:{" "}
                              <span className="text-slate-200 font-bold">{formatBytes(e.bytes)}</span>
                            </div>
                          </div>
                          <span className="text-[10px] px-2 py-1 rounded-lg font-black uppercase bg-slate-800 border border-slate-700 text-slate-200">
                            {String(e.status || "UPLOADED")}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : tab === "ata_ia" ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-black text-slate-200 flex items-center gap-2">
                    <FileText size={16} className="text-emerald-300" />
                    Ata IA (pauta)
                  </div>

                  <div className="flex gap-2">
                    {isEditingIA ? (
                      <>
                        <button
                          onClick={() => {
                            setAtaIAValue(String(selecionada.pauta || selecionada.ata || "").trim());
                            setIsEditingIA(false);
                          }}
                          className="text-[11px] font-black bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <X size={14} /> Cancelar
                        </button>
                        <button
                          onClick={salvarAtaIA}
                          className="text-[11px] font-black bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <Save size={14} /> Salvar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditingIA(true)}
                        className="text-[11px] font-black bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-xl flex items-center gap-2"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                    )}
                  </div>
                </div>

                {isEditingIA ? (
                  <textarea
                    className="w-full min-h-[320px] bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-xs font-mono outline-none focus:ring-2 ring-blue-500/40"
                    value={ataIAValue}
                    onChange={(e) => setAtaIAValue(e.target.value)}
                    placeholder="Cole/edite aqui a ATA gerada pela IA..."
                  />
                ) : (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {String(ataIAValue || "").trim() ? ataIAValue : "Sem ATA IA ainda."}
                  </div>
                )}
              </div>
            ) : tab === "ata_manual" ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-black text-slate-200 flex items-center gap-2">
                    <Pencil size={16} className="text-amber-300" />
                    Ata Manual (responsável)
                  </div>

                  <div className="flex gap-2">
                    {isEditingManual ? (
                      <>
                        <button
                          onClick={() => {
                            setAtaManualValue(String(selecionada.observacoes || "").trim());
                            setIsEditingManual(false);
                          }}
                          className="text-[11px] font-black bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <X size={14} /> Cancelar
                        </button>
                        <button
                          onClick={salvarAtaManual}
                          className="text-[11px] font-black bg-amber-600 hover:bg-amber-500 px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <Save size={14} /> Salvar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditingManual(true)}
                        className="text-[11px] font-black bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-xl flex items-center gap-2"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 mb-3">
                  Essa ata é a versão humana (anotações do responsável). Fica separada da IA.
                </div>

                {isEditingManual ? (
                  <textarea
                    className="w-full min-h-[320px] bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-blue-500/40"
                    value={ataManualValue}
                    onChange={(e) => setAtaManualValue(e.target.value)}
                    placeholder="Digite aqui a ATA manual / notas do responsável..."
                  />
                ) : (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {String(ataManualValue || "").trim() ? ataManualValue : "Sem ATA manual ainda."}
                  </div>
                )}
              </div>
            ) : (
              // tab === "acoes"
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs font-black text-slate-200 flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-300" />
                      Ações
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Da reunião + backlog pendente do <b>tipo</b> ({tipoSelecionado}).
                    </div>
                  </div>

                  <button
                    onClick={() => fetchAcoes(selecionada)}
                    className="text-[11px] font-black bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-xl"
                    disabled={loadingAcoes}
                  >
                    {loadingAcoes ? "Atualizando..." : "Atualizar"}
                  </button>
                </div>

                {/* Nova ação */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 mb-4">
                  <div className="text-[11px] font-black text-slate-300 uppercase mb-2">Nova ação</div>

                  <textarea
                    className="w-full bg-slate-900/40 border border-slate-800 rounded-2xl p-3 text-sm outline-none focus:ring-2 ring-blue-500/40 h-24"
                    placeholder="O que precisa ser feito?"
                    value={novaAcao.descricao}
                    onChange={(e) => setNovaAcao((p) => ({ ...p, descricao: e.target.value }))}
                  />

                  <div className="flex gap-2 mt-2">
                    <input
                      className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 ring-blue-500/40"
                      placeholder="Responsável"
                      value={novaAcao.responsavel}
                      onChange={(e) => setNovaAcao((p) => ({ ...p, responsavel: e.target.value }))}
                    />
                    <button
                      onClick={salvarAcao}
                      disabled={!novaAcao.descricao?.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2"
                    >
                      <Plus size={16} /> Criar
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 mt-2">
                    Tipo aplicado automaticamente: <b className="text-slate-200">{tipoSelecionado}</b>
                  </div>
                </div>

                {/* Tabs ações */}
                <div className="flex gap-2 mb-3">
                  <SmallPill active={acaoTab === "reuniao"} onClick={() => setAcaoTab("reuniao")}>
                    Da reunião
                  </SmallPill>
                  <SmallPill active={acaoTab === "tipo"} onClick={() => setAcaoTab("tipo")}>
                    Pendentes do tipo
                  </SmallPill>
                </div>

                {/* Listas */}
                {loadingAcoes ? (
                  <div className="text-slate-400 text-sm">Carregando ações...</div>
                ) : acaoTab === "reuniao" ? (
                  (acoesDaReuniao || []).length === 0 ? (
                    <div className="text-slate-400 text-sm">Nenhuma ação cadastrada nesta reunião.</div>
                  ) : (
                    <div className="space-y-2">
                      {(acoesDaReuniao || []).map((a) => (
                        <AcaoCard key={a.id} acao={a} onToggle={() => toggleStatusAcao(a)} />
                      ))}
                    </div>
                  )
                ) : (acoesPendentesTipo || []).length === 0 ? (
                  <div className="text-slate-400 text-sm">Nenhuma ação pendente para este tipo.</div>
                ) : (
                  <div className="space-y-2">
                    {(acoesPendentesTipo || []).map((a) => (
                      <AcaoCard
                        key={a.id}
                        acao={a}
                        onToggle={() => toggleStatusAcao(a)}
                        subtitle={`Origem: ${a.data_criacao ? toBRDate(a.data_criacao) : "-"}`}
                        tone="amber"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MODAL: LIBERAÇÃO ADMIN */}
        {showUnlock && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-[460px] bg-slate-950 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Lock size={18} /> Liberação de Regravação
              </h3>
              <p className="text-xs text-slate-400 mt-2">
                Esta reunião já foi gravada/processada (ou já existe ATA). Para gravar novamente, confirme a{" "}
                <b>senha do Administrador</b>.
              </p>

              <input
                type="password"
                className="w-full mt-4 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-blue-500/40"
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
                  className="px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-white text-xs font-black hover:bg-slate-800"
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

              <div className="text-[11px] text-slate-500 mt-4">
                Se ainda der “senha inválida”, é quase certo que o <b>login salvo</b> (inove_login/login) não está batendo
                com <b>usuarios_aprovadores.login/email</b> ou a senha no banco está diferente (hash).
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

/* =========================
   UI components
========================= */
function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition-colors ${
        active
          ? "bg-blue-600/20 border-blue-500/30 text-blue-100"
          : "bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-800/40"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function SmallPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-3 py-2 rounded-xl font-black border transition-colors ${
        active
          ? "bg-blue-600/20 border-blue-500/30 text-blue-100"
          : "bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-800/40"
      }`}
    >
      {children}
    </button>
  );
}

function AcaoCard({ acao, onToggle, subtitle, tone = "green" }) {
  const done = String(acao?.status || "").toLowerCase() === "concluída" || String(acao?.status || "").toLowerCase() === "concluida";

  const toneCls =
    tone === "amber"
      ? "border-amber-500/20 bg-amber-600/10"
      : "border-emerald-500/20 bg-emerald-600/10";

  return (
    <div className={`p-4 rounded-2xl border ${toneCls}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={done} onChange={onToggle} className="mt-1 w-4 h-4" />
        <div className="flex-1">
          <div className={`text-sm font-bold ${done ? "line-through text-slate-400" : "text-slate-100"}`}>
            {acao?.descricao || "-"}
          </div>
          <div className="text-[11px] text-slate-300 mt-1">
            <span className="font-black">Responsável:</span> {acao?.responsavel || "Geral"}
            {acao?.data_vencimento ? <span className="text-slate-400"> • Venc: {toBRDate(acao.data_vencimento)}</span> : null}
          </div>
          {subtitle ? <div className="text-[11px] text-slate-400 mt-1">{subtitle}</div> : null}
          {acao?.observacao ? <div className="text-[11px] text-slate-400 mt-2">Obs: {acao.observacao}</div> : null}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

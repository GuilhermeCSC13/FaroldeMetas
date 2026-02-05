// src/pages/Copiloto.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase, supabaseInove } from "../supabaseClient";
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
  UploadCloud,
  File as FileIcon,
  Check,
  Loader2,
  Trash2,
  User,
  Clock,
  Image,
  MessageSquare,
  Paperclip,
  Download,
  // Ícones para a chamada
  Crown,
  UserCheck,
  CheckCircle2,
  XCircle,
  Mail,
  Users
} from "lucide-react";
import { useRecording } from "../context/RecordingContext";
import ModalDetalhesAcao from "../components/tatico/ModalDetalhesAcao";

/* =========================
   Helpers
========================= */

function nowIso() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 19);
}

function todayISODate() {
  return nowIso().slice(0, 10);
}

function toBRDate(dt) {
  try {
    if (!dt) return "-";
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return "-";
  }
}

function toBRDateTime(dt) {
  try {
    if (!dt) return "-";
    return new Date(dt).toLocaleString("pt-BR", { timeZone: "UTC" });
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

function buildNomeSobrenome(u) {
  if (!u) return "";
  const nomeCompleto = String(u?.nome_completo || "").trim();
  const nome = String(u?.nome || "").trim();
  const sobrenome = String(u?.sobrenome || "").trim();

  if (nomeCompleto) return nomeCompleto;
  if (nome && sobrenome) return `${nome} ${sobrenome}`;
  if (nome) return nome;
  return u.email || "-";
}

function sanitizeFileName(name) {
  return String(name || "").replace(/[^a-zA-Z0-9.]/g, "");
}

function fileKind(file) {
  const t = String(file?.type || "").toLowerCase();
  const n = String(file?.name || "").toLowerCase();

  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".doc") || n.endsWith(".docx")) return "doc";
  if (n.endsWith(".xls") || n.endsWith(".xlsx")) return "xls";
  if (n.endsWith(".ppt") || n.endsWith(".pptx")) return "ppt";
  return "file";
}

function extractTime(dateString) {
  if (!dateString) return "";
  const s = String(dateString);
  if (s.length <= 8 && s.includes(":")) return s.substring(0, 5);

  try {
    const d = new Date(dateString);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString("pt-BR", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch {
    // ignore
  }
  return "";
}

function meetingInicioFimLabel(r) {
  const data = toBRDate(r?.data_hora);
  const ini = extractTime(r?.horario_inicio) || extractTime(r?.data_hora);
  const fim = extractTime(r?.horario_fim);
  if (!r?.data_hora && !ini && !fim) return "-";
  const parts = [];
  if (data && data !== "-") parts.push(data);
  if (ini) parts.push(`Início ${ini}`);
  if (fim) parts.push(`Término ${fim}`);
  return parts.join(" • ") || "-";
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/* =========================
   Page Component
========================= */
export default function Copiloto() {
  const { isRecording, isProcessing, timer, startRecording, stopRecording, current } =
    useRecording();

  // Filtros Esquerda
  const [dataFiltro, setDataFiltro] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [busca, setBusca] = useState("");

  // Lista de Reuniões
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [nomeTipoReuniao, setNomeTipoReuniao] = useState("");

  // ==========================================
  // ESTADOS DA CHAMADA (PRESENÇA)
  // ==========================================
  const [participantesLista, setParticipantesLista] = useState([]);
  const [organizadorDetalhes, setOrganizadorDetalhes] = useState(null);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);

  // Tabs Direita
  const [tab, setTab] = useState("presenca"); // presenca | acoes | ata_principal | ata_manual | materiais

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

  // Criação de Ação
  const [novaAcao, setNovaAcao] = useState({
    descricao: "",
    observacao: "",
    responsavelId: "",
    vencimento: "",
  });
  const [novasEvidenciasAcao, setNovasEvidenciasAcao] = useState([]); 
  const [creatingAcao, setCreatingAcao] = useState(false);

  // Responsáveis (para criar ação)
  const [listaResponsaveis, setListaResponsaveis] = useState([]);
  const [loadingResponsaveis, setLoadingResponsaveis] = useState(false);

  // Usuário Logado
  const [currentUser, setCurrentUser] = useState(null);

  // Autocomplete Responsável da Ação
  const [responsavelQuery, setResponsavelQuery] = useState("");
  const [respOpen, setRespOpen] = useState(false);

  // Modais
  const [acaoSelecionada, setAcaoSelecionada] = useState(null); // Detalhes da Ação
  const [showUnlock, setShowUnlock] = useState(false); // Reabrir Reunião
  const [senhaAdm, setSenhaAdm] = useState("");

  // Refs e SafeSet
  const isMountedRef = useRef(false);
  const safeSet = (fn) => {
    if (isMountedRef.current) fn();
  };

  /* =========================
     Lifecycle & Listeners
  ========================= */

  // Colar print (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e) => {
      if (!selecionada?.id || tab !== "acoes" || acaoSelecionada) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          const file = new File([blob], `print_${Date.now()}.png`, { type: blob.type });
          files.push(file);
        }
      }

      if (files.length > 0) {
        setNovasEvidenciasAcao((prev) => [...(prev || []), ...files]);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [selecionada, tab, acaoSelecionada]);

  // Carregar Dados Iniciais
  useEffect(() => {
    isMountedRef.current = true;
    fetchReunioes();

    (async () => {
      try {
        safeSet(() => setLoadingResponsaveis(true));
        const storedUser = localStorage.getItem("usuario_externo");
        if (storedUser) safeSet(() => setCurrentUser(JSON.parse(storedUser)));

        const { data, error } = await supabaseInove
          .from("usuarios_aprovadores")
          .select("id, nome, sobrenome, nome_completo, login, email, ativo, nivel, status_cadastro")
          .eq("ativo", true)
          .order("nome_completo", { ascending: true });

        if (!error) safeSet(() => setListaResponsaveis(data || []));
      } finally {
        safeSet(() => setLoadingResponsaveis(false));
      }
    })();

    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchReunioes();
  }, [dataFiltro]);

  // Ao selecionar uma reunião
  useEffect(() => {
    if (!selecionada?.id) return;

    // Reset para a aba de Presença
    setTab("presenca"); 
    
    // Carregar dados
    carregarAtas(selecionada);
    fetchAcoes(selecionada);
    fetchParticipantesEOrganizador(selecionada); // Lógica de Chamada

    // Reset formulários
    setAcaoTab("reuniao");
    setNovaAcao({ descricao: "", observacao: "", responsavelId: "", vencimento: "" });
    setResponsavelQuery("");
    setNovasEvidenciasAcao([]);
    setRespOpen(false);
  }, [selecionada?.id]);

  /* =========================
     Funções de Dados (Fetch)
  ========================= */

  const fetchReunioes = async () => {
    const { data, error } = await supabase
      .from("reunioes")
      .select("*")
      .gte("data_hora", `${dataFiltro}T00:00:00`)
      .lte("data_hora", `${dataFiltro}T23:59:59`)
      .order("data_hora", { ascending: true });

    if (error) {
      console.error("fetchReunioes error:", error);
      return;
    }

    const rows = data || [];
    safeSet(() => setReunioes(rows));

    // Manter seleção atualizada se existir
    if (selecionada?.id) {
      const atualizada = rows.find((r) => r.id === selecionada.id) || null;
      if (atualizada) safeSet(() => setSelecionada(atualizada));
      else safeSet(() => setSelecionada(null));
    }

    // Se estiver gravando, focar na reunião atual
    if (isRecording && current?.reuniaoId) {
      const found = rows.find((r) => r.id === current.reuniaoId);
      if (found) safeSet(() => setSelecionada(found));
    }
  };

  // ----------------------------------------------------
  // LOGICA PRINCIPAL DA CHAMADA (CORRIGIDA)
  // ----------------------------------------------------
  const fetchParticipantesEOrganizador = async (r) => {
    if (!r?.id) return;
    setLoadingParticipantes(true);
    setParticipantesLista([]);
    setOrganizadorDetalhes(null);

    try {
      // 1. Organizador
      let orgId = r.responsavel_id;
      // Se não tem na reunião, tenta pegar do tipo
      if (!orgId && r.tipo_reuniao_id) {
        const { data: tp } = await supabase
          .from("tipos_reuniao")
          .select("responsavel_id")
          .eq("id", r.tipo_reuniao_id)
          .maybeSingle();
        if (tp?.responsavel_id) orgId = tp.responsavel_id;
      }

      if (orgId) {
        const { data: org, error: errOrg } = await supabaseInove
          .from("usuarios_aprovadores")
          .select("id, nome, sobrenome, email")
          .eq("id", orgId)
          .maybeSingle();
        if (!errOrg && org) setOrganizadorDetalhes(org);
      }

      // 2. Participantes JÁ SALVOS na reunião
      const { data: salvosReuniao } = await supabase
        .from("participantes_reuniao")
        .select("*")
        .eq("reuniao_id", r.id);

      // 3. Participantes PADRÃO do Tipo (se houver tipo)
      let padraoTipo = [];
      if (r.tipo_reuniao_id) {
        const { data: defs } = await supabase
          .from("participantes_tipo_reuniao")
          .select("*")
          .eq("tipo_reuniao_id", r.tipo_reuniao_id);
        padraoTipo = defs || [];
      }

      // 4. MESCLAGEM INTELIGENTE
      const listaFinal = [];

      // Mapear os SALVOS que possuem usuario_id (Sistema) vs Manuais
      const salvosComUser = new Map(); // key: usuario_id
      const salvosManuais = [];        // array

      (salvosReuniao || []).forEach(p => {
        if (p.usuario_id) {
          salvosComUser.set(String(p.usuario_id), p);
        } else {
          salvosManuais.push(p);
        }
      });

      // A. Adicionar do Padrão do Tipo
      padraoTipo.forEach(padrao => {
        const salvo = salvosComUser.get(String(padrao.usuario_id));
        if (salvo) {
          // Já existe salvo na reunião (marcou presença ou falta)
          listaFinal.push(salvo);
          salvosComUser.delete(String(padrao.usuario_id)); // remove do map
        } else {
          // Ainda não existe na reunião -> criar objeto visual temporário
          listaFinal.push({
            id: `temp_${padrao.usuario_id}`, 
            reuniao_id: r.id,
            usuario_id: padrao.usuario_id,
            nome: padrao.nome,
            email: padrao.email,
            presente: false, 
            is_temp: true
          });
        }
      });

      // B. Adicionar quem sobrou do sistema (adicionado extra na reunião)
      salvosComUser.forEach(salvo => listaFinal.push(salvo));

      // C. Adicionar TODOS os manuais (Sem ID de sistema)
      // ISSO GARANTE QUE PARTICIPANTES DA REUNIÃO GERAL APAREÇAM
      salvosManuais.forEach(salvo => listaFinal.push(salvo));

      // Ordenar por nome
      listaFinal.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

      setParticipantesLista(listaFinal);

    } finally {
      setLoadingParticipantes(false);
    }
  };

  const togglePresenca = async (participante) => {
    if (!selecionada?.id) return;
    
    const novoStatus = !participante.presente;

    // UI Otimista
    setParticipantesLista(prev => prev.map(p => 
      (p.id === participante.id || (p.is_temp && p.usuario_id === participante.usuario_id))
        ? { ...p, presente: novoStatus } 
        : p
    ));

    if (participante.is_temp) {
      // INSERT
      const payload = {
        reuniao_id: selecionada.id,
        usuario_id: participante.usuario_id,
        nome: participante.nome,
        email: participante.email,
        presente: novoStatus,
        created_at: nowIso()
      };

      const { data, error } = await supabase
        .from("participantes_reuniao")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Erro insert participante", error);
        // Rollback
        setParticipantesLista(prev => prev.map(p => 
          p.usuario_id === participante.usuario_id ? { ...p, presente: !novoStatus } : p
        ));
      } else {
        // Atualiza ID real na lista
        setParticipantesLista(prev => prev.map(p => 
          p.usuario_id === participante.usuario_id ? { ...data, is_temp: false } : p
        ));
      }

    } else {
      // UPDATE
      const { error } = await supabase
        .from("participantes_reuniao")
        .update({ presente: novoStatus })
        .eq("id", participante.id);

      if (error) {
        console.error("Erro update participante", error);
        // Rollback
        setParticipantesLista(prev => prev.map(p => 
          p.id === participante.id ? { ...p, presente: !novoStatus } : p
        ));
      }
    }
  };

  // Carregar Atas
  const carregarAtas = async (r) => {
    safeSet(() => {
      setAtaManual(String(r?.ata_manual || "").trim());
      setEditAtaManual(false);
      setAtaPrincipal("");
      setNomeTipoReuniao("");
    });

    if (r?.tipo_reuniao_id) {
      const { data } = await supabase
        .from("tipos_reuniao")
        .select("ata_principal, nome")
        .eq("id", r.tipo_reuniao_id)
        .maybeSingle();

      if (data) {
        safeSet(() => setAtaPrincipal(String(data.ata_principal || "").trim()));
        safeSet(() => setNomeTipoReuniao(data.nome || ""));
      }
    } else if (r?.tipo_reuniao) {
      safeSet(() => setNomeTipoReuniao(r.tipo_reuniao));
    }
  };

  const salvarAtaManual = async () => {
    if (!selecionada?.id) return;
    const { error } = await supabase
      .from("reunioes")
      .update({ ata_manual: ataManual, updated_at: nowIso() })
      .eq("id", selecionada.id);

    if (error) return alert("Erro ao salvar Ata: " + error.message);
    setEditAtaManual(false);
    fetchReunioes();
  };

  /* =========================
     Gravação
  ========================= */
  const onStart = async () => {
    if (!selecionada?.id) return alert("Selecione uma reunião.");
    if (isRecording) return;
    if (String(selecionada?.status || "").trim() === "Realizada") {
      return alert("Reunião já REALIZADA. Use 'Reabrir (ADM)'.");
    }

    try {
      await startRecording({ reuniaoId: selecionada.id, reuniaoTitulo: selecionada.titulo });
      await fetchReunioes();
    } catch (e) {
      console.error("startRecording:", e);
      alert("Erro ao iniciar gravação.");
    }
  };

  const onStop = async () => {
    try {
      await stopRecording();
      if (selecionada?.id) {
        await supabase.from("reunioes").update({ status: "Realizada" }).eq("id", selecionada.id);
        
        // Enfileirar processamento
        const bucket = current?.storageBucket || "gravacoes";
        const prefix = current?.storagePrefix || `reunioes/${selecionada.id}`;
        await supabase.from("reuniao_processing_queue").insert([{
            reuniao_id: selecionada.id,
            job_type: "BACKFILL_COMPILE_ATA",
            status: "PENDENTE",
            attempts: 0,
            next_run_at: nowIso(),
            storage_bucket: bucket,
            storage_prefix: prefix,
            result: {},
        }]);
      }
      await fetchReunioes();
      if (selecionada?.id) await fetchAcoes(selecionada);
    } catch (e) {
      console.error("stopRecording:", e);
      alert("Erro ao encerrar gravação.");
    }
  };

  const validarSenhaAdm = async () => {
    if (!selecionada?.id || !senhaAdm) return alert("Informe a senha.");
    const { data } = await supabaseInove
      .from("usuarios_aprovadores")
      .select("id")
      .eq("senha", senhaAdm.trim())
      .eq("nivel", "Administrador")
      .eq("ativo", true)
      .maybeSingle();

    if (!data?.id) return alert("Senha inválida.");

    await supabase.from("reunioes").update({ status: "Pendente" }).eq("id", selecionada.id);
    setShowUnlock(false);
    setSenhaAdm("");
    await fetchReunioes();
  };

  /* =========================
     Ações & Evidências
  ========================= */
  const fetchAcoes = async (r) => {
    if (!r?.id) return;
    safeSet(() => setLoadingAcoes(true));
    try {
      const { data: daReuniao } = await supabase
        .from("acoes")
        .select("*")
        .eq("reuniao_id", r.id)
        .order("created_at", { ascending: false });

      const tipoId = r.tipo_reuniao_id;
      let pendTipo = [], concluidasDesde = [];

      if (tipoId) {
        const { data: pend } = await supabase
          .from("acoes")
          .select("*")
          .eq("tipo_reuniao_id", tipoId)
          .in("status", ["Aberta", "Pendente", "PENDENTE"])
          .or(`reuniao_id.is.null,reuniao_id.neq.${r.id}`)
          .order("created_at", { ascending: false })
          .limit(500);
        pendTipo = pend || [];

        if (r.data_hora) {
          const { data: ultima } = await supabase
            .from("reunioes")
            .select("id, data_hora")
            .eq("tipo_reuniao_id", tipoId)
            .lt("data_hora", r.data_hora)
            .order("data_hora", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (ultima?.data_hora) {
            const { data: concl } = await supabase
              .from("acoes")
              .select("*")
              .eq("tipo_reuniao_id", tipoId)
              .in("status", ["Concluída", "Concluida"])
              .gt("data_conclusao", ultima.data_hora)
              .order("data_conclusao", { ascending: false });
            concluidasDesde = concl || [];
          }
        }
      }

      safeSet(() => {
        setAcoesDaReuniao(daReuniao || []);
        setAcoesPendentesTipo(pendTipo);
        setAcoesConcluidasDesdeUltima(concluidasDesde);
      });
    } finally {
      safeSet(() => setLoadingAcoes(false));
    }
  };

  const uploadEvidencias = async (acaoId, files) => {
    const urls = [];
    for (const file of files) {
      const fileName = `acao-${acaoId}-${Date.now()}-${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage.from("evidencias").upload(fileName, file);
      if (!error) {
        const { data } = supabase.storage.from("evidencias").getPublicUrl(fileName);
        if (data?.publicUrl) urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const salvarAcao = async () => {
    if (!selecionada?.id || creatingAcao) return;
    if (!novaAcao.descricao || !novaAcao.responsavelId || !novaAcao.vencimento) return alert("Preencha campos.");
    if (novasEvidenciasAcao.length === 0) return alert("Anexe evidências.");

    setCreatingAcao(true);
    try {
      const respRow = listaResponsaveis.find(u => String(u.login) === novaAcao.responsavelId || String(u.id) === novaAcao.responsavelId);
      
      let criadorNome = "Sistema", criadorId = null;
      const stored = localStorage.getItem("usuario_externo");
      if (stored) {
        const u = JSON.parse(stored);
        criadorId = u.id;
        criadorNome = buildNomeSobrenome(u);
      }

      const payload = {
        descricao: novaAcao.descricao,
        observacao: novaAcao.observacao,
        status: "Aberta",
        reuniao_id: selecionada.id,
        tipo_reuniao_id: selecionada.tipo_reuniao_id,
        tipo_reuniao: nomeTipoReuniao || selecionada.tipo_reuniao,
        responsavel_aprovador_id: respRow?.id,
        responsavel_nome: buildNomeSobrenome(respRow),
        criado_por_aprovador_id: criadorId,
        criado_por_nome: criadorNome,
        data_vencimento: novaAcao.vencimento,
        data_abertura: todayISODate(),
        data_criacao: nowIso(),
        created_at: nowIso(),
        fotos: [], fotos_acao: []
      };

      const { data, error } = await supabase.from("acoes").insert([payload]).select().single();
      if (error) throw error;

      const urls = await uploadEvidencias(data.id, novasEvidenciasAcao);
      await supabase.from("acoes").update({ fotos_acao: urls, fotos: urls, evidencia_url: urls[0] }).eq("id", data.id);

      setNovaAcao({ descricao: "", observacao: "", responsavelId: "", vencimento: "" });
      setNovasEvidenciasAcao([]);
      setResponsavelQuery("");
      setTab("acoes");
      setAcaoTab("reuniao");
      fetchAcoes(selecionada);
      alert("Ação criada!");
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setCreatingAcao(false);
    }
  };

  const responsaveisFiltrados = useMemo(() => {
    const q = responsavelQuery.toLowerCase().trim();
    if (q.length < 2) return [];
    return listaResponsaveis.filter(u => buildNomeSobrenome(u).toLowerCase().includes(q) || u.login?.toLowerCase().includes(q)).slice(0, 10);
  }, [responsavelQuery, listaResponsaveis]);

  const onAddEvidencias = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setNovasEvidenciasAcao((prev) => [...(prev || []), ...files]);
  };

  const removerEvidencia = (id) => {
    setNovasEvidenciasAcao((prev) => prev.filter((_,i) => i !== id));
  };

  const previews = useMemo(() => novasEvidenciasAcao.map((f, i) => ({
    id: i, file: f, kind: fileKind(f), url: (fileKind(f)==='image'||fileKind(f)==='video')?URL.createObjectURL(f):null, name: f.name
  })), [novasEvidenciasAcao]);

  // UI Computed
  const reunioesFiltradas = useMemo(() => reunioes.filter(r => (r.titulo||"").toLowerCase().includes(busca.toLowerCase())), [reunioes, busca]);
  const statusBadgeClass = (s) => {
    const v = norm(s);
    if (v==="REALIZADA") return "bg-emerald-600/15 text-emerald-700 border-emerald-200";
    if (v==="EM ANDAMENTO") return "bg-blue-600/15 text-blue-700 border-blue-200";
    return "bg-slate-600/10 text-slate-700 border-slate-200";
  };
  const listaAtiva = acaoTab==="reuniao" ? acoesDaReuniao : acaoTab==="backlog" ? acoesPendentesTipo : acoesConcluidasDesdeUltima;
  const materiaisReuniao = safeArray(selecionada?.materiais);

  return (
    <Layout>
      <div className="h-screen bg-[#f6f8fc] text-slate-900 flex overflow-hidden">
        {/* ESQUERDA: LISTA */}
        <div className="w-[420px] min-w-[380px] max-w-[460px] flex flex-col p-5 border-r border-slate-200 bg-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm"><Bot size={20} /></div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 font-extrabold">Assistente</div>
              <h1 className="text-lg font-black tracking-tight truncate">Copiloto de Reuniões</h1>
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
              <input type="date" className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 ring-blue-500/30" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
            </div>
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input type="text" placeholder="Buscar..." className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 ring-blue-500/30" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-y-auto">
            {reunioesFiltradas.length === 0 && <div className="p-6 text-xs text-slate-500">Nenhuma reunião.</div>}
            {reunioesFiltradas.map(r => (
              <button key={r.id} onClick={() => !isRecording && setSelecionada(r)} className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selecionada?.id === r.id ? "bg-blue-50 border-l-4 border-l-blue-600" : "border-l-4 border-l-transparent"} ${isRecording?"opacity-50":""}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-black text-xs truncate">{r.titulo || "Sem título"}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{meetingInicioFimLabel(r)}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-lg font-extrabold uppercase border ${statusBadgeClass(r.status)}`}>{r.status||"Pendente"}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase">Tempo de sessão</div>
              <div className="text-lg font-black font-mono">{secondsToMMSS(timer)}</div>
            </div>
            {isProcessing ? <span className="text-xs font-bold text-blue-700 animate-pulse">PROCESSANDO...</span> : isRecording ? 
              <button onClick={onStop} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs">ENCERRAR</button> :
              <button onClick={onStart} disabled={!selecionada || norm(selecionada?.status)==="REALIZADA"} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-xs disabled:opacity-50">INICIAR GRAVAÇÃO</button>
            }
          </div>
        </div>

        {/* DIREITA: DETALHES */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 flex justify-between items-start">
            <div>
              <div className="text-xl font-black truncate">{selecionada?.titulo || "Selecione uma reunião"}</div>
              <div className="mt-1 text-xs text-slate-500">{selecionada?.id ? meetingInicioFimLabel(selecionada) : "-"}</div>
              {selecionada?.id && <div className={`mt-2 inline-block text-[10px] px-2 py-1 rounded-lg font-extrabold uppercase border ${statusBadgeClass(selecionada.status)}`}>{selecionada.status||"Pendente"}</div>}
            </div>
            <div className="flex gap-2">
              {norm(selecionada?.status)==="REALIZADA" && <button onClick={()=>setShowUnlock(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold text-xs"><Lock size={16}/> Reabrir (ADM)</button>}
              {selecionada?.id && <button onClick={()=>fetchReunioes()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs"><RefreshCw size={16}/> Atualizar</button>}
            </div>
          </div>

          {/* TABS NAVEGAÇÃO */}
          <div className="flex flex-wrap gap-2 mb-4">
            <TabButton active={tab === "presenca"} onClick={() => setTab("presenca")} icon={<UserCheck size={16} />}>Lista de Presença</TabButton>
            <TabButton active={tab === "acoes"} onClick={() => setTab("acoes")} icon={<ClipboardList size={16} />}>Ações</TabButton>
            <TabButton active={tab === "ata_principal"} onClick={() => setTab("ata_principal")} icon={<FileText size={16} />}>Pauta</TabButton>
            <TabButton active={tab === "ata_manual"} onClick={() => setTab("ata_manual")} icon={<StickyNote size={16} />}>Pauta Manual</TabButton>
            <TabButton active={tab === "materiais"} onClick={() => setTab("materiais")} icon={<Paperclip size={16} />}>Materiais</TabButton>
          </div>

          {!selecionada?.id ? (
             <div className="p-8 text-center text-slate-500">Selecione uma reunião.</div>
          ) : tab === "presenca" ? (
            /* ==================== CONTEÚDO TAB PRESENÇA ==================== */
            <div className="flex flex-col gap-4">
               {/* Organizador */}
               <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Crown size={16} className="text-amber-500" />
                  <span className="text-xs font-black uppercase text-slate-500">Organizador (Responsável)</span>
                </div>
                {organizadorDetalhes ? (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-center gap-3 w-full md:w-1/2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-200 shrink-0 uppercase">
                      {organizadorDetalhes.nome.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">
                        {organizadorDetalhes.nome} {organizadorDetalhes.sobrenome}
                      </div>
                      <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                        <Mail size={10} /> {organizadorDetalhes.email}
                      </div>
                    </div>
                  </div>
                ) : (
                   <div className="text-xs text-slate-400 italic">Organizador não definido.</div>
                )}
              </div>

              {/* Lista Participantes */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-blue-600" />
                    <span className="text-xs font-black uppercase text-slate-500">Lista de Chamada</span>
                  </div>
                  <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                    {participantesLista.filter(p => p.presente).length} / {participantesLista.length} presentes
                  </span>
                </div>

                {loadingParticipantes ? (
                  <div className="text-xs text-slate-400">Carregando chamada...</div>
                ) : participantesLista.length === 0 ? (
                  <div className="text-xs text-slate-400 italic p-4 border border-dashed rounded-xl text-center">
                    Nenhum participante vinculado.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {participantesLista.map((p) => (
                      <button
                        key={p.id || `manual-${p.nome}-${Math.random()}`}
                        onClick={() => togglePresenca(p)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all group text-left ${
                          p.presente 
                            ? "bg-green-50 border-green-200 shadow-sm" 
                            : "bg-white border-slate-100 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold uppercase shrink-0 border transition-colors ${
                            p.presente 
                              ? "bg-green-100 text-green-700 border-green-200" 
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}>
                            {p.nome ? p.nome.charAt(0) : "?"}
                          </div>
                          <div className="min-w-0">
                            <div className={`text-sm font-bold truncate ${p.presente ? "text-green-800" : "text-slate-700"}`}>
                              {p.nome || "Sem nome"}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{p.email || "-"}</div>
                          </div>
                        </div>
                        
                        <div className="shrink-0 ml-2">
                          {p.presente ? (
                            <CheckCircle2 size={20} className="text-green-500" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-slate-200 group-hover:border-slate-300" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : tab === "acoes" ? (
             /* CONTEÚDO TAB AÇÕES */
             <div className="space-y-4">
               <div className="bg-white border border-slate-200 rounded-2xl p-4">
                 <div className="flex flex-wrap gap-2">
                   <Pill active={acaoTab==="reuniao"} onClick={()=>setAcaoTab("reuniao")}>Da reunião ({acoesDaReuniao.length})</Pill>
                   <Pill active={acaoTab==="backlog"} onClick={()=>setAcaoTab("backlog")}>Pendências do tipo ({acoesPendentesTipo.length})</Pill>
                   <Pill active={acaoTab==="desde_ultima"} onClick={()=>setAcaoTab("desde_ultima")}>Concluídas recente ({acoesConcluidasDesdeUltima.length})</Pill>
                 </div>
               </div>
               <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="space-y-3">
                    {listaAtiva.length===0 && <div className="text-sm text-slate-500">Nenhuma ação.</div>}
                    {listaAtiva.map(a => <AcaoCard key={a.id} acao={a} onClick={()=>setAcaoSelecionada(a)} />)}
                  </div>
               </div>
               <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4 font-black text-sm text-blue-800"><Plus size={16}/> Nova Ação</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="border p-2 rounded-xl text-sm outline-none focus:ring-2 md:col-span-2" placeholder="Nome da Ação" value={novaAcao.descricao} onChange={e=>setNovaAcao({...novaAcao, descricao:e.target.value})} />
                    <textarea className="border p-2 rounded-xl text-sm outline-none focus:ring-2 md:col-span-2" rows={2} placeholder="Observação..." value={novaAcao.observacao} onChange={e=>setNovaAcao({...novaAcao, observacao:e.target.value})} />
                    <div className="relative">
                      <input className="w-full border p-2 rounded-xl text-sm outline-none" placeholder="Responsável..." value={responsavelQuery} onChange={e=>{setResponsavelQuery(e.target.value);setRespOpen(true)}} onFocus={()=>setRespOpen(true)} />
                      {respOpen && responsaveisFiltrados.length>0 && <div className="absolute z-10 w-full bg-white border shadow-lg rounded-xl mt-1 overflow-hidden">{responsaveisFiltrados.map(u=><div key={u.id} className="p-2 hover:bg-slate-50 text-sm cursor-pointer" onMouseDown={()=>selecionarResponsavel(u)}>{u.nome}</div>)}</div>}
                    </div>
                    <input type="date" className="border p-2 rounded-xl text-sm outline-none" value={novaAcao.vencimento} onChange={e=>setNovaAcao({...novaAcao, vencimento:e.target.value})} />
                    <div className="md:col-span-2 flex items-center gap-2">
                       <label className="cursor-pointer bg-slate-50 px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 hover:bg-slate-100"><UploadCloud size={14}/> Anexar <input type="file" multiple className="hidden" onChange={e=>onAddEvidencias(e.target.files)} /></label>
                       <span className="text-xs text-slate-400">{novasEvidenciasAcao.length} arquivos</span>
                    </div>
                  </div>
                  <button onClick={salvarAcao} disabled={creatingAcao} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold w-full md:w-auto">{creatingAcao?"Salvando...":"Salvar Ação"}</button>
               </div>
             </div>
          ) : tab === "ata_principal" ? (
             <div className="bg-white border border-slate-200 rounded-2xl p-5 whitespace-pre-wrap text-sm">{ataPrincipal||"Sem pauta configurada."}</div>
          ) : tab === "ata_manual" ? (
             <div className="bg-white border border-slate-200 rounded-2xl p-5">
               <div className="flex justify-between mb-3">
                 <div className="font-black text-sm flex gap-2"><StickyNote size={16}/> Pauta Manual</div>
                 {!editAtaManual ? <button onClick={()=>setEditAtaManual(true)} className="text-xs font-bold text-blue-600">Editar</button> : <div className="flex gap-2"><button onClick={salvarAtaManual} className="text-xs font-bold text-green-600">Salvar</button><button onClick={()=>setEditAtaManual(false)} className="text-xs font-bold text-red-600">Cancelar</button></div>}
               </div>
               {editAtaManual ? <textarea className="w-full border rounded-xl p-3 text-sm" rows={10} value={ataManual} onChange={e=>setAtaManual(e.target.value)} /> : <div className="whitespace-pre-wrap text-sm">{ataManual||"Vazio."}</div>}
             </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="font-black text-sm mb-3 flex gap-2"><Paperclip size={16}/> Materiais ({materiaisReuniao.length})</div>
              {materiaisReuniao.map((m,i)=>(
                 <div key={i} className="flex justify-between items-center p-3 border rounded-xl mb-2">
                    <span className="text-sm truncate font-bold">{m.name||"Arquivo"}</span>
                    {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 flex gap-1"><Download size={14}/> Baixar</a>}
                 </div>
              ))}
              {materiaisReuniao.length===0 && <div className="text-xs text-slate-400">Nenhum material.</div>}
            </div>
          )}
        </div>
      </div>
      {acaoSelecionada && <ModalDetalhesAcao aberto={!!acaoSelecionada} acao={acaoSelecionada} status={acaoSelecionada?.status} onClose={()=>setAcaoSelecionada(null)} onAfterSave={()=>fetchAcoes(selecionada)} onAfterDelete={()=>fetchAcoes(selecionada)} onConcluir={async()=>{await supabase.from("acoes").update({status:"Concluída",data_conclusao:new Date().toISOString()}).eq("id",acaoSelecionada.id);fetchAcoes(selecionada)}} />}
      {showUnlock && <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-2xl w-[300px]"><div className="font-black mb-2">Senha ADM</div><input type="password" value={senhaAdm} onChange={e=>setSenhaAdm(e.target.value)} className="border w-full p-2 rounded-lg mb-3"/><button onClick={validarSenhaAdm} className="bg-red-600 text-white w-full py-2 rounded-lg font-bold text-xs">Confirmar</button><button onClick={()=>setShowUnlock(false)} className="mt-2 w-full text-xs text-slate-500">Cancelar</button></div></div>}
    </Layout>
  );
}

// Pequenos componentes visuais (mantidos inline para reduzir complexidade de arquivo)
function TabButton({active,onClick,icon,children}){return(<button onClick={onClick} className={`px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-2 transition-colors ${active?"bg-blue-600/10 border-blue-200 text-blue-800":"bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{icon}{children}</button>)}
function Pill({active,onClick,children}){return(<button onClick={onClick} className={`text-[12px] px-3 py-2 rounded-xl font-extrabold border transition-colors ${active?"bg-blue-600/10 border-blue-200 text-blue-800":"bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{children}</button>)}
function AcaoCard({acao,onClick}){
  const st=norm(acao?.status);const done=st==="CONCLUÍDA"||st==="CONCLUIDA";const excl=st==="EXCLUÍDA"||st==="EXCLUIDA";
  return(<button onClick={onClick} className={`w-full text-left p-4 rounded-2xl border shadow-sm ${excl?"opacity-50 grayscale bg-gray-50":"bg-white hover:bg-slate-50"}`}><div className="flex gap-3"><div className={`mt-1 w-2.5 h-2.5 rounded-full ${done?"bg-emerald-500":"bg-blue-500"}`}/><div><div className={`text-sm font-semibold ${done?"line-through text-slate-400":"text-slate-900"}`}>{acao.descricao}</div><div className="text-xs text-slate-500 mt-1 flex gap-2 items-center"><User size={10}/> {acao.responsavel_nome||acao.responsavel||"Geral"} {acao.data_vencimento && <span className="flex items-center gap-1 ml-2"><Clock size={10}/> {toBRDate(acao.data_vencimento)}</span>}</div></div></div></button>)
}
function MiniaturaArquivo({preview,onRemove}){ return <div className="relative w-12 h-12 bg-slate-100 border rounded flex items-center justify-center text-xs overflow-hidden group">{preview.kind==='image'?<img src={preview.url} className="w-full h-full object-cover"/>:preview.kind}<button onClick={onRemove} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100">x</button></div>}

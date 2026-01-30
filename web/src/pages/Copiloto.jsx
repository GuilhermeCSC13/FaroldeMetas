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
  ImageIcon,
  MessageSquare,
  Clock
} from "lucide-react";
import { useRecording } from "../context/RecordingContext";
import ModalDetalhesAcao from "../components/tatico/ModalDetalhesAcao";

/* =========================
   Helpers Seguros (Anti-Tela Branca)
========================= */
function nowIso() {
  return new Date().toISOString();
}
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}
function toBR(dt) {
  if (!dt) return "-";
  try {
    return new Date(dt).toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}
function formatDateSafe(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return null;
  }
}
function norm(s) {
  return String(s || "").trim().toUpperCase();
}
function secondsToMMSS(s) {
  const mm = Math.floor((s || 0) / 60).toString().padStart(2, "0");
  const ss = Math.floor((s || 0) % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function buildNomeSobrenome(u) {
  if (!u) return "";
  const nomeCompleto = String(u.nome_completo || "").trim();
  const nome = String(u.nome || "").trim();
  const sobrenome = String(u.sobrenome || "").trim();
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

/* =========================
   Page Component
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

  // filtros esquerda
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [busca, setBusca] = useState("");

  // reuniões
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [nomeTipoReuniao, setNomeTipoReuniao] = useState(""); 

  // tabs direita
  const [tab, setTab] = useState("acoes"); 
  const [ataPrincipal, setAtaPrincipal] = useState("");
  const [ataManual, setAtaManual] = useState("");
  const [editAtaManual, setEditAtaManual] = useState(false);

  // Ações
  const [loadingAcoes, setLoadingAcoes] = useState(false);
  const [acoesDaReuniao, setAcoesDaReuniao] = useState([]);
  const [acoesPendentesTipo, setAcoesPendentesTipo] = useState([]);
  const [acoesConcluidasDesdeUltima, setAcoesConcluidasDesdeUltima] = useState([]);
  const [acaoTab, setAcaoTab] = useState("reuniao");

  // Criação de Ação
  const [novaAcao, setNovaAcao] = useState({
    descricao: "",
    observacao: "",
    responsavelId: "",
    vencimento: "",
  });
  const [novasEvidenciasAcao, setNovasEvidenciasAcao] = useState([]);
  const [creatingAcao, setCreatingAcao] = useState(false);

  // Dados Auxiliares
  const [listaResponsaveis, setListaResponsaveis] = useState([]);
  const [loadingResponsaveis, setLoadingResponsaveis] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Autocomplete Responsável
  const [responsavelQuery, setResponsavelQuery] = useState("");
  const [respOpen, setRespOpen] = useState(false);

  // Modal e Admin
  const [acaoSelecionada, setAcaoSelecionada] = useState(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [senhaAdm, setSenhaAdm] = useState("");

  const isMountedRef = useRef(false);
  const safeSet = (fn) => { if (isMountedRef.current) fn(); };

  // --- INIT ---
  useEffect(() => {
    isMountedRef.current = true;
    fetchReunioes();

    // Carregar aprovadores e identificar usuário logado
    (async () => {
      try {
        safeSet(() => setLoadingResponsaveis(true));
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabaseInove
          .from("usuarios_aprovadores")
          .select("id, nome, sobrenome, nome_completo, login, email, ativo, nivel, status_cadastro")
          .eq("ativo", true)
          .order("nome_completo", { ascending: true });

        if (!error && data) {
          safeSet(() => setListaResponsaveis(data));
          
          if (user?.email) {
            const found = data.find(u => String(u.email || "").toLowerCase() === String(user.email).toLowerCase());
            if (found) safeSet(() => setCurrentUser(found));
            else safeSet(() => setCurrentUser({ email: user.email, nome: "Usuário", sobrenome: "", id: null }));
          }
        }
      } finally {
        safeSet(() => setLoadingResponsaveis(false));
      }
    })();

    return () => { isMountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchReunioes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFiltro]);

  // Ao trocar de reunião
  useEffect(() => {
    if (!selecionada?.id) return;

    carregarAtas(selecionada);
    fetchAcoes(selecionada);

    setTab("acoes");
    setAcaoTab("reuniao");
    // ✅ Resetar modal e formulários
    setAcaoSelecionada(null);
    setNovaAcao({ descricao: "", observacao: "", responsavelId: "", vencimento: "" });
    setResponsavelQuery("");
    setNovasEvidenciasAcao([]);
    setRespOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada?.id]);

  // --- FETCH DATA ---
  const fetchReunioes = async () => {
    const { data, error } = await supabase
      .from("reunioes")
      .select("*")
      .gte("data_hora", `${dataFiltro}T00:00:00`)
      .lte("data_hora", `${dataFiltro}T23:59:59`)
      .order("data_hora", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const rows = data || [];
    safeSet(() => setReunioes(rows));

    if (selecionada?.id) {
      const atualizada = rows.find((r) => r.id === selecionada.id) || null;
      safeSet(() => setSelecionada(atualizada));
    } else if (isRecording && current?.reuniaoId) {
      const found = rows.find((r) => r.id === current.reuniaoId);
      if (found) safeSet(() => setSelecionada(found));
    }
  };

  const carregarAtas = async (r) => {
    safeSet(() => {
      setAtaManual(String(r?.ata_manual || "").trim());
      setEditAtaManual(false);
      setAtaPrincipal("");
      setNomeTipoReuniao(""); // Reset
    });

    if (r?.tipo_reuniao_id) {
      // ✅ Busca o nome do tipo de reunião para salvar corretamente
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
        // Se não tem ID mas tem texto direto
        safeSet(() => setNomeTipoReuniao(r.tipo_reuniao));
    }
  };

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
      let pendTipo = [];
      let concluidasDesde = [];

      if (tipoId) {
        const { data: pend } = await supabase
          .from("acoes")
          .select("*")
          .eq("tipo_reuniao_id", tipoId)
          .in("status", ["Aberta", "Pendente", "PENDENTE"])
          .or(`reuniao_id.is.null,reuniao_id.neq.${r.id}`)
          .order("created_at", { ascending: false })
          .limit(100);
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
              .not("data_conclusao", "is", null)
              .gt("data_conclusao", ultima.data_hora)
              .order("data_conclusao", { ascending: false })
              .limit(100);
            concluidasDesde = concl || [];
          }
        }
      }

      safeSet(() => {
        setAcoesDaReuniao(daReuniao || []);
        setAcoesPendentesTipo(pendTipo);
        setAcoesConcluidasDesdeUltima(concluidasDesde);
      });
    } catch (e) {
      console.error(e);
    } finally {
      safeSet(() => setLoadingAcoes(false));
    }
  };

  // --- ACTIONS ---
  const salvarAcao = async () => {
    if (!selecionada?.id) return;
    if (creatingAcao) return;

    const descricao = String(novaAcao.descricao || "").trim();
    const observacao = String(novaAcao.observacao || "").trim();
    const responsavelId = String(novaAcao.responsavelId || "").trim();
    const vencimento = String(novaAcao.vencimento || "").trim();

    if (!descricao) return alert("Informe o Nome da Ação (Descrição).");
    if (!responsavelId) return alert("Selecione o responsável.");
    if (!vencimento) return alert("Informe o vencimento.");
    if ((novasEvidenciasAcao || []).length === 0) {
      return alert("Anexe pelo menos uma evidência (foto/vídeo/documento).");
    }

    setCreatingAcao(true);

    try {
      // 1. Identificar Responsável
      const respRow = (listaResponsaveis || []).find(
        (u) => String(u.login || "") === responsavelId || String(u.id) === responsavelId
      );
      const responsavelNome = buildNomeSobrenome(respRow);

      // 2. Identificar CRIADOR (Lógica Blindada)
      let criadorFinalId = currentUser?.id || null;
      let criadorFinalNome = buildNomeSobrenome(currentUser); // Pode vir "Usuário" se fallback

      // Se não tiver nome, tenta email. Se nem email, "Sistema"
      if (!criadorFinalNome || criadorFinalNome === "-") {
         criadorFinalNome = currentUser?.email || "Sistema";
      }

      // Se o currentUser estiver nulo (recarregou página), busca novamente
      if (!criadorFinalId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          criadorFinalNome = user.email; // Garante pelo menos o email
          
          // Tenta achar na lista em memória
          let found = (listaResponsaveis || []).find(u => String(u.email).toLowerCase() === String(user.email).toLowerCase());
          
          // Se não achou na lista, busca direto no banco (segurança extra)
          if (!found) {
             const { data: dbUser } = await supabaseInove
                .from("usuarios_aprovadores")
                .select("id, nome, sobrenome")
                .eq("email", user.email)
                .maybeSingle();
             if (dbUser) found = dbUser;
          }

          if (found) {
            criadorFinalId = found.id;
            criadorFinalNome = buildNomeSobrenome(found);
          }
        }
      }

      // 3. Payload Seguro
      const payloadCriacao = {
        descricao,
        observacao,
        status: "Aberta",
        reuniao_id: selecionada.id,
        // ✅ Salva o tipo da reunião (texto) além do ID
        tipo_reuniao_id: selecionada.tipo_reuniao_id || null,
        tipo_reuniao: nomeTipoReuniao || selecionada.tipo_reuniao || selecionada.tipo || "Geral",
        
        responsavel_id: null,
        responsavel_aprovador_id: respRow?.id ?? null,
        responsavel_nome: responsavelNome,

        // ✅ Quem criou (Agora vai correto)
        criado_por_aprovador_id: criadorFinalId,
        criado_por_nome: criadorFinalNome,
        
        data_vencimento: vencimento,
        data_abertura: todayISODate(),
        created_at: nowIso(),
        data_criacao: nowIso(),
        fotos_acao: [],
        fotos: [],
        evidencia_url: null,
      };

      const { data, error } = await supabase.from("acoes").insert([payloadCriacao]).select("*");
      if (error) throw new Error("Erro ao criar: " + error.message);

      const acaoId = data?.[0]?.id;
      if (!acaoId) throw new Error("ID não retornado.");

      // Upload
      const urls = await uploadEvidencias(acaoId, novasEvidenciasAcao);
      if (!urls.length) alert("Ação criada, mas falhou upload. Edite para tentar novamente.");
      else {
        await supabase.from("acoes").update({
          fotos_acao: urls,
          fotos: urls,
          evidencia_url: urls[0] || null
        }).eq("id", acaoId);
      }

      // Sucesso
      setNovaAcao({ descricao: "", observacao: "", responsavelId: "", vencimento: "" });
      setResponsavelQuery("");
      setNovasEvidenciasAcao([]);
      setRespOpen(false);
      
      await fetchAcoes(selecionada);
      alert("Ação criada com sucesso!");

    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingAcao(false);
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

  const salvarAtaManual = async () => {
    if (!selecionada?.id) return;
    const { error } = await supabase.from("reunioes").update({ ata_manual: ataManual, updated_at: nowIso() }).eq("id", selecionada.id);
    if (!error) {
      setEditAtaManual(false);
      fetchReunioes();
    } else {
      alert("Erro ao salvar ata.");
    }
  };

  const validarSenhaAdm = async () => {
    if (!senhaAdm) return alert("Informe senha.");
    const { data } = await supabaseInove.from("usuarios_aprovadores").select("id").eq("senha", senhaAdm).eq("nivel", "Administrador").eq("ativo", true).maybeSingle();
    
    if (data?.id) {
      await supabase.from("reunioes").update({ status: "Pendente" }).eq("id", selecionada.id);
      setShowUnlock(false);
      setSenhaAdm("");
      fetchReunioes();
    } else {
      alert("Senha inválida.");
    }
  };

  // --- UI COMPUTED ---
  const reunioesFiltradas = useMemo(() => {
    const q = busca.toLowerCase();
    return (reunioes || []).filter(r => (r.titulo || "").toLowerCase().includes(q));
  }, [reunioes, busca]);

  const listaAtiva = acaoTab === "reuniao" ? acoesDaReuniao : acaoTab === "backlog" ? acoesPendentesTipo : acoesConcluidasDesdeUltima;

  const responsaveisFiltrados = useMemo(() => {
    const q = responsavelQuery.toLowerCase();
    if (!q) return [];
    return listaResponsaveis.filter(u => {
      const n = buildNomeSobrenome(u).toLowerCase();
      return n.includes(q) || (u.login || "").toLowerCase().includes(q);
    }).slice(0, 10);
  }, [responsavelQuery, listaResponsaveis]);

  const onAddEvidencias = (files) => {
    if (files) setNovasEvidenciasAcao(prev => [...prev, ...Array.from(files)]);
  };

  return (
    <Layout>
      <div className="h-screen bg-[#f6f8fc] text-slate-900 flex overflow-hidden">
        {/* COLUNA ESQUERDA */}
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
              <button key={r.id} onClick={() => !isRecording && setSelecionada(r)} className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selecionada?.id === r.id ? "bg-blue-50 border-l-4 border-l-blue-600" : "border-l-4 border-l-transparent"} ${isRecording ? "opacity-80 cursor-not-allowed" : ""}`}>
                <div className="flex justify-between items-center">
                  <div className="min-w-0">
                    <div className="font-black text-xs truncate">{r.titulo || "Sem título"}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{toBR(r.data_hora)}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-lg font-extrabold uppercase ${norm(r.status) === "REALIZADA" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{r.status || "Pendente"}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase">Sessão</div>
              <div className="text-lg font-black font-mono leading-none">{secondsToMMSS(timer)}</div>
            </div>
            {isRecording ? (
              <button onClick={stopRecording} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs">ENCERRAR</button>
            ) : (
              <button onClick={startRecording} disabled={!selecionada || norm(selecionada?.status) === "REALIZADA"} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-xs hover:bg-blue-500 disabled:opacity-30">GRAVAR</button>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="flex-1 p-6 overflow-y-auto">
          {!selecionada ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">Selecione uma reunião.</div>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xl font-black">{selecionada.titulo}</div>
                    {/* ✅ Exibe o nome do tipo que foi carregado */}
                    <div className="text-xs text-slate-500 mt-1">{toBR(selecionada.data_hora)} • {nomeTipoReuniao || selecionada.tipo_reuniao || "Geral"}</div>
                  </div>
                  {norm(selecionada.status) === "REALIZADA" && (
                    <button onClick={() => setShowUnlock(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-black"><Lock size={16}/> Reabrir</button>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                {['acoes', 'ata_principal', 'ata_manual'].map(t => (
                  <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-2 ${tab === t ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-white text-slate-700"}`}>
                    {t === 'acoes' && <ClipboardList size={16}/>}
                    {t === 'ata_principal' && <FileText size={16}/>}
                    {t === 'ata_manual' && <StickyNote size={16}/>}
                    {t === 'acoes' ? 'Ações' : t === 'ata_principal' ? 'Ata Principal' : 'Ata Manual'}
                  </button>
                ))}
              </div>

              {tab === 'acoes' ? (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-2 overflow-x-auto">
                    {[{id: 'reuniao', l: 'Da reunião'}, {id: 'backlog', l: 'Pendências'}, {id: 'desde_ultima', l: 'Concluídas rec.'}].map(opt => (
                      <button key={opt.id} onClick={() => setAcaoTab(opt.id)} className={`text-[12px] px-3 py-2 rounded-xl font-extrabold border whitespace-nowrap ${acaoTab === opt.id ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-white"}`}>
                        {opt.l}
                      </button>
                    ))}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="font-black text-sm">Lista de Ações</div>
                      {loadingAcoes && <Loader2 size={14} className="animate-spin text-blue-600"/>}
                    </div>
                    <div className="space-y-3">
                      {listaAtiva.length === 0 && <div className="text-sm text-slate-400">Nenhuma ação.</div>}
                      {listaAtiva.map(a => (
                        <AcaoCard key={a.id} acao={a} onClick={() => setAcaoSelecionada(a)} />
                      ))}
                    </div>
                  </div>

                  {/* Nova Ação Form */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-center"><Plus size={18}/></div>
                      <div>
                        <div className="text-sm font-black">Nova Ação</div>
                        <div className="text-xs text-slate-500">Criado por: <strong>{currentUser ? buildNomeSobrenome(currentUser) : "Carregando..."}</strong></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-600">Nome (Descrição)</label>
                        <input className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 ring-blue-500/30" value={novaAcao.descricao} onChange={e => setNovaAcao(p => ({...p, descricao: e.target.value}))} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-600">Observação</label>
                        <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 ring-blue-500/30" rows={2} value={novaAcao.observacao} onChange={e => setNovaAcao(p => ({...p, observacao: e.target.value}))} />
                      </div>
                      <div className="relative">
                        <label className="text-xs font-bold text-slate-600">Responsável</label>
                        <input className="w-full border border-slate-200 rounded-xl p-3 text-sm" value={responsavelQuery} onChange={e => { setResponsavelQuery(e.target.value); setRespOpen(true); }} onFocus={() => setRespOpen(true)} placeholder="Digite..." />
                        {respOpen && responsaveisFiltrados.length > 0 && (
                          <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto">
                            {responsaveisFiltrados.map(u => (
                              <button key={u.id} type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm" onClick={() => {
                                setNovaAcao(p => ({...p, responsavelId: u.login || u.id }));
                                setResponsavelQuery(buildNomeSobrenome(u));
                                setRespOpen(false);
                              }}>
                                {buildNomeSobrenome(u)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600">Vencimento</label>
                        <input type="date" className="w-full border border-slate-200 rounded-xl p-3 text-sm" value={novaAcao.vencimento} onChange={e => setNovaAcao(p => ({...p, vencimento: e.target.value}))} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-600 block mb-2">Evidências ({novasEvidenciasAcao.length})</label>
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-sm font-black">
                          <UploadCloud size={16}/> Anexar
                          <input type="file" multiple className="hidden" onChange={e => e.target.files && setNovasEvidenciasAcao(prev => [...prev, ...Array.from(e.target.files)])} />
                        </label>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {novasEvidenciasAcao.map((f, i) => (
                            <div key={i} className="text-xs bg-slate-100 px-2 py-1 rounded flex items-center gap-1">
                              {f.name} <button onClick={() => setNovasEvidenciasAcao(prev => prev.filter((_, idx) => idx !== i))}><X size={12}/></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button onClick={salvarAcao} disabled={creatingAcao} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 disabled:opacity-50">
                        {creatingAcao ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar
                      </button>
                    </div>
                  </div>
                </div>
              ) : tab === 'ata_principal' ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 text-sm whitespace-pre-wrap">{ataPrincipal || "Sem ata principal."}</div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex justify-between mb-2">
                    <div className="font-black">Ata Manual</div>
                    <button onClick={() => editAtaManual ? salvarAtaManual() : setEditAtaManual(true)} className="text-xs font-bold text-blue-600">{editAtaManual ? "Salvar" : "Editar"}</button>
                  </div>
                  {editAtaManual ? (
                    <textarea className="w-full border rounded-xl p-3 text-sm h-64" value={ataManual} onChange={e => setAtaManual(e.target.value)} />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{ataManual || "Vazio."}</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {acaoSelecionada && (
          <ModalDetalhesAcao
            aberto={!!acaoSelecionada}
            acao={acaoSelecionada}
            status={acaoSelecionada?.status}
            onClose={() => setAcaoSelecionada(null)}
            onAfterSave={() => fetchAcoes(selecionada)}
            onAfterDelete={() => fetchAcoes(selecionada)}
            onConcluir={async () => {
              await supabase.from("acoes").update({ status: "Concluída", data_conclusao: nowIso() }).eq("id", acaoSelecionada.id);
              fetchAcoes(selecionada);
            }}
          />
        )}

        {showUnlock && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl w-80 shadow-2xl">
              <div className="font-black mb-2">Senha Admin</div>
              <input type="password" value={senhaAdm} onChange={e => setSenhaAdm(e.target.value)} className="w-full border rounded-xl p-3 mb-3" />
              <div className="flex gap-2">
                <button onClick={validarSenhaAdm} className="bg-red-600 text-white flex-1 py-2 rounded-xl font-bold text-sm">Liberar</button>
                <button onClick={() => setShowUnlock(false)} className="border flex-1 py-2 rounded-xl font-bold text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ✅ Componente AcaoCard BLINDADO contra tela branca e com status EXCLUÍDA
function AcaoCard({ acao, onClick }) {
  // Safe Access para evitar erros de render
  const st = String(acao?.status || "").toLowerCase();
  const done = st === "concluída" || st === "concluida";
  const excluded = st === "excluída" || st === "excluida"; // ✅ Verifica excluída
  const resp = acao?.responsavel_nome || acao?.responsavel || "Geral";
  const vencimentoSafe = formatDateSafe(acao?.data_vencimento);
  const conclusaoSafe = formatDateSafe(acao?.data_conclusao);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border shadow-sm transition-colors ${
        excluded
          ? "bg-gray-50 border-gray-200 opacity-60 grayscale" // Estilo visual para excluída
          : "bg-white border-slate-200 hover:bg-slate-50"
      }`}
      type="button"
    >
      <div className="flex items-start gap-3">
        {/* Ícone de Status */}
        <div className="mt-1">
            {excluded ? (
                <Trash2 size={14} className="text-gray-400" /> // Lixeira cinza
            ) : (
                <div className={`w-2.5 h-2.5 rounded-full ${done ? "bg-emerald-500" : "bg-blue-500"}`} />
            )}
        </div>

        <div className="flex-1">
          <div
            className={`text-sm font-semibold ${
              done || excluded ? "line-through text-slate-400" : "text-slate-900"
            }`}
          >
            {acao?.descricao || "-"}
            {/* Etiqueta Excluída */}
            {excluded && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-black no-underline inline-block border border-red-200">EXCLUÍDA</span>}
          </div>

          <div className="text-[12px] text-slate-600 mt-1 flex flex-wrap gap-2 items-center">
            <span className="font-semibold bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1"><User size={10}/> {resp}</span>
            {vencimentoSafe && (
              <span className="text-slate-500 flex items-center gap-1">
                <Clock size={10}/> Venc.: {vencimentoSafe}
              </span>
            )}
            {conclusaoSafe && (
              <span className="text-green-600 flex items-center gap-1">
                <Check size={10}/> {conclusaoSafe}
              </span>
            )}
            {(acao?.fotos?.length > 0 || acao?.fotos_acao?.length > 0) && <ImageIcon size={12} className="text-blue-400"/>}
            {acao?.observacao && <MessageSquare size={12} className="text-amber-400"/>}
          </div>
        </div>
      </div>
    </button>
  );
}

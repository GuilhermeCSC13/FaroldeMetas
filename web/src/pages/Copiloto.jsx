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
  Image as ImageIcon,
  Film,
  File as FileIcon,
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

function buildNomeSobrenome(u) {
  const nome = String(u?.nome || "").trim();
  const sobrenome = String(u?.sobrenome || "").trim();
  const nomeCompleto = String(u?.nome_completo || "").trim();

  // ✅ preferir Nome Sobrenome (como você pediu)
  if (nome && sobrenome) return `${nome} ${sobrenome}`;
  if (nomeCompleto) return nomeCompleto;
  if (nome) return nome;
  return "-";
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
   Page
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
  const [dataFiltro, setDataFiltro] = useState(
    new Date().toISOString().split("T")[0]
  );
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
  const [acoesConcluidasDesdeUltima, setAcoesConcluidasDesdeUltima] = useState(
    []
  );
  const [acaoTab, setAcaoTab] = useState("reuniao"); // reuniao | backlog | desde_ultima

  // ✅ Criar ação (responsavel_id, vencimento e evidência obrigatória)
  const [novaAcao, setNovaAcao] = useState({
    descricao: "",
    responsavelId: "",
    vencimento: "",
  });
  const [novasEvidenciasAcao, setNovasEvidenciasAcao] = useState([]); // File[]

  // ✅ Responsáveis (usuarios_aprovadores no supabaseInove)
  const [listaResponsaveis, setListaResponsaveis] = useState([]);
  const [loadingResponsaveis, setLoadingResponsaveis] = useState(false);

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

    // ✅ carregar responsáveis uma vez (do SUPABASE INOVE)
    (async () => {
      try {
        setLoadingResponsaveis(true);
        const { data, error } = await supabaseInove
          .from("usuarios_aprovadores")
          .select("id, nome, sobrenome, nome_completo, ativo")
          .eq("ativo", true)
          .order("nome", { ascending: true });

        if (error) {
          console.error("carregarResponsaveis:", error);
          safeSet(() => setListaResponsaveis([]));
          return;
        }

        safeSet(() => setListaResponsaveis(data || []));
      } finally {
        safeSet(() => setLoadingResponsaveis(false));
      }
    })();

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

    carregarAtas(selecionada);
    fetchAcoes(selecionada);

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

    if (isRecording && current?.reuniaoId) {
      const found = (data || []).find((r) => r.id === current.reuniaoId);
      if (found) safeSet(() => setSelecionada(found));
    } else {
      if (selecionada?.id) {
        const still = (data || []).some((r) => r.id === selecionada.id);
        if (!still) safeSet(() => setSelecionada(null));
      }
    }
  };

  /* =========================
     Atas
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
     Gravação
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

      if (selecionada?.id) {
        await supabase
          .from("reunioes")
          .update({ status: "Realizada" })
          .eq("id", selecionada.id);
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
     ✅ validar no SUPABASE INOVE (usuarios_aprovadores)
  ========================= */
  const validarSenhaAdm = async () => {
    if (!selecionada?.id) return;

    const senha = String(senhaAdm || "").trim();
    if (!senha) return alert("Informe a senha.");

    const { data, error } = await supabaseInove
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
     Upload Evidências
  ========================= */
  const uploadEvidencias = async (acaoId, files) => {
    const urls = [];

    for (const file of files) {
      const fileName = `acao-${acaoId}-${Date.now()}-${sanitizeFileName(
        file.name
      )}`;

      const { error } = await supabase.storage
        .from("evidencias")
        .upload(fileName, file);

      if (error) {
        console.error("Erro upload evidência:", error);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("evidencias")
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) urls.push(urlData.publicUrl);
    }

    return urls;
  };

  /* =========================
     AÇÕES
  ========================= */
  const fetchAcoes = async (r) => {
    if (!r?.id) return;

    safeSet(() => setLoadingAcoes(true));

    try {
      const { data: daReuniao, error: e1 } = await supabase
        .from("acoes")
        .select("*")
        .eq("reuniao_id", r.id)
        .order("created_at", { ascending: false });

      if (e1) throw e1;

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

      let concluidasDesde = [];
      if (tipoId && r.data_hora) {
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

  // ✅ Criar ação agora exige: responsável + vencimento + evidência
  const salvarAcao = async () => {
    if (!selecionada?.id) return;

    const descricao = String(novaAcao.descricao || "").trim();
    const responsavelId = String(novaAcao.responsavelId || "").trim();
    const vencimento = String(novaAcao.vencimento || "").trim();

    if (!descricao) return;
    if (!responsavelId) return alert("Selecione o responsável.");
    if (!vencimento) return alert("Informe o vencimento.");
    if ((novasEvidenciasAcao || []).length === 0) {
      return alert("Anexe pelo menos uma evidência (foto/vídeo/documento).");
    }

    const user = (listaResponsaveis || []).find(
      (u) => String(u.id) === responsavelId
    );
    const responsavelNome = buildNomeSobrenome(user);

    const payloadCriacao = {
      descricao,
      status: "Aberta",
      reuniao_id: selecionada.id,
      tipo_reuniao_id: selecionada.tipo_reuniao_id || null,

      // vincular responsável (usuarios_aprovadores)
      responsavel_id: responsavelId,
      responsavel: responsavelNome, // compatibilidade
      responsavel_nome: responsavelNome, // se existir no schema

      // vencimento
      data_vencimento: vencimento,

      created_at: nowIso(),
      data_criacao: nowIso(),

      fotos_acao: [],
    };

    const { data, error } = await supabase
      .from("acoes")
      .insert([payloadCriacao])
      .select("*");

    if (error) {
      console.error("salvarAcao insert:", error);
      return alert("Erro ao criar ação: " + (error.message || error));
    }

    const inserted = data?.[0];
    const acaoId = inserted?.id;
    if (!acaoId) return alert("Erro: ação criada sem ID.");

    const urls = await uploadEvidencias(acaoId, novasEvidenciasAcao);

    if (!urls.length) {
      return alert(
        "A ação foi criada, mas falhou o upload das evidências. Tente anexar novamente no detalhe."
      );
    }

    const payloadUpdate = {
      fotos_acao: urls,
      fotos: urls, // compatibilidade
      evidencia_url: urls[0] || null,
    };

    const { error: e2 } = await supabase.from("acoes").update(payloadUpdate).eq("id", acaoId);

    if (e2) {
      console.error("salvarAcao update evidencias:", e2);
      return alert(
        "Ação criada, mas não consegui gravar as evidências: " +
          (e2.message || e2)
      );
    }

    setNovaAcao({ descricao: "", responsavelId: "", vencimento: "" });
    setNovasEvidenciasAcao([]);

    setTab("acoes");
    setAcaoTab("reuniao");

    await fetchAcoes(selecionada);
  };

  /* =========================
     Previews de evidências (miniaturas)
  ========================= */
  const previews = useMemo(() => {
    const list = (novasEvidenciasAcao || []).map((f, idx) => {
      const kind = fileKind(f);
      const needsUrl = kind === "image" || kind === "video";
      const url = needsUrl ? URL.createObjectURL(f) : null;
      return {
        id: `${idx}-${f.name}-${f.size}`,
        file: f,
        name: f.name,
        kind,
        url,
      };
    });
    return list;
  }, [novasEvidenciasAcao]);

  useEffect(() => {
    // cleanup objectURL
    return () => {
      (previews || []).forEach((p) => {
        if (p?.url) URL.revokeObjectURL(p.url);
      });
    };
  }, [previews]);

  /* =========================
     UI computed
  ========================= */
  const reunioesFiltradas = useMemo(() => {
    const q = (busca || "").toLowerCase();
    return (reunioes || []).filter((r) =>
      (r.titulo || "").toLowerCase().includes(q)
    );
  }, [reunioes, busca]);

  const statusLabel = (r) => {
    const st = String(r?.status || "").trim();
    return st || "Pendente";
  };

  const statusBadgeClass = (lbl) => {
    const v = norm(lbl);
    if (v === "REALIZADA")
      return "bg-emerald-600/15 text-emerald-700 border border-emerald-200";
    if (v === "EM ANDAMENTO")
      return "bg-blue-600/15 text-blue-700 border border-blue-200";
    if (v === "AGENDADA")
      return "bg-slate-600/10 text-slate-700 border border-slate-200";
    if (v === "PENDENTE")
      return "bg-slate-600/10 text-slate-700 border border-slate-200";
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
      <div className="h-screen bg-[#f6f8fc] text-slate-900 flex overflow-hidden">
        {/* COLUNA ESQUERDA */}
        <div className="w-[420px] min-w-[380px] max-w-[460px] flex flex-col p-5 border-r border-slate-200 bg-white">
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

          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Calendar
                size={16}
                className="absolute left-3 top-3 text-slate-400"
              />
              <input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 ring-blue-500/30"
                value={dataFiltro}
                onChange={(e) => setDataFiltro(e.target.value)}
              />
            </div>

            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-3 text-slate-400"
              />
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

                {/* ✅ Criar ação */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
                  <div className="text-[11px] font-extrabold text-slate-600 uppercase mb-2">
                    Criar nova ação
                  </div>

                  <textarea
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm outline-none focus:ring-2 ring-blue-500/25 h-24"
                    placeholder="Descreva a ação..."
                    value={novaAcao.descricao}
                    onChange={(e) =>
                      setNovaAcao((p) => ({ ...p, descricao: e.target.value }))
                    }
                  />

                  <div className="flex gap-2 mt-2">
                    <select
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500/25"
                      value={novaAcao.responsavelId}
                      onChange={(e) =>
                        setNovaAcao((p) => ({
                          ...p,
                          responsavelId: e.target.value,
                        }))
                      }
                      disabled={loadingResponsaveis}
                    >
                      <option value="">
                        {loadingResponsaveis
                          ? "Carregando responsáveis..."
                          : "Selecione o responsável"}
                      </option>
                      {listaResponsaveis.map((u) => (
                        <option key={u.id} value={u.id}>
                          {buildNomeSobrenome(u)}
                        </option>
                      ))}
                    </select>

                    <input
                      type="date"
                      className="w-[170px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500/25"
                      value={novaAcao.vencimento}
                      onChange={(e) =>
                        setNovaAcao((p) => ({ ...p, vencimento: e.target.value }))
                      }
                    />
                  </div>

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-extrabold text-blue-700 cursor-pointer">
                      <span className="px-3 py-2 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 inline-flex items-center gap-2">
                        <UploadCloud size={16} />
                        Anexar evidências (obrigatório)
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        className="hidden"
                        onChange={(e) =>
                          setNovasEvidenciasAcao(Array.from(e.target.files || []))
                        }
                      />
                    </label>

                    <div className="text-[11px] text-slate-600">
                      {novasEvidenciasAcao.length > 0
                        ? `${novasEvidenciasAcao.length} arquivo(s) selecionado(s)`
                        : "Nenhum arquivo selecionado"}
                    </div>
                  </div>

                  {/* ✅ Miniaturas pequenas */}
                  {previews.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] font-extrabold text-slate-500 uppercase mb-2">
                        Prévia das evidências
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {previews.map((p) => (
                          <MiniaturaArquivo key={p.id} preview={p} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end mt-3">
                    <button
                      onClick={salvarAcao}
                      disabled={
                        !novaAcao.descricao?.trim() ||
                        !novaAcao.responsavelId ||
                        !novaAcao.vencimento ||
                        novasEvidenciasAcao.length === 0
                      }
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2"
                    >
                      <Plus size={16} /> Criar
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-500">
                    Para criar: obrigatório <b>Responsável</b>, <b>Vencimento</b>{" "}
                    e <b>Evidência</b>.
                  </div>
                </div>

                <div className="flex gap-2 mb-3">
                  <Pill
                    active={acaoTab === "reuniao"}
                    onClick={() => setAcaoTab("reuniao")}
                  >
                    Da reunião ({acoesDaReuniao.length})
                  </Pill>
                  <Pill
                    active={acaoTab === "backlog"}
                    onClick={() => setAcaoTab("backlog")}
                  >
                    Pendências do tipo ({acoesPendentesTipo.length})
                  </Pill>
                  <Pill
                    active={acaoTab === "desde_ultima"}
                    onClick={() => setAcaoTab("desde_ultima")}
                  >
                    Concluídas desde a última ({acoesConcluidasDesdeUltima.length})
                  </Pill>
                </div>

                {loadingAcoes ? (
                  <div className="text-slate-600 text-sm">Carregando ações...</div>
                ) : (listaAtiva || []).length === 0 ? (
                  <div className="text-slate-600 text-sm">Nenhum item nesta lista.</div>
                ) : (
                  <div className="space-y-2">
                    {(listaAtiva || []).map((a) => (
                      <AcaoCard key={a.id} acao={a} onClick={() => setAcaoSelecionada(a)} />
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
          aberto={!!acaoSelecionada}
          acao={acaoSelecionada}
          status={acaoSelecionada?.status}
          onClose={() => setAcaoSelecionada(null)}
          onAfterSave={() => fetchAcoes(selecionada)}
          onAfterDelete={() => fetchAcoes(selecionada)}
          onConcluir={async () => {
            await supabase
              .from("acoes")
              .update({ status: "Concluída", data_conclusao: new Date().toISOString() })
              .eq("id", acaoSelecionada.id);

            await fetchAcoes(selecionada);
          }}
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
            <div className="mt-2 text-[11px] text-slate-500">
              Validação feita no <b>SUPABASE INOVE</b> (usuarios_aprovadores).
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

function MiniaturaArquivo({ preview }) {
  const { kind, url, name } = preview;

  const box =
    "w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center";
  const caption = "max-w-[64px] text-[9px] text-slate-600 truncate mt-1";

  if (kind === "image") {
    return (
      <div className="flex flex-col items-center">
        <div className={box} title={name}>
          <img src={url} alt={name} className="w-full h-full object-cover" />
        </div>
        <div className={caption}>{name}</div>
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="flex flex-col items-center">
        <div className={box} title={name}>
          {/* mini preview simples */}
          <video
            src={url}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        </div>
        <div className={caption}>{name}</div>
      </div>
    );
  }

  // PDFs e docs: ícone + label curta
  const Icon =
    kind === "pdf" ? FileText : kind === "doc" ? FileIcon : kind === "xls" ? FileIcon : kind === "ppt" ? FileIcon : FileIcon;

  return (
    <div className="flex flex-col items-center">
      <div className={box} title={name}>
        <div className="flex flex-col items-center justify-center">
          {kind === "pdf" ? (
            <div className="text-[10px] font-black text-red-600">PDF</div>
          ) : kind === "doc" ? (
            <div className="text-[10px] font-black text-blue-700">DOC</div>
          ) : kind === "xls" ? (
            <div className="text-[10px] font-black text-emerald-700">XLS</div>
          ) : kind === "ppt" ? (
            <div className="text-[10px] font-black text-orange-700">PPT</div>
          ) : (
            <div className="text-[10px] font-black text-slate-700">ARQ</div>
          )}
          <Icon size={18} className="text-slate-500 mt-1" />
        </div>
      </div>
      <div className={caption}>{name}</div>
    </div>
  );
}

function AcaoCard({ acao, onClick }) {
  const done =
    String(acao?.status || "").toLowerCase() === "concluída" ||
    String(acao?.status || "").toLowerCase() === "concluida";

  const resp = acao?.responsavel_nome || acao?.responsavel || "Geral";

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
            <span className="font-semibold">Responsável:</span> {resp}
            {acao?.data_vencimento ? (
              <span className="text-slate-500">
                {" "}
                • Venc.: {new Date(acao.data_vencimento).toLocaleDateString("pt-BR")}
              </span>
            ) : null}
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

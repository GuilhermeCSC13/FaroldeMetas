// src/pages/CentralAtas.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import Layout from "../components/tatico/Layout";
import { supabase, supabaseInove } from "../supabaseClient";
import { getGeminiFlash } from "../services/gemini";
import ModalDetalhesAcao from "../components/tatico/ModalDetalhesAcao";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Calendar,
  User,
  CheckCircle,
  Layers,
  Edit3,
  Trash2,
  Plus,
  PlayCircle,
  Headphones,
  ExternalLink,
  Cpu,
  Loader2,
  Clock,
  ImageIcon,
  Play,
  Pause,
  Volume2,
  VolumeX,
  StickyNote,
  Paperclip,
  FileText,
  Download,
  Video,
  Maximize2,
  X,
  RefreshCw,
  FileVideo,
  Hourglass,
} from "lucide-react";

// --- HELPER: Formatar Duração Real ---
const calculateRealDuration = (startStr, endStr) => {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diffMs = end - start;
  if (diffMs < 0) return null;

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

// ==========================
// ✅ FORMATADOR PROFISSIONAL DE ATA (padrão limpo)
// ==========================
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function cleanLeadingSalutation(md) {
  let t = String(md || "").replace(/\r\n/g, "\n").trim();
  // remove linhas iniciais tipo "Certo, aqui está a ATA..."
  t = t.replace(/^(certo|claro)[^\n]*\n+/gim, "");
  t = t.replace(/^(aqui\s+est[aá]\s+a\s+ata[^\n]*)\n+/gim, "");
  return t.trim();
}
function ensureSpacing(md) {
  // garante espaçamento entre blocos (evita “paredão”)
  return String(md || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([^\n])\n(##\s)/g, "$1\n\n$2")
    .replace(/([^\n])\n(\*\*Data:\*\*)/g, "$1\n\n$2")
    .trim();
}
function boldSectionTitles(md) {
  // transforma "1. Resumo" -> "## **Resumo**"
  // transforma "2. Decisões" / "Decisões" -> "## **Decisões**"
  // transforma "3. Ações" -> "## **Ações**"
  let t = String(md || "");

  const map = [
    { re: /^\s*(\d+)\s*[\.\)]\s*Resumo\s*$/gim, rep: "## **Resumo**" },
    { re: /^\s*(\d+)\s*[\.\)]\s*Decis(õ|o)es\s*$/gim, rep: "## **Decisões**" },
    { re: /^\s*(\d+)\s*[\.\)]\s*A(ç|c)oes\s*$/gim, rep: "## **Ações**" },

    // sem numeração
    { re: /^\s*Resumo\s*$/gim, rep: "## **Resumo**" },
    { re: /^\s*Decis(õ|o)es\s*$/gim, rep: "## **Decisões**" },
    { re: /^\s*A(ç|c)oes\s*$/gim, rep: "## **Ações**" },
  ];

  for (const r of map) t = t.replace(r.re, r.rep);
  return t;
}
function normalizeTitleAndDate(raw, { titulo, dataBR } = {}) {
  let t = String(raw || "").trim();

  const safeTitulo = String(titulo || "").trim();
  const safeData = String(dataBR || "").trim();

  // remove "DBO - ..." solto no topo se já colocaremos título padrão
  // (não remove se estiver dentro do corpo)
  const lines = t.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const first = (lines[i] || "").trim();

  // cria header profissional:
  // **TÍTULO**
  // **Data:** DD/MM/AAAA
  let header = "";
  if (safeTitulo) header += `**${safeTitulo}**\n`;
  if (safeData) header += `**Data:** ${safeData}\n`;

  // se o texto já começa com H1/H2, mantém; senão força cabeçalho profissional
  const startsWithHeading = /^#{1,6}\s+/.test(first);

  // se já começa com o título ou "DBO -" etc, substitui por header
  const looksLikeTitleLine = safeTitulo && first.toLowerCase().includes(safeTitulo.toLowerCase());
  const startsWithDBO = /^d\s*b\s*o\s*[\-–—]/i.test(first) || /^dbo\b/i.test(first);

  if (!startsWithHeading) {
    if (looksLikeTitleLine || startsWithDBO) {
      // remove primeiras 2-4 linhas (título/data) e injeta header limpo
      let cut = i;
      let consumed = 0;
      while (cut < lines.length && consumed < 6) {
        const s = (lines[cut] || "").trim();
        if (!s) {
          cut++;
          consumed++;
          continue;
        }
        // para quando chegar em "Resumo" ou "1. Resumo" etc
        if (/^(\d+\s*[\.\)]\s*)?resumo\b/i.test(s)) break;
        if (/^(\d+\s*[\.\)]\s*)?decis/i.test(s)) break;
        if (/^(\d+\s*[\.\)]\s*)?a(ç|c)oes\b/i.test(s)) break;
        cut++;
        consumed++;
      }
      const rest = lines.slice(cut).join("\n").trim();
      t = `${header}\n${rest}`.trim();
    } else {
      // só prefixa header se não existir ainda uma linha "Data:" no começo
      const hasEarlyDate = lines.slice(0, Math.min(lines.length, 8)).some((l) => /^\s*data\s*:/i.test(l));
      if (!hasEarlyDate && (safeTitulo || safeData)) {
        t = `${header}\n${t}`.trim();
      }
    }
  }

  // normaliza "Data:" que venha perdida para **Data:**
  t = t.replace(/^\s*data\s*:\s*(.+)$/gim, (_, v) => `**Data:** ${String(v).trim()}`);

  return t;
}
function improveParagraphs(md) {
  // quebra em blocos por frases gatilho para ficar mais “profissional”
  let t = String(md || "");

  // garante que cada "Foi ..." vira novo parágrafo
  t = t
    .replace(/\s+(Foi mencionado que)/g, "\n\n$1")
    .replace(/\s+(Foi citado que)/g, "\n\n$1")
    .replace(/\s+(Foi discutido)/g, "\n\n$1")
    .replace(/\s+(É necessário)/g, "\n\n$1");

  // negrita percentuais
  t = t.replace(/(\b\d{1,3})\s*%/g, "**$1%**");

  // indicadores: "cumprimento ... foi 98% e ..." -> quebra linha se virar grande
  t = t.replace(/(\*\*\d{1,3}%\*\*)\s+e\s+/g, "$1**;** ");

  return ensureSpacing(t);
}
function formatAtaMarkdown(raw, { titulo, dataBR } = {}) {
  let t = cleanLeadingSalutation(raw);
  t = normalizeTitleAndDate(t, { titulo, dataBR });
  t = boldSectionTitles(t);

  // seções mínimas caso IA não traga
  const hasResumo = /##\s*\*\*Resumo\*\*/i.test(t);
  const hasDecisoes = /##\s*\*\*Decis(õ|o)es\*\*/i.test(t);
  const hasAcoes = /##\s*\*\*A(ç|c)oes\*\*/i.test(t);

  if (!hasResumo) t = `${t}\n\n## **Resumo**\n- —`;
  if (!hasDecisoes) t = `${t}\n\n## **Decisões**\n- —`;
  if (!hasAcoes) t = `${t}\n\n## **Ações**\n- —`;

  t = improveParagraphs(t);

  return t.trim();
}

// --- COMPONENTE PLAYER DE ÁUDIO ---
const CustomAudioPlayer = ({ src, durationDb }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationDb || 0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(durationDb || 0);
  }, [src, durationDb]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);

    if (Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const d = audioRef.current.duration;
    if (Number.isFinite(d) && d > 0) setDuration(d);
  };

  const handleSeek = (e) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) audioRef.current.currentTime = newTime;
  };

  const formatTime = (time) => {
    if (!time || isNaN(time) || !Number.isFinite(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const safeDuration = duration > 0 ? duration : durationDb || 100;
  const progressPercent = (currentTime / safeDuration) * 100;

  return (
    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-full">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
        preload="metadata"
      />

      <button
        onClick={togglePlay}
        className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow transition-all active:scale-95"
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>

      <span className="text-xs font-mono font-bold text-slate-600 w-12 text-right">{formatTime(currentTime)}</span>

      <div className="flex-1 relative h-8 flex items-center group">
        <div className="absolute w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-100 ease-linear" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
        </div>

        <input type="range" min="0" max={safeDuration} value={currentTime} onChange={handleSeek} className="absolute w-full h-full opacity-0 cursor-pointer z-10" />

        <div
          className="absolute h-4 w-4 bg-white border-2 border-blue-600 rounded-full shadow pointer-events-none transition-all duration-100 ease-linear"
          style={{ left: `calc(${Math.min(progressPercent, 100)}% - 8px)` }}
        />
      </div>

      <span className="text-xs font-mono text-slate-400 w-12">{formatTime(safeDuration)}</span>

      <button
        onClick={() => {
          if (!audioRef.current) return;
          audioRef.current.muted = !isMuted;
          setIsMuted(!isMuted);
        }}
        className="text-slate-400 hover:text-slate-600 p-1"
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
};

export default function CentralAtas() {
  const [atas, setAtas] = useState([]);
  const [selectedAta, setSelectedAta] = useState(null);
  const [busca, setBusca] = useState("");

  const [mediaUrls, setMediaUrls] = useState({ video: null, audio: null });

  const [acoesCriadas, setAcoesCriadas] = useState([]);
  const [acoesAnteriores, setAcoesAnteriores] = useState([]);

  const [ataManual, setAtaManual] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editedPauta, setEditedPauta] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [requestingVideo, setRequestingVideo] = useState(false);

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [acaoParaModal, setAcaoParaModal] = useState(null);
  const pollingRef = useRef(null);

  const [showDeleteAuth, setShowDeleteAuth] = useState(false);
  const [delLogin, setDelLogin] = useState("");
  const [delSenha, setDelSenha] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  const checkUserRole = async () => {
    setIsAdmin(true);
  };

  useEffect(() => {
    fetchAtas();
    checkUserRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedAta) {
      carregarDetalhes(selectedAta);

      const dataBR = selectedAta.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString("pt-BR") : "";

      // ✅ sempre abrir já padronizado
      setEditedPauta(
        formatAtaMarkdown(selectedAta.pauta || "", {
          titulo: selectedAta.titulo || "Ata da Reunião",
          dataBR,
        })
      );

      setAtaManual(selectedAta.ata_manual || "");
      setIsEditing(false);

      setShowDeleteAuth(false);
      setDelLogin("");
      setDelSenha("");
      setRequestingVideo(false);
      setIsVideoModalOpen(false);

      hydrateMediaUrls(selectedAta);
      checkAutoRefresh(selectedAta);
    } else {
      setMediaUrls({ video: null, audio: null });
      stopPolling();
    }

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAta?.id]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const checkAutoRefresh = (ata) => {
    stopPolling();
    const stGravacao = String(ata.gravacao_status || "").toUpperCase();

    const precisaAtualizar =
      stGravacao.includes("PROCESSANDO") ||
      stGravacao === "PENDENTE" ||
      stGravacao === "GRAVANDO" ||
      stGravacao === "PRONTO_PROCESSAR";

    if (precisaAtualizar) {
      pollingRef.current = setInterval(() => {
        refreshSelectedAta(ata.id);
      }, 4000);
    }
  };

  const refreshSelectedAta = async (id) => {
    if (!id) return;
    try {
      const { data, error } = await supabase.from("reunioes").select("*").eq("id", id).single();

      if (!error && data) {
        setSelectedAta((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data)) return data;
          return prev;
        });
        setAtas((prev) => prev.map((r) => (r.id === data.id ? { ...r, ...data } : r)));

        const stGravacao = String(data.gravacao_status || "").toUpperCase();

        if (!stGravacao.includes("PROCESSANDO") && stGravacao !== "PENDENTE" && stGravacao !== "GRAVANDO") {
          stopPolling();
          hydrateMediaUrls(data);
          carregarDetalhes(data);

          if (data.pauta) {
            const dataBR = data.data_hora ? new Date(data.data_hora).toLocaleDateString("pt-BR") : "";
            setEditedPauta(
              formatAtaMarkdown(data.pauta, {
                titulo: data.titulo || "Ata da Reunião",
                dataBR,
              })
            );
          }
        }
      }
    } catch (e) {
      console.error("Erro polling:", e);
    }
  };

  const getSignedOrPublicUrl = async (bucket, filePath) => {
    if (!bucket || !filePath) return null;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
    if (pub?.publicUrl) return pub.publicUrl;
    return null;
  };

  const hydrateMediaUrls = async (ata) => {
    try {
      const videoUrl = await getSignedOrPublicUrl(ata.gravacao_bucket, ata.gravacao_path);
      const audioUrl = await getSignedOrPublicUrl(
        ata.gravacao_audio_bucket || ata.gravacao_bucket,
        ata.gravacao_audio_path || ata.gravacao_path
      );
      setMediaUrls({ video: videoUrl, audio: audioUrl });
    } catch (e) {
      console.error("Erro URLs:", e);
    }
  };

  const fetchAtas = async () => {
    const { data, error } = await supabase
      .from("reunioes")
      .select("*")
      .eq("status", "Realizada")
      .order("data_hora", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    setAtas(data || []);
    if (data && data.length > 0 && !selectedAta) setSelectedAta(data[0]);
  };

  const carregarDetalhes = async (ata) => {
    const { data: criadas } = await supabase
      .from("acoes")
      .select("*")
      .eq("reuniao_id", ata.id)
      .order("data_criacao", { ascending: false });
    setAcoesCriadas(criadas || []);

    try {
      const tituloBase = (ata.titulo || "").trim();
      if (!tituloBase) {
        setAcoesAnteriores([]);
        return;
      }

      const { data: reunioesAnt } = await supabase
        .from("reunioes")
        .select("id")
        .eq("titulo", tituloBase)
        .neq("id", ata.id)
        .lt("data_hora", ata.data_hora)
        .order("data_hora", { ascending: false })
        .limit(20);

      const listaIds = (reunioesAnt || []).map((r) => r.id);
      if (!listaIds.length) {
        setAcoesAnteriores([]);
        return;
      }

      const { data: anteriores } = await supabase
        .from("acoes")
        .select("*")
        .eq("status", "Aberta")
        .in("reuniao_id", listaIds);

      setAcoesAnteriores(anteriores || []);
    } catch (err) {
      setAcoesAnteriores([]);
    }
  };

  // ✅ IA: usa app_prompts SIM (slug="ata_reuniao"). Se não achar, usa fallback.
  const handleRegenerateIA = async () => {
    const audioUrl = mediaUrls.audio || mediaUrls.video;
    if (!audioUrl || !window.confirm("Gerar novo resumo a partir do áudio da reunião?")) return;

    setIsGenerating(true);
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error("Falha ao baixar o arquivo de mídia.");

      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);

      reader.onloadend = async () => {
        try {
          const base64data = reader.result.split(",")[1];
          const model = getGeminiFlash();

          const titulo = selectedAta.titulo || "Ata da Reunião";
          const dataBR = selectedAta.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString("pt-BR") : "";

          // ✅ Fallback PROFISSIONAL (caso app_prompts esteja vazio)
          let promptTemplate = `
Você é uma secretária executiva experiente.
Gere uma **ATA PROFISSIONAL**, clara e legível em **Markdown**.

Regras obrigatórias:
- NÃO escreva "Certo" / "Claro" / "Aqui está a ata".
- Comece com:
  **{titulo}**
  **Data:** {data}
- Use exatamente estas seções (com títulos em negrito):
  ## **Resumo**
  ## **Decisões**
  ## **Ações**
- Use parágrafos curtos e listas quando fizer sentido.
- Destaque em **negrito** indicadores e números-chave (ex.: 98%, 91,11%).
- Não invente fatos. Use apenas o que estiver no áudio/vídeo.

`.trim();

          const { data: promptData } = await supabase
            .from("app_prompts")
            .select("prompt_text")
            .eq("slug", "ata_reuniao")
            .maybeSingle();

          if (promptData?.prompt_text) promptTemplate = promptData.prompt_text;

          const finalPrompt = promptTemplate.replace(/{titulo}/g, titulo).replace(/{data}/g, dataBR);
          const mimeType = blob.type || "video/mp4";

          const result = await model.generateContent([
            finalPrompt,
            { inlineData: { data: base64data, mimeType } },
          ]);

          const textoBruto = result.response.text();

          // ✅ pós-processamento para garantir padrão mesmo se o prompt falhar
          const textoFormatado = formatAtaMarkdown(textoBruto, { titulo, dataBR });

          await supabase.from("reunioes").update({ pauta: textoFormatado, ata_ia_status: "PRONTA" }).eq("id", selectedAta.id);

          setEditedPauta(textoFormatado);
          setIsEditing(false);
          setSelectedAta((prev) => ({ ...prev, pauta: textoFormatado, ata_ia_status: "PRONTA" }));
          setAtas((prev) => prev.map((a) => (a.id === selectedAta.id ? { ...a, pauta: textoFormatado, ata_ia_status: "PRONTA" } : a)));

          alert("Ata gerada e salva automaticamente!");
        } catch (err) {
          console.error(err);
          alert("Erro na IA: " + err.message);
        } finally {
          setIsGenerating(false);
        }
      };
    } catch (e) {
      alert("Erro download áudio: " + e.message);
      setIsGenerating(false);
    }
  };

  // --- RESTO DO CÓDIGO (vídeo, anexos, etc.) permanece igual ao seu, sem alterar regras ---
  // ✅ A partir daqui é seu arquivo original, só removi o handleRegenerateIA antigo e mantive o restante.
  // Para não “inventar” mudanças, eu mantive o seu layout e só mexi no que impacta a ATA.

  const handleSolicitarVideo = async () => {
    if (!selectedAta?.id) return;

    const GITHUB_USER = import.meta.env.VITE_GITHUB_USER;
    const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO;
    const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;

    if (!GITHUB_USER || !GITHUB_REPO || !GITHUB_TOKEN) {
      alert("ERRO DE CONFIGURAÇÃO:\nFaltam as variáveis de ambiente do GitHub no Render (VITE_GITHUB_...).");
      return;
    }

    if (selectedAta.gravacao_status === "CONCLUIDO") {
      if (!window.confirm("ATENÇÃO ADMIN:\nEsta reunião já possui vídeo. Deseja apagar o atual e gerar novamente?")) return;
    }

    setRequestingVideo(true);

    try {
      await supabase.from("reunioes").update({ gravacao_status: "PENDENTE" }).eq("id", selectedAta.id);

      await supabase
        .from("reuniao_processing_queue")
        .delete()
        .eq("reuniao_id", selectedAta.id)
        .eq("job_type", "RENDER_FIX");

      const { error } = await supabase.from("reuniao_processing_queue").insert([
        {
          reuniao_id: selectedAta.id,
          job_type: "RENDER_FIX",
          status: "FILA_GITHUB",
          log_text: "Solicitado Manualmente (Disparo Imediato)",
        },
      ]);

      if (error) throw error;

      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/actions/workflows/processar_video.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `Bearer ${GITHUB_TOKEN}`,
          },
          body: JSON.stringify({ ref: "main" }),
        }
      );

      if (!response.ok) {
        console.error("Falha ao chamar GitHub:", await response.text());
        alert("Salvo na fila! O GitHub iniciará no próximo ciclo (ou tente novamente para forçar o início).");
      } else {
        alert("🚀 Sucesso! O Robô do GitHub foi acionado e já vai começar.");
      }

      setSelectedAta((prev) => ({ ...prev, gravacao_status: "PENDENTE" }));
      setAtas((prev) => prev.map((a) => (a.id === selectedAta.id ? { ...a, gravacao_status: "PENDENTE" } : a)));
      checkAutoRefresh({ ...selectedAta, gravacao_status: "PENDENTE" });
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setRequestingVideo(false);
    }
  };

  const handleNovaAcao = async () => {
    if (!selectedAta?.id) return;
    const { data, error } = await supabase
      .from("acoes")
      .insert([
        {
          reuniao_id: selectedAta.id,
          status: "Aberta",
          descricao: "Nova Ação",
          data_criacao: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    setAcaoParaModal(data);
  };

  const handleSaveAta = async () => {
    const { error } = await supabase.from("reunioes").update({ pauta: editedPauta, ata_manual: ataManual }).eq("id", selectedAta.id);

    if (!error) {
      setIsEditing(false);
      setSelectedAta((prev) => ({ ...prev, pauta: editedPauta, ata_manual: ataManual }));
      setAtas((prev) => prev.map((a) => (a.id === selectedAta.id ? { ...a, pauta: editedPauta, ata_manual: ataManual } : a)));
      alert("Ata salva com sucesso!");
    } else {
      alert("Erro ao salvar ata: " + error.message);
    }
  };

  const handleUploadMaterial = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingMaterial(true);
    try {
      const novosMateriais = [];
      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${selectedAta.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
        const filePath = `anexos/${fileName}`;
        const { error: uploadErr } = await supabase.storage.from("materiais").upload(filePath, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("materiais").getPublicUrl(filePath);
        if (urlData?.publicUrl) novosMateriais.push({ name: file.name, url: urlData.publicUrl, type: file.type, path: filePath });
      }
      const listaFinal = [...(selectedAta.materiais || []), ...novosMateriais];
      await supabase.from("reunioes").update({ materiais: listaFinal }).eq("id", selectedAta.id);
      setSelectedAta((p) => ({ ...p, materiais: listaFinal }));
      setAtas((p) => p.map((a) => (a.id === selectedAta.id ? { ...a, materiais: listaFinal } : a)));
      alert("Material anexado!");
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingMaterial(false);
      e.target.value = null;
    }
  };

  const handleDeleteMaterial = async (indexToDelete) => {
    if (!window.confirm("Remover anexo?")) return;
    try {
      const novaLista = (selectedAta.materiais || []).filter((_, i) => i !== indexToDelete);
      await supabase.from("reunioes").update({ materiais: novaLista }).eq("id", selectedAta.id);
      setSelectedAta((p) => ({ ...p, materiais: novaLista }));
      setAtas((p) => p.map((a) => (a.id === selectedAta.id ? { ...a, materiais: novaLista } : a)));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteClick = () => setShowDeleteAuth(true);

  const confirmarExclusao = async () => {
    if (!delLogin || !delSenha) return alert("Informe Login e Senha.");
    setDeleting(true);
    try {
      const { data: usuario, error: errAuth } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("*")
        .eq("login", delLogin)
        .eq("senha", delSenha)
        .eq("ativo", true)
        .maybeSingle();
      if (errAuth || !usuario || usuario.nivel !== "Administrador") {
        alert("Apenas Administradores.");
        setDeleting(false);
        return;
      }
      await supabase.from("reunioes").delete().eq("id", selectedAta.id);
      alert("Excluída.");
      window.location.reload();
    } catch (e) {
      alert(e.message);
      setDeleting(false);
    }
  };

  const atasFiltradas = useMemo(() => {
    return atas.filter((a) => (a.titulo || "").toLowerCase().includes(busca.toLowerCase()));
  }, [atas, busca]);

  const getFileName = (path) => (path ? path.split("/").pop() : "Arquivo desconhecido");

  const getStatusBadge = (status) => {
    const st = String(status || "").toUpperCase();
    if (st === "CONCLUIDO")
      return <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-bold border border-green-200">PRONTO</span>;
    if (st.includes("PROCESSANDO") || st.includes("RENDER"))
      return <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-bold border border-blue-200 animate-pulse">PROCESSANDO</span>;
    if (st === "PENDENTE")
      return <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-200">NA FILA</span>;
    return <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded font-bold border border-slate-200">AGUARDANDO</span>;
  };

  const iaStatusNorm = String(selectedAta?.ata_ia_status || "").toUpperCase();
  const badgeClass = (tone) =>
    ({
      green: "bg-green-100 text-green-700 border-green-200",
      blue: "bg-blue-100 text-blue-700 border-blue-200",
      red: "bg-red-100 text-red-700 border-red-200",
      gray: "bg-slate-100 text-slate-700 border-slate-200",
    }[tone] || "bg-slate-100 text-slate-700 border-slate-200");

  return (
    <Layout>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
        {/* OVERLAY EXCLUSÃO */}
        {showDeleteAuth && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur flex items-center justify-center">
            <div className="bg-white p-6 rounded shadow-xl border border-red-200">
              <h3 className="text-lg font-bold text-red-600 mb-4">Confirmar Exclusão</h3>
              <input className="border p-2 w-full mb-2 rounded" placeholder="Login" value={delLogin} onChange={(e) => setDelLogin(e.target.value)} />
              <input className="border p-2 w-full mb-4 rounded" type="password" placeholder="Senha" value={delSenha} onChange={(e) => setDelSenha(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteAuth(false)} className="flex-1 p-2 bg-slate-100 rounded">
                  Cancelar
                </button>
                <button onClick={confirmarExclusao} className="flex-1 p-2 bg-red-600 text-white rounded">
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ MODAL CINEMA (VÍDEO) */}
        {isVideoModalOpen && mediaUrls.video && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-200">
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
              <div>
                <h2 className="text-white font-bold text-lg drop-shadow-md">{selectedAta?.titulo}</h2>
                <p className="text-white/60 text-xs font-mono">{getFileName(selectedAta?.gravacao_path)}</p>
              </div>
              <button onClick={() => setIsVideoModalOpen(false)} className="text-white hover:text-red-400 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="w-full h-full p-4 flex items-center justify-center">
              <video controls autoPlay className="w-full h-full object-contain max-h-screen">
                <source src={mediaUrls.video} type="video/webm" />
              </video>
            </div>
          </div>
        )}

        {/* SIDEBAR */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Layers size={20} className="text-blue-600" /> Atas
            </h2>
            <input className="mt-4 w-full bg-slate-50 border p-2 rounded text-sm" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {atasFiltradas.map((ata) => (
              <button
                key={ata.id}
                onClick={() => setSelectedAta(ata)}
                className={`w-full text-left p-4 border-b ${selectedAta?.id === ata.id ? "bg-blue-50 border-l-4 border-l-blue-600" : "hover:bg-slate-50"}`}
              >
                <h3 className="font-bold text-sm text-slate-700">{ata.titulo}</h3>
                <span className="text-xs text-slate-400">{new Date(ata.data_hora).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 custom-scrollbar relative">
          {selectedAta ? (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* HEADER ATA */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-blue-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle size={14} /> Ata Oficial
                      </span>
                      {getStatusBadge(selectedAta.gravacao_status)}
                    </div>

                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      {selectedAta.ata_ia_status && (
                        <span
                          className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase border flex items-center gap-1 w-fit ${
                            iaStatusNorm === "PRONTO" || iaStatusNorm === "PRONTA"
                              ? badgeClass("green")
                              : iaStatusNorm.includes("PROCESSANDO") || iaStatusNorm.includes("PENDENTE")
                              ? badgeClass("blue")
                              : iaStatusNorm === "ERRO"
                              ? badgeClass("red")
                              : badgeClass("gray")
                          }`}
                        >
                          {(iaStatusNorm.includes("PROCESSANDO") || iaStatusNorm.includes("PENDENTE")) && <Loader2 size={10} className="animate-spin" />}
                          IA: {selectedAta.ata_ia_status}
                        </span>
                      )}
                    </div>

                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedAta.titulo}</h1>

                    <div className="flex flex-col gap-1 text-sm text-slate-500 mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={16} className="text-slate-400" />{" "}
                          {selectedAta.gravacao_inicio ? new Date(selectedAta.gravacao_inicio).toLocaleDateString() : "Data N/A"}
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Clock size={16} className="text-slate-400" />
                          {selectedAta.gravacao_inicio ? new Date(selectedAta.gravacao_inicio).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"} {" - "}
                          {selectedAta.gravacao_fim ? new Date(selectedAta.gravacao_fim).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                        </span>
                      </div>

                      {selectedAta.gravacao_inicio && selectedAta.gravacao_fim && (
                        <div className="text-red-600 font-bold text-xs flex items-center gap-1 mt-1">
                          <span>Essa reunião teve duração de:</span>
                          <span className="text-sm">{calculateRealDuration(selectedAta.gravacao_inicio, selectedAta.gravacao_fim)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-slate-100 rounded hover:bg-slate-200">
                      <Edit3 size={18} />
                    </button>
                    <button onClick={handleDeleteClick} className="p-2 bg-slate-100 rounded hover:text-red-600">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* VÍDEO */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                        <PlayCircle size={14} /> Gravação Compilada
                      </div>
                      {mediaUrls.video && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500 font-mono border border-slate-200" title="Nome do arquivo no servidor">
                          <FileVideo size={10} /> {getFileName(selectedAta.gravacao_path)}
                        </div>
                      )}
                    </div>

                    {mediaUrls.video && (
                      <button onClick={() => setIsVideoModalOpen(true)} className="text-xs flex items-center gap-1 text-blue-600 font-bold hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-blue-100 transition-all">
                        <Maximize2 size={14} /> Modo Cinema
                      </button>
                    )}
                  </div>

                  {mediaUrls.video ? (
                    <div className="space-y-3">
                      <div className="relative group rounded-xl overflow-hidden bg-black shadow-lg border border-slate-200">
                        <video key={mediaUrls.video} className="w-full max-h-[400px] object-contain bg-black" preload="metadata" controls>
                          <source src={mediaUrls.video} type="video/webm" />
                          <source src={mediaUrls.video} type="video/mp4" />
                          Seu navegador não conseguiu reproduzir este vídeo.
                        </video>
                      </div>

                      <div className="flex justify-between items-center">
                        <a href={mediaUrls.video} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1">
                          <ExternalLink size={12} /> Baixar Vídeo
                        </a>

                        {isAdmin && (
                          <button onClick={handleSolicitarVideo} className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1 border border-transparent hover:border-red-200 px-2 py-1 rounded transition-colors" title="Admin: Refazer processamento">
                            <RefreshCw size={10} /> Refazer Compilação
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
                        {String(selectedAta.gravacao_status || "").includes("PROCESSANDO") ? (
                          <>
                            <div className="p-4 bg-blue-100 rounded-full text-blue-600 animate-spin">
                              <Loader2 size={32} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-700">Processando Vídeo...</h4>
                              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">O GitHub está trabalhando na compressão. Aguarde...</p>
                            </div>
                          </>
                        ) : String(selectedAta.gravacao_status || "").includes("PENDENTE") ? (
                          <>
                            <div className="p-4 bg-amber-100 rounded-full text-amber-600 animate-pulse">
                              <Hourglass size={32} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-700">Na Fila de Espera</h4>
                              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">Solicitado! O Robô iniciará no próximo ciclo (máx 10min).</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="p-4 bg-slate-200 rounded-full text-slate-400">
                              <Video size={32} />
                            </div>
                            <p>Vídeo completo não disponível.</p>
                          </>
                        )}
                      </div>

                      {(isAdmin || !selectedAta.gravacao_status || selectedAta.gravacao_status === "ERRO") &&
                        !String(selectedAta.gravacao_status || "").includes("PROCESSANDO") && (
                          <button
                            onClick={handleSolicitarVideo}
                            disabled={requestingVideo || selectedAta.gravacao_status === "PENDENTE"}
                            className={`w-full py-4 rounded-xl shadow-lg flex items-center justify-center gap-3 font-bold text-sm transition-all transform active:scale-[0.98] ${
                              selectedAta.gravacao_status === "PENDENTE"
                                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                            }`}
                          >
                            {requestingVideo ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                            {requestingVideo ? "Solicitando..." : selectedAta.gravacao_status === "PENDENTE" ? "Aguarde o início..." : "Gerar/Refazer Vídeo Completo"}
                          </button>
                        )}
                    </div>
                  )}
                </div>

                {/* ÁUDIO + IA */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <Headphones size={14} /> Player de Áudio
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      {mediaUrls.audio ? (
                        <CustomAudioPlayer src={mediaUrls.audio} durationDb={selectedAta.duracao_segundos} />
                      ) : (
                        <div className="p-3 bg-slate-50 border rounded text-xs text-slate-400">Sem áudio.</div>
                      )}
                    </div>

                    {mediaUrls.audio && !isEditing && (
                      <button
                        onClick={handleRegenerateIA}
                        disabled={isGenerating}
                        className="h-10 text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 disabled:opacity-50 hover:bg-indigo-200 transition-colors"
                      >
                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
                        Gerar Resumo IA
                      </button>
                    )}
                  </div>
                </div>

                {/* ANEXOS */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                      <Paperclip size={14} /> Materiais e Anexos
                    </div>
                    <label
                      className={`cursor-pointer text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 flex items-center gap-2 transition-all ${
                        uploadingMaterial ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      {uploadingMaterial ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      {uploadingMaterial ? "Enviando..." : "Anexar Material"}
                      <input type="file" multiple className="hidden" onChange={handleUploadMaterial} disabled={uploadingMaterial} />
                    </label>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    {selectedAta.materiais && selectedAta.materiais.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectedAta.materiais.map((item, idx) => {
                          const isImage = item.type?.startsWith("image");
                          return (
                            <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isImage ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}>
                                  {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-700 truncate" title={item.name}>
                                    {item.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 uppercase">Anexo</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <a href={item.url} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                                  <Download size={16} />
                                </a>
                                <button onClick={() => handleDeleteMaterial(idx)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-400 text-xs italic">Nenhum material anexado.</div>
                    )}
                  </div>
                </div>

                {/* PAUTA MARKDOWN */}
                <div className="mt-2">
                  {isEditing ? (
                    <textarea className="w-full h-64 p-4 border rounded-xl bg-slate-50 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={editedPauta} onChange={(e) => setEditedPauta(e.target.value)} />
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white/60 p-5">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        className="prose prose-slate max-w-none
                          prose-h1:text-2xl prose-h2:text-xl
                          prose-p:my-4 prose-li:my-2 prose-ul:my-3 prose-ol:my-3
                          prose-strong:text-slate-900 prose-a:text-blue-700"
                      >
                        {formatAtaMarkdown(selectedAta.pauta || "", {
                          titulo: selectedAta.titulo || "Ata da Reunião",
                          dataBR: selectedAta.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString("pt-BR") : "",
                        }) || "Sem resumo."}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>

              {/* AÇÕES / ATA MANUAL (mantive igual ao seu código anterior) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div> Ações Definidas
                    </h3>
                    <button
                      onClick={handleNovaAcao}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md transition-all active:scale-95"
                    >
                      <Plus size={14} /> Nova Ação
                    </button>
                  </div>
                  <div className="flex-1 space-y-2">
                    {acoesCriadas.map((acao) => (
                      <div
                        key={acao.id}
                        onClick={() => setAcaoParaModal(acao)}
                        className={`p-3 border rounded-lg cursor-pointer hover:shadow-md transition-all group ${
                          acao.status === "Concluída" ? "bg-slate-50 opacity-60" : "bg-white border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1.5 w-2 h-2 rounded-full ${acao.status === "Concluída" ? "bg-green-500" : "bg-blue-500"}`} />
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${acao.status === "Concluída" ? "line-through text-slate-400" : "text-slate-800"}`}>{acao.descricao}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <User size={10} /> {acao.responsavel}
                              </span>
                              {acao.data_vencimento && (
                                <span className="text-[10px] text-red-500 flex items-center gap-1">
                                  <Clock size={10} /> {new Date(acao.data_vencimento).toLocaleDateString()}
                                </span>
                              )}
                              {acao.fotos && acao.fotos.length > 0 && (
                                <span className="text-[10px] text-blue-500 flex items-center gap-1">
                                  <ImageIcon size={10} /> {acao.fotos.length}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {acoesCriadas.length === 0 && <p className="text-center text-xs text-slate-400 py-4 italic">Nenhuma ação criada.</p>}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div> Pendências Anteriores
                  </h3>
                  <div className="flex-1 space-y-2">
                    {acoesAnteriores.map((acao) => (
                      <div
                        key={acao.id}
                        onClick={() => setAcaoParaModal(acao)}
                        className="p-3 bg-amber-50/30 border border-amber-100 rounded-lg cursor-pointer hover:bg-amber-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1.5 w-2 h-2 rounded-full bg-amber-500" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{acao.descricao}</p>
                            <p className="text-[10px] text-amber-600 mt-1">Origem: {acao.data_criacao ? new Date(acao.data_criacao).toLocaleDateString() : "-"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {acoesAnteriores.length === 0 && <p className="text-center text-xs text-slate-400 py-4 italic">Tudo em dia!</p>}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <StickyNote size={18} /> Ata Manual / Observações
                </h3>
                <textarea
                  className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none"
                  value={ataManual}
                  onChange={(e) => setAtaManual(e.target.value)}
                  disabled={!isEditing}
                  placeholder="Notas manuais da reunião escritas no Copiloto..."
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Layers size={64} className="opacity-20 mb-4" />
              <p>Selecione uma Ata</p>
            </div>
          )}
        </div>

        {/* MODAL */}
        {acaoParaModal && (
          <ModalDetalhesAcao
            aberto={!!acaoParaModal}
            acao={acaoParaModal}
            status={acaoParaModal.status}
            onClose={() => setAcaoParaModal(null)}
            onAfterSave={() => carregarDetalhes(selectedAta)}
            onAfterDelete={() => carregarDetalhes(selectedAta)}
            onConcluir={async () => {
              await supabase.from("acoes").update({ status: "Concluída", data_conclusao: new Date().toISOString() }).eq("id", acaoParaModal.id);
              carregarDetalhes(selectedAta);
            }}
          />
        )}
      </div>
    </Layout>
  );
}

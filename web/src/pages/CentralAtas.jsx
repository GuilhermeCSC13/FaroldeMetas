// @ts-ignore
// src/pages/CentralAtas.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";

// --- TIPOS ---
interface Ata {
  id: string;
  titulo: string;
  data_hora: string;
  status: string;
  gravacao_status?: string;
  pauta?: string;
  ata_ia_status?: string;
  gravacao_path?: string;
  gravacao_bucket?: string;
  gravacao_audio_path?: string;
  gravacao_audio_bucket?: string;
  duracao_segundos?: number;
  materiais?: any[];
  ata_manual?: string;
}

interface Acao {
  id: string;
  descricao: string;
  responsavel?: string;
  status?: string;
  data_vencimento?: string;
  data_criacao?: string;
  fotos?: any[];
}
import Layout from "../components/tatico/Layout";
import { supabase, supabaseInove } from "../supabaseClient";
import { getGeminiFlash } from "../services/gemini";
import ModalDetalhesAcao from "../components/tatico/ModalDetalhesAcao";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
function cleanLeadingSalutation(md) {
  let t = String(md || "").replace(/\r\n/g, "\n").trim();
  // remove linhas iniciais tipo "Certo, aqui está a ATA..."
  t = t.replace(/^(certo|claro)[^\n]*\n+/gim, "");
  t = t.replace(/^(aqui\s+est[aá]\s+a\s+ata[^\n]*)\n+/gim, "");
  t = t.trim();
  return t;
}

function ensureSpacing(md) {
  return String(md || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function boldSectionTitles(md) {
  // transforma "1. Resumo" -> "## **Resumo**"
  // transforma "2. Decisões" -> "## **Decisões**"
  // transforma "3. Ações" -> "## **Ações**"
  let t = String(md || "");

  const map = [
    { re: /^\s*(\d+)\s*[\.\)]\s*Resumo\s*$/gim, rep: "## **Resumo**" },
    { re: /^\s*(\d+)\s*[\.\)]\s*Decis(õ|o)es\s*$/gim, rep: "## **Decisões**" },
    { re: /^\s*(\d+)\s*[\.\)]\s*A(ç|c)oes\s*$/gim, rep: "## **Ações**" },

    // se vier em negrito solto
    { re: /^\s*\*\*Resumo\*\*\s*$/gim, rep: "## **Resumo**" },
    { re: /^\s*\*\*Decis(õ|o)es\*\*\s*$/gim, rep: "## **Decisões**" },
    { re: /^\s*\*\*A(ç|c)oes\*\*\s*$/gim, rep: "## **Ações**" },

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

  // cabeçalho padrão:
  // # Título
  // **Data:** dd/mm/aaaa
  // (em markdown, bem renderizado no ReactMarkdown)
  let header = "";
  if (safeTitulo) header += `# ${safeTitulo}\n`;
  if (safeData) header += `**Data:** ${safeData}\n`;

  // remove duplicação de título/data no começo se houver
  const lines = t.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const first = (lines[i] || "").trim();

  const startsWithHeading = /^#{1,6}\s+/.test(first);
  const startsWithDBO = /^d\s*b\s*o\s*[\-–—]/i.test(first) || /^dbo\b/i.test(first);

  if (!startsWithHeading) {
    // se começa com DBO ou com o título solto, substitui por header
    if (startsWithDBO) {
      // corta linhas iniciais até achar a primeira seção
      let cut = i;
      let guard = 0;
      while (cut < lines.length && guard < 10) {
        const s = (lines[cut] || "").trim();
        if (!s) {
          cut++;
          guard++;
          continue;
        }
        if (/^(##\s*)?\*?\*?(1\.)?\s*Resumo/i.test(s)) break;
        if (/^(##\s*)?\*?\*?(2\.)?\s*Decis/i.test(s)) break;
        if (/^(##\s*)?\*?\*?(3\.)?\s*A(ç|c)oes/i.test(s)) break;
        cut++;
        guard++;
      }
      const rest = lines.slice(cut).join("\n").trim();
      t = `${header}\n${rest}`.trim();
    } else {
      // prefixa se não tem Data cedo
      const hasEarlyDate = lines.slice(0, Math.min(lines.length, 8)).some((l) => /^\s*data\s*:/i.test(l));
      if (!hasEarlyDate && (safeTitulo || safeData)) {
        t = `${header}\n${t}`.trim();
      }
    }
  }

  // normaliza "Data:" perdida
  t = t.replace(/^\s*data\s*:\s*(.+)$/gim, (_, v) => `**Data:** ${String(v).trim()}`);

  return t.trim();
}

function enforceParagraphBreaks(md) {
  // ✅ O pulo do gato: Markdown ignora newline simples.
  // Aqui a gente transforma "linhas comuns" em parágrafos reais,
  // preservando headings (#/##), listas (-/*/1.), blockquote, etc.
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];

  const isSpecialLine = (s) => {
    const t = s.trim();
    if (!t) return true; // já é separador
    if (/^#{1,6}\s+/.test(t)) return true; // headings
    if (/^(\-|\*|\+)\s+/.test(t)) return true; // listas
    if (/^\d+\.\s+/.test(t)) return true; // listas numeradas
    if (/^>\s+/.test(t)) return true; // blockquote
    if (/^---$/.test(t)) return true; // hr
    if (/^\*\*Data:\*\*/.test(t)) return true; // linha de data
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const next = lines[i + 1];

    out.push(cur);

    const curTrim = cur.trim();
    const nextTrim = (next || "").trim();

    if (!curTrim) continue; // já tem quebra
    if (!nextTrim) continue; // próxima já é quebra
    if (isSpecialLine(cur) || isSpecialLine(next)) continue;

    // Se são duas linhas "normais", coloca uma linha em branco entre elas
    out.push("");
  }

  return ensureSpacing(out.join("\n"));
}

function negritarPercentuais(md) {
  let t = String(md || "");
  // 98% -> **98%**
  t = t.replace(/(\b\d{1,3})\s*%/g, "**$1%**");
  // 91,11% já fica coberto pelo acima (pega 91 e sobra ,11%),
  // então tratamos percentuais com decimal:
  t = t.replace(/(\b\d{1,3}(?:[.,]\d{1,2})?)\s*%/g, "**$1%**");
  return t;
}

function normalizeSectionsContent(md) {
  // Remove duplicações tipo "Ações" repetido várias vezes no final
  // e evita acrescentar placeholders se já houver conteúdo.
  let t = String(md || "").trim();

  // remove repetição de headings iguais seguidas (ex: ## **Ações** ... ## **Ações**)
  t = t.replace(/(##\s+\*\*A(ç|c)oes\*\*\s*\n)(\s*\n)*(##\s+\*\*A(ç|c)oes\*\*\s*\n)/gim, "$1");
  t = t.replace(/(##\s+\*\*Decis(õ|o)es\*\*\s*\n)(\s*\n)*(##\s+\*\*Decis(õ|o)es\*\*\s*\n)/gim, "$1");
  t = t.replace(/(##\s+\*\*Resumo\*\*\s*\n)(\s*\n)*(##\s+\*\*Resumo\*\*\s*\n)/gim, "$1");

  return ensureSpacing(t);
}

function ensureMinimumSections(md) {
  let t = String(md || "").trim();

  const hasResumo = /##\s+\*\*Resumo\*\*/i.test(t);
  const hasDecisoes = /##\s+\*\*Decis(õ|o)es\*\*/i.test(t);
  const hasAcoes = /##\s+\*\*A(ç|c)oes\*\*/i.test(t);

  if (!hasResumo) t = `${t}\n\n## **Resumo**\n\n—`;
  if (!hasDecisoes) t = `${t}\n\n## **Decisões**\n\n*Nenhuma decisão foi formalizada nesta reunião.*`;
  if (!hasAcoes) t = `${t}\n\n## **Ações**\n\n*Nenhuma ação foi definida nesta reunião.*`;

  return ensureSpacing(t);
}

function bulletizeAcoesSection(md) {
  // Se a IA vier com "Ações" e linhas soltas, transforma em bullets.
  let t = String(md || "");

  const split = t.split(/##\s+\*\*A(ç|c)oes\*\*/i);
  if (split.length < 2) return t;

  const before = split[0];
  const after = "## **Ações**" + split.slice(1).join("## **Ações**");

  const parts = after.split(/\n/);
  const out = [];
  let inAcoes = false;

  for (let i = 0; i < parts.length; i++) {
    const line = parts[i];
    const trim = line.trim();

    if (/^##\s+\*\*A(ç|c)oes\*\*/i.test(trim)) {
      inAcoes = true;
      out.push(line);
      continue;
    }
    if (inAcoes && /^##\s+\*\*/.test(trim)) {
      // saiu da seção
      inAcoes = false;
      out.push(line);
      continue;
    }

    if (inAcoes) {
      if (!trim) {
        out.push(line);
        continue;
      }
      if (/^(\-|\*|\+)\s+/.test(trim) || /^\d+\.\s+/.test(trim) || /^_/.test(trim) || /^\*/.test(trim)) {
        out.push(line);
        continue;
      }
      // linha normal -> vira bullet
      out.push(`- ${trim}`);
      continue;
    }

    out.push(line);
  }

  return ensureSpacing(before.trim() + "\n\n" + out.join("\n").trim());
}

function formatAtaMarkdown(raw, { titulo, dataBR } = {}) {
  let t = cleanLeadingSalutation(raw);

  t = normalizeTitleAndDate(t, { titulo, dataBR });
  t = boldSectionTitles(t);
  t = normalizeSectionsContent(t);

  // ✅ garante espaçamento real (resolve "grudado")
  t = enforceParagraphBreaks(t);

  // ✅ negrita percentuais/números-chave
  t = negritarPercentuais(t);

  // ✅ garante seções mínimas sem duplicar
  t = ensureMinimumSections(t);

  // ✅ organiza Ações em lista quando vier "linhas soltas"
  t = bulletizeAcoesSection(t);

  return ensureSpacing(t);
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
  };

  const toggleMute = () => setIsMuted(!isMuted);

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleEnded = () => setIsPlaying(false);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-4">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        muted={isMuted}
      />

      <button onClick={togglePlay} className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>

      <div className="flex-1">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={(e) => {
            if (audioRef.current) audioRef.current.currentTime = parseFloat(e.target.value);
          }}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <button onClick={toggleMute} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function CentralAtas() {
  const [atas, setAtas] = useState<Ata[]>([]);
  const [selectedAta, setSelectedAta] = useState<Ata | null>(null);
  const [busca, setBusca] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedPauta, setEditedPauta] = useState("");
  const [ataManual, setAtaManual] = useState("");
  const [acoesCriadas, setAcoesCriadas] = useState<Acao[]>([]);
  const [acoesAnteriores, setAcoesAnteriores] = useState<Acao[]>([]);
  const [acaoParaModal, setAcaoParaModal] = useState<Acao | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [requestingVideo, setRequestingVideo] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [showDeleteAuth, setShowDeleteAuth] = useState(false);
  const [delLogin, setDelLogin] = useState("");
  const [delSenha, setDelSenha] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [mediaUrls, setMediaUrls] = useState({ video: null, audio: null });
  const ataExportRef = useRef(null);
  const pollingRef = useRef(null);

  const isAdmin = true; // Mock admin status

  useEffect(() => {
    fetchAtas();
  }, []);

  useEffect(() => {
    if (selectedAta) {
      carregarDetalhes(selectedAta);
      checkAutoRefresh(selectedAta);
      hydrateMediaUrls(selectedAta);
      if (selectedAta.pauta) {
        const dataBR = selectedAta.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString("pt-BR") : "";
        setEditedPauta(
          formatAtaMarkdown(selectedAta.pauta, {
            titulo: selectedAta.titulo || "Ata da Reunião",
            dataBR,
          })
        );
      }
    }
  }, [selectedAta?.id]);

  const stopPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
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
    // Mock data
    const mockAtas = [
      {
        id: "1",
        titulo: "Reunião de Planejamento Q1",
        data_hora: new Date().toISOString(),
        status: "Realizada",
        gravacao_status: "CONCLUIDO",
        pauta: "# Reunião de Planejamento\n\n## **Resumo**\n\nDiscussão sobre objetivos do trimestre.\n\n## **Decisões**\n\n- Aprovar orçamento de 50%\n- Expandir equipe\n\n## **Ações**\n\n- Preparar documentação\n- Validar requisitos",
        ata_ia_status: "PRONTA",
      },
    ];
    setAtas(mockAtas);
    if (mockAtas.length > 0) setSelectedAta(mockAtas[0]);
  };

  const carregarDetalhes = async (ata) => {
    setAcoesCriadas([
      {
        id: "1",
        descricao: "Preparar documentação",
        responsavel: "João Silva",
        status: "Aberta",
        data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]);
    setAcoesAnteriores([]);
  };

  const handleRegenerateIA = async () => {
    const audioUrl = mediaUrls.audio || mediaUrls.video;
    if (!audioUrl || !window.confirm("Gerar novo resumo a partir do áudio da reunião?")) return;

    setIsGenerating(true);
    try {
      const model = getGeminiFlash();
      const titulo = selectedAta.titulo || "Ata da Reunião";
      const dataBR = selectedAta.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString("pt-BR") : "";

      const result = await model.generateContent([
        `Gere uma ATA profissional em Markdown para: ${titulo}`,
      ]);

      const textoBruto = result.response.text();
      const textoFormatado = formatAtaMarkdown(textoBruto, { titulo, dataBR });

      setEditedPauta(textoFormatado);
      setIsEditing(false);
      alert("Ata gerada com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro na IA: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGerarPDF = async () => {
    try {
      if (!ataExportRef.current) return alert("Área da ATA não encontrada para exportar.");
      setGeneratingPdf(true);

      const el = ataExportRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 10000,
        removeContainer: true,
      });

      if (!canvas) throw new Error("Falha ao gerar canvas");
      const imgData = canvas.toDataURL("image/png", 1.0);
      if (!imgData || imgData.length < 100) throw new Error("Imagem gerada inválida");

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let y = margin;
      let remainingHeight = imgHeight;

      pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);

      remainingHeight -= pageHeight - margin * 2;

      while (remainingHeight > 0) {
        pdf.addPage();
        y = margin - (imgHeight - remainingHeight);
        pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);
        remainingHeight -= pageHeight - margin * 2;
      }

      const titulo = (selectedAta?.titulo || "Ata").replace(/[\\/:*?"<>|]/g, " ").trim();
      const dataBR = selectedAta?.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString("pt-BR") : "";
      const fileName = `ATA - ${titulo}${dataBR ? " - " + dataBR : ""}.pdf`;

      pdf.save(fileName);
      alert("PDF gerado com sucesso!");
    } catch (e) {
      console.error("Erro ao gerar PDF:", e);
      alert("Erro ao gerar PDF: " + (e?.message || "Falha desconhecida"));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSolicitarVideo = async () => {
    alert("Funcionalidade de vídeo não disponível nesta versão de demonstração.");
  };

  const handleNovaAcao = async () => {
    if (!selectedAta?.id) return;
    setAcaoParaModal({
      id: Date.now().toString(),
      descricao: "Nova Ação",
      status: "Aberta",
    });
  };

  const handleSaveAta = async () => {
    alert("Ata salva com sucesso!");
    setIsEditing(false);
  };

  const handleUploadMaterial = async (e) => {
    alert("Upload de materiais não disponível nesta versão de demonstração.");
  };

  const handleDeleteMaterial = async (indexToDelete) => {
    if (!window.confirm("Remover anexo?")) return;
  };

  const handleDeleteClick = () => setShowDeleteAuth(true);

  const confirmarExclusao = async () => {
    if (!delLogin || !delSenha) return alert("Informe Login e Senha.");
    alert("Funcionalidade de exclusão não disponível nesta versão de demonstração.");
  };

  const atasFiltradas = useMemo(() => {
    return atas.filter((a) => (a.titulo || "").toLowerCase().includes(busca.toLowerCase()));
  }, [atas, busca]);

  const getFileName = (path: string | undefined) => (path ? path.split("/").pop() : "Arquivo desconhecido");

  const getStatusBadge = (status: string) => {
    const st = String(status || "").toUpperCase();
    if (st === "CONCLUIDO")
      return <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-bold border border-green-200">PRONTO</span>;
    if (st.includes("PROCESSANDO") || st.includes("RENDER"))
      return <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-bold border border-blue-200 animate-pulse">PROCESSANDO</span>;
    if (st === "PENDENTE")
      return <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-200">NA FILA</span>;
    return <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded font-bold border border-slate-200">AGUARDANDO</span>;
  };

  const badgeClass = (tone: string) =>
    ({
      green: "bg-green-100 text-green-700 border-green-200",
      blue: "bg-blue-100 text-blue-700 border-blue-200",
      red: "bg-red-100 text-red-700 border-red-200",
      gray: "bg-slate-100 text-slate-700 border-slate-200",
    }[tone] || "bg-slate-100 text-slate-700 border-slate-200");

  const iaStatusNorm = String(selectedAta?.ata_ia_status || "").toUpperCase();

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
                <button onClick={confirmarExclusao} className="flex-1 p-2 bg-red-600 text-white rounded" disabled={deleting}>
                  {deleting ? "Excluindo..." : "Excluir"}
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
                          <Calendar size={16} className="text-slate-400" /> {new Date(selectedAta.data_hora).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={handleGerarPDF} disabled={generatingPdf} className="p-2 bg-slate-100 rounded hover:bg-slate-200" title="Gerar PDF da ATA">
                      {generatingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    </button>

                    <button onClick={() => setIsEditing(!isEditing)} className="p-2 bg-slate-100 rounded hover:bg-slate-200" title="Editar">
                      <Edit3 size={18} />
                    </button>
                    <button onClick={handleDeleteClick} className="p-2 bg-slate-100 rounded hover:text-red-600" title="Excluir">
                      <Trash2 size={18} />
                    </button>
                  </div>
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

                {/* PAUTA MARKDOWN */}
                <div className="mt-2">
                  {isEditing ? (
                    <textarea
                      className="w-full h-64 p-4 border rounded-xl bg-slate-50 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editedPauta}
                      onChange={(e) => setEditedPauta(e.target.value)}
                    />
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white/60 p-5">
                      <div ref={ataExportRef} className="bg-white p-6">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({node, ...props}) => (
                              <h1 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b border-blue-400" {...props} />
                            ),
                            h2: ({node, ...props}) => (
                              <h2 className="text-lg font-bold text-blue-700 mt-6 mb-3" {...props} />
                            ),
                            p: ({node, ...props}) => (
                              <p className="text-slate-700 text-sm leading-relaxed mb-3" {...props} />
                            ),
                            ul: ({node, ...props}) => (
                              <ul className="space-y-2 ml-4 mb-4" {...props} />
                            ),
                            ol: ({node, ...props}) => (
                              <ol className="space-y-2 ml-4 mb-4" {...props} />
                            ),
                            li: ({node, ...props}) => (
                              <li className="flex items-start gap-2 text-slate-700 text-sm">
                                <span className="text-blue-600 font-bold mt-0.5">•</span>
                                <span {...props} />
                              </li>
                            ),
                            strong: ({node, ...props}) => (
                              <strong className="font-bold text-slate-900" {...props} />
                            ),
                            em: ({node, ...props}) => (
                              <em className="italic text-slate-600" {...props} />
                            ),
                          }}
                        >
                          {formatAtaMarkdown(selectedAta.pauta || "", {
                            titulo: selectedAta.titulo || "Ata da Reunião",
                            dataBR: selectedAta.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString("pt-BR") : "",
                          }) || "Sem resumo."}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleSaveAta}
                      className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors"
                    >
                      Salvar Alterações
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 p-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-bold transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              {/* AÇÕES */}
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
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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
                  placeholder="Notas manuais da reunião..."
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
              setAcaoParaModal(null);
              carregarDetalhes(selectedAta);
            }}
          />
        )}
      </div>
    </Layout>
  );
}

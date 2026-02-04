// src/pages/CentralAtas.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
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
  const [atas, setAtas] = useState([]);
  const [selectedAta, setSelectedAta] = useState(null);
  const [busca, setBusca] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedPauta, setEditedPauta] = useState("");
  const [ataManual, setAtaManual] = useState("");
  const [acoesCriadas, setAcoesCriadas] = useState([]);
  const [acoesAnteriores, setAcoesAnteriores] = useState([]);
  const [acaoParaModal, setAcaoParaModal] = useState(null);
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

  // ✅ PDF: exporta SOMENTE a área da ATA (markdown) - VERSÃO CORRIGIDA
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

  // ===== RESTO DO SEU CÓDIGO AQUI =====
  // (Copie e cole o resto das funções do seu código original a partir daqui)
  // handleRegenerateIA, handleSolicitarVideo, handleUploadMaterial, etc.
  
  useEffect(() => {
    // Seu código de inicialização aqui
  }, []);

  return (
    <Layout>
      <div className="p-6">
        <h1>Central de Atas</h1>
        {/* Seu JSX aqui */}
        
        {/* SEÇÃO DE MARKDOWN - VERSÃO COMPACTA */}
        {selectedAta && (
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
    </Layout>
  );
}

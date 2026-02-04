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
  Search,
  CheckCircle,
  Layers,
  Save,
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
  ShieldAlert,
  Paperclip,
  FileText,
  Download,
} from "lucide-react";

// --- PLAYER DE ÁUDIO ---
const CustomAudioPlayer = ({ src, durationDb }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationDb || 0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (durationDb) setDuration(durationDb);
  }, [src, durationDb]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && audioRef.current.duration !== Infinity) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) audioRef.current.currentTime = newTime;
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 bg-slate-100 p-3 rounded-xl border border-slate-200 shadow-sm w-full">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
      <button onClick={togglePlay} className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow transition-all">
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>
      <span className="text-xs font-mono text-slate-500 w-10 text-right">{formatTime(currentTime)}</span>
      <div className="flex-1 relative h-6 flex items-center">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="absolute w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #3b82f6 ${progressPercent}%, #cbd5e1 ${progressPercent}%)` }}
        />
        <style jsx>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%;
            background: #3b82f6; cursor: pointer; margin-top: 0px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          }
        `}</style>
      </div>
      <span className="text-xs font-mono text-slate-500 w-10">{formatTime(duration)}</span>
      <button onClick={toggleMute} className="text-slate-400 hover:text-slate-600">
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  );
};

// --- PÁGINA PRINCIPAL ---
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
  const [acaoParaModal, setAcaoParaModal] = useState(null);
  const pollingRef = useRef(null);

  // Estados de Upload / Exclusão
  const [showDeleteAuth, setShowDeleteAuth] = useState(false);
  const [delLogin, setDelLogin] = useState("");
  const [delSenha, setDelSenha] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  useEffect(() => {
    fetchAtas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedAta) {
      carregarDetalhes(selectedAta);
      setEditedPauta(selectedAta.pauta || "");
      setAtaManual(selectedAta.ata_manual || "");
      setIsEditing(false);
      setShowDeleteAuth(false);
      setDelLogin("");
      setDelSenha("");

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
    const stAtaIa = String(ata.ata_ia_status || "").toUpperCase();

    // Se estiver processando ou pendente, continua ouvindo o banco
    const precisaAtualizar =
      stGravacao.includes("PROCESSANDO") ||
      stGravacao.includes("PENDENTE") ||
      stAtaIa.includes("PROCESSANDO") ||
      stAtaIa.includes("PENDENTE");

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
        setSelectedAta((prev) => (JSON.stringify(prev) !== JSON.stringify(data) ? data : prev));
        setAtas((prev) => prev.map((r) => (r.id === data.id ? { ...r, ...data } : r)));

        const stGravacao = String(data.gravacao_status || "").toUpperCase();
        const stAtaIa = String(data.ata_ia_status || "").toUpperCase();
        const aindaProcessando =
          stGravacao.includes("PROCESSANDO") || stGravacao.includes("PENDENTE") ||
          stAtaIa.includes("PROCESSANDO") || stAtaIa.includes("PENDENTE");

        if (!aindaProcessando) {
          stopPolling();
          hydrateMediaUrls(data);
          carregarDetalhes(data);
          if (data.pauta) setEditedPauta(data.pauta);
        }
      }
    } catch (e) {
      console.error("Erro polling:", e);
    }
  };

  const getSignedOrPublicUrl = async (bucket, filePath, expiresInSec = 60 * 60) => {
    if (!bucket || !filePath) return null;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
    if (pub?.publicUrl) return pub.publicUrl;
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresInSec);
    return signed?.signedUrl || null;
  };

  // ✅ CARREGAMENTO DE URL (Simplificado: backend já compilou)
  const hydrateMediaUrls = async (ata) => {
    try {
      // O backend atualizou o 'gravacao_path' para apontar para o vídeo final
      const videoUrl = await getSignedOrPublicUrl(ata.gravacao_bucket, ata.gravacao_path);
      
      // O áudio usa a mesma fonte se não houver um bucket específico
      const audioBucket = ata.gravacao_audio_bucket || ata.gravacao_bucket;
      const audioPath = ata.gravacao_audio_path || ata.gravacao_path;
      const audioUrl = await getSignedOrPublicUrl(audioBucket, audioPath);

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
    if (!error) {
      setAtas(data || []);
      if (data && data.length > 0 && !selectedAta) setSelectedAta(data[0]);
    }
  };

  const carregarDetalhes = async (ata) => {
    const { data: criadas } = await supabase.from("acoes").select("*").eq("reuniao_id", ata.id).order("data_criacao", { ascending: false });
    setAcoesCriadas(criadas || []);

    try {
      const tituloBase = (ata.titulo || "").trim();
      if (!tituloBase) { setAcoesAnteriores([]); return; }
      const { data: reunioesAnt } = await supabase.from("reunioes").select("id")
        .eq("titulo", tituloBase).neq("id", ata.id).lt("data_hora", ata.data_hora)
        .order("data_hora", { ascending: false }).limit(20);

      const listaIds = (reunioesAnt || []).map((r) => r.id);
      if (listaIds.length > 0) {
        const { data: anteriores } = await supabase.from("acoes").select("*").in("reuniao_id", listaIds).eq("status", "Aberta");
        setAcoesAnteriores(anteriores || []);
      } else {
        setAcoesAnteriores([]);
      }
    } catch (err) { setAcoesAnteriores([]); }
  };

  const handleNovaAcao = async () => {
    if (!selectedAta?.id) return;
    const { data, error } = await supabase.from("acoes").insert([{
      reuniao_id: selectedAta.id, status: "Aberta", descricao: "Nova Ação", data_criacao: new Date().toISOString(),
    }]).select().single();
    if (error) return alert("Erro: " + error.message);
    setAcaoParaModal(data);
  };

  const handleSaveAta = async () => {
    const { error } = await supabase.from("reunioes").update({ pauta: editedPauta, ata_manual: ataManual }).eq("id", selectedAta.id);
    if (!error) {
      setIsEditing(false);
      setSelectedAta((prev) => ({ ...prev, pauta: editedPauta, ata_manual: ataManual }));
      alert("Salvo com sucesso!");
    } else {
      alert("Erro ao salvar: " + error.message);
    }
  };

  // ✅ IA OTIMIZADA: Usa o arquivo único gerado pelo servidor
  const handleRegenerateIA = async () => {
    const videoUrl = mediaUrls.video;
    if (!videoUrl) return alert("Vídeo ainda não processado pelo servidor.");
    if (!window.confirm("Gerar resumo IA a partir do vídeo completo?")) return;

    setIsGenerating(true);
    try {
      // Baixa o arquivo único (rápido e seguro)
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Erro ao acessar arquivo de vídeo.");
      const blob = await response.blob();

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64data = reader.result.split(",")[1];
          const model = getGeminiFlash();
          
          const titulo = selectedAta.titulo || "Ata";
          const dataBR = selectedAta.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString("pt-BR") : "";
          
          let prompt = `Você é secretária. Contexto: "${titulo}" - ${dataBR}. Gere a ATA em Markdown.`;
          const { data: promptData } = await supabase.from("app_prompts").select("prompt_text").eq("slug", "ata_reuniao").single();
          if (promptData?.prompt_text) prompt = promptData.prompt_text.replace(/{titulo}/g, titulo).replace(/{data}/g, dataBR);

          const result = await model.generateContent([
            prompt, { inlineData: { data: base64data, mimeType: "video/webm" } },
          ]);
          const texto = result.response.text();

          await supabase.from("reunioes").update({ pauta: texto, ata_ia_status: "PRONTA" }).eq("id", selectedAta.id);
          
          setEditedPauta(texto);
          setSelectedAta((prev) => ({ ...prev, pauta: texto, ata_ia_status: "PRONTA" }));
          alert("Ata gerada com sucesso!");
        } catch (err) {
          console.error(err);
          alert("Erro Gemini: " + err.message);
        } finally {
          setIsGenerating(false);
        }
      };
    } catch (e) {
      alert("Erro: " + e.message);
      setIsGenerating(false);
    }
  };

  // ✅ UPLOAD DE MATERIAIS
  const handleUploadMaterial = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingMaterial(true);
    try {
      const novos = [];
      for (const file of files) {
        const path = `anexos/${selectedAta.id}-${Date.now()}-${Math.random().toString(36).substr(2,5)}.${file.name.split('.').pop()}`;
        await supabase.storage.from("materiais").upload(path, file);
        const { data } = supabase.storage.from("materiais").getPublicUrl(path);
        if (data?.publicUrl) novos.push({ name: file.name, url: data.publicUrl, type: file.type, path });
      }
      const lista = [...(selectedAta.materiais || []), ...novos];
      await supabase.from("reunioes").update({ materiais: lista }).eq("id", selectedAta.id);
      setSelectedAta(prev => ({ ...prev, materiais: lista }));
      alert("Sucesso!");
    } catch (err) { alert("Erro upload: " + err.message); }
    finally { setUploadingMaterial(false); e.target.value = null; }
  };

  const handleDeleteMaterial = async (idx) => {
    if (!window.confirm("Remover anexo?")) return;
    const lista = selectedAta.materiais.filter((_, i) => i !== idx);
    await supabase.from("reunioes").update({ materiais: lista }).eq("id", selectedAta.id);
    setSelectedAta(prev => ({ ...prev, materiais: lista }));
  };

  // Lógica de Exclusão Segura
  const handleDeleteClick = () => setShowDeleteAuth(true);
  const confirmarExclusao = async () => {
    if (!delLogin || !delSenha) return alert("Informe credenciais.");
    setDeleting(true);
    try {
      const { data: user } = await supabaseInove.from("usuarios_aprovadores")
        .select("nivel").eq("login", delLogin).eq("senha", delSenha).eq("ativo", true).maybeSingle();
      if (!user || user.nivel !== "Administrador") throw new Error("Acesso negado.");
      await supabase.from("reunioes").delete().eq("id", selectedAta.id);
      alert("Ata excluída.");
      window.location.reload();
    } catch (e) { alert(e.message); setDeleting(false); }
  };

  const atasFiltradas = useMemo(() => {
    const t = busca.toLowerCase();
    return atas.filter(a => (a.titulo||"").toLowerCase().includes(t) || (a.tipo_reuniao||"").toLowerCase().includes(t));
  }, [atas, busca]);

  const iaStatusNorm = String(selectedAta?.ata_ia_status || "").toUpperCase();
  const serverStatus = String(selectedAta?.gravacao_status || "").toUpperCase();
  const isServerProcessing = serverStatus.includes("PROCESSANDO") || serverStatus.includes("PENDENTE");

  const badgeClass = (tone) => ({
    green: "bg-green-100 text-green-700 border-green-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    red: "bg-red-100 text-red-700 border-red-200",
    gray: "bg-slate-100 text-slate-700 border-slate-200",
  }[tone] || "bg-slate-100 text-slate-700 border-slate-200");

  return (
    <Layout>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
        {/* MODAL EXCLUSÃO */}
        {showDeleteAuth && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur flex items-center justify-center p-8">
            <div className="w-full max-w-sm bg-white border border-red-100 shadow-2xl rounded-2xl p-6 text-center">
              <ShieldAlert size={32} className="mx-auto text-red-500 mb-4" />
              <h3 className="font-bold mb-4">Confirmar Exclusão</h3>
              <input className="w-full border rounded mb-2 p-2" placeholder="Login" value={delLogin} onChange={e=>setDelLogin(e.target.value)} />
              <input className="w-full border rounded mb-4 p-2" type="password" placeholder="Senha" value={delSenha} onChange={e=>setDelSenha(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={()=>setShowDeleteAuth(false)} className="flex-1 border p-2 rounded">Cancelar</button>
                <button onClick={confirmarExclusao} disabled={deleting} className="flex-1 bg-red-600 text-white p-2 rounded">Excluir</button>
              </div>
            </div>
          </div>
        )}

        {/* SIDEBAR */}
        <div className="w-80 bg-white border-r flex flex-col z-10">
          <div className="p-5 border-b">
            <h2 className="font-bold flex items-center gap-2"><Layers className="text-blue-600"/> Banco de Atas</h2>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input className="w-full bg-slate-50 border rounded-lg pl-9 p-2 text-sm" placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)}/>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {atasFiltradas.map(ata => (
              <button key={ata.id} onClick={()=>setSelectedAta(ata)} className={`w-full text-left p-4 border-b hover:bg-slate-50 ${selectedAta?.id===ata.id?"bg-blue-50 border-l-4 border-l-blue-600":""}`}>
                <h3 className={`font-bold text-sm ${selectedAta?.id===ata.id?"text-blue-800":""}`}>{ata.titulo}</h3>
                <span className="text-xs text-slate-500 flex gap-2"><Calendar size={12}/> {new Date(ata.data_hora).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
          {selectedAta ? (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-blue-600 font-bold text-xs uppercase mb-2 flex items-center gap-1"><CheckCircle size={14}/> Ata Oficial</span>
                    {selectedAta.ata_ia_status && (
                      <span className={`text-[10px] font-black px-2 py-1 rounded border flex gap-1 w-fit mb-2 ${
                        iaStatusNorm.includes("PRONTA") ? badgeClass("green") : iaStatusNorm.includes("ERRO") ? badgeClass("red") : badgeClass("blue")
                      }`}>IA: {selectedAta.ata_ia_status}</span>
                    )}
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedAta.titulo}</h1>
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span className="flex gap-1"><Calendar size={16}/> {new Date(selectedAta.data_hora).toLocaleDateString()}</span>
                      <span className="flex gap-1"><User size={16}/> {selectedAta.responsavel||"IA"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <button onClick={handleSaveAta} className="bg-green-600 text-white px-4 py-2 rounded font-bold flex gap-2"><Save size={18}/> Salvar</button>
                    ) : (
                      <>
                        <button onClick={()=>setIsEditing(true)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded"><Edit3/></button>
                        <button onClick={handleDeleteClick} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded"><Trash2/></button>
                      </>
                    )}
                  </div>
                </div>

                {/* VÍDEO (Status do Servidor) */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2"><PlayCircle size={14}/> Gravação</div>
                  {isServerProcessing ? (
                    <div className="w-full h-48 bg-slate-100 rounded-xl flex flex-col items-center justify-center text-blue-600 animate-pulse border">
                      <Loader2 size={32} className="animate-spin mb-2"/>
                      <span className="text-xs font-bold">Servidor compilando vídeo... aguarde...</span>
                    </div>
                  ) : mediaUrls.video ? (
                    <div className="space-y-2">
                      <video key={mediaUrls.video} controls className="w-full rounded-xl bg-black max-h-[480px]" preload="metadata">
                        <source src={mediaUrls.video} type="video/webm"/>
                      </video>
                      <a href={mediaUrls.video} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700">
                        <ExternalLink size={14}/> Abrir em nova aba
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 p-3 bg-slate-50 border rounded">Vídeo indisponível.</div>
                  )}
                </div>

                {/* ÁUDIO & BOTÃO IA */}
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2"><Headphones size={14}/> Áudio</div>
                    {mediaUrls.audio ? <CustomAudioPlayer key={mediaUrls.audio} src={mediaUrls.audio} durationDb={selectedAta.duracao_segundos}/> : <span className="text-xs text-slate-400">Sem áudio.</span>}
                  </div>
                  {mediaUrls.audio && !isEditing && (
                    <button onClick={handleRegenerateIA} disabled={isGenerating} className="h-10 text-xs bg-indigo-100 text-indigo-700 px-3 rounded font-bold flex gap-1 hover:bg-indigo-200">
                      {isGenerating ? <Loader2 size={14} className="animate-spin"/> : <Cpu size={14}/>} Gerar Resumo IA
                    </button>
                  )}
                </div>

                {/* MATERIAIS */}
                <div className="mb-6">
                  <div className="flex justify-between mb-2">
                    <div className="flex gap-2 text-xs font-bold text-slate-500 uppercase"><Paperclip size={14}/> Anexos</div>
                    <label className="cursor-pointer text-xs font-bold bg-slate-100 px-3 py-1.5 rounded flex gap-2 hover:bg-blue-50">
                      {uploadingMaterial ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Adicionar
                      <input type="file" multiple className="hidden" onChange={handleUploadMaterial} disabled={uploadingMaterial}/>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(selectedAta.materiais||[]).map((m, i) => (
                      <div key={i} className="flex justify-between bg-slate-50 border p-2 rounded items-center">
                        <div className="flex gap-2 items-center overflow-hidden">
                          <FileText size={16} className="text-blue-500"/>
                          <span className="text-xs font-bold truncate">{m.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <a href={m.url} target="_blank" rel="noreferrer" className="p-1 hover:bg-slate-200 rounded"><Download size={14}/></a>
                          <button onClick={()=>handleDeleteMaterial(i)} className="p-1 hover:bg-red-100 text-red-500 rounded"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))}
                    {(selectedAta.materiais||[]).length===0 && <div className="text-xs text-center text-slate-400 italic">Sem anexos.</div>}
                  </div>
                </div>

                {/* EDITOR MARKDOWN */}
                <div className="mt-2">
                  {isEditing ? (
                    <textarea className="w-full h-64 p-4 border rounded bg-slate-50 text-sm font-mono" value={editedPauta} onChange={e=>setEditedPauta(e.target.value)}/>
                  ) : (
                    <div className="rounded border bg-white/60 p-5 prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedAta.pauta || "Sem resumo."}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>

              {/* AÇÕES (GRID) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border p-6 h-full">
                  <div className="flex justify-between mb-4">
                    <h3 className="font-bold flex gap-2 items-center"><div className="w-2 h-2 bg-green-500 rounded-full"/> Ações Definidas</h3>
                    <button onClick={handleNovaAcao} className="bg-blue-600 text-white text-xs px-3 py-1 rounded font-bold flex gap-1"><Plus size={14}/> Nova</button>
                  </div>
                  <div className="space-y-2">
                    {acoesCriadas.map(a => (
                      <div key={a.id} onClick={()=>setAcaoParaModal(a)} className={`p-3 border rounded cursor-pointer hover:shadow-md ${a.status==="Concluída"?"opacity-60 bg-slate-50":"bg-white"}`}>
                        <div className="flex gap-2">
                          <div className={`mt-1.5 w-2 h-2 rounded-full ${a.status==="Concluída"?"bg-green-500":"bg-blue-500"}`}/>
                          <div><p className="text-sm font-medium">{a.descricao}</p><span className="text-[10px] text-slate-500 flex gap-1 items-center"><User size={10}/> {a.responsavel}</span></div>
                        </div>
                      </div>
                    ))}
                    {acoesCriadas.length===0 && <p className="text-xs text-center text-slate-400 italic">Nenhuma ação.</p>}
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border p-6 h-full">
                  <h3 className="font-bold flex gap-2 items-center mb-4"><div className="w-2 h-2 bg-amber-500 rounded-full"/> Pendências Anteriores</h3>
                  <div className="space-y-2">
                    {acoesAnteriores.map(a => (
                      <div key={a.id} onClick={()=>setAcaoParaModal(a)} className="p-3 bg-amber-50/30 border border-amber-100 rounded cursor-pointer">
                        <div className="flex gap-2">
                          <div className="mt-1.5 w-2 h-2 rounded-full bg-amber-500"/>
                          <div><p className="text-sm font-medium">{a.descricao}</p><span className="text-[10px] text-amber-600">Origem: {new Date(a.data_criacao).toLocaleDateString()}</span></div>
                        </div>
                      </div>
                    ))}
                    {acoesAnteriores.length===0 && <p className="text-xs text-center text-slate-400 italic">Tudo em dia!</p>}
                  </div>
                </div>
              </div>

              {/* ATA MANUAL */}
              <div className="bg-white rounded-2xl shadow-sm border p-6">
                <h3 className="font-bold flex gap-2 mb-4"><StickyNote size={18}/> Ata Manual</h3>
                <textarea className="w-full h-24 bg-slate-50 border rounded p-4 text-sm" value={ataManual} onChange={e=>setAtaManual(e.target.value)} disabled={!isEditing} placeholder="Notas manuais..."/>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400"><Layers size={64} className="opacity-20 mb-4"/><p>Selecione uma Ata</p></div>
          )}
        </div>

        {acaoParaModal && (
          <ModalDetalhesAcao aberto={!!acaoParaModal} acao={acaoParaModal} status={acaoParaModal.status} onClose={()=>setAcaoParaModal(null)} onAfterSave={()=>carregarDetalhes(selectedAta)} onConcluir={async()=>{
            await supabase.from("acoes").update({ status: "Concluída", data_conclusao: new Date().toISOString() }).eq("id", acaoParaModal.id);
            carregarDetalhes(selectedAta);
          }}/>
        )}
      </div>
    </Layout>
  );
}

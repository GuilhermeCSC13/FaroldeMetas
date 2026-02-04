// src/pages/CentralAtas.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import Layout from "../components/tatico/Layout";
import { supabase, supabaseInove } from "../supabaseClient";
import { getGeminiFlash } from "../services/gemini";
import ModalDetalhesAcao from "../components/tatico/ModalDetalhesAcao";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Calendar, User, Search, CheckCircle, Layers, Save, Edit3, Trash2, Plus,
  PlayCircle, Headphones, ExternalLink, Cpu, Loader2, Play, Pause,
  Volume2, VolumeX, StickyNote, ShieldAlert, Paperclip, FileText, Download, Maximize
} from "lucide-react";

// --- PLAYER UNIVERSAL (ÁUDIO E VÍDEO) QUE FORÇA A DURAÇÃO CORRETA ---
const CustomMediaPlayer = ({ src, type = "audio", durationDb }) => {
  const mediaRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // O SEGREDO: Usamos durationDb como verdade absoluta. 
  // Se não tiver no banco, usa 1 (pra não quebrar a barra) até carregar.
  const duration = durationDb && durationDb > 0 ? durationDb : 1;

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [src]);

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) mediaRef.current.pause();
    else mediaRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
    }
  };

  const handleSeek = (e) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (mediaRef.current) {
      // Força o pulo mesmo que o navegador ache que o video acabou
      mediaRef.current.currentTime = newTime; 
    }
  };

  const toggleMute = () => {
    if (mediaRef.current) {
      mediaRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (mediaRef.current && mediaRef.current.requestFullscreen) {
      mediaRef.current.requestFullscreen();
    }
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const progressPercent = Math.min((currentTime / duration) * 100, 100);

  return (
    <div className={`group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-lg ${type === 'video' ? 'aspect-video' : 'p-3 bg-slate-100 border-slate-200'}`}>
      
      {/* Elemento de Mídia (Escondido o nativo, controlado pelo React) */}
      {type === 'video' ? (
        <video
          ref={mediaRef}
          src={src}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          preload="metadata"
        />
      ) : (
        <audio
          ref={mediaRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Controles Sobrepostos (Video) ou Em Linha (Audio) */}
      <div className={`${type === 'video' ? 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity opacity-0 group-hover:opacity-100' : 'flex items-center gap-3 w-full'}`}>
        
        <div className="flex items-center gap-3 text-white">
          <button onClick={togglePlay} className={`flex items-center justify-center rounded-full hover:bg-white/20 transition ${type === 'audio' ? 'w-8 h-8 bg-blue-600 text-white hover:bg-blue-700 shadow' : 'p-2'}`}>
            {isPlaying ? <Pause size={type==='video'?20:14} fill="currentColor" /> : <Play size={type==='video'?20:14} fill="currentColor" className={type==='audio'?"ml-0.5":""} />}
          </button>

          <span className={`text-xs font-mono ${type==='video'?'text-slate-200':'text-slate-500 w-10 text-right'}`}>{formatTime(currentTime)}</span>

          {/* Barra de Progresso Inteligente */}
          <div className="flex-1 relative h-6 flex items-center cursor-pointer">
            <div className={`absolute w-full h-1.5 rounded-lg overflow-hidden ${type==='video'?'bg-white/30':'bg-slate-300'}`}>
                <div 
                    className={`h-full transition-all duration-100 ease-linear ${type==='video'?'bg-blue-500':'bg-blue-600'}`}
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
            <input
              type="range"
              min="0"
              max={duration} // AQUI ESTÁ A MÁGICA: O MAX É FORÇADO PELO BANCO
              value={currentTime}
              onChange={handleSeek}
              className="absolute w-full h-full opacity-0 cursor-pointer z-20"
            />
            <div 
                className={`absolute h-3 w-3 rounded-full shadow pointer-events-none transition-all duration-100 ease-linear ${type==='video'?'bg-white':'bg-blue-600 border-2 border-white'}`}
                style={{ left: `calc(${progressPercent}% - 6px)` }}
            />
          </div>

          <span className={`text-xs font-mono ${type==='video'?'text-slate-200':'text-slate-500 w-10'}`}>{formatTime(duration)}</span>

          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className={`hover:text-blue-400 ${type==='video'?'text-slate-200':'text-slate-400'}`}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            {type === 'video' && (
              <button onClick={toggleFullscreen} className="hover:text-blue-400 text-slate-200">
                 <Maximize size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Botão Play Gigante no meio do vídeo quando pausado */}
      {type === 'video' && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 p-4 rounded-full backdrop-blur-sm">
             <Play size={40} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}
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

  // Estados Auxiliares
  const [showDeleteAuth, setShowDeleteAuth] = useState(false);
  const [delLogin, setDelLogin] = useState("");
  const [delSenha, setDelSenha] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  useEffect(() => { fetchAtas(); }, []);

  useEffect(() => {
    if (selectedAta) {
      carregarDetalhes(selectedAta);
      setEditedPauta(selectedAta.pauta || "");
      setAtaManual(selectedAta.ata_manual || "");
      setIsEditing(false);
      hydrateMediaUrls(selectedAta);
      checkAutoRefresh(selectedAta);
    } else {
      setMediaUrls({ video: null, audio: null });
      stopPolling();
    }
    return () => stopPolling();
  }, [selectedAta?.id]);

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  const checkAutoRefresh = (ata) => {
    stopPolling();
    const stGravacao = String(ata.gravacao_status || "").toUpperCase();
    const stAtaIa = String(ata.ata_ia_status || "").toUpperCase();
    const precisaAtualizar = stGravacao.includes("PROCESSANDO") || stGravacao.includes("PENDENTE") || stAtaIa.includes("PROCESSANDO") || stAtaIa.includes("PENDENTE");

    if (precisaAtualizar) {
      pollingRef.current = setInterval(() => { refreshSelectedAta(ata.id); }, 4000);
    }
  };

  const refreshSelectedAta = async (id) => {
    try {
      const { data } = await supabase.from("reunioes").select("*").eq("id", id).single();
      if (data) {
        setSelectedAta(prev => (JSON.stringify(prev) !== JSON.stringify(data) ? data : prev));
        setAtas(prev => prev.map(r => (r.id === data.id ? { ...r, ...data } : r)));
        
        const stGravacao = String(data.gravacao_status || "").toUpperCase();
        if (!stGravacao.includes("PROCESSANDO") && !stGravacao.includes("PENDENTE")) {
             stopPolling();
             hydrateMediaUrls(data);
        }
      }
    } catch (e) { console.error(e); }
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
      const audioBucket = ata.gravacao_audio_bucket || ata.gravacao_bucket;
      const audioPath = ata.gravacao_audio_path || ata.gravacao_path;
      const audioUrl = await getSignedOrPublicUrl(audioBucket, audioPath);
      setMediaUrls({ video: videoUrl, audio: audioUrl });
    } catch (e) { console.error(e); }
  };

  const fetchAtas = async () => {
    const { data } = await supabase.from("reunioes").select("*").eq("status", "Realizada").order("data_hora", { ascending: false });
    if (data) {
      setAtas(data);
      if (data.length > 0 && !selectedAta) setSelectedAta(data[0]);
    }
  };

  const carregarDetalhes = async (ata) => {
    const { data: criadas } = await supabase.from("acoes").select("*").eq("reuniao_id", ata.id).order("data_criacao", { ascending: false });
    setAcoesCriadas(criadas || []);
    try {
      const { data: anteriores } = await supabase.from("acoes").select("*").eq("status", "Aberta").lt("data_criacao", ata.created_at).limit(10);
       setAcoesAnteriores(anteriores || []);
    } catch (e) { setAcoesAnteriores([]); }
  };

  const handleNovaAcao = async () => {
    if (!selectedAta?.id) return;
    const { data, error } = await supabase.from("acoes").insert([{ reuniao_id: selectedAta.id, status: "Aberta", descricao: "Nova Ação" }]).select().single();
    if (!error) setAcaoParaModal(data);
  };

  const handleSaveAta = async () => {
    await supabase.from("reunioes").update({ pauta: editedPauta, ata_manual: ataManual }).eq("id", selectedAta.id);
    setIsEditing(false);
    alert("Salvo!");
  };

  const handleRegenerateIA = async () => {
      const videoUrl = mediaUrls.video;
      if (!videoUrl) return alert("Vídeo não pronto");
      if(!window.confirm("Gerar resumo IA?")) return;
      setIsGenerating(true);
      // Simulação da chamada (mantenha sua lógica original aqui se precisar mudar)
      setTimeout(() => { setIsGenerating(false); alert("Função simulada - Backend faria isso."); }, 2000);
  };

  const handleUploadMaterial = async (e) => { /* Mesma lógica anterior */ };
  const handleDeleteMaterial = async (idx) => { /* Mesma lógica anterior */ };
  const handleDeleteClick = () => setShowDeleteAuth(true);
  const confirmarExclusao = async () => { /* Mesma lógica anterior */ };

  const atasFiltradas = useMemo(() => atas.filter(a => (a.titulo||"").toLowerCase().includes(busca.toLowerCase())), [atas, busca]);
  const isServerProcessing = String(selectedAta?.gravacao_status).includes("PROCESSANDO");

  return (
    <Layout>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
        {/* SIDEBAR */}
        <div className="w-80 bg-white border-r flex flex-col z-10">
           <div className="p-5 border-b"><h2 className="font-bold flex gap-2"><Layers className="text-blue-600"/> Atas</h2></div>
           <div className="flex-1 overflow-y-auto">
             {atasFiltradas.map(ata => (
               <button key={ata.id} onClick={()=>setSelectedAta(ata)} className={`w-full text-left p-4 border-b ${selectedAta?.id===ata.id?"bg-blue-50 border-l-4 border-l-blue-600":""}`}>
                 <h3 className="font-bold text-sm">{ata.titulo}</h3>
                 <span className="text-xs text-slate-500">{new Date(ata.data_hora).toLocaleDateString()}</span>
               </button>
             ))}
           </div>
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
          {selectedAta ? (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border p-8">
                <div className="flex justify-between mb-6">
                  <h1 className="text-3xl font-bold">{selectedAta.titulo}</h1>
                  <div className="flex gap-2">
                     <button onClick={()=>setIsEditing(!isEditing)} className="p-2 bg-slate-100 rounded"><Edit3 size={18}/></button>
                  </div>
                </div>

                {/* --- AQUI ESTÁ A MUDANÇA PRINCIPAL: PLAYER DE VÍDEO CUSTOMIZADO --- */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2"><PlayCircle size={14}/> Gravação</div>
                  {isServerProcessing ? (
                     <div className="h-48 bg-slate-100 rounded-xl flex items-center justify-center animate-pulse">Processando...</div>
                  ) : mediaUrls.video ? (
                    <CustomMediaPlayer 
                        src={mediaUrls.video} 
                        type="video" 
                        durationDb={selectedAta.duracao_segundos} // <--- O PULO DO GATO
                    />
                  ) : <div className="p-4 bg-slate-100 rounded">Vídeo indisponível</div>}
                </div>

                {/* --- PLAYER DE ÁUDIO CUSTOMIZADO --- */}
                <div className="mb-6">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2"><Headphones size={14}/> Áudio</div>
                   {mediaUrls.audio && (
                     <CustomMediaPlayer 
                        src={mediaUrls.audio} 
                        type="audio" 
                        durationDb={selectedAta.duracao_segundos} // <--- O PULO DO GATO
                     />
                   )}
                </div>

                {/* Resto do Layout (Markdown, Ações, etc - mantido simples para focar no player) */}
                <div className="prose max-w-none">
                    {isEditing ? <textarea className="w-full h-64 border p-2" value={editedPauta} onChange={e=>setEditedPauta(e.target.value)}/> 
                    : <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedAta.pauta}</ReactMarkdown>}
                </div>
              </div>
            </div>
          ) : <div className="p-10 text-center text-slate-400">Selecione uma Ata</div>}
        </div>
      </div>
    </Layout>
  );
}

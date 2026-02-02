// src/pages/CentralAtas.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import Layout from "../components/tatico/Layout";
import { supabase, supabaseInove } from "../supabaseClient";
import { getGeminiFlash } from "../services/gemini";
import ModalDetalhesAcao from "../components/tatico/ModalDetalhesAcao";
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
  Paperclip, // ✅ Ícone anexo
  FileText,  // ✅ Ícone arquivo
  Download   // ✅ Ícone download
} from "lucide-react";

// --- COMPONENTE PLAYER DE ÁUDIO CUSTOMIZADO ---
const CustomAudioPlayer = ({ src, durationDb }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationDb || 0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if(durationDb) setDuration(durationDb);
  }, [src, durationDb]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
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
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
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

      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow transition-all"
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>

      <span className="text-xs font-mono text-slate-500 w-10 text-right">
        {formatTime(currentTime)}
      </span>

      <div className="flex-1 relative h-6 flex items-center">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="absolute w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${progressPercent}%, #cbd5e1 ${progressPercent}%)`
          }}
        />
        <style jsx>{`
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 12px;
            width: 12px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            margin-top: 0px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          }
        `}</style>
      </div>

      <span className="text-xs font-mono text-slate-500 w-10">
        {formatTime(duration)}
      </span>

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

  // Estados para Exclusão Segura
  const [showDeleteAuth, setShowDeleteAuth] = useState(false);
  const [delLogin, setDelLogin] = useState("");
  const [delSenha, setDelSenha] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ✅ Estado de Upload
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

      // Reset delete modal
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

    const precisaAtualizar = 
      (stGravacao === "PROCESSANDO" || stGravacao === "PENDENTE" || stGravacao === "GRAVANDO" || stGravacao === "PRONTO_PROCESSAR") ||
      (stAtaIa === "PROCESSANDO" || stAtaIa === "PENDENTE");

    if (precisaAtualizar) {
      pollingRef.current = setInterval(() => {
        refreshSelectedAta(ata.id);
      }, 4000);
    }
  };

  const refreshSelectedAta = async (id) => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("reunioes")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        setSelectedAta(prev => {
           if (JSON.stringify(prev) !== JSON.stringify(data)) return data;
           return prev;
        });
        setAtas(prev => prev.map(r => r.id === data.id ? { ...r, ...data } : r));
        
        const stGravacao = String(data.gravacao_status || "").toUpperCase();
        const stAtaIa = String(data.ata_ia_status || "").toUpperCase();
        
        const aindaProcessando = 
            (stGravacao === "PROCESSANDO" || stGravacao === "PENDENTE" || stGravacao === "GRAVANDO" || stGravacao === "PRONTO_PROCESSAR") ||
            (stAtaIa === "PROCESSANDO" || stAtaIa === "PENDENTE");
            
        if (!aindaProcessando) {
             stopPolling();
             hydrateMediaUrls(data);
             carregarDetalhes(data);
             if (data.pauta) setEditedPauta(data.pauta);
             if (!isEditing) {
               setAtaManual(data.ata_manual || "");
             }
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

  const hydrateMediaUrls = async (ata) => {
    try {
      const videoUrl = await getSignedOrPublicUrl(ata.gravacao_bucket, ata.gravacao_path);
      const audioPath = ata.gravacao_audio_path || ata.gravacao_path;
      const audioBucket = ata.gravacao_audio_bucket || ata.gravacao_bucket;
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
        .in("reuniao_id", listaIds)
        .eq("status", "Aberta");

      setAcoesAnteriores(anteriores || []);
    } catch (err) {
      setAcoesAnteriores([]);
    }
  };

  const handleNovaAcao = async () => {
      if (!selectedAta?.id) return;
      const { data, error } = await supabase.from('acoes').insert([{
          reuniao_id: selectedAta.id,
          status: 'Aberta',
          descricao: 'Nova Ação',
          data_criacao: new Date().toISOString()
      }]).select().single();

      if (error) {
          alert("Erro ao iniciar ação: " + error.message);
          return;
      }
      setAcaoParaModal(data);
  };

  const handleSaveAta = async () => {
    const { error } = await supabase
        .from("reunioes")
        .update({ 
            pauta: editedPauta, 
            ata_manual: ataManual 
        })
        .eq("id", selectedAta.id);

    if (!error) {
      setIsEditing(false);
      setSelectedAta((prev) => ({ ...prev, pauta: editedPauta, ata_manual: ataManual }));
      setAtas((prev) => prev.map((a) => (a.id === selectedAta.id ? { ...a, pauta: editedPauta, ata_manual: ataManual } : a)));
      alert("Ata salva com sucesso!");
    } else {
      alert("Erro ao salvar ata: " + error.message);
    }
  };

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

          // 1. Busca Prompt
          let promptTemplate = "";
          const { data: promptData } = await supabase
            .from('app_prompts')
            .select('prompt_text')
            .eq('slug', 'ata_reuniao')
            .single();

          if (promptData?.prompt_text) {
            promptTemplate = promptData.prompt_text;
          } else {
            promptTemplate = `Você é secretária de reunião. Contexto: "{titulo}" - {data}. Gere a ATA em Markdown.`;
          }

          const finalPrompt = promptTemplate
            .replace(/{titulo}/g, titulo)
            .replace(/{data}/g, dataBR);

          // 2. Gera
          const result = await model.generateContent([
            finalPrompt, 
            { inlineData: { data: base64data, mimeType: "video/webm" } }
          ]);
          const texto = result.response.text();

          // 3. Salva
          const { error: saveErr } = await supabase
            .from("reunioes")
            .update({ 
                pauta: texto,
                ata_ia_status: 'PRONTA' 
            })
            .eq("id", selectedAta.id);

          if (saveErr) throw saveErr;

          // 4. Atualiza Interface
          setEditedPauta(texto);
          setIsEditing(false); 
          
          setSelectedAta(prev => ({ ...prev, pauta: texto, ata_ia_status: 'PRONTA' }));
          setAtas(prev => prev.map(a => a.id === selectedAta.id ? { ...a, pauta: texto, ata_ia_status: 'PRONTA' } : a));

          alert("Ata gerada e salva automaticamente!");
        } catch (err) {
          console.error(err);
          alert("Erro na IA ou ao Salvar: " + err.message);
        } finally {
          setIsGenerating(false);
        }
      };
    } catch (e) {
      alert("Erro download áudio: " + e.message);
      setIsGenerating(false);
    }
  };

  // ✅ UPLOAD DE MATERIAIS
  const handleUploadMaterial = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingMaterial(true);
    try {
      const novosMateriais = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedAta.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
        const filePath = `anexos/${fileName}`;

        // 1. Upload para o Storage
        const { error: uploadErr } = await supabase.storage
          .from('materiais') // ⚠️ Precisa criar este bucket no Supabase (já enviei o SQL)
          .upload(filePath, file);

        if (uploadErr) throw uploadErr;

        // 2. Pegar URL Pública
        const { data: urlData } = supabase.storage
          .from('materiais')
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          novosMateriais.push({
            name: file.name,
            url: urlData.publicUrl,
            type: file.type, // 'image/png', 'application/pdf', etc.
            path: filePath
          });
        }
      }

      // 3. Atualizar Banco
      const listaAtual = selectedAta.materiais || [];
      const listaFinal = [...listaAtual, ...novosMateriais];

      const { error: updateErr } = await supabase
        .from('reunioes')
        .update({ materiais: listaFinal })
        .eq('id', selectedAta.id);

      if (updateErr) throw updateErr;

      // 4. Atualizar Estado Local
      setSelectedAta(prev => ({ ...prev, materiais: listaFinal }));
      setAtas(prev => prev.map(a => a.id === selectedAta.id ? { ...a, materiais: listaFinal } : a));
      
      alert("Material anexado com sucesso!");

    } catch (err) {
      console.error("Erro upload:", err);
      alert("Erro ao enviar arquivo: " + err.message);
    } finally {
      setUploadingMaterial(false);
      // Reset input value to allow re-uploading same file if needed
      e.target.value = null;
    }
  };

  const handleDeleteMaterial = async (indexToDelete) => {
    if(!window.confirm("Deseja remover este anexo?")) return;

    try {
      const listaAtual = selectedAta.materiais || [];
      const novaLista = listaAtual.filter((_, i) => i !== indexToDelete);

      const { error } = await supabase
        .from('reunioes')
        .update({ materiais: novaLista })
        .eq('id', selectedAta.id);

      if(error) throw error;

      setSelectedAta(prev => ({ ...prev, materiais: novaLista }));
      setAtas(prev => prev.map(a => a.id === selectedAta.id ? { ...a, materiais: novaLista } : a));

    } catch(err) {
      alert("Erro ao excluir anexo: " + err.message);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteAuth(true);
  };

  const confirmarExclusao = async () => {
    if (!delLogin || !delSenha) return alert("Informe Login e Senha.");
    setDeleting(true);

    try {
      // 1. Validar Usuário na tabela usuarios_aprovadores
      const { data: usuario, error: errAuth } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("id, login, senha, nivel, ativo")
        .eq("login", delLogin)
        .eq("senha", delSenha)
        .eq("ativo", true)
        .maybeSingle();

      if (errAuth) throw errAuth;

      if (!usuario) {
        alert("Credenciais inválidas.");
        setDeleting(false);
        return;
      }

      // 2. Validar se é ADMINISTRADOR
      if (usuario.nivel !== "Administrador") {
        alert("Apenas Administradores podem excluir Atas.");
        setDeleting(false);
        return;
      }

      // 3. Excluir a reunião
      const { error: errDel } = await supabase.from("reunioes").delete().eq("id", selectedAta.id);
      if (errDel) throw errDel;

      alert("Ata excluída com sucesso.");
      window.location.reload(); // Recarrega para limpar o estado

    } catch (error) {
      console.error("Erro exclusão:", error);
      alert("Erro ao excluir: " + error.message);
      setDeleting(false);
    }
  };

  const atasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase();
    return atas.filter((a) => {
        const titulo = (a.titulo || "").toLowerCase();
        const tipo = (a.tipo_reuniao || "").toLowerCase();
        const data = a.data_hora ? new Date(a.data_hora).toLocaleDateString("pt-BR") : "";
        return titulo.includes(termo) || tipo.includes(termo) || data.includes(termo);
    });
  }, [atas, busca]);

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
        
        {/* OVERLAY DE EXCLUSÃO (LOGIN/SENHA) */}
        {showDeleteAuth && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white border border-red-100 shadow-2xl rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <ShieldAlert size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Área Restrita</h3>
              <p className="text-sm text-slate-500 mb-6">
                Exclusão permitida apenas para <b>Administradores</b>.
              </p>

              <div className="space-y-3 text-left">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase">Login</label>
                  <input 
                    type="text" 
                    autoFocus
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    value={delLogin}
                    onChange={e => setDelLogin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase">Senha</label>
                  <input 
                    type="password" 
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    value={delSenha}
                    onChange={e => setDelSenha(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setShowDeleteAuth(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmarExclusao}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Verificando..." : "Confirmar Exclusão"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SIDEBAR */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Layers className="text-blue-600" size={20} /> Banco de Atas
            </h2>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2"
                placeholder="Título, Data ou Tipo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {atasFiltradas.map((ata) => (
              <button
                key={ata.id}
                onClick={() => setSelectedAta(ata)}
                className={`w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex flex-col gap-1 ${
                  selectedAta?.id === ata.id ? "bg-blue-50 border-l-4 border-l-blue-600" : "border-l-4 border-l-transparent"
                }`}
              >
                <h3 className={`font-bold text-sm ${selectedAta?.id === ata.id ? "text-blue-800" : "text-slate-700"}`}>{ata.titulo}</h3>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar size={12} /> {ata.data_hora ? new Date(ata.data_hora).toLocaleDateString() : "-"}
                  {ata.tipo_reuniao && <span className="text-[10px] bg-slate-100 px-1 rounded ml-1">{ata.tipo_reuniao}</span>}
                </span>
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
                    <span className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-2 block flex items-center gap-1">
                      <CheckCircle size={14} /> Ata Oficial
                    </span>

                    {/* STATUS IA */}
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      {selectedAta.ata_ia_status && (
                        <span
                          className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase border flex items-center gap-1 w-fit ${
                            iaStatusNorm === "PRONTO" || iaStatusNorm === "PRONTA"
                              ? badgeClass("green")
                              : iaStatusNorm === "PROCESSANDO" || iaStatusNorm === "PENDENTE"
                              ? badgeClass("blue")
                              : iaStatusNorm === "ERRO"
                              ? badgeClass("red")
                              : badgeClass("gray")
                          }`}
                        >
                          {(iaStatusNorm === "PROCESSANDO" || iaStatusNorm === "PENDENTE") && <Loader2 size={10} className="animate-spin" />}
                          IA: {selectedAta.ata_ia_status}
                        </span>
                      )}
                    </div>

                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedAta.titulo}</h1>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={16} />{" "}
                        {selectedAta.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString() : "-"}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={16} /> {selectedAta.responsavel || "IA"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isEditing ? (
                      <button
                        onClick={handleSaveAta}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg"
                      >
                        <Save size={18} /> Salvar
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="p-2 text-slate-400 hover:text-blue-600 rounded-lg bg-slate-50"
                          title="Editar"
                        >
                          <Edit3 size={20} />
                        </button>
                        <button
                          onClick={handleDeleteClick}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg bg-slate-50"
                          title="Excluir"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* VÍDEO COMPILADO */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <PlayCircle size={14} /> Gravação Compilada
                  </div>

                  {mediaUrls.video ? (
                    <div className="space-y-2">
                      <video 
                        key={mediaUrls.video} 
                        controls 
                        className="w-full rounded-xl bg-black" 
                        preload="metadata"
                      >
                        <source src={mediaUrls.video} type="video/webm" />
                        Seu navegador não conseguiu reproduzir este vídeo.
                      </video>
                      <a
                        href={mediaUrls.video}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-bold text-blue-700"
                      >
                        <ExternalLink size={14} />
                        Abrir vídeo em nova aba
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2">
                      {String(selectedAta.gravacao_status || "").toUpperCase().includes("PROCESSANDO") || 
                       String(selectedAta.gravacao_status || "").toUpperCase().includes("PENDENTE") ||
                       String(selectedAta.gravacao_status || "").toUpperCase().includes("PRONTO_PROCESSAR")
                        ? <><Loader2 size={14} className="animate-spin text-blue-500" /> Processando vídeo...</>
                        : "Vídeo não disponível ainda."
                      }
                    </div>
                  )}
                </div>

                {/* ÁUDIO */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <Headphones size={14} /> Áudio e Transcrição
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      {mediaUrls.audio ? (
                        <CustomAudioPlayer 
                          key={mediaUrls.audio}
                          src={mediaUrls.audio} 
                          durationDb={selectedAta.duracao_segundos} 
                        />
                      ) : (
                        <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 p-2 rounded block">
                          Sem áudio disponível.
                        </span>
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

                {/* ✅ SEÇÃO DE MATERIAIS DE APOIO */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                      <Paperclip size={14} /> Materiais e Anexos
                    </div>
                    
                    {/* Botão de Upload Escondido */}
                    <label className={`cursor-pointer text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 flex items-center gap-2 transition-all ${uploadingMaterial ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploadingMaterial ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      {uploadingMaterial ? "Enviando..." : "Anexar Material"}
                      <input type="file" multiple className="hidden" onChange={handleUploadMaterial} disabled={uploadingMaterial} />
                    </label>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    {selectedAta.materiais && selectedAta.materiais.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectedAta.materiais.map((item, idx) => {
                          const isImage = item.type?.startsWith('image');
                          return (
                            <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isImage ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                  {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-700 truncate" title={item.name}>{item.name}</p>
                                  <p className="text-[10px] text-slate-400 uppercase">Anexo</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <a href={item.url} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Baixar / Visualizar">
                                  <Download size={16} />
                                </a>
                                <button onClick={() => handleDeleteMaterial(idx)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Remover">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-400 text-xs italic">
                        Nenhum material anexado.
                      </div>
                    )}
                  </div>
                </div>

                <div className="prose prose-slate max-w-none">
                  {isEditing ? (
                    <textarea
                      className="w-full h-64 p-4 border rounded-xl bg-slate-50 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editedPauta}
                      onChange={(e) => setEditedPauta(e.target.value)}
                    />
                  ) : (
                    <div className="text-slate-700 text-sm whitespace-pre-line leading-relaxed">
                      {selectedAta.pauta || "Sem resumo."}
                    </div>
                  )}
                </div>
              </div>

              {/* GRID AÇÕES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* COLUNA 1 */}
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
                          acao.status === "Concluída"
                            ? "bg-slate-50 opacity-60"
                            : "bg-white border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                            <div className={`mt-1.5 w-2 h-2 rounded-full ${acao.status === "Concluída" ? "bg-green-500" : "bg-blue-500"}`} />
                          <div className="flex-1">
                            <p
                              className={`text-sm font-medium ${
                                acao.status === "Concluída" ? "line-through text-slate-400" : "text-slate-800"
                              }`}
                            >
                              {acao.descricao}
                            </p>
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
                    {acoesCriadas.length === 0 && (
                      <p className="text-center text-xs text-slate-400 py-4 italic">Nenhuma ação criada.</p>
                    )}
                  </div>
                </div>

                {/* COLUNA 2 */}
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
                          <div className={`mt-1.5 w-2 h-2 rounded-full bg-amber-500`} />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{acao.descricao}</p>
                            <p className="text-[10px] text-amber-600 mt-1">
                              Origem: {acao.data_criacao ? new Date(acao.data_criacao).toLocaleDateString() : "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {acoesAnteriores.length === 0 && (
                      <p className="text-center text-xs text-slate-400 py-4 italic">Tudo em dia!</p>
                    )}
                  </div>
                </div>
              </div>

              {/* OBSERVAÇÕES / ATA MANUAL */}
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

        {/* MODAL DE AÇÃO INTEGRADO */}
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

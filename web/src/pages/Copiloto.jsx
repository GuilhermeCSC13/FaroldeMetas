import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  Mic, Square, Loader2, Cpu, CheckCircle, Search, Calendar, Clock, ExternalLink, 
  Plus, User, AlertTriangle, Camera, Image as ImageIcon, X, Monitor
} from 'lucide-react';
import { getGeminiFlash } from '../services/gemini';
import { useNavigate } from 'react-router-dom';

// --- VARIÁVEIS GLOBAIS (Persistem entre navegações - ESSENCIAL PARA ROBUSTEZ) ---
let globalRecorder = null;
let globalChunks = [];
let globalReuniao = null;
let globalStartTime = null;

const Copiloto = () => {
  const navigate = useNavigate();
  
  // Estados Gerais
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [listaReunioes, setListaReunioes] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState(null);
  const [buscaTexto, setBuscaTexto] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  // Estados Ações
  const [acoesAnteriores, setAcoesAnteriores] = useState([]);
  const [acoesCriadasAgora, setAcoesCriadasAgora] = useState([]);
  const [loadingAcoes, setLoadingAcoes] = useState(false);
  const [novaAcao, setNovaAcao] = useState({ descricao: '', responsavel: '', vencimento: '' });
  const [fotosAcao, setFotosAcao] = useState([]);
  const [uploadingFotos, setUploadingFotos] = useState(false);

  // Modais
  const [acaoDetalhe, setAcaoDetalhe] = useState(null);
  const [modalAcaoAberto, setModalAcaoAberto] = useState(false);

  // Estados Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [timer, setTimer] = useState(0);
  const [pautaExistente, setPautaExistente] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // --- 1. RESTAURAÇÃO DE SESSÃO ---
  useEffect(() => {
    if (globalRecorder && globalRecorder.state === 'recording') {
        mediaRecorderRef.current = globalRecorder;
        setIsRecording(true);
        setReuniaoSelecionada(globalReuniao);
        if (globalStartTime) {
            setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
            timerIntervalRef.current = setInterval(() => {
                setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
            }, 1000);
        }
    }
    fetchReunioesPorData();
    return () => clearInterval(timerIntervalRef.current);
  }, []);

  useEffect(() => {
    if (reuniaoSelecionada) {
      setPautaExistente(reuniaoSelecionada.pauta || null);
      fetchAcoesCompletas(reuniaoSelecionada);
      if (globalReuniao?.id !== reuniaoSelecionada.id) setAcoesCriadasAgora([]);
    }
  }, [reuniaoSelecionada]);

  // --- BUSCAS E AÇÕES (MANTIDO CONFORME ORIGINAL) ---
  const fetchReunioesPorData = async () => {
    setLoadingList(true);
    if (!globalRecorder) setReuniaoSelecionada(null); 
    try {
      const { data, error } = await supabase.from('reunioes').select('*')
        .gte('data_hora', `${dataFiltro}T00:00:00`).lte('data_hora', `${dataFiltro}T23:59:59`)
        .order('data_hora', { ascending: true });
      if (error) throw error;
      setListaReunioes(data || []);
      if (globalReuniao && !data.find(r => r.id === globalReuniao.id)) setListaReunioes(prev => [...prev, globalReuniao]);
    } catch (e) { console.error(e); } finally { setLoadingList(false); }
  };

  const fetchAcoesCompletas = async (reuniao) => {
    setLoadingAcoes(true);
    try {
        const { data: criadasHoje } = await supabase.from('acoes').select('*')
          .eq('reuniao_id', reuniao.id).order('data_criacao', { ascending: false });
        setAcoesCriadasAgora(criadasHoje || []);
    } catch (e) { console.error(e); } finally { setLoadingAcoes(false); }
  };

  const handlePhotoSelect = (e) => { if (e.target.files) setFotosAcao(prev => [...prev, ...Array.from(e.target.files)]); };

  const salvarNovaAcao = async () => {
    if (!novaAcao.descricao || !reuniaoSelecionada) return alert("Descreva a ação.");
    setUploadingFotos(true);
    try {
        const payload = {
            descricao: novaAcao.descricao,
            responsavel: novaAcao.responsavel || 'A Definir',
            data_vencimento: novaAcao.vencimento || null,
            reuniao_id: reuniaoSelecionada.id,
            status: 'Aberta',
            data_criacao: new Date().toISOString()
        };
        const { data, error } = await supabase.from('acoes').insert([payload]).select();
        if (error) throw error;
        setAcoesCriadasAgora([data[0], ...acoesCriadasAgora]);
        setNovaAcao({ descricao: '', responsavel: '', vencimento: '' });
    } catch (e) { alert(e.message); } finally { setUploadingFotos(false); }
  };

  // --- LÓGICA DE GRAVAÇÃO AVANÇADA (TELA + SISTEMA + MIC) ---
  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("⚠️ Selecione uma reunião primeiro.");
    
    try {
      // 1. Captura Tela e Áudio do Sistema
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 20 },
        audio: true 
      });

      // 2. Captura Microfone
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 3. Mixagem de Áudio
      const audioCtx = new AudioContext();
      const sourceScreen = audioCtx.createMediaStreamSource(screenStream);
      const sourceMic = audioCtx.createMediaStreamSource(micStream);
      const dest = audioCtx.createMediaStreamDestination();
      
      sourceScreen.connect(dest);
      sourceMic.connect(dest);

      const finalStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      streamRef.current = finalStream;
      mediaRecorderRef.current = new MediaRecorder(finalStream, { mimeType: 'video/webm;codecs=vp8,opus' });
      
      globalChunks = []; // Reseta chunks globais
      
      mediaRecorderRef.current.ondataavailable = e => { 
        if (e.data.size > 0) globalChunks.push(e.data); 
      };

      mediaRecorderRef.current.onstop = processarComIA;
      
      // Grava em pedaços de 5s para garantir que o buffer não estoure em 2h
      mediaRecorderRef.current.start(5000); 

      globalRecorder = mediaRecorderRef.current;
      globalReuniao = reuniaoSelecionada;
      globalStartTime = Date.now();

      setIsRecording(true);
      setTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
      }, 1000);

      await supabase.from('reunioes').update({ status: 'Em Andamento' }).eq('id', reuniaoSelecionada.id);

    } catch (err) { alert("Erro ao iniciar: " + err.message); }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      streamRef.current.getTracks().forEach(t => t.stop());
      
      globalRecorder = null;
      globalStartTime = null;
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);

      await supabase.from('reunioes').update({ horario_fim: new Date().toISOString() }).eq('id', reuniaoSelecionada.id);
    }
  };

  const processarComIA = async () => {
    setIsProcessing(true);
    setStatusText("Consolidando 2h de vídeo...");
    
    const finalBlob = new Blob(globalChunks, { type: 'video/webm' });
    
    try {
      // Aqui você integraria a chamada para a Edge Function do Google Drive comentada anteriormente
      // Por enquanto, mantemos o fluxo de salvamento e IA Flash
      const model = getGeminiFlash();
      
      // Para reuniões longas, enviamos uma amostra ou apenas o áudio para não exceder limites de token
      const reader = new FileReader();
      reader.readAsDataURL(videoBlob.slice(0, 50 * 1024 * 1024)); // Exemplo de fatia de 50MB
      
      reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          const result = await model.generateContent([
            "Gere uma ata detalhada com Resumo, Decisões e Ações.",
            { inlineData: { data: base64, mimeType: "video/webm" } }
          ]);
          const texto = result.response.text();
          
          await supabase.from('reunioes').update({ pauta: texto, status: 'Realizada', duracao_segundos: timer }).eq('id', reuniaoSelecionada.id);
          setPautaExistente(texto);
          setStatusText("Salvo com sucesso!");
          setIsProcessing(false);
      };
    } catch (e) { 
      alert("Erro IA: " + e.message); 
      setIsProcessing(false);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  return (
    <Layout>
      <div className="h-screen bg-slate-900 text-white flex overflow-hidden font-sans">
        {/* COLUNA ESQUERDA - LISTAGEM */}
        <div className="w-7/12 flex flex-col p-6 border-r border-slate-800">
           <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu className="text-blue-400" /> Copiloto Tático</h1>
                <div className={`px-3 py-1 rounded-full border text-xs font-mono font-bold ${isRecording ? 'bg-red-900/50 border-red-500 text-red-400 animate-pulse' : 'bg-slate-800 border-slate-700 text-green-400'}`}>
                    {isRecording ? '● GRAVANDO TELA' : '● PRONTO'}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <input type="date" className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm outline-none" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
                <input type="text" placeholder="Buscar reunião..." className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm outline-none" value={buscaTexto} onChange={e => setBuscaTexto(e.target.value)} />
            </div>

            <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl mb-6 overflow-y-auto custom-scrollbar">
                {listaReunioes.filter(r => r.titulo.toLowerCase().includes(buscaTexto.toLowerCase())).map(r => (
                    <div key={r.id} onClick={() => !isRecording && setReuniaoSelecionada(r)} className={`p-4 border-b border-slate-700 cursor-pointer ${reuniaoSelecionada?.id === r.id ? 'bg-blue-600/20 border-l-4 border-l-blue-500' : 'hover:bg-slate-700'}`}>
                        <div className="flex justify-between">
                            <span className="font-bold text-sm">{r.titulo}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400">{r.status || 'Pendente'}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* BOTÃO DE GRAVAÇÃO */}
            <div className="h-32 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center relative">
                {isProcessing ? (
                    <div className="text-center"><Loader2 className="animate-spin text-blue-400 mx-auto mb-2"/><span className="text-xs">{statusText}</span></div>
                ) : (
                    <div className="flex items-center gap-4">
                        {isRecording ? (
                            <div className="flex items-center gap-6">
                                <span className="text-4xl font-mono font-bold">{formatTime(timer)}</span>
                                <button onClick={stopRecording} className="w-16 h-16 bg-white text-red-600 rounded-full flex items-center justify-center hover:scale-105 transition-transform"><Square size={24} fill="currentColor"/></button>
                            </div>
                        ) : (
                            <button onClick={startRecording} disabled={!reuniaoSelecionada} className={`w-14 h-14 rounded-full flex items-center justify-center ${!reuniaoSelecionada ? 'bg-slate-700 opacity-50' : 'bg-red-600 hover:scale-110 shadow-lg shadow-red-900/50'}`}><Monitor size={24}/></button>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* COLUNA DIREITA - AÇÕES E ATA */}
        <div className="w-5/12 bg-slate-900 flex flex-col border-l border-slate-800">
            <div className="p-5 border-b border-slate-800">
                <h2 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2"><Plus size={14}/> Nova Ação</h2>
                <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white h-20 outline-none" placeholder="O que precisa ser feito?" value={novaAcao.descricao} onChange={e => setNovaAcao({...novaAcao, descricao: e.target.value})} />
                <div className="flex gap-2 mt-2">
                    <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs w-full" placeholder="Responsável" value={novaAcao.responsavel} onChange={e => setNovaAcao({...novaAcao, responsavel: e.target.value})} />
                    <button onClick={salvarNovaAcao} className="bg-blue-600 px-4 rounded-lg"><Plus size={18}/></button>
                </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
                <h3 className="text-xs font-bold text-blue-400 uppercase mb-4">Ata da Reunião</h3>
                <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
                    {pautaExistente || "Nenhuma ata gerada ainda."}
                </div>
            </div>
        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

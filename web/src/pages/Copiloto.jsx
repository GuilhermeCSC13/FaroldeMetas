import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  Mic, Square, Loader2, Cpu, CheckCircle, Search, Calendar, Clock, ExternalLink, 
  Plus, ListTodo, User, FileText, AlertTriangle, Trash2, Camera, Image as ImageIcon
} from 'lucide-react';
import { getGeminiFlash } from '../services/gemini';
import { useNavigate } from 'react-router-dom';

// --- VARIÁVEIS GLOBAIS (Persistem entre navegações) ---
// Elas mantêm a gravação viva mesmo se você sair da tela
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

  // Estados Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [timer, setTimer] = useState(0);
  const [pautaExistente, setPautaExistente] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // --- 1. RESTAURAÇÃO DE SESSÃO (O SEGREDO) ---
  useEffect(() => {
    // Se existe uma gravação global rodando ao entrar na tela:
    if (globalRecorder && globalRecorder.state === 'recording') {
        console.log("Restaurando sessão de gravação...");
        
        // 1. Reconecta as referências
        mediaRecorderRef.current = globalRecorder;
        audioChunksRef.current = globalChunks;
        
        // 2. Restaura o estado visual
        setIsRecording(true);
        setReuniaoSelecionada(globalReuniao);
        
        // 3. Recalcula e reinicia o timer visual
        if (globalStartTime) {
            const elapsed = Math.floor((Date.now() - globalStartTime) / 1000);
            setTimer(elapsed);
            
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = setInterval(() => {
                setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
            }, 1000);
        }
    }

    fetchReunioesPorData();
    
    // Cleanup ao desmontar (mas NÃO para a gravação global)
    return () => clearInterval(timerIntervalRef.current);
  }, []); // Roda apenas uma vez ao montar o componente

  // --- Monitora Reunião Selecionada ---
  useEffect(() => {
    if (reuniaoSelecionada) {
      setPautaExistente(reuniaoSelecionada.pauta || null);
      fetchAcoesCompletas(reuniaoSelecionada);
      // Se não estivermos restaurando uma sessão, limpa as criadas agora
      if (globalReuniao?.id !== reuniaoSelecionada.id) {
          setAcoesCriadasAgora([]);
      }
    } else {
      setPautaExistente(null);
      setAcoesAnteriores([]);
      setAcoesCriadasAgora([]);
    }
  }, [reuniaoSelecionada]);

  // --- BUSCAS (Mantidas iguais) ---
  const fetchReunioesPorData = async () => {
    setLoadingList(true);
    // Só limpa a seleção se NÃO estiver gravando
    if (!globalRecorder) setReuniaoSelecionada(null); 
    
    try {
      const inicioDia = `${dataFiltro}T00:00:00`;
      const fimDia = `${dataFiltro}T23:59:59`;
      const { data, error } = await supabase
        .from('reunioes')
        .select('*')
        .gte('data_hora', inicioDia)
        .lte('data_hora', fimDia)
        .order('data_hora', { ascending: true });
      if (error) throw error;
      setListaReunioes(data || []);
      
      // Se estiver restaurando, garante que a reunião selecionada apareça na lista visualmente
      if (globalReuniao) {
          const existe = data.find(r => r.id === globalReuniao.id);
          if (!existe) setListaReunioes(prev => [...prev, globalReuniao]);
      }

    } catch (error) { console.error(error); } finally { setLoadingList(false); }
  };

  const fetchAcoesCompletas = async (reuniao) => {
    setLoadingAcoes(true);
    try {
        if (reuniao.tipo_reuniao) {
            const { data: idsDoTipo } = await supabase.from('reunioes').select('id').eq('tipo_reuniao', reuniao.tipo_reuniao).neq('id', reuniao.id);
            const listaIds = (idsDoTipo || []).map(r => r.id);
            if (listaIds.length > 0) {
                const { data: pendencias } = await supabase.from('acoes').select('*').in('reuniao_id', listaIds).eq('status', 'Aberta').order('data_criacao', { ascending: false });
                setAcoesAnteriores(pendencias || []);
            } else { setAcoesAnteriores([]); }
        }
        const { data: criadasHoje } = await supabase.from('acoes').select('*').eq('reuniao_id', reuniao.id).order('data_criacao', { ascending: false });
        setAcoesCriadasAgora(criadasHoje || []);
    } catch (e) { console.error(e); } finally { setLoadingAcoes(false); }
  };

  // --- LÓGICA DE AÇÕES (Upload e Save) ---
  const handlePhotoSelect = (e) => { if (e.target.files) setFotosAcao(prev => [...prev, ...Array.from(e.target.files)]); };
  
  const uploadFotos = async () => {
    const urls = [];
    for (const file of fotosAcao) {
        const fileName = `evidencia-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const { error } = await supabase.storage.from('evidencias').upload(fileName, file);
        if (!error) {
            const { data } = supabase.storage.from('evidencias').getPublicUrl(fileName);
            urls.push(data.publicUrl);
        }
    }
    return urls;
  };

  const salvarNovaAcao = async () => {
    if (!novaAcao.descricao || !reuniaoSelecionada) return alert("Descreva a ação.");
    setUploadingFotos(true);
    try {
        const urlsFotos = await uploadFotos();
        const payload = {
            descricao: novaAcao.descricao,
            responsavel: novaAcao.responsavel || 'A Definir',
            data_vencimento: novaAcao.vencimento || null,
            reuniao_id: reuniaoSelecionada.id,
            status: 'Aberta',
            data_criacao: new Date().toISOString(),
            fotos: urlsFotos
        };
        const { data, error } = await supabase.from('acoes').insert([payload]).select();
        if (error) throw error;
        if (data) {
            setAcoesCriadasAgora([data[0], ...acoesCriadasAgora]);
            setNovaAcao({ descricao: '', responsavel: '', vencimento: '' });
            setFotosAcao([]);
        }
    } catch (error) { alert("Erro ao salvar ação: " + error.message); } finally { setUploadingFotos(false); }
  };

  // --- LÓGICA DE GRAVAÇÃO (COM PERSISTÊNCIA GLOBAL) ---
  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("⚠️ Selecione uma reunião primeiro.");
    if (reuniaoSelecionada.status === 'Realizada' && !window.confirm("Esta reunião já foi realizada. Deseja sobrescrever a ata?")) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = []; // Reseta local
      
      // Configura eventos
      mediaRecorderRef.current.ondataavailable = e => { 
          if (e.data.size > 0) {
              audioChunksRef.current.push(e.data);
              globalChunks.push(e.data); // Salva no global também
          }
      };
      
      mediaRecorderRef.current.onstop = processarAudioComIA;
      mediaRecorderRef.current.start(1000);

      // --- SALVA NO GLOBAL PARA PERSISTIR ---
      globalRecorder = mediaRecorderRef.current;
      globalChunks = []; // Limpa o global antigo
      globalReuniao = reuniaoSelecionada;
      globalStartTime = Date.now();

      setIsRecording(true);
      setTimer(0);
      
      // Timer visual
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
      }, 1000);

      // Marca inicio no banco
      await supabase.from('reunioes').update({ horario_inicio: new Date().toISOString(), status: 'Em Andamento' }).eq('id', reuniaoSelecionada.id);

    } catch (err) { alert("Erro Mic: " + err.message); }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop(); // Isso dispara o onstop -> processarAudioComIA
      
      // Limpa Globais
      globalRecorder = null;
      globalChunks = [];
      globalReuniao = null;
      globalStartTime = null;
      
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());

      await supabase.from('reunioes').update({ horario_fim: new Date().toISOString() }).eq('id', reuniaoSelecionada.id);
    }
  };

  const blobToGenerativePart = async (blob, mimeType) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ inlineData: { data: reader.result.split(',')[1], mimeType } });
        reader.readAsDataURL(blob);
    });
  };

  const processarAudioComIA = async () => {
    setIsProcessing(true);
    setStatusText("Processando áudio...");
    
    // Usa o ref local que está sincronizado
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `rec-${reuniaoSelecionada.id}-${Date.now()}.webm`;

    try {
      const { data: uploadData } = await supabase.storage.from('gravacoes').upload(fileName, audioBlob);
      const { data: urlData } = supabase.storage.from('gravacoes').getPublicUrl(fileName);

      setStatusText("Gerando Ata IA...");
      const model = getGeminiFlash();
      const audioPart = await blobToGenerativePart(audioBlob, "audio/webm");

      const prompt = `
        Você é uma IA de auditoria de reuniões.
        Analise o áudio da reunião: "${reuniaoSelecionada.titulo}".
        1. Se for ruído/teste, responda APENAS: "Gravação de teste identificada."
        2. Se for real, gere Markdown:
           # ATA DE REUNIÃO
           ## 1. Resumo
           ## 2. Decisões
           ## 3. Ações
      `;

      const result = await model.generateContent([prompt, audioPart]);
      const texto = result.response.text();

      await supabase.from('reunioes').update({ 
          audio_url: urlData.publicUrl, 
          pauta: texto, 
          status: 'Realizada',
          duracao_segundos: timer
      }).eq('id', reuniaoSelecionada.id);

      setPautaExistente(texto);
      setListaReunioes(prev => prev.map(r => r.id === reuniaoSelecionada.id ? {...r, pauta: texto, status: 'Realizada'} : r));
      setStatusText("Salvo!");

    } catch (error) { alert("Erro IA: " + error.message); } finally { setIsProcessing(false); }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;
  const listaFiltrada = listaReunioes.filter(r => r.titulo.toLowerCase().includes(buscaTexto.toLowerCase()));

  return (
    <Layout>
      <div className="h-screen bg-slate-900 text-white font-sans flex overflow-hidden">
        
        {/* --- COLUNA ESQUERDA --- */}
        <div className="w-7/12 flex flex-col p-6 border-r border-slate-800 relative">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu className="text-blue-400" /> Copiloto Tático</h1>
                <div className={`px-3 py-1 rounded-full border text-xs font-mono font-bold ${isRecording ? 'bg-red-900/50 border-red-500 text-red-400 animate-pulse' : 'bg-slate-800 border-slate-700 text-green-400'}`}>
                    {isRecording ? '● REC' : '● ONLINE'}
                </div>
            </div>

            <div className={`grid grid-cols-2 gap-3 mb-4 transition-opacity ${isRecording ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="bg-slate-800 border border-slate-700 rounded-lg flex items-center px-3 py-2">
                    <Calendar size={16} className="text-slate-400 mr-2" />
                    <input type="date" className="bg-transparent text-white text-sm w-full outline-none" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg flex items-center px-3 py-2">
                    <Search size={16} className="text-slate-400 mr-2" />
                    <input type="text" placeholder="Filtrar..." className="bg-transparent text-white text-sm w-full outline-none" value={buscaTexto} onChange={e => setBuscaTexto(e.target.value)} />
                </div>
            </div>

            <div className={`flex-1 bg-slate-800/50 border border-slate-700 rounded-xl mb-6 overflow-y-auto custom-scrollbar ${isRecording ? 'opacity-50 pointer-events-none' : ''}`}>
                {loadingList ? <div className="p-4 text-center"><Loader2 className="animate-spin inline mr-2"/> Carregando...</div> :
                 listaFiltrada.map(r => (
                    <div key={r.id} onClick={() => setReuniaoSelecionada(r)}
                        className={`p-4 border-b border-slate-700 cursor-pointer transition-colors ${reuniaoSelecionada?.id === r.id ? 'bg-blue-600/20 border-l-4 border-l-blue-500' : 'hover:bg-slate-700 border-l-4 border-l-transparent'}`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-sm">{r.titulo}</h3>
                                <p className="text-xs text-slate-400 mt-1 flex gap-2">
                                    <Clock size={12}/> {new Date(r.data_hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    <span className="bg-slate-700 px-1 rounded">{r.tipo_reuniao || 'Geral'}</span>
                                </p>
                            </div>
                            {r.pauta && <CheckCircle size={16} className="text-green-500" />}
                        </div>
                    </div>
                ))}
            </div>

            <div className="h-32 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center relative overflow-hidden shrink-0">
                {isProcessing ? (
                    <div className="text-center"><Loader2 className="animate-spin text-blue-400 mb-2 mx-auto"/><span className="text-xs animate-pulse">{statusText}</span></div>
                ) : (
                    <div className="flex flex-col items-center z-10">
                        {isRecording ? (
                            <div className="flex items-center gap-6">
                                <span className="text-4xl font-mono font-bold text-white">{formatTime(timer)}</span>
                                <button onClick={stopRecording} className="w-16 h-16 bg-white text-red-600 rounded-full flex items-center justify-center hover:scale-105 transition-transform"><Square size={24} fill="currentColor"/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 font-bold uppercase">{reuniaoSelecionada ? 'Reunião Selecionada' : 'Selecione acima'}</p>
                                    <p className="text-sm font-bold text-white max-w-[200px] truncate">{reuniaoSelecionada?.titulo || '--'}</p>
                                </div>
                                <button onClick={startRecording} disabled={!reuniaoSelecionada} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!reuniaoSelecionada ? 'bg-slate-700 opacity-50' : 'bg-red-600 hover:scale-110 shadow-lg shadow-red-900/50'}`}>
                                    <Mic size={24}/>
                                </button>
                            </div>
                        )}
                    </div>
                )}
                 {isRecording && (
                    <div className="absolute bottom-0 left-0 w-full flex items-end justify-center gap-1 h-full opacity-20 pointer-events-none px-4 pb-2">
                        {[...Array(30)].map((_, i) => (
                            <div key={i} className="flex-1 bg-red-500 rounded-t-sm transition-all duration-100" style={{ height: `${Math.random() * 80 + 10}%` }}></div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* --- COLUNA DIREITA --- */}
        <div className="w-5/12 bg-slate-900 flex flex-col border-l border-slate-800">
            <div className="p-5 border-b border-slate-800 bg-slate-800/30">
                <h2 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Plus size={14}/> Nova Ação</h2>
                <div className={`space-y-2 ${!reuniaoSelecionada ? 'opacity-50 pointer-events-none' : ''}`}>
                    <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none resize-none h-20" placeholder="O que precisa ser feito?" value={novaAcao.descricao} onChange={e => setNovaAcao({...novaAcao, descricao: e.target.value})} />
                    <div className="flex gap-2">
                        <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white w-1/3 outline-none" placeholder="Quem?" value={novaAcao.responsavel} onChange={e => setNovaAcao({...novaAcao, responsavel: e.target.value})} />
                        <input type="date" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white w-1/3 outline-none" value={novaAcao.vencimento} onChange={e => setNovaAcao({...novaAcao, vencimento: e.target.value})} />
                         <label className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400 flex items-center justify-center cursor-pointer hover:bg-slate-700">
                            <Camera size={16} />
                            <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                            {fotosAcao.length > 0 && <span className="ml-1 text-green-400">({fotosAcao.length})</span>}
                        </label>
                        <button onClick={salvarNovaAcao} disabled={uploadingFotos} className="bg-blue-600 text-white px-4 rounded-lg flex items-center justify-center hover:bg-blue-500 disabled:opacity-50">
                             {uploadingFotos ? <Loader2 size={16} className="animate-spin"/> : <Plus size={18}/>}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                <div>
                    <h3 className="text-xs font-bold text-green-500 uppercase mb-2 flex items-center gap-2"><CheckCircle size={14}/> Criadas Agora ({acoesCriadasAgora.length})</h3>
                    <div className="space-y-2">
                        {acoesCriadasAgora.map(acao => (
                            <div key={acao.id} className="bg-slate-800/50 border border-green-900/30 p-3 rounded-lg">
                                <p className="text-sm text-slate-200">{acao.descricao}</p>
                                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                                    <span className="flex items-center gap-1"><User size={10}/> {acao.responsavel}</span>
                                    {acao.data_vencimento && <span className="flex items-center gap-1 text-red-400"><Clock size={10}/> {new Date(acao.data_vencimento).toLocaleDateString()}</span>}
                                    {acao.fotos && acao.fotos.length > 0 && <span className="flex items-center gap-1 text-blue-400"><ImageIcon size={10}/> {acao.fotos.length}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-bold text-amber-500 uppercase mb-2 flex items-center gap-2"><AlertTriangle size={14}/> Pendências Antigas ({acoesAnteriores.length})</h3>
                    <div className="space-y-2">
                        {acoesAnteriores.map(acao => (
                            <div key={acao.id} className="bg-slate-800/30 border border-slate-700 p-3 rounded-lg opacity-80">
                                <p className="text-sm text-slate-400">{acao.descricao}</p>
                                <div className="flex justify-between mt-1"><span className="text-[10px] text-slate-600">{new Date(acao.data_criacao).toLocaleDateString()}</span><span className="text-[10px] text-amber-600 font-bold">{acao.responsavel}</span></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {pautaExistente && (
                <div className="h-40 border-t border-slate-800 bg-slate-900 p-4 overflow-y-auto custom-scrollbar">
                    <h3 className="text-xs font-bold text-blue-400 uppercase mb-2">Resumo da Ata</h3>
                    <div className="text-xs text-slate-400 whitespace-pre-line">{pautaExistente}</div>
                </div>
            )}
        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

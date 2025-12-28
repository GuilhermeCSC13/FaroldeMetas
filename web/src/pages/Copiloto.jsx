import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  Mic, Square, Loader2, Cpu, CheckCircle, Search, Calendar, Clock, ExternalLink, 
  Plus, ListTodo, User, FileText
} from 'lucide-react';
import { getGeminiFlash } from '../services/gemini';
import { useNavigate } from 'react-router-dom';

const Copiloto = () => {
  const navigate = useNavigate();
  
  // --- ESTADOS GERAIS ---
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [listaReunioes, setListaReunioes] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState(null);
  const [buscaTexto, setBuscaTexto] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  // --- ESTADOS DE AÇÕES ---
  const [acoesPendentes, setAcoesPendentes] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: '', responsavel: '' });
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  // --- ESTADOS DE GRAVAÇÃO/IA ---
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [timer, setTimer] = useState(0);
  const [pautaExistente, setPautaExistente] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const intervalRef = useRef(null);

  // 1. Carrega reuniões ao mudar data
  useEffect(() => {
    fetchReunioesPorData();
  }, [dataFiltro]);

  // 2. Ao selecionar reunião, carrega ata e busca AÇÕES RELACIONADAS
  useEffect(() => {
    if (reuniaoSelecionada) {
      setPautaExistente(reuniaoSelecionada.pauta || null);
      // Só busca ações se tiver um tipo definido, senão busca geral ou nada
      fetchAcoesDoTipo(reuniaoSelecionada.tipo_reuniao);
    } else {
      setPautaExistente(null);
      setAcoesPendentes([]);
    }
  }, [reuniaoSelecionada]);

  // --- PROTEÇÃO CONTRA SAÍDA ACIDENTAL ---
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isRecording) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRecording]);

  // --- BUSCAS DE DADOS ---
  const fetchReunioesPorData = async () => {
    setLoadingList(true);
    if (!isRecording) setReuniaoSelecionada(null); 
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
    } catch (error) {
      console.error("Erro agenda:", error);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchAcoesDoTipo = async (tipo) => {
    // Se não tiver tipo, não busca para não dar erro
    if (!tipo) {
        setAcoesPendentes([]);
        return;
    }

    setLoadingAcoes(true);
    try {
      // 1. Pega IDs de reuniões desse tipo
      const { data: idsReunioes, error } = await supabase
        .from('reunioes')
        .select('id')
        .eq('tipo_reuniao', tipo);
      
      if (error) throw error;

      // CORREÇÃO: Adicionado (|| []) para garantir que não quebre se vier null
      const listaIds = (idsReunioes || []).map(r => r.id);

      if (listaIds.length > 0) {
          const { data: acoes } = await supabase
            .from('acoes')
            .select('*')
            .in('reuniao_id', listaIds)
            .eq('status', 'Aberta')
            .order('data_criacao', { ascending: false });
            
          setAcoesPendentes(acoes || []);
      } else {
          setAcoesPendentes([]);
      }
    } catch (e) {
      console.error("Erro ao buscar ações:", e);
      setAcoesPendentes([]); // Garante lista vazia em caso de erro
    } finally {
      setLoadingAcoes(false);
    }
  };

  const salvarNovaAcao = async () => {
    if (!novaAcao.descricao || !reuniaoSelecionada) return;
    
    try {
        const payload = {
            descricao: novaAcao.descricao,
            responsavel: novaAcao.responsavel || 'Geral',
            reuniao_id: reuniaoSelecionada.id,
            status: 'Aberta',
            data_criacao: new Date().toISOString()
        };

        const { data, error } = await supabase.from('acoes').insert([payload]).select();
        if (error) throw error;

        if (data) {
            setAcoesPendentes([data[0], ...acoesPendentes]);
            setNovaAcao({ descricao: '', responsavel: '' });
        }
    } catch (error) {
        alert("Erro ao salvar ação: " + error.message);
    }
  };

  const concluirAcao = async (id) => {
      try {
          const { error } = await supabase.from('acoes').update({ status: 'Concluída' }).eq('id', id);
          if (!error) {
              setAcoesPendentes(prev => prev.filter(a => a.id !== id));
          }
      } catch (e) {
          console.error(e);
      }
  };

  // --- LÓGICA DE GRAVAÇÃO ---
  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("⚠️ Selecione uma reunião primeiro.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = processarAudioComIA;
      
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setTimer(0);
      intervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } catch (err) {
      alert("Erro Mic: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(intervalRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
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
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `rec-${reuniaoSelecionada.id}-${Date.now()}.webm`;

    try {
      const { data: uploadData } = await supabase.storage.from('gravacoes').upload(fileName, audioBlob);
      const { data: urlData } = supabase.storage.from('gravacoes').getPublicUrl(fileName);

      setStatusText("Gerando Ata IA...");
      const model = getGeminiFlash();
      const audioPart = await blobToGenerativePart(audioBlob, "audio/webm");

      const prompt = `
        Gere uma ATA DE REUNIÃO Executiva.
        Contexto: Reunião do tipo "${reuniaoSelecionada.tipo_reuniao || 'Geral'}" - Título: "${reuniaoSelecionada.titulo}".
        
        # ATA DE REUNIÃO
        ## 1. Resumo
        [Resumo conciso]
        ## 2. Decisões
        * ✅ [Decisão]
        ## 3. Ações Definidas (Importante)
        * [Quem] -> [O que]
      `;

      const result = await model.generateContent([prompt, audioPart]);
      const texto = result.response.text();

      await supabase.from('reunioes').update({ 
          audio_url: urlData.publicUrl, 
          pauta: texto, 
          status: 'Realizada' 
      }).eq('id', reuniaoSelecionada.id);

      setPautaExistente(texto);
      // Atualiza lista local para mostrar o check verde
      setListaReunioes(prev => prev.map(r => r.id === reuniaoSelecionada.id ? {...r, pauta: texto} : r));
      setStatusText("Salvo!");
    } catch (error) {
      alert("Erro: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  // Filtro visual
  const listaFiltrada = listaReunioes.filter(r => r.titulo.toLowerCase().includes(buscaTexto.toLowerCase()));

  return (
    <Layout>
      <div className="h-screen bg-slate-900 text-white font-sans flex overflow-hidden">
        
        {/* --- COLUNA ESQUERDA (60%) - GRAVADOR E AGENDA --- */}
        <div className="w-7/12 flex flex-col p-6 border-r border-slate-800 relative">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Cpu className="text-blue-400" /> Copiloto Tático
                    </h1>
                    <p className="text-slate-400 text-xs">Inteligência Artificial de Gravação</p>
                </div>
                <div className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    <span className="text-xs font-mono text-green-400 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                        {isRecording ? 'GRAVANDO' : 'ONLINE'}
                    </span>
                </div>
            </div>

            {/* Filtros */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 transition-opacity ${isRecording ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="bg-slate-800 border border-slate-700 rounded-lg flex items-center px-3 py-2">
                    <Calendar size={16} className="text-slate-400 mr-2" />
                    <input type="date" className="bg-transparent text-white text-sm outline-none w-full cursor-pointer" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg flex items-center px-3 py-2">
                    <Search size={16} className="text-slate-400 mr-2" />
                    <input type="text" placeholder="Filtrar..." className="bg-transparent text-white text-sm outline-none w-full" value={buscaTexto} onChange={e => setBuscaTexto(e.target.value)} />
                </div>
            </div>

            {/* Lista de Reuniões */}
            <div className={`flex-1 bg-slate-800/50 border border-slate-700 rounded-xl mb-6 overflow-y-auto custom-scrollbar ${isRecording ? 'opacity-80 pointer-events-none' : ''}`}>
                {loadingList ? (
                    <div className="flex items-center justify-center h-full text-slate-500 gap-2"><Loader2 className="animate-spin"/> Carregando...</div>
                ) : listaFiltrada.length > 0 ? listaFiltrada.map(r => (
                    <div 
                        key={r.id} 
                        onClick={() => setReuniaoSelecionada(r)}
                        className={`p-4 border-b border-slate-700 cursor-pointer transition-colors ${reuniaoSelecionada?.id === r.id ? 'bg-blue-600/20 border-l-4 border-l-blue-500' : 'hover:bg-slate-700 border-l-4 border-l-transparent'}`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-sm">{r.titulo}</h3>
                                <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                                    <Clock size={12}/> {new Date(r.data_hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {r.tipo_reuniao}
                                </p>
                            </div>
                            {r.pauta && <CheckCircle size={16} className="text-green-500" />}
                        </div>
                    </div>
                )) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                        <Calendar size={32} className="mb-2 opacity-30"/>
                        <p className="text-sm">Sem reuniões nesta data.</p>
                        <button onClick={() => navigate('/central-reunioes')} className="text-blue-400 text-xs mt-2 hover:underline flex items-center gap-1">
                            Agendar na Agenda <ExternalLink size={10}/>
                        </button>
                    </div>
                )}
            </div>

            {/* Área de Gravação */}
            <div className="h-32 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center relative overflow-hidden shrink-0">
                {isProcessing ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-blue-400"/>
                        <span className="text-xs font-bold animate-pulse">{statusText}</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center z-10">
                        {isRecording ? (
                            <div className="flex items-center gap-4">
                                <span className="text-4xl font-mono font-bold text-white tracking-widest">{formatTime(timer)}</span>
                                <button onClick={stopRecording} className="w-14 h-14 bg-white text-red-600 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform animate-pulse">
                                    <Square size={24} fill="currentColor"/>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-slate-400 uppercase tracking-wide">
                                    {reuniaoSelecionada ? `Pronto: ${reuniaoSelecionada.titulo}` : 'Selecione uma reunião'}
                                </span>
                                <button 
                                    onClick={startRecording} 
                                    disabled={!reuniaoSelecionada}
                                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${!reuniaoSelecionada ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-red-600 text-white hover:scale-110 hover:bg-red-500'}`}
                                >
                                    <Mic size={24}/>
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {/* Visualizer Background */}
                {isRecording && (
                    <div className="absolute bottom-0 left-0 w-full flex items-end justify-center gap-1 h-full opacity-20 pointer-events-none px-4 pb-2">
                        {[...Array(30)].map((_, i) => (
                            <div key={i} className="flex-1 bg-red-500 rounded-t-sm transition-all duration-100" style={{ height: `${Math.random() * 80 + 10}%` }}></div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* --- COLUNA DIREITA (40%) - AÇÕES E ATA --- */}
        <div className="w-5/12 bg-slate-800/30 flex flex-col border-l border-slate-800">
            
            {/* Seção 1: Nova Ação */}
            <div className="p-6 border-b border-slate-800">
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ListTodo size={16}/> Ações da Reunião
                </h2>
                
                <div className={`bg-slate-800 p-4 rounded-xl border border-slate-700 ${!reuniaoSelecionada ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input 
                        className="w-full bg-transparent border-b border-slate-600 pb-2 mb-3 text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-slate-500 text-white"
                        placeholder="Descreva a ação..."
                        value={novaAcao.descricao}
                        onChange={e => setNovaAcao({...novaAcao, descricao: e.target.value})}
                    />
                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center bg-slate-900 rounded-lg px-3 border border-slate-700">
                            <User size={14} className="text-slate-500 mr-2"/>
                            <input 
                                className="bg-transparent py-2 text-xs outline-none w-full text-white"
                                placeholder="Responsável"
                                value={novaAcao.responsavel}
                                onChange={e => setNovaAcao({...novaAcao, responsavel: e.target.value})}
                            />
                        </div>
                        <button onClick={salvarNovaAcao} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-lg flex items-center justify-center transition-colors">
                            <Plus size={18}/>
                        </button>
                    </div>
                </div>
            </div>

            {/* Seção 2: Lista de Ações */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase">
                        Pendências {reuniaoSelecionada ? `(${reuniaoSelecionada.tipo_reuniao || 'Geral'})` : ''}
                    </h3>
                    <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">{acoesPendentes.length}</span>
                </div>

                {loadingAcoes ? (
                    <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-slate-500"/></div>
                ) : acoesPendentes.length > 0 ? (
                    <div className="space-y-2">
                        {acoesPendentes.map(acao => (
                            <div key={acao.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex gap-3 hover:border-slate-500 transition-colors group">
                                <button onClick={() => concluirAcao(acao.id)} className="mt-1 w-4 h-4 rounded border border-slate-500 hover:bg-green-500 hover:border-green-500 transition-colors shrink-0"></button>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-200 leading-tight truncate">{acao.descricao}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full truncate max-w-[100px]">{acao.responsavel}</span>
                                        <span className="text-[10px] text-slate-500">{new Date(acao.data_criacao).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-slate-600 py-10 border-2 border-dashed border-slate-800 rounded-xl">
                        <CheckCircle size={24} className="mx-auto mb-2 opacity-20"/>
                        <p className="text-xs">Nenhuma pendência.</p>
                    </div>
                )}
            </div>

            {/* Seção 3: Preview da ATA */}
            {pautaExistente && (
                <div className="h-1/3 border-t border-slate-800 bg-slate-900 p-6 overflow-hidden flex flex-col shrink-0">
                    <h3 className="text-xs font-bold text-green-500 uppercase mb-2 flex items-center gap-2">
                        <FileText size={14}/> Ata Registrada
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                        {pautaExistente}
                    </div>
                </div>
            )}

        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

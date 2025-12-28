import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  Mic, Square, Loader2, Cpu, FileText, RefreshCw, CheckCircle, Search, Radio, Calendar, Clock, AlertCircle 
} from 'lucide-react';
import { getGeminiFlash } from '../services/gemini';

const Copiloto = () => {
  const [listaReunioes, setListaReunioes] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState('');
  const [pautaExistente, setPautaExistente] = useState(null);
  const [busca, setBusca] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  // Estados de Gravação/IA
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [timer, setTimer] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchReunioesRelevantes();
  }, []);

  // Monitora mudança na seleção para carregar ata existente
  useEffect(() => {
    if (reuniaoSelecionada) {
      const reuniao = listaReunioes.find(r => r.id === reuniaoSelecionada);
      if (reuniao && reuniao.pauta && reuniao.pauta.length > 10) {
        setPautaExistente(reuniao.pauta);
      } else {
        setPautaExistente(null);
      }
    } else {
      setPautaExistente(null);
    }
  }, [reuniaoSelecionada, listaReunioes]);

  // --- 1. BUSCA INTELIGENTE (Corrigida para achar HOJE) ---
  const fetchReunioesRelevantes = async () => {
    setLoadingList(true);
    try {
      // Define uma janela de tempo: De 2 dias atrás até 15 dias no futuro.
      // Isso elimina as reuniões de 2026 e foca no "Agora".
      const hoje = new Date();
      
      const dataInicio = new Date(hoje);
      dataInicio.setDate(hoje.getDate() - 2); // Pega reuniões recentes passadas
      
      const dataFim = new Date(hoje);
      dataFim.setDate(hoje.getDate() + 15);   // Pega próximas 2 semanas

      const { data, error } = await supabase
        .from('reunioes')
        .select('*')
        .gte('data_hora', dataInicio.toISOString())
        .lte('data_hora', dataFim.toISOString())
        .order('data_hora', { ascending: true }); // Mais antigas/hoje primeiro

      if (error) throw error;
      
      setListaReunioes(data || []);
      // NÃO seleciona automaticamente para evitar erro. Usuário deve clicar.
      setReuniaoSelecionada(''); 

    } catch (error) {
      console.error("Erro ao buscar reuniões:", error);
      alert("Erro ao carregar agenda.");
    } finally {
      setLoadingList(false);
    }
  };

  // --- 2. LÓGICA DE FILTRO (Melhorada) ---
  const reunioesFiltradas = listaReunioes.filter(r => {
    const termo = busca.toLowerCase();
    const dataFormatada = new Date(r.data_hora).toLocaleDateString('pt-BR');
    return r.titulo.toLowerCase().includes(termo) || dataFormatada.includes(termo);
  });

  // --- 3. GRAVAÇÃO & IA ---
  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("⚠️ Por segurança, selecione uma reunião na lista antes de gravar.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 16000 };
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = processarAudioComIA;
      
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setTimer(0);
      intervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } catch (err) {
      alert("Erro ao acessar microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(intervalRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const blobToGenerativePart = async (blob, mimeType) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ inlineData: { data: reader.result.split(',')[1], mimeType } });
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const processarAudioComIA = async () => {
    setIsProcessing(true);
    setStatusText("Enviando áudio seguro...");
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `reuniao-${reuniaoSelecionada}-${Date.now()}.webm`;

    try {
      // Upload Supabase
      const { error: uploadError } = await supabase.storage.from('gravacoes').upload(fileName, audioBlob);
      if (uploadError) console.warn("Aviso: Backup de áudio falhou, mas transcrição continuará.");
      
      const { data: urlData } = supabase.storage.from('gravacoes').getPublicUrl(fileName);

      // IA
      setStatusText("Gerando Ata Inteligente...");
      const model = getGeminiFlash();
      const audioPart = await blobToGenerativePart(audioBlob, "audio/webm");

      const prompt = `
        Atue como uma Secretária Executiva Sênior.
        Analise o áudio da reunião e gere uma ATA ESTRUTURADA.

        FORMATO MARKDOWN OBRIGATÓRIO:
        ## 📋 ATA DE REUNIÃO
        **Data:** ${new Date().toLocaleDateString()}
        
        ### 1. Resumo Executivo
        [Resumo breve do objetivo e tom da reunião]

        ### 2. Tópicos Discutidos
        * [Detalhe 1]
        * [Detalhe 2]
        
        ### 3. Decisões e Definições (Importante)
        * ✅ [Decisão tomada]

        ### 4. Próximos Passos (Action Plan)
        * [Responsável] -> [Ação] (Prazo: [Data])
        
        ---
        *Nota: Se o áudio for apenas teste ou silêncio, responda: "Gravação de teste identificada."*
      `;

      const result = await model.generateContent([prompt, audioPart]);
      const textoGerado = result.response.text();

      // Salvar Banco
      const { error } = await supabase.from('reunioes').update({ 
          audio_url: urlData.publicUrl,
          pauta: textoGerado,
          status: 'Realizada'
      }).eq('id', reuniaoSelecionada);

      if (error) throw error;

      setPautaExistente(textoGerado);
      // Atualiza lista local
      setListaReunioes(prev => prev.map(r => r.id === reuniaoSelecionada ? {...r, pauta: textoGerado} : r));
      setStatusText("Concluído!");

    } catch (error) {
      alert("Erro no processamento: " + error.message);
    } finally {
      setIsProcessing(false);
      setStatusText("");
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Layout>
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white font-sans relative overflow-hidden p-4">
        
        {/* Fundo Decorativo */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500 rounded-full blur-[120px]"></div>
        </div>

        <div className="z-10 w-full max-w-3xl flex flex-col items-center">
            
            {/* Cabeçalho */}
            <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-2 bg-slate-800/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-700 mb-4 shadow-lg">
                    <Cpu size={14} className="text-blue-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-100">IA Ativa • Gemini 1.5 Flash</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight mb-2">Copiloto Tático</h1>
                <p className="text-slate-400 text-sm">Selecione uma reunião e grave para gerar a ata automática.</p>
            </div>

            {/* CARD DE CONTROLE */}
            <div className="w-full bg-slate-800/60 backdrop-blur-sm p-6 rounded-2xl border border-slate-700 shadow-2xl">
                
                {/* --- SEÇÃO DE BUSCA E SELEÇÃO --- */}
                <div className="mb-6">
                    <div className="flex gap-2 mb-2">
                         <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                            <input 
                                type="text" 
                                placeholder="Buscar reunião por nome..." 
                                className="w-full bg-slate-900/80 border border-slate-600 text-slate-200 pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-600 transition-all text-sm"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                disabled={isRecording || isProcessing}
                            />
                        </div>
                        <button 
                            onClick={fetchReunioesRelevantes} 
                            disabled={loadingList || isRecording}
                            className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl transition-colors border border-slate-600"
                            title="Atualizar lista"
                        >
                            <RefreshCw size={20} className={loadingList ? "animate-spin" : ""} />
                        </button>
                    </div>

                    {/* Lista de Seleção Melhorada (Scrollável) */}
                    <div className="bg-slate-900/80 border border-slate-600 rounded-xl overflow-hidden max-h-40 overflow-y-auto custom-scrollbar">
                        {loadingList ? (
                             <div className="p-4 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin"/> Carregando agenda...
                             </div>
                        ) : reunioesFiltradas.length > 0 ? (
                            <div className="flex flex-col">
                                {reunioesFiltradas.map(r => {
                                    const isSelected = reuniaoSelecionada === r.id;
                                    const dt = new Date(r.data_hora);
                                    return (
                                        <button 
                                            key={r.id}
                                            onClick={() => !isRecording && !isProcessing && setReuniaoSelecionada(r.id)}
                                            disabled={isRecording || isProcessing}
                                            className={`flex items-center justify-between p-3 text-left border-b border-slate-700 last:border-0 transition-colors ${isSelected ? 'bg-blue-600/20 text-blue-100' : 'hover:bg-slate-800 text-slate-300'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-slate-600'}`}></div>
                                                <div>
                                                    <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>{r.titulo}</p>
                                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                                        <Calendar size={10}/> {dt.toLocaleDateString()} 
                                                        <Clock size={10}/> {dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                    </p>
                                                </div>
                                            </div>
                                            {r.pauta && <CheckCircle size={14} className="text-green-500" title="Ata já existe"/>}
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-slate-500 text-xs">
                                Nenhuma reunião encontrada nos próximos dias.
                            </div>
                        )}
                    </div>
                    {!reuniaoSelecionada && !loadingList && (
                        <p className="text-xs text-yellow-500/80 mt-2 flex items-center gap-1">
                            <AlertCircle size={12}/> Selecione uma reunião acima para habilitar a gravação.
                        </p>
                    )}
                </div>

                {/* --- ÁREA DE AÇÃO --- */}
                <div className="border-t border-slate-700 pt-6">
                    {pautaExistente && !isRecording && !isProcessing ? (
                        // MODO: ATA PRONTA
                        <div className="bg-white text-slate-800 rounded-xl p-6 animate-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                                <div className="flex items-center gap-2 text-green-700 font-bold">
                                    <CheckCircle size={20} />
                                    <span>Ata Registrada</span>
                                </div>
                                <button 
                                    onClick={() => { if(window.confirm("Regravar irá substituir a ata atual. Confirmar?")) setPautaExistente(null); }}
                                    className="text-xs flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 px-2 py-1 rounded hover:bg-red-50"
                                >
                                    <RefreshCw size={12} /> Regravar
                                </button>
                            </div>
                            <div className="prose prose-sm max-w-none text-slate-600 max-h-[200px] overflow-y-auto custom-scrollbar leading-relaxed">
                                {pautaExistente.split('\n').map((line, i) => (
                                    <p key={i} className="mb-1">{line}</p>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // MODO: GRAVAÇÃO
                        <div className="flex flex-col items-center justify-center">
                            
                            {/* Visualizer / Timer */}
                            <div className="mb-6 h-16 flex flex-col items-center justify-end w-full">
                                {isRecording ? (
                                    <>
                                        <div className="flex gap-1 items-end h-8 mb-2">
                                            {[...Array(20)].map((_, i) => (
                                                <div key={i} className="w-1.5 bg-red-500 rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDuration: `${0.3 + Math.random()}s` }}></div>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2 text-red-400 animate-pulse">
                                            <Radio size={12} className="fill-current" />
                                            <span className="font-mono text-3xl font-bold tracking-wider text-white">{formatTime(timer)}</span>
                                        </div>
                                    </>
                                ) : isProcessing ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 size={36} className="animate-spin text-blue-400" />
                                        <span className="text-sm font-bold text-blue-200 animate-pulse uppercase tracking-wide">{statusText}</span>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-500 flex flex-col items-center">
                                        <FileText size={32} className="mb-1 opacity-20" />
                                        <span className="text-xs">{reuniaoSelecionada ? 'Pronto para iniciar' : 'Aguardando seleção'}</span>
                                    </div>
                                )}
                            </div>

                            {/* Botão Principal */}
                            {!isProcessing && (
                                <div className="relative group">
                                    <div className={`absolute inset-0 bg-red-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity ${isRecording ? 'animate-pulse' : ''} ${!reuniaoSelecionada ? 'hidden' : ''}`}></div>
                                    <button 
                                        onClick={isRecording ? stopRecording : startRecording} 
                                        disabled={!reuniaoSelecionada}
                                        className={`relative w-24 h-24 rounded-full flex items-center justify-center border-4 shadow-2xl transition-all active:scale-95 ${
                                            !reuniaoSelecionada 
                                            ? 'bg-slate-800 border-slate-700 text-slate-600 opacity-50 cursor-not-allowed'
                                            : isRecording 
                                                ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700' 
                                                : 'bg-gradient-to-br from-red-600 to-red-700 border-red-900 text-white hover:scale-105'
                                        }`}
                                    >
                                        {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={40} />}
                                    </button>
                                </div>
                            )}

                            <p className="mt-6 text-xs text-slate-500 font-medium uppercase tracking-wider">
                                {isRecording ? 'Clique para Encerrar e Gerar Ata' : 'Clique no Microfone para Iniciar'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

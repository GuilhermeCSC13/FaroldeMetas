import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { Mic, Square, Calendar, Loader2, Cpu, FileText, RefreshCw, CheckCircle } from 'lucide-react';
import { getGeminiFlash } from '../services/gemini';

const Copiloto = () => {
  const [reunioesHoje, setReunioesHoje] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState('');
  const [pautaExistente, setPautaExistente] = useState(null); // Cache local da ata
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [timer, setTimer] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchReunioesHoje();
  }, []);

  // Monitora a troca de reunião para ver se já tem ata salva (Cache)
  useEffect(() => {
    if (reuniaoSelecionada) {
      const reuniao = reunioesHoje.find(r => r.id === reuniaoSelecionada);
      if (reuniao && reuniao.pauta && reuniao.pauta.length > 10) {
        setPautaExistente(reuniao.pauta);
      } else {
        setPautaExistente(null);
      }
    }
  }, [reuniaoSelecionada, reunioesHoje]);

  const fetchReunioesHoje = async () => {
    const { data } = await supabase
      .from('reunioes')
      .select('*')
      .order('data_hora', { ascending: false })
      .limit(10);
    
    setReunioesHoje(data || []);
    // Seleciona a primeira automaticamente se houver
    if (data && data.length > 0 && !reuniaoSelecionada) {
        setReuniaoSelecionada(data[0].id);
    }
  };

  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("Selecione uma reunião.");

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
      alert("Erro microfone: " + err.message);
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
    setStatusText("Processando áudio...");
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `reuniao-${reuniaoSelecionada}-${Date.now()}.webm`;

    try {
      // 1. Upload Supabase (Backup do Áudio)
      const { error: uploadError } = await supabase.storage.from('gravacoes').upload(fileName, audioBlob);
      if (uploadError) console.error("Upload falhou, seguindo com transcrição...", uploadError);

      const { data: urlData } = supabase.storage.from('gravacoes').getPublicUrl(fileName);

      // 2. Transcrição IA
      setStatusText("IA Gerando Ata...");
      const model = getGeminiFlash();
      const audioPart = await blobToGenerativePart(audioBlob, "audio/webm");

      const prompt = `
        Atue como uma Secretária Executiva de Alta Performance.
        Analise o áudio e gere uma ATA DETALHADA e ESTRUTURADA.

        Use seu conhecimento neural para inferir o contexto mesmo se o áudio for confuso.
        
        FORMATO DE SAÍDA OBRIGATÓRIO:
        
        ## 📋 ATA DE REUNIÃO EXECUTIVA
        **Data:** ${new Date().toLocaleDateString()}
        
        ### 1. Contexto e Objetivo
        [Explique em 2 linhas o motivo da reunião baseado no que foi dito]

        ### 2. Principais Discussões
        * [Ponto 1 detalhado]
        * [Ponto 2 detalhado]
        
        ### 3. Decisões Definidas (Ouro)
        * ✅ [Decisão 1]
        * ✅ [Decisão 2]

        ### 4. Plano de Ação (Quem / O Que / Quando)
        * [Responsável] -> [Ação] (Prazo sugerido: [Data])
        
        ---
        *Obs: Se for apenas um teste de áudio, ignore o formato acima e responda apenas: "Teste de sistema realizado com sucesso."*
      `;

      const result = await model.generateContent([prompt, audioPart]);
      const textoGerado = result.response.text();

      // 3. Salvar no Banco
      const { error } = await supabase.from('reunioes').update({ 
          audio_url: urlData.publicUrl,
          pauta: textoGerado,
          status: 'Realizada'
      }).eq('id', reuniaoSelecionada);

      if (error) throw error;

      // 4. Atualiza a tela sem recarregar
      setPautaExistente(textoGerado);
      
      // Atualiza a lista local para o cache ficar sincronizado
      setReunioesHoje(prev => prev.map(r => r.id === reuniaoSelecionada ? {...r, pauta: textoGerado} : r));

      setStatusText("Concluído!");

    } catch (error) {
      alert("Erro: " + error.message);
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
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white font-sans relative overflow-hidden">
        
        {/* Fundo */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500 rounded-full blur-[100px]"></div>
        </div>

        <div className="z-10 w-full max-w-2xl p-8 flex flex-col items-center">
            
            {/* Header */}
            <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 mb-4">
                    <Cpu size={16} className="text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-200">Gemini 1.5 Flash</span>
                </div>
                <h1 className="text-3xl font-bold">Copiloto Tático</h1>
            </div>

            {/* Seletor */}
            <div className="w-full mb-8 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Reunião Selecionada</label>
                <select 
                    value={reuniaoSelecionada} 
                    onChange={(e) => setReuniaoSelecionada(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    disabled={isRecording || isProcessing}
                >
                    {reunioesHoje.map(r => (
                        <option key={r.id} value={r.id}>
                            {new Date(r.data_hora).toLocaleDateString()} - {r.titulo} {r.pauta ? '✅' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {/* --- LÓGICA DE EXIBIÇÃO: ATA PRONTA vs GRAVADOR --- */}
            
            {pautaExistente && !isRecording && !isProcessing ? (
                // MODO LEITURA (CACHE)
                <div className="w-full bg-white text-slate-800 rounded-xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-2 text-green-600 font-bold">
                            <CheckCircle size={20} />
                            <span>Ata Gerada</span>
                        </div>
                        <button 
                            onClick={() => {
                                if(window.confirm("Isso irá apagar a ata atual e gravar uma nova. Continuar?")) {
                                    setPautaExistente(null);
                                }
                            }}
                            className="text-xs flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors"
                        >
                            <RefreshCw size={12} /> Gerar Novamente
                        </button>
                    </div>
                    
                    <div className="prose prose-sm max-w-none text-slate-600 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {pautaExistente.split('\n').map((line, i) => (
                            <p key={i} className="mb-1">{line}</p>
                        ))}
                    </div>
                </div>
            ) : (
                // MODO GRAVAÇÃO
                <div className="flex flex-col items-center w-full">
                    <div className="mb-8 h-24 flex flex-col items-center justify-center relative w-full">
                        {isRecording ? (
                            <>
                                <div className="flex gap-1 items-end h-12">
                                    {[...Array(15)].map((_, i) => (
                                        <div key={i} className="w-2 bg-red-500 rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDuration: `${0.5 + Math.random()}s` }}></div>
                                    ))}
                                </div>
                                <div className="text-4xl font-mono text-white mt-4">{formatTime(timer)}</div>
                            </>
                        ) : isProcessing ? (
                            <div className="flex flex-col items-center gap-2 text-blue-300">
                                <Loader2 size={40} className="animate-spin text-blue-500" />
                                <span className="text-sm font-bold animate-pulse">{statusText}</span>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500">
                                <FileText size={48} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Nenhuma ata encontrada.</p>
                                <p className="text-xs">Grave para gerar o resumo.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center mt-4">
                        {!isRecording && !isProcessing && (
                            <button onClick={startRecording} disabled={!reuniaoSelecionada} className="w-20 h-20 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed group border-4 border-red-800">
                                <Mic size={32} className="group-hover:scale-110 transition-transform text-white" />
                            </button>
                        )}
                        {isRecording && (
                            <button onClick={stopRecording} className="w-20 h-20 bg-slate-200 hover:bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 border-4 border-slate-400 animate-pulse">
                                <Square size={24} fill="currentColor" />
                            </button>
                        )}
                    </div>
                    
                    {!isRecording && !isProcessing && (
                        <p className="mt-6 text-xs text-slate-500">Clique no microfone para iniciar a transcrição.</p>
                    )}
                </div>
            )}

        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { Mic, Square, Calendar, Loader2, Cpu, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenerativeAI } from "@google/generative-ai";

// ==========================================
// CONFIGURAÇÃO DA IA
// ==========================================
const API_KEY = "AIzaSyBHbALir0Cpj2yUIHacHOibi3iFIeqhVDs"; // <--- COLE SUA CHAVE DO AI STUDIO AQUI

const Copiloto = () => {
  const navigate = useNavigate();
  const [reunioesHoje, setReunioesHoje] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState('');
  
  // Estados
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState(""); // Para mostrar o passo a passo na tela
  const [timer, setTimer] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchReunioesHoje();
  }, []);

  const fetchReunioesHoje = async () => {
    const hoje = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('reunioes')
      .select('*')
      .gte('data_hora', `${hoje}T00:00:00`)
      .lte('data_hora', `${hoje}T23:59:59`)
      .order('data_hora');
    
    setReunioesHoje(data || []);
    if (data && data.length > 0) setReuniaoSelecionada(data[0].id);
  };

  // --- 1. GRAVAÇÃO OTIMIZADA ---
  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("Selecione uma reunião para vincular.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Usa codec Opus em baixo bitrate para o arquivo ficar leve (vital para envio via navegador)
      const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 16000 };
      
      if (MediaRecorder.isTypeSupported(options.mimeType)) {
        mediaRecorderRef.current = new MediaRecorder(stream, options);
      } else {
        mediaRecorderRef.current = new MediaRecorder(stream); // Fallback
      }

      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = processarAudioComIA;

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setTimer(0);
      intervalRef.current = setInterval(() => setTimer((p) => p + 1), 1000);
      
    } catch (err) {
      alert("Erro ao acessar microfone: " + err.message);
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

  // --- 2. FUNÇÃO AUXILIAR: CONVERTER BLOB PARA BASE64 ---
  // O Gemini precisa receber o áudio como uma string base64
  const blobToGenerativePart = async (blob, mimeType) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result.split(',')[1];
        resolve({
          inlineData: {
            data: base64data,
            mimeType
          },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // --- 3. PROCESSAMENTO REAL (SUPABASE + GEMINI) ---
  const processarAudioComIA = async () => {
    setIsProcessing(true);
    setStatusText("Preparando áudio...");
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `reuniao-${reuniaoSelecionada}-${Date.now()}.webm`;

    try {
      // A. Upload para Supabase Storage (Para você ouvir depois)
      setStatusText("Salvando áudio na nuvem...");
      const { error: uploadError } = await supabase.storage.from('gravacoes').upload(fileName, audioBlob);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('gravacoes').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // B. Enviar para IA (Gemini)
      setStatusText("A IA está ouvindo e transcrevendo...");
      
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Flash é mais rápido para áudio

      const audioPart = await blobToGenerativePart(audioBlob, "audio/webm");

      const prompt = `
        Você é um secretário executivo tático de uma empresa de transportes.
        Ouça o áudio desta reunião e gere uma ATA FORMAL.
        
        Estrutura obrigatória de resposta:
        
        DATA: ${new Date().toLocaleDateString()}
        DURAÇÃO: ${Math.floor(timer / 60)} min e ${timer % 60} seg
        
        RESUMO DOS TÓPICOS:
        - [Liste o que foi discutido de forma resumida]
        
        DECISÕES TOMADAS:
        - [Liste o que foi decidido]
        
        AÇÕES E PENDÊNCIAS (Importante):
        - [Ação] (Responsável sugerido: [Nome])
        
        Se o áudio estiver muito curto ou inaudível, avise.
      `;

      const result = await model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const textoGerado = response.text();

      setStatusText("Finalizando...");

      // C. Atualizar Banco de Dados
      const { error: updateError } = await supabase
        .from('reunioes')
        .update({ 
            audio_url: publicUrl,
            pauta: textoGerado, // Aqui entra a Ata gerada pela IA
            status: 'Realizada'
        })
        .eq('id', reuniaoSelecionada);

      if (updateError) throw updateError;

      alert("Sucesso! Ata gerada automaticamente.");
      navigate(`/reunioes/${reuniaoSelecionada}`);

    } catch (error) {
      console.error(error);
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
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white font-sans relative overflow-hidden">
        
        {/* Fundo Decorativo */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500 rounded-full blur-[100px]"></div>
        </div>

        <div className="z-10 w-full max-w-md p-8 text-center">
            
            {/* Header */}
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 mb-4">
                    <Cpu size={16} className="text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-200">Gemini 1.5 Flash</span>
                </div>
                <h1 className="text-4xl font-bold mb-2">Copiloto Tático</h1>
                <p className="text-slate-400">Grave a reunião. A IA gera a Ata e as Ações.</p>
            </div>

            {/* Seletor de Reunião */}
            <div className="mb-10 text-left bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Vincular à Reunião de Hoje</label>
                {reunioesHoje.length > 0 ? (
                    <select 
                        value={reuniaoSelecionada} 
                        onChange={(e) => setReuniaoSelecionada(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 text-white p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        disabled={isRecording || isProcessing}
                    >
                        {reunioesHoje.map(r => (
                            <option key={r.id} value={r.id}>
                                {new Date(r.data_hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {r.titulo}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div className="text-yellow-400 text-sm flex items-center gap-2 bg-yellow-400/10 p-2 rounded border border-yellow-400/20">
                        <Calendar size={16}/> Nenhuma reunião agendada para hoje.
                    </div>
                )}
            </div>

            {/* Visualizador de Status */}
            <div className="mb-8 h-24 flex flex-col items-center justify-center relative">
                {isRecording ? (
                    <>
                        <div className="flex gap-1 items-end h-12">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="w-2 bg-red-500 rounded-full animate-pulse" style={{ 
                                    height: `${Math.random() * 100}%`,
                                    animationDuration: `${0.5 + Math.random()}s` 
                                }}></div>
                            ))}
                        </div>
                        <div className="text-4xl font-mono text-white mt-4">
                            {formatTime(timer)}
                        </div>
                    </>
                ) : isProcessing ? (
                    <div className="flex flex-col items-center gap-2 text-blue-300">
                        <Loader2 size={40} className="animate-spin text-blue-500" />
                        <span className="text-sm font-bold animate-pulse">{statusText}</span>
                    </div>
                ) : (
                    <div className="text-6xl font-mono text-slate-700 tracking-widest opacity-50">
                        00:00
                    </div>
                )}
            </div>

            {/* Botões de Controle */}
            <div className="flex justify-center mt-4">
                {!isRecording && !isProcessing && (
                    <button 
                        onClick={startRecording}
                        disabled={!reuniaoSelecionada}
                        className="w-24 h-24 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.4)] transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed group border-4 border-red-800"
                        title="Iniciar Gravação"
                    >
                        <Mic size={40} className="group-hover:scale-110 transition-transform text-white" />
                    </button>
                )}

                {isRecording && (
                    <button 
                        onClick={stopRecording}
                        className="w-24 h-24 bg-slate-200 hover:bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 border-4 border-slate-400 animate-pulse"
                        title="Parar e Gerar Ata"
                    >
                        <Square size={32} fill="currentColor" />
                    </button>
                )}
            </div>

            <p className="mt-8 text-xs text-slate-500">
                {isRecording ? "Gravando áudio otimizado (16kbps)..." : "Pressione para iniciar. A IA fará o resto."}
            </p>

        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

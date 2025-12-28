import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { Mic, Square, Calendar, Loader2, Cpu, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getGeminiFlash } from '../services/gemini';

const Copiloto = () => {
  const navigate = useNavigate();
  const [reunioesHoje, setReunioesHoje] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState('');
  
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

  const fetchReunioesHoje = async () => {
    // Busca reuniões de hoje ou futuras próximas para teste
    const hoje = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('reunioes')
      .select('*')
      .order('data_hora', { ascending: false }) // Pega as mais recentes primeiro
      .limit(10);
    
    setReunioesHoje(data || []);
    if (data && data.length > 0) setReuniaoSelecionada(data[0].id);
  };

  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("Selecione uma reunião para vincular.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 16000 };
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
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
    setStatusText("Enviando áudio...");
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `reuniao-${reuniaoSelecionada}-${Date.now()}.webm`;

    try {
      // 1. Upload
      const { error: uploadError } = await supabase.storage.from('gravacoes').upload(fileName, audioBlob);
      if (uploadError) console.error("Erro upload:", uploadError); // Continua mesmo se der erro de upload, para tentar gerar a ata

      const { data: urlData } = supabase.storage.from('gravacoes').getPublicUrl(fileName);

      // 2. Transcrição IA
      setStatusText("Gerando Ata com IA...");
      const model = getGeminiFlash(); 
      const audioPart = await blobToGenerativePart(audioBlob, "audio/webm");

      const prompt = `
        Gere uma ATA DE REUNIÃO profissional com base neste áudio.
        
        FORMATO OBRIGATÓRIO:
        - Tópicos Discutidos: (Lista bullet points)
        - Decisões Tomadas: (O que ficou decidido)
        - Próximos Passos: (Ações futuras)
        
        Se o áudio for apenas um teste, diga: "Gravação de teste realizada com sucesso."
      `;

      const result = await model.generateContent([prompt, audioPart]);
      const textoGerado = result.response.text();

      setStatusText("Salvando...");

      // 3. Atualizar Banco - FORÇANDO ATUALIZAÇÃO
      const { error: updateError } = await supabase
        .from('reunioes')
        .update({ 
            audio_url: urlData.publicUrl,
            pauta: textoGerado, // <--- Aqui entra o texto da IA
            status: 'Realizada'
        })
        .eq('id', reuniaoSelecionada);

      if (updateError) throw updateError;

      alert("Ata gerada e salva com sucesso!");
      navigate(`/reunioes/${reuniaoSelecionada}`);

    } catch (error) {
      console.error(error);
      alert("Erro ao processar: " + error.message);
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
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500 rounded-full blur-[100px]"></div>
        </div>

        <div className="z-10 w-full max-w-md p-8 text-center">
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 mb-4">
                    <Cpu size={16} className="text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-200">Gemini 1.5 Flash</span>
                </div>
                <h1 className="text-4xl font-bold mb-2">Copiloto Tático</h1>
                <p className="text-slate-400">Grave a reunião. A IA gera a Ata e as Ações.</p>
            </div>

            <div className="mb-10 text-left bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Selecione a Reunião</label>
                <select 
                    value={reuniaoSelecionada} 
                    onChange={(e) => setReuniaoSelecionada(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    disabled={isRecording || isProcessing}
                >
                    {reunioesHoje.map(r => (
                        <option key={r.id} value={r.id}>
                            {new Date(r.data_hora).toLocaleDateString()} - {r.titulo} ({r.status})
                        </option>
                    ))}
                </select>
            </div>

            <div className="mb-8 h-24 flex flex-col items-center justify-center relative">
                {isRecording ? (
                    <>
                        <div className="flex gap-1 items-end h-12">
                            {[...Array(10)].map((_, i) => (
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
                    <div className="text-6xl font-mono text-slate-700 tracking-widest opacity-50">00:00</div>
                )}
            </div>

            <div className="flex justify-center mt-4">
                {!isRecording && !isProcessing && (
                    <button onClick={startRecording} disabled={!reuniaoSelecionada} className="w-24 h-24 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.4)] transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed group border-4 border-red-800">
                        <Mic size={40} className="group-hover:scale-110 transition-transform text-white" />
                    </button>
                )}
                {isRecording && (
                    <button onClick={stopRecording} className="w-24 h-24 bg-slate-200 hover:bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 border-4 border-slate-400 animate-pulse">
                        <Square size={32} fill="currentColor" />
                    </button>
                )}
            </div>
        </div>
      </div>
    </Layout>
  );
};
export default Copiloto;

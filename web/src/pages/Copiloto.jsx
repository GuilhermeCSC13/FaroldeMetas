import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { Mic, Square, Play, Calendar, CheckCircle, Loader2, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Copiloto = () => {
  const navigate = useNavigate();
  const [reunioesHoje, setReunioesHoje] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState('');
  
  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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

  // --- LÓGICA DE GRAVAÇÃO ---
  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("Selecione uma reunião para vincular a gravação.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = handleUploadAndProcess;

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Iniciar Timer
      setTimer(0);
      intervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      alert("Erro ao acessar microfone: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(intervalRef.current);
    }
  };

  // --- PROCESSAMENTO (SIMULAÇÃO IA) ---
  const handleUploadAndProcess = async () => {
    setIsProcessing(true);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `reuniao-${reuniaoSelecionada}-${Date.now()}.webm`;

    try {
      // 1. Upload do Áudio
      const { error: uploadError } = await supabase.storage.from('gravacoes').upload(fileName, audioBlob);
      if (uploadError) throw uploadError;

      // 2. SIMULAÇÃO DA IA (Aqui entraria a chamada para OpenAI Whisper + GPT-4)
      // Vamos simular um delay de processamento e gerar um texto fake
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos de "pensando"

      const resumoIA = `RESUMO GERADO PELA IA (COPILOTO):
- A reunião iniciou pontualmente.
- Discutido o aumento do consumo de diesel na frota pesada.
- Ação definida: Treinamento de direção econômica para 5 motoristas.
- Ponto de atenção: Manutenção preventiva dos veículos placa XYZ.
- Próxima reunião agendada para revisar os números.`;

      // 3. Salvar na Pauta da Reunião
      const { error: updateError } = await supabase
        .from('reunioes')
        .update({ 
            pauta: resumoIA, 
            status: 'Realizada' // Já marca como realizada
        })
        .eq('id', reuniaoSelecionada);

      if (updateError) throw updateError;

      alert("Reunião processada e resumo gerado com sucesso!");
      navigate(`/reunioes/${reuniaoSelecionada}`); // Vai para a tela de detalhes ver o resultado

    } catch (error) {
      console.error(error);
      alert("Erro ao processar áudio.");
    } finally {
      setIsProcessing(false);
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
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-200">IA Ativa</span>
                </div>
                <h1 className="text-4xl font-bold mb-2">Copiloto Tático</h1>
                <p className="text-slate-400">Grave sua reunião e deixe a IA gerar a ata.</p>
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
                    <div className="text-yellow-400 text-sm flex items-center gap-2">
                        <Calendar size={16}/> Nenhuma reunião agendada para hoje.
                    </div>
                )}
            </div>

            {/* Visualizador de Status */}
            <div className="mb-8 h-20 flex items-center justify-center">
                {isRecording ? (
                    <div className="flex gap-1 items-end h-12">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="w-2 bg-red-500 rounded-full animate-pulse" style={{ 
                                height: `${Math.random() * 100}%`,
                                animationDuration: `${0.5 + Math.random()}s` 
                            }}></div>
                        ))}
                    </div>
                ) : isProcessing ? (
                    <div className="flex flex-col items-center gap-2 text-blue-300">
                        <Loader2 size={32} className="animate-spin" />
                        <span className="text-sm font-mono animate-pulse">Transcrevendo e Resumindo...</span>
                    </div>
                ) : (
                    <div className="text-6xl font-mono text-slate-700 tracking-widest opacity-50">
                        00:00
                    </div>
                )}
                {isRecording && <div className="text-4xl font-mono text-white absolute mt-24">{formatTime(timer)}</div>}
            </div>

            {/* Botão Principal */}
            <div className="flex justify-center">
                {!isRecording && !isProcessing && (
                    <button 
                        onClick={startRecording}
                        disabled={!reuniaoSelecionada}
                        className="w-24 h-24 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.4)] transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed group"
                    >
                        <Mic size={40} className="group-hover:scale-110 transition-transform" />
                    </button>
                )}

                {isRecording && (
                    <button 
                        onClick={stopRecording}
                        className="w-24 h-24 bg-slate-200 hover:bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95"
                    >
                        <Square size={32} fill="currentColor" />
                    </button>
                )}
            </div>

            <p className="mt-8 text-xs text-slate-500">
                {isRecording ? "Gravando áudio da sala..." : "Pressione para iniciar a escuta ativa"}
            </p>

        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

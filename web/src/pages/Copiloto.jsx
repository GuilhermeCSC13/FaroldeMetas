import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { Mic, Square, Calendar, Loader2, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Copiloto = () => {
  const navigate = useNavigate();
  const [reunioesHoje, setReunioesHoje] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState('');
  
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
    // Busca reuniões de hoje (ou teste)
    const { data } = await supabase
      .from('reunioes')
      .select('*')
      .gte('data_hora', `${hoje}T00:00:00`)
      .lte('data_hora', `${hoje}T23:59:59`)
      .order('data_hora');
    
    setReunioesHoje(data || []);
    if (data && data.length > 0) setReuniaoSelecionada(data[0].id);
  };

  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("Selecione uma reunião.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = handleUploadAndProcess;
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTimer(0);
      intervalRef.current = setInterval(() => setTimer((p) => p + 1), 1000);
    } catch (err) {
      alert("Erro no microfone: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(intervalRef.current);
    }
  };

  const handleUploadAndProcess = async () => {
    setIsProcessing(true);
    // Cria o arquivo de áudio
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `reuniao-${reuniaoSelecionada}-${Date.now()}.webm`;

    try {
      // 1. Upload para o Storage
      const { error: uploadError } = await supabase.storage.from('gravacoes').upload(fileName, audioBlob);
      if (uploadError) throw uploadError;

      // 2. Pegar a URL Pública (Link para ouvir depois)
      const { data: urlData } = supabase.storage.from('gravacoes').getPublicUrl(fileName);
      const audioUrl = urlData.publicUrl;

      // 3. Simulação da IA (Resumo)
      await new Promise(resolve => setTimeout(resolve, 2000));
      const resumoIA = `RESUMO AUTOMÁTICO IA:
- Gravação realizada com sucesso.
- Duração: ${formatTime(timer)}.
- Pontos discutidos: [Aguardando processamento detalhado]
- Ações sugeridas: Revisar os KPIs da semana.`;

      // 4. Atualizar a Reunião no Banco (Salva o Link do Áudio!)
      const { error: updateError } = await supabase
        .from('reunioes')
        .update({ 
            audio_url: audioUrl, // <--- AQUI SALVA O AUDIO
            pauta: resumoIA,
            status: 'Realizada'
        })
        .eq('id', reuniaoSelecionada);

      if (updateError) throw updateError;

      alert("Reunião salva! Redirecionando para a Ata...");
      navigate(`/reunioes/${reuniaoSelecionada}`);

    } catch (error) {
      console.error(error);
      alert("Erro ao salvar gravação.");
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
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500 rounded-full blur-[100px]"></div>
        </div>

        <div className="z-10 w-full max-w-md p-8 text-center">
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 mb-4">
                    <Cpu size={16} className="text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-200">IA Ativa</span>
                </div>
                <h1 className="text-4xl font-bold mb-2">Copiloto Tático</h1>
                <p className="text-slate-400">Grave a reunião para gerar a Ata automática.</p>
            </div>

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

            <div className="mb-8 h-20 flex items-center justify-center">
                {isRecording ? (
                    <div className="flex gap-1 items-end h-12">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="w-2 bg-red-500 rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDuration: `${0.5 + Math.random()}s` }}></div>
                        ))}
                    </div>
                ) : isProcessing ? (
                    <div className="flex flex-col items-center gap-2 text-blue-300">
                        <Loader2 size={32} className="animate-spin" />
                        <span className="text-sm font-mono animate-pulse">Enviando áudio e processando...</span>
                    </div>
                ) : (
                    <div className="text-6xl font-mono text-slate-700 tracking-widest opacity-50">00:00</div>
                )}
                {isRecording && <div className="text-4xl font-mono text-white absolute mt-24">{formatTime(timer)}</div>}
            </div>

            <div className="flex justify-center">
                {!isRecording && !isProcessing && (
                    <button onClick={startRecording} disabled={!reuniaoSelecionada} className="w-24 h-24 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.4)] transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed group">
                        <Mic size={40} className="group-hover:scale-110 transition-transform" />
                    </button>
                )}
                {isRecording && (
                    <button onClick={stopRecording} className="w-24 h-24 bg-slate-200 hover:bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95">
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

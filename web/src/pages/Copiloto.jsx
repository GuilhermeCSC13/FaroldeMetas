import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  Mic, Square, Loader2, Cpu, CheckCircle, Search, Calendar, Clock, 
  ExternalLink, Plus, User, Camera, Image as ImageIcon, X, Monitor 
} from 'lucide-react';
import { getGeminiFlash } from '../services/gemini';

const Copiloto = () => {
  // Estados de Interface
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [listaReunioes, setListaReunioes] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timer, setTimer] = useState(0);

  // Refs de Gravação (Robustez)
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    fetchReunioesPorData();
    return () => stopAllTracks();
  }, [dataFiltro]);

  const stopAllTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    clearInterval(timerIntervalRef.current);
  };

  const fetchReunioesPorData = async () => {
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('reunioes')
        .select('*')
        .gte('data_hora', `${dataFiltro}T00:00:00`)
        .lte('data_hora', `${dataFiltro}T23:59:59`)
        .order('data_hora', { ascending: true });
      if (error) throw error;
      setListaReunioes(data || []);
    } catch (e) { console.error(e); } finally { setLoadingList(false); }
  };

  // --- LÓGICA DE GRAVAÇÃO ROBUSTA ---
  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("Selecione uma reunião.");

    try {
      // 1. Captura Tela + Áudio do Sistema
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 20, width: 1280, height: 720 },
        audio: true 
      });

      // 2. Captura Microfone
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 3. Mixagem de Áudio (Sistema + Mic)
      const audioCtx = new AudioContext();
      const sourceScreen = audioCtx.createMediaStreamSource(screenStream);
      const sourceMic = audioCtx.createMediaStreamSource(micStream);
      const destination = audioCtx.createMediaStreamDestination();
      
      sourceScreen.connect(destination);
      sourceMic.connect(destination);

      // 4. Stream Final (Vídeo da Tela + Áudio Mixado)
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      streamRef.current = combinedStream;
      chunksRef.current = [];

      // 5. Configuração do Recorder (Pedaços de 5 segundos para segurança)
      mediaRecorderRef.current = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          // DICA: Para 2 horas, aqui deveríamos salvar no IndexedDB
          console.log("Chunk de segurança armazenado.");
        }
      };

      mediaRecorderRef.current.onstop = processarGravacao;

      // Inicia gravando e gerando chunks a cada 5s
      mediaRecorderRef.current.start(5000);
      setIsRecording(true);
      setTimer(0);
      timerIntervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);

      // Atualiza status no banco
      await supabase.from('reunioes').update({ status: 'Em Andamento' }).eq('id', reuniaoSelecionada.id);

    } catch (err) {
      alert("Erro ao iniciar: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      stopAllTracks();
      setIsRecording(false);
    }
  };

  const processarGravacao = async () => {
    setIsProcessing(true);
    const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
    const fileName = `reuniao-${reuniaoSelecionada.id}-${Date.now()}.webm`;

    try {
      // 1. Upload para o Supabase (Temporário enquanto não configuramos o Drive)
      const { data: upData } = await supabase.storage.from('gravacoes').upload(fileName, videoBlob);
      const { data: urlData } = supabase.storage.from('gravacoes').getPublicUrl(fileName);

      // 2. Extração de Ata com Gemini (Usando apenas áudio para a IA não pesar)
      const model = getGeminiFlash();
      const prompt = `Analise esta reunião "${reuniaoSelecionada.titulo}". Gere uma ata em Markdown com: # RESUMO, ## DECISÕES e ## AÇÕES.`;
      
      // Converter para Base64 para a API
      const reader = new FileReader();
      reader.readAsDataURL(videoBlob);
      reader.onloadend = async () => {
        const base64data = reader.result.split(',')[1];
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64data, mimeType: "video/webm" } }
        ]);

        const textoAta = result.response.text();

        // 3. Salva Resultado Final
        await supabase.from('reunioes').update({
          video_url: urlData.publicUrl,
          pauta: textoAta,
          status: 'Realizada',
          duracao_segundos: timer
        }).eq('id', reuniaoSelecionada.id);

        setReuniaoSelecionada(prev => ({ ...prev, pauta: textoAta, status: 'Realizada' }));
        fetchReunioesPorData();
        setIsProcessing(false);
      };

    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <Layout>
      <div className="h-screen bg-slate-900 text-white flex overflow-hidden">
        {/* Coluna Esquerda: Lista */}
        <div className="w-1/2 border-r border-slate-800 p-6 flex flex-col">
          <header className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold flex items-center gap-2"><Cpu className="text-blue-400"/> Copiloto</h1>
            <input type="date" className="bg-slate-800 text-xs p-2 rounded" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
          </header>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {listaReunioes.map(r => (
              <div 
                key={r.id} 
                onClick={() => !isRecording && setReuniaoSelecionada(r)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${reuniaoSelecionada?.id === r.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'}`}
              >
                <div className="flex justify-between">
                  <span className="text-sm font-bold">{r.titulo}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === 'Realizada' ? 'bg-green-900 text-green-300' : 'bg-slate-700'}`}>
                    {r.status || 'Pendente'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Controle de Gravação */}
          <div className="mt-6 p-6 bg-slate-800 rounded-2xl border border-slate-700 text-center">
            {isRecording ? (
              <div className="flex flex-col items-center gap-4">
                <span className="text-3xl font-mono text-red-500 animate-pulse">{formatTime(timer)}</span>
                <button onClick={stopRecording} className="bg-white text-red-600 p-4 rounded-full hover:scale-110 transition-transform">
                  <Square fill="currentColor" />
                </button>
                <span className="text-xs text-slate-400">Gravando Tela + Sistema + Mic</span>
              </div>
            ) : (
              <button 
                onClick={startRecording} 
                disabled={!reuniaoSelecionada || isProcessing}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-30 p-5 rounded-full shadow-lg shadow-red-900/40"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Monitor size={28} />}
              </button>
            )}
            {!isRecording && <p className="text-xs mt-3 text-slate-400">{reuniaoSelecionada ? `Pronto para gravar: ${reuniaoSelecionada.titulo}` : 'Selecione uma reunião'}</p>}
          </div>
        </div>

        {/* Coluna Direita: Resultados */}
        <div className="w-1/2 p-8 overflow-y-auto">
          {reuniaoSelecionada?.pauta ? (
            <div className="prose prose-invert max-w-none">
              <h2 className="text-blue-400">Ata Gerada</h2>
              <div className="whitespace-pre-line text-slate-300 text-sm leading-relaxed">
                {reuniaoSelecionada.pauta}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <Mic size={48} className="mb-4 opacity-20" />
              <p>Aguardando gravação para gerar a ata...</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

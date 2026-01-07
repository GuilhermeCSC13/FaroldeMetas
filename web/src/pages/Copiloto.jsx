import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { Square, Cpu, Monitor, Loader2, AlertCircle } from 'lucide-react';

// VARIÁVEIS GLOBAIS - Proteção total contra re-render do React
let globalRecorder = null;
let globalChunks = [];
let globalStream = null;
let globalStartTime = null;

const Copiloto = () => {
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [listaReunioes, setListaReunioes] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timer, setTimer] = useState(0);

  const timerIntervalRef = useRef(null);

  useEffect(() => {
    fetchReunioesPorData();
    // Recuperação de desastre: se o globalRecorder existe, sincroniza o estado
    if (globalRecorder && globalRecorder.state === 'recording') {
      setIsRecording(true);
      iniciarTimerVisual();
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [dataFiltro]);

  const fetchReunioesPorData = async () => {
    const { data } = await supabase.from('reunioes')
      .select('*')
      .gte('data_hora', `${dataFiltro}T00:00:00`)
      .lte('data_hora', `${dataFiltro}T23:59:59`);
    setListaReunioes(data || []);
  };

  const iniciarTimerVisual = () => {
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      if (globalStartTime) {
        setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
      }
    }, 1000);
  };

  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("Selecione uma reunião.");
    
    try {
      // 1. Captura com tratamento de erro específico
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { frameRate: 20 }, 
        audio: true 
      });
      
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. Mixagem Robusta
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      
      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(dest);

      if (screenStream.getAudioTracks().length > 0) {
        const screenAudioSource = audioCtx.createMediaStreamSource(screenStream);
        screenAudioSource.connect(dest);
      }

      const finalStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      // 3. Configuração do Gravador
      const recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm;codecs=vp8,opus' });
      
      globalChunks = [];
      globalStream = finalStream;
      globalRecorder = recorder;
      globalStartTime = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          globalChunks.push(e.data);
        }
      };

      recorder.onstop = () => salvarGravacaoNoBanco();

      // Inicia gravando em fatias de 5s (Proteção contra perda)
      recorder.start(5000); 

      setIsRecording(true);
      iniciarTimerVisual();
      
      await supabase.from('reunioes').update({ status: 'Em Andamento' }).eq('id', reuniaoSelecionada.id);

    } catch (err) {
      console.error("Falha no Start:", err);
      alert("Erro ao iniciar: Verifique se você permitiu TELA e MICROFONE.");
    }
  };

  const stopRecording = () => {
    console.log("Comando STOP disparado");
    
    // 1. Para o gravador (dispara o onstop)
    if (globalRecorder && globalRecorder.state !== 'inactive') {
      globalRecorder.stop();
    }

    // 2. Mata todos os tracks (Isso remove o ícone de gravação do navegador)
    if (globalStream) {
      globalStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    }

    // 3. Limpa estados visuais
    setIsRecording(false);
    clearInterval(timerIntervalRef.current);
    globalRecorder = null;
    globalStream = null;
  };

  const salvarGravacaoNoBanco = async () => {
    setIsProcessing(true);
    console.log("Salvando dados finais...");

    try {
      const finalBlob = new Blob(globalChunks, { type: 'video/webm' });
      const duracaoFinal = timer;

      // Atualiza Supabase
      const { error } = await supabase.from('reunioes')
        .update({ 
          status: 'Realizada', 
          duracao_segundos: duracaoFinal,
          horario_fim: new Date().toISOString()
        })
        .eq('id', reuniaoSelecionada.id);

      if (error) throw error;

      alert("Reunião finalizada e salva com sucesso!");
      fetchReunioesPorData();
    } catch (err) {
      console.error("Erro ao salvar no banco:", err);
      alert("A gravação parou, mas houve erro ao atualizar o banco. O vídeo ainda está na memória.");
    } finally {
      setIsProcessing(false);
      globalChunks = [];
      globalStartTime = null;
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  return (
    <Layout>
      <div className="h-screen bg-[#0f172a] text-white flex overflow-hidden font-sans">
        <div className="w-full flex flex-col p-8 max-w-5xl mx-auto">
          
          <header className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
                <Cpu className="text-blue-500 w-10 h-10" /> COPILOTO <span className="text-blue-500">TÁTICO</span>
              </h1>
              <p className="text-slate-400 text-sm mt-1">Gerenciamento de Reuniões com Robustez de Dados</p>
            </div>
            <div className="flex gap-4">
              <input type="date" className="bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 ring-blue-500 outline-none" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
            </div>
          </header>

          <div className="grid grid-cols-12 gap-8 flex-1 overflow-hidden">
            {/* LISTA */}
            <div className="col-span-7 flex flex-col gap-4 overflow-hidden">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-y-auto flex-1 custom-scrollbar">
                {listaReunioes.length > 0 ? listaReunioes.map(r => (
                  <div key={r.id} onClick={() => !isRecording && setReuniaoSelecionada(r)} className={`p-5 border-b border-slate-800 cursor-pointer transition-all ${reuniaoSelecionada?.id === r.id ? 'bg-blue-600/10 border-l-4 border-l-blue-500' : 'hover:bg-slate-800/50'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-200">{r.titulo}</h3>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-2"> <Clock size={12}/> {new Date(r.data_hora).toLocaleTimeString()}</p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-md ${r.status === 'Realizada' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
                        {r.status || 'PENDENTE'}
                      </span>
                    </div>
                  </div>
                )) : <div className="p-10 text-center text-slate-600">Nenhuma reunião para esta data</div>}
              </div>

              {/* CONTROLES */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isRecording ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                    {isRecording ? <div className="w-4 h-4 bg-red-500 rounded-full animate-ping"/> : <Monitor size={32}/>}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{isRecording ? "Gravando agora" : "Aguardando"}</p>
                    <p className="text-xl font-mono font-bold">{isRecording ? formatTime(timer) : "00:00"}</p>
                  </div>
                </div>

                {isProcessing ? (
                  <div className="flex items-center gap-3 text-blue-400 font-bold animate-pulse">
                    <Loader2 className="animate-spin" /> SALVANDO...
                  </div>
                ) : isRecording ? (
                  <button onClick={stopRecording} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black hover:bg-red-50 transition-all flex items-center gap-2">
                    <Square size={20} fill="currentColor"/> ENCERRAR
                  </button>
                ) : (
                  <button onClick={startRecording} disabled={!reuniaoSelecionada} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-blue-500 disabled:opacity-20 transition-all shadow-lg shadow-blue-900/40">
                    INICIAR GRAVAÇÃO
                  </button>
                )}
              </div>
            </div>

            {/* PAINEL LATERAL */}
            <div className="col-span-5 flex flex-col gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex-1">
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Informações</h2>
                {reuniaoSelecionada ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                      <p className="text-xs text-slate-500 font-bold">REUNIÃO SELECIONADA</p>
                      <p className="text-lg font-bold text-blue-400">{reuniaoSelecionada.titulo}</p>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                      <AlertCircle className="text-amber-500 shrink-0" size={18}/>
                      <p className="text-[11px] text-amber-200/70 leading-relaxed">
                        Certifique-se de marcar <b>"Compartilhar áudio do sistema"</b> na janela de seleção para capturar os outros participantes.
                      </p>
                    </div>
                  </div>
                ) : <p className="text-slate-600 text-sm italic">Selecione uma reunião na lista ao lado para começar.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

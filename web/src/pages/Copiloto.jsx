import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  Square, Cpu, Monitor, Loader2
} from 'lucide-react';

let globalRecorder = null;
let globalChunks = [];
let globalReuniao = null;
let globalStartTime = null;

const Copiloto = () => {
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [listaReunioes, setListaReunioes] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timer, setTimer] = useState(0);
  const [acoesCriadasAgora, setAcoesCriadasAgora] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: '', responsavel: '' });

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    fetchReunioesPorData();
    // Recupera estado se o recorder global estiver ativo
    if (globalRecorder?.state === 'recording') {
      setIsRecording(true);
      setReuniaoSelecionada(globalReuniao);
      setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
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
    timerIntervalRef.current = setInterval(() => {
      setTimer(Math.floor((Date.now() - (globalStartTime || Date.now())) / 1000));
    }, 1000);
  };

  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("Selecione uma reunião.");
    
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      
      // Conecta microfone
      audioCtx.createMediaStreamSource(micStream).connect(dest);

      // CORREÇÃO DO ERRO: Só conecta áudio da tela se ele existir
      if (screenStream.getAudioTracks().length > 0) {
        audioCtx.createMediaStreamSource(screenStream).connect(dest);
      }

      const finalStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      streamRef.current = finalStream;
      const recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm' });
      
      globalChunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) globalChunks.push(e.data); };
      
      // Quando parar, executa o salvamento
      recorder.onstop = salvarDadosReuniao;
      
      recorder.start(5000); 
      globalRecorder = recorder;
      globalReuniao = reuniaoSelecionada;
      globalStartTime = Date.now();

      setIsRecording(true);
      iniciarTimerVisual();

      await supabase.from('reunioes').update({ status: 'Em Andamento' }).eq('id', reuniaoSelecionada.id);
    } catch (err) {
      alert("Erro ao iniciar: Certifique-se de compartilhar o ÁUDIO na janela de seleção da tela.");
    }
  };

  const stopRecording = () => {
    if (globalRecorder) {
      globalRecorder.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
    clearInterval(timerIntervalRef.current);
  };

  const salvarDadosReuniao = async () => {
    setIsProcessing(true);
    try {
      // 1. Atualiza status para Finalizado
      await supabase.from('reunioes')
        .update({ status: 'Finalizada', duracao: timer })
        .eq('id', globalReuniao.id);

      // 2. Aqui entraria o upload para o Drive/Storage se necessário
      console.log("Reunião salva com sucesso.");
      
      // Limpa globais
      globalRecorder = null;
      globalReuniao = null;
      globalStartTime = null;
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setIsProcessing(false);
      fetchReunioesPorData();
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  return (
    <Layout>
      <div className="h-screen bg-[#0f172a] text-white flex overflow-hidden">
        {/* COLUNA ESQUERDA */}
        <div className="w-8/12 flex flex-col p-6 border-r border-slate-800">
          <header className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu className="text-blue-500" /> Copiloto Tático</h1>
            <input type="date" className="bg-slate-800 border-none rounded-lg p-2 text-sm" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
          </header>

          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl overflow-y-auto mb-6">
            {listaReunioes.map(r => (
              <div key={r.id} onClick={() => setReuniaoSelecionada(r)} className={`p-4 border-b border-slate-800 cursor-pointer transition ${reuniaoSelecionada?.id === r.id ? 'bg-blue-600/20 border-l-4 border-l-blue-500' : 'hover:bg-slate-800'}`}>
                <div className="flex justify-between">
                  <span className="font-semibold">{r.titulo}</span>
                  <span className="text-[10px] uppercase bg-slate-700 px-2 py-1 rounded">{r.status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="h-32 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
            {isProcessing ? (
              <div className="flex items-center gap-3 text-blue-400"><Loader2 className="animate-spin" /> Processando e Salvando...</div>
            ) : isRecording ? (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-3xl font-mono">{formatTime(timer)}</span>
                </div>
                <button onClick={stopRecording} className="bg-white text-red-600 p-4 rounded-full hover:scale-105 transition"><Square size={24} fill="currentColor" /></button>
              </div>
            ) : (
              <button onClick={startRecording} disabled={!reuniaoSelecionada} className="bg-red-600 p-5 rounded-full hover:bg-red-700 disabled:opacity-30 transition"><Monitor size={28} /></button>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="w-4/12 p-6 flex flex-col bg-[#0f172a]">
          <h2 className="text-slate-500 text-xs font-bold uppercase mb-4 tracking-widest">Ações da Reunião</h2>
          <div className="flex-1 space-y-3 overflow-y-auto">
             {/* Lista de ações recuperadas do Supabase */}
          </div>
          
          <div className="mt-6 pt-6 border-t border-slate-800">
             <textarea className="w-full bg-slate-800 border-none rounded-xl p-3 text-sm h-24 mb-3" placeholder="Anotar ação rápida..."></textarea>
             <button className="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-700 transition">Adicionar Ação</button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

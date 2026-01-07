import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  Mic, Square, Loader2, Cpu, CheckCircle, Search, Calendar, Clock, ExternalLink, 
  Plus, User, AlertTriangle, Camera, Image as ImageIcon, X, Monitor
} from 'lucide-react';
import { getGeminiFlash } from '../services/gemini';
import { useNavigate } from 'react-router-dom';

// VARIÁVEIS GLOBAIS - Persistência contra refresh/navegação
let globalRecorder = null;
let globalChunks = [];
let globalReuniao = null;
let globalStartTime = null;

const Copiloto = () => {
  const navigate = useNavigate();
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [listaReunioes, setListaReunioes] = useState([]);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState(null);
  const [buscaTexto, setBuscaTexto] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [acoesCriadasAgora, setAcoesCriadasAgora] = useState([]);
  const [acoesAnteriores, setAcoesAnteriores] = useState([]);
  const [loadingAcoes, setLoadingAcoes] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [timer, setTimer] = useState(0);
  const [pautaExistente, setPautaExistente] = useState(null);
  const [novaAcao, setNovaAcao] = useState({ descricao: '', responsavel: '', vencimento: '' });

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    if (globalRecorder && globalRecorder.state === 'recording') {
      mediaRecorderRef.current = globalRecorder;
      setIsRecording(true);
      setReuniaoSelecionada(globalReuniao);
      if (globalStartTime) {
        setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
        timerIntervalRef.current = setInterval(() => {
          setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
        }, 1000);
      }
    }
    fetchReunioesPorData();
    return () => clearInterval(timerIntervalRef.current);
  }, []);

  useEffect(() => {
    if (reuniaoSelecionada) {
      setPautaExistente(reuniaoSelecionada.pauta || null);
      fetchAcoes(reuniaoSelecionada);
    }
  }, [reuniaoSelecionada]);

  const fetchReunioesPorData = async () => {
    setLoadingList(true);
    try {
      const { data } = await supabase.from('reunioes').select('*')
        .gte('data_hora', `${dataFiltro}T00:00:00`).lte('data_hora', `${dataFiltro}T23:59:59`)
        .order('data_hora', { ascending: true });
      setListaReunioes(data || []);
    } finally { setLoadingList(false); }
  };

  const fetchAcoes = async (reuniao) => {
    setLoadingAcoes(true);
    const { data } = await supabase.from('acoes').select('*').eq('reuniao_id', reuniao.id);
    setAcoesCriadasAgora(data || []);
    setLoadingAcoes(false);
  };

  const startRecording = async () => {
    if (!reuniaoSelecionada) return alert("Selecione uma reunião.");
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      
      const sourceMic = audioCtx.createMediaStreamSource(micStream);
      sourceMic.connect(dest);

      if (screenStream.getAudioTracks().length > 0) {
        const sourceScreen = audioCtx.createMediaStreamSource(screenStream);
        sourceScreen.connect(dest);
      }

      const finalStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      streamRef.current = finalStream;
      mediaRecorderRef.current = new MediaRecorder(finalStream, { mimeType: 'video/webm' });
      
      globalChunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) globalChunks.push(e.data); };
      mediaRecorderRef.current.onstop = processarComIA;
      mediaRecorderRef.current.start(5000); // Chunks de 5s para segurança

      globalRecorder = mediaRecorderRef.current;
      globalReuniao = reuniaoSelecionada;
      globalStartTime = Date.now();
      setIsRecording(true);
      
      timerIntervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
      await supabase.from('reunioes').update({ status: 'Em Andamento' }).eq('id', reuniaoSelecionada.id);
    } catch (e) { alert("Erro: Verifique permissões de áudio/tela."); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsRecording(false);
    clearInterval(timerIntervalRef.current);
    globalRecorder = null;
  };

  const processarComIA = async () => {
    setIsProcessing(true);
    setStatusText("Analisando gravação...");
    const videoBlob = new Blob(globalChunks, { type: 'video/webm' });
    
    // Simulação de processamento (Integração Gemini Flash)
    setTimeout(() => {
      setIsProcessing(false);
      setStatusText("Finalizado!");
    }, 3000);
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  return (
    <Layout>
      <div className="h-screen bg-slate-900 text-white flex overflow-hidden">
        {/* ESQUERDA: LISTA */}
        <div className="w-7/12 flex flex-col p-6 border-r border-slate-800">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-6"><Cpu className="text-blue-400" /> Copiloto Tático</h1>
          
          <div className="flex gap-2 mb-4">
            <input type="date" className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
            <input type="text" placeholder="Filtrar..." className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm flex-1" value={buscaTexto} onChange={e => setBuscaTexto(e.target.value)} />
          </div>

          <div className="flex-1 bg-slate-800/30 border border-slate-700 rounded-xl overflow-y-auto mb-6">
            {listaReunioes.map(r => (
              <div key={r.id} onClick={() => setReuniaoSelecionada(r)} className={`p-4 border-b border-slate-700 cursor-pointer ${reuniaoSelecionada?.id === r.id ? 'bg-blue-600/20' : 'hover:bg-slate-800'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">{r.titulo}</span>
                  <span className="text-[10px] px-2 py-1 bg-slate-700 rounded">{r.status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="h-32 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center relative">
            {isRecording ? (
              <div className="flex items-center gap-4">
                <span className="text-3xl font-mono">{formatTime(timer)}</span>
                <button onClick={stopRecording} className="w-12 h-12 bg-white text-red-600 rounded-full flex items-center justify-center"><Square size={20} fill="currentColor"/></button>
              </div>
            ) : (
              <button onClick={startRecording} disabled={!reuniaoSelecionada} className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center disabled:opacity-50"><Monitor size={24}/></button>
            )}
          </div>
        </div>

        {/* DIREITA: AÇÕES */}
        <div className="w-5/12 bg-slate-900 flex flex-col border-l border-slate-800 p-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase mb-4">Nova Ação</h2>
          <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm mb-2 h-24 outline-none" placeholder="O que deve ser feito?" value={novaAcao.descricao} onChange={e => setNovaAcao({...novaAcao, descricao: e.target.value})} />
          <button className="bg-blue-600 w-full py-2 rounded-lg text-sm font-bold mb-6">Adicionar Ação</button>

          <h2 className="text-xs font-bold text-green-500 uppercase mb-3">Ações da Reunião</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {acoesCriadasAgora.map(a => (
              <div key={a.id} className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-xs">
                {a.descricao}
                <div className="mt-2 text-slate-500 font-bold">{a.responsavel}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

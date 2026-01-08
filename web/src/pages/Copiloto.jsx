import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  Mic, Square, Loader2, Cpu, CheckCircle, Search, Calendar, Clock, 
  Monitor, Plus, User, AlertTriangle, X 
} from 'lucide-react';
import { getGeminiFlash } from '../services/gemini';

// --- VARIÁVEIS GLOBAIS (Não morrem se o componente React resetar) ---
let globalRecorder = null;
let globalChunks = [];
let globalStream = null;
let globalStartTime = null;

// URL do Cloud Run que envia para o Google Drive
const CLOUD_RUN_URL = "https://upload-gravacoes-drive-368024743026.southamerica-east1.run.app";

// Helper para converter Blob em base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = String(result).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const Copiloto = () => {
  // Estados de Interface e Filtros
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [busca, setBusca] = useState('');
  
  // Estados de Ações
  const [acoes, setAcoes] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: '', responsavel: '' });
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  // 1. SINCRONIZAÇÃO E RECUPERAÇÃO
  useEffect(() => {
    fetchReunioes();
    if (globalRecorder?.state === 'recording') {
      setIsRecording(true);
      setSelecionada(JSON.parse(localStorage.getItem('reuniao_ativa')));
      retomarTimer();
    }
    return () => clearInterval(timerRef.current);
  }, [dataFiltro]);

  useEffect(() => {
    if (selecionada) fetchAcoes();
  }, [selecionada]);

  // 2. BUSCAS E DADOS
  const fetchReunioes = async () => {
    const { data } = await supabase.from('reunioes')
      .select('*')
      .gte('data_hora', `${dataFiltro}T00:00:00`)
      .lte('data_hora', `${dataFiltro}T23:59:59`);
    setReunioes(data || []);
  };

  const fetchAcoes = async () => {
    setLoadingAcoes(true);
    const { data } = await supabase.from('acoes').select('*').eq('reuniao_id', selecionada.id);
    setAcoes(data || []);
    setLoadingAcoes(false);
  };

  const retomarTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
    }, 1000);
  };

  // 3. GRAVAÇÃO ROBUSTA (TELA + SISTEMA + MIC)
  const startRecording = async () => {
    if (!selecionada) return alert("Selecione uma reunião.");
    
    try {
      const sStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const mStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      
      // Mixagem
      audioCtx.createMediaStreamSource(mStream).connect(dest);
      if (sStream.getAudioTracks().length > 0) {
        audioCtx.createMediaStreamSource(sStream).connect(dest);
      }

      const mixed = new MediaStream([
        ...sStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      globalRecorder = new MediaRecorder(mixed, { mimeType: 'video/webm;codecs=vp8,opus' });
      globalChunks = [];
      globalStream = sStream;
      globalStartTime = Date.now();
      localStorage.setItem('reuniao_ativa', JSON.stringify(selecionada));

      globalRecorder.ondataavailable = (e) => { if (e.data.size > 0) globalChunks.push(e.data); };
      globalRecorder.onstop = processarFinalizacao;
      
      globalRecorder.start(5000); // Chunks de 5 segundos para evitar perda de 2h
      setIsRecording(true);
      retomarTimer();

      await supabase.from('reunioes').update({ status: 'Em Andamento' }).eq('id', selecionada.id);
    } catch (e) { 
      console.error(e);
      alert("Erro ao iniciar. Verifique permissões de tela e áudio."); 
    }
  };

  const stopRecording = () => {
    if (globalRecorder) globalRecorder.stop();
    if (globalStream) globalStream.getTracks().forEach(t => t.stop());
    setIsRecording(false);
    clearInterval(timerRef.current);
    localStorage.removeItem('reuniao_ativa');
  };

  // NOVO: envia vídeo para Supabase e em seguida para o Drive via Cloud Run
  const enviarVideoParaSupabaseEDrive = async (videoBlob) => {
    if (!selecionada) return;

    const agora = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `reuniao-${selecionada.id}-${agora}.webm`;
    const path = `reunioes/${fileName}`;

    // 1) Upload no Supabase (bucket gravacoes)
    const { error: uploadError } = await supabase.storage
      .from("gravacoes")
      .upload(path, videoBlob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "video/webm",
      });

    if (uploadError) {
      console.error("Erro ao subir vídeo no Supabase:", uploadError);
      throw uploadError;
    }

    // 2) Envio para Cloud Run / Drive
    const base64Full = await blobToBase64(videoBlob);

    const resp = await fetch(CLOUD_RUN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName,
        fileBufferBase64: base64Full,
        mimeType: "video/webm",
      }),
    });

    const json = await resp.json().catch(() => ({}));

    if (!resp.ok || !json.success) {
      console.error("Erro ao enviar para Cloud Run / Drive:", json);
      throw new Error("Falha ao mover gravação para o Drive");
    }

    // 3) Apaga do Supabase (opcional)
    const { error: delError } = await supabase.storage
      .from("gravacoes")
      .remove([path]);

    if (delError) {
      console.warn("Não conseguiu apagar do Supabase (já está no Drive):", delError);
    }

    // 4) Atualiza reunião com link do Drive (se existir esse campo)
    try {
      await supabase
        .from("reunioes")
        .update({ drive_link: json.link })
        .eq("id", selecionada.id);
    } catch (e) {
      console.warn("Não foi possível salvar drive_link na reunião:", e);
    }

    return json.link;
  };

  // PROCESSAMENTO FINAL: ATA + Upload + Drive
  const processarFinalizacao = async () => {
    setIsProcessing(true);
    const videoBlob = new Blob(globalChunks, { type: 'video/webm' });
    
    try {
      // 1) IA Flash para ATA usando amostra de 30MB
      const model = getGeminiFlash();
      const sampleBlob = videoBlob.slice(0, 30 * 1024 * 1024);
      const base64Sample = await blobToBase64(sampleBlob);

      const result = await model.generateContent([
        "Gere ATA detalhada: RESUMO, DECISÕES, AÇÕES.",
        { inlineData: { data: base64Sample, mimeType: "video/webm" } }
      ]);

      const textoAta = result.response.text();

      // 2) Atualiza reunião
      await supabase.from('reunioes').update({
        pauta: textoAta,
        status: 'Realizada',
        duracao_segundos: timer
      }).eq('id', selecionada.id);

      // 3) Envia vídeo completo para Supabase + Drive
      await enviarVideoParaSupabaseEDrive(videoBlob);

      // 4) Recarrega reuniões
      fetchReunioes();
    } catch (e) {
      console.error("Erro no processamento final:", e);
      alert("Ocorreu um erro ao salvar a reunião. Verifique o console para mais detalhes.");
    } finally {
      setIsProcessing(false);
    }
  };

  const salvarAcao = async () => {
    if (!novaAcao.descricao) return;
    const { data } = await supabase.from('acoes').insert([{
      ...novaAcao, reuniao_id: selecionada.id, status: 'Aberta'
    }]).select();
    setAcoes([data[0], ...acoes]);
    setNovaAcao({ descricao: '', responsavel: '' });
  };

  const format = (s) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  return (
    <Layout>
      <div className="h-screen bg-[#0f172a] text-white flex overflow-hidden">
        {/* COLUNA ESQUERDA: LISTAGEM */}
        <div className="w-7/12 flex flex-col p-6 border-r border-slate-800">
          <h1 className="text-2xl font-black text-blue-500 mb-6 flex items-center gap-2">
            <Cpu size={32}/> COPILOTO TÁTICO
          </h1>
          
          <div className="flex gap-2 mb-4">
            <input type="date" className="bg-slate-800 rounded-xl p-3 text-sm flex-1" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
            <input type="text" placeholder="Buscar..." className="bg-slate-800 rounded-xl p-3 text-sm flex-1" onChange={e => setBusca(e.target.value)} />
          </div>

          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-y-auto mb-6 custom-scrollbar">
            {reunioes.filter(r => r.titulo.toLowerCase().includes(busca.toLowerCase())).map(r => (
              <div key={r.id} onClick={() => !isRecording && setSelecionada(r)} 
                   className={`p-4 border-b border-slate-800 cursor-pointer ${selecionada?.id === r.id ? 'bg-blue-600/10 border-l-4 border-l-blue-500' : 'hover:bg-slate-800'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">{r.titulo}</span>
                  <span className="text-[10px] bg-slate-700 px-2 py-1 rounded font-bold uppercase">{r.status || 'Pendente'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CONTROLES */}
          <div className="bg-slate-800/80 p-6 rounded-3xl flex items-center justify-between border border-slate-700">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isRecording ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                {isRecording ? <div className="w-4 h-4 bg-red-500 rounded-full animate-ping"/> : <Monitor size={28}/>}
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Tempo de Sessão</p>
                <p className="text-2xl font-mono font-bold leading-none">{format(timer)}</p>
              </div>
            </div>

            {isProcessing ? (
              <div className="flex items-center gap-2 text-blue-400 font-bold animate-pulse">
                <Loader2 className="animate-spin"/> SALVANDO...
              </div>
            ) : isRecording ? (
              <button 
                onClick={stopRecording} 
                className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-xs hover:bg-red-50 transition-all">
                ENCERRAR
              </button>
            ) : (
              <button 
                onClick={startRecording} 
                disabled={!selecionada} 
                className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs hover:bg-blue-500 disabled:opacity-20 transition-all shadow-lg shadow-blue-900/40">
                INICIAR GRAVAÇÃO
              </button>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: AÇÕES E ATA */}
        <div className="w-5/12 p-6 flex flex-col bg-slate-900/80">
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-tighter">Nova Ação Direta</h2>
            <textarea 
              className="w-full bg-slate-800 border-none rounded-2xl p-4 text-sm h-24 mb-3 outline-none focus:ring-2 ring-blue-500" 
              placeholder="O que precisa ser feito?" 
              value={novaAcao.descricao} 
              onChange={e => setNovaAcao({...novaAcao, descricao: e.target.value})} 
            />
            <div className="flex gap-2">
              <input 
                className="bg-slate-800 rounded-xl px-4 py-2 text-xs flex-1" 
                placeholder="Responsável" 
                value={novaAcao.responsavel} 
                onChange={e => setNovaAcao({...novaAcao, responsavel: e.target.value})} 
              />
              <button onClick={salvarAcao} className="bg-blue-600 p-2 rounded-xl hover:bg-blue-500">
                <Plus size={20}/>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
            <h2 className="text-xs font-bold text-green-500 uppercase flex items-center gap-2">
              <CheckCircle size={14}/> Ações Confirmadas
            </h2>
            {acoes.map(a => (
              <div key={a.id} className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl text-xs">
                <p className="text-slate-200">{a.descricao}</p>
                <p className="mt-2 text-blue-400 font-bold">{a.responsavel}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Copiloto;

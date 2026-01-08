import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import {
  Loader2, Cpu, CheckCircle, Monitor, Plus
} from 'lucide-react';
import { getGeminiFlash } from '../services/gemini';

// ======== CONFIG ========
const CLOUD_RUN_URL = "https://upload-gravacoes-drive-368024743026.southamerica-east1.run.app";
const BUCKET_GRAVACOES = "gravacoes";
const CHUNK_MS = 5000; // 5s
const IA_SAMPLE_MAX_BYTES = 30 * 1024 * 1024; // 30MB

// retries para Cloud Run
const CLOUD_RUN_RETRIES = 3;
const CLOUD_RUN_TIMEOUT_MS = 120000; // 120s por tentativa (upload no Drive ocorre no backend)

// --- VARIÁVEIS GLOBAIS (Não morrem se o componente React resetar) ---
let globalRecorder = null;
let globalChunks = [];
let globalDisplayStream = null;
let globalStartTime = null;

// ======== Helpers ========
const safeJsonParse = (s) => {
  try { return JSON.parse(s); } catch { return null; }
};

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => {
    const result = reader.result;
    const base64 = String(result).split(",")[1];
    resolve(base64);
  };
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const withTimeout = (promise, ms, errorMsg = "Timeout") => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(errorMsg), ms);

  return {
    signal: ctrl.signal,
    run: promise(ctrl.signal).finally(() => clearTimeout(t)),
  };
};

const fetchWithRetry = async (url, options, retries = 3) => {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const { run } = withTimeout(
        async (signal) => {
          const resp = await fetch(url, { ...options, signal });
          const json = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
          return json;
        },
        CLOUD_RUN_TIMEOUT_MS,
        "Cloud Run timeout"
      );

      return await run;
    } catch (e) {
      lastErr = e;
      // pequeno backoff
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
};

const formatMMSS = (s) => {
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

const Copiloto = () => {
  // Interface e filtros
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [busca, setBusca] = useState('');

  // Ações
  const [acoes, setAcoes] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: '', responsavel: '' });
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  // Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  // ======== Carregamento ========
  useEffect(() => {
    fetchReunioes();

    // Retomar “sessão” caso o React resete
    const ativa = safeJsonParse(localStorage.getItem("reuniao_ativa"));
    if (ativa && globalRecorder?.state === "recording") {
      setSelecionada(ativa);
      setIsRecording(true);
      retomarTimer();
    }

    return () => clearInterval(timerRef.current);
  }, [dataFiltro]);

  useEffect(() => {
    if (selecionada) fetchAcoes();
  }, [selecionada]);

  const fetchReunioes = async () => {
    const { data } = await supabase
      .from('reunioes')
      .select('*')
      .gte('data_hora', `${dataFiltro}T00:00:00`)
      .lte('data_hora', `${dataFiltro}T23:59:59`);
    setReunioes(data || []);
  };

  const fetchAcoes = async () => {
    setLoadingAcoes(true);
    const { data } = await supabase
      .from('acoes')
      .select('*')
      .eq('reuniao_id', selecionada.id);
    setAcoes(data || []);
    setLoadingAcoes(false);
  };

  const retomarTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!globalStartTime) return;
      setTimer(Math.floor((Date.now() - globalStartTime) / 1000));
    }, 1000);
  };

  // ======== Gravação robusta ========
  const startRecording = async () => {
    if (!selecionada) return alert("Selecione uma reunião.");

    try {
      setStatusMsg("Solicitando permissão de tela/áudio...");
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      setStatusMsg("Solicitando microfone...");
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Mixagem de áudio (mic + sistema)
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();

      audioCtx.createMediaStreamSource(micStream).connect(dest);
      if (displayStream.getAudioTracks().length > 0) {
        audioCtx.createMediaStreamSource(displayStream).connect(dest);
      }

      const mixedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      globalRecorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm;codecs=vp8,opus' });
      globalChunks = [];
      globalDisplayStream = displayStream;
      globalStartTime = Date.now();

      // Persistência mínima para “retomar UI”
      localStorage.setItem('reuniao_ativa', JSON.stringify(selecionada));

      // Se o usuário parar o compartilhamento de tela / mudar / o SO cortar:
      const [videoTrack] = displayStream.getVideoTracks();
      if (videoTrack) {
        videoTrack.onended = () => {
          // encerra com segurança
          if (globalRecorder && globalRecorder.state === "recording") {
            console.warn("Display track ended. Finalizando gravação...");
            stopRecording(true);
          }
        };
      }

      globalRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) globalChunks.push(e.data);
      };

      globalRecorder.onstop = processarFinalizacao;

      // Chunks de 5s para reduzir risco de perda
      globalRecorder.start(CHUNK_MS);

      setIsRecording(true);
      setStatusMsg("");
      retomarTimer();

      // Marca reunião como em andamento + marca início
      await supabase
        .from('reunioes')
        .update({
          status: 'Em Andamento',
          gravacao_started_at: new Date().toISOString(),
          upload_status: 'PENDENTE',
          upload_error: null
        })
        .eq('id', selecionada.id);

    } catch (e) {
      console.error(e);
      setStatusMsg("");
      alert("Erro ao iniciar. Verifique permissões de tela e áudio.");
    }
  };

  /**
   * stopRecording(force = false)
   * force=true quando o track acabou (troca/parou compartilhamento) -> tenta finalizar do jeito que estiver
   */
  const stopRecording = (force = false) => {
    try {
      if (globalRecorder && globalRecorder.state === "recording") {
        globalRecorder.stop();
      }
    } catch (e) {
      console.warn("Erro ao parar recorder:", e);
    }

    try {
      if (globalDisplayStream) globalDisplayStream.getTracks().forEach(t => t.stop());
    } catch {}

    setIsRecording(false);
    clearInterval(timerRef.current);
    localStorage.removeItem('reuniao_ativa');
  };

  // ======== Upload + Drive (robusto) ========
  const enviarParaSupabase = async (videoBlob) => {
    const agora = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `reuniao-${selecionada.id}-${agora}.webm`;
    const path = `reunioes/${fileName}`;

    setStatusMsg("Enviando gravação para Supabase (temporário)...");

    // upload_status -> ENVIANDO (upload supabase)
    await supabase
      .from("reunioes")
      .update({
        upload_status: "ENVIANDO",
        upload_error: null
      })
      .eq("id", selecionada.id);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_GRAVACOES)
      .upload(path, videoBlob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "video/webm",
      });

    if (uploadError) throw uploadError;

    // salva metadados na reunião
    await supabase
      .from("reunioes")
      .update({
        gravacao_path: path,
        gravacao_mime: "video/webm",
        gravacao_size_bytes: videoBlob.size,
        gravacao_finished_at: new Date().toISOString(),
        upload_status: "PENDENTE" // pendente de envio ao drive
      })
      .eq("id", selecionada.id);

    return { path, fileName };
  };

  const enviarParaDriveViaCloudRun = async (path) => {
    setStatusMsg("Movendo gravação para Google Drive...");

    // Marca como ENVIANDO (drive)
    await supabase
      .from("reunioes")
      .update({ upload_status: "ENVIANDO", upload_error: null })
      .eq("id", selecionada.id);

    // Cloud Run recebe apenas path (o backend baixa do Supabase e envia pro Drive)
    const json = await fetchWithRetry(
      CLOUD_RUN_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, reuniao_id: selecionada.id }),
      },
      CLOUD_RUN_RETRIES
    );

    if (!json?.success) throw new Error(json?.error || "Falha ao enviar para Drive");

    // Atualiza reunião com retorno
    await supabase
      .from("reunioes")
      .update({
        drive_link: json.link || null,
        drive_id: json.driveId || null,
        drive_uploaded_at: new Date().toISOString(),
        upload_status: "ENVIADO",
      })
      .eq("id", selecionada.id);

    return json;
  };

  // ======== Finalização ========
  const processarFinalizacao = async () => {
    setIsProcessing(true);
    setStatusMsg("Finalizando gravação...");
    const videoBlob = new Blob(globalChunks, { type: 'video/webm' });

    try {
      // 1) ATA via Gemini (amostra)
      setStatusMsg("Gerando ATA (IA)...");
      const model = getGeminiFlash();
      const sampleBlob = videoBlob.slice(0, IA_SAMPLE_MAX_BYTES);
      const base64Sample = await blobToBase64(sampleBlob);

      const result = await model.generateContent([
        "Gere ATA detalhada: RESUMO, DECISÕES, AÇÕES.",
        { inlineData: { data: base64Sample, mimeType: "video/webm" } }
      ]);

      const textoAta = result.response.text();

      // 2) Atualiza reunião: ATA + status + duração
      setStatusMsg("Salvando ATA e dados da reunião...");
      await supabase
        .from('reunioes')
        .update({
          pauta: textoAta,
          status: 'Realizada',
          duracao_segundos: timer
        })
        .eq('id', selecionada.id);

      // 3) Upload temporário no Supabase
      const { path } = await enviarParaSupabase(videoBlob);

      // 4) Drive via Cloud Run (path)
      await enviarParaDriveViaCloudRun(path);

      setStatusMsg("");
      fetchReunioes();
    } catch (e) {
      console.error("Erro no processamento final:", e);

      // marca erro no Supabase
      try {
        await supabase
          .from("reunioes")
          .update({
            upload_status: "ERRO",
            upload_error: String(e?.message || e)
          })
          .eq("id", selecionada?.id);
      } catch {}

      setStatusMsg("");
      alert("Ocorreu um erro ao salvar a reunião. A gravação pode ter ficado no Supabase (temporário).");
    } finally {
      setIsProcessing(false);
      localStorage.removeItem("reuniao_ativa");
    }
  };

  // ======== Ações ========
  const salvarAcao = async () => {
    if (!novaAcao.descricao) return;
    const { data } = await supabase
      .from('acoes')
      .insert([{
        ...novaAcao, reuniao_id: selecionada.id, status: 'Aberta'
      }])
      .select();
    setAcoes([data[0], ...acoes]);
    setNovaAcao({ descricao: '', responsavel: '' });
  };

  return (
    <Layout>
      <div className="h-screen bg-[#0f172a] text-white flex overflow-hidden">
        {/* COLUNA ESQUERDA */}
        <div className="w-7/12 flex flex-col p-6 border-r border-slate-800">
          <h1 className="text-2xl font-black text-blue-500 mb-6 flex items-center gap-2">
            <Cpu size={32}/> COPILOTO TÁTICO
          </h1>

          <div className="flex gap-2 mb-4">
            <input
              type="date"
              className="bg-slate-800 rounded-xl p-3 text-sm flex-1"
              value={dataFiltro}
              onChange={e => setDataFiltro(e.target.value)}
            />
            <input
              type="text"
              placeholder="Buscar..."
              className="bg-slate-800 rounded-xl p-3 text-sm flex-1"
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-y-auto mb-6 custom-scrollbar">
            {reunioes
              .filter(r => (r.titulo || "").toLowerCase().includes(busca.toLowerCase()))
              .map(r => (
                <div
                  key={r.id}
                  onClick={() => !isRecording && setSelecionada(r)}
                  className={`p-4 border-b border-slate-800 cursor-pointer ${
                    selecionada?.id === r.id
                      ? 'bg-blue-600/10 border-l-4 border-l-blue-500'
                      : 'hover:bg-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">{r.titulo}</span>
                    <span className="text-[10px] bg-slate-700 px-2 py-1 rounded font-bold uppercase">
                      {r.status || 'Pendente'}
                    </span>
                  </div>

                  {/* Status de upload */}
                  {r.upload_status && (
                    <div className="mt-2 text-[10px] text-slate-400">
                      Upload: <span className="font-bold">{r.upload_status}</span>
                      {r.drive_link ? (
                        <span className="ml-2 text-blue-400 font-bold">Drive OK</span>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
          </div>

          {/* CONTROLES */}
          <div className="bg-slate-800/80 p-6 rounded-3xl flex items-center justify-between border border-slate-700">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                isRecording ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'
              }`}>
                {isRecording
                  ? <div className="w-4 h-4 bg-red-500 rounded-full animate-ping"/>
                  : <Monitor size={28}/>
                }
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Tempo de Sessão</p>
                <p className="text-2xl font-mono font-bold leading-none">{formatMMSS(timer)}</p>
                {statusMsg ? <p className="text-[10px] mt-1 text-blue-300">{statusMsg}</p> : null}
              </div>
            </div>

            {isProcessing ? (
              <div className="flex items-center gap-2 text-blue-400 font-bold animate-pulse">
                <Loader2 className="animate-spin"/> PROCESSANDO...
              </div>
            ) : isRecording ? (
              <button
                onClick={() => stopRecording(false)}
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

        {/* COLUNA DIREITA */}
        <div className="w-5/12 p-6 flex flex-col bg-slate-900/80">
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-tighter">Nova Ação Direta</h2>
            <textarea
              className="w-full bg-slate-800 border-none rounded-2xl p-4 text-sm h-24 mb-3 outline-none focus:ring-2 ring-blue-500"
              placeholder="O que precisa ser feito?"
              value={novaAcao.descricao}
              onChange={e => setNovaAcao({ ...novaAcao, descricao: e.target.value })}
            />
            <div className="flex gap-2">
              <input
                className="bg-slate-800 rounded-xl px-4 py-2 text-xs flex-1"
                placeholder="Responsável"
                value={novaAcao.responsavel}
                onChange={e => setNovaAcao({ ...novaAcao, responsavel: e.target.value })}
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

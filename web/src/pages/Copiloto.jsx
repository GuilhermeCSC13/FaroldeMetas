// src/pages/Copiloto.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import { Loader2, Cpu, CheckCircle, Monitor, Plus, Lock } from "lucide-react";
import { useRecording } from "../context/RecordingContext";

function secondsToMMSS(s) {
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function norm(s) {
  return String(s || "").trim().toUpperCase();
}

// ✅ texto “real” (ignora placeholders/template)
function isMeaningfulText(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;

  const low = s.toLowerCase();

  // placeholders comuns (ajuste se quiser)
  const placeholders = [
    "sem resumo",
    "sem registros",
    "selecione uma reunião",
    "selecione uma reuniao",
    "—",
    "-",
    "n/a",
    "nao ha",
    "não há",
  ];

  if (placeholders.some((p) => low.includes(p))) return false;

  // ✅ exige tamanho mínimo para não considerar template curto
  return s.length >= 40;
}

// ✅ “Ata pronta” de verdade (não confundir com pauta/template)
function hasAtaReal(r) {
  if (!r) return false;

  // 1) Status real de ata (se existir no seu schema)
  const ataStatus = String(r.ata_ia_status || r.ata_status || r.status_ata || "")
    .trim()
    .toUpperCase();

  const okByStatus = new Set(["PRONTO", "PRONTA", "OK", "GERADA", "FINALIZADA", "CONCLUIDA", "CONCLUÍDA"]);
  if (okByStatus.has(ataStatus)) return true;

  // 2) Caminhos/urls/fields “de arquivo” (se existir)
  const ataFields = [
    r.ata_url,
    r.ata_storage_path,
    r.ata_path,
    r.ata_markdown,
    r.ata_html,
    r.ata_pdf_url,
    r.ata_pdf_path,
    r.ata_bucket,
  ].filter(Boolean);

  if (ataFields.length > 0) return true;

  // 3) Conteúdo: só se for “significativo”
  if (isMeaningfulText(r.pauta)) return true;
  if (isMeaningfulText(r.ata_texto)) return true;
  if (isMeaningfulText(r.ata)) return true;

  return false;
}

export default function Copiloto() {
  const { isRecording, isProcessing, timer, startRecording, stopRecording, current } =
    useRecording();

  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [busca, setBusca] = useState("");

  const [acoes, setAcoes] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel: "" });
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  // modal admin
  const [showUnlock, setShowUnlock] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const isMountedRef = useRef(false);
  const safeSet = (fn) => {
    if (isMountedRef.current) fn();
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchReunioes();
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchReunioes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFiltro]);

  useEffect(() => {
    if (selecionada) fetchAcoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada]);

  const fetchReunioes = async () => {
    const { data, error } = await supabase
      .from("reunioes")
      .select("*")
      .gte("data_hora", `${dataFiltro}T00:00:00`)
      .lte("data_hora", `${dataFiltro}T23:59:59`)
      .order("data_hora", { ascending: true });

    if (error) {
      console.error("fetchReunioes:", error);
      return;
    }

    safeSet(() => setReunioes(data || []));

    if (isRecording && current?.reuniaoId) {
      const found = (data || []).find((r) => r.id === current.reuniaoId);
      if (found) safeSet(() => setSelecionada(found));
    }
  };

  const fetchAcoes = async () => {
    if (!selecionada?.id) return;

    safeSet(() => setLoadingAcoes(true));
    const { data, error } = await supabase
      .from("acoes")
      .select("*")
      .eq("reuniao_id", selecionada.id)
      .order("created_at", { ascending: false });

    if (error) console.error("fetchAcoes:", error);
    safeSet(() => setAcoes(data || []));
    safeSet(() => setLoadingAcoes(false));
  };

  const salvarAcao = async () => {
    if (!selecionada?.id) return;
    if (!novaAcao.descricao?.trim()) return;

    const payload = {
      ...novaAcao,
      reuniao_id: selecionada.id,
      status: "Aberta",
    };

    const { data, error } = await supabase.from("acoes").insert([payload]).select();

    if (error) {
      console.error("salvarAcao:", error);
      return;
    }

    safeSet(() => setAcoes([data?.[0], ...(acoes || [])].filter(Boolean)));
    safeSet(() => setNovaAcao({ descricao: "", responsavel: "" }));
  };

  // ✅ regra de bloqueio: só bloqueia se status REALIZADA ou ATA realmente pronta ou pipeline de gravação
  const isLocked = useMemo(() => {
    return (r) => {
      if (!r) return false;

      const st = norm(r.status);
      const gs = norm(r.gravacao_status);

      // status final real
      if (st === "REALIZADA") return true;

      // ata realmente pronta (não confundir com template)
      if (hasAtaReal(r)) return true;

      // estados que indicam pipeline já rolando/concluído
      const doneOrPipeline = new Set([
        "PRONTO_PROCESSAR",
        "PROCESSANDO",
        "PROCESSANDO_DRIVE",
        "ENVIADO_DRIVE",
        "PRONTO",
        "CONCLUIDO",
        "CONCLUÍDO",
      ]);

      if (doneOrPipeline.has(gs)) return true;

      return false;
    };
  }, []);

  // ✅ badge: NÃO marca “REALIZADA” só porque existe pauta
  const badgeLabel = (r) => {
    if (!r) return "PENDENTE";

    const st = norm(r.status);
    const gs = norm(r.gravacao_status);

    if (st === "REALIZADA") return "REALIZADA";
    if (hasAtaReal(r)) return "ATA PRONTA";

    if (gs) return gs;
    if (st) return st;

    return "PENDENTE";
  };

  const badgeStyle = (label) => {
    const v = norm(label);
    if (v === "GRAVANDO") return "bg-red-600/30 text-red-200 border border-red-500/30";
    if (v === "ERRO") return "bg-red-900/40 text-red-200 border border-red-500/30";
    if (v === "REALIZADA") return "bg-green-600/20 text-green-200 border border-green-500/30";
    if (v === "ATA PRONTA") return "bg-emerald-600/20 text-emerald-200 border border-emerald-500/30";
    if (v.includes("PROCESS")) return "bg-blue-600/20 text-blue-200 border border-blue-500/30";
    if (v.includes("PRONTO")) return "bg-emerald-600/20 text-emerald-200 border border-emerald-500/30";
    return "bg-slate-700 text-slate-100 border border-slate-600";
  };

  const onStart = async () => {
    if (!selecionada?.id) return alert("Selecione uma reunião.");
    if (isRecording) return;

    if (isLocked(selecionada)) {
      setShowUnlock(true);
      return;
    }

    try {
      await startRecording({
        reuniaoId: selecionada.id,
        reuniaoTitulo: selecionada.titulo,
      });

      await fetchReunioes();
    } catch (e) {
      console.error("startRecording (Copiloto):", e);
      alert("Erro ao iniciar. Verifique permissões de tela e áudio.");
    }
  };

  const onStop = async () => {
    try {
      await stopRecording();
      await fetchReunioes();
    } catch (e) {
      console.error("stopRecording (Copiloto):", e);
      alert("Erro ao encerrar a gravação.");
    }
  };

  // ===== ADMIN UNLOCK =====
  function getLoginSalvo() {
    return (
      localStorage.getItem("inove_login") ||
      sessionStorage.getItem("inove_login") ||
      localStorage.getItem("login") ||
      sessionStorage.getItem("login") ||
      ""
    );
  }

  async function validarAdmin(senhaDigitada) {
    const login = getLoginSalvo();
    if (!login) return false;

    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("id, nivel, ativo, login")
      .eq("login", login)
      .eq("senha", senhaDigitada)
      .eq("ativo", true)
      .maybeSingle();

    if (error) return false;
    return String(data?.nivel || "").toLowerCase() === "administrador";
  }

  // ✅ liberação sem mexer no schema:
  // volta a reunião para regravar (limpa status de gravação/pipeline)
  async function liberarRegravacao(reuniaoId) {
    const login = getLoginSalvo() || "ADMIN";

    const payload = {
      status: "Pendente",
      gravacao_status: null,
      gravacao_erro: `LIBERADO PARA REGRAVAR por ${login} em ${new Date().toISOString()}`,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("reunioes").update(payload).eq("id", reuniaoId);
    if (error) throw error;
  }

  const onConfirmUnlock = async () => {
    if (!selecionada?.id) return;
    if (!senhaAdmin) return;

    setUnlocking(true);
    try {
      const ok = await validarAdmin(senhaAdmin);
      if (!ok) {
        alert("Senha inválida ou usuário não é Administrador.");
        return;
      }

      await liberarRegravacao(selecionada.id);

      setShowUnlock(false);
      setSenhaAdmin("");
      await fetchReunioes();
      alert("Regravação liberada. Agora você pode iniciar novamente.");
    } catch (e) {
      console.error("unlock error:", e);
      alert("Erro ao liberar regravação.");
    } finally {
      setUnlocking(false);
    }
  };

  const reunioesFiltradas = (reunioes || []).filter((r) =>
    (r.titulo || "").toLowerCase().includes((busca || "").toLowerCase())
  );

  return (
    <Layout>
      <div className="h-screen bg-[#0f172a] text-white flex overflow-hidden">
        {/* COLUNA ESQUERDA */}
        <div className="w-7/12 flex flex-col p-6 border-r border-slate-800">
          <h1 className="text-2xl font-black text-blue-500 mb-6 flex items-center gap-2">
            <Cpu size={32} /> COPILOTO TÁTICO
          </h1>

          <div className="flex gap-2 mb-4">
            <input
              type="date"
              className="bg-slate-800 rounded-xl p-3 text-sm flex-1"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
            />
            <input
              type="text"
              placeholder="Buscar..."
              className="bg-slate-800 rounded-xl p-3 text-sm flex-1"
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-y-auto mb-6 custom-scrollbar">
            {reunioesFiltradas.map((r) => {
              const lbl = badgeLabel(r);
              const locked = isLocked(r);

              return (
                <div
                  key={r.id}
                  onClick={() => !isRecording && setSelecionada(r)}
                  className={`p-4 border-b border-slate-800 cursor-pointer ${
                    selecionada?.id === r.id
                      ? "bg-blue-600/10 border-l-4 border-l-blue-500"
                      : "hover:bg-slate-800"
                  } ${isRecording ? "opacity-80" : ""}`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-sm truncate">{r.titulo}</span>

                      {locked && (
                        <span className="text-[10px] px-2 py-1 rounded font-black uppercase bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1">
                          <Lock size={12} /> BLOQUEADO
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] px-2 py-1 rounded font-black uppercase whitespace-nowrap ${badgeStyle(
                        lbl
                      )}`}
                      title={r.gravacao_erro || ""}
                    >
                      {lbl}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CONTROLES */}
          <div className="bg-slate-800/80 p-6 rounded-3xl flex items-center justify-between border border-slate-700">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  isRecording ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"
                }`}
              >
                {isRecording ? (
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-ping" />
                ) : (
                  <Monitor size={28} />
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Tempo de Sessão</p>
                <p className="text-2xl font-mono font-bold leading-none">{secondsToMMSS(timer)}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isRecording && current?.reuniaoTitulo
                    ? `Gravando: ${current.reuniaoTitulo}`
                    : "Pronto para gravar"}
                </p>
              </div>
            </div>

            {isProcessing ? (
              <div className="flex items-center gap-2 text-blue-400 font-bold animate-pulse">
                <Loader2 className="animate-spin" /> FINALIZANDO...
              </div>
            ) : isRecording ? (
              <button
                onClick={onStop}
                className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-xs hover:bg-red-50 transition-all"
              >
                ENCERRAR
              </button>
            ) : (
              <button
                onClick={onStart}
                disabled={!selecionada}
                className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs hover:bg-blue-500 disabled:opacity-20 transition-all shadow-lg shadow-blue-900/40"
              >
                INICIAR GRAVAÇÃO
              </button>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="w-5/12 p-6 flex flex-col bg-slate-900/80">
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-tighter">
              Nova Ação Direta
            </h2>

            <textarea
              className="w-full bg-slate-800 border-none rounded-2xl p-4 text-sm h-24 mb-3 outline-none focus:ring-2 ring-blue-500"
              placeholder="O que precisa ser feito?"
              value={novaAcao.descricao}
              onChange={(e) => setNovaAcao({ ...novaAcao, descricao: e.target.value })}
            />

            <div className="flex gap-2">
              <input
                className="bg-slate-800 rounded-xl px-4 py-2 text-xs flex-1"
                placeholder="Responsável"
                value={novaAcao.responsavel}
                onChange={(e) => setNovaAcao({ ...novaAcao, responsavel: e.target.value })}
              />
              <button
                onClick={salvarAcao}
                disabled={!selecionada || !novaAcao.descricao?.trim()}
                className="bg-blue-600 p-2 rounded-xl hover:bg-blue-500 disabled:opacity-30"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
            <h2 className="text-xs font-bold text-green-500 uppercase flex items-center gap-2">
              <CheckCircle size={14} /> Ações Confirmadas
            </h2>

            {loadingAcoes ? (
              <div className="text-slate-400 text-sm">Carregando ações...</div>
            ) : (acoes || []).length === 0 ? (
              <div className="text-slate-400 text-sm">
                {selecionada ? "Nenhuma ação cadastrada ainda." : "Selecione uma reunião."}
              </div>
            ) : (
              (acoes || []).map((a) => (
                <div
                  key={a.id}
                  className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl text-xs"
                >
                  <p className="text-slate-200">{a.descricao}</p>
                  <p className="mt-2 text-blue-400 font-bold">{a.responsavel}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MODAL: LIBERAÇÃO ADMIN */}
        {showUnlock && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="w-[440px] bg-slate-900 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-black text-white">Liberação de Regravação</h3>
              <p className="text-xs text-slate-400 mt-2">
                Esta reunião já foi gravada/processada (ou a Ata já existe). Para gravar novamente,
                confirme a <b>senha do Administrador</b>.
              </p>

              <input
                type="password"
                className="w-full mt-4 bg-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-blue-500"
                placeholder="Senha do Administrador"
                value={senhaAdmin}
                onChange={(e) => setSenhaAdmin(e.target.value)}
              />

              <div className="flex gap-2 mt-5 justify-end">
                <button
                  onClick={() => {
                    setShowUnlock(false);
                    setSenhaAdmin("");
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
                  disabled={unlocking}
                >
                  Cancelar
                </button>

                <button
                  onClick={onConfirmUnlock}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-500 disabled:opacity-40"
                  disabled={unlocking || !senhaAdmin}
                >
                  {unlocking ? "Liberando..." : "Liberar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

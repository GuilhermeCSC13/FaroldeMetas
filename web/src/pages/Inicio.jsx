// src/pages/Inicio.jsx
import React, { useEffect, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import { getGeminiFlash } from "../services/gemini";
import {
  Calendar,
  ArrowRight,
  Zap,
  BrainCircuit,
  Loader2,
  Layers,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Helpers de data (SP) + bounds UTC
 * Problema original: data_hora é timestamptz (UTC), mas o filtro "hoje" era feito como se fosse local.
 */
function getTodaySP_YYYY_MM_DD() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`; // YYYY-MM-DD
}

function getSPDayBoundsUTC(yyyy_mm_dd) {
  // Cria datas com offset -03:00 e converte para ISO UTC
  const startUTC = new Date(`${yyyy_mm_dd}T00:00:00-03:00`).toISOString();
  const endUTC = new Date(`${yyyy_mm_dd}T23:59:59-03:00`).toISOString();
  return { startUTC, endUTC };
}

function safeJson(v) {
  try {
    return JSON.stringify(v ?? []);
  } catch {
    return "[]";
  }
}

function normalizePautaText(txt, maxChars = 1200) {
  const s = String(txt || "").trim();
  if (!s) return "";
  // corta para não estourar prompt/token
  return s.length > maxChars ? s.slice(0, maxChars) + "…" : s;
}

const Inicio = () => {
  const navigate = useNavigate();
  const [resumoIA, setResumoIA] = useState("Conectando aos satélites táticos...");
  const [loadingIA, setLoadingIA] = useState(true);
  const [iaStatus, setIaStatus] = useState("checking"); // checking | active | inactive
  const [lastUpdate, setLastUpdate] = useState(null);

  const [stats, setStats] = useState({
    acoesAbertas: 0,
    reunioesHoje: 0,
  });

  useEffect(() => {
    // ✅ Guard mínimo (mantido)
    const guard = async () => {
      const storedUser = localStorage.getItem("usuario_externo");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!storedUser && !session) {
        window.location.replace("/");
        return;
      }

      carregarDados();
    };

    guard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarDados = async () => {
    setLoadingIA(true);

    // Hoje em SP (não UTC)
    const hojeSP = getTodaySP_YYYY_MM_DD();
    const { startUTC, endUTC } = getSPDayBoundsUTC(hojeSP);

    // 1) KPIs: ações abertas
    const { count: acoesCount, error: errAcoes } = await supabase
      .from("acoes")
      .select("*", { count: "exact", head: true })
      .eq("status", "Aberta");

    if (errAcoes) console.error("Erro ao contar ações abertas:", errAcoes);

    // 2) Agenda de hoje (corrigido por bounds UTC equivalentes ao dia SP)
    const { data: agendaHoje, error: errAgenda } = await supabase
      .from("reunioes")
      .select("id, titulo, data_hora, status, cor, tipo_reuniao_id, tipo_reuniao_legacy")
      .gte("data_hora", startUTC)
      .lte("data_hora", endUTC)
      .order("data_hora", { ascending: true });

    if (errAgenda) console.error("Erro ao buscar agenda do dia:", errAgenda);

    // 3) Últimas reuniões realizadas + ATAs IA (coluna pauta)
    const { data: ultimasRealizadas, error: errUltimas } = await supabase
      .from("reunioes")
      .select("id, titulo, data_hora, status, pauta")
      .eq("status", "Realizada")
      .order("data_hora", { ascending: false })
      .limit(2);

    if (errUltimas) console.error("Erro ao buscar últimas realizadas:", errUltimas);

    const estatisticas = {
      acoesAbertas: acoesCount || 0,
      reunioesHoje: (agendaHoje || []).length,
      agendaHoje: agendaHoje || [],
      ultimasRealizadas: ultimasRealizadas || [],
      hojeSP,
      startUTC,
      endUTC,
    };

    setStats({
      acoesAbertas: estatisticas.acoesAbertas,
      reunioesHoje: estatisticas.reunioesHoje,
    });

    // 4) Cache ou nova geração
    const cacheDate = localStorage.getItem("farol_ia_date");
    const cacheText = localStorage.getItem("farol_ia_text");

    if (cacheDate === hojeSP && cacheText) {
      setResumoIA(cacheText);
      setIaStatus("active");
      setLoadingIA(false);
      setLastUpdate(new Date().toLocaleTimeString());
    } else {
      await gerarResumoIA(estatisticas);
    }
  };

  const gerarResumoIA = async (dados) => {
    setIaStatus("checking");
    try {
      const model = getGeminiFlash();

      // 1) Busca prompt no Supabase (app_prompts)
      let promptTemplate = "";
      const { data: promptData, error: promptErr } = await supabase
        .from("app_prompts")
        .select("prompt_text")
        .eq("slug", "inicio_resumo")
        .maybeSingle();

      if (promptErr) {
        console.error("Erro ao buscar prompt inicio_resumo:", promptErr);
      }

      promptTemplate =
        promptData?.prompt_text ||
        `Aja como um Diretor de Operações Sênior analisando o Farol Tático.

DADOS (DATA: {data_sp}):
- Janela do dia (SP): {inicio_sp} até {fim_sp}
- Agenda de hoje (SP): {agendaHoje}
- Ações abertas: {acoesAbertas}

ATAS IA (últimas reuniões realizadas):
{atasIARecentes}

MISSÃO:
Escreva um resumo executivo curto (máx 4 linhas), direto e prático.

DIRETRIZES:
- NÃO invente dados.
- Use apenas o que estiver nos dados acima.
- Aponte riscos, pontos de atenção e foco imediato.
- Use markdown simples (negrito **texto**).`;

      // 2) Monta variáveis do prompt
      const agendaHojeStr = safeJson(dados.agendaHoje || []);
      const inicioSP = `${dados.hojeSP} 00:00`;
      const fimSP = `${dados.hojeSP} 23:59`;

      // ATAs IA: vem da coluna pauta (você confirmou)
      const atasIARecentesStr = (dados.ultimasRealizadas || [])
        .map((r) => {
          const pauta = normalizePautaText(r.pauta, 1500);
          return `- ${r.titulo || "(Sem título)"} (${String(r.data_hora || "").slice(0, 19)}):\n${pauta || "(sem pauta/ata IA)"}\n`;
        })
        .join("\n");

      const finalPrompt = promptTemplate
        .replace(/{data_sp}/g, dados.hojeSP)
        .replace(/{inicio_sp}/g, inicioSP)
        .replace(/{fim_sp}/g, fimSP)
        .replace(/{agendaHoje}/g, agendaHojeStr)
        .replace(/{acoesAbertas}/g, String(dados.acoesAbertas ?? 0))
        .replace(/{atasIARecentes}/g, atasIARecentesStr);

      // 3) Gera
      const result = await model.generateContent(finalPrompt);
      const texto = result.response.text();

      setResumoIA(texto);
      setIaStatus("active");
      setLastUpdate(new Date().toLocaleTimeString());

      localStorage.setItem("farol_ia_date", dados.hojeSP);
      localStorage.setItem("farol_ia_text", texto);
    } catch (error) {
      console.error("Erro IA:", error);
      setResumoIA(
        "⚠️ Satélite de IA temporariamente indisponível. Os dados manuais acima permanecem precisos."
      );
      setIaStatus("inactive");
    } finally {
      setLoadingIA(false);
    }
  };

  const forcarAtualizacao = () => {
    setLoadingIA(true);
    localStorage.removeItem("farol_ia_date");
    localStorage.removeItem("farol_ia_text");
    carregarDados();
  };

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto font-sans pb-20">
        {/* HEADER & STATUS BAR */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Painel de Comando</h1>
            <p className="text-gray-500 text-sm mt-1">
              Visão Estratégica & Tática Unificada
            </p>
          </div>

          {/* STATUS DA IA */}
          <div className="flex items-center gap-3 bg-white p-2 pr-4 rounded-full border border-gray-200 shadow-sm">
            <div
              className={`w-3 h-3 rounded-full ${
                iaStatus === "active"
                  ? "bg-green-500 animate-pulse"
                  : iaStatus === "checking"
                  ? "bg-yellow-400 animate-bounce"
                  : "bg-red-500"
              }`}
            />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {iaStatus === "active"
                  ? "Sistema Online"
                  : iaStatus === "checking"
                  ? "Analisando..."
                  : "Offline"}
              </span>
              {lastUpdate && (
                <span className="text-[10px] text-gray-500">
                  Atualizado às {lastUpdate}
                </span>
              )}
            </div>
            {iaStatus === "active" && (
              <BrainCircuit size={16} className="text-blue-600 ml-2 opacity-50" />
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div
            onClick={() => navigate("/gestao-acoes")}
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap size={60} />
            </div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
              Pendências
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-800">
                {stats.acoesAbertas}
              </span>
              <span className="text-xs text-red-500 font-medium">ações abertas</span>
            </div>
          </div>

          <div
            onClick={() => navigate("/central-reunioes")}
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Calendar size={60} />
            </div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
              Agenda Hoje
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-800">
                {stats.reunioesHoje}
              </span>
              <span className="text-xs text-blue-500 font-medium">eventos</span>
            </div>
          </div>
        </div>

        {/* IA + Atalhos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* CARTÃO IA */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 shadow-xl relative overflow-hidden h-full flex flex-col justify-between group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity duration-1000" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/20 p-2 rounded-lg">
                      <BrainCircuit className="text-blue-400" size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-wide">
                        Análise Executiva
                      </h2>
                      <p className="text-xs text-slate-400">
                        Gemini Flash • Monitoramento Ativo
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={forcarAtualizacao}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Forçar Reanálise"
                  >
                    <RefreshCw size={18} className={loadingIA ? "animate-spin" : ""} />
                  </button>
                </div>

                {loadingIA ? (
                  <div className="flex flex-col items-center justify-center py-10 text-blue-200/50">
                    <Loader2 size={32} className="animate-spin mb-3" />
                    <p className="text-sm animate-pulse">
                      Processando dados operacionais...
                    </p>
                  </div>
                ) : (
                  <div className="text-slate-300 text-sm leading-relaxed space-y-3">
                    {resumoIA.split("\n").map((line, idx) => {
                      if (line.startsWith("#")) {
                        return (
                          <h3 key={idx} className="text-white font-bold text-base mt-4 mb-2">
                            {line.replace(/^#+\s/, "")}
                          </h3>
                        );
                      }
                      if (!line.trim()) return null;

                      return (
                        <p key={idx}>
                          {line
                            .replace(/\*\*(.*?)\*\*/g, (match, p1) => `<strong>${p1}</strong>`)
                            .split(/<strong>(.*?)<\/strong>/g)
                            .map((part, i) =>
                              i % 2 === 1 ? (
                                <strong key={i} className="text-white font-semibold">
                                  {part}
                                </strong>
                              ) : (
                                part
                              )
                            )}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative z-10 mt-6 pt-6 border-t border-white/5 flex gap-4 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> CRM Conectado
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Agenda Sincronizada
                </span>
              </div>
            </div>
          </div>

          {/* MENUS RÁPIDOS */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
              Acesso Rápido
            </h3>

            <button
              onClick={() => navigate("/central-reunioes")}
              className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-between group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Calendar size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">Agenda Tática</h4>
                  <p className="text-xs text-gray-500">Ver calendário</p>
                </div>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-blue-600 transition-colors" size={18} />
            </button>

            <button
              onClick={() => navigate("/central-atas")}
              className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-between group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="bg-purple-50 text-purple-600 p-2 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Layers size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">Banco de Atas</h4>
                  <p className="text-xs text-gray-500">Histórico de decisões</p>
                </div>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-purple-600 transition-colors" size={18} />
            </button>

            <button
              onClick={() => navigate("/copiloto")}
              className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-red-400 hover:shadow-md transition-all flex items-center justify-between group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="bg-red-50 text-red-600 p-2 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <Zap size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">Gravar Reunião</h4>
                  <p className="text-xs text-gray-500">IA Copiloto</p>
                </div>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-red-600 transition-colors" size={18} />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Inicio;

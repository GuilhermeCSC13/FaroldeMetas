import React, { useEffect, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import { getGeminiFlash } from "../services/gemini";
import { 
  Calendar, ArrowRight, Zap, TrendingUp, BrainCircuit, Loader2, ExternalLink, Layers, CheckCircle, XCircle, Activity
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Inicio = () => {
  const navigate = useNavigate();
  const [resumoIA, setResumoIA] = useState("Carregando análise...");
  const [loadingIA, setLoadingIA] = useState(true);
  const [iaStatus, setIaStatus] = useState("checking");
  const [stats, setStats] = useState({ acoesAbertas: 0, reunioesHoje: 0, metasCriticas: 0 });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    // 1. Carrega KPIs
    const hoje = new Date().toISOString().split('T')[0];
    const { count: acoesCount } = await supabase.from('acoes').select('*', { count: 'exact', head: true }).eq('status', 'Aberta');
    const { count: reunioesCount } = await supabase.from('reunioes').select('*', { count: 'exact', head: true }).gte('data_hora', `${hoje}T00:00:00`).lte('data_hora', `${hoje}T23:59:59`);
    
    setStats({
      acoesAbertas: acoesCount || 0,
      reunioesHoje: reunioesCount || 0,
      metasCriticas: 3
    });

    // 2. Cache Inteligente
    const cacheDate = localStorage.getItem('farol_ia_date');
    const cacheText = localStorage.getItem('farol_ia_text');

    if (cacheDate === hoje && cacheText) {
      setResumoIA(cacheText);
      setIaStatus("active");
      setLoadingIA(false);
    } else {
      await gerarResumoIA(hoje);
    }
  };

  const gerarResumoIA = async (dataHoje) => {
    setIaStatus("checking");
    try {
      const agora = new Date().toISOString();

      // --- FILTRAGEM RIGOROSA ---
      // 1. Data deve ser no passado (lte agora)
      // 2. Status DEVE ser 'Realizada' (ignora 'Agendada')
      const { data: reunioesRealizadas } = await supabase
        .from('reunioes')
        .select('titulo, pauta, data_hora, status')
        .lte('data_hora', agora)
        .eq('status', 'Realizada') // <--- AQUI ESTÁ A TRAVA DE SEGURANÇA
        .order('data_hora', { ascending: false })
        .limit(3);

      const { data: acoesPendentes } = await supabase
        .from('acoes')
        .select('descricao, responsavel')
        .eq('status', 'Aberta')
        .limit(5);

      // --- BLOQUEIO DE IA (Se não tiver nada realizado, não chama a IA) ---
      if (!reunioesRealizadas || reunioesRealizadas.length === 0) {
        const textoPadrao = "Nenhuma reunião foi realizada e finalizada recentemente. O painel aguarda novas execuções para gerar insights.";
        setResumoIA(textoPadrao);
        setIaStatus("inactive"); // Fica cinza pois não usou IA
        setLoadingIA(false);
        // Salva esse estado vazio no cache para não tentar de novo hoje
        localStorage.setItem('farol_ia_date', dataHoje);
        localStorage.setItem('farol_ia_text', textoPadrao);
        return; 
      }

      // Se chegou aqui, TEM dados reais. Chama a IA.
      const model = getGeminiFlash();

      const prompt = `
        Você é um auditor de processos. Seja extremamente direto e literal.
        
        DADOS DE ENTRADA (Apenas o que aconteceu):
        - Reuniões Realizadas: ${JSON.stringify(reunioesRealizadas)}
        - Pendências: ${JSON.stringify(acoesPendentes)}

        INSTRUÇÕES:
        1. Resuma APENAS o conteúdo técnico das reuniões listadas acima.
        2. Se a pauta da reunião for "Teste" ou estiver vazia, diga apenas: "Registro de teste identificado no sistema."
        3. NÃO invente alinhamentos, estratégias ou nomes (como DBO/Oferta) se eles não estiverem explicitamente no JSON acima.
        4. Use tom formal e curto.
      `;

      const result = await model.generateContent(prompt);
      const texto = result.response.text();
      
      setResumoIA(texto);
      setIaStatus("active");
      
      localStorage.setItem('farol_ia_date', dataHoje);
      localStorage.setItem('farol_ia_text', texto);

    } catch (error) {
      console.error("Erro IA:", error);
      setResumoIA("Sistema operando. Aguardando novos dados.");
      setIaStatus("inactive");
    } finally {
      setLoadingIA(false);
    }
  };

  const forcarAtualizacao = () => {
    setLoadingIA(true);
    localStorage.removeItem('farol_ia_date');
    const hoje = new Date().toISOString().split('T')[0];
    gerarResumoIA(hoje);
  };

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto font-sans pb-20">
        
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Painel de Comando</h1>
            <p className="text-gray-500">Visão unificada da estratégia, tática e operação.</p>
          </div>

          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm transition-all duration-500 ${
            iaStatus === 'active' ? 'bg-green-50 border-green-200 text-green-700' :
            'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            {iaStatus === 'active' ? <CheckCircle size={16} /> : <Activity size={16} />}
            <span className="text-xs font-bold tracking-wider">
                {iaStatus === 'active' ? 'IA CONECTADA' : 'MONITORAMENTO'}
            </span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div onClick={() => navigate('/gestao-acoes')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-lg"><Zap size={24} /></div>
              <span className="text-3xl font-bold text-gray-800">{stats.acoesAbertas}</span>
            </div>
            <h3 className="font-semibold text-gray-700">Ações Pendentes</h3>
          </div>
          <div onClick={() => navigate('/central-reunioes')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={24} /></div>
              <span className="text-3xl font-bold text-gray-800">{stats.reunioesHoje}</span>
            </div>
            <h3 className="font-semibold text-gray-700">Reuniões Hoje</h3>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg"><TrendingUp size={24} /></div>
              <span className="text-3xl font-bold text-gray-800">{stats.metasCriticas}</span>
            </div>
            <h3 className="font-semibold text-gray-700">Metas em Alerta</h3>
          </div>
        </div>

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          
          {/* Resumo IA */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900 rounded-2xl p-8 shadow-xl relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
              
              <div className="relative z-10 text-white">
                <div className="flex items-center gap-3 mb-6">
                  <BrainCircuit className="text-blue-400" />
                  <h2 className="text-xl font-bold tracking-wide">Resumo Executivo</h2>
                </div>
                
                {loadingIA ? (
                  <div className="flex flex-col items-center justify-center h-40 text-blue-200/50 animate-pulse">
                    <Loader2 size={32} className="animate-spin mb-2" />
                    <p className="text-sm">Analisando dados...</p>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-p:text-slate-300 prose-sm max-w-none">
                     {resumoIA.split('\n').map((line, idx) => (
                        <p key={idx} className="mb-2 leading-relaxed">
                            {line.replace(/\*\*(.*?)\*\*/g, (match, p1) => `<strong>${p1}</strong>`).split(/<strong>(.*?)<\/strong>/g).map((part, i) => 
                                i % 2 === 1 ? <strong key={i} className="text-white font-bold">{part}</strong> : part
                            )}
                        </p>
                     ))}
                  </div>
                )}
                
                <div className="mt-6 pt-6 border-t border-white/10 flex justify-end">
                    <button onClick={forcarAtualizacao} className="text-xs text-blue-400 hover:text-white transition-colors flex items-center gap-1">
                        <Activity size={12}/> Atualizar
                    </button>
                </div>
              </div>
            </div>
          </div>

          {/* Atalhos */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 mb-4 px-1">Acesso Rápido</h3>
            <button onClick={() => navigate('/central-reunioes')} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition-all flex items-center justify-between group text-left">
              <div><h4 className="font-bold text-gray-800">Agenda Tática</h4></div>
              <ArrowRight className="text-gray-300 group-hover:text-blue-600" size={20} />
            </button>
            <button onClick={() => navigate('/central-atas')} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition-all flex items-center justify-between group text-left">
              <div><h4 className="font-bold text-gray-800">Banco de Atas</h4></div>
              <ArrowRight className="text-gray-300 group-hover:text-blue-600" size={20} />
            </button>
            <button onClick={() => navigate('/copiloto')} className="w-full bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm hover:bg-red-100 transition-all flex items-center justify-between group text-left">
              <div>
                <h4 className="font-bold text-red-800">Gravar Reunião</h4>
                <p className="text-xs text-red-600">Copiloto IA</p>
              </div>
              <Zap size={16} className="text-red-600" />
            </button>
          </div>
        </div>
        
        {/* CRM Link */}
        <div className="mt-8 bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-xl p-8 text-white flex flex-col md:flex-row items-center justify-between shadow-lg relative overflow-hidden">
            <div className="z-10 mb-6 md:mb-0">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-3"><Layers className="text-indigo-300" /> Sistema de Frota & Avarias</h2>
                <p className="text-indigo-200 text-sm">Acesse o ambiente exclusivo para gestão de tratativas.</p>
            </div>
            <a href="https://inovequatai.onrender.com/" target="_blank" rel="noopener noreferrer" className="z-10 bg-white text-indigo-900 px-6 py-3 rounded-lg font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-md">
                Acessar Inove Quatai <ExternalLink size={18} />
            </a>
        </div>
      </div>
    </Layout>
  );
};
export default Inicio;

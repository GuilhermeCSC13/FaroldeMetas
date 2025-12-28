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
  const [resumoIA, setResumoIA] = useState("");
  const [loadingIA, setLoadingIA] = useState(true);
  const [iaStatus, setIaStatus] = useState("checking");
  const [stats, setStats] = useState({ acoesAbertas: 0, reunioesHoje: 0, metasCriticas: 0 });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    // 1. Carrega KPIs (Dados sempre frescos)
    const hoje = new Date().toISOString().split('T')[0];
    const { count: acoesCount } = await supabase.from('acoes').select('*', { count: 'exact', head: true }).eq('status', 'Aberta');
    const { count: reunioesCount } = await supabase.from('reunioes').select('*', { count: 'exact', head: true }).gte('data_hora', `${hoje}T00:00:00`).lte('data_hora', `${hoje}T23:59:59`);
    
    setStats({
      acoesAbertas: acoesCount || 0,
      reunioesHoje: reunioesCount || 0,
      metasCriticas: 3 // Exemplo estático
    });

    // 2. Cache da IA (Para não gastar cota e ser rápido)
    const cacheDate = localStorage.getItem('farol_ia_date');
    const cacheText = localStorage.getItem('farol_ia_text');

    if (cacheDate === hoje && cacheText) {
      // Se já tem resumo de hoje, usa ele
      setResumoIA(cacheText);
      setIaStatus("active");
      setLoadingIA(false);
    } else {
      // Se é um dia novo, gera novo resumo
      await gerarResumoIA(hoje);
    }
  };

  const gerarResumoIA = async (dataHoje) => {
    setIaStatus("checking");
    try {
      // Busca dados REAIS
      const { data: ultimasReunioes } = await supabase.from('reunioes').select('titulo, pauta, data_hora').order('data_hora', { ascending: false }).limit(3);
      const { data: acoesPendentes } = await supabase.from('acoes').select('descricao, responsavel').eq('status', 'Aberta').limit(5);

      // --- DEBUG: Veja no console o que a IA está lendo ---
      console.log("🔍 DADOS PARA IA:", { ultimasReunioes, acoesPendentes });

      const model = getGeminiFlash();

      // PROMPT BLINDADO
      const prompt = `
        Atue como um Diretor de Operações. Analise este painel:
        
        DADOS REAIS:
        - Reuniões Recentes: ${JSON.stringify(ultimasReunioes)}
        - Pendências Críticas: ${JSON.stringify(acoesPendentes)}

        REGRAS:
        1. Baseie-se APENAS nos dados acima. Se não houver reuniões, diga "Sem reuniões recentes registradas".
        2. Não invente nomes de reuniões que não estão na lista (como "DBO" ou "Oferta x Demanda" se não existirem).
        3. Seja breve (máximo 3 parágrafos curtos).
        4. Use negrito para destacar pontos chave.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const texto = response.text();
      
      setResumoIA(texto);
      setIaStatus("active");
      
      // Salva no Cache
      localStorage.setItem('farol_ia_date', dataHoje);
      localStorage.setItem('farol_ia_text', texto);

    } catch (error) {
      console.error("Erro IA:", error);
      setResumoIA("Não foi possível gerar a análise no momento.");
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
        
        {/* Header e Status IA */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Painel de Comando</h1>
            <p className="text-gray-500">Visão unificada da estratégia, tática e operação.</p>
          </div>

          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm transition-all duration-500 ${
            iaStatus === 'active' ? 'bg-green-50 border-green-200 text-green-700' :
            iaStatus === 'inactive' ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            {iaStatus === 'active' && <CheckCircle size={16} className="text-green-600" />}
            {iaStatus === 'inactive' && <XCircle size={16} className="text-red-600" />}
            {iaStatus === 'checking' && <Activity size={16} className="animate-pulse" />}
            <span className="text-xs font-bold tracking-wider">
                {iaStatus === 'active' ? 'IA CONECTADA' : iaStatus === 'inactive' ? 'IA OFF-LINE' : 'CONECTANDO...'}
            </span>
          </div>
        </div>

        {/* Cards KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div onClick={() => navigate('/gestao-acoes')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-lg group-hover:bg-red-100 transition-colors"><Zap size={24} /></div>
              <span className="text-3xl font-bold text-gray-800">{stats.acoesAbertas}</span>
            </div>
            <h3 className="font-semibold text-gray-700">Ações Pendentes</h3>
          </div>
          <div onClick={() => navigate('/central-reunioes')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors"><Calendar size={24} /></div>
              <span className="text-3xl font-bold text-gray-800">{stats.reunioesHoje}</span>
            </div>
            <h3 className="font-semibold text-gray-700">Reuniões Hoje</h3>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition-colors"><TrendingUp size={24} /></div>
              <span className="text-3xl font-bold text-gray-800">{stats.metasCriticas}</span>
            </div>
            <h3 className="font-semibold text-gray-700">Metas em Alerta</h3>
          </div>
        </div>

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          
          {/* Card IA */}
          <div className="lg:col-span-2">
            <div className={`rounded-2xl p-8 shadow-xl relative overflow-hidden h-full transition-colors duration-500 ${iaStatus === 'inactive' ? 'bg-slate-800' : 'bg-gradient-to-br from-slate-900 to-slate-800'}`}>
              <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none transition-colors duration-500 ${iaStatus === 'inactive' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
              
              <div className="relative z-10 text-white">
                <div className="flex items-center gap-3 mb-6">
                  <BrainCircuit className={iaStatus === 'inactive' ? "text-red-400" : "text-blue-400"} />
                  <h2 className="text-xl font-bold tracking-wide">Resumo Executivo Diário</h2>
                </div>
                
                {loadingIA ? (
                  <div className="flex flex-col items-center justify-center h-40 text-blue-200/50 animate-pulse">
                    <Loader2 size={32} className="animate-spin mb-2" />
                    <p className="text-sm">Processando dados...</p>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-p:text-slate-300 prose-strong:text-white prose-sm max-w-none">
                     {resumoIA.split('\n').map((line, idx) => (
                        <p key={idx} className="mb-2 leading-relaxed">
                            {line.replace(/\*\*(.*?)\*\*/g, (match, p1) => `<strong>${p1}</strong>`).split(/<strong>(.*?)<\/strong>/g).map((part, i) => 
                                i % 2 === 1 ? <strong key={i} className="text-white font-bold">{part}</strong> : part
                            )}
                        </p>
                     ))}
                  </div>
                )}
                
                <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
                    <p className="text-xs text-slate-400">
                        {iaStatus === 'active' ? 'Inteligência Ativa • Gemini 1.5' : 'Modo Offline'}
                    </p>
                    <button onClick={forcarAtualizacao} className="text-xs text-blue-400 hover:text-white transition-colors flex items-center gap-1">
                        <Activity size={12}/> Atualizar Análise
                    </button>
                </div>
              </div>
            </div>
          </div>

          {/* Atalhos Rápidos */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 mb-4 px-1">Acesso Rápido</h3>
            <button onClick={() => navigate('/planejamento/operacao')} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between group text-left">
              <div><h4 className="font-bold text-gray-800">Farol da Operação</h4></div>
              <ArrowRight className="text-gray-300 group-hover:text-blue-600 transition-colors" size={20} />
            </button>
            <button onClick={() => navigate('/manutencao')} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between group text-left">
              <div><h4 className="font-bold text-gray-800">Farol da Manutenção</h4></div>
              <ArrowRight className="text-gray-300 group-hover:text-blue-600 transition-colors" size={20} />
            </button>
            <button onClick={() => navigate('/copiloto')} className="w-full bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm hover:bg-red-100 transition-all flex items-center justify-between group text-left">
              <div>
                <h4 className="font-bold text-red-800">Iniciar Gravação IA</h4>
                <p className="text-xs text-red-600">Para reuniões agora</p>
              </div>
              <div className="bg-red-200 p-2 rounded-full text-red-700"><Zap size={16} fill="currentColor" /></div>
            </button>
          </div>
        </div>

        {/* Banner CRM Externo */}
        <div className="mt-8 bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-xl p-8 text-white flex flex-col md:flex-row items-center justify-between shadow-lg border border-indigo-700 relative overflow-hidden group hover:shadow-2xl transition-all">
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500 rounded-full blur-[100px] opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity"></div>
            <div className="z-10 mb-6 md:mb-0 max-w-2xl">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-3"><Layers className="text-indigo-300" /> Sistema de Tratativas & Avarias</h2>
                <p className="text-indigo-200 text-sm md:text-base leading-relaxed">Para acessar Tratativas, Controle de Avarias e Intervenções MKBF, utilize o ambiente exclusivo de gestão de frota.</p>
            </div>
            <a href="https://inovequatai.onrender.com/" target="_blank" rel="noopener noreferrer" className="z-10 whitespace-nowrap bg-white text-indigo-900 px-8 py-4 rounded-lg font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-md hover:scale-105 active:scale-95">
                Acessar Inove Quatai <ExternalLink size={18} />
            </a>
        </div>
      </div>
    </Layout>
  );
};
export default Inicio;

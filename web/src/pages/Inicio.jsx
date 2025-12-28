import React, { useEffect, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import { getGeminiFlash } from "../services/gemini";
import { 
  Calendar, 
  ArrowRight, 
  Zap, 
  TrendingUp,
  BrainCircuit,
  Loader2,
  ExternalLink, // <--- NOVO ÍCONE
  Layers        // <--- NOVO ÍCONE
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Inicio = () => {
  const navigate = useNavigate();
  const [resumoIA, setResumoIA] = useState("");
  const [loadingIA, setLoadingIA] = useState(true);
  const [stats, setStats] = useState({ acoesAbertas: 0, reunioesHoje: 0, metasCriticas: 0 });

  useEffect(() => {
    carregarDadosEGerarResumo();
  }, []);

  const carregarDadosEGerarResumo = async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const { count: acoesCount } = await supabase.from('acoes').select('*', { count: 'exact', head: true }).eq('status', 'Aberta');
      const { count: reunioesCount } = await supabase.from('reunioes').select('*', { count: 'exact', head: true }).gte('data_hora', `${hoje}T00:00:00`).lte('data_hora', `${hoje}T23:59:59`);
      
      setStats({
        acoesAbertas: acoesCount || 0,
        reunioesHoje: reunioesCount || 0,
        metasCriticas: 3
      });

      const { data: ultimasReunioes } = await supabase.from('reunioes').select('titulo, pauta, data_hora').order('data_hora', { ascending: false }).limit(3);
      const { data: acoesPendentes } = await supabase.from('acoes').select('descricao, responsavel').eq('status', 'Aberta').limit(5);

      const model = getGeminiFlash();

      const prompt = `
        Atue como um Diretor de Operações.
        Escreva um "Resumo Executivo do Dia" (máximo 3 parágrafos curtos) para o gestor.
        
        Dados:
        - Reuniões recentes: ${JSON.stringify(ultimasReunioes)}
        - Ações críticas pendentes: ${JSON.stringify(acoesPendentes)}
        
        Estilo: Profissional, direto, focado em riscos. Use markdown (negrito) para destaques.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setResumoIA(response.text());

    } catch (error) {
      console.error(error);
      setResumoIA("Não foi possível gerar o resumo de inteligência.");
    } finally {
      setLoadingIA(false);
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto font-sans pb-20">
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Painel de Comando</h1>
          <p className="text-gray-500">Visão unificada da estratégia, tática e operação.</p>
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

          <div onClick={() => navigate('/reunioes-calendario')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
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
          
          {/* IA Resumo */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-8 shadow-xl relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <BrainCircuit className="text-blue-400" />
                  <h2 className="text-xl font-bold tracking-wide">Resumo Executivo Diário (IA)</h2>
                </div>
                {loadingIA ? (
                  <div className="flex flex-col items-center justify-center h-40 text-blue-200/50 animate-pulse">
                    <Loader2 size={32} className="animate-spin mb-2" />
                    <p className="text-sm">Analisando dados táticos...</p>
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
                    <p className="text-xs text-slate-400">Baseado nas últimas atas e KPIs.</p>
                    <button onClick={carregarDadosEGerarResumo} className="text-xs text-blue-400 hover:text-white transition-colors">Atualizar</button>
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

        {/* --- NOVO BANNER DE ACESSO AO CRM EXTERNO --- */}
        <div className="mt-8 bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-xl p-8 text-white flex flex-col md:flex-row items-center justify-between shadow-lg border border-indigo-700 relative overflow-hidden group hover:shadow-2xl transition-all">
            
            {/* Efeito de Fundo */}
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500 rounded-full blur-[100px] opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity"></div>

            <div className="z-10 mb-6 md:mb-0 max-w-2xl">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                    <Layers className="text-indigo-300" />
                    Sistema de Tratativas & Avarias
                </h2>
                <p className="text-indigo-200 text-sm md:text-base leading-relaxed">
                    Para acessar Tratativas, Controle de Avarias e Intervenções MKBF, utilize o ambiente exclusivo de gestão de frota.
                </p>
            </div>

            <a 
                href="https://inovequatai.onrender.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="z-10 whitespace-nowrap bg-white text-indigo-900 px-8 py-4 rounded-lg font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-md hover:scale-105 active:scale-95"
            >
                Acessar Inove Quatai
                <ExternalLink size={18} />
            </a>
        </div>

      </div>
    </Layout>
  );
};
export default Inicio;

import React, { useEffect, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  BarChart3, 
  Calendar, 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  TrendingUp,
  BrainCircuit,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// --- CONFIGURAÇÃO DA IA ---
const API_KEY = "AIzaSyBHbALir0Cpj2yUIHacHOibi3iFIeqhVDs"; // <--- COLOQUE SUA CHAVE AQUI

const Inicio = () => {
  const navigate = useNavigate();
  const [resumoIA, setResumoIA] = useState("");
  const [loadingIA, setLoadingIA] = useState(true);
  
  // Dados rápidos para os cards
  const [stats, setStats] = useState({
    acoesAbertas: 0,
    reunioesHoje: 0,
    metasCriticas: 0
  });

  useEffect(() => {
    carregarDadosEGerarResumo();
  }, []);

  const carregarDadosEGerarResumo = async () => {
    try {
      // 1. Buscar estatísticas rápidas
      const hoje = new Date().toISOString().split('T')[0];
      
      const { count: acoesCount } = await supabase.from('acoes').select('*', { count: 'exact', head: true }).eq('status', 'Aberta');
      const { count: reunioesCount } = await supabase.from('reunioes').select('*', { count: 'exact', head: true }).gte('data_hora', `${hoje}T00:00:00`).lte('data_hora', `${hoje}T23:59:59`);
      
      // Simulação de metas críticas (idealmente viria de uma query complexa de farol)
      setStats({
        acoesAbertas: acoesCount || 0,
        reunioesHoje: reunioesCount || 0,
        metasCriticas: 3 // Exemplo estático ou buscar do banco
      });

      // 2. Buscar dados para o Resumo da IA
      const { data: ultimasReunioes } = await supabase.from('reunioes').select('titulo, pauta, data_hora').order('data_hora', { ascending: false }).limit(3);
      const { data: acoesPendentes } = await supabase.from('acoes').select('descricao, responsavel').eq('status', 'Aberta').limit(5);

      // 3. Gerar Texto com Gemini
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        Atue como um Diretor de Operações analisando o painel de controle.
        Escreva um "Resumo Executivo do Dia" (máximo 3 parágrafos curtos) para o gestor.
        
        Dados atuais:
        - Reuniões recentes: ${JSON.stringify(ultimasReunioes)}
        - Ações críticas pendentes: ${JSON.stringify(acoesPendentes)}
        
        Estilo: Profissional, direto ao ponto, focado em riscos e próximas prioridades.
        Use formatação markdown (negrito) para destacar pontos chaves.
        Não use saudações genéricas. Comece direto com a análise.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setResumoIA(response.text());

    } catch (error) {
      console.error("Erro ao gerar resumo:", error);
      setResumoIA("Não foi possível gerar o resumo de inteligência no momento. Verifique a conexão.");
    } finally {
      setLoadingIA(false);
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto font-sans">
        
        {/* Header Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Painel de Comando</h1>
          <p className="text-gray-500">
            Visão unificada da estratégia, tática e operação da Quatai.
          </p>
        </div>

        {/* Cards de KPIs Rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div onClick={() => navigate('/gestao-acoes')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-lg group-hover:bg-red-100 transition-colors">
                <Zap size={24} />
              </div>
              <span className="text-3xl font-bold text-gray-800">{stats.acoesAbertas}</span>
            </div>
            <h3 className="font-semibold text-gray-700">Ações Pendentes</h3>
            <p className="text-xs text-gray-400 mt-1">Necessitam atenção imediata</p>
          </div>

          <div onClick={() => navigate('/reunioes-calendario')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                <Calendar size={24} />
              </div>
              <span className="text-3xl font-bold text-gray-800">{stats.reunioesHoje}</span>
            </div>
            <h3 className="font-semibold text-gray-700">Reuniões Hoje</h3>
            <p className="text-xs text-gray-400 mt-1">Agendadas no calendário</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition-colors">
                <TrendingUp size={24} />
              </div>
              <span className="text-3xl font-bold text-gray-800">{stats.metasCriticas}</span>
            </div>
            <h3 className="font-semibold text-gray-700">Metas em Alerta</h3>
            <p className="text-xs text-gray-400 mt-1">Indicadores fora da faixa ideal</p>
          </div>
        </div>

        {/* Seção Inteligência Artificial */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Coluna Esquerda: Resumo IA */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
              {/* Efeito de fundo */}
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
                     {/* Renderização segura do Markdown simples */}
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
                    <p className="text-xs text-slate-400">Gerado com base nas últimas atas e KPIs.</p>
                    <button onClick={carregarDadosEGerarResumo} className="text-xs text-blue-400 hover:text-white transition-colors">Atualizar Análise</button>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Atalhos */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 mb-4 px-1">Acesso Rápido</h3>
            
            <button onClick={() => navigate('/planejamento/operacao')} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between group text-left">
              <div>
                <h4 className="font-bold text-gray-800">Farol da Operação</h4>
                <p className="text-xs text-gray-500">Acompanhar consumo e avarias</p>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-blue-600 transition-colors" size={20} />
            </button>

            <button onClick={() => navigate('/manutencao')} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between group text-left">
              <div>
                <h4 className="font-bold text-gray-800">Farol da Manutenção</h4>
                <p className="text-xs text-gray-500">Disponibilidade e corretivas</p>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-blue-600 transition-colors" size={20} />
            </button>

            <button onClick={() => navigate('/copiloto')} className="w-full bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm hover:bg-red-100 transition-all flex items-center justify-between group text-left">
              <div>
                <h4 className="font-bold text-red-800">Iniciar Gravação IA</h4>
                <p className="text-xs text-red-600">Para reuniões agora</p>
              </div>
              <div className="bg-red-200 p-2 rounded-full text-red-700">
                 <Zap size={16} fill="currentColor" />
              </div>
            </button>
          </div>

        </div>
      </div>
    </Layout>
  );
};

export default Inicio;

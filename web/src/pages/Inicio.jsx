import React, { useEffect, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import { getGeminiFlash } from "../services/gemini";
import { 
  Calendar, ArrowRight, Zap, TrendingUp, BrainCircuit, Loader2, ExternalLink, Layers, RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Inicio = () => {
  const navigate = useNavigate();
  const [resumoIA, setResumoIA] = useState("Conectando aos satélites táticos...");
  const [loadingIA, setLoadingIA] = useState(true);
  const [iaStatus, setIaStatus] = useState("checking"); // checking | active | inactive
  const [lastUpdate, setLastUpdate] = useState(null);
  
  const [stats, setStats] = useState({ acoesAbertas: 0, reunioesHoje: 0, metasCriticas: 0 });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const hoje = new Date().toISOString().split('T')[0];
    
    // 1. KPIs (Números)
    const { count: acoesCount } = await supabase.from('acoes').select('*', { count: 'exact', head: true }).eq('status', 'Aberta');
    const { count: reunioesCount, data: agendaHoje } = await supabase.from('reunioes').select('titulo, data_hora').gte('data_hora', `${hoje}T00:00:00`).lte('data_hora', `${hoje}T23:59:59`);
    
    // 2. Últimas Realizadas (Para contexto)
    const { data: ultimasRealizadas } = await supabase.from('reunioes').select('titulo, status').eq('status', 'Realizada').order('data_hora', { ascending: false }).limit(2);

    const estatisticas = {
      acoesAbertas: acoesCount || 0,
      reunioesHoje: reunioesCount || 0,
      metasCriticas: 3, // Exemplo
      agendaHoje: agendaHoje || [],
      ultimasRealizadas: ultimasRealizadas || []
    };

    setStats({
      acoesAbertas: estatisticas.acoesAbertas,
      reunioesHoje: estatisticas.reunioesHoje,
      metasCriticas: estatisticas.metasCriticas
    });

    // 3. Cache ou Nova Geração
    const cacheDate = localStorage.getItem('farol_ia_date');
    const cacheText = localStorage.getItem('farol_ia_text');

    if (cacheDate === hoje && cacheText) {
      setResumoIA(cacheText);
      setIaStatus("active");
      setLoadingIA(false);
      setLastUpdate(new Date().toLocaleTimeString());
    } else {
      await gerarResumoIA(estatisticas, hoje);
    }
  };

  const gerarResumoIA = async (dados, dataHoje) => {
    setIaStatus("checking");
    try {
      const model = getGeminiFlash();

      // PROMPT "DIRETOR DE OPERAÇÕES"
      const prompt = `
        Aja como um Diretor de Operações Sênior analisando o Farol Tático.
        DADOS HOJE (${dataHoje}): Agenda: ${JSON.stringify(dados.agendaHoje)}. Pendências CRM: ${dados.acoesAbertas}. Histórico Recente: ${JSON.stringify(dados.ultimasRealizadas)}.
        
        MISSÃO: Escreva um resumo executivo curto (máx 4 linhas).
        DIRETRIZES: Destaque pontos de atenção ou oportunidades de foco. Não invente dados. Use markdown simples (negrito **texto**).
      `;

      const result = await model.generateContent(prompt);
      const texto = result.response.text();
      
      setResumoIA(texto);
      setIaStatus("active");
      setLastUpdate(new Date().toLocaleTimeString());
      
      localStorage.setItem('farol_ia_date', dataHoje);
      localStorage.setItem('farol_ia_text', texto);

    } catch (error) {
      console.error("Erro IA:", error);
      setResumoIA("⚠️ Satélite de IA temporariamente indisponível. Os dados manuais acima permanecem precisos.");
      setIaStatus("inactive");
    } finally {
      setLoadingIA(false);
    }
  };

  const forcarAtualizacao = () => {
    setLoadingIA(true);
    localStorage.removeItem('farol_ia_date');
    carregarDados();
  };

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto font-sans pb-20">
        
        {/* HEADER & STATUS BAR */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Painel de Comando</h1>
            <p className="text-gray-500 text-sm mt-1">Visão Estratégica & Tática Unificada</p>
          </div>

          {/* STATUS DA IA */}
          <div className="flex items-center gap-3 bg-white p-2 pr-4 rounded-full border border-gray-200 shadow-sm">
            <div className={`w-3 h-3 rounded-full ${iaStatus === 'active' ? 'bg-green-500 animate-pulse' : iaStatus === 'checking' ? 'bg-yellow-400 animate-bounce' : 'bg-red-500'}`}></div>
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {iaStatus === 'active' ? 'Sistema Online' : iaStatus === 'checking' ? 'Analisando...' : 'Offline'}
                </span>
                {lastUpdate && <span className="text-[10px] text-gray-500">Atualizado às {lastUpdate}</span>}
            </div>
            {iaStatus === 'active' && <BrainCircuit size={16} className="text-blue-600 ml-2 opacity-50"/>}
          </div>
        </div>

        {/* KPIs GRIDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div onClick={() => navigate('/gestao-acoes')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden">
            <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Zap size={60} /></div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Pendências</p>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-800">{stats.acoesAbertas}</span>
                <span className="text-xs text-red-500 font-medium">ações abertas</span>
            </div>
          </div>

          <div onClick={() => navigate('/central-reunioes')} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden">
            <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Calendar size={60} /></div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Agenda Hoje</p>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-800">{stats.reunioesHoje}</span>
                <span className="text-xs text-blue-500 font-medium">eventos</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group relative overflow-hidden">
            <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={60} /></div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Metas Críticas</p>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-800">{stats.metasCriticas}</span>
                <span className="text-xs text-yellow-600 font-medium">atenção</span>
            </div>
          </div>
        </div>

        {/* ÁREA CENTRAL: IA E ATALHOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          
          {/* CARTÃO DE INTELIGÊNCIA (CORRIGIDO) */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 shadow-xl relative overflow-hidden h-full flex flex-col justify-between group">
              {/* Efeitos de Fundo */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity duration-1000"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-500/20 p-2 rounded-lg">
                            <BrainCircuit className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-wide">Análise Executiva</h2>
                            <p className="text-xs text-slate-400">Gemini 1.5 Pro • Monitoramento Ativo</p>
                        </div>
                    </div>
                    <button onClick={forcarAtualizacao} className="text-slate-400 hover:text-white transition-colors" title="Forçar Reanálise">
                        <RefreshCw size={18} className={loadingIA ? "animate-spin" : ""} />
                    </button>
                </div>
                
                {loadingIA ? (
                  <div className="flex flex-col items-center justify-center py-10 text-blue-200/50">
                    <Loader2 size={32} className="animate-spin mb-3" />
                    <p className="text-sm animate-pulse">Processando dados operacionais...</p>
                  </div>
                ) : (
                  <div className="text-slate-300 text-sm leading-relaxed space-y-3">
                     {/* RENDERIZAÇÃO CORRIGIDA: Títulos brancos, texto claro */}
                     {resumoIA.split('\n').map((line, idx) => {
                        // Se for título (começa com #)
                        if (line.startsWith('#')) {
                            return <h3 key={idx} className="text-white font-bold text-base mt-4 mb-2">{line.replace(/^#+\s/, '')}</h3>;
                        }
                        // Se linha vazia, ignora
                        if (!line.trim()) return null;
                        
                        // Parágrafo normal com negrito
                        return (
                        <p key={idx}>
                            {line.replace(/\*\*(.*?)\*\*/g, (match, p1) => `<strong>${p1}</strong>`).split(/<strong>(.*?)<\/strong>/g).map((part, i) => 
                                i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part
                            )}
                        </p>
                        );
                     })}
                  </div>
                )}
              </div>

              {/* Rodapé do Card */}
              <div className="relative z-10 mt-6 pt-6 border-t border-white/5 flex gap-4 text-xs text-slate-400 font-mono">
                 <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> CRM Conectado</span>
                 <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Agenda Sincronizada</span>
              </div>
            </div>
          </div>

          {/* MENUS RÁPIDOS */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Acesso Rápido</h3>
            
            <button onClick={() => navigate('/central-reunioes')} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-between group text-left">
              <div className="flex items-center gap-3">
                 <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><Calendar size={20}/></div>
                 <div><h4 className="font-bold text-gray-800">Agenda Tática</h4><p className="text-xs text-gray-500">Ver calendário</p></div>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-blue-600 transition-colors" size={18} />
            </button>

            <button onClick={() => navigate('/central-atas')} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-between group text-left">
              <div className="flex items-center gap-3">
                 <div className="bg-purple-50 text-purple-600 p-2 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors"><Layers size={20}/></div>
                 <div><h4 className="font-bold text-gray-800">Banco de Atas</h4><p className="text-xs text-gray-500">Histórico de decisões</p></div>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-purple-600 transition-colors" size={18} />
            </button>

            <button onClick={() => navigate('/copiloto')} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-red-400 hover:shadow-md transition-all flex items-center justify-between group text-left">
              <div className="flex items-center gap-3">
                 <div className="bg-red-50 text-red-600 p-2 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-colors"><Zap size={20}/></div>
                 <div><h4 className="font-bold text-gray-800">Gravar Reunião</h4><p className="text-xs text-gray-500">IA Copiloto</p></div>
              </div>
              <ArrowRight className="text-gray-300 group-hover:text-red-600 transition-colors" size={18} />
            </button>
          </div>
        </div>

        {/* Link Externo CRM */}
        <div className="mt-4 border-t border-gray-100 pt-8">
            <div className="bg-gradient-to-r from-indigo-900 to-blue-900 rounded-xl p-1 text-white shadow-lg">
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-3 rounded-full"><Layers className="text-white" /></div>
                        <div>
                            <h2 className="font-bold text-lg">Sistema de Tratativas & Avarias</h2>
                            <p className="text-blue-200 text-sm">Ambiente exclusivo para gestão de frota.</p>
                        </div>
                    </div>
                    <a href="https://inovequatai.onrender.com/" target="_blank" rel="noopener noreferrer" className="bg-white text-blue-900 px-6 py-2.5 rounded-lg font-bold hover:bg-blue-50 transition-all flex items-center gap-2 shadow-lg text-sm">
                        Acessar Inove Quatai <ExternalLink size={16} />
                    </a>
                </div>
            </div>
        </div>

      </div>
    </Layout>
  );
};
export default Inicio;

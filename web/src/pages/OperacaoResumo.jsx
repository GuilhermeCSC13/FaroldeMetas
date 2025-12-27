import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { AlertTriangle, TrendingUp, CheckCircle, Target, Settings } from 'lucide-react';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral'; // <--- Importação do novo componente

const OperacaoResumo = () => {
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false); // <--- Estado para abrir o modal
  const [metrics, setMetrics] = useState({
    scoreAtual: 0,
    metasBatidas: 0,
    criticos: 0,
    totalMetas: 0
  });
  const [chartData, setChartData] = useState([]);
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Busca Metas (Definições)
      const { data: metas } = await supabase
        .from('metas_farol')
        .select('*')
        .in('area_id', [4, 5]);

      // 2. Busca Metas Mensais (Alvos)
      const { data: alvos } = await supabase
        .from('metas_farol_mensal')
        .select('*')
        .eq('ano', 2026);

      // 3. Busca Resultados (Realizado)
      const { data: realizados } = await supabase
        .from('resultados_farol')
        .select('*')
        .eq('ano', 2026);

      if (!metas || !alvos || !realizados) {
        setLoading(false);
        return;
      }

      // --- PROCESSAMENTO (Exemplo com Janeiro) ---
      const MES_ATUAL = 1; 
      let somaScore = 0;
      let countBatidas = 0;
      let countCriticas = 0;
      const listaAlertas = [];

      metas.forEach(meta => {
        const alvo = alvos.find(a => a.meta_id === meta.id && a.mes === MES_ATUAL)?.valor_meta;
        const real = realizados.find(r => r.meta_id === meta.id && r.mes === MES_ATUAL)?.valor_realizado;
        
        const { score, faixa } = calculateScore(alvo, real, meta.tipo_comparacao, meta.peso);
        
        somaScore += score;
        if (faixa === 1) countBatidas++;
        if (faixa === 5) {
          countCriticas++;
          listaAlertas.push({
            nome: meta.nome_meta || meta.indicador,
            alvo: alvo,
            real: real,
            unidade: meta.unidade
          });
        }
      });

      // Dados para o Gráfico (Jan-Jun)
      const historico = [1, 2, 3, 4, 5, 6].map(mesId => {
        let scoreMes = 0;
        metas.forEach(meta => {
          const alvo = alvos.find(a => a.meta_id === meta.id && a.mes === mesId)?.valor_meta;
          const real = realizados.find(r => r.meta_id === meta.id && r.mes === mesId)?.valor_realizado;
          const { score } = calculateScore(alvo, real, meta.tipo_comparacao, meta.peso);
          scoreMes += score;
        });
        
        const mesesLabel = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
        return {
          name: mesesLabel[mesId - 1],
          score: scoreMes.toFixed(1)
        };
      });

      setMetrics({
        scoreAtual: somaScore.toFixed(1),
        metasBatidas: countBatidas,
        criticos: countCriticas,
        totalMetas: metas.length
      });
      setChartData(historico);
      setAlertas(listaAlertas);

    } catch (error) {
      console.error("Erro Dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = (meta, realizado, tipo, pesoTotal) => {
    if (!meta || realizado === null || realizado === '' || isNaN(realizado)) return { score: 0, faixa: 0 };
    
    const r = parseFloat(realizado);
    const m = parseFloat(meta);
    if (m === 0) return { score: 0, faixa: 0 };

    let atingimento = 0;
    if (tipo === '>=' || tipo === 'maior') {
      atingimento = r / m;
    } else {
      atingimento = 1 + ((m - r) / m);
    }

    let multiplicador = 0;
    let faixa = 5;

    if (atingimento >= 1.0) { multiplicador = 1.0; faixa = 1; }
    else if (atingimento >= 0.99) { multiplicador = 0.75; faixa = 2; }
    else if (atingimento >= 0.98) { multiplicador = 0.50; faixa = 3; }
    else if (atingimento >= 0.97) { multiplicador = 0.25; faixa = 4; }
    else { multiplicador = 0.0; faixa = 5; }

    return { score: parseFloat(pesoTotal) * multiplicador, faixa };
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Visão Geral — Operação</h2>
          <p className="text-sm text-gray-500">Acompanhamento consolidado de performance (Jan/2026)</p>
        </div>
        <div className="flex items-center gap-3">
             {/* BOTÃO DE CONFIGURAÇÃO NOVO */}
             <button 
               onClick={() => setShowConfig(true)}
               className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors shadow-sm"
             >
               <Settings size={16} /> Configurar Metas e Rotinas
             </button>
             
             <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                Última atualização: Hoje
             </span>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-gray-400">Carregando indicadores...</div>
      ) : (
        <>
          {/* CARDS DE KPI */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <Target size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Score Global</p>
                <h3 className="text-2xl font-bold text-gray-800">{metrics.scoreAtual} <span className="text-xs text-gray-400 font-normal">/ 100</span></h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Metas Batidas</p>
                <h3 className="text-2xl font-bold text-gray-800">{metrics.metasBatidas} <span className="text-xs text-gray-400 font-normal">/ {metrics.totalMetas}</span></h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Indicadores Críticos</p>
                <h3 className="text-2xl font-bold text-gray-800">{metrics.criticos}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Tendência</p>
                <h3 className="text-sm font-bold text-purple-700">Estável</h3>
              </div>
            </div>
          </div>

          {/* ÁREA PRINCIPAL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
            
            {/* GRÁFICO */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="font-bold text-gray-700 mb-6">Evolução do Score (1º Semestre)</h3>
              <div className="flex-1 w-full h-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} domain={[0, 100]} />
                    <Tooltip 
                      cursor={{fill: '#f3f4f6'}} 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} barSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.score >= 90 ? '#4ade80' : entry.score >= 70 ? '#facc15' : '#f87171'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* LISTA DE ALERTAS */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-y-auto">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                Atenção Necessária
              </h3>
              
              {alertas.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  Nenhum indicador crítico encontrado. Parabéns! 🚀
                </div>
              ) : (
                <div className="space-y-3">
                  {alertas.map((item, idx) => (
                    <div key={idx} className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-md">
                      <p className="text-xs font-bold text-red-800 uppercase mb-1">{item.nome}</p>
                      <div className="flex justify-between text-xs text-red-700">
                        <span>Meta: <strong>{Number(item.alvo).toFixed(2)}</strong></span>
                        <span>Real: <strong>{Number(item.real).toFixed(2)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* MODAL DE CONFIGURAÇÃO AQUI */}
          {showConfig && (
             <ConfiguracaoGeral onClose={() => {
                 setShowConfig(false);
                 fetchDashboardData(); // Recarrega os dados ao fechar
             }} />
          )}
        </>
      )}
    </div>
  );
};

export default OperacaoResumo;

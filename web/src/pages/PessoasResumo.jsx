import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { AlertTriangle, TrendingUp, CheckCircle, Target, Settings, Users } from 'lucide-react';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';

const ID_PESSOAS = 8;

const PessoasResumo = () => {
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [metrics, setMetrics] = useState({ scoreAtual: 0, metasBatidas: 0, criticos: 0, totalMetas: 0 });
  const [chartData, setChartData] = useState([]);
  const [alertas, setAlertas] = useState([]);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [resMetas, resAlvos, resReal] = await Promise.all([
        supabase.from('metas_farol').select('*').eq('area_id', ID_PESSOAS).eq('ano', 2026),
        supabase.from('metas_farol_mensal').select('*').eq('ano', 2026),
        supabase.from('resultados_farol').select('*').eq('ano', 2026)
      ]);

      const metas = resMetas.data || [];
      const MES_ATUAL = 1;
      let somaScore = 0, countBatidas = 0, countCriticas = 0;
      const listaAlertas = [];

      metas.forEach(meta => {
        const alvo = resAlvos.data?.find(a => a.meta_id === meta.id && a.mes === MES_ATUAL)?.valor_meta;
        const real = resReal.data?.find(r => r.meta_id === meta.id && r.mes === MES_ATUAL)?.valor_realizado;
        const { score, faixa } = calculateScore(alvo, real, meta.tipo_comparacao, meta.peso);
        
        somaScore += score;
        if (faixa === 1) countBatidas++;
        if (faixa === 5) {
          countCriticas++;
          listaAlertas.push({ nome: meta.nome_meta, alvo, real });
        }
      });

      const historico = [1, 2, 3, 4, 5, 6].map(mesId => {
        let scoreMes = 0;
        metas.forEach(m => {
          const a = resAlvos.data?.find(x => x.meta_id === m.id && x.mes === mesId)?.valor_meta;
          const r = resReal.data?.find(x => x.meta_id === m.id && x.mes === mesId)?.valor_realizado;
          scoreMes += calculateScore(a, r, m.tipo_comparacao, m.peso).score;
        });
        return { name: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'][mesId-1], score: scoreMes.toFixed(1) };
      });

      setMetrics({ scoreAtual: somaScore.toFixed(1), metasBatidas: countBatidas, criticos: countCriticas, totalMetas: metas.length });
      setChartData(historico);
      setAlertas(listaAlertas);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const calculateScore = (meta, realizado, tipo, peso) => {
    if (!meta || realizado === null || realizado === '') return { score: 0, faixa: 5 };
    const atingimento = tipo === '<=' ? (realizado <= meta ? 1 : meta / realizado) : (realizado / meta);
    let mult = atingimento >= 1.0 ? 1.0 : atingimento >= 0.98 ? 0.50 : 0;
    return { score: parseFloat(peso) * mult, faixa: atingimento >= 1.0 ? 1 : 5 };
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-indigo-900">Visão Geral — Pessoas</h2>
          <p className="text-sm text-slate-500">Gestão de RH, Clima e DP</p>
        </div>
        <button onClick={() => setShowConfig(true)} className="bg-indigo-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-800">
          <Settings size={16} /> Configurar
        </button>
      </div>

      {loading ? <div className="h-64 flex items-center justify-center text-slate-400">Carregando...</div> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card KPI title="Score RH" value={metrics.scoreAtual} sub="/ 100" Icon={Users} color="indigo" />
            <Card KPI title="Metas Batidas" value={metrics.metasBatidas} sub={`/ ${metrics.totalMetas}`} Icon={CheckCircle} color="green" />
            <Card KPI title="Críticos" value={metrics.criticos} Icon={AlertTriangle} color="red" />
            <Card KPI title="Tendência" value="Estável" Icon={TrendingUp} color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-6">Evolução do Time</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} barSize={40}>
                    {chartData.map((e, i) => <Cell key={i} fill={e.score >= 90 ? '#6366f1' : '#f87171'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <AlertaList alertas={alertas} />
          </div>
          {showConfig && <ConfiguracaoGeral onClose={() => { setShowConfig(false); fetchDashboardData(); }} />}
        </>
      )}
    </div>
  );
};

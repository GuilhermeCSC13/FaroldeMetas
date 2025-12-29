import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings, DollarSign } from 'lucide-react';

const FinanceiroMetas = () => {
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [idFinanceiro, setIdFinanceiro] = useState(null);

  const MESES = [
    { id: 1, label: 'jan/26' }, { id: 2, label: 'fev/26' }, { id: 3, label: 'mar/26' },
    { id: 4, label: 'abr/26' }, { id: 5, label: 'mai/26' }, { id: 6, label: 'jun/26' },
    { id: 7, label: 'jul/26' }, { id: 8, label: 'ago/26' }, { id: 9, label: 'set/26' },
    { id: 10, label: 'out/26' }, { id: 11, label: 'nov/26' }, { id: 12, label: 'dez/26' }
  ];

  useEffect(() => {
    fetchAreaAndData();
  }, []);

  const fetchAreaAndData = async () => {
    setLoading(true);
    try {
      // 1. Busca o ID da área Financeiro dinamicamente
      const { data: areaData } = await supabase
        .from('areas')
        .select('id')
        .eq('nome', 'Financeiro')
        .single();

      if (areaData) {
        setIdFinanceiro(areaData.id);
        await fetchMetasData(areaData.id);
      }
    } catch (err) {
      console.error("Erro ao buscar área:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetasData = async (areaId) => {
    try {
      // Busca Definições, Alvos e Resultados
      const [resDef, resMensal, resReal] = await Promise.all([
        supabase.from('metas_farol').select('*').eq('area_id', areaId).eq('ano', 2026).order('id'),
        supabase.from('metas_farol_mensal').select('*').eq('ano', 2026),
        supabase.from('resultados_farol').select('*').eq('ano', 2026)
      ]);

      const combined = (resDef.data || []).map(m => {
        const row = { ...m, meses: {} };
        MESES.forEach(mes => {
          const alvoObj = resMensal.data?.find(x => x.meta_id === m.id && x.mes === mes.id);
          const realObj = resReal.data?.find(x => x.meta_id === m.id && x.mes === mes.id);
          
          const alvo = alvoObj ? parseFloat(alvoObj.valor_meta) : null;
          const real = realObj ? parseFloat(realObj.valor_realizado) : '';

          row.meses[mes.id] = {
            alvo,
            realizado: real,
            ...calculateScore(alvo, real, m.tipo_comparacao, parseFloat(m.peso))
          };
        });
        return row;
      });

      setMetas(combined);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  // Lógica de cálculo idêntica à Operação, adaptada para Financeiro (<=)
  const calculateScore = (meta, realizado, tipo, pesoTotal) => {
    if (meta === null || realizado === '' || realizado === null || isNaN(parseFloat(realizado))) {
      return { score: 0, color: 'bg-white' };
    }

    const r = parseFloat(realizado);
    const m = parseFloat(meta);
    if (m === 0) return { score: 0, color: 'bg-white' };

    // Para Financeiro (Tipo <=), quanto menor o realizado em relação à meta, melhor
    let atingimento = r <= m ? 1 : m / r;

    let multiplicador = 0;
    let cor = 'bg-red-200';

    if (atingimento >= 1.0) { multiplicador = 1.0; cor = 'bg-green-300'; }
    else if (atingimento >= 0.99) { multiplicador = 0.75; cor = 'bg-green-100'; }
    else if (atingimento >= 0.98) { multiplicador = 0.50; cor = 'bg-yellow-100'; }
    else if (atingimento >= 0.97) { multiplicador = 0.25; cor = 'bg-orange-100'; }
    
    return { score: pesoTotal * multiplicador, color: cor };
  };

  const handleSave = async (metaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace('%', '').replace(',', '.'));
    
    // Update Local Otimista
    setMetas(prev => prev.map(m => {
      if (m.id !== metaId) return m;
      const novoMeses = { ...m.meses };
      novoMeses[mesId] = {
        ...novoMeses[mesId],
        realizado: valorNum,
        ...calculateScore(novoMeses[mesId].alvo, valorNum, m.tipo_comparacao, m.peso)
      };
      return { ...m, meses: novoMeses };
    }));

    // Salva no Banco
    await supabase.from('resultados_farol').upsert({
      meta_id: metaId, ano: 2026, mes: mesId, valor_realizado: valorNum
    }, { onConflict: 'meta_id, ano, mes' });
  };

  const getTotalScore = (mesId) => {
    const total = metas.reduce((acc, m) => acc + (m.meses[mesId]?.score || 0), 0);
    return total.toFixed(1);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded shadow-sm overflow-hidden font-sans">
      {/* Header Financeiro */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-800 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-green-600 p-1.5 rounded">
            <DollarSign size={20} />
          </div>
          <h2 className="text-xl font-bold">Farol de Metas — Financeiro</h2>
        </div>
        <button onClick={() => setShowConfig(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <Settings size={20} />
        </button>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto p-4 bg-slate-50">
        {loading ? (
          <div className="text-center py-10 text-gray-400 animate-pulse font-bold">Carregando indicadores financeiros...</div>
        ) : (
          <div className="border border-gray-300 rounded overflow-hidden shadow-sm bg-white">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-gray-700 font-bold">
                  <th className="p-3 border border-gray-300 w-64 text-left sticky left-0 bg-slate-100 z-10">Indicador</th>
                  <th className="p-2 border border-gray-300 w-16 text-center">Peso</th>
                  {MESES.map(mes => <th key={mes.id} className="p-2 border border-gray-300 min-w-[75px] text-center">{mes.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {metas.map(meta => (
                  <tr key={meta.id} className="hover:bg-gray-50 text-center transition-colors">
                    <td className="p-3 border border-gray-300 text-left font-bold text-gray-800 sticky left-0 bg-white z-10">
                      {meta.nome_meta}
                      <span className='block text-[9px] text-gray-400 font-normal uppercase'>{meta.unidade}</span>
                    </td>
                    <td className="p-2 border border-gray-300 bg-slate-50 font-bold text-gray-500">{parseInt(meta.peso)}</td>
                    {MESES.map(mes => {
                      const d = meta.meses[mes.id];
                      return (
                        <td key={mes.id} className={`border border-gray-300 p-0 h-14 relative ${d.color}`}>
                          <div className="flex flex-col h-full">
                            <div className="text-[8px] text-gray-400 text-right pr-1 pt-0.5">Alvo: {d.alvo}%</div>
                            <input 
                              className="w-full text-center bg-transparent font-black text-gray-900 text-xs focus:outline-none flex-1 pb-1"
                              placeholder="0%"
                              defaultValue={d.realizado ? `${d.realizado}%` : ''}
                              onBlur={(e) => handleSave(meta.id, mes.id, e.target.value)}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                
                {/* Rodapé Performance */}
                <tr className="bg-slate-900 text-white font-black border-t-2 border-black uppercase">
                  <td className="p-3 sticky left-0 bg-slate-900 z-10 text-right pr-6">Score Mensal Consolidado</td>
                  <td className="p-2 text-center">100</td>
                  {MESES.map(mes => (
                    <td key={mes.id} className="p-2 text-center bg-slate-800 text-sm border-r border-slate-700">
                      {getTotalScore(mes.id)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showConfig && (
        <ConfiguracaoGeral onClose={() => { setShowConfig(false); fetchAreaAndData(); }} />
      )}
    </div>
  );
};

export default FinanceiroMetas;

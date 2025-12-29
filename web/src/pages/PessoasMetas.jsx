import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings, Users } from 'lucide-react';

const ID_PESSOAS = 8;

const PessoasMetas = () => {
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  const MESES = [
    { id: 1, label: 'jan/26' }, { id: 2, label: 'fev/26' }, { id: 3, label: 'mar/26' },
    { id: 4, label: 'abr/26' }, { id: 5, label: 'mai/26' }, { id: 6, label: 'jun/26' },
    { id: 7, label: 'jul/26' }, { id: 8, label: 'ago/26' }, { id: 9, label: 'set/26' },
    { id: 10, label: 'out/26' }, { id: 11, label: 'nov/26' }, { id: 12, label: 'dez/26' }
  ];

  useEffect(() => { fetchMetasData(); }, []);

  const fetchMetasData = async () => {
    setLoading(true);
    try {
      const [resDef, resMensal, resReal] = await Promise.all([
        supabase.from('metas_farol').select('*').eq('area_id', ID_PESSOAS).eq('ano', 2026).order('id'),
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
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const calculateScore = (meta, realizado, tipo, pesoTotal) => {
    if (meta === null || realizado === '' || realizado === null) return { score: 0, color: 'bg-white' };
    const r = parseFloat(realizado), m = parseFloat(meta);
    if (m === 0) return { score: 0, color: 'bg-white' };
    let atingimento = (tipo === '<=') ? (r <= m ? 1 : m / r) : (r / m);
    let multiplicador = atingimento >= 1.0 ? 1.0 : atingimento >= 0.98 ? 0.50 : 0;
    let cor = atingimento >= 1.0 ? 'bg-green-300' : atingimento >= 0.98 ? 'bg-yellow-100' : 'bg-red-200';
    return { score: pesoTotal * multiplicador, color: cor };
  };

  const handleSave = async (metaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace('%', '').replace(',', '.'));
    await supabase.from('resultados_farol').upsert({ 
      meta_id: metaId, ano: 2026, mes: mesId, valor_realizado: valorNum 
    }, { onConflict: 'meta_id, ano, mes' });
    fetchMetasData();
  };

  const getTotalScore = (mesId) => {
    return metas.reduce((acc, m) => acc + (m.meses[mesId]?.score || 0), 0).toFixed(1);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded shadow-sm overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-indigo-800 text-white">
        <div className="flex items-center gap-3">
          <Users size={20} />
          <h2 className="text-xl font-bold uppercase">Farol de Metas — Pessoas</h2>
        </div>
        <button onClick={() => setShowConfig(true)} className="p-2 hover:bg-white/10 rounded-full"><Settings size={20} /></button>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-slate-50">
        <div className="border border-slate-200 rounded overflow-hidden shadow-sm bg-white">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase">
                <th className="p-3 border border-slate-200 w-64 text-left sticky left-0 bg-slate-100 z-10">Indicador</th>
                <th className="p-2 border border-slate-200 w-16 text-center">Peso</th>
                {MESES.map(mes => <th key={mes.id} className="p-2 border border-slate-200 min-w-[75px] text-center">{mes.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {metas.map(meta => (
                <tr key={meta.id} className="hover:bg-slate-50 text-center transition-colors">
                  <td className="p-3 border border-slate-200 text-left font-bold text-slate-800 sticky left-0 bg-white z-10">{meta.nome_meta}</td>
                  <td className="p-2 border border-slate-200 bg-slate-50 font-bold text-slate-500">{parseInt(meta.peso)}</td>
                  {MESES.map(mes => {
                    const d = meta.meses[mes.id];
                    return (
                      <td key={mes.id} className={`border border-slate-200 p-0 h-14 relative ${d.color}`}>
                        <div className="flex flex-col h-full">
                          <div className="text-[8px] text-slate-400 text-right pr-1 pt-0.5">Alvo: {d.alvo}%</div>
                          <input 
                            className="w-full text-center bg-transparent font-black text-slate-900 text-xs focus:outline-none flex-1"
                            defaultValue={d.realizado ? `${d.realizado}%` : ''}
                            onBlur={(e) => handleSave(meta.id, mes.id, e.target.value)}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-slate-900 text-white font-black border-t-2 border-black uppercase">
                <td className="p-3 sticky left-0 bg-slate-900 z-10 text-right pr-6">Score Consolidado</td>
                <td className="p-2 text-center">100</td>
                {MESES.map(mes => <td key={mes.id} className="p-2 text-center bg-slate-800 text-sm border-r border-slate-700">{getTotalScore(mes.id)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {showConfig && <ConfiguracaoGeral onClose={() => { setShowConfig(false); fetchMetasData(); }} />}
    </div>
  );
};
export default PessoasMetas;

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings, ArrowRightLeft } from 'lucide-react';

const ID_FINANCEIRO = 7;

const FinanceiroMetas = () => {
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
    const [resDef, resMensal, resReal] = await Promise.all([
      supabase.from('metas_farol').select('*').eq('area_id', ID_FINANCEIRO).eq('ano', 2026).order('id'),
      supabase.from('metas_farol_mensal').select('*').eq('ano', 2026),
      supabase.from('resultados_farol').select('*').eq('ano', 2026)
    ]);

    const combined = (resDef.data || []).map(m => {
      const row = { ...m, meses: {} };
      MESES.forEach(mes => {
        const alvo = resMensal.data?.find(x => x.meta_id === m.id && x.mes === mes.id)?.valor_meta;
        const real = resReal.data?.find(x => x.meta_id === m.id && x.mes === mes.id)?.valor_realizado;
        const atingimento = (m.tipo_comparacao === '<=') ? (real <= alvo ? 1 : alvo / real) : (real / alvo);
        const cor = (atingimento >= 1.0) ? 'bg-green-300' : 'bg-red-200';
        row.meses[mes.id] = { alvo, realizado: real, score: (atingimento >= 1.0 ? m.peso : 0), color: cor };
      });
      return row;
    });
    setMetas(combined);
    setLoading(false);
  };

  const handleSave = async (metaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    await supabase.from('resultados_farol').upsert({ meta_id: metaId, ano: 2026, mes: mesId, valor_realizado: valorNum }, { onConflict: 'meta_id, ano, mes' });
    fetchMetasData();
  };

  const getTotalScore = (mesId) => metas.reduce((acc, m) => acc + (m.meses[mesId]?.score || 0), 0).toFixed(1);
  const getSomaPesos = () => metas.reduce((acc, m) => acc + parseInt(m.peso), 0);

  return (
    <div className="flex flex-col h-full bg-white font-sans">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white">
        <h2 className="text-xl font-bold uppercase">Farol de Metas — Financeiro</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => window.location.hash = '#rotinas'} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-bold transition-all flex items-center gap-2"><ArrowRightLeft size={14}/> Rotinas</button>
          <button onClick={() => setShowConfig(true)} className="p-2 hover:bg-white/10 rounded-full"><Settings size={18} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-slate-50">
        <table className="w-full text-xs border-collapse bg-white border border-gray-300">
          <thead>
            <tr className="bg-[#d0e0e3] text-gray-800 font-bold uppercase">
              <th className="p-3 border border-gray-300 w-80 text-left sticky left-0 bg-[#d0e0e3] z-10">Indicador</th>
              <th className="p-2 border border-gray-300 w-16 text-center">Peso</th>
              {MESES.map(mes => <th key={mes.id} className="p-2 border border-gray-300 min-w-[100px] text-center">{mes.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {metas.map(meta => (
              <tr key={meta.id}>
                <td className="p-3 border border-gray-300 font-bold text-gray-700 sticky left-0 bg-white z-10">{meta.nome_meta}</td>
                <td className="p-2 border border-gray-300 text-center font-bold text-gray-400 bg-gray-50">{parseInt(meta.peso)}</td>
                {MESES.map(mes => {
                  const d = meta.meses[mes.id];
                  return (
                    <td key={mes.id} className={`border border-gray-300 p-0 h-20 ${d.color}`}>
                      <div className="flex flex-col h-full">
                        <div className="text-[11px] font-extrabold text-slate-700 text-center py-1 bg-white/30 border-b border-black/5">ALVO: {d.alvo}%</div>
                        <input className="w-full text-center bg-transparent font-black text-gray-900 text-base focus:outline-none flex-1" defaultValue={d.realizado} onBlur={(e) => handleSave(meta.id, mes.id, e.target.value)} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-slate-900 text-white font-black uppercase">
              <td className="p-3 text-right pr-6">Score Consolidado</td>
              <td className="p-2 text-center text-lg">{getSomaPesos()}</td>
              {MESES.map(mes => <td key={mes.id} className="p-2 text-center text-lg bg-slate-800">{getTotalScore(mes.id)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {showConfig && <ConfiguracaoGeral onClose={() => {setShowConfig(false); fetchMetasData();}} />}
    </div>
  );
};
export default FinanceiroMetas;

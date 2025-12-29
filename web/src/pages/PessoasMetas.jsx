import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Settings, Users } from 'lucide-react';

const ID_PESSOAS = 8;

const PessoasMetas = () => {
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);

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
      supabase.from('metas_farol').select('*').eq('area_id', ID_PESSOAS).eq('ano', 2026),
      supabase.from('metas_farol_mensal').select('*').eq('ano', 2026),
      supabase.from('resultados_farol').select('*').eq('ano', 2026)
    ]);

    const combined = (resDef.data || []).map(m => {
      const row = { ...m, meses: {} };
      MESES.forEach(mes => {
        const alvo = resMensal.data?.find(x => x.meta_id === m.id && x.mes === mes.id)?.valor_meta;
        const real = resReal.data?.find(x => x.meta_id === m.id && x.mes === mes.id)?.valor_realizado;
        row.meses[mes.id] = { alvo, realizado: real, ...calculateScore(alvo, real, m.tipo_comparacao, m.peso) };
      });
      return row;
    });
    setMetas(combined);
    setLoading(false);
  };

  const calculateScore = (meta, realizado, tipo, peso) => {
    if (meta === null || realizado === '' || realizado === null) return { score: 0, color: 'bg-white' };
    const r = parseFloat(realizado), m = parseFloat(meta);
    const atingimento = tipo === '<=' ? (r <= m ? 1 : m / r) : (r / m);
    const mult = atingimento >= 1.0 ? 1.0 : atingimento >= 0.98 ? 0.5 : 0;
    const cor = atingimento >= 1.0 ? 'bg-green-300' : atingimento >= 0.98 ? 'bg-yellow-100' : 'bg-red-200';
    return { score: peso * mult, color: cor };
  };

  const handleSave = async (metaId, mesId, valor) => {
    const valorNum = parseFloat(valor.replace('%', '').replace(',', '.'));
    await supabase.from('resultados_farol').upsert({ meta_id: metaId, ano: 2026, mes: mesId, valor_realizado: valorNum }, { onConflict: 'meta_id, ano, mes' });
    fetchMetasData();
  };

  const getTotalScore = (mesId) => metas.reduce((acc, m) => acc + (m.meses[mesId]?.score || 0), 0).toFixed(1);
  const getSomaPesos = () => metas.reduce((acc, m) => acc + parseInt(m.peso), 0);

  return (
    <div className="flex flex-col h-full bg-white font-sans">
      <div className="flex items-center justify-between px-6 py-4 bg-indigo-800 text-white">
        <h2 className="text-xl font-bold uppercase">Farol de Metas — Pessoas</h2>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-slate-50">
        <table className="w-full text-xs border-collapse bg-white">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold uppercase">
              <th className="p-4 border border-slate-200 w-80 text-left sticky left-0 bg-slate-100 z-10">Indicador</th>
              <th className="p-2 border border-slate-200 w-20 text-center">Peso</th>
              {MESES.map(mes => <th key={mes.id} className="p-2 border border-slate-200 min-w-[100px] text-center">{mes.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {metas.map(meta => (
              <tr key={meta.id} className="text-center">
                <td className="p-4 border border-slate-200 text-left font-bold text-slate-800 sticky left-0 bg-white z-10">{meta.nome_meta}</td>
                <td className="p-2 border border-slate-200 font-bold text-slate-500">{parseInt(meta.peso)}</td>
                {MESES.map(mes => {
                  const d = meta.meses[mes.id];
                  return (
                    <td key={mes.id} className={`border border-slate-200 p-0 h-20 ${d.color}`}>
                      <div className="flex flex-col h-full justify-center">
                        <div className="text-[11px] font-bold text-slate-500 mb-1">ALVO: {d.alvo}{meta.unidade === '%' ? '%' : ''}</div>
                        <input 
                          className="w-full text-center bg-transparent font-black text-slate-900 text-lg focus:outline-none"
                          defaultValue={d.realizado !== '' ? `${d.realizado}${meta.unidade === '%' ? '%' : ''}` : ''}
                          onBlur={(e) => handleSave(meta.id, mes.id, e.target.value)}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-slate-900 text-white font-black uppercase">
              <td className="p-4 sticky left-0 bg-slate-900 z-10 text-right pr-6">Score Consolidado</td>
              <td className="p-2 text-center text-lg">{getSomaPesos()}</td>
              {MESES.map(mes => <td key={mes.id} className="p-2 text-center text-lg bg-slate-800 border-r border-slate-700">{getTotalScore(mes.id)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default PessoasMetas;

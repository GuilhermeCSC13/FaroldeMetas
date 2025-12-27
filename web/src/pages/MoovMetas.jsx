import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings, Target } from 'lucide-react';

const ID_MOOV = 3;
const MESES = [
  { id: 1, label: 'JAN' }, { id: 2, label: 'FEV' }, { id: 3, label: 'MAR' },
  { id: 4, label: 'ABR' }, { id: 5, label: 'MAI' }, { id: 6, label: 'JUN' },
  { id: 7, label: 'JUL' }, { id: 8, label: 'AGO' }, { id: 9, label: 'SET' },
  { id: 10, label: 'OUT' }, { id: 11, label: 'NOV' }, { id: 12, label: 'DEZ' }
];

const MoovMetas = () => {
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => { fetchMetasData(); }, []);

  const fetchMetasData = async () => {
    setLoading(true);
    try {
      const { data: metasDef } = await supabase.from('metas_farol').select('*').eq('area_id', ID_MOOV).order('id');
      const { data: metasMensais } = await supabase.from('metas_farol_mensal').select('*').eq('ano', 2026);
      const { data: resultados } = await supabase.from('resultados_farol').select('*').eq('ano', 2026);

      const combined = (metasDef || []).map(m => {
        const row = { ...m, meses: {} };
        MESES.forEach(mes => {
          const alvoObj = metasMensais?.find(x => x.meta_id === m.id && x.mes === mes.id);
          const realObj = resultados?.find(x => x.meta_id === m.id && x.mes === mes.id);
          row.meses[mes.id] = {
            alvo: alvoObj ? parseFloat(alvoObj.valor_meta) : null,
            realizado: realObj ? parseFloat(realObj.valor_realizado) : '',
            ...calculateScore(alvoObj?.valor_meta, realObj?.valor_realizado, m.tipo_comparacao)
          };
        });
        return row;
      });
      setMetas(combined);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const calculateScore = (meta, realizado, tipo) => {
    if (!meta || realizado === '' || realizado === null) return { color: 'bg-white' };
    const r = parseFloat(realizado), m = parseFloat(meta);
    let atingimento = (tipo === '>=' || tipo === 'maior') ? r / m : 1 + ((m - r) / m);

    if (atingimento >= 1.0) return { color: 'bg-green-300' };
    if (atingimento >= 0.99) return { color: 'bg-green-100' };
    if (atingimento >= 0.98) return { color: 'bg-yellow-100' };
    return { color: 'bg-red-200' };
  };

  const handleSave = async (metaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    setMetas(prev => prev.map(m => {
        if (m.id !== metaId) return m;
        const novoMeses = { ...m.meses };
        novoMeses[mesId] = { ...novoMeses[mesId], realizado: valorNum, ...calculateScore(novoMeses[mesId].alvo, valorNum, m.tipo_comparacao) };
        return { ...m, meses: novoMeses };
    }));
    await supabase.from('resultados_farol').upsert({ meta_id: metaId, ano: 2026, mes: mesId, valor_realizado: valorNum }, { onConflict: 'meta_id, ano, mes' });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl shadow-lg border border-gray-200 overflow-hidden relative font-sans">
      <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-gray-100">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Farol de Metas — Moov</h2>
           <p className="text-sm text-gray-400 mt-1">Indicadores Estratégicos</p>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={() => window.location.hash = 'rotinas'} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">Ir para Rotinas</button>
            <button onClick={() => setShowConfig(true)} className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-95"><Settings size={20} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        {loading ? <div className="text-center py-10">Carregando...</div> : (
          <div className="min-w-max">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr className="bg-gray-800 text-white font-bold uppercase tracking-wider">
                  <th className="sticky left-0 z-30 p-4 w-72 text-left border-r border-white/20">Indicador</th>
                  <th className="p-3 w-16 text-center border-r border-white/20">Peso</th>
                  <th className="p-3 w-16 text-center border-r border-white/20">Tipo</th>
                  {MESES.map(mes => <th key={mes.id} className="p-3 min-w-[80px] text-center border-r border-white/20">{mes.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metas.map(meta => (
                  <tr key={meta.id} className="group hover:bg-gray-50/80 transition-colors">
                    <td className="sticky left-0 z-10 p-4 bg-white border-r border-gray-100 group-hover:bg-gray-50 font-bold text-gray-700 shadow-sm">
                        {meta.nome_meta || meta.indicador}
                        <span className="block text-[9px] text-gray-400 font-normal mt-0.5">{meta.unidade}</span>
                    </td>
                    <td className="p-3 text-center bg-gray-50 border-r border-gray-100">{parseInt(meta.peso)}</td>
                    <td className="p-3 text-center font-mono text-gray-500 border-r border-gray-100">{meta.tipo_comparacao}</td>
                    {MESES.map(mes => {
                      const dados = meta.meses[mes.id];
                      return (
                        <td key={mes.id} className={`p-0 border-r border-gray-50 relative align-top ${dados.color}`}>
                           <div className="flex flex-col h-12 justify-between py-1 px-1">
                             <div className="text-[9px] text-right opacity-60 font-semibold">{dados.alvo ? Number(dados.alvo).toFixed(2) : '-'}</div>
                             <input className="w-full text-center bg-transparent font-bold focus:outline-none pb-1" defaultValue={dados.realizado} onBlur={(e) => handleSave(meta.id, mes.id, e.target.value)} />
                           </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showConfig && <ConfiguracaoGeral onClose={() => { setShowConfig(false); fetchMetasData(); }} />}
    </div>
  );
};
export default MoovMetas;

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
          const alvo = alvoObj ? parseFloat(alvoObj.valor_meta) : null;
          const real = realObj ? parseFloat(realObj.valor_realizado) : '';
          
          row.meses[mes.id] = { alvo, realizado: real, ...calculateScore(alvo, real, m.tipo_comparacao) };
        });
        return row;
      });
      setMetas(combined);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const calculateScore = (meta, realizado, tipo) => {
    if (meta === null || realizado === '' || realizado === null || isNaN(realizado)) return { color: 'bg-white' };
    const r = parseFloat(realizado);
    const m = parseFloat(meta);
    let atingimento = 0;
    
    if (tipo === '>=' || tipo === 'maior') atingimento = r / m;
    else atingimento = 1 + ((m - r) / m);

    if (atingimento >= 1.0) return { color: 'bg-green-300' };
    if (atingimento >= 0.99) return { color: 'bg-green-100' };
    if (atingimento >= 0.98) return { color: 'bg-yellow-100' };
    if (atingimento >= 0.97) return { color: 'bg-orange-100' };
    return { color: 'bg-red-200' };
  };

  const handleSave = async (metaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    // Atualização Otimista
    setMetas(prev => prev.map(m => {
        if (m.id !== metaId) return m;
        const novoMeses = { ...m.meses };
        novoMeses[mesId] = { ...novoMeses[mesId], realizado: valorNum, ...calculateScore(novoMeses[mesId].alvo, valorNum, m.tipo_comparacao) };
        return { ...m, meses: novoMeses };
    }));
    await supabase.from('resultados_farol').upsert({ meta_id: metaId, ano: 2026, mes: mesId, valor_realizado: valorNum }, { onConflict: 'meta_id, ano, mes' });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800">Farol de Metas — Moov</h2>
        <button onClick={() => setShowConfig(true)} className="p-2 text-gray-400 hover:text-blue-600 rounded-full"><Settings size={20} /></button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white text-center font-bold uppercase tracking-wider">
              <th className="p-3 w-64 text-left pl-4 sticky left-0 bg-gray-800 z-10">Indicador</th>
              <th className="p-3 w-16">Peso</th>
              <th className="p-3 w-16">Tipo</th>
              {MESES.map(mes => <th key={mes.id} className="p-3 min-w-[80px] border-l border-gray-700">{mes.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {metas.map(meta => (
              <tr key={meta.id} className="hover:bg-gray-50 text-center group">
                <td className="p-3 text-left font-bold text-gray-700 sticky left-0 bg-white border-r border-gray-200">{meta.nome_meta || meta.indicador}</td>
                <td className="p-3 bg-gray-50 border-r border-gray-200">{parseInt(meta.peso)}</td>
                <td className="p-3 font-mono text-gray-500 border-r border-gray-200">{meta.tipo_comparacao}</td>
                {MESES.map(mes => {
                  const dados = meta.meses[mes.id];
                  return (
                    <td key={mes.id} className={`p-0 border-r border-gray-100 relative h-12 ${dados.color} transition-colors`}>
                      <div className="flex flex-col h-full justify-between py-1">
                        <div className="text-[9px] text-gray-500/80 text-right px-1">{dados.alvo ? Number(dados.alvo).toFixed(2) : '-'}</div>
                        <input 
                           className="w-full text-center bg-transparent font-bold text-gray-900 focus:outline-none"
                           defaultValue={dados.realizado}
                           onBlur={(e) => handleSave(meta.id, mes.id, e.target.value)}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showConfig && <ConfiguracaoGeral onClose={() => { setShowConfig(false); fetchMetasData(); }} />}
    </div>
  );
};
export default MoovMetas;

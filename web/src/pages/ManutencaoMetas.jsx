import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings } from 'lucide-react';

const ID_MANUTENCAO = 2;
const MESES = [
  { id: 1, label: 'jan/26' }, { id: 2, label: 'fev/26' }, { id: 3, label: 'mar/26' },
  { id: 4, label: 'abr/26' }, { id: 5, label: 'mai/26' }, { id: 6, label: 'jun/26' },
  { id: 7, label: 'jul/26' }, { id: 8, label: 'ago/26' }, { id: 9, label: 'set/26' },
  { id: 10, label: 'out/26' }, { id: 11, label: 'nov/26' }, { id: 12, label: 'dez/26' }
];

const ManutencaoMetas = () => {
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => { fetchMetasData(); }, []);

  const fetchMetasData = async () => {
    setLoading(true);
    try {
      const { data: metasDef } = await supabase.from('metas_farol').select('*').eq('area_id', ID_MANUTENCAO).order('id');
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
            ...calculateScore(alvoObj?.valor_meta, realObj?.valor_realizado, m.tipo_comparacao, m.peso)
          };
        });
        return row;
      });
      setMetas(combined);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const calculateScore = (meta, realizado, tipo, pesoTotal) => {
    if (!meta || realizado === '' || realizado === null) return { score: 0, color: 'bg-white' };
    const r = parseFloat(realizado), m = parseFloat(meta);
    if(m === 0) return { score: 0, color: 'bg-white' };
    
    let atingimento = (tipo === '>=' || tipo === 'maior') ? r / m : 1 + ((m - r) / m);

    if (atingimento >= 1.0) return { score: pesoTotal, color: 'bg-green-300' };
    if (atingimento >= 0.99) return { score: pesoTotal * 0.75, color: 'bg-green-100' };
    if (atingimento >= 0.98) return { score: pesoTotal * 0.50, color: 'bg-yellow-100' };
    return { score: 0, color: 'bg-red-200' };
  };

  const handleSave = async (metaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    setMetas(prev => prev.map(m => {
        if (m.id !== metaId) return m;
        const novoMeses = { ...m.meses };
        novoMeses[mesId] = { ...novoMeses[mesId], realizado: valorNum, ...calculateScore(novoMeses[mesId].alvo, valorNum, m.tipo_comparacao, m.peso) };
        return { ...m, meses: novoMeses };
    }));
    await supabase.from('resultados_farol').upsert({ meta_id: metaId, ano: 2026, mes: mesId, valor_realizado: valorNum }, { onConflict: 'meta_id, ano, mes' });
  };

  const getTotalScore = (mesId) => metas.reduce((acc, m) => acc + (m.meses[mesId]?.score || 0), 0).toFixed(1);

  return (
    <div className="flex flex-col h-full bg-white font-sans">
      <div className="flex items-center justify-between px-6 py-3 bg-yellow-300 border-b border-yellow-400">
        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">FAROL DE METAS</h2>
        <div className="flex items-center gap-3">
             <button onClick={() => window.location.hash = 'rotinas'} className="px-3 py-1 text-xs font-bold text-gray-800 bg-white/50 hover:bg-white rounded transition-colors shadow-sm">
                IR PARA ROTINAS
             </button>
             <button onClick={() => setShowConfig(true)} className="p-1.5 text-gray-800 hover:text-black hover:bg-yellow-400/50 rounded-full transition-colors">
                <Settings size={20} />
             </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr className="bg-[#d9ead3] text-gray-900 font-bold text-center border-b border-gray-400 uppercase">
              <th className="p-3 border-r border-gray-400 w-64 sticky left-0 bg-[#d9ead3] z-10 text-left pl-4">Descrição</th>
              <th className="p-3 border-r border-gray-400 w-12">Peso</th>
              <th className="p-3 border-r border-gray-400 w-12">Tipo</th>
              {MESES.map(mes => <th key={mes.id} className="p-3 border-r border-gray-400 min-w-[70px]">{mes.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {metas.map(meta => (
              <tr key={meta.id} className="hover:bg-gray-50 text-center border-b border-gray-200">
                <td className="p-2 border-r border-gray-300 text-left font-bold text-gray-800 sticky left-0 bg-[#f4fce8] z-10">
                    {meta.nome_meta || meta.indicador}
                </td>
                <td className="p-2 border-r border-gray-300 bg-gray-50">{parseInt(meta.peso)}</td>
                <td className="p-2 border-r border-gray-300 font-mono text-gray-500">{meta.tipo_comparacao}</td>
                {MESES.map(mes => {
                  const dados = meta.meses[mes.id];
                  return (
                    <td key={mes.id} className={`border-r border-gray-300 p-0 relative h-10 align-middle ${dados.color}`}>
                       <div className="flex flex-col h-full justify-center">
                         <div className="text-[9px] text-gray-500 text-right px-1 pt-0.5 opacity-60 absolute top-0 right-0 font-medium">
                            {dados.alvo ? Number(dados.alvo).toFixed(2) : ''}
                         </div>
                         <input 
                            className="w-full text-center bg-transparent font-bold text-gray-900 focus:outline-none h-full pt-1"
                            placeholder="-"
                            defaultValue={dados.realizado}
                            onBlur={(e) => handleSave(meta.id, mes.id, e.target.value)}
                         />
                       </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Rodapé Totalizador (Cinza escuro conforme estilo manutenção) */}
            <tr className="bg-gray-700 text-white font-bold border-t-2 border-black">
              <td className="p-2 sticky left-0 bg-gray-700 z-10 text-right pr-4">TOTAL SCORE</td>
              <td className="p-2 text-center border-l border-gray-600">100</td>
              <td className="border-l border-gray-600"></td>
              {MESES.map(mes => <td key={mes.id} className="p-2 text-center border-l border-gray-600">{getTotalScore(mes.id)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {showConfig && (
        <ConfiguracaoGeral 
            areasContexto={[{ id: 2, nome: 'Manutenção' }]} 
            onClose={() => { setShowConfig(false); fetchMetasData(); }} 
        />
      )}
    </div>
  );
};
export default ManutencaoMetas;

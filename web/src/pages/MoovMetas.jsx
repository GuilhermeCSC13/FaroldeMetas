import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings, Target } from 'lucide-react';

const ID_MOOV = 3;
const MESES = [
  { id: 1, label: 'jan/26' }, { id: 2, label: 'fev/26' }, { id: 3, label: 'mar/26' },
  { id: 4, label: 'abr/26' }, { id: 5, label: 'mai/26' }, { id: 6, label: 'jun/26' },
  { id: 7, label: 'jul/26' }, { id: 8, label: 'ago/26' }, { id: 9, label: 'set/26' },
  { id: 10, label: 'out/26' }, { id: 11, label: 'nov/26' }, { id: 12, label: 'dez/26' }
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
    if (m === 0) return { color: 'bg-white' };
    
    let atingimento = (tipo === '>=' || tipo === 'maior') ? r / m : 1 + ((m - r) / m);

    if (atingimento >= 1.0) return { color: 'bg-green-300' }; // Verde Forte
    if (atingimento >= 0.99) return { color: 'bg-green-100' }; // Verde Claro
    if (atingimento >= 0.98) return { color: 'bg-yellow-100' }; // Amarelo
    return { color: 'bg-red-200' }; // Vermelho
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
    <div className="flex flex-col h-full bg-white font-sans">
      {/* Header da Tabela */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <h2 className="text-xl font-bold text-gray-800">Farol de Metas — Moov</h2>
        <div className="flex items-center gap-3">
             <button onClick={() => window.location.hash = 'rotinas'} className="px-3 py-1 text-sm font-medium text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors">
                Ir para Rotinas
             </button>
             <button onClick={() => setShowConfig(true)} className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-gray-100">
                <Settings size={18} />
             </button>
             <div className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded border border-blue-100">MOOV</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-20 shadow-sm">
            {/* Cabeçalho Cinza conforme imagem */}
            <tr className="bg-[#d0e0e3] text-gray-800 font-bold text-center uppercase border-b border-gray-300">
              <th className="sticky left-0 z-30 p-3 w-64 text-left border-r border-gray-300 bg-[#d0e0e3]">Indicador</th>
              <th className="p-3 w-12 border-r border-gray-300">Peso</th>
              <th className="p-3 w-12 border-r border-gray-300">Tipo</th>
              {MESES.map(mes => (
                <th key={mes.id} className="p-3 min-w-[80px] border-r border-gray-300">
                   {mes.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {metas.map(meta => (
              <tr key={meta.id} className="group hover:bg-gray-50/50">
                {/* Coluna Indicador Fixa */}
                <td className="sticky left-0 z-10 p-2 bg-gray-50/50 border-r border-gray-300 text-gray-800 font-semibold text-left">
                    <div className="flex flex-col px-2">
                        <span>{meta.nome_meta || meta.indicador}</span>
                        <span className="text-[9px] text-gray-400 font-normal">{meta.unidade}</span>
                    </div>
                </td>
                
                <td className="p-2 text-center bg-white border-r border-gray-200 text-gray-600">{parseInt(meta.peso)}</td>
                <td className="p-2 text-center bg-white border-r border-gray-200 font-mono text-[10px] text-gray-500">{meta.tipo_comparacao}</td>

                {/* Células de Dados */}
                {MESES.map(mes => {
                  const dados = meta.meses[mes.id];
                  return (
                    <td key={mes.id} className={`p-0 border-r border-gray-200 relative align-top h-12 ${dados.color}`}>
                       <div className="flex flex-col h-full justify-between">
                         {/* Meta (Alvo) - Pequeno no canto superior direito */}
                         <div className="text-[9px] text-gray-500 text-right pr-1 pt-0.5 font-medium opacity-70">
                            {dados.alvo ? Number(dados.alvo).toFixed(2) : ''}
                         </div>
                         {/* Realizado - Grande no centro */}
                         <input 
                            className="w-full text-center bg-transparent font-bold text-gray-900 focus:outline-none pb-1 text-sm"
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
          </tbody>
        </table>
      </div>
      {showConfig && <ConfiguracaoGeral onClose={() => { setShowConfig(false); fetchMetasData(); }} />}
    </div>
  );
};
export default MoovMetas;

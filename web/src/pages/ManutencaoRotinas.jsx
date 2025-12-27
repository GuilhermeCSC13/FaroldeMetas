import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings, Target } from 'lucide-react';

const ID_MANUTENCAO = 2;
const MESES = [
  { id: 1, label: 'jan/26' }, { id: 2, label: 'fev/26' }, { id: 3, label: 'mar/26' },
  { id: 4, label: 'abr/26' }, { id: 5, label: 'mai/26' }, { id: 6, label: 'jun/26' },
  { id: 7, label: 'jul/26' }, { id: 8, label: 'ago/26' }, { id: 9, label: 'set/26' },
  { id: 10, label: 'out/26' }, { id: 11, label: 'nov/26' }, { id: 12, label: 'dez/26' }
];

const ManutencaoRotinas = () => {
  const [rotinas, setRotinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => { fetchRotinasData(); }, []);

  const fetchRotinasData = async () => {
    setLoading(true);
    try {
      const { data: defs } = await supabase.from('rotinas_indicadores').select('*').eq('area_id', ID_MANUTENCAO).order('ordem');
      const { data: valores } = await supabase.from('rotinas_mensais').select('*').eq('ano', 2026);
      const combined = (defs || []).map(r => {
        const row = { ...r, meses: {} };
        MESES.forEach(mes => {
          const valObj = valores?.find(v => v.rotina_id === r.id && v.mes === mes.id);
          row.meses[mes.id] = { realizado: valObj ? valObj.valor_realizado : '', meta: valObj ? valObj.valor_meta : null };
        });
        return row;
      });
      setRotinas(combined);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSave = async (rotinaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    setRotinas(prev => prev.map(r => {
        if (r.id !== rotinaId) return r;
        const novosMeses = { ...r.meses };
        novosMeses[mesId] = { ...novosMeses[mesId], realizado: valorNum };
        return { ...r, meses: novosMeses };
    }));
    await supabase.rpc('atualizar_realizado_rotina', { p_rotina_id: rotinaId, p_mes: mesId, p_valor: valorNum });
  };

  const getCellStatus = (real, meta, tipo) => {
    if (real === '' || real === null || meta === null) return 'bg-white';
    const r = parseFloat(real), m = parseFloat(meta);
    const isGood = (tipo === '<=') ? r <= m : r >= m;
    return isGood ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]';
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans">
      <div className="flex items-center justify-between px-6 py-3 bg-yellow-300 border-b border-yellow-400">
        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">FAROL DE ROTINA</h2>
        <div className="flex items-center gap-3">
             <button onClick={() => window.location.hash = 'metas'} className="px-3 py-1 text-xs font-bold text-gray-800 bg-white/50 hover:bg-white rounded transition-colors shadow-sm">
                IR PARA METAS
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
              {MESES.map(mes => <th key={mes.id} className="p-3 border-r border-gray-400 min-w-[70px]">{mes.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rotinas.map(row => (
              <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-200">
                <td className="p-2 border-r border-gray-300 text-left font-bold text-gray-800 sticky left-0 bg-[#f4fce8] z-10">
                   {row.indicador}
                </td>
                
                {MESES.map(mes => {
                  const dados = row.meses[mes.id];
                  const bg = getCellStatus(dados.realizado, dados.meta, row.tipo_comparacao);
                  return (
                    <td key={mes.id} className={`border-r border-gray-300 p-0 relative h-10 align-middle ${bg}`}>
                      <div className="flex items-center justify-center h-full">
                         <input 
                            className="w-full text-center bg-transparent font-bold text-gray-900 focus:outline-none"
                            defaultValue={dados.realizado}
                            onBlur={(e) => handleSave(row.id, mes.id, e.target.value)}
                         />
                         {dados.meta && (
                           <div className="absolute bottom-1 right-1 text-[8px] text-gray-500 font-medium opacity-60 flex items-center gap-0.5 pointer-events-none">
                              <Target size={6} /> {Number(dados.meta).toFixed(row.formato === 'percent' ? 0 : 0)}
                           </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showConfig && (
        <ConfiguracaoGeral 
            areasContexto={[{ id: 2, nome: 'Manutenção' }]} 
            onClose={() => { setShowConfig(false); fetchRotinasData(); }} 
        />
      )}
    </div>
  );
};
export default ManutencaoRotinas;

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

const MoovRotinas = () => {
  const [rotinas, setRotinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => { fetchRotinasData(); }, []);

  const fetchRotinasData = async () => {
    setLoading(true);
    try {
      const { data: defs } = await supabase.from('rotinas_indicadores').select('*').eq('area_id', ID_MOOV).order('ordem');
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
    // Atualiza Visual
    setRotinas(prev => prev.map(r => {
        if (r.id !== rotinaId) return r;
        const novosMeses = { ...r.meses };
        novosMeses[mesId] = { ...novosMeses[mesId], realizado: valorNum };
        return { ...r, meses: novosMeses };
    }));
    // Salva via RPC
    await supabase.rpc('atualizar_realizado_rotina', { p_rotina_id: rotinaId, p_mes: mesId, p_valor: valorNum });
  };

  const getCellStatus = (real, meta, tipo) => {
    if (real === '' || real === null || meta === null) return 'bg-white';
    const r = parseFloat(real), m = parseFloat(meta);
    const isGood = (tipo === '<=') ? r <= m : r >= m;
    return isGood ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]';
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800">Farol de Rotinas — Moov</h2>
        <button onClick={() => setShowConfig(true)} className="p-2 text-gray-400 hover:text-blue-600 rounded-full"><Settings size={20} /></button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr className="bg-[#1e3a8a] text-white">
              <th className="sticky left-0 z-30 p-4 w-80 text-left font-bold uppercase tracking-wider text-xs border-r border-white/20">Indicador</th>
              {MESES.map(mes => <th key={mes.id} className="p-3 min-w-[100px] text-center font-bold text-xs border-r border-white/20">{mes.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rotinas.map(row => (
              <tr key={row.id} className="group hover:bg-gray-50">
                <td className="sticky left-0 z-10 p-4 bg-white border-r border-gray-100 font-medium text-gray-700 shadow-sm">{row.indicador}</td>
                {MESES.map(mes => {
                  const dados = row.meses[mes.id];
                  const bg = getCellStatus(dados.realizado, dados.meta, row.tipo_comparacao);
                  return (
                    <td key={mes.id} className="p-0 border-r border-gray-50 relative align-top">
                      <div className={`flex flex-col h-full min-h-[60px] ${bg} transition-colors`}>
                        <div className="flex-1 flex items-center justify-center pt-2">
                            <input 
                                className="w-20 text-center bg-transparent font-bold text-gray-800 focus:outline-none"
                                placeholder="-"
                                defaultValue={dados.realizado}
                                onBlur={(e) => handleSave(row.id, mes.id, e.target.value)}
                            />
                        </div>
                        <div className="h-6 flex items-center justify-center text-[10px] gap-1 opacity-60">
                            {dados.meta && <><Target size={8} />{Number(dados.meta).toFixed(row.formato === 'percent' ? 0 : 0)}{row.formato === 'percent' ? '%' : ''}</>}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showConfig && <ConfiguracaoGeral onClose={() => { setShowConfig(false); fetchRotinasData(); }} />}
    </div>
  );
};
export default MoovRotinas;

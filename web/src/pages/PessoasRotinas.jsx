import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings, Target, UserCheck } from 'lucide-react';

const ID_PESSOAS = 8;

const MESES = [
  { id: 1, label: 'JAN' }, { id: 2, label: 'FEV' }, { id: 3, label: 'MAR' },
  { id: 4, label: 'ABR' }, { id: 5, label: 'MAI' }, { id: 6, label: 'JUN' },
  { id: 7, label: 'JUL' }, { id: 8, label: 'AGO' }, { id: 9, label: 'SET' },
  { id: 10, label: 'OUT' }, { id: 11, label: 'NOV' }, { id: 12, label: 'DEZ' }
];

const PessoasRotinas = () => {
  const [rotinas, setRotinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => { fetchRotinasData(); }, []);

  const fetchRotinasData = async () => {
    setLoading(true);
    try {
      const { data: defs } = await supabase.from('rotinas_indicadores').select('*').eq('area_id', ID_PESSOAS).order('ordem', { ascending: true });
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
    const isGood = tipo === '<=' ? r <= m : r >= m;
    return isGood ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]';
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 text-indigo-900">
          <UserCheck size={24} />
          <h2 className="text-xl font-bold tracking-tight">Farol de Rotinas — Pessoas</h2>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => window.location.hash = 'metas'} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-gray-200 rounded transition-colors">Ir para Metas</button>
          <button onClick={() => setShowConfig(true)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-full transition-colors"><Settings size={18} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr className="bg-indigo-700 text-white">
              <th className="sticky left-0 z-30 p-4 w-72 text-left font-bold uppercase text-xs border-r border-white/10">Indicador</th>
              {MESES.map(mes => <th key={mes.id} className="p-3 min-w-[100px] text-center font-bold text-xs">{mes.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rotinas.map((row) => (
              <tr key={row.id} className="group hover:bg-gray-50/80 transition-colors">
                <td className="sticky left-0 z-10 p-4 bg-white border-r border-gray-100 font-medium text-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-indigo-600 font-bold uppercase">{row.responsavel}</span>
                    <span className="truncate" title={row.indicador}>{row.indicador}</span>
                  </div>
                </td>
                {MESES.map(mes => {
                  const d = row.meses[mes.id];
                  return (
                    <td key={mes.id} className={`p-0 border-r border-gray-50 relative ${getCellStatus(d.realizado, d.meta, row.tipo_comparacao)}`}>
                      <div className="flex flex-col h-full min-h-[60px] justify-center px-1">
                        <input 
                          className="w-full text-center bg-transparent focus:outline-none font-bold text-gray-800" 
                          defaultValue={d.realizado} 
                          onBlur={(e) => handleSave(row.id, mes.id, e.target.value)} 
                        />
                        <div className="flex items-center justify-center text-[10px] gap-1 opacity-40">
                          <Target size={8} /><span>{d.meta !== null ? d.meta : '-'}</span>
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
export default PessoasRotinas;

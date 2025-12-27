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

  // ESTILO DE CABEÇALHO AZUL (Conforme Imagem Rotinas)
  const headerClass = 'bg-[#3b82f6] text-white'; 

  return (
    <div className="flex flex-col h-full bg-white font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <h2 className="text-xl font-bold text-gray-800">Farol de Rotinas — Moov</h2>
        <div className="flex items-center gap-3">
            <button onClick={() => window.location.hash = 'metas'} className="px-3 py-1 text-sm font-medium text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors">
                Ir para Metas
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
            {/* Cabeçalho Azul */}
            <tr className={`${headerClass} font-bold uppercase text-center border-b border-blue-700`}>
              <th className={`sticky left-0 z-30 p-3 w-72 text-left border-r border-blue-400/30 ${headerClass}`}>Indicador</th>
              {MESES.map(mes => (
                 <th key={mes.id} className="p-3 min-w-[80px] border-r border-blue-400/30">{mes.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rotinas.map(row => (
              <tr key={row.id} className="group hover:bg-gray-50">
                {/* Coluna Indicador Fixa (Azul Claro) */}
                <td className="sticky left-0 z-10 p-3 bg-blue-50 border-r border-gray-200 font-semibold text-gray-700 shadow-sm">
                   <div className="flex flex-col">
                      <span>{row.indicador}</span>
                      <span className="text-[9px] text-gray-400 font-normal uppercase mt-0.5">
                         {row.tipo_comparacao === '<=' ? 'Menor é melhor' : 'Meta Mínima'}
                      </span>
                   </div>
                </td>

                {/* Dados */}
                {MESES.map(mes => {
                  const dados = row.meses[mes.id];
                  const bg = getCellStatus(dados.realizado, dados.meta, row.tipo_comparacao);
                  return (
                    <td key={mes.id} className="p-0 border-r border-gray-100 relative align-top h-12">
                      <div className={`flex flex-col h-full justify-center ${bg} transition-colors`}>
                        {/* Input Realizado */}
                        <div className="flex items-center justify-center">
                            <input 
                                className="w-full text-center bg-transparent font-bold text-gray-800 focus:outline-none"
                                placeholder="-"
                                defaultValue={dados.realizado}
                                onBlur={(e) => handleSave(row.id, mes.id, e.target.value)}
                            />
                        </div>
                        {/* Meta Pequena (Rodapé) - Só aparece se tiver meta */}
                        {dados.meta && (
                           <div className="absolute bottom-1 right-1 text-[8px] text-gray-500 font-medium opacity-60 flex items-center gap-0.5">
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
            areasContexto={[{ id: 3, nome: 'Moov' }]} // Garante edição da Moov
            onClose={() => { setShowConfig(false); fetchRotinasData(); }} 
        />
      )}
    </div>
  );
};

export default MoovRotinas;

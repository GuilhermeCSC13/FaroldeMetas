import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings, Target } from 'lucide-react';

const ID_MOOV = 3; // Área ID da Moov
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
      const { data: defs } = await supabase
        .from('rotinas_indicadores')
        .select('*')
        .eq('area_id', ID_MOOV)
        .order('ordem');
        
      const { data: valores } = await supabase
        .from('rotinas_mensais')
        .select('*')
        .eq('ano', 2026);

      const combined = (defs || []).map(r => {
        const row = { ...r, meses: {} };
        MESES.forEach(mes => {
          const valObj = valores?.find(v => v.rotina_id === r.id && v.mes === mes.id);
          row.meses[mes.id] = { 
            realizado: valObj ? valObj.valor_realizado : '', 
            meta: valObj ? valObj.valor_meta : null 
          };
        });
        return row;
      });
      setRotinas(combined);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSave = async (rotinaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    
    // Atualiza visualmente na hora
    setRotinas(prev => prev.map(r => {
        if (r.id !== rotinaId) return r;
        const novosMeses = { ...r.meses };
        novosMeses[mesId] = { ...novosMeses[mesId], realizado: valorNum };
        return { ...r, meses: novosMeses };
    }));

    // Salva no banco (Função Segura)
    await supabase.rpc('atualizar_realizado_rotina', { p_rotina_id: rotinaId, p_mes: mesId, p_valor: valorNum });
  };

  const getCellStatus = (real, meta, tipo) => {
    if (real === '' || real === null || meta === null) return 'bg-white';
    const r = parseFloat(real), m = parseFloat(meta);
    if (isNaN(r) || isNaN(m)) return 'bg-white';
    
    // Lógica Verde/Vermelho
    const isGood = (tipo === '<=') ? r <= m : r >= m;
    return isGood ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]';
  };

  // Cores do Tema Moov (Azul Profundo)
  const headerClass = 'bg-[#1e3a8a] text-white'; 
  const themeColor = 'blue';

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl shadow-lg border border-gray-200 overflow-hidden relative font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-gray-100">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Farol de Rotinas — Moov</h2>
           <p className="text-sm text-gray-400 mt-1">Indicadores Táticos Mensais</p>
        </div>
        
        <div className="flex items-center gap-4">
            <button 
                onClick={() => window.location.hash = 'metas'}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
                Ir para Metas
            </button>
            <button 
                onClick={() => setShowConfig(true)}
                className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-95"
            >
                <Settings size={20} />
            </button>
        </div>
      </div>

      {/* Tabela Moderna */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 animate-pulse">Carregando...</div>
        ) : (
          <div className="min-w-max">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className={`sticky left-0 z-30 p-4 w-72 text-left font-bold uppercase tracking-wider text-xs border-b border-r border-white/10 ${headerClass}`}>
                    Indicador
                  </th>
                  {MESES.map(mes => (
                    <th key={mes.id} className={`p-3 min-w-[100px] text-center font-bold text-xs border-b border-white/10 ${headerClass}`}>
                      {mes.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rotinas.map(row => (
                  <tr key={row.id} className="group hover:bg-gray-50/80 transition-colors">
                    
                    {/* Coluna Indicador Fixa */}
                    <td className="sticky left-0 z-10 p-4 bg-white border-r border-gray-100 group-hover:bg-gray-50 font-medium text-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-8 rounded-full bg-blue-900/20`}></div>
                        <span className="truncate text-sm" title={row.indicador}>{row.indicador}</span>
                      </div>
                    </td>

                    {/* Células de Dados (2 Andares) */}
                    {MESES.map(mes => {
                      const dados = row.meses[mes.id];
                      const bg = getCellStatus(dados.realizado, dados.meta, row.tipo_comparacao);
                      const temMeta = dados.meta !== null && dados.meta !== undefined;

                      return (
                        <td key={mes.id} className="p-0 border-r border-gray-50 relative align-top">
                          <div className={`flex flex-col h-full min-h-[60px] transition-colors duration-300 ${bg}`}>
                            
                            {/* Input Realizado (Grande) */}
                            <div className="flex-1 flex items-center justify-center pt-2">
                                <div className="flex items-baseline gap-0.5">
                                    {row.formato === 'currency' && <span className="text-gray-500/60 text-[10px]">R$</span>}
                                    <input 
                                        className="w-20 text-center bg-transparent focus:outline-none font-bold text-base text-gray-800 placeholder-gray-400/50"
                                        placeholder="-"
                                        defaultValue={dados.realizado}
                                        onBlur={(e) => handleSave(row.id, mes.id, e.target.value)}
                                    />
                                    {row.formato === 'percent' && <span className="text-gray-500/60 text-[10px]">%</span>}
                                </div>
                            </div>

                            {/* Meta (Pequena no Rodapé) */}
                            <div className="h-6 flex items-center justify-center text-[10px] gap-1 opacity-60 text-gray-600">
                                <Target size={8} />
                                <span className="font-medium">
                                    {temMeta ? Number(dados.meta).toFixed(row.formato === 'percent' ? 0 : 0) : ''}
                                </span>
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
        )}
      </div>

      {showConfig && <ConfiguracaoGeral onClose={() => { setShowConfig(false); fetchRotinasData(); }} />}
    </div>
  );
};

export default MoovRotinas;

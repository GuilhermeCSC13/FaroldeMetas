import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { X, Plus, Trash2, Target, List, Settings } from 'lucide-react';

const MESES = [
  { id: 1, label: 'Jan' }, { id: 2, label: 'Fev' }, { id: 3, label: 'Mar' },
  { id: 4, label: 'Abr' }, { id: 5, label: 'Mai' }, { id: 6, label: 'Jun' },
  { id: 7, label: 'Jul' }, { id: 8, label: 'Ago' }, { id: 9, label: 'Set' },
  { id: 10, label: 'Out' }, { id: 11, label: 'Nov' }, { id: 12, label: 'Dez' }
];

// Fallback: Se não receber nada, assume que é a Operação
const AREAS_PADRAO = [
  { id: 4, nome: 'PCO' },
  { id: 5, nome: 'Gestão de Motoristas' }
];

const ConfiguracaoGeral = ({ onClose, areasContexto }) => {
  // LÓGICA DE SELEÇÃO: Usa o que veio por prop, se não tiver, usa padrão
  const areasDisponiveis = (areasContexto && areasContexto.length > 0) ? areasContexto : AREAS_PADRAO;
  
  const [tipo, setTipo] = useState('metas'); 
  // Inicializa já com o ID correto da área (Ex: 3 se for Moov)
  const [areaId, setAreaId] = useState(areasDisponiveis[0].id);
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tipo, areaId]);

  const fetchData = async () => {
    setLoading(true);
    let dataItems = [];
    let dataMetas = [];

    try {
      if (tipo === 'metas') {
        const { data: rows } = await supabase.from('metas_farol').select('*').eq('area_id', areaId).order('id');
        const { data: values } = await supabase.from('metas_farol_mensal').select('*').eq('ano', 2026);
        dataItems = rows || [];
        dataMetas = values || [];
      } else {
        const { data: rows } = await supabase.from('rotinas_indicadores').select('*').eq('area_id', areaId).order('ordem');
        const { data: values } = await supabase.from('rotinas_mensais').select('*').eq('ano', 2026);
        dataItems = rows || [];
        dataMetas = values || [];
      }

      const combined = dataItems.map(item => {
        const row = { ...item, valores_mensais: {} };
        MESES.forEach(mes => {
          const fkId = item.id;
          const fkColumn = tipo === 'metas' ? 'meta_id' : 'rotina_id';
          const found = dataMetas.find(v => v[fkColumn] === fkId && v.mes === mes.id);
          row.valores_mensais[mes.id] = found ? found.valor_meta : '';
        });
        return row;
      });

      setItems(combined);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleAdd = async () => {
    const nome = prompt("Nome do novo Indicador:");
    if (!nome) return;

    if (tipo === 'metas') {
      await supabase.from('metas_farol').insert({
        area_id: areaId,
        indicador: nome,
        nome_meta: nome,
        peso: 0,
        unidade: '',
        tipo_comparacao: '>=',
        ano: 2026
      });
    } else {
      await supabase.from('rotinas_indicadores').insert({
        area_id: areaId,
        indicador: nome,
        formato: 'num',
        ordem: items.length + 1,
        tipo_comparacao: '>='
      });
    }
    fetchData(); 
  };

  const handleDelete = async (id) => {
    if(!confirm("Tem certeza? Isso apaga todo o histórico.")) return;
    const tableMain = tipo === 'metas' ? 'metas_farol' : 'rotinas_indicadores';
    const tableMensal = tipo === 'metas' ? 'metas_farol_mensal' : 'rotinas_mensais';
    const fkCol = tipo === 'metas' ? 'meta_id' : 'rotina_id';

    if(tipo === 'metas') await supabase.from('resultados_farol').delete().eq('meta_id', id);
    await supabase.from(tableMensal).delete().eq(fkCol, id);
    await supabase.from(tableMain).delete().eq('id', id);
    fetchData();
  };

  const updateRowProp = async (id, field, value) => {
    const table = tipo === 'metas' ? 'metas_farol' : 'rotinas_indicadores';
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    await supabase.from(table).update({ [field]: value }).eq('id', id);
  };

  const saveMonthlyTarget = async (itemId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    const table = tipo === 'metas' ? 'metas_farol_mensal' : 'rotinas_mensais';
    const fkColumn = tipo === 'metas' ? 'meta_id' : 'rotina_id';

    const { data: existing } = await supabase.from(table)
       .select('*').eq(fkColumn, itemId).eq('ano', 2026).eq('mes', mesId).single();
    
    if (existing) {
        await supabase.from(table).update({ valor_meta: valorNum }).eq('id', existing.id);
    } else {
        await supabase.from(table).insert({ [fkColumn]: itemId, ano: 2026, mes: mesId, valor_meta: valorNum });
    }
  };

  const handleMonthlyChange = (itemId, mesId, valor) => {
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const newVals = { ...i.valores_mensais, [mesId]: valor };
      return { ...i, valores_mensais: newVals };
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm font-sans">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col border border-gray-200">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center p-5 border-b bg-gray-50 rounded-t-xl gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               <Settings size={24} /> Configuração de Metas
            </h2>
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button onClick={() => setTipo('metas')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${tipo === 'metas' ? 'bg-white shadow text-blue-700' : 'text-gray-600'}`}>
                <Target size={16} /> Metas
              </button>
              <button onClick={() => setTipo('rotinas')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${tipo === 'rotinas' ? 'bg-white shadow text-green-700' : 'text-gray-600'}`}>
                <List size={16} /> Rotinas
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Dropdown de Áreas */}
             <select 
                value={areaId} 
                onChange={(e) => setAreaId(Number(e.target.value))}
                className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 font-semibold"
                disabled={areasDisponiveis.length === 1} 
              >
                {areasDisponiveis.map(a => <option key={a.id} value={a.id}>{a.nome || a.label}</option>)}
             </select>

             <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
          </div>
        </div>

        {/* Tabela de Edição */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
          {loading ? ( <div className="text-center py-20 text-gray-400">Carregando dados...</div> ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-600 uppercase font-bold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 w-64 border-r">Indicador</th>
                    {tipo === 'metas' ? (
                        <>
                           <th className="p-3 w-16 text-center border-r">Peso</th>
                           <th className="p-3 w-16 text-center border-r">Unid.</th>
                           <th className="p-3 w-16 text-center border-r">Tipo</th>
                        </>
                    ) : (
                        <>
                           <th className="p-3 w-20 text-center border-r">Formato</th>
                           <th className="p-3 w-24 text-center border-r">Resp.</th>
                           <th className="p-3 w-16 text-center border-r">Tipo</th>
                        </>
                    )}
                    {MESES.map(m => (<th key={m.id} className="p-3 text-center min-w-[60px] border-r bg-yellow-50 text-yellow-800">{m.label}</th>))}
                    <th className="p-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="p-2 border-r">
                         <input 
                            value={item.nome_meta || item.indicador}
                            onChange={(e) => updateRowProp(item.id, tipo === 'metas' ? 'nome_meta' : 'indicador', e.target.value)}
                            className="w-full font-semibold bg-transparent focus:outline-none focus:text-blue-600"
                         />
                      </td>

                      {tipo === 'metas' && (
                        <>
                           <td className="p-1 border-r"><input type="number" value={item.peso} onChange={(e) => updateRowProp(item.id, 'peso', e.target.value)} className="w-full text-center bg-transparent" /></td>
                           <td className="p-1 border-r"><input value={item.unidade} onChange={(e) => updateRowProp(item.id, 'unidade', e.target.value)} className="w-full text-center bg-transparent" /></td>
                        </>
                      )}

                      {tipo === 'rotinas' && (
                         <>
                            <td className="p-1 border-r"><select value={item.formato} onChange={(e) => updateRowProp(item.id, 'formato', e.target.value)} className="w-full bg-transparent"><option value="num">123</option><option value="percent">%</option><option value="currency">R$</option></select></td>
                            <td className="p-1 border-r"><input value={item.responsavel||''} onChange={(e) => updateRowProp(item.id, 'responsavel', e.target.value)} className="w-full text-center bg-transparent" /></td>
                         </>
                      )}
                      
                      <td className="p-1 border-r">
                         <select value={item.tipo_comparacao} onChange={(e) => updateRowProp(item.id, 'tipo_comparacao', e.target.value)} className="w-full text-center bg-transparent text-[10px]">
                            <option value=">=">{">="}</option>
                            <option value="<=">{"<="}</option>
                         </select>
                      </td>

                      {MESES.map(mes => (
                        <td key={mes.id} className="p-0 border-r bg-yellow-50/10">
                          <input 
                            value={item.valores_mensais[mes.id] || ''}
                            onChange={(e) => handleMonthlyChange(item.id, mes.id, e.target.value)}
                            onBlur={(e) => saveMonthlyTarget(item.id, mes.id, e.target.value)}
                            className="w-full h-9 text-center bg-transparent text-gray-700 font-medium focus:bg-yellow-100 focus:outline-none"
                            placeholder="-"
                          />
                        </td>
                      ))}
                      <td className="p-2 text-center">
                         <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ConfiguracaoGeral;

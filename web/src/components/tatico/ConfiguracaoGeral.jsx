import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { X, Plus, Trash2, Save, Target, List } from 'lucide-react';

const MESES = [
  { id: 1, label: 'Jan' }, { id: 2, label: 'Fev' }, { id: 3, label: 'Mar' },
  { id: 4, label: 'Abr' }, { id: 5, label: 'Mai' }, { id: 6, label: 'Jun' },
  { id: 7, label: 'Jul' }, { id: 8, label: 'Ago' }, { id: 9, label: 'Set' },
  { id: 10, label: 'Out' }, { id: 11, label: 'Nov' }, { id: 12, label: 'Dez' }
];

const AREAS = [
  { id: 4, label: 'PCO' },
  { id: 5, label: 'Gestão de Motoristas' }
];

const ConfiguracaoGeral = ({ onClose }) => {
  const [tipo, setTipo] = useState('metas'); // 'metas' ou 'rotinas'
  const [areaId, setAreaId] = useState(4); // Default PCO
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
        // Busca Metas
        const { data: rows } = await supabase.from('metas_farol').select('*').eq('area_id', areaId).order('id');
        const { data: values } = await supabase.from('metas_farol_mensal').select('*').eq('ano', 2026);
        dataItems = rows || [];
        dataMetas = values || [];
      } else {
        // Busca Rotinas
        const { data: rows } = await supabase.from('rotinas_indicadores').select('*').eq('area_id', areaId).order('ordem');
        const { data: values } = await supabase.from('rotinas_mensais').select('*').eq('ano', 2026);
        dataItems = rows || [];
        dataMetas = values || [];
      }

      // Combina
      const combined = dataItems.map(item => {
        const row = { ...item, valores_mensais: {} };
        MESES.forEach(mes => {
          const fkId = tipo === 'metas' ? item.id : item.id; // ID da linha pai
          const fkColumn = tipo === 'metas' ? 'meta_id' : 'rotina_id';
          
          const found = dataMetas.find(v => v[fkColumn] === fkId && v.mes === mes.id);
          row.valores_mensais[mes.id] = found ? found.valor_meta : '';
        });
        return row;
      });

      setItems(combined);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const nome = prompt("Nome do Indicador:");
    if (!nome) return;

    if (tipo === 'metas') {
      await supabase.from('metas_farol').insert({
        area_id: areaId,
        indicador: nome,
        peso: 0,
        unidade: '',
        tipo_comparacao: '>='
      });
    } else {
      await supabase.from('rotinas_indicadores').insert({
        area_id: areaId,
        indicador: nome,
        formato: 'num',
        ordem: items.length + 1
      });
    }
    fetchData();
  };

  const handleDelete = async (id) => {
    if(!confirm("Tem certeza? Isso apaga todo o histórico.")) return;
    
    if (tipo === 'metas') {
      await supabase.from('metas_farol_mensal').delete().eq('meta_id', id);
      await supabase.from('resultados_farol').delete().eq('meta_id', id);
      await supabase.from('metas_farol').delete().eq('id', id);
    } else {
      await supabase.from('rotinas_mensais').delete().eq('rotina_id', id);
      await supabase.from('rotinas_indicadores').delete().eq('id', id);
    }
    fetchData();
  };

  // Atualiza propriedades da linha (Peso, Unidade, Formato)
  const updateRowProp = async (id, field, value) => {
    const table = tipo === 'metas' ? 'metas_farol' : 'rotinas_indicadores';
    
    // Atualiza localmente para não pular o cursor
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

    await supabase.from(table).update({ [field]: value }).eq('id', id);
  };

  // Salva a META MENSAL (Jan, Fev...)
  const saveMonthlyTarget = async (itemId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    
    const table = tipo === 'metas' ? 'metas_farol_mensal' : 'rotinas_mensais';
    const fkColumn = tipo === 'metas' ? 'meta_id' : 'rotina_id';

    // Para rotinas, cuidado para não sobrescrever o realizado se ele estiver na mesma tabela
    // Mas na nossa arquitetura rotinas_mensais tem valor_meta e valor_realizado.
    // O upsert deve cuidar apenas do campo que mudou se usarmos update, mas upsert substitui a linha.
    // Vamos usar estratégia segura: Check if exists -> Update or Insert
    
    // Simplificação robusta: Upsert com ON CONFLICT UPDATE
    // Supabase JS upsert faz isso por padrão se passarmos o ID ou constraint
    
    // Precisamos garantir que não apagamos o realizado ao salvar a meta
    // Vamos fazer um SELECT antes é mais seguro
    const { data: existing } = await supabase.from(table)
       .select('*').eq(fkColumn, itemId).eq('ano', 2026).eq('mes', mesId).single();
    
    const payload = {
        [fkColumn]: itemId,
        ano: 2026,
        mes: mesId,
        valor_meta: valorNum
    };
    
    // Se já existe, preserva o realizado
    if (existing) {
        payload.id = existing.id; // Força update pelo ID
        // payload.valor_realizado = existing.valor_realizado; // (Não precisa se o upsert for parcial, mas supabase upsert full replace sem ignoreDuplicates)
        // O Supabase upsert substitui TUDO se não especificarmos.
        // A melhor forma é usar .update() se tiver ID, e .insert() se não.
        await supabase.from(table).update({ valor_meta: valorNum }).eq('id', existing.id);
    } else {
        await supabase.from(table).insert(payload);
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col border border-gray-200">
        
        {/* Header de Controle */}
        <div className="flex flex-col md:flex-row justify-between items-center p-5 border-b bg-gray-50 rounded-t-xl gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               <SettingsIcon /> Configuração Geral
            </h2>
            
            {/* Seletor de Tipo */}
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button 
                onClick={() => setTipo('metas')}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${tipo === 'metas' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
              >
                <Target size={16} /> Metas
              </button>
              <button 
                onClick={() => setTipo('rotinas')}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${tipo === 'rotinas' ? 'bg-white shadow text-green-700' : 'text-gray-600 hover:text-gray-800'}`}
              >
                <List size={16} /> Rotinas
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Seletor de Área */}
             <select 
                value={areaId} 
                onChange={(e) => setAreaId(Number(e.target.value))}
                className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
              >
                {AREAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
             </select>

             <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors">
               <X size={24} />
             </button>
          </div>
        </div>

        {/* Tabela de Edição */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
          {loading ? (
             <div className="text-center py-20 text-gray-400">Carregando dados...</div>
          ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-600 uppercase font-bold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 w-64 border-r">Indicador</th>
                    
                    {/* Colunas Dinâmicas baseadas no Tipo */}
                    {tipo === 'metas' ? (
                        <>
                           <th className="p-3 w-20 text-center border-r">Peso</th>
                           <th className="p-3 w-20 text-center border-r">Unid.</th>
                           <th className="p-3 w-24 text-center border-r">Tipo</th>
                        </>
                    ) : (
                        <>
                           <th className="p-3 w-24 text-center border-r">Formato</th>
                           <th className="p-3 w-32 text-center border-r">Responsável</th>
                        </>
                    )}

                    {/* Meses */}
                    {MESES.map(m => (
                        <th key={m.id} className="p-3 text-center min-w-[60px] border-r bg-yellow-50/50 text-yellow-800">
                           {m.label} (Meta)
                        </th>
                    ))}
                    <th className="p-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                      {/* Nome Indicador */}
                      <td className="p-2 border-r">
                         <input 
                            value={item.indicador || item.nome_meta}
                            onChange={(e) => updateRowProp(item.id, tipo === 'metas' ? 'indicador' : 'indicador', e.target.value)} // Ajustar nome coluna se precisar
                            className="w-full font-semibold bg-transparent focus:outline-none focus:text-blue-600"
                         />
                      </td>

                      {/* Campos Específicos METAS */}
                      {tipo === 'metas' && (
                        <>
                           <td className="p-1 border-r">
                             <input type="number" value={item.peso} onChange={(e) => updateRowProp(item.id, 'peso', e.target.value)} className="w-full text-center h-full bg-transparent focus:bg-white focus:ring-1" />
                           </td>
                           <td className="p-1 border-r">
                             <input value={item.unidade} onChange={(e) => updateRowProp(item.id, 'unidade', e.target.value)} className="w-full text-center h-full bg-transparent focus:bg-white focus:ring-1" />
                           </td>
                           <td className="p-1 border-r">
                             <select value={item.tipo_comparacao} onChange={(e) => updateRowProp(item.id, 'tipo_comparacao', e.target.value)} className="w-full text-center bg-transparent text-[10px]">
                                <option value=">=">{">="}</option>
                                <option value="<=">{"<="}</option>
                             </select>
                           </td>
                        </>
                      )}

                      {/* Campos Específicos ROTINAS */}
                      {tipo === 'rotinas' && (
                        <>
                           <td className="p-1 border-r">
                             <select value={item.formato} onChange={(e) => updateRowProp(item.id, 'formato', e.target.value)} className="w-full text-center bg-transparent text-[10px]">
                                <option value="num">123</option>
                                <option value="percent">%</option>
                                <option value="currency">R$</option>
                             </select>
                           </td>
                           <td className="p-1 border-r">
                             <input value={item.responsavel || ''} onChange={(e) => updateRowProp(item.id, 'responsavel', e.target.value)} className="w-full text-center h-full bg-transparent focus:bg-white focus:ring-1" />
                           </td>
                        </>
                      )}

                      {/* Inputs de Metas Mensais */}
                      {MESES.map(mes => (
                        <td key={mes.id} className="p-0 border-r bg-yellow-50/10">
                          <input 
                            value={item.valores_mensais[mes.id] || ''}
                            onChange={(e) => handleMonthlyChange(item.id, mes.id, e.target.value)}
                            onBlur={(e) => saveMonthlyTarget(item.id, mes.id, e.target.value)}
                            className="w-full h-9 text-center bg-transparent text-gray-700 font-medium focus:bg-yellow-100 focus:outline-none transition-colors"
                            placeholder="-"
                          />
                        </td>
                      ))}

                      <td className="p-2 text-center">
                         <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={16} />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t rounded-b-xl flex justify-between items-center">
            <button 
                onClick={handleAdd}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-semibold shadow-lg shadow-blue-200 transition-all"
            >
                <Plus size={18} /> Novo Indicador
            </button>
            <p className="text-xs text-gray-400">
               <span className="font-bold text-gray-600">Dica:</span> Selecione "Metas" ou "Rotinas" no topo para alternar as tabelas. As alterações são salvas automaticamente.
            </p>
        </div>
      </div>
    </div>
  );
};

// Ícone SVG simples para o header
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-2"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
);

export default ConfiguracaoGeral;

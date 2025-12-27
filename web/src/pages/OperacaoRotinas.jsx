import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral'; // Reaproveitando o configurador geral
import { Settings } from 'lucide-react';

const ID_PCO = 4;
const ID_MOTORISTAS = 5;

const MESES = [
  { id: 1, label: 'jan/26' }, { id: 2, label: 'fev/26' }, { id: 3, label: 'mar/26' },
  { id: 4, label: 'abr/26' }, { id: 5, label: 'mai/26' }, { id: 6, label: 'jun/26' },
  { id: 7, label: 'jul/26' }, { id: 8, label: 'ago/26' }, { id: 9, label: 'set/26' },
  { id: 10, label: 'out/26' }, { id: 11, label: 'nov/26' }, { id: 12, label: 'dez/26' }
];

const OperacaoRotinas = () => {
  const [areas, setAreas] = useState([]);
  const [areaSelecionada, setAreaSelecionada] = useState(null);
  const [rotinas, setRotinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    fetchAreas();
  }, []);

  useEffect(() => {
    if (areaSelecionada) fetchRotinasData();
  }, [areaSelecionada]);

  const fetchAreas = async () => {
    const { data } = await supabase.from('areas').select('*').eq('ativa', true).order('id');
    if (data) {
      const filtered = data.filter(a => a.id == ID_PCO || a.id == ID_MOTORISTAS);
      setAreas(filtered.length > 0 ? filtered : data);
      setAreaSelecionada(filtered.length > 0 ? filtered[0].id : data[0].id);
    }
  };

  const fetchRotinasData = async () => {
    setLoading(true);
    try {
      // 1. Busca Indicadores
      const { data: defs } = await supabase
        .from('rotinas_indicadores')
        .select('*')
        .eq('area_id', areaSelecionada)
        .order('ordem', { ascending: true });

      // 2. Busca Valores (Meta e Realizado)
      const { data: valores } = await supabase
        .from('rotinas_mensais')
        .select('*')
        .eq('ano', 2026);

      // 3. Monta a tabela
      const combined = (defs || []).map(r => {
        const row = { ...r, meses: {} };
        MESES.forEach(mes => {
          const valObj = valores?.find(v => v.rotina_id === r.id && v.mes === mes.id);
          row.meses[mes.id] = {
            realizado: valObj ? valObj.valor_realizado : '',
            // AQUI ESTÁ O SEGREDO: Pegamos a meta para exibir
            meta: valObj ? valObj.valor_meta : null 
          };
        });
        return row;
      });

      setRotinas(combined);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (rotinaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    
    // Busca registro atual para não perder a meta ao salvar o realizado
    const { data: current } = await supabase
        .from('rotinas_mensais')
        .select('valor_meta')
        .eq('rotina_id', rotinaId)
        .eq('ano', 2026)
        .eq('mes', mesId)
        .single();
    
    const metaAtual = current ? current.valor_meta : null;

    await supabase.from('rotinas_mensais').upsert({
        rotina_id: rotinaId,
        ano: 2026,
        mes: mesId,
        valor_realizado: valorNum,
        valor_meta: metaAtual // Mantém a meta existente
    });
  };

  const isPCO = areaSelecionada == ID_PCO;
  const headerColor = isPCO ? 'bg-blue-200 border-blue-300' : 'bg-[#d0e0e3] border-gray-300';
  const subHeaderColor = isPCO ? 'bg-blue-100' : 'bg-[#d0e0e3]';

  return (
    <div className="flex flex-col h-full bg-white rounded shadow-sm overflow-hidden relative">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800">Farol de Rotinas</h2>
        
        <div className="flex items-center gap-4">
            <div className="flex space-x-2">
            {areas.map(area => (
                <button
                key={area.id}
                onClick={() => setAreaSelecionada(area.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all border-b-2 ${
                    areaSelecionada === area.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                >
                {area.nome}
                </button>
            ))}
            </div>
            
            <button 
                onClick={() => setShowConfig(true)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Configurar Metas"
            >
                <Settings size={20} />
            </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando rotinas...</div>
        ) : (
          <div className="border border-gray-300 rounded overflow-hidden shadow-sm">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className={`${headerColor} text-gray-800 text-center font-bold uppercase`}>
                  {!isPCO && <th className="p-2 border border-gray-400 w-24">Responsável</th>}
                  <th className="p-2 border border-gray-400 w-64 text-left pl-4">Indicador</th>
                  {MESES.map(mes => (
                    <th key={mes.id} className="p-2 border border-gray-400 min-w-[80px]">
                      {mes.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rotinas.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-gray-50 text-center">
                    {!isPCO && (
                      <td className="p-2 border border-gray-300 font-medium text-gray-700 bg-[#e2efda]">
                        {row.responsavel || '-'}
                      </td>
                    )}
                    <td className={`p-2 border border-gray-300 text-left font-medium text-gray-800 ${subHeaderColor}`}>
                      {row.indicador}
                    </td>
                    {MESES.map(mes => {
                        const dados = row.meses[mes.id];
                        return (
                            <td key={mes.id} className="border border-gray-300 p-0 h-10 bg-white relative">
                                <div className="flex flex-col h-full justify-center relative">
                                    
                                    {/* --- AQUI ESTÁ A META PEQUENA NO CANTO --- */}
                                    <div className="absolute top-0 right-1 text-[9px] text-gray-400 select-none pointer-events-none">
                                        {dados.meta ? Number(dados.meta).toFixed(row.formato === 'percent' ? 2 : 0) : ''}
                                    </div>

                                    {/* Input Realizado */}
                                    <div className="flex items-center justify-center px-1 pt-1">
                                        {row.formato === 'currency' && <span className="text-gray-400 mr-1 text-[9px]">R$</span>}
                                        <input 
                                            className="w-full text-center bg-transparent focus:outline-none text-gray-800 font-medium"
                                            defaultValue={dados.realizado}
                                            onBlur={(e) => handleSave(row.id, mes.id, e.target.value)}
                                        />
                                        {row.formato === 'percent' && <span className="text-gray-400 ml-0.5 text-[9px]">%</span>}
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

      {showConfig && (
        <ConfiguracaoGeral onClose={() => { setShowConfig(false); fetchRotinasData(); }} />
      )}
    </div>
  );
};

export default OperacaoRotinas;

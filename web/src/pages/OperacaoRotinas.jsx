import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings, User, Target, AlertCircle } from 'lucide-react';

const ID_PCO = 4;
const ID_MOTORISTAS = 5;

const MESES = [
  { id: 1, label: 'JAN' }, { id: 2, label: 'FEV' }, { id: 3, label: 'MAR' },
  { id: 4, label: 'ABR' }, { id: 5, label: 'MAI' }, { id: 6, label: 'JUN' },
  { id: 7, label: 'JUL' }, { id: 8, label: 'AGO' }, { id: 9, label: 'SET' },
  { id: 10, label: 'OUT' }, { id: 11, label: 'NOV' }, { id: 12, label: 'DEZ' }
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
      // Busca indicadores (incluindo o novo campo tipo_comparacao)
      const { data: defs } = await supabase
        .from('rotinas_indicadores')
        .select('*')
        .eq('area_id', areaSelecionada)
        .order('ordem', { ascending: true });

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
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- NOVA FUNÇÃO DE CORES ---
  const getCellStatus = (real, meta, tipoComparacao) => {
    if (real === '' || real === null || meta === null) return 'bg-white'; // Sem dados

    const r = parseFloat(real);
    const m = parseFloat(meta);

    // Lógica: Maior ou Menor Melhor
    let isGood = false;
    if (tipoComparacao === '<=' || tipoComparacao === 'menor') {
      isGood = r <= m; // Ex: Acidentes (Real 1 <= Meta 2 -> Bom)
    } else {
      isGood = r >= m; // Ex: Vendas (Real 100 >= Meta 90 -> Bom)
    }

    return isGood ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const handleSave = async (rotinaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    
    // 1. ATUALIZAÇÃO VISUAL IMEDIATA (Resolve o problema de "não gravou")
    setRotinas(prev => prev.map(r => {
      if (r.id !== rotinaId) return r;
      const novosMeses = { ...r.meses };
      novosMeses[mesId] = { ...novosMeses[mesId], realizado: valorNum };
      return { ...r, meses: novosMeses };
    }));

    // 2. TENTA SALVAR NO BANCO
    try {
        // Busca meta atual para não perder
        const { data: current } = await supabase
            .from('rotinas_mensais')
            .select('valor_meta')
            .eq('rotina_id', rotinaId)
            .eq('ano', 2026)
            .eq('mes', mesId)
            .single();
        
        const metaAtual = current ? current.valor_meta : null;

        const { error } = await supabase.from('rotinas_mensais').upsert({
            rotina_id: rotinaId,
            ano: 2026,
            mes: mesId,
            valor_realizado: valorNum,
            valor_meta: metaAtual 
        });

        if (error) throw error;
    } catch (err) {
        console.error("Erro ao salvar:", err);
        // Opcional: Reverter visualmente se der erro grave, 
        // mas geralmente o usuário tenta de novo.
    }
  };

  const isPCO = areaSelecionada == ID_PCO;
  const themeColor = isPCO ? 'blue' : 'emerald';
  const headerClass = isPCO ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white';

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl shadow-lg border border-gray-200 overflow-hidden relative font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-gray-100">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Farol de Rotinas</h2>
           <p className="text-sm text-gray-400 mt-1">Acompanhamento mensal de indicadores táticos</p>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg">
                {areas.map(area => (
                    <button
                    key={area.id}
                    onClick={() => setAreaSelecionada(area.id)}
                    className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                        areaSelecionada === area.id
                        ? `bg-white text-${themeColor}-600 shadow-sm`
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    >
                    {area.nome}
                    </button>
                ))}
            </div>
            
            <button 
                onClick={() => setShowConfig(true)}
                className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-95"
                title="Configurar Metas"
            >
                <Settings size={20} />
            </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 animate-pulse">
            Carregando...
          </div>
        ) : (
          <div className="min-w-max">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr>
                    <th className={`sticky left-0 z-30 p-4 w-72 text-left font-bold uppercase tracking-wider text-xs border-b border-r border-white/10 ${headerClass}`}>
                        Indicador
                    </th>
                    {!isPCO && (
                        <th className={`sticky left-72 z-30 p-4 w-32 text-center font-bold uppercase tracking-wider text-xs border-b border-r border-white/10 ${headerClass}`}>
                            Resp.
                        </th>
                    )}
                    {MESES.map(mes => (
                        <th key={mes.id} className={`p-3 min-w-[100px] text-center font-bold text-xs border-b border-white/10 ${headerClass}`}>
                            {mes.label}
                        </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rotinas.map((row, idx) => (
                  <tr key={row.id || idx} className="group hover:bg-gray-50/80 transition-colors">
                    
                    {/* Coluna Fixa */}
                    <td className="sticky left-0 z-10 p-4 bg-white border-r border-gray-100 group-hover:bg-gray-50 font-medium text-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-8 rounded-full bg-${themeColor}-500/20`}></div>
                        <div className="flex flex-col">
                            <span className="truncate text-sm" title={row.indicador}>{row.indicador}</span>
                            {/* Mostra a regra visualmente para o usuário saber */}
                            <span className="text-[9px] text-gray-400 uppercase">
                                {row.tipo_comparacao === '<=' ? 'Menor é melhor' : 'Meta Mínima'}
                            </span>
                        </div>
                      </div>
                    </td>

                    {!isPCO && (
                      <td className="sticky left-72 z-10 p-2 bg-white border-r border-gray-100 group-hover:bg-gray-50 text-center text-xs text-gray-500">
                         {row.responsavel || '-'}
                      </td>
                    )}

                    {MESES.map(mes => {
                        const dados = row.meses[mes.id];
                        const temMeta = dados.meta !== null && dados.meta !== undefined;
                        // Calcula cor do background baseado na meta
                        const bgStatus = getCellStatus(dados.realizado, dados.meta, row.tipo_comparacao);
                        
                        return (
                            <td key={mes.id} className="p-0 border-r border-gray-50 relative align-top">
                                <div className={`flex flex-col h-full min-h-[60px] transition-colors ${bgStatus}`}>
                                    
                                    {/* Input Realizado */}
                                    <div className="flex-1 flex items-center justify-center pt-2">
                                        <div className="flex items-baseline gap-0.5">
                                            {row.formato === 'currency' && <span className="text-opacity-50 text-[10px] font-light">R$</span>}
                                            <input 
                                                className="w-20 text-center bg-transparent focus:outline-none font-bold text-base placeholder-gray-300"
                                                placeholder="-"
                                                defaultValue={dados.realizado}
                                                // onBlur dispara a gravação
                                                onBlur={(e) => handleSave(row.id, mes.id, e.target.value)}
                                            />
                                            {row.formato === 'percent' && <span className="text-opacity-50 text-[10px] font-light">%</span>}
                                        </div>
                                    </div>

                                    {/* Meta (Rodapé) */}
                                    <div className="h-6 flex items-center justify-center text-[10px] gap-1 opacity-60">
                                        <Target size={8} />
                                        <span className="font-medium">
                                            {temMeta ? Number(dados.meta).toFixed(row.formato === 'percent' ? 2 : 0) : ''}
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

      {showConfig && (
        <ConfiguracaoGeral onClose={() => { setShowConfig(false); fetchRotinasData(); }} />
      )}
    </div>
  );
};

export default OperacaoRotinas;

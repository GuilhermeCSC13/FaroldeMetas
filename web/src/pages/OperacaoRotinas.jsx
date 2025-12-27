import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings, User, Target } from 'lucide-react';

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
      // Busca definições
      const { data: defs } = await supabase
        .from('rotinas_indicadores')
        .select('*')
        .eq('area_id', areaSelecionada)
        .order('ordem', { ascending: true });

      // Busca valores
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

  // --- NOVA FUNÇÃO DE SALVAR (USA RPC DO BANCO) ---
  const handleSave = async (rotinaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    
    // 1. Atualização Visual Imediata (Para não piscar)
    setRotinas(prev => prev.map(r => {
      if (r.id !== rotinaId) return r;
      const novosMeses = { ...r.meses };
      novosMeses[mesId] = { ...novosMeses[mesId], realizado: valorNum };
      return { ...r, meses: novosMeses };
    }));

    // 2. Chama a função segura no Banco
    const { error } = await supabase.rpc('atualizar_realizado_rotina', {
      p_rotina_id: rotinaId,
      p_mes: mesId,
      p_valor: valorNum
    });

    if (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar. Verifique sua conexão.");
    }
  };

  // --- LÓGICA DE CORES (VERDE/VERMELHO) ---
  const getCellStatus = (real, meta, tipoComparacao) => {
    // Se não tiver meta ou realizado, fica branco
    if (real === '' || real === null || meta === null || meta === undefined) return 'bg-white';

    const r = parseFloat(real);
    const m = parseFloat(meta);
    if (isNaN(r) || isNaN(m)) return 'bg-white';

    let isGood = false;
    // Verifica se "Menor é Melhor" (ex: Acidentes) ou "Maior é Melhor" (ex: Vendas)
    if (tipoComparacao === '<=' || tipoComparacao === 'menor') {
      isGood = r <= m;
    } else {
      isGood = r >= m; 
    }

    // Retorna cores suaves
    return isGood ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]'; // Verde Claro / Vermelho Claro
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
            Carregando indicadores...
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
                    
                    {/* Coluna Indicador */}
                    <td className="sticky left-0 z-10 p-4 bg-white border-r border-gray-100 group-hover:bg-gray-50 font-medium text-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-8 rounded-full bg-${themeColor}-500/20`}></div>
                        <div className="flex flex-col">
                            <span className="truncate text-sm" title={row.indicador}>{row.indicador}</span>
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

                    {/* Meses */}
                    {MESES.map(mes => {
                        const dados = row.meses[mes.id];
                        const temMeta = dados.meta !== null && dados.meta !== undefined;
                        // Calcula cor aqui
                        const bgStatus = getCellStatus(dados.realizado, dados.meta, row.tipo_comparacao);
                        
                        return (
                            <td key={mes.id} className="p-0 border-r border-gray-50 relative align-top">
                                <div className={`flex flex-col h-full min-h-[60px] transition-colors duration-300 ${bgStatus}`}>
                                    
                                    {/* Input Realizado */}
                                    <div className="flex-1 flex items-center justify-center pt-2">
                                        <div className="flex items-baseline gap-0.5">
                                            {row.formato === 'currency' && <span className="text-gray-500/60 text-[10px] font-light">R$</span>}
                                            <input 
                                                className="w-20 text-center bg-transparent focus:outline-none font-bold text-base text-gray-800 placeholder-gray-400/50"
                                                placeholder="-"
                                                defaultValue={dados.realizado}
                                                onBlur={(e) => handleSave(row.id, mes.id, e.target.value)}
                                            />
                                            {row.formato === 'percent' && <span className="text-gray-500/60 text-[10px] font-light">%</span>}
                                        </div>
                                    </div>

                                    {/* Meta (Rodapé) */}
                                    <div className="h-6 flex items-center justify-center text-[10px] gap-1 opacity-60 text-gray-600">
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

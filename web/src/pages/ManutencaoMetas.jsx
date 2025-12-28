import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings } from 'lucide-react';

const ID_MANUTENCAO = 2;

const MESES = [
  { id: 1, label: 'jan/26' }, { id: 2, label: 'fev/26' }, { id: 3, label: 'mar/26' },
  { id: 4, label: 'abr/26' }, { id: 5, label: 'mai/26' }, { id: 6, label: 'jun/26' },
  { id: 7, label: 'jul/26' }, { id: 8, label: 'ago/26' }, { id: 9, label: 'set/26' },
  { id: 10, label: 'out/26' }, { id: 11, label: 'nov/26' }, { id: 12, label: 'dez/26' }
];

const ManutencaoMetas = () => {
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    fetchMetasData();
  }, []);

  const fetchMetasData = async () => {
    setLoading(true);
    try {
      // Busca Metas da Área 2 (Manutenção)
      const { data: metasDef } = await supabase.from('metas_farol').select('*').eq('area_id', ID_MANUTENCAO).order('id');
      const { data: metasMensais } = await supabase.from('metas_farol_mensal').select('*').eq('ano', 2026);
      const { data: resultados } = await supabase.from('resultados_farol').select('*').eq('ano', 2026);

      const combined = (metasDef || []).map(m => {
        const row = { ...m, meses: {} };
        MESES.forEach(mes => {
          const alvoObj = metasMensais?.find(x => x.meta_id === m.id && x.mes === mes.id);
          const realObj = resultados?.find(x => x.meta_id === m.id && x.mes === mes.id);
          
          const alvo = alvoObj ? parseFloat(alvoObj.valor_meta) : null;
          const real = realObj ? parseFloat(realObj.valor_realizado) : '';

          row.meses[mes.id] = {
            alvo: alvo,
            realizado: real,
            ...calculateScore(alvo, real, m.tipo_comparacao, parseFloat(m.peso))
          };
        });
        return row;
      });

      setMetas(combined);
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = (meta, realizado, tipo, pesoTotal) => {
    if (meta === null || realizado === '' || realizado === null || isNaN(parseFloat(realizado))) {
      return { score: 0, faixa: 0, color: 'bg-white' };
    }

    const r = parseFloat(realizado);
    const m = parseFloat(meta);
    if (m === 0) return { score: 0, faixa: 0, color: 'bg-white' };

    let atingimento = 0;
    if (tipo === '>=' || tipo === 'maior') {
      atingimento = r / m;
    } else {
      atingimento = 1 + ((m - r) / m);
    }

    let multiplicador = 0;
    let cor = 'bg-red-200';

    if (atingimento >= 1.0) {      
      multiplicador = 1.0; cor = 'bg-green-300';
    } else if (atingimento >= 0.99) { 
      multiplicador = 0.75; cor = 'bg-green-100';
    } else if (atingimento >= 0.98) { 
      multiplicador = 0.50; cor = 'bg-yellow-100';
    } else if (atingimento >= 0.97) { 
      multiplicador = 0.25; cor = 'bg-orange-100';
    } else {                          
      multiplicador = 0.0; cor = 'bg-red-200';
    }

    return { score: pesoTotal * multiplicador, multiplicador, color: cor };
  };

  const handleSave = async (metaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));
    
    setMetas(prev => prev.map(m => {
      if (m.id !== metaId) return m;
      const novoMeses = { ...m.meses };
      novoMeses[mesId] = {
        ...novoMeses[mesId],
        realizado: valorNum,
        ...calculateScore(novoMeses[mesId].alvo, valorNum, m.tipo_comparacao, m.peso)
      };
      return { ...m, meses: novoMeses };
    }));

    await supabase.from('resultados_farol').upsert({
        meta_id: metaId,
        ano: 2026,
        mes: mesId,
        valor_realizado: valorNum
      }, { onConflict: 'meta_id, ano, mes' });
  };

  const getTotalScore = (mesId) => {
    const total = metas.reduce((acc, m) => acc + (m.meses[mesId]?.score || 0), 0);
    return total.toFixed(1);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded shadow-sm overflow-hidden font-sans">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800">Farol de Metas — Manutenção</h2>
        <div className="flex items-center gap-3">
             <button 
                onClick={() => window.location.hash = 'rotinas'} 
                className="px-3 py-1 text-sm font-medium text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
             >
                Ir para Rotinas
             </button>
             <button 
                onClick={() => setShowConfig(true)} 
                className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-gray-100"
             >
                <Settings size={18} />
             </button>
             {/* Tag da Área */}
             <div className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded border border-blue-100 uppercase">
                Manutenção
             </div>
        </div>
      </div>

      {/* Tabela de Dados */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500 animate-pulse">Carregando dados...</div>
        ) : (
          <div className="border border-gray-300 rounded overflow-hidden shadow-sm">
            <table className="w-full text-xs border-collapse">
              <thead>
                {/* CABEÇALHO CINZA (PADRÃO OPERAÇÃO) */}
                <tr className="bg-[#d0e0e3] text-gray-800 text-center font-bold">
                  <th className="p-2 border border-gray-300 w-48 sticky left-0 bg-[#d0e0e3] z-10">Indicador</th>
                  <th className="p-2 border border-gray-300 w-12">Peso</th>
                  <th className="p-2 border border-gray-300 w-12">Tipo</th>
                  {MESES.map(mes => (
                    <th key={mes.id} className="p-2 border border-gray-300 min-w-[70px]">
                      {mes.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metas.map(meta => (
                  <tr key={meta.id} className="hover:bg-gray-50 text-center">
                    <td className="p-2 border border-gray-300 text-left font-medium text-gray-800 sticky left-0 bg-white z-10">
                      {meta.nome_meta || meta.indicador}
                      <span className='block text-[9px] text-gray-400 font-normal'>{meta.unidade}</span>
                    </td>
                    <td className="p-2 border border-gray-300 bg-gray-50">{parseInt(meta.peso)}</td>
                    <td className="p-2 border border-gray-300 font-mono text-gray-500">{meta.tipo_comparacao}</td>
                    
                    {MESES.map(mes => {
                      const dados = meta.meses[mes.id];
                      return (
                        <td key={mes.id} className={`border border-gray-300 p-0 relative h-12 align-middle ${dados.color}`}>
                          <div className="flex flex-col h-full justify-between">
                            <div className="text-[9px] text-gray-500 text-right px-1 pt-0.5 bg-white/40">
                              {dados.alvo ? Number(dados.alvo).toFixed(2) : ''}
                            </div>
                            <input 
                              className="w-full text-center bg-transparent font-bold text-gray-800 text-xs focus:outline-none h-full pb-1 focus:bg-white/50 transition-colors"
                              placeholder="-"
                              defaultValue={dados.realizado}
                              onBlur={(e) => handleSave(meta.id, mes.id, e.target.value)}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                
                {/* RODAPÉ VERMELHO (PADRÃO OPERAÇÃO) */}
                <tr className="bg-red-600 text-white font-bold border-t-2 border-black">
                  <td className="p-2 sticky left-0 bg-red-600 z-10 border-r border-red-500 text-right pr-4">TOTAL SCORE</td>
                  <td className="p-2 border-r border-red-500 text-center">100</td>
                  <td className="p-2 border-r border-red-500"></td>
                  {MESES.map(mes => (
                    <td key={mes.id} className="p-2 text-center border-r border-red-500 text-sm">
                      {getTotalScore(mes.id)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showConfig && (
        <ConfiguracaoGeral 
            areasContexto={[{ id: 2, nome: 'Manutenção' }]} 
            onClose={() => { setShowConfig(false); fetchMetasData(); }} 
        />
      )}
    </div>
  );
};

export default ManutencaoMetas;

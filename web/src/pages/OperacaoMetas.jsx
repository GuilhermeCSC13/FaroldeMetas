import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const MESES = [
  { id: 1, label: 'jan/26' }, { id: 2, label: 'fev/26' }, { id: 3, label: 'mar/26' },
  { id: 4, label: 'abr/26' }, { id: 5, label: 'mai/26' }, { id: 6, label: 'jun/26' },
  { id: 7, label: 'jul/26' }, { id: 8, label: 'ago/26' }, { id: 9, label: 'set/26' },
  { id: 10, label: 'out/26' }, { id: 11, label: 'nov/26' }, { id: 12, label: 'dez/26' }
];

const OperacaoMetas = () => {
  const [areas, setAreas] = useState([]);
  const [areaSelecionada, setAreaSelecionada] = useState(null);
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Carrega Áreas do Setor Operação
  useEffect(() => {
    fetchAreas();
  }, []);

  // 2. Carrega Metas e Resultados quando a Área muda
  useEffect(() => {
    if (areaSelecionada) fetchMetasData();
  }, [areaSelecionada]);

  const fetchAreas = async () => {
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .eq('setor', 'Operação') // Filtra só setor Operação
      .eq('ativa', true)
      .order('nome');

    if (!error && data.length > 0) {
      setAreas(data);
      setAreaSelecionada(data[0].id); // Seleciona a primeira por padrão
    }
  };

  const fetchMetasData = async () => {
    setLoading(true);
    try {
      // Busca definições das metas
      const { data: metasDef } = await supabase
        .from('metas_farol')
        .select('*')
        .eq('area_id', areaSelecionada)
        .order('id');

      // Busca valores mensais (Alvos)
      const { data: metasMensais } = await supabase
        .from('metas_farol_mensal')
        .select('*')
        .eq('ano', 2026);

      // Busca resultados realizados (Inputs)
      const { data: resultados } = await supabase
        .from('resultados_farol')
        .select('*')
        .eq('ano', 2026);

      // Mescla tudo em uma estrutura única para o Grid
      const combined = metasDef.map(m => {
        const row = { ...m, meses: {} };
        MESES.forEach(mes => {
          const alvo = metasMensais?.find(x => x.meta_id === m.id && x.mes === mes.id)?.valor_meta;
          const real = resultados?.find(x => x.meta_id === m.id && x.mes === mes.id)?.valor_realizado;
          row.meses[mes.id] = {
            alvo: alvo || null,
            realizado: real || '',
            score: calculateScore(alvo, real, m.tipo_comparacao, m.peso)
          };
        });
        return row;
      });

      setMetas(combined);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Lógica Matemática das Faixas
  const calculateScore = (alvo, realizado, tipo, peso) => {
    if (!alvo || realizado === '' || realizado === null) return { pts: 0, color: 'bg-gray-50', faixa: 0 };
    
    const m = parseFloat(alvo);
    const r = parseFloat(realizado);
    let diffPercent = 0;

    // Calcula desvio percentual
    if (tipo === '>=') { // Maior é melhor
      if (r >= m) diffPercent = 0;
      else diffPercent = (m - r) / m;
    } else { // Menor é melhor (<=)
      if (r <= m) diffPercent = 0;
      else diffPercent = (r - m) / m;
    }

    // Aplica Faixas
    let multiplicador = 0;
    let cor = 'bg-red-200'; // Faixa 5 (>3%)

    if (diffPercent <= 0.0001) { // Faixa 1 (100%) - Margem erro float
      multiplicador = 1;
      cor = 'bg-green-300';
    } else if (diffPercent <= 0.01) { // Faixa 2 (99% - 1% desvio)
      multiplicador = 0.75;
      cor = 'bg-green-100';
    } else if (diffPercent <= 0.02) { // Faixa 3 (98% - 2% desvio)
      multiplicador = 0.50;
      cor = 'bg-yellow-100';
    } else if (diffPercent <= 0.03) { // Faixa 4 (97% - 3% desvio)
      multiplicador = 0.25;
      cor = 'bg-orange-100';
    }

    return { 
      pts: peso * multiplicador, 
      color: cor,
      faixa: multiplicador 
    };
  };

  // Salva no Supabase ao sair do campo (onBlur)
  const handleSave = async (metaId, mesId, valor) => {
    // Atualiza estado local para feedback rápido
    const newMetas = [...metas];
    const metaIndex = newMetas.findIndex(m => m.id === metaId);
    if (metaIndex >= 0) {
        newMetas[metaIndex].meses[mesId].realizado = valor;
        // Recalcula score visualmente
        const alvo = newMetas[metaIndex].meses[mesId].alvo;
        const tipo = newMetas[metaIndex].tipo_comparacao;
        const peso = newMetas[metaIndex].peso;
        newMetas[metaIndex].meses[mesId].score = calculateScore(alvo, valor, tipo, peso);
        setMetas(newMetas);
    }

    // Persiste no Banco
    const valorNumerico = valor === '' ? null : parseFloat(valor);
    
    // Procura ID existente para update ou insert
    const { error } = await supabase
      .from('resultados_farol')
      .upsert({
        meta_id: metaId,
        ano: 2026,
        mes: mesId,
        valor_realizado: valorNumerico
      }, { onConflict: 'meta_id, ano, mes' });

    if (error) console.error('Erro ao salvar:', error);
  };

  // Calcula Total Mensal (Score Global)
  const getTotalMes = (mesId) => {
    return metas.reduce((acc, meta) => {
      return acc + (meta.meses[mesId]?.score?.pts || 0);
    }, 0).toFixed(1);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Farol de Metas — Operação</h1>
        <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded shadow">Ano Base: 2026</span>
      </div>

      {/* Navegação de Áreas (Tabs) */}
      <div className="flex space-x-1 border-b border-gray-300 mb-6">
        {areas.map(area => (
          <button
            key={area.id}
            onClick={() => setAreaSelecionada(area.id)}
            className={`px-6 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              areaSelecionada === area.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-transparent'
            }`}
          >
            {area.nome}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Carregando dados...</div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-gray-100 text-gray-700 font-semibold uppercase sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 w-48 border-b border-r sticky left-0 bg-gray-100 z-20">Indicador</th>
                <th className="px-2 py-3 w-12 text-center border-b border-r">Peso</th>
                <th className="px-2 py-3 w-12 text-center border-b border-r">Tipo</th>
                {MESES.map(mes => (
                  <th key={mes.id} className="px-2 py-3 w-24 text-center border-b border-r min-w-[90px]">
                    {mes.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metas.map((meta) => (
                <tr key={meta.id} className="hover:bg-gray-50">
                  {/* Colunas Fixas */}
                  <td className="px-3 py-2 font-medium text-gray-800 sticky left-0 bg-white border-r z-10 shadow-sm">
                    {meta.nome_meta || meta.indicador}
                    <div className="text-[10px] text-gray-400 font-normal">{meta.unidade}</div>
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600 border-r">{parseInt(meta.peso)}</td>
                  <td className="px-2 py-2 text-center text-gray-600 border-r font-mono">{meta.tipo_comparacao}</td>

                  {/* Colunas dos Meses */}
                  {MESES.map(mes => {
                    const dados = meta.meses[mes.id];
                    return (
                      <td key={mes.id} className={`p-0 border-r relative align-top transition-colors ${dados.realizado ? dados.score.color : ''}`}>
                        <div className="flex flex-col h-full">
                          {/* Meta Alvo (Topo) */}
                          <div className="text-[10px] text-gray-500 text-right px-2 py-0.5 bg-gray-50/50 border-b border-gray-100">
                            {dados.alvo ? Number(dados.alvo).toFixed(2) : '-'}
                          </div>
                          
                          {/* Input Realizado (Meio) */}
                          <input
                            type="number"
                            step="0.01"
                            className="w-full h-8 text-center bg-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 font-medium text-xs"
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
              
              {/* Rodapé - Score Total */}
              <tr className="bg-gray-800 text-white font-bold">
                <td className="px-3 py-3 sticky left-0 bg-gray-800 z-10 border-r border-gray-700">SCORE MENSAL</td>
                <td className="px-2 py-3 text-center border-r border-gray-700">100</td>
                <td className="px-2 py-3 border-r border-gray-700"></td>
                {MESES.map(mes => (
                   <td key={mes.id} className="px-2 py-3 text-center border-r border-gray-700">
                     {getTotalMes(mes.id)}
                   </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OperacaoMetas;

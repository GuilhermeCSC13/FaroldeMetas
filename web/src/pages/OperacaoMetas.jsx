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

  // Carrega áreas ao iniciar
  useEffect(() => {
    fetchAreas();
  }, []);

  // Carrega metas ao mudar aba
  useEffect(() => {
    if (areaSelecionada) fetchMetasData();
  }, [areaSelecionada]);

  const fetchAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        // Tenta buscar de forma flexível caso haja erro de digitação no banco
        .ilike('setor', '%Operac%') 
        .eq('ativa', true)
        .order('nome');

      if (error) throw error;

      if (data && data.length > 0) {
        setAreas(data);
        setAreaSelecionada(data[0].id);
      } else {
        setLoading(false); // Para o loading se não achar nada
      }
    } catch (err) {
      console.error("Erro Areas:", err);
      setLoading(false);
    }
  };

  const fetchMetasData = async () => {
    setLoading(true);
    try {
      const { data: metasDef } = await supabase
        .from('metas_farol')
        .select('*')
        .eq('area_id', areaSelecionada)
        .order('id');

      const { data: metasMensais } = await supabase
        .from('metas_farol_mensal')
        .select('*')
        .eq('ano', 2026);

      const { data: resultados } = await supabase
        .from('resultados_farol')
        .select('*')
        .eq('ano', 2026);

      // Consolidação dos dados
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
      console.error('Erro Metas:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE NEGÓCIO (FAIXAS 1 a 5) ---
  const calculateScore = (meta, realizado, tipo, pesoTotal) => {
    // Se não tiver meta ou realizado, zera
    if (meta === null || realizado === '' || realizado === null || isNaN(realizado)) {
      return { score: 0, faixa: 0, multiplicador: 0, color: 'bg-white' };
    }

    const r = parseFloat(realizado);
    const m = parseFloat(meta);
    let atingimento = 0;

    // Cálculo do % de Atingimento Base
    if (tipo === '>=' || tipo === 'maior') {
      // Maior é melhor (Ex: KM/L) -> Realizado / Meta
      atingimento = r / m;
    } else {
      // Menor é melhor (Ex: Acidentes) -> Meta / Realizado (Inverso)
      // Ajuste: Para manter a lógica de 99% = Faixa 2, calculamos quanto "sobra" da meta
      atingimento = 2 - (r / m); 
      // Se r for igual a m, dá 1 (100%). Se r for 1% maior que m (ruim), dá 0.99 (99%).
    }

    let multiplicador = 0;
    let faixa = 5;

    // Regra das Faixas (Conforme Imagem)
    if (atingimento >= 1.00) {      // Faixa 1: 100%
      multiplicador = 1.0;
      faixa = 1;
    } else if (atingimento >= 0.99) { // Faixa 2: 99%
      multiplicador = 0.75;
      faixa = 2;
    } else if (atingimento >= 0.98) { // Faixa 3: 98%
      multiplicador = 0.50;
      faixa = 3;
    } else if (atingimento >= 0.97) { // Faixa 4: 97%
      multiplicador = 0.25;
      faixa = 4;
    } else {                          // Faixa 5: <96%
      multiplicador = 0.0;
      faixa = 5;
    }

    // Cores (Mapa de Calor Visual)
    let color = 'bg-red-200';
    if (faixa === 1) color = 'bg-green-300'; // Meta Batida
    else if (faixa === 2) color = 'bg-green-100';
    else if (faixa === 3) color = 'bg-yellow-100';
    else if (faixa === 4) color = 'bg-orange-100';

    return { 
      score: pesoTotal * multiplicador, 
      faixa, 
      multiplicador,
      color 
    };
  };

  const handleSave = async (metaId, mesId, valor) => {
    // Atualiza visualmente instantâneo
    const valorNum = valor === '' ? null : parseFloat(valor);
    
    setMetas(prev => prev.map(m => {
      if (m.id !== metaId) return m;
      const novoMeses = { ...m.meses };
      novoMeses[mesId] = {
        ...novoMeses[mesId],
        realizado: valorNum, // mantem o valor cru
        ...calculateScore(novoMeses[mesId].alvo, valorNum, m.tipo_comparacao, m.peso)
      };
      return { ...m, meses: novoMeses };
    }));

    // Persiste no banco
    const { error } = await supabase
      .from('resultados_farol')
      .upsert({
        meta_id: metaId,
        ano: 2026,
        mes: mesId,
        valor_realizado: valorNum
      }, { onConflict: 'meta_id, ano, mes' });

    if (error) console.error("Erro ao salvar:", error);
  };

  const getTotalScore = (mesId) => {
    return metas.reduce((acc, m) => acc + (m.meses[mesId]?.score || 0), 0).toFixed(1);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded shadow-sm overflow-hidden">
      {/* 1. Header com Abas */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800">Farol de Metas — Operação</h2>
        <div className="flex space-x-2">
          {areas.length === 0 && !loading && <span className="text-red-500 text-xs">Sem áreas cadastradas.</span>}
          {areas.map(area => (
            <button
              key={area.id}
              onClick={() => setAreaSelecionada(area.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                areaSelecionada === area.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              {area.nome}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Conteúdo da Tabela */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500 animate-pulse">
            Carregando dados... Verifique a conexão.
          </div>
        ) : (
          <div className="border border-gray-300 rounded overflow-hidden">
            <table className="w-full text-xs border-collapse">
              {/* Cabeçalho estilo Excel */}
              <thead>
                <tr className="bg-[#d9ead3] text-gray-800 border-b border-gray-300 text-center">
                  <th className="p-2 border-r border-gray-300 w-48 sticky left-0 bg-[#d9ead3] z-10">Indicador</th>
                  <th className="p-2 border-r border-gray-300 w-12">Peso</th>
                  <th className="p-2 border-r border-gray-300 w-12">Tipo</th>
                  {MESES.map(mes => (
                    <th key={mes.id} className="p-2 border-r border-gray-300 min-w-[80px]">
                      {mes.label}
                    </th>
                  ))}
                </tr>
              </thead>
              
              <tbody className="divide-y divide-gray-200">
                {metas.map(meta => (
                  <tr key={meta.id} className="hover:bg-gray-50">
                    <td className="p-2 border-r border-gray-200 font-medium text-gray-700 sticky left-0 bg-white z-10">
                      {meta.nome_meta || meta.indicador}
                    </td>
                    <td className="p-2 border-r border-gray-200 text-center font-bold bg-gray-50">{parseInt(meta.peso)}</td>
                    <td className="p-2 border-r border-gray-200 text-center text-gray-500 font-mono">{meta.tipo_comparacao}</td>
                    
                    {MESES.map(mes => {
                      const dados = meta.meses[mes.id];
                      return (
                        <td key={mes.id} className={`border-r border-gray-200 p-0 align-top relative ${dados.color} transition-colors duration-300`}>
                          <div className="flex flex-col h-full min-h-[40px]">
                            {/* Meta (Alvo) Pequena no Topo */}
                            <div className="text-[9px] text-gray-500 text-right px-1 pt-0.5 leading-none opacity-70">
                              {dados.alvo ? Number(dados.alvo).toFixed(2) : '-'}
                            </div>
                            {/* Input Realizado */}
                            <input
                              type="number"
                              className="w-full h-full bg-transparent text-center text-gray-900 font-semibold focus:outline-none focus:bg-white/50"
                              placeholder=""
                              defaultValue={dados.realizado}
                              onBlur={(e) => handleSave(meta.id, mes.id, e.target.value)}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Linha de Totalizador */}
                <tr className="bg-red-600 text-white font-bold border-t-2 border-gray-400">
                  <td className="p-3 sticky left-0 bg-red-600 z-10 text-right pr-4">TOTAL SCORE</td>
                  <td className="p-3 text-center">100</td>
                  <td className="p-3"></td>
                  {MESES.map(mes => (
                    <td key={mes.id} className="p-3 text-center border-l border-red-500">
                      {getTotalScore(mes.id)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperacaoMetas;

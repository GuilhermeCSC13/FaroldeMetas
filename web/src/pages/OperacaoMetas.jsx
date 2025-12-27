import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// IDs das áreas conforme seu banco de dados
const ID_PCO = 4;
const ID_MOTORISTAS = 5;

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

  useEffect(() => {
    fetchAreas();
  }, []);

  useEffect(() => {
    if (areaSelecionada) fetchMetasData();
  }, [areaSelecionada]);

  // --- ATUALIZAÇÃO IMPORTANTE AQUI ---
  const fetchAreas = async () => {
    try {
      // Busca TODAS as áreas ativas para evitar erro de filtro no SQL
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .eq('ativa', true)
        .order('id');

      if (error) throw error;

      if (data && data.length > 0) {
        // Filtra via Javascript para garantir que pegamos PCO e Motoristas
        // Usa "==" para funcionar tanto se o ID for string ('4') ou numero (4)
        const areasFiltradas = data.filter(a => a.id == ID_PCO || a.id == ID_MOTORISTAS);

        if (areasFiltradas.length > 0) {
          setAreas(areasFiltradas);
          setAreaSelecionada(areasFiltradas[0].id);
        } else {
          // Fallback: Se não achar PCO/Motoristas, mostra o que tem (Ex: Operação Geral)
          console.warn("Áreas PCO/Motoristas não encontradas. Carregando padrão.");
          setAreas(data);
          setAreaSelecionada(data[0].id);
        }
      } else {
        console.error("Nenhuma área ativa encontrada no banco.");
      }
    } catch (err) {
      console.error("Erro ao buscar áreas:", err);
    } finally {
      // Garante que o loading pare mesmo se der erro
      if (!areaSelecionada) setLoading(false); 
    }
  };

  const fetchMetasData = async () => {
    setLoading(true);
    try {
      // 1. Busca Definição das Metas (Linhas)
      const { data: metasDef } = await supabase
        .from('metas_farol')
        .select('*')
        .eq('area_id', areaSelecionada)
        .order('id');

      // 2. Busca Valores Mensais (Metas do ano 2026)
      const { data: metasMensais } = await supabase
        .from('metas_farol_mensal')
        .select('*')
        .eq('ano', 2026);

      // 3. Busca Resultados Realizados (Inputs)
      const { data: resultados } = await supabase
        .from('resultados_farol')
        .select('*')
        .eq('ano', 2026);

      // 4. Cruza tudo
      const combined = (metasDef || []).map(m => {
        const row = { ...m, meses: {} };
        
        MESES.forEach(mes => {
          // Encontra valor alvo na tabela metas_farol_mensal
          const alvoObj = metasMensais?.find(x => x.meta_id === m.id && x.mes === mes.id);
          // Encontra valor realizado na tabela resultados_farol
          const realObj = resultados?.find(x => x.meta_id === m.id && x.mes === mes.id);
          
          const alvo = alvoObj ? parseFloat(alvoObj.valor_meta) : null;
          const real = realObj ? parseFloat(realObj.valor_realizado) : '';

          // Calcula Score
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

  // --- LÓGICA DAS FAIXAS (1 a 5) ---
  const calculateScore = (meta, realizado, tipo, pesoTotal) => {
    // Se não tiver dados, retorna neutro
    if (meta === null || realizado === '' || realizado === null || isNaN(realizado)) {
      return { score: 0, faixa: 0, color: 'bg-white' };
    }

    const r = parseFloat(realizado);
    const m = parseFloat(meta);
    let atingimento = 0;

    // Lógica Inversa ou Direta
    if (tipo === '>=' || tipo === 'maior') {
      // Maior é melhor (Ex: KM/L)
      atingimento = r / m;
    } else {
      // Menor é melhor (Ex: Acidentes, IPK)
      // Se R < M (Bom), o atingimento deve ser > 100%
      if (r <= m) atingimento = 1 + ((m - r) / m); 
      else atingimento = 1 - ((r - m) / m);
    }

    // Aplicação das Faixas (Regra da Imagem)
    // Faixa 1 (100%): Atingimento >= 100% (ou 1.0)
    let multiplicador = 0;
    let cor = 'bg-red-200'; // Padrão Ruim (Faixa 5)

    if (atingimento >= 1.0) {      // Faixa 1
      multiplicador = 1.0;
      cor = 'bg-green-300'; // Verde forte
    } else if (atingimento >= 0.99) { // Faixa 2
      multiplicador = 0.75;
      cor = 'bg-green-100'; // Verde claro
    } else if (atingimento >= 0.98) { // Faixa 3
      multiplicador = 0.50;
      cor = 'bg-yellow-100'; // Amarelo
    } else if (atingimento >= 0.97) { // Faixa 4
      multiplicador = 0.25;
      cor = 'bg-orange-100'; // Laranja
    } else {                          // Faixa 5 (< 96%)
      multiplicador = 0.0;
      cor = 'bg-red-200';   // Vermelho
    }

    return { 
      score: pesoTotal * multiplicador, 
      multiplicador,
      color: cor 
    };
  };

  const handleSave = async (metaId, mesId, valor) => {
    // Atualização Otimista (Visual imediato)
    const valorNum = valor === '' ? null : parseFloat(valor);
    
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

    // Salva no Banco
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
    const total = metas.reduce((acc, m) => acc + (m.meses[mesId]?.score || 0), 0);
    return total.toFixed(1);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded shadow-sm overflow-hidden">
      {/* Header Abas */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800">Farol de Metas — Operação</h2>
        <div className="flex space-x-2">
          {areas.length === 0 && !loading && (
             <span className="text-red-500 text-xs font-bold">⚠️ Sem áreas carregadas. Verifique RLS.</span>
          )}
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
      </div>

      {/* Grid Tabela */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando indicadores...</div>
        ) : (
          <div className="border border-gray-300 rounded overflow-hidden shadow-sm">
            <table className="w-full text-xs border-collapse">
              <thead>
                {/* Cabeçalho Verde igual imagem */}
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
                            {/* Meta (Texto Pequeno Superior) */}
                            <div className="text-[9px] text-gray-500 text-right px-1 pt-0.5 bg-white/40">
                              {dados.alvo ? Number(dados.alvo).toFixed(2) : ''}
                            </div>
                            {/* Input (Valor Realizado) */}
                            <input 
                              className="w-full text-center bg-transparent font-bold text-gray-800 text-xs focus:outline-none h-full pb-1"
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
                
                {/* Rodapé Score */}
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
    </div>
  );
};

export default OperacaoMetas;

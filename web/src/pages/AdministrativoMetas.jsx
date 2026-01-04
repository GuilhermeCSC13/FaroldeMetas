import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
import { Settings } from 'lucide-react';

// IDs fixos Administrativo (Financeiro + Pessoas)
const IDS_ADMIN = [7, 8];

const MESES = [
  { id: 1, label: 'jan/26' }, { id: 2, label: 'fev/26' }, { id: 3, label: 'mar/26' },
  { id: 4, label: 'abr/26' }, { id: 5, label: 'mai/26' }, { id: 6, label: 'jun/26' },
  { id: 7, label: 'jul/26' }, { id: 8, label: 'ago/26' }, { id: 9, label: 'set/26' },
  { id: 10, label: 'out/26' }, { id: 11, label: 'nov/26' }, { id: 12, label: 'dez/26' }
];

const AdministrativoMetas = () => {
  const [areas, setAreas] = useState([]);
  const [areaSelecionada, setAreaSelecionada] = useState(null);
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    fetchAreas();
  }, []);

  useEffect(() => {
    if (areaSelecionada) fetchMetasData();
  }, [areaSelecionada]);

  const fetchAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .eq('ativa', true)
        .order('id');

      if (error) throw error;

      if (data?.length) {
        const filtradas = data.filter(a => IDS_ADMIN.includes(a.id));
        const lista = filtradas.length ? filtradas : data;

        setAreas(lista);
        setAreaSelecionada(lista[0].id);
      }
    } catch (err) {
      console.error("Erro ao buscar áreas:", err);
    } finally {
      if (!areaSelecionada) setLoading(false);
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

      const combined = (metasDef || []).map(m => {
        const row = { ...m, meses: {} };

        MESES.forEach(mes => {
          const alvoObj = metasMensais?.find(x => x.meta_id === m.id && x.mes === mes.id);
          const realObj = resultados?.find(x => x.meta_id === m.id && x.mes === mes.id);

          const alvo = alvoObj ? parseFloat(alvoObj.valor_meta) : null;

          let realizado = '';
          if (realObj && realObj.valor_realizado !== null && realObj.valor_realizado !== '') {
            const parsed = parseFloat(realObj.valor_realizado);
            realizado = isNaN(parsed) ? '' : parsed;
          }

          row.meses[mes.id] = {
            alvo,
            realizado,
            ...calculateScore(alvo, realizado, m.tipo_comparacao, parseFloat(m.peso))
          };
        });

        return row;
      });

      setMetas(combined);
    } catch (e) {
      console.error("Erro ao carregar metas:", e);
    } finally {
      setLoading(false);
    }
  };

  // LÓGICA DE SCORE BLINDADA
  const calculateScore = (meta, realizado, tipo, pesoTotal) => {
    if (meta === null || realizado === '' || realizado === null || isNaN(parseFloat(realizado)))
      return { score: 0, faixa: 0, color: 'bg-white' };

    const r = parseFloat(realizado);
    const m = parseFloat(meta);

    if (m === 0) return { score: 0, faixa: 0, color: 'bg-white' };

    let atingimento = tipo === '>=' || tipo === 'maior'
      ? r / m
      : 1 + ((m - r) / m);

    let multiplicador = 0;
    let cor = 'bg-red-200';

    if (atingimento >= 1.0) { multiplicador = 1.0; cor = 'bg-green-300'; }
    else if (atingimento >= 0.99) { multiplicador = 0.75; cor = 'bg-green-100'; }
    else if (atingimento >= 0.98) { multiplicador = 0.50; cor = 'bg-yellow-100'; }
    else if (atingimento >= 0.97) { multiplicador = 0.25; cor = 'bg-orange-100'; }

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

  const getTotalScore = (mesId) =>
    metas.reduce((acc, m) => acc + (m.meses[mesId]?.score || 0), 0).toFixed(1);

  return (
    <div className="flex flex-col h-full bg-white rounded shadow-sm overflow-hidden font-sans">

      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800">Farol de Metas — Administrativo</h2>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-4 border-r pr-4">
            <button
              onClick={() => (window.location.hash = 'rotinas')}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-gray-200 rounded"
            >
              Ir para Rotinas
            </button>

            <button
              onClick={() => setShowConfig(true)}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded-full"
              title="Configurações"
            >
              <Settings size={18} />
            </button>
          </div>

          <div className="flex space-x-2">
            {areas.map(area => (
              <button
                key={area.id}
                onClick={() => setAreaSelecionada(area.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 ${
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
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500 animate-pulse">
            Carregando dados...
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs border-collapse">

              <thead>
                <tr className="bg-[#d0e0e3] text-center font-bold">
                  <th className="p-2 w-48 sticky left-0 bg-[#d0e0e3] z-10">Indicador</th>
                  <th className="p-2 w-32">Responsável</th>
                  <th className="p-2 w-12">Peso</th>
                  <th className="p-2 w-12">Tipo</th>

                  {MESES.map(m => (
                    <th key={m.id} className="p-2 min-w-[70px]">{m.label}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {metas.map(meta => (
                  <tr key={meta.id} className="hover:bg-gray-50 text-center">

                    <td className="p-2 text-left font-semibold sticky left-0 bg-white z-10">
                      {meta.nome_meta || meta.indicador}
                      <span className="block text-[9px] text-gray-400">
                        {meta.unidade}
                      </span>
                    </td>

                    <td className="p-2 text-left text-[11px]">
                      {meta.responsavel || '-'}
                    </td>

                    <td className="p-2 bg-gray-50">{parseInt(meta.peso)}</td>
                    <td className="p-2 font-mono text-gray-500">
                      {meta.tipo_comparacao}
                    </td>

                    {MESES.map(mes => {
                      const dados = meta.meses[mes.id];

                      const valorRealizado =
                        dados.realizado === '' || dados.realizado === null || isNaN(dados.realizado)
                          ? ''
                          : dados.realizado;

                      // ✅ aceita meta 0 (mostra 0,00)
                      const temMeta = dados.alvo !== null && dados.alvo !== undefined && !Number.isNaN(dados.alvo);

                      return (
                        <td key={mes.id} className={`border p-0 ${dados.color}`}>
                          <div className="flex flex-col h-full justify-between">
                            <div className="text-[11px] text-blue-700 font-semibold text-right px-1 pt-0.5 bg-white/40">
                              {temMeta ? Number(dados.alvo).toFixed(2) : ''}
                            </div>

                            <input
                              className="w-full text-center bg-transparent font-bold text-xs focus:bg-white/50"
                              placeholder="-"
                              defaultValue={valorRealizado === '' ? '' : String(valorRealizado)}
                              onBlur={(e) => handleSave(meta.id, mes.id, e.target.value)}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr className="bg-red-600 text-white font-bold border-t-2">
                  <td className="p-2 sticky left-0 bg-red-600 z-10 text-right pr-4">
                    TOTAL SCORE
                  </td>
                  <td className="p-2"></td>
                  <td className="p-2 text-center">100</td>
                  <td className="p-2"></td>

                  {MESES.map(m => (
                    <td key={m.id} className="p-2 text-center">
                      {getTotalScore(m.id)}
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
          areasContexto={areas}
          onClose={() => { setShowConfig(false); fetchMetasData(); }}
        />
      )}
    </div>
  );
};

export default AdministrativoMetas;

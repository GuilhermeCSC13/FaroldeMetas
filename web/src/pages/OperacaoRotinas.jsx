import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import ConfiguracaoGeral from '../components/tatico/ConfiguracaoGeral';
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
  const [responsavelFiltro, setResponsavelFiltro] = useState('');

  useEffect(() => {
    fetchAreas();
  }, []);

  useEffect(() => {
    if (areaSelecionada) fetchRotinasData();
  }, [areaSelecionada]);

  const fetchAreas = async () => {
    const { data } = await supabase
      .from('areas')
      .select('*')
      .eq('ativa', true)
      .order('id');

    if (data && data.length > 0) {
      const filtered = data.filter(a => a.id == ID_PCO || a.id == ID_MOTORISTAS);
      const lista = filtered.length > 0 ? filtered : data;
      setAreas(lista);
      setAreaSelecionada(lista[0].id);
    }
  };

  const fetchRotinasData = async () => {
    setLoading(true);
    try {
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

  const handleSave = async (rotinaId, mesId, valor) => {
    const valorNum = valor === '' ? null : parseFloat(valor.replace(',', '.'));

    setRotinas(prev =>
      prev.map(r => {
        if (r.id !== rotinaId) return r;
        const novosMeses = { ...r.meses };
        novosMeses[mesId] = { ...novosMeses[mesId], realizado: valorNum };
        return { ...r, meses: novosMeses };
      })
    );

    const { error } = await supabase.rpc('atualizar_realizado_rotina', {
      p_rotina_id: rotinaId,
      p_mes: mesId,
      p_valor: valorNum
    });

    if (error) console.error('Erro ao salvar:', error);
  };

  const getCellStatus = (real, meta, tipoComparacao) => {
    if (real === '' || real === null || meta === null || meta === undefined)
      return 'bg-white';
    const r = parseFloat(real);
    const m = parseFloat(meta);
    if (isNaN(r) || isNaN(m)) return 'bg-white';

    let isGood = false;
    if (tipoComparacao === '<=' || tipoComparacao === 'menor') {
      isGood = r <= m;
    } else {
      isGood = r >= m;
    }
    return isGood ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]';
  };

  // responsáveis únicos para o filtro
  const responsaveisUnicos = useMemo(
    () =>
      Array.from(
        new Set(
          (rotinas || [])
            .map(r => r.responsavel)
            .filter(r => r && String(r).trim() !== '')
        )
      ),
    [rotinas]
  );

  const rotinasFiltradas = useMemo(
    () =>
      responsavelFiltro
        ? rotinas.filter(r => r.responsavel === responsavelFiltro)
        : rotinas,
    [rotinas, responsavelFiltro]
  );

  const isPCO = areaSelecionada == ID_PCO;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden relative font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">
          Farol de Rotinas — Operação
        </h2>

        <div className="flex items-center gap-4">
          {/* Filtro de Responsável */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold">Responsável:</span>
            <select
              value={responsavelFiltro}
              onChange={e => setResponsavelFiltro(e.target.value)}
              className="text-xs bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {responsaveisUnicos.map(resp => (
                <option key={resp} value={resp}>
                  {resp}
                </option>
              ))}
            </select>
          </div>

          {/* Botões de Navegação / Configuração */}
          <div className="flex items-center gap-2 mr-4 border-r border-gray-300 pr-4">
            <button
              onClick={() => (window.location.hash = 'metas')}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-gray-200 rounded transition-colors"
            >
              Ir para Metas
            </button>
            <button
              onClick={() => setShowConfig(true)}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded-full transition-colors"
              title="Configurações"
            >
              <Settings size={18} />
            </button>
          </div>

          {/* Seletor de Áreas */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {areas.map(area => (
              <button
                key={area.id}
                onClick={() => setAreaSelecionada(area.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                  areaSelecionada === area.id
                    ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {area.nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 animate-pulse">
            Carregando...
          </div>
        ) : (
          <div className="p-4">
            <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm bg-white min-w-max">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#d0e0e3] text-gray-800 text-center font-bold">
                    <th className="p-2 border border-gray-300 w-72 sticky left-0 bg-[#d0e0e3] z-20 text-left">
                      Indicador
                    </th>
                    <th className="p-2 border border-gray-300 w-40 text-left">
                      Responsável
                    </th>
                    <th className="p-2 border border-gray-300 w-12">
                      Peso
                    </th>
                    <th className="p-2 border border-gray-300 w-12">
                      Tipo
                    </th>
                    {MESES.map(mes => (
                      <th
                        key={mes.id}
                        className="p-2 border border-gray-300 min-w-[90px]"
                      >
                        {mes.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rotinasFiltradas.map((row, idx) => (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* Indicador (sticky) */}
                      <td className="p-3 border border-gray-300 sticky left-0 bg-white z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] text-left">
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-10 rounded-full bg-blue-500/20" />
                          <div className="flex flex-col">
                            <span
                              className="truncate text-[13px] font-semibold text-gray-800"
                              title={row.indicador}
                            >
                              {row.indicador}
                            </span>
                            <span className="text-[9px] text-gray-400 uppercase">
                              {row.tipo_comparacao === '<='
                                ? 'Menor é melhor'
                                : 'Meta mínima'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Responsável */}
                      <td className="p-2 border border-gray-300 text-[11px] text-gray-700 text-left">
                        {row.responsavel || '-'}
                      </td>

                      {/* Peso (se não tiver na tabela, fica '-') */}
                      <td className="p-2 border border-gray-300 bg-gray-50 text-center">
                        {row.peso != null ? row.peso : '-'}
                      </td>

                      {/* Tipo (comparação) */}
                      <td className="p-2 border border-gray-300 font-mono text-gray-500 text-center">
                        {row.tipo_comparacao}
                      </td>

                      {/* Meses */}
                      {MESES.map(mes => {
                        const dados = row.meses[mes.id];
                        const temMeta =
                          dados.meta !== null && dados.meta !== undefined;
                        const bgStatus = getCellStatus(
                          dados.realizado,
                          dados.meta,
                          row.tipo_comparacao
                        );

                        const valorRealizado =
                          dados.realizado === null ||
                          dados.realizado === '' ||
                          isNaN(dados.realizado)
                            ? ''
                            : dados.realizado;

                        return (
                          <td
                            key={mes.id}
                            className={`border border-gray-300 p-0 align-middle ${bgStatus}`}
                          >
                            <div className="flex flex-col h-full min-h-[64px] justify-between">
                              {/* META (ALVO) - igual Metas: azul, sem ícone */}
                              <div className="text-[11px] text-blue-700 font-semibold text-right px-1 pt-0.5 bg-white/40">
                                {temMeta
                                  ? Number(dados.meta).toFixed(
                                      row.formato === 'percent' ? 0 : 0
                                    )
                                  : ''}
                                {temMeta && row.formato === 'percent' && '%'}
                              </div>

                              {/* Valor realizado (input) */}
                              <div className="flex-1 flex items-center justify-center pb-1">
                                <div className="flex items-baseline gap-0.5">
                                  {row.formato === 'currency' && (
                                    <span className="text-gray-500/70 text-[10px]">
                                      R$
                                    </span>
                                  )}
                                  <input
                                    className="w-20 text-center bg-transparent focus:outline-none font-bold text-[13px] text-gray-900 placeholder-gray-400/70 focus:bg-white/60 rounded-sm"
                                    placeholder="-"
                                    defaultValue={
                                      valorRealizado === ''
                                        ? ''
                                        : String(valorRealizado)
                                    }
                                    onBlur={e =>
                                      handleSave(
                                        row.id,
                                        mes.id,
                                        e.target.value
                                      )
                                    }
                                  />
                                  {row.formato === 'percent' && (
                                    <span className="text-gray-500/70 text-[10px]">
                                      %
                                    </span>
                                  )}
                                </div>
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
          </div>
        )}
      </div>

      {showConfig && (
        <ConfiguracaoGeral
          onClose={() => {
            setShowConfig(false);
            fetchRotinasData();
          }}
        />
      )}
    </div>
  );
};

export default OperacaoRotinas;

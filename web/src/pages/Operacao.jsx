import React, { useMemo, useState } from "react";

/**
 * Meses que vamos usar no farol da Operação (pode adaptar depois)
 */
const MESES_2025 = [
  { id: "jan", label: "jan/25" },
  { id: "fev", label: "fev/25" },
  { id: "mar", label: "mar/25" },
  { id: "abr", label: "abr/25" },
  { id: "mai", label: "mai/25" },
  { id: "jun", label: "jun/25" },
  { id: "jul", label: "jul/25" },
  { id: "ago", label: "ago/25" },
  { id: "set", label: "set/25" },
  { id: "out", label: "out/25" },
  { id: "nov", label: "nov/25" },
  { id: "dez", label: "dez/25" },
];

/**
 * Indicadores de teste da Operação (baseado no seu farol de Gestão de Motoristas)
 */
const INDICADORES_OPERACAO = [
  {
    id: "consumo",
    nome: "Consumo km / Lts",
    peso: 25,
    tipo: ">=",
    formato: "km_l",
    metas: {
      jan: 2.65,
      fev: 2.67,
      mar: 2.72,
      abr: 2.74,
      mai: 2.74,
      jun: 2.74,
      jul: 2.8,
      ago: 2.76,
      set: 2.74,
      out: 2.74,
      nov: 2.74,
      dez: 2.74,
    },
  },
  {
    id: "aderencia_horas",
    nome: "Aderência às horas programadas",
    peso: 35,
    tipo: "<=",
    formato: "percent",
    metas: {
      jan: 0,
      fev: 0,
      mar: 0,
      abr: 0,
      mai: 0,
      jun: 0,
      jul: 0,
      ago: 0,
      set: 0,
      out: 0,
      nov: 0,
      dez: 0,
    },
  },
  {
    id: "absenteismo",
    nome: "Aderência ao resultado absenteísmo Operacional",
    peso: 20,
    tipo: "<=",
    formato: "percent",
    metas: {
      jan: 3,
      fev: 3,
      mar: 3,
      abr: 3,
      mai: 3,
      jun: 3,
      jul: 3,
      ago: 3,
      set: 3,
      out: 3,
      nov: 3,
      dez: 3,
    },
  },
  {
    id: "turnover",
    nome: "Aderência ao resultado Turn Over Operacional",
    peso: 20,
    tipo: "<=",
    formato: "percent",
    metas: {
      jan: 2.85,
      fev: 2.85,
      mar: 2.85,
      abr: 2.85,
      mai: 2.85,
      jun: 2.85,
      jul: 2.85,
      ago: 2.85,
      set: 2.85,
      out: 2.85,
      nov: 2.85,
      dez: 2.85,
    },
  },
];

function formatValor(valor, formato) {
  if (valor === null || valor === undefined || isNaN(valor)) return "-";

  if (formato === "percent") {
    return `${valor.toFixed(2).replace(".", ",")}%`;
  }

  // km/l ou número simples
  return valor.toFixed(2).replace(".", ",");
}

export default function Operacao() {
  const [mesSelecionado, setMesSelecionado] = useState("jan");
  const [resultados, setResultados] = useState({});

  const linhasFarol = useMemo(() => {
    return INDICADORES_OPERACAO.map((ind) => {
      const meta = ind.metas[mesSelecionado];
      const realizadoRaw = resultados[ind.id];
      const realizado =
        realizadoRaw !== undefined && realizadoRaw !== ""
          ? Number(realizadoRaw)
          : null;

      let atingiu = null;
      if (meta != null && realizado != null && !isNaN(realizado)) {
        if (ind.tipo === ">=") {
          atingiu = realizado >= meta;
        } else if (ind.tipo === "<=") {
          atingiu = realizado <= meta;
        }
      }

      const pontos = atingiu ? ind.peso : 0;

      return {
        indicador: ind,
        meta,
        realizado,
        atingiu,
        pontos,
      };
    });
  }, [mesSelecionado, resultados]);

  const totalPeso = useMemo(
    () => INDICADORES_OPERACAO.reduce((sum, ind) => sum + ind.peso, 0),
    []
  );
  const totalPontos = useMemo(
    () => linhasFarol.reduce((sum, l) => sum + l.pontos, 0),
    [linhasFarol]
  );

  const mesLabel =
    MESES_2025.find((m) => m.id === mesSelecionado)?.label || "mês";

  function handleChangeResultado(indicadorId, value) {
    setResultados((prev) => ({
      ...prev,
      [indicadorId]: value,
    }));
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho da página Operação */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">
          Operação – Planejamento Tático
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Nesta página você acompanha o resumo da Operação, o Farol de Metas
          específico e o Farol de Rotinas. Primeiro vamos usar dados de teste;
          depois conectamos tudo ao Supabase e às bases de KM/L, horas e
          absenteísmo.
        </p>
      </div>

      {/* ======================== RESUMO – OPERAÇÃO ======================== */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-800">
          Resumo – Operação
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Espaço para o resumo executivo da operação: principais indicadores,
          destaques positivos e pontos de atenção. Futuramente podemos puxar
          esse resumo de uma tabela de governança ou de uma ata padrão.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500 font-semibold">
              KM/L Operacional
            </p>
            <p className="text-xs text-slate-600">
              Indicador consolidado por cluster, considerando frota total.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500 font-semibold">
              Horas Programadas x Realizadas
            </p>
            <p className="text-xs text-slate-600">
              Aderência à programação de jornada e cobertura das tabelas.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500 font-semibold">
              Absenteísmo e Turnover
            </p>
            <p className="text-xs text-slate-600">
              Comportamento do quadro de motoristas ao longo do mês.
            </p>
          </div>
        </div>
      </section>

      {/* ====================== FAROL DE METAS – OPERAÇÃO ====================== */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        <header className="px-5 py-3 border-b border-slate-100 bg-yellow-100/60 flex flex-col gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Farol de Metas – Operação
            </h3>
            <p className="text-xs text-slate-600">
              Informe o resultado dos indicadores da Operação para o mês
              selecionado. O sistema compara com a meta e soma os pesos das
              metas atingidas para formar o índice mensal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              Mês de referência:
            </span>
            <select
              className="text-xs rounded-lg border border-slate-300 px-2 py-1 bg-white"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
            >
              {MESES_2025.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="px-3 py-2 text-left">Indicador</th>
                <th className="px-3 py-2 text-center w-14">Peso</th>
                <th className="px-3 py-2 text-center w-10">Tipo</th>
                <th className="px-3 py-2 text-center">
                  Meta {mesLabel}
                </th>
                <th className="px-3 py-2 text-center">
                  Realizado {mesLabel}
                </th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center w-20">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {linhasFarol.map((linha) => {
                const { indicador, meta, atingiu, pontos } = linha;

                let statusLabel = "-";
                let statusClass = "text-slate-500";
                if (atingiu === true) {
                  statusLabel = "Meta atingida";
                  statusClass = "text-emerald-600 font-semibold";
                } else if (atingiu === false) {
                  statusLabel = "Meta não atingida";
                  statusClass = "text-rose-600 font-semibold";
                }

                return (
                  <tr
                    key={indicador.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-left">{indicador.nome}</td>
                    <td className="px-3 py-2 text-center font-semibold">
                      {indicador.peso}
                    </td>
                    <td className="px-3 py-2 text-center">{indicador.tipo}</td>
                    <td className="px-3 py-2 text-center">
                      {formatValor(meta, indicador.formato)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        step="0.01"
                        className="w-20 border border-slate-300 rounded px-1 py-0.5 text-[11px] text-center"
                        value={
                          resultados[indicador.id] !== undefined
                            ? resultados[indicador.id]
                            : ""
                        }
                        onChange={(e) =>
                          handleChangeResultado(indicador.id, e.target.value)
                        }
                      />
                    </td>
                    <td className={`px-3 py-2 text-center ${statusClass}`}>
                      {statusLabel}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold">
                      {pontos}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-red-600 text-white font-semibold">
                <td className="px-3 py-2 text-right">Total de Pesos</td>
                <td className="px-3 py-2 text-center">{totalPeso}</td>
                <td className="px-3 py-2 text-center" colSpan={4}>
                  Índice do mês ({mesLabel})
                </td>
                <td className="px-3 py-2 text-center">{totalPontos}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ===================== FAROL DE ROTINAS – OPERAÇÃO ===================== */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-800">
          Farol de Rotinas – Operação
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          Visão das principais rotinas da Operação (reuniões, DBO, checklists,
          contatos com motoristas etc.). Nesta versão é um exemplo visual;
          depois vamos ligar nas rotinas cadastradas no Supabase.
        </p>

        <div className="mt-3 space-y-2 text-[11px]">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-slate-700">
                Reunião GI Operação – semanal
              </p>
              <p className="text-[11px] text-slate-500">
                Alinhamento de KM/L, ocorrências críticas e planos de ação.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 border border-emerald-100">
              Em dia (mock)
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-slate-700">
                DBO diário Operação
              </p>
              <p className="text-[11px] text-slate-500">
                Conferência de painéis, SRs críticas, faltas e trocas de tabela.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-1 border border-amber-100">
              Atenção (mock)
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-slate-700">
                Contato com motoristas – Telemetria / KM/L
              </p>
              <p className="text-[11px] text-slate-500">
                Mensagens semanais e devolutiva individual de desempenho.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-slate-50 text-slate-700 px-2 py-1 border border-slate-200">
              Em construção (mock)
            </span>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          Em breve, cada rotina terá registro de execução (data, responsável,
          status) e o farol será calculado automaticamente por período.
        </p>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";

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

// Indicadores de teste exatamente como no farol da imagem
const INDICADORES_TESTE = [
  {
    id: "consumo",
    nome: "Consumo km / Lts",
    peso: 25,
    tipo: ">=",
    formato: "km_l", // km/l
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

  // km/l
  return valor.toFixed(2).replace(".", ",");
}

export default function PlanejamentoTatico() {
  const [mesSelecionado, setMesSelecionado] = useState("jan");
  // resultados digitados pelo usuário: { [indicadorId]: number }
  const [resultados, setResultados] = useState({});

  // cálculo das linhas do farol
  const linhasFarol = useMemo(() => {
    return INDICADORES_TESTE.map((ind) => {
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
    () => INDICADORES_TESTE.reduce((sum, ind) => sum + ind.peso, 0),
    []
  );
  const totalPontos = useMemo(
    () => linhasFarol.reduce((sum, l) => sum + l.pontos, 0),
    [linhasFarol]
  );

  function handleChangeResultado(indicadorId, value) {
    setResultados((prev) => ({
      ...prev,
      [indicadorId]: value,
    }));
  }

  const mesLabel =
    MESES_2025.find((m) => m.id === mesSelecionado)?.label || "mês";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">
          Planejamento Tático
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Estruture aqui o farol de metas por área para o ano, conectando
          indicadores, metas mensais e rotinas de acompanhamento. Nesta etapa
          vamos apenas desenhar o visual do painel.
        </p>
      </div>

      {/* Cards principais (mock geral) */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            Operação – KM/L
          </h3>
          <p className="mt-1 text-xs text-slate-500">Meta global 2026</p>
          <p className="mt-3 text-3xl font-bold text-emerald-600">2,74</p>
          <p className="mt-1 text-xs text-slate-500">Meta atual da frota</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            Manutenção – MKBF
          </h3>
          <p className="mt-1 text-xs text-slate-500">Meta global 2026</p>
          <p className="mt-3 text-3xl font-bold text-indigo-600">X km</p>
          <p className="mt-1 text-xs text-slate-500">
            Depois vamos puxar o valor da base.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            Segurança / Acidentes
          </h3>
          <p className="mt-1 text-xs text-slate-500">Taxa alvo</p>
          <p className="mt-3 text-3xl font-bold text-rose-600">↓</p>
          <p className="mt-1 text-xs text-slate-500">
            Indicadores de segurança e incidentes.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            RH / Absenteísmo
          </h3>
          <p className="mt-1 text-xs text-slate-500">Meta anual</p>
          <p className="mt-3 text-3xl font-bold text-amber-600">%</p>
          <p className="mt-1 text-xs text-slate-500">
            Espaço para metas de RH/people.
          </p>
        </div>
      </div>

      {/* Seção explicativa antiga */}
      <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Metas e Rotinas por Área (mock visual)
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase">
              Operação
            </h4>
            <ul className="mt-2 text-sm text-slate-600 space-y-1">
              <li>• Meta KM/L por cluster</li>
              <li>• Rotinas de acompanhamento diário dos painéis</li>
              <li>• DDS e Minuto do Conhecimento integrados</li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase">
              Manutenção
            </h4>
            <ul className="mt-2 text-sm text-slate-600 space-y-1">
              <li>• Meta de MKBF por grupo de veículos</li>
              <li>• Rotinas de DBO, análise de SOS e avarias</li>
              <li>• Acompanhamento de planos preventivos</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Mais pra frente, essas seções serão alimentadas pelas tabelas no
          Supabase (metas, áreas, rotinas e execuções).
        </p>
      </div>

      {/* 🔥 Farol de Metas – Gestão de Motoristas (teste) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-yellow-100/60">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Farol de Metas – Gestão de Motoristas (teste)
            </h3>
            <p className="text-xs text-slate-600">
              Selecione o mês, informe o resultado de cada indicador e veja se a
              meta foi atingida. A soma dos pesos gera o índice final.
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
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="px-3 py-2 text-left">Indicador</th>
                <th className="px-3 py-2 text-center w-16">Peso</th>
                <th className="px-3 py-2 text-center w-16">Tipo</th>
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
                const { indicador, meta, realizado, atingiu, pontos } = linha;

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
                    <td className="px-3 py-2 text-left">
                      {indicador.nome}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold">
                      {indicador.peso}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {indicador.tipo}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {formatValor(meta, indicador.formato)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 border border-slate-300 rounded px-1 py-0.5 text-xs text-center"
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
              <tr className="bg-red-600 text-white font-semibold text-xs">
                <td className="px-3 py-2 text-right">Total de Pesos</td>
                <td className="px-3 py-2 text-center">{totalPeso}</td>
                <td className="px-3 py-2 text-center" colSpan={4}>
                  Índice do mês ({mesLabel})
                </td>
                <td className="px-3 py-2 text-center">
                  {totalPontos}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

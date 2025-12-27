// web/src/components/tatico/FarolMetasSetor.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

const ANO_REFERENCIA = 2026;

const MESES = [
  { numero: 1, label: "jan/26" },
  { numero: 2, label: "fev/26" },
  { numero: 3, label: "mar/26" },
  { numero: 4, label: "abr/26" },
  { numero: 5, label: "mai/26" },
  { numero: 6, label: "jun/26" },
  { numero: 7, label: "jul/26" },
  { numero: 8, label: "ago/26" },
  { numero: 9, label: "set/26" },
  { numero: 10, label: "out/26" },
  { numero: 11, label: "nov/26" },
  { numero: 12, label: "dez/26" },
];

export default function FarolMetasSetor() {
  const [areas, setAreas] = useState([]);
  const [areaSelecionadaId, setAreaSelecionadaId] = useState(null);

  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  // ---------------------------------------------------------------------------
  // 1) Carregar áreas da Operação (PCO e Gestão de Motoristas)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function carregarAreas() {
      try {
        setErro(null);
        const { data, error } = await supabase
          .from("areas")
          .select("id, nome")
          .in("nome", ["PCO", "Gestão de Motoristas"])
          .order("nome", { ascending: true });

        if (error) throw error;

        setAreas(data || []);

        // Define padrão como PCO, se existir
        const areaPCO = (data || []).find((a) => a.nome === "PCO");
        const primeira = areaPCO || (data || [])[0];
        if (primeira) {
          setAreaSelecionadaId(primeira.id);
        }
      } catch (err) {
        console.error("Erro ao carregar áreas:", err);
        setErro("Erro ao carregar áreas da Operação.");
      }
    }

    carregarAreas();
  }, []);

  const areaSelecionada = useMemo(
    () => areas.find((a) => a.id === areaSelecionadaId) || null,
    [areas, areaSelecionadaId]
  );

  // ---------------------------------------------------------------------------
  // 2) Carregar metas + valores mensais da área selecionada
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!areaSelecionadaId) return;

    async function carregarMetas() {
      try {
        setLoading(true);
        setErro(null);

        // Metas da área (linha da meta)
        const { data: metasBase, error: metasError } = await supabase
          .from("metas_farol")
          .select(
            "id, indicador_codigo, indicador_nome, descricao, tipo_comparacao, unidade, peso"
          )
          .eq("area_id", areaSelecionadaId)
          .eq("ano", ANO_REFERENCIA)
          .order("indicador_codigo", { ascending: true });

        if (metasError) throw metasError;

        if (!metasBase || metasBase.length === 0) {
          setMetas([]);
          setLoading(false);
          return;
        }

        const metaIds = metasBase.map((m) => m.id);

        // Valores mensais da meta
        const { data: metasMensal, error: mensalError } = await supabase
          .from("metas_farol_mensal")
          .select("meta_id, mes, valor_meta")
          .eq("ano", ANO_REFERENCIA)
          .in("meta_id", metaIds);

        if (mensalError) throw mensalError;

        const mapaMensal = new Map();
        (metasMensal || []).forEach((linha) => {
          if (!mapaMensal.has(linha.meta_id)) {
            mapaMensal.set(linha.meta_id, {});
          }
          mapaMensal.get(linha.meta_id)[linha.mes] = linha.valor_meta;
        });

        const metasCompletas = metasBase.map((m) => ({
          ...m,
          valoresMes: mapaMensal.get(m.id) || {},
        }));

        setMetas(metasCompletas);
      } catch (err) {
        console.error("Erro ao carregar metas:", err);
        setErro("Erro ao carregar o farol de metas da Operação.");
      } finally {
        setLoading(false);
      }
    }

    carregarMetas();
  }, [areaSelecionadaId]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Botões PCO / Gestão de Motoristas */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Área selecionada:</span>
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            {areas.map((area) => {
              const ativo = area.id === areaSelecionadaId;
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setAreaSelecionadaId(area.id)}
                  className={[
                    "px-4 py-1.5 text-xs font-semibold rounded-full transition-colors",
                    ativo
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-blue-50",
                  ].join(" ")}
                >
                  {area.nome}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Metas referentes ao ano de {ANO_REFERENCIA}.
        </div>
      </div>

      {/* Mensagens de estado */}
      {erro && (
        <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
          {erro}
        </div>
      )}

      {loading && (
        <div className="px-4 py-3 rounded-lg bg-slate-50 text-slate-600 text-sm border border-slate-200">
          Carregando metas da área {areaSelecionada?.nome || ""}...
        </div>
      )}

      {!loading && !erro && metas.length === 0 && (
        <div className="px-4 py-3 rounded-lg bg-yellow-50 text-yellow-800 text-sm border border-yellow-200">
          Nenhuma meta cadastrada para {areaSelecionada?.nome || "esta área"} em{" "}
          {ANO_REFERENCIA}.
        </div>
      )}

      {/* Tabela de metas */}
      {!loading && !erro && metas.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b">
                  Indicador
                </th>
                <th className="px-3 py-2 text-center font-semibold text-slate-700 border-b">
                  Peso
                </th>
                <th className="px-3 py-2 text-center font-semibold text-slate-700 border-b">
                  Tipo
                </th>
                <th className="px-3 py-2 text-center font-semibold text-slate-700 border-b">
                  Unidade
                </th>
                {MESES.map((mes) => (
                  <th
                    key={mes.numero}
                    className="px-2 py-2 text-center font-semibold text-slate-700 border-b"
                  >
                    {mes.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metas.map((meta) => (
                <tr key={meta.id} className="odd:bg-white even:bg-slate-50/60">
                  <td className="px-3 py-2 border-b align-top">
                    <div className="font-semibold text-slate-800 text-[11px]">
                      {meta.indicador_nome}
                    </div>
                    {meta.descricao && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {meta.descricao}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center border-b align-top">
                    {meta.peso}
                  </td>
                  <td className="px-3 py-2 text-center border-b align-top">
                    {meta.tipo_comparacao}
                  </td>
                  <td className="px-3 py-2 text-center border-b align-top">
                    {meta.unidade}
                  </td>
                  {MESES.map((mes) => {
                    const valor = meta.valoresMes[mes.numero];
                    return (
                      <td
                        key={mes.numero}
                        className="px-2 py-2 text-center border-b align-top"
                      >
                        {valor !== undefined && valor !== null
                          ? typeof valor === "number"
                            ? valor.toString().replace(".", ",")
                            : valor
                          : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rodapé explicativo */}
      <p className="text-[11px] text-slate-500 mt-2">
        Próximos passos: incluir o realizado por mês, cálculo de atingimento,
        farol de cores (verde / amarelo / vermelho) e pontuação ponderada pelo
        peso de cada indicador.
      </p>
    </div>
  );
}

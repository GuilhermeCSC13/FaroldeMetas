// src/components/tatico/FarolMetasSetor.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

const LABEL_SETOR = {
  operacao: "Operação",
  manutencao: "Manutenção",
  moov: "Moov",
  financeiro: "Financeiro",
  pessoas: "Pessoas",
};

// Mapeamento de mês numérico → label de coluna
const MESES_LABEL = {
  1: "jan/26",
  2: "fev/26",
  3: "mar/26",
  4: "abr/26",
  5: "mai/26",
  6: "jun/26",
  7: "jul/26",
  8: "ago/26",
  9: "set/26",
  10: "out/26",
  11: "nov/26",
  12: "dez/26",
};

const MESES_ORDENADOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function FarolMetasSetor({ setorKey }) {
  // ▶️ Se NÃO for Operação, mostra só placeholder “em desenvolvimento”
  if (setorKey !== "operacao") {
    const nomeSetor = LABEL_SETOR[setorKey] || "Setor";
    return (
      <section className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mt-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Farol de Metas — {nomeSetor}
        </h2>
        <p className="text-sm text-gray-600">
          Em desenvolvimento. O farol de metas deste setor ainda será configurado.
        </p>
      </section>
    );
  }

  // ▶️ Para Operação: PCO x Gestão de Motoristas
  const [areaSelecionada, setAreaSelecionada] = useState("pco"); // "pco" | "gestao"
  const [linhas, setLinhas] = useState([]); // [{ indicador, nome_meta, unidade, peso, meses: {1: valor, 2: valor...} }]
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const areaNome = areaSelecionada === "pco" ? "PCO" : "Gestão de Motoristas";
  const tituloArea = areaSelecionada === "pco" ? "PCO" : "Gestão de Motoristas";

  useEffect(() => {
    async function carregarMetas() {
      setLoading(true);
      setErro(null);

      try {
        // 1) Buscar a área (PCO ou Gestão de Motoristas)
        const { data: area, error: areaError } = await supabase
          .from("areas")
          .select("id, nome")
          .eq("nome", areaNome)
          .maybeSingle();

        if (areaError) {
          console.error(areaError);
          throw new Error("Erro ao buscar área no Supabase.");
        }

        if (!area) {
          setLinhas([]);
          throw new Error(
            `Área "${areaNome}" não encontrada na tabela 'areas'.`
          );
        }

        const areaId = area.id;

        // 2) Buscar metas (cabeçalho) dessa área para 2026
        const { data: metas, error: metasError } = await supabase
          .from("metas_farol")
          .select("id, indicador, nome_meta, unidade, peso")
          .eq("area_id", areaId)
          .eq("ano", 2026)
          .order("id", { ascending: true });

        if (metasError) {
          console.error(metasError);
          throw new Error("Erro ao buscar metas no Supabase.");
        }

        if (!metas || metas.length === 0) {
          setLinhas([]);
          setErro("Nenhuma meta cadastrada para esta área em 2026.");
          setLoading(false);
          return;
        }

        const metaIds = metas.map((m) => m.id);

        // 3) Buscar metas mensais para essas metas
        const { data: metasMensais, error: mensaisError } = await supabase
          .from("metas_farol_mensal")
          .select("meta_id, ano, mes, valor_meta")
          .in("meta_id", metaIds)
          .eq("ano", 2026);

        if (mensaisError) {
          console.error(mensaisError);
          throw new Error("Erro ao buscar metas mensais no Supabase.");
        }

        // 4) Montar estrutura em memória: uma linha por indicador
        const mapaMetas = {};
        metas.forEach((m) => {
          mapaMetas[m.id] = {
            indicador: m.indicador,
            nome_meta: m.nome_meta,
            unidade: m.unidade,
            peso: m.peso,
            meses: {}, // será preenchido abaixo
          };
        });

        (metasMensais || []).forEach((mm) => {
          const alvo = mapaMetas[mm.meta_id];
          if (!alvo) return;
          alvo.meses[mm.mes] = mm.valor_meta;
        });

        const linhasMontadas = Object.values(mapaMetas);

        setLinhas(linhasMontadas);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setErro(e.message || "Erro ao carregar farol de metas.");
        setLoading(false);
      }
    }

    carregarMetas();
  }, [areaNome]); // sempre que trocar PCO ↔ Gestão, recarrega

  return (
    <section className="bg-white rounded-xl shadow-sm p-4 md:p-5 border border-gray-100 mt-4">
      {/* Cabeçalho + Botões de área */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Farol de Metas — Operação
          </h2>
          <p className="text-sm text-gray-500">
            Metas anuais de 2026 carregadas diretamente do Supabase. Cada área
            da Operação (PCO e Gestão de Motoristas) tem seus próprios
            indicadores, pesos e metas mensais.
          </p>
        </div>

        {/* Botões PCO x Gestão de Motoristas */}
        <div className="inline-flex rounded-lg bg-gray-100 p-1 text-xs md:text-sm">
          <button
            type="button"
            onClick={() => setAreaSelecionada("pco")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              areaSelecionada === "pco"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-700 hover:bg-gray-200"
            }`}
          >
            PCO
          </button>
          <button
            type="button"
            onClick={() => setAreaSelecionada("gestao")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              areaSelecionada === "gestao"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-700 hover:bg-gray-200"
            }`}
          >
            Gestão de Motoristas
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Área selecionada:{" "}
        <span className="font-semibold text-gray-700">{tituloArea}</span>
      </p>

      {loading && (
        <p className="text-sm text-gray-500 mb-2">Carregando metas…</p>
      )}

      {erro && !loading && (
        <p className="text-sm text-red-500 mb-2">{erro}</p>
      )}

      {/* Tabela de metas (só renderiza se houver linhas) */}
      {!loading && linhas && linhas.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-[11px] md:text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">
                  Indicador
                </th>
                <th className="px-2 py-2 text-center font-semibold text-gray-700">
                  Peso
                </th>
                <th className="px-2 py-2 text-center font-semibold text-gray-700">
                  Unidade
                </th>
                {MESES_ORDENADOS.map((mesNum) => (
                  <th
                    key={mesNum}
                    className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap"
                  >
                    {MESES_LABEL[mesNum]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr
                  key={linha.indicador}
                  className="border-t border-gray-200"
                >
                  <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                    {linha.nome_meta || linha.indicador}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-800">
                    {linha.peso}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-800">
                    {linha.unidade || "-"}
                  </td>
                  {MESES_ORDENADOS.map((mesNum) => (
                    <td
                      key={mesNum}
                      className="px-2 py-2 text-center text-gray-700 whitespace-nowrap"
                    >
                      {linha.meses && linha.meses[mesNum] != null
                        ? linha.meses[mesNum]
                        : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-gray-500 mt-3">
        Próximos passos: incluir o realizado por mês, cálculo de atingimento,
        farol de cores e pontuação ponderada pelo peso de cada indicador.
      </p>
    </section>
  );
}

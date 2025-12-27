import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Operacao() {
  const [areas, setAreas] = useState([]);
  const [metas, setMetas] = useState([]);
  const [areaSelecionada, setAreaSelecionada] = useState(null);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  // ==========================
  // 🔹 Carrega áreas de Operação
  // ==========================
  async function carregarAreas() {
    setErro(null);

    const { data, error } = await supabase
      .from("areas")
      .select("id, nome, setor")
      .eq("setor", "Operação");

    if (error) {
      console.error("ERRO AO CARREGAR AREAS:", error);
      setErro("Erro ao carregar áreas da operação.");
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      console.warn("Nenhuma área encontrada no Supabase.");
      setErro("Nenhuma área cadastrada no Supabase para Operação.");
      setLoading(false);
      return;
    }

    setAreas(data);
    setAreaSelecionada(data[0].id);
  }

  // ==========================
  // 🔹 Carrega metas da área
  // ==========================
  async function carregarMetas(areaId) {
    if (!areaId) return;

    setLoading(true);
    setErro(null);

    const { data, error } = await supabase
      .from("metas_farol")
      .select("*")
      .eq("area_id", areaId);

    if (error) {
      console.error("ERRO AO CARREGAR METAS:", error);
      setErro("Erro ao carregar metas do Supabase.");
      setLoading(false);
      return;
    }

    setMetas(data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregarAreas();
  }, []);

  useEffect(() => {
    if (areaSelecionada) {
      carregarMetas(areaSelecionada);
    }
  }, [areaSelecionada]);

  const meses = [
    "jan/26","fev/26","mar/26","abr/26","mai/26","jun/26",
    "jul/26","ago/26","set/26","out/26","nov/26","dez/26"
  ];

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-semibold">
        Farol de Metas — Operação
      </h1>

      <p className="text-sm text-slate-600">
        Metas carregadas do Supabase para as áreas
        <strong> PCO</strong> e <strong>Gestão de Motoristas</strong>.
      </p>

      {/* ====================== */}
      {/* 🔹 Mensagens de erro   */}
      {/* ====================== */}
      {erro && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg">
          {erro}
        </div>
      )}

      {/* ====================== */}
      {/* 🔹 Botões de área       */}
      {/* ====================== */}
      {areas.length > 0 && (
        <div className="flex gap-3">
          {areas.map(a => (
            <button
              key={a.id}
              onClick={() => setAreaSelecionada(a.id)}
              className={[
                "px-4 py-2 rounded-lg border transition",
                areaSelecionada === a.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white border-slate-300 hover:bg-slate-100"
              ].join(" ")}
            >
              {a.nome}
            </button>
          ))}
        </div>
      )}

      {/* ====================== */}
      {/* 🔹 Loading state       */}
      {/* ====================== */}
      {loading && (
        <div className="bg-white p-4 rounded-lg shadow">
          Carregando metas…
        </div>
      )}

      {/* ====================== */}
      {/* 🔹 Nenhuma meta        */}
      {/* ====================== */}
      {!loading && metas.length === 0 && (
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-700 px-4 py-2 rounded-lg">
          Nenhuma meta cadastrada para esta área.
        </div>
      )}

      {/* ====================== */}
      {/* 🔹 Tabela de metas     */}
      {/* ====================== */}
      {!loading && metas.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2 text-left">Indicador</th>
                <th className="p-2 text-center">Peso</th>
                <th className="p-2 text-center">Unidade</th>

                {meses.map(m => (
                  <th key={m} className="p-2 text-center">{m}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {metas.map(meta => (
                <tr key={meta.id} className="border-t">
                  <td className="p-2">{meta.indicador}</td>
                  <td className="p-2 text-center">{meta.peso}</td>
                  <td className="p-2 text-center">{meta.unidade}</td>

                  {meses.map(m => (
                    <td key={m} className="p-2 text-center">
                      {meta.metas_mensais?.[m] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      )}

    </div>
  );
}

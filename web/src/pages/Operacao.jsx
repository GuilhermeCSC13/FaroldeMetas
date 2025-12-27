import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Operacao() {
  const [areas, setAreas] = useState([]);
  const [metas, setMetas] = useState([]);
  const [areaSelecionada, setAreaSelecionada] = useState(null);
  const [loading, setLoading] = useState(true);

  // ==========================
  // 🔹 Carrega áreas da Operação
  // ==========================
  async function carregarAreas() {
    const { data, error } = await supabase
      .from("areas")
      .select("id, nome, setor")
      .eq("setor", "Operação");

    if (!error && data.length > 0) {
      setAreas(data);
      setAreaSelecionada(data[0].id);
    }
  }

  // ==========================
  // 🔹 Carrega metas da área selecionada
  // ==========================
  async function carregarMetas(areaId) {
    setLoading(true);

    const { data, error } = await supabase
      .from("metas_farol")
      .select("id, indicador, peso, unidade, metas_mensais")
      .eq("area_id", areaId);

    if (!error) {
      setMetas(data);
    }

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

  // ==========================
  // 🔹 Meses padrão (2026)
  // ==========================
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
        Metas anuais carregadas diretamente do Supabase para as áreas
        <strong> PCO</strong> e <strong>Gestão de Motoristas</strong>.
      </p>

      {/* ========================== */}
      {/* 🔹 Botões de seleção de área */}
      {/* ========================== */}
      <div className="flex gap-3">
        {areas.map((a) => (
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

      {/* ========================== */}
      {/* 🔹 Tabela */}
      {/* ========================== */}
      <div className="bg-white rounded-xl shadow p-4">

        {loading ? (
          <p>Carregando metas...</p>
        ) : metas.length === 0 ? (
          <p className="text-slate-500">Nenhuma meta cadastrada para esta área.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="p-2 text-left">Indicador</th>
                  <th className="p-2 text-center">Peso</th>
                  <th className="p-2 text-center">Unidade</th>

                  {meses.map((m) => (
                    <th key={m} className="p-2 text-center">{m}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {metas.map((meta) => (
                  <tr key={meta.id} className="border-t">
                    <td className="p-2">{meta.indicador}</td>
                    <td className="p-2 text-center">{meta.peso}</td>
                    <td className="p-2 text-center">{meta.unidade}</td>

                    {meses.map((m) => (
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

      <p className="text-xs text-slate-500">
        Posteriormente vamos aplicar:
        cálculo de atingimento, cores e peso ponderado por indicador.
      </p>
    </div>
  );
}

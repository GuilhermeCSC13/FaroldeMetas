import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function PlanejamentoTatico() {
  const [areas, setAreas] = useState([]);

  useEffect(() => {
    async function carregarAreas() {
      const { data, error } = await supabase
        .from("areas")
        .select("id, nome, descricao")
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao carregar áreas:", error);
        return;
      }

      setAreas(data || []);
    }

    carregarAreas();
  }, []);

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

      {/* Cards principais */}
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

      {/* Estrutura de metas e rotinas (mock) */}
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

      {/* Áreas vindo do Supabase */}
      <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Áreas cadastradas no Farol (Supabase)
        </h3>

        {areas.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhuma área encontrada ainda. Depois vamos permitir o cadastro pela
            própria ferramenta.
          </p>
        ) : (
          <ul className="text-sm text-slate-600 space-y-1">
            {areas.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.nome}</span>
                {a.descricao && (
                  <span className="text-xs text-slate-500">
                    {" "}
                    – {a.descricao}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

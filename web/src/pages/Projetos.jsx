// src/pages/Projetos.jsx
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";

const ASANA_PROJECTS_SYNC_URL =
  "https://zgmxylsmbremaprebifq.supabase.co/functions/v1/clever-endpoint";

const ASANA_TASKS_SYNC_URL =
  "https://zgmxylsmbremaprebifq.supabase.co/functions/v1/asana-tarefas-sync";

const AREAS = [
  { id: 0, label: "Todas as Áreas" },
  { id: 1, label: "PCO" },
  { id: 2, label: "Gestão de Motoristas" },
  { id: 3, label: "Manutenção" },
  { id: 4, label: "MOOV" },
  { id: 5, label: "Administrativo" },
];

function getStatusLabel(row) {
  if (row.total_tarefas === 0) return "Sem tarefas";
  if (row.tarefas_atrasadas > 0) return "Com atrasos";
  if (row.percentual_conclusao === 100) return "Concluído";
  return "Em andamento";
}

function getStatusColorClass(row) {
  if (row.total_tarefas === 0) return "bg-slate-100 text-slate-700";
  if (row.tarefas_atrasadas > 0) return "bg-red-100 text-red-700";
  if (row.percentual_conclusao === 100) return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-800";
}

export default function Projetos() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [areaAtiva, setAreaAtiva] = useState(0);

  async function carregarStatus() {
    setLoading(true);
    const { data, error } = await supabase
      .from("v_status_projetos")
      .select("*")
      .order("area_id", { ascending: true })
      .order("projeto_nome", { ascending: true });

    if (error) {
      console.error("Erro ao carregar v_status_projetos:", error);
    } else {
      setDados(data || []);
    }
    setLoading(false);
  }

  async function sincronizarAsana() {
    try {
      setSyncing(true);

      // 1) Atualiza projetos
      await fetch(ASANA_PROJECTS_SYNC_URL, { method: "POST" });

      // 2) Atualiza tarefas
      await fetch(ASANA_TASKS_SYNC_URL, { method: "POST" });

      // 3) Recarrega visão consolidada
      await carregarStatus();
    } catch (err) {
      console.error("Erro ao sincronizar Asana:", err);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    carregarStatus();
  }, []);

  const dadosFiltrados = useMemo(() => {
    if (areaAtiva === 0) return dados;
    return dados.filter((d) => d.area_id === areaAtiva);
  }, [dados, areaAtiva]);

  return (
    <Layout>
      <div className="p-4 flex flex-col gap-4">
        {/* Cabeçalho */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Portfólio de Projetos
            </h1>
            <p className="text-sm text-slate-500">
              Status de cada projeto (tarefas totais, concluídas, atrasadas e
              percentual de conclusão) com base nas tarefas do Asana.
            </p>
          </div>

          <button
            onClick={sincronizarAsana}
            disabled={syncing}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
          >
            {syncing
              ? "Sincronizando projetos e tarefas..."
              : "Sincronizar com Asana"}
          </button>
        </header>

        {/* Filtro por área */}
        <div className="flex flex-wrap gap-2">
          {AREAS.map((area) => (
            <button
              key={area.id}
              onClick={() => setAreaAtiva(area.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                areaAtiva === area.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {area.label}
            </button>
          ))}
        </div>

        {/* Tabela de status dos projetos */}
        {loading ? (
          <p className="text-sm text-slate-500">Carregando status...</p>
        ) : dadosFiltrados.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum projeto encontrado para esse filtro.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-xs text-slate-500 uppercase">
                  <th className="px-3 py-2 text-left">Projeto</th>
                  <th className="px-3 py-2 text-left">Área</th>
                  <th className="px-3 py-2 text-center">Tarefas</th>
                  <th className="px-3 py-2 text-center">Concluídas</th>
                  <th className="px-3 py-2 text-center">Atrasadas</th>
                  <th className="px-3 py-2 text-center">% Conclusão</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {dadosFiltrados.map((row) => {
                  const statusLabel = getStatusLabel(row);
                  const statusClass = getStatusColorClass(row);
                  return (
                    <tr
                      key={row.projeto_gid}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-3 py-2 text-slate-800">
                        {row.projeto_nome}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {row.area_nome || "–"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.total_tarefas}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.tarefas_concluidas}
                      </td>
                      <td className="px-3 py-2 text-center text-red-600 font-semibold">
                        {row.tarefas_atrasadas}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.percentual_conclusao}%
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

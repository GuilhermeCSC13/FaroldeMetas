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

  const [projetoSelecionado, setProjetoSelecionado] = useState(null);
  const [tarefasAtrasadas, setTarefasAtrasadas] = useState([]);
  const [loadingTarefas, setLoadingTarefas] = useState(false);

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

      // 1) Atualiza projetos (com área e permalink)
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

  // Apenas projetos de áreas 1..5 (nada de "Outros")
  const baseFiltrada = useMemo(
    () => dados.filter((d) => d.area_id && [1, 2, 3, 4, 5].includes(d.area_id)),
    [dados]
  );

  const dadosFiltrados = useMemo(() => {
    if (areaAtiva === 0) return baseFiltrada;
    return baseFiltrada.filter((d) => d.area_id === areaAtiva);
  }, [baseFiltrada, areaAtiva]);

  async function abrirDetalhesProjeto(row) {
    setProjetoSelecionado(row);
    setLoadingTarefas(true);
    setTarefasAtrasadas([]);

    const hoje = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("asana_tarefas")
      .select("gid, name, due_on, assignee_name, permalink_url")
      .eq("project_gid", row.projeto_gid)
      .eq("completed", false)
      .not("due_on", "is", null)
      .lt("due_on", hoje)
      .order("due_on", { ascending: true });

    if (error) {
      console.error("Erro ao carregar tarefas atrasadas:", error);
    } else {
      setTarefasAtrasadas(data || []);
    }

    setLoadingTarefas(false);
  }

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
              Acompanhe se cada projeto tem ações atrasadas ou não, com base nas
              tarefas do Asana.
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

        {/* Filtro por área (apenas 1..5) */}
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
                      className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer"
                      onClick={() => abrirDetalhesProjeto(row)}
                    >
                      <td className="px-3 py-2 text-slate-800 underline decoration-dotted">
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

        {/* Detalhe do projeto selecionado: tarefas atrasadas + links Asana */}
        {projetoSelecionado && (
          <div className="mt-4 border border-slate-200 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  {projetoSelecionado.projeto_nome}
                </h2>
                <p className="text-xs text-slate-500">
                  Área: {projetoSelecionado.area_nome || "–"}
                </p>
              </div>

              {projetoSelecionado.permalink_url && (
                <a
                  href={projetoSelecionado.permalink_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-3 py-1 rounded-full bg-blue-600 text-white font-semibold"
                >
                  Abrir projeto no Asana
                </a>
              )}
            </div>

            <h3 className="text-xs font-semibold text-slate-700 mb-2">
              Tarefas atrasadas
            </h3>

            {loadingTarefas ? (
              <p className="text-xs text-slate-500">Carregando tarefas...</p>
            ) : tarefasAtrasadas.length === 0 ? (
              <p className="text-xs text-emerald-600">
                Nenhuma tarefa atrasada neste projeto.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {tarefasAtrasadas.map((t) => (
                  <li
                    key={t.gid}
                    className="text-xs flex items-center justify-between gap-2 border-b border-slate-100 pb-1"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">
                        {t.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Vencimento: {t.due_on}{" "}
                        {t.assignee_name && `· Responsável: ${t.assignee_name}`}
                      </span>
                    </div>
                    {t.permalink_url && (
                      <a
                        href={t.permalink_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold"
                      >
                        Abrir no Asana
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

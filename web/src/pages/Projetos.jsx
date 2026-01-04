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

  const [modalAberto, setModalAberto] = useState(false);
  const [projetoSelecionado, setProjetoSelecionado] = useState(null);
  const [tarefasProjeto, setTarefasProjeto] = useState([]);
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

  // Apenas projetos de áreas 1..5
  const baseFiltrada = useMemo(
    () => dados.filter((d) => d.area_id && [1, 2, 3, 4, 5].includes(d.area_id)),
    [dados]
  );

  const dadosFiltrados = useMemo(() => {
    if (areaAtiva === 0) return baseFiltrada;
    return baseFiltrada.filter((d) => d.area_id === areaAtiva);
  }, [baseFiltrada, areaAtiva]);

  async function abrirModalProjeto(row) {
    setProjetoSelecionado(row);
    setModalAberto(true);
    setLoadingTarefas(true);
    setTarefasProjeto([]);

    const { data, error } = await supabase
      .from("asana_tarefas")
      .select("gid, name, due_on, completed, assignee_name, permalink_url")
      .eq("project_gid", row.projeto_gid)
      .order("completed", { ascending: true })
      .order("due_on", { ascending: true });

    if (error) {
      console.error("Erro ao carregar tarefas do projeto:", error);
    } else {
      setTarefasProjeto(data || []);
    }

    setLoadingTarefas(false);
  }

  function fecharModal() {
    setModalAberto(false);
    setProjetoSelecionado(null);
    setTarefasProjeto([]);
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

        {/* Filtro por área (somente 1..5) */}
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
                  <th className="px-3 py-2 text-center">Ações</th>
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
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => abrirModalProjeto(row)}
                          className="px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700"
                        >
                          Abrir no Asana
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* MODAL: Tarefas do projeto selecionado */}
        {modalAberto && projetoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
              {/* Cabeçalho do modal */}
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    {projetoSelecionado.projeto_nome}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Área: {projetoSelecionado.area_nome || "–"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {projetoSelecionado.permalink_url && (
                    <a
                      href={projetoSelecionado.permalink_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold"
                    >
                      Abrir projeto no Asana
                    </a>
                  )}
                  <button
                    onClick={fecharModal}
                    className="text-[11px] px-3 py-1 rounded-full bg-red-100 text-red-700 font-semibold"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              {/* Corpo do modal */}
              <div className="flex-1 overflow-y-auto p-4">
                <h3 className="text-xs font-semibold text-slate-700 mb-2">
                  Tarefas do projeto
                </h3>

                {loadingTarefas ? (
                  <p className="text-xs text-slate-500">
                    Carregando tarefas...
                  </p>
                ) : tarefasProjeto.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Nenhuma tarefa encontrada para este projeto.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {tarefasProjeto.map((t) => {
                      const atrasada =
                        !t.completed &&
                        t.due_on &&
                        new Date(t.due_on) < new Date();

                      return (
                        <div
                          key={t.gid}
                          className="border border-slate-200 rounded-lg px-3 py-2 flex items-start justify-between gap-3"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-800">
                              {t.name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Vencimento: {t.due_on || "—"} · Status:{" "}
                              {t.completed ? "Concluída" : "Em aberto"}
                              {atrasada ? " (atrasada)" : ""}
                              {t.assignee_name && ` · Resp.: ${t.assignee_name}`}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                t.completed
                                  ? "bg-emerald-100 text-emerald-700"
                                  : atrasada
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {t.completed
                                ? "Concluída"
                                : atrasada
                                ? "Atrasada"
                                : "Em aberto"}
                            </span>
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

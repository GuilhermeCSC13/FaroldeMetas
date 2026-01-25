// src/pages/TiposReuniao.jsx
import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import {
  Tags,
  Search,
  X,
  Clock,
  CalendarDays,
  FileText,
  ArrowRight,
} from "lucide-react";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PERIODICIDADE_LABEL = {
  SEMANAL: "Semanal",
  QUINZENAL: "Quinzenal",
  MENSAL: "Mensal",
  TRES_VEZES_SEMANA: "Seg/Qua/Sex",
  IRREGULAR: "Irregular",
};

function formatDiasSemana(dias) {
  if (!dias || !Array.isArray(dias) || dias.length === 0) return "—";
  // dias: 1=Seg ... 7=Dom (convenção que definimos no SQL)
  const map = (n) => {
    const idx = Number(n);
    if (idx === 7) return "Dom";
    if (idx >= 1 && idx <= 6) return DIAS_SEMANA[idx];
    return "";
  };
  const names = dias.map(map).filter(Boolean);

  // Se vier {1,3,5}, mostra padrão
  const key = names.join(",");
  if (key === "Seg,Qua,Sex") return "Seg / Qua / Sex";

  return names.join(" / ");
}

function formatHora(hora) {
  if (!hora) return "—";
  // Pode vir "09:00:00" ou "09:00"
  const s = String(hora);
  return s.slice(0, 5);
}

function snippet(text, max = 140) {
  if (!text) return "";
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max) + "...";
}

export default function TiposReuniao() {
  const [loading, setLoading] = useState(true);
  const [tipos, setTipos] = useState([]);
  const [q, setQ] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState(null);

  useEffect(() => {
    fetchTipos();
  }, []);

  const fetchTipos = async () => {
    setLoading(true);

    // Ajuste a lista de colunas conforme sua tabela
    const { data, error } = await supabase
      .from("tipos_reuniao")
      .select(
        "id, nome, slug, periodicidade, dias_semana, horario_inicio, ata_principal, cor, ordem"
      )
      .order("ordem", { ascending: true, nullsFirst: false })
      .order("nome", { ascending: true });

    if (error) {
      console.error(error);
      alert("Erro ao carregar Tipos de Reunião.");
      setTipos([]);
      setLoading(false);
      return;
    }

    setTipos(data || []);
    setLoading(false);
  };

  const tiposFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return tipos;
    return tipos.filter((t) => {
      const nome = String(t?.nome || "").toLowerCase();
      const slug = String(t?.slug || "").toLowerCase();
      const ata = String(t?.ata_principal || "").toLowerCase();
      return nome.includes(term) || slug.includes(term) || ata.includes(term);
    });
  }, [tipos, q]);

  const abrirDetalhe = (tipo) => {
    setSelectedTipo(tipo);
    setModalOpen(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    setSelectedTipo(null);
  };

  return (
    <Layout>
      <div className="p-6 h-full flex flex-col font-sans bg-gray-50 relative">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700">
              <Tags size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Tipos de Reunião
              </h1>
              <p className="text-xs text-gray-500">
                Padrões • periodicidade • ATA principal
              </p>
            </div>
          </div>

          {/* Busca */}
          <div className="w-full md:w-[420px]">
            <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
              <Search size={16} className="text-gray-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, slug ou texto da ata..."
                className="w-full bg-transparent outline-none text-sm text-gray-700"
              />
              {q?.length > 0 && (
                <button
                  onClick={() => setQ("")}
                  className="text-gray-400 hover:text-gray-700"
                  title="Limpar"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          {/* Topbar */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {loading ? "Carregando..." : `${tiposFiltrados.length} tipo(s)`}
            </p>
            <button
              onClick={fetchTipos}
              className="text-sm font-bold px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
            >
              Recarregar
            </button>
          </div>

          {/* Grid de Cards */}
          <div className="p-5 overflow-y-auto flex-1">
            {loading ? (
              <div className="text-gray-400 text-center py-20">
                Carregando Tipos de Reunião...
              </div>
            ) : tiposFiltrados.length === 0 ? (
              <div className="text-gray-400 text-center py-20">
                Nenhum tipo encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tiposFiltrados.map((t) => {
                  const periodicidade =
                    PERIODICIDADE_LABEL[t?.periodicidade] ||
                    t?.periodicidade ||
                    "—";
                  const dias = formatDiasSemana(t?.dias_semana);
                  const hora = formatHora(t?.horario_inicio);
                  const preview = snippet(t?.ata_principal, 160);

                  return (
                    <button
                      key={t.id}
                      onClick={() => abrirDetalhe(t)}
                      className="text-left bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-base truncate group-hover:text-blue-700 transition-colors">
                            {t?.nome || "Sem nome"}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {t?.slug ? `slug: ${t.slug}` : "slug: —"}
                          </p>
                        </div>

                        <div
                          className="w-3 h-3 rounded-full mt-1 shrink-0"
                          style={{ backgroundColor: t?.cor || "#111827" }}
                          title={t?.cor || "Sem cor"}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full">
                          <CalendarDays size={12} />
                          {periodicidade}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full">
                          <CalendarDays size={12} />
                          {dias}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full">
                          <Clock size={12} />
                          {hora}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase">
                          <FileText size={14} />
                          ATA Principal
                        </div>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-3">
                          {preview || "Sem ATA cadastrada."}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-end text-blue-700 font-bold text-sm gap-2 opacity-80 group-hover:opacity-100">
                        Ver detalhes <ArrowRight size={16} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Detalhe */}
        {modalOpen && selectedTipo && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-gray-200">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: selectedTipo?.cor || "#111827",
                    }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">
                      {selectedTipo?.nome}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">
                      {selectedTipo?.slug ? `slug: ${selectedTipo.slug}` : ""}
                    </p>
                  </div>
                </div>

                <button
                  onClick={fecharModal}
                  className="text-gray-400 hover:text-red-500"
                  title="Fechar"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Metadados */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">
                      Periodicidade
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {PERIODICIDADE_LABEL[selectedTipo?.periodicidade] ||
                        selectedTipo?.periodicidade ||
                        "—"}
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">
                      Dias
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {formatDiasSemana(selectedTipo?.dias_semana)}
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">
                      Horário
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {formatHora(selectedTipo?.horario_inicio)}
                    </p>
                  </div>
                </div>

                {/* ATA principal completa */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                    <FileText size={16} /> ATA Principal
                  </p>
                  <div className="text-sm text-gray-800 bg-white border border-gray-200 rounded-lg p-4 max-h-[55vh] overflow-y-auto whitespace-pre-wrap">
                    {selectedTipo?.ata_principal || "Sem ATA cadastrada."}
                  </div>
                </div>

                {/* Rodapé */}
                <div className="flex justify-end">
                  <button
                    onClick={fecharModal}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white font-bold hover:bg-gray-950 transition-colors text-sm"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

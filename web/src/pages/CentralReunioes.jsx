import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalIcon,
  List,
  X,
  Save,
  Trash2,
} from "lucide-react";
import { salvarReuniao, atualizarReuniao } from "../services/agendaService";

// ✅ IMPORTANTE: use a versão atualizada do DetalhesReuniao (com tiposReuniao + hora_fim)
import DetalhesReuniao from "../components/tatico/DetalhesReuniao";

const SENHA_EXCLUSAO = "KM2026";

export default function CentralReunioes() {
  const [view, setView] = useState("calendar"); // 'calendar' | 'week' | 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reunioes, setReunioes] = useState([]);
  const [tiposReuniao, setTiposReuniao] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReuniao, setEditingReuniao] = useState(null);

  const [formData, setFormData] = useState({
    titulo: "",
    // ✅ agora é FK
    tipo_reuniao_id: null,
    // (opcional/legado) mantém para compatibilidade com telas antigas e para backfill
    tipo_reuniao_nome: "Geral",

    data: "",
    hora: "09:00",
    hora_fim: "09:15", // ✅ novo campo no form (término)

    cor: "#3B82F6",
    responsavel: "",
    pauta: "",
    recorrencia: "unica",
  });

  const [draggingReuniao, setDraggingReuniao] = useState(null);

  // -----------------------------
  // Helpers
  // -----------------------------
  const parseDataLocal = (dataString) => {
    if (!dataString) return new Date();
    return parseISO(String(dataString).substring(0, 19));
  };

  // Normaliza "Oferta_Demanda" -> "oferta_demanda" para achar pelo slug
  const normalizeKey = (txt) =>
    String(txt || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const tiposById = useMemo(() => {
    const m = new Map();
    (tiposReuniao || []).forEach((t) => m.set(String(t.id), t));
    return m;
  }, [tiposReuniao]);

  const tiposBySlug = useMemo(() => {
    const m = new Map();
    (tiposReuniao || []).forEach((t) => {
      if (t.slug) m.set(String(t.slug), t);
    });
    return m;
  }, [tiposReuniao]);

  const getTipoDefaultGeral = () => {
    // prioridade: slug "geral"
    const t1 = tiposBySlug.get("geral");
    if (t1) return t1;

    // fallback: nome "Geral"
    const t2 = (tiposReuniao || []).find((t) => (t.nome || "").toLowerCase() === "geral");
    if (t2) return t2;

    // último fallback: primeiro ativo
    const t3 = (tiposReuniao || []).find((t) => t.ativo !== false);
    return t3 || null;
  };

  const getMeetingTipoNome = (m) => m?.tipo?.nome || m?.tipo_reuniao || "";

  const getMeetingCor = (m) => m?.cor || m?.tipo?.cor || "#CBD5E1";

  const getMeetingInicio = (m) => {
    const dt = parseDataLocal(m.data_hora);
    // se reunião tem horario_inicio gravado, usa ele; senão usa do datetime
    const hi = m?.horario_inicio ? String(m.horario_inicio).slice(0, 5) : format(dt, "HH:mm");
    return hi;
  };

  const getMeetingFim = (m) => {
    // se reunião tem horario_fim gravado, usa ele; senão tenta o do tipo; senão vazio
    const hf = m?.horario_fim ? String(m.horario_fim).slice(0, 5) : "";
    const tipoFim = m?.tipo?.horario_fim ? String(m.tipo.horario_fim).slice(0, 5) : "";
    return hf || tipoFim || "";
  };

  // -----------------------------
  // Fetch
  // -----------------------------
  useEffect(() => {
    fetchTipos();
  }, []);

  useEffect(() => {
    fetchReunioes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const fetchTipos = async () => {
    const { data, error } = await supabase
      .from("tipos_reuniao")
      .select("id, slug, nome, horario_inicio, horario_fim, ata_principal, cor, ativo")
      .order("nome");

    if (error) {
      console.error("Erro ao buscar tipos_reuniao:", error);
      setTiposReuniao([]);
      return;
    }
    setTiposReuniao(data || []);
  };

  const fetchReunioes = async () => {
    // Se quiser otimizar por período depois, fazemos.
    const { data, error } = await supabase
      .from("reunioes")
      .select(
        `
        *,
        tipo:tipos_reuniao (
          id, slug, nome, cor, horario_inicio, horario_fim, ata_principal
        )
      `
      )
      .order("data_hora");

    if (error) {
      console.error("Erro ao buscar reunioes:", error);
      setReunioes([]);
      return;
    }
    setReunioes(data || []);
  };

  // -----------------------------
  // Open modal (new)
  // -----------------------------
  const onDateClick = (day) => {
    const tipoDefault = getTipoDefaultGeral();

    setEditingReuniao(null);
    setFormData({
      titulo: "",
      tipo_reuniao_id: tipoDefault?.id || null,
      tipo_reuniao_nome: tipoDefault?.nome || "Geral",

      data: format(day, "yyyy-MM-dd"),
      hora: (tipoDefault?.horario_inicio ? String(tipoDefault.horario_inicio).slice(0, 5) : "09:00"),
      hora_fim: (tipoDefault?.horario_fim ? String(tipoDefault.horario_fim).slice(0, 5) : "09:15"),

      cor: tipoDefault?.cor || "#3B82F6",
      responsavel: "",
      pauta: tipoDefault?.ata_principal || "",
      recorrencia: "unica",
    });
    setIsModalOpen(true);
  };

  // -----------------------------
  // Edit
  // -----------------------------
  const handleEdit = (reuniao) => {
    const dt = parseDataLocal(reuniao.data_hora);

    // Resolve tipo: prioridade FK já preenchida; fallback pelo texto tipo_reuniao -> slug
    let tipoId = reuniao.tipo_reuniao_id || reuniao.tipo?.id || null;
    let tipoNome = reuniao.tipo?.nome || reuniao.tipo_reuniao || "Geral";

    if (!tipoId && reuniao.tipo_reuniao) {
      const slug = normalizeKey(reuniao.tipo_reuniao);
      const t = tiposBySlug.get(slug);
      if (t?.id) {
        tipoId = t.id;
        tipoNome = t.nome || tipoNome;
      }
    }

    const inicio = reuniao.horario_inicio
      ? String(reuniao.horario_inicio).slice(0, 5)
      : format(dt, "HH:mm");

    const fim = reuniao.horario_fim
      ? String(reuniao.horario_fim).slice(0, 5)
      : reuniao.tipo?.horario_fim
        ? String(reuniao.tipo.horario_fim).slice(0, 5)
        : "";

    setFormData({
      titulo: reuniao.titulo || "",
      tipo_reuniao_id: tipoId,
      tipo_reuniao_nome: tipoNome,

      data: format(dt, "yyyy-MM-dd"),
      hora: inicio,
      hora_fim: fim || "09:15",

      cor: reuniao.cor || reuniao.tipo?.cor || "#3B82F6",
      responsavel: reuniao.responsavel || "",
      pauta: reuniao.pauta || "",
      recorrencia: "unica",
    });

    setEditingReuniao(reuniao);
    setIsModalOpen(true);
  };

  // -----------------------------
  // Submit
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    // data_hora = data + hora
    const dataHoraIso = `${formData.data}T${formData.hora}:00`;

    // ✅ grava também horários separados (sua tabela tem horario_inicio/horario_fim no CSV)
    const dados = {
      titulo: formData.titulo,
      data_hora: dataHoraIso,

      horario_inicio: formData.hora || null,
      horario_fim: formData.hora_fim || null,

      cor: formData.cor || null,
      responsavel: formData.responsavel || null,
      pauta: formData.pauta || null,

      // ✅ FK do tipo
      tipo_reuniao_id: formData.tipo_reuniao_id || null,

      // ✅ compatibilidade temporária (mantém texto)
      tipo_reuniao: formData.tipo_reuniao_nome || null,

      // seu campo atual
      area_id: 4,
    };

    try {
      if (editingReuniao) {
        const aplicar = window.confirm(
          "Deseja aplicar as mudanças para reuniões futuras desta série?"
        );
        await atualizarReuniao(editingReuniao.id, dados, aplicar);
      } else {
        await salvarReuniao(dados, formData.recorrencia);
      }

      setIsModalOpen(false);
      await fetchReunioes();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar.");
    }
  };

  // -----------------------------
  // Delete
  // -----------------------------
  const handleDelete = async () => {
    if (!editingReuniao) return;
    if (window.prompt("Digite a senha para confirmar exclusão:") !== SENHA_EXCLUSAO) return;

    const { error } = await supabase.from("reunioes").delete().eq("id", editingReuniao.id);
    if (error) {
      console.error(error);
      alert("Erro ao excluir.");
      return;
    }
    setIsModalOpen(false);
    fetchReunioes();
  };

  // -----------------------------
  // Calendar intervals
  // -----------------------------
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate)),
  });

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate),
    end: endOfWeek(currentDate),
  });

  // -----------------------------
  // Drag & Drop
  // -----------------------------
  const handleDragStart = (e, reuniao) => {
    setDraggingReuniao(reuniao);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverDay = (e) => e.preventDefault();

  const handleDropOnDay = async (e, day) => {
    e.preventDefault();
    if (!draggingReuniao) return;

    try {
      const dtOrig = parseDataLocal(draggingReuniao.data_hora);
      const novaDataHora = `${format(day, "yyyy-MM-dd")}T${format(dtOrig, "HH:mm:ss")}`;

      const { error } = await supabase
        .from("reunioes")
        .update({ data_hora: novaDataHora })
        .eq("id", draggingReuniao.id);

      if (error) throw error;

      fetchReunioes();
    } catch (err) {
      console.error(err);
      alert("Erro ao mover.");
    }
  };

  // -----------------------------
  // List grouping
  // -----------------------------
  const reunioesAgrupadas = useMemo(() => {
    return (reunioes || []).reduce((acc, r) => {
      const day = format(parseDataLocal(r.data_hora), "yyyy-MM-dd");
      if (!acc[day]) acc[day] = [];
      acc[day].push(r);
      return acc;
    }, {});
  }, [reunioes]);

  return (
    <Layout>
      <div className="flex flex-col h-screen p-6 bg-slate-50 font-sans overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Calendário Tático</h1>
          </div>

          <div className="flex gap-2">
            <div className="bg-white border p-1 rounded-lg flex shadow-sm">
              <button
                onClick={() => setView("calendar")}
                className={`p-2 rounded ${view === "calendar" ? "bg-blue-100 text-blue-700" : "text-slate-500"}`}
              >
                <CalIcon size={18} />
              </button>
              <button
                onClick={() => setView("week")}
                className={`p-2 rounded ${view === "week" ? "bg-blue-100 text-blue-700" : "text-slate-500"}`}
              >
                S
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-2 rounded ${view === "list" ? "bg-blue-100 text-blue-700" : "text-slate-500"}`}
              >
                <List size={18} />
              </button>
            </div>

            <button
              onClick={() => onDateClick(new Date())}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md active:scale-95 transition-all"
            >
              <Plus size={18} /> Nova
            </button>
          </div>
        </div>

        {/* VIEW: CALENDAR */}
        {view === "calendar" && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-slate-700 capitalize">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <ChevronLeft />
                </button>
                <button
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 flex-1 overflow-y-auto">
              {calendarDays.map((day) => (
                <div
                  key={day.toString()}
                  onClick={() => onDateClick(day)}
                  onDragOver={handleDragOverDay}
                  onDrop={(e) => handleDropOnDay(e, day)}
                  className={`border-r border-b min-h-[120px] p-2 hover:bg-blue-50/20 transition-colors ${
                    !isSameMonth(day, currentDate) ? "opacity-30" : ""
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${
                      isSameDay(day, new Date())
                        ? "bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center"
                        : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>

                  {reunioes
                    .filter((r) => isSameDay(parseDataLocal(r.data_hora), day))
                    .map((m) => {
                      const cor = getMeetingCor(m);
                      const horaInicio = getMeetingInicio(m);

                      return (
                        <div
                          key={m.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, m)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(m);
                          }}
                          className="text-[10px] truncate p-1 mt-1 rounded border-l-2 font-medium cursor-pointer"
                          style={{ borderLeftColor: cor, backgroundColor: cor + "15" }}
                          title={`${horaInicio} • ${m.titulo} • ${getMeetingTipoNome(m)}`}
                        >
                          {horaInicio} {m.titulo}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: WEEK */}
        {view === "week" && (
          <div className="flex-1 bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden">
            <div className="grid grid-cols-7 flex-1">
              {weekDays.map((day) => (
                <div key={day.toString()} className="border-r p-4 bg-white overflow-y-auto">
                  <h3
                    className={`text-sm font-bold mb-4 uppercase ${
                      isSameDay(day, new Date()) ? "text-blue-600" : "text-slate-400"
                    }`}
                  >
                    {format(day, "EEE dd/MM", { locale: ptBR })}
                  </h3>

                  {reunioes
                    .filter((r) => isSameDay(parseDataLocal(r.data_hora), day))
                    .map((m) => {
                      const cor = getMeetingCor(m);
                      const horaInicio = getMeetingInicio(m);
                      const horaFim = getMeetingFim(m);

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleEdit(m)}
                          className="p-3 mb-2 rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                          style={{ borderLeft: `4px solid ${cor}` }}
                        >
                          <p className="text-[10px] font-bold text-slate-400">
                            {horaInicio}
                            {horaFim ? `–${horaFim}` : ""}
                          </p>
                          <p className="text-xs font-bold text-slate-700">{m.titulo}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">
                            {getMeetingTipoNome(m)}
                          </p>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: LIST */}
        {view === "list" && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-y-auto p-6">
            {Object.entries(reunioesAgrupadas)
              .sort()
              .map(([day, meetings]) => (
                <div key={day} className="mb-8">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">
                    {format(parseISO(day), "dd 'de' MMMM", { locale: ptBR })}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {meetings.map((m) => {
                      const cor = getMeetingCor(m);
                      const horaInicio = getMeetingInicio(m);
                      const horaFim = getMeetingFim(m);

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleEdit(m)}
                          className="p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white hover:shadow-md transition-all flex items-center gap-4"
                        >
                          <div className="w-2 h-10 rounded-full" style={{ backgroundColor: cor }} />
                          <div>
                            <p className="text-xs font-bold text-blue-600">
                              {horaInicio}
                              {horaFim ? `–${horaFim}` : ""}
                            </p>
                            <h4 className="font-bold text-slate-800">{m.titulo}</h4>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">
                              {getMeetingTipoNome(m)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-white px-8 py-5 border-b flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-800">
                {editingReuniao ? "Editar Ritual" : "Novo Ritual"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form
              id="form-ritual"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-8 bg-white"
            >
              <DetalhesReuniao
                formData={formData}
                setFormData={setFormData}
                editingReuniao={editingReuniao}
                tiposReuniao={tiposReuniao}
              />
            </form>

            <div className="bg-slate-50 p-5 border-t flex justify-end gap-3 shrink-0">
              {editingReuniao && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="mr-auto text-red-500 font-bold flex items-center gap-2 px-4 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={16} /> Excluir Ritual
                </button>
              )}

              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 text-slate-500 font-bold"
              >
                Cancelar
              </button>

              <button
                type="submit"
                form="form-ritual"
                className="px-10 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all"
              >
                <Save size={18} /> Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

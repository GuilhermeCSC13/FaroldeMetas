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
import DetalhesReuniao from "../components/tatico/DetalhesReuniao";

const SENHA_EXCLUSAO = "KM2026";

function parseDataLocal(dataString) {
  if (!dataString) return new Date();
  return parseISO(String(dataString).substring(0, 19));
}

function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("realiz")) {
    return { text: "✅", title: "Realizada" };
  }
  if (s.includes("nao") || s.includes("não") || s.includes("cancel")) {
    return { text: "✖", title: "Não realizada" };
  }
  return { text: "●", title: "Agendada" };
}

// ✅ BLINDAGEM: remove qualquer "HH:MM" puro e chaves comuns de hora
function sanitizeReuniaoPayload(payload) {
  const clean = { ...payload };

  delete clean.horario_fim;
  delete clean.hora_fim;
  delete clean.horario_inicio;
  delete clean.hora_inicio;

  for (const [k, v] of Object.entries(clean)) {
    if (typeof v === "string" && /^\d{2}:\d{2}$/.test(v)) {
      delete clean[k];
    }
  }

  return clean;
}

export default function CentralReunioes() {
  const [view, setView] = useState("calendar"); // 'calendar' | 'week' | 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reunioes, setReunioes] = useState([]);
  const [tipos, setTipos] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReuniao, setEditingReuniao] = useState(null);

  const [formData, setFormData] = useState({
    titulo: "",
    tipo_reuniao_id: "",
    data: "",
    hora_inicio: "09:00",
    hora_fim: "09:15",
    cor: "#3B82F6",
    responsavel: "",
    ata: "",
    status: "Agendada",
  });

  const [draggingReuniao, setDraggingReuniao] = useState(null);

  useEffect(() => {
    fetchTipos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchReunioes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const fetchTipos = async () => {
    const { data, error } = await supabase
      .from("tipos_reuniao")
      .select("*")
      .order("nome");

    if (error) {
      console.error(error);
      alert("Erro ao carregar tipos de reunião.");
      return;
    }
    setTipos(data || []);
  };

  const fetchReunioes = async () => {
    const { data, error } = await supabase
      .from("reunioes")
      .select(
        `*,
         tipos_reuniao:tipo_reuniao_id ( id, nome, ata_principal, cor )`
      )
      .order("data_hora");

    if (error) console.error(error);
    setReunioes(data || []);
  };

  const getTipoById = (id) =>
    tipos.find((t) => String(t.id) === String(id)) || null;

  const onDateClick = (day) => {
    setEditingReuniao(null);

    setFormData({
      titulo: "",
      tipo_reuniao_id: "",
      data: format(day, "yyyy-MM-dd"),
      hora_inicio: "09:00",
      hora_fim: "09:15",
      cor: "#3B82F6",
      responsavel: "",
      ata: "",
      status: "Agendada",
    });

    setIsModalOpen(true);
  };

  const handleEdit = (reuniao) => {
    const dt = parseDataLocal(reuniao.data_hora);

    setFormData({
      titulo: reuniao.titulo || "",
      tipo_reuniao_id: reuniao.tipo_reuniao_id || "",
      data: format(dt, "yyyy-MM-dd"),
      hora_inicio: reuniao.horario_inicio
        ? String(reuniao.horario_inicio).slice(0, 5)
        : format(dt, "HH:mm"),
      hora_fim: reuniao.horario_fim
        ? String(reuniao.horario_fim).slice(0, 5)
        : "09:15",
      cor: reuniao.cor || "#3B82F6",
      responsavel: reuniao.responsavel || "",
      ata: reuniao.ata || "",
      status: reuniao.status || "Agendada",
    });

    setEditingReuniao(reuniao);
    setIsModalOpen(true);
  };

  const calcDuracaoSegundos = (inicioHHMM, fimHHMM) => {
    try {
      if (!inicioHHMM || !fimHHMM) return null;
      const [hi, mi] = inicioHHMM.split(":").map(Number);
      const [hf, mf] = fimHHMM.split(":").map(Number);
      const ini = hi * 60 + mi;
      const fim = hf * 60 + mf;
      const diff = Math.max(0, fim - ini);
      return diff * 60;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const tipo = getTipoById(formData.tipo_reuniao_id);
    const tipoNome = tipo?.nome || null;

    const dataHoraIso = `${formData.data}T${formData.hora_inicio}:00`;
    const duracao_segundos = calcDuracaoSegundos(
      formData.hora_inicio,
      formData.hora_fim
    );

    const dados = {
      titulo: formData.titulo,
      data_hora: dataHoraIso,
      tipo_reuniao_id: formData.tipo_reuniao_id || null,
      tipo_reuniao: tipoNome || "Geral",

      // ⚠️ se sua tabela NÃO tem esses campos (ou são timestamptz), não pode mandar "09:15"
      // mantemos no form/UI mas NÃO enviamos ao banco:
      // horario_inicio: formData.hora_inicio,
      // horario_fim: formData.hora_fim,

      duracao_segundos, // se não existir, pode remover também
      cor: formData.cor,
      responsavel: formData.responsavel,
      ata: formData.ata,
      status: formData.status,
      area_id: 4,
    };

    const dadosLimpos = sanitizeReuniaoPayload(dados);

    if (editingReuniao) {
      const aplicar = window.confirm(
        "Deseja aplicar as mudanças para reuniões futuras desta série?"
      );
      await atualizarReuniao(editingReuniao.id, dadosLimpos, aplicar);
    } else {
      await salvarReuniao(dadosLimpos, "unica");
    }

    setIsModalOpen(false);
    fetchReunioes();
  };

  const handleDelete = async () => {
    if (
      window.prompt("Digite a senha para confirmar exclusão:") !== SENHA_EXCLUSAO
    )
      return;

    await supabase.from("reunioes").delete().eq("id", editingReuniao.id);
    setIsModalOpen(false);
    fetchReunioes();
  };

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate)),
  });

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate),
    end: endOfWeek(currentDate),
  });

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
      const hora = format(dtOrig, "HH:mm:ss");
      const novaDataHora = `${format(day, "yyyy-MM-dd")}T${hora}`;

      await supabase
        .from("reunioes")
        .update({ data_hora: novaDataHora })
        .eq("id", draggingReuniao.id);

      fetchReunioes();
    } catch (err) {
      console.error(err);
      alert("Erro ao mover.");
    }
  };

  const reunioesAgrupadas = useMemo(() => {
    return reunioes.reduce((acc, r) => {
      const day = format(parseDataLocal(r.data_hora), "yyyy-MM-dd");
      if (!acc[day]) acc[day] = [];
      acc[day].push(r);
      return acc;
    }, {});
  }, [reunioes]);

  const tipoLabel = (r) => r.tipos_reuniao?.nome || r.tipo_reuniao || "Geral";

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
                className={`p-2 rounded ${
                  view === "calendar"
                    ? "bg-blue-100 text-blue-700"
                    : "text-slate-500"
                }`}
              >
                <CalIcon size={18} />
              </button>
              <button
                onClick={() => setView("week")}
                className={`p-2 rounded ${
                  view === "week"
                    ? "bg-blue-100 text-blue-700"
                    : "text-slate-500"
                }`}
                title="Semanal"
              >
                S
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-2 rounded ${
                  view === "list"
                    ? "bg-blue-100 text-blue-700"
                    : "text-slate-500"
                }`}
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

        {/* MODO CALENDÁRIO */}
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
                      const badge = statusBadge(m.status);
                      const hhmm = m.horario_inicio
                        ? String(m.horario_inicio).slice(0, 5)
                        : format(parseDataLocal(m.data_hora), "HH:mm");

                      return (
                        <div
                          key={m.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, m)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(m);
                          }}
                          className="text-[10px] truncate p-1 mt-1 rounded border-l-2 font-medium cursor-pointer flex items-center justify-between gap-2"
                          style={{
                            borderLeftColor: m.cor,
                            backgroundColor: (m.cor || "#3B82F6") + "15",
                          }}
                          title={m.titulo}
                        >
                          <span className="truncate">
                            {hhmm} {m.titulo}
                          </span>

                          <span
                            className={`text-[10px] font-black ${
                              badge.text === "✅"
                                ? "text-green-600"
                                : badge.text === "✖"
                                ? "text-red-600"
                                : "text-yellow-500"
                            }`}
                            title={badge.title}
                          >
                            {badge.text}
                          </span>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODO SEMANAL */}
        {view === "week" && (
          <div className="flex-1 bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden">
            <div className="grid grid-cols-7 flex-1">
              {weekDays.map((day) => (
                <div
                  key={day.toString()}
                  className="border-r p-4 bg-white overflow-y-auto"
                >
                  <h3
                    className={`text-sm font-bold mb-4 uppercase ${
                      isSameDay(day, new Date())
                        ? "text-blue-600"
                        : "text-slate-400"
                    }`}
                  >
                    {format(day, "EEE dd/MM", { locale: ptBR })}
                  </h3>

                  {reunioes
                    .filter((r) => isSameDay(parseDataLocal(r.data_hora), day))
                    .map((m) => {
                      const badge = statusBadge(m.status);
                      const hhmm = m.horario_inicio
                        ? String(m.horario_inicio).slice(0, 5)
                        : format(parseDataLocal(m.data_hora), "HH:mm");

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleEdit(m)}
                          className="p-3 mb-2 rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow flex items-start justify-between gap-2"
                          style={{ borderLeft: `4px solid ${m.cor}` }}
                        >
                          <div>
                            <p className="text-[10px] font-bold text-slate-400">
                              {hhmm}
                            </p>
                            <p className="text-xs font-bold text-slate-700">
                              {m.titulo}
                            </p>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">
                              {tipoLabel(m)}
                            </p>
                          </div>
                          <span
                            className={`text-sm font-black ${
                              badge.text === "✅"
                                ? "text-green-600"
                                : badge.text === "✖"
                                ? "text-red-600"
                                : "text-yellow-500"
                            }`}
                            title={badge.title}
                          >
                            {badge.text}
                          </span>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODO LISTA */}
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
                      const badge = statusBadge(m.status);
                      const hhmm = m.horario_inicio
                        ? String(m.horario_inicio).slice(0, 5)
                        : format(parseDataLocal(m.data_hora), "HH:mm");

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleEdit(m)}
                          className="p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white hover:shadow-md transition-all flex items-center gap-4 justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className="w-2 h-10 rounded-full"
                              style={{ backgroundColor: m.cor }}
                            />
                            <div>
                              <p className="text-xs font-bold text-blue-600">
                                {hhmm}
                              </p>
                              <h4 className="font-bold text-slate-800">
                                {m.titulo}
                              </h4>
                              <p className="text-[10px] text-slate-500 uppercase font-bold">
                                {tipoLabel(m)}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-sm font-black ${
                              badge.text === "✅"
                                ? "text-green-600"
                                : badge.text === "✖"
                                ? "text-red-600"
                                : "text-yellow-500"
                            }`}
                            title={badge.title}
                          >
                            {badge.text}
                          </span>
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
                {editingReuniao ? "Editar Reunião" : "Nova Reunião"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form
              id="form-reuniao"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-8 bg-white"
            >
              <DetalhesReuniao
                formData={formData}
                setFormData={setFormData}
                editingReuniao={editingReuniao}
                tipos={tipos}
              />
            </form>

            <div className="bg-slate-50 p-5 border-t flex justify-end gap-3 shrink-0">
              {editingReuniao && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="mr-auto text-red-500 font-bold flex items-center gap-2 px-4 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={16} /> Excluir Reunião
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
                form="form-reuniao"
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

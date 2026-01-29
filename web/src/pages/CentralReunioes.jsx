// src/pages/CentralReunioes.jsx
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
  if (s.includes("realiz")) return { text: "✅", title: "Realizada" };
  if (s.includes("nao") || s.includes("não") || s.includes("cancel")) return { text: "✖", title: "Não realizada" };
  return { text: "●", title: "Agendada" };
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
  }, []);

  useEffect(() => {
    fetchReunioes();
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

  const getTipoById = (id) => tipos.find((t) => String(t.id) === String(id)) || null;

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
    const tipoNome = tipo?.nome || "Geral"; // ✅ garante não-null

    const dataHoraIso = `${formData.data}T${formData.hora_inicio}:00`;
    const duracao_segundos = calcDuracaoSegundos(formData.hora_inicio, formData.hora_fim);

    // ✅ IMPORTANTE: preencher tipo_reuniao_legacy (NOT NULL no seu banco)
    const dados = {
      titulo: formData.titulo,
      data_hora: dataHoraIso,
      tipo_reuniao_id: formData.tipo_reuniao_id || null,
      tipo_reuniao_legacy: tipoNome, // ✅ AQUI
      horario_inicio: formData.hora_inicio,
      horario_fim: formData.hora_fim,
      duracao_segundos,
      cor: formData.cor,
      responsavel: formData.responsavel,
      ata: formData.ata,
      status: formData.status,
      area_id: 4,
    };

    if (editingReuniao) {
      const aplicar = window.confirm("Deseja aplicar as mudanças para reuniões futuras desta série?");
      await atualizarReuniao(editingReuniao.id, dados, aplicar);
    } else {
      await salvarReuniao(dados, "unica");
    }

    setIsModalOpen(false);
    fetchReunioes();
  };

  const handleDelete = async () => {
    if (window.prompt("Digite a senha para confirmar exclusão:") !== SENHA_EXCLUSAO) return;
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

      await supabase.from("reunioes").update({ data_hora: novaDataHora }).eq("id", draggingReuniao.id);
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

  // ✅ agora lê o legacy
  const tipoLabel = (r) => r.tipos_reuniao?.nome || r.tipo_reuniao_legacy || "Geral";

  return (
    <Layout>
      {/* ... o resto do seu componente permanece igual ... */}
      {/* (mantive só o que precisa para o ajuste do tipo_reuniao_legacy) */}
      <div className="flex flex-col h-screen p-6 bg-slate-50 font-sans overflow-hidden">
        {/* seu JSX inteiro continua como estava */}
      </div>
    </Layout>
  );
}

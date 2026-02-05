// src/pages/TiposReuniao.jsx
import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase, supabaseInove } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import {
  Tags,
  Search,
  X,
  Clock,
  CalendarDays,
  FileText,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  LayoutGrid,
  List as ListIcon,
  Hash,
  CheckCircle2,
  ShieldAlert,
  Users,
  Loader2,
  User,
} from "lucide-react";
import EditMeetingTypeForm from "./EditMeetingTypeForm";
import ParticipantesTipoReuniao from "../components/tatico/ParticipantesTipoReuniao";

// -----------------------------
const REUNIOES_TIPO_FIELD = "tipo_reuniao";

const DIAS_UI = [
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
  { label: "Dom", value: 7 },
];

const PERIODICIDADES = [
  { value: "SEMANAL", label: "Semanal" },
  { value: "QUINZENAL", label: "Quinzenal" },
  { value: "MENSAL", label: "Mensal" },
  { value: "IRREGULAR", label: "Irregular" },
];

function slugify(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatHora(hora) {
  if (!hora) return "—";
  const s = String(hora);
  return s.slice(0, 5);
}

function formatDiasSemana(dias) {
  if (!dias || !Array.isArray(dias) || dias.length === 0) return "—";
  const names = dias
    .map((n) => DIAS_UI.find((d) => d.value === Number(n))?.label)
    .filter(Boolean);
  const key = names.join(",");
  if (key === "Seg,Qua,Sex") return "Seg / Qua / Sex";
  return names.join(" / ");
}

function snippet(text, max = 160) {
  if (!text) return "";
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "..." : clean;
}

function badge(icon, label) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
      {icon}
      {label}
    </span>
  );
}

export default function TiposReuniao() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tipos, setTipos] = useState([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState("cards");

  const [counts, setCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [reunioesTipo, setReunioesTipo] = useState([]);
  const [reunioesLoading, setReunioesLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    id: null,
    nome: "",
    slug: "",
    periodicidade: "SEMANAL",
    dias_semana: [1],
    horario_inicio: "09:00",
    horario_fim: "",
    ata_principal: "",
    cor: "#111827",
    ordem: null,
    responsavel_id: "",
  });

  // ✅ UMA ÚNICA LISTA (serve pro organizador e pro participantes)
  const [usuariosAprovadores, setUsuariosAprovadores] = useState([]);

  const [showDeleteAuth, setShowDeleteAuth] = useState(false);
  const [delLogin, setDelLogin] = useState("");
  const [delSenha, setDelSenha] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [userLevel, setUserLevel] = useState(null);

  useEffect(() => {
    fetchTipos();
    fetchUsuariosAprovadores();

    try {
      const stored = localStorage.getItem("usuario_externo");
      if (stored) {
        const u = JSON.parse(stored);
        setUserLevel(u.nivel);
      }
    } catch (e) {
      console.error("Erro ao ler usuario_externo", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ MESMA QUERY DO ORGANIZADOR (e agora é a única usada)
  const fetchUsuariosAprovadores = async () => {
    const { data, error } = await supabaseInove
      .from("usuarios_aprovadores")
      .select("id, nome, email")
      .eq("ativo", true)
      .order("nome");

    if (error) {
      console.warn("Erro ao carregar usuarios_aprovadores:", error.message);
      setUsuariosAprovadores([]);
      return;
    }

    setUsuariosAprovadores(data || []);
  };

  const fetchTipos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tipos_reuniao")
      .select(
        "id, nome, slug, periodicidade, dias_semana, horario_inicio, horario_fim, ata_principal, cor, ordem, responsavel_id"
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

    if ((data || []).length) fetchCounts(data || []);
    else setCounts({});
  };

  const fetchCounts = async (list) => {
    setCountsLoading(true);
    try {
      const results = await Promise.all(
        (list || []).map(async (t) => {
          const tipoKey = t?.nome || t?.slug || "";
          if (!tipoKey) return [t.id, 0];

          const { count, error } = await supabase
            .from("reunioes")
            .select("id", { count: "exact", head: true })
            .eq(REUNIOES_TIPO_FIELD, tipoKey);

          if (error) {
            console.warn("Count erro:", error?.message);
            return [t.id, null];
          }

          return [t.id, count ?? 0];
        })
      );

      const map = {};
      results.forEach(([id, c]) => (map[id] = c));
      setCounts(map);
    } finally {
      setCountsLoading(false);
    }
  };

  const tiposFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return tipos;

    return (tipos || []).filter((t) => {
      const nome = String(t?.nome || "").toLowerCase();
      const slug = String(t?.slug || "").toLowerCase();
      const ata = String(t?.ata_principal || "").toLowerCase();
      return nome.includes(term) || slug.includes(term) || ata.includes(term);
    });
  }, [tipos, q]);

  const openDrawer = async (tipo) => {
    setSelectedTipo(tipo);
    setDrawerOpen(true);
    await fetchReunioesTipo(tipo);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedTipo(null);
    setReunioesTipo([]);
  };

  const fetchReunioesTipo = async (tipo) => {
    if (!tipo) return;
    setReunioesLoading(true);
    setReunioesTipo([]);

    try {
      const tipoKey = tipo?.nome || tipo?.slug || "";
      if (!tipoKey) return;

      const { data, error } = await supabase
        .from("reunioes")
        .select("id, titulo, data_hora, tipo_reuniao, pauta, cor")
        .eq(REUNIOES_TIPO_FIELD, tipoKey)
        .order("data_hora", { ascending: true })
        .limit(30);

      if (error) {
        console.warn(error);
        setReunioesTipo([]);
        return;
      }

      setReunioesTipo(data || []);
    } finally {
      setReunioesLoading(false);
    }
  };

  // ---------- FORM ----------
  const checkEditPermission = () => {
    if (userLevel === "Administrador" || userLevel === "Gestor") return true;
    alert("Permissão negada. Apenas Administradores e Gestores podem criar ou editar tipos.");
    return false;
  };

  const openCreate = () => {
    if (!checkEditPermission()) return;

    setFormMode("create");
    setForm({
      id: null,
      nome: "",
      slug: "",
      periodicidade: "SEMANAL",
      dias_semana: [1],
      horario_inicio: "09:00",
      horario_fim: "",
      ata_principal: "",
      cor: "#111827",
      ordem: null,
      responsavel_id: "",
    });
    setFormOpen(true);
  };

  const openEdit = (tipo) => {
    if (!checkEditPermission()) return;

    setFormMode("edit");
    setForm({
      id: tipo?.id ?? null,
      nome: tipo?.nome ?? "",
      slug: tipo?.slug ?? "",
      periodicidade: tipo?.periodicidade ?? "SEMANAL",
      dias_semana: Array.isArray(tipo?.dias_semana) ? tipo.dias_semana : [],
      horario_inicio: formatHora(tipo?.horario_inicio) === "—" ? "" : formatHora(tipo?.horario_inicio),
      horario_fim: formatHora(tipo?.horario_fim) === "—" ? "" : formatHora(tipo?.horario_fim),
      ata_principal: tipo?.ata_principal ?? "",
      cor: tipo?.cor ?? "#111827",
      ordem: tipo?.ordem ?? null,
      responsavel_id: tipo?.responsavel_id || "",
    });
    setFormOpen(true);
  };

  const toggleDia = (val) => {
    setForm((prev) => {
      const exists = (prev.dias_semana || []).includes(val);
      const next = exists ? (prev.dias_semana || []).filter((x) => x !== val) : [...(prev.dias_semana || []), val];
      next.sort((a, b) => a - b);
      return { ...prev, dias_semana: next };
    });
  };

  const validateForm = () => {
    if (!String(form.nome || "").trim()) return "Informe o nome.";
    const finalSlug = String(form.slug || "").trim() || slugify(form.nome);
    if (!finalSlug) return "Slug inválido.";
    if (form.horario_inicio && !/^\d{2}:\d{2}$/.test(form.horario_inicio))
      return "Horário início inválido (use HH:MM).";
    if (form.horario_fim && !/^\d{2}:\d{2}$/.test(form.horario_fim))
      return "Horário término inválido (use HH:MM).";
    return null;
  };

  const saveTipo = async () => {
    const err = validateForm();
    if (err) {
      alert(err);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: String(form.nome).trim(),
        slug: String(form.slug || "").trim() || slugify(form.nome),
        periodicidade: form.periodicidade || "SEMANAL",
        dias_semana: Array.isArray(form.dias_semana) ? form.dias_semana : [],
        horario_inicio: form.horario_inicio ? `${form.horario_inicio}:00` : null,
        horario_fim: form.horario_fim ? `${form.horario_fim}:00` : null,
        ata_principal: form.ata_principal || null,
        cor: form.cor || null,
        ordem: form.ordem === "" || form.ordem === null || Number.isNaN(Number(form.ordem)) ? null : Number(form.ordem),
        responsavel_id: form.responsavel_id || null,
      };

      if (formMode === "create") {
        const { error } = await supabase.from("tipos_reuniao").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tipos_reuniao").update(payload).eq("id", form.id);
        if (error) throw error;
      }

      setFormOpen(false);
      fetchTipos();
    } catch (err2) {
      console.error(err2);
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (tipo) => {
    if (!checkEditPermission()) return;
    setSelectedTipo(tipo);
    setDelLogin("");
    setDelSenha("");
    setShowDeleteAuth(true);
  };

  const confirmDelete = async () => {
    if (!delLogin || !delSenha) {
      alert("Informe login e senha para excluir.");
      return;
    }
    setDeleting(true);
    try {
      const { data: usuario, error: authError } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("id, nivel, ativo")
        .eq("login", delLogin)
        .eq("senha", delSenha)
        .eq("ativo", true)
        .maybeSingle();

      if (authError) throw authError;
      if (!usuario) {
        alert("Login ou senha incorretos ou usuário inativo.");
        setDeleting(false);
        return;
      }

      if (usuario.nivel !== "Administrador" && usuario.nivel !== "Gestor") {
        alert("Apenas Administradores e Gestores podem excluir tipos.");
        setDeleting(false);
        return;
      }

      const { error: delError } = await supabase.from("tipos_reuniao").delete().eq("id", selectedTipo.id);
      if (delError) throw delError;

      setShowDeleteAuth(false);
      setSelectedTipo(null);
      fetchTipos();
      alert("Tipo excluído com sucesso.");
    } catch (err3) {
      console.error(err3);
      alert("Erro ao excluir.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout title="Tipos de Reunião">
      <div className="flex flex-col h-full relative">
        {/* Modal Auth Delete */}
        {showDeleteAuth && (
          <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200">
              <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-red-50 text-red-700">
                <ShieldAlert size={20} />
                <h3 className="font-bold">Autorização de Exclusão</h3>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-600">
                  Esta ação é irreversível. Informe suas credenciais de <b>Gestor</b> ou <b>Administrador</b> para confirmar a exclusão de:
                  <br />
                  <span className="font-bold text-gray-900">{selectedTipo?.nome}</span>
                </p>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Login</label>
                  <input
                    value={delLogin}
                    onChange={(e) => setDelLogin(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-100"
                    placeholder="Seu login"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Senha</label>
                  <input
                    type="password"
                    value={delSenha}
                    onChange={(e) => setDelSenha(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-100"
                    placeholder="Sua senha"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowDeleteAuth(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-gray-800"
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
                    disabled={deleting}
                  >
                    {deleting ? "Verificando..." : "Confirmar Exclusão"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col xl:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
          <div className="flex items-center gap-4 w-full xl:w-auto">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700">
              <Tags size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-800 truncate">Tipos de Reunião</h1>
              <p className="text-xs text-gray-500">Cadastro • periodicidade • ATA principal • reuniões vinculadas</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
            {/* Busca */}
            <div className="w-full md:w-[420px]">
              <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                <Search size={16} className="text-gray-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome, slug ou texto da ATA..."
                  className="w-full bg-transparent outline-none text-sm text-gray-700"
                />
                {q?.length > 0 && (
                  <button onClick={() => setQ("")} className="text-gray-400 hover:text-gray-700" title="Limpar">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Controles */}
            <div className="flex items-center gap-2 justify-between md:justify-start">
              <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button
                  onClick={() => setView("cards")}
                  className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm font-bold transition-all ${
                    view === "cards" ? "bg-white text-blue-600 shadow" : "text-gray-500"
                  }`}
                >
                  <LayoutGrid size={16} /> Cards
                </button>
                <button
                  onClick={() => setView("table")}
                  className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm font-bold transition-all ${
                    view === "table" ? "bg-white text-blue-600 shadow" : "text-gray-500"
                  }`}
                  title="Tabela"
                >
                  <ListIcon size={16} /> Tabela
                </button>
              </div>

              <button
                onClick={fetchTipos}
                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold flex items-center gap-2"
                title="Recarregar"
              >
                <RefreshCw size={16} />
                <span className="hidden md:inline">Recarregar</span>
              </button>

              <button
                onClick={openCreate}
                className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-950 text-white font-bold flex items-center gap-2"
                title="Novo Tipo"
              >
                <Plus size={16} /> Novo
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {loading ? "Carregando..." : `${tiposFiltrados.length} tipo(s)`}
              {countsLoading && <span className="ml-2 text-xs text-gray-400">(contando reuniões...)</span>}
            </p>

            <button
              onClick={() => fetchCounts(tipos)}
              className="text-sm font-bold px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              title="Atualizar contagem de reuniões"
              disabled={countsLoading || loading}
            >
              Atualizar contagens
            </button>
          </div>

          <div className="p-5 overflow-y-auto flex-1">
            {loading ? (
              <div className="text-gray-400 text-center py-20">Carregando Tipos de Reunião...</div>
            ) : tiposFiltrados.length === 0 ? (
              <div className="text-gray-400 text-center py-20">Nenhum tipo encontrado.</div>
            ) : view === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tiposFiltrados.map((t) => {
                  const periodicidade =
                    PERIODICIDADES.find((p) => p.value === t?.periodicidade)?.label || t?.periodicidade || "—";
                  const dias = formatDiasSemana(t?.dias_semana);
                  const horaIni = formatHora(t?.horario_inicio);
                  const horaFim = formatHora(t?.horario_fim);
                  const preview = snippet(t?.ata_principal, 160);
                  const c = counts[t.id];

                  return (
                    <div
                      key={t.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button onClick={() => openDrawer(t)} className="min-w-0 text-left" title="Abrir detalhes">
                          <h3 className="font-bold text-gray-900 text-base truncate group-hover:text-blue-700 transition-colors">
                            {t?.nome || "Sem nome"}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{t?.slug ? `slug: ${t.slug}` : "slug: —"}</p>
                        </button>

                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full mt-1 shrink-0"
                            style={{ backgroundColor: t?.cor || "#111827" }}
                            title={t?.cor || "Sem cor"}
                          />
                          <button onClick={() => openEdit(t)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Editar">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => requestDelete(t)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {badge(<CalendarDays size={12} />, periodicidade)}
                        {badge(<CalendarDays size={12} />, dias)}
                        {badge(<Clock size={12} />, `${horaIni} • ${horaFim}`)}
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full">
                          <Hash size={12} />
                          {c === null || c === undefined ? "—" : `${c} reuniões`}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase">
                          <FileText size={14} />
                          ATA Principal
                        </div>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-3">{preview || "Sem ATA cadastrada."}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <button
                          onClick={() => openDrawer(t)}
                          className="text-blue-700 font-bold text-sm flex items-center gap-2 opacity-80 group-hover:opacity-100"
                        >
                          Ver reuniões <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold text-gray-600">Nome</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-600">Periodicidade</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-600">Dias</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-600">Horário</th>
                      <th className="text-left px-3 py-2 font-bold text-gray-600">Reuniões</th>
                      <th className="text-right px-3 py-2 font-bold text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="border border-gray-200">
                    {tiposFiltrados.map((t) => {
                      const periodicidade =
                        PERIODICIDADES.find((p) => p.value === t?.periodicidade)?.label || t?.periodicidade || "—";
                      const c = counts[t.id];

                      return (
                        <tr key={t.id} className="border-t border-gray-100 hover:bg-blue-50/20">
                          <td className="px-3 py-2">
                            <button onClick={() => openDrawer(t)} className="font-bold text-gray-900 hover:text-blue-700" title="Abrir detalhes">
                              {t?.nome || "Sem nome"}
                            </button>
                            <div className="text-xs text-gray-500">{t?.slug ? `slug: ${t.slug}` : "slug: —"}</div>
                          </td>
                          <td className="px-3 py-2">{periodicidade}</td>
                          <td className="px-3 py-2">{formatDiasSemana(t?.dias_semana)}</td>
                          <td className="px-3 py-2">
                            {formatHora(t?.horario_inicio)} • {formatHora(t?.horario_fim)}
                          </td>
                          <td className="px-3 py-2">{c === null || c === undefined ? "—" : c}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEdit(t)}
                                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 font-bold text-gray-800"
                                title="Editar"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => requestDelete(t)}
                                className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 font-bold text-red-700"
                                title="Excluir"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* DRAWER - Mantém a estrutura original */}
        {drawerOpen && selectedTipo && (
          <div className="absolute inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTipo?.cor || "#111827" }} />
                  <div className="min-w-0">
                    <h2 className="font-bold text-gray-900 truncate">{selectedTipo?.nome}</h2>
                  </div>
                </div>

                <button onClick={closeDrawer} className="text-gray-400 hover:text-red-500" title="Fechar">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">Periodicidade</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {PERIODICIDADES.find((p) => p.value === selectedTipo?.periodicidade)?.label ||
                        selectedTipo?.periodicidade ||
                        "—"}
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">Dias</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{formatDiasSemana(selectedTipo?.dias_semana)}</p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">Horário</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {formatHora(selectedTipo?.horario_inicio)} • {formatHora(selectedTipo?.horario_fim)}
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">Reuniões</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {counts[selectedTipo?.id] === null || counts[selectedTipo?.id] === undefined ? "—" : counts[selectedTipo?.id]}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openEdit(selectedTipo)}
                    className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-950 text-white font-bold flex items-center gap-2"
                  >
                    <Pencil size={16} /> Editar tipo
                  </button>

                  <button
                    onClick={() => requestDelete(selectedTipo)}
                    className="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold flex items-center gap-2"
                  >
                    <Trash2 size={16} /> Excluir
                  </button>

                  <button
                    onClick={() => navigate("/central-reunioes")}
                    className="px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold flex items-center gap-2"
                  >
                    <CalendarDays size={16} /> Abrir agenda
                  </button>

                  <button
                    onClick={() => fetchReunioesTipo(selectedTipo)}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 font-bold flex items-center gap-2"
                  >
                    <RefreshCw size={16} /> Atualizar reuniões
                  </button>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                    <FileText size={16} /> ATA Principal
                  </p>
                  <div className="text-sm text-gray-800 bg-white border border-gray-200 rounded-lg p-4 whitespace-pre-wrap">
                    {selectedTipo?.ata_principal || "Sem ATA cadastrada."}
                  </div>
                </div>

                {/* ✅ PARTICIPANTES no drawer (mesma fonte do organizador) */}
                <ParticipantesTipoReuniao
                  tipoId={selectedTipo?.id}
                  editavel={false}
                  usuariosAprovadores={usuariosAprovadores}
                />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                      <CalendarDays size={16} /> Reuniões deste tipo
                    </p>
                    <span className="text-xs text-gray-400">
                      Campo vínculo em reuniões: <b>{REUNIOES_TIPO_FIELD}</b>
                    </span>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {reunioesLoading ? (
                      <div className="p-4 text-sm text-gray-500">Carregando reuniões...</div>
                    ) : reunioesTipo.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">Nenhuma reunião encontrada para este tipo.</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {reunioesTipo.map((r) => {
                          const dt = new Date(r.data_hora);
                          const dtStr = dt.toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          return (
                            <button
                              key={r.id}
                              onClick={() => navigate(`/reunioes/${r.id}`)}
                              className="w-full text-left p-4 hover:bg-blue-50/30 transition-colors group"
                              title="Abrir ata da reunião"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-bold text-gray-900 truncate group-hover:text-blue-700">
                                    {r.titulo || "Reunião"}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                    <Clock size={12} /> {dtStr}
                                  </p>
                                </div>
                                <ArrowRight size={18} className="text-gray-300 group-hover:text-blue-500" />
                              </div>

                              {r.pauta && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{snippet(r.pauta, 220)}</p>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                  onClick={closeDrawer}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white font-bold hover:bg-gray-950 transition-colors text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL FORM - Novo componente EditMeetingTypeForm */}
        {formOpen && (
          <EditMeetingTypeForm
            mode={formMode}
            initialData={form}
            usuariosAprovadores={usuariosAprovadores}
            onSave={saveTipo}
            onCancel={() => setFormOpen(false)}
            isLoading={saving}
          />
        )}
      </div>
    </Layout>
  );
}

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
  Users, // Importante para a seção de participantes
  Loader2
} from "lucide-react";

/**
 * COMPONENTE INTERNO: Gerenciador de Participantes Padrão
 * (Agora vive dentro deste arquivo, não precisa de import externo)
 */
function ParticipantesInterno({ tipoId, editavel }) {
  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usuariosInove, setUsuariosInove] = useState([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (tipoId) {
      fetchParticipantes();
      fetchUsuariosInove();
    }
  }, [tipoId]);

  const fetchUsuariosInove = async () => {
    const { data } = await supabaseInove
      .from("usuarios_aprovadores")
      .select("id, nome, email, cargo, ativo")
      .eq("ativo", true)
      .order("nome");
    setUsuariosInove(data || []);
  };

  const fetchParticipantes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("participantes_tipo_reuniao")
      .select("*")
      .eq("tipo_reuniao_id", tipoId);
    setParticipantes(data || []);
    setLoading(false);
  };

  const adicionar = async (usuario) => {
    if (participantes.some(p => p.usuario_id === usuario.id)) return;

    const { data, error } = await supabase
      .from("participantes_tipo_reuniao")
      .insert({
        tipo_reuniao_id: tipoId,
        usuario_id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cargo: usuario.cargo
      })
      .select();

    if (!error && data) {
      setParticipantes([...participantes, data[0]]);
      setBusca("");
    }
  };

  const remover = async (id) => {
    const { error } = await supabase
      .from("participantes_tipo_reuniao")
      .delete()
      .eq("id", id);
    
    if (!error) {
      setParticipantes(participantes.filter(p => p.id !== id));
    }
  };

  const usuariosFiltrados = usuariosInove.filter(u => 
    !participantes.some(p => p.usuario_id === u.id) &&
    (u.nome.toLowerCase().includes(busca.toLowerCase()) || 
     u.email.toLowerCase().includes(busca.toLowerCase()))
  ).slice(0, 5);

  return (
    <div className="mt-6 border-t pt-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
          <Users size={16} /> Participantes Padrão
        </h4>
        <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-full">
          {participantes.length}
        </span>
      </div>

      {editavel && (
        <div className="relative mb-4">
          <input 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar usuário para adicionar..."
            className="w-full text-sm p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
          />
          {busca.length > 0 && usuariosFiltrados.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 shadow-lg rounded-lg overflow-hidden">
              {usuariosFiltrados.map(u => (
                <button 
                  key={u.id} 
                  onClick={() => adicionar(u)}
                  className="w-full text-left p-2 hover:bg-blue-50 text-sm flex justify-between items-center group"
                >
                  <div>
                    <div className="font-bold text-gray-700">{u.nome}</div>
                    <div className="text-[10px] text-gray-400">{u.email}</div>
                  </div>
                  <Plus size={14} className="text-blue-600 opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-2"><Loader2 className="animate-spin mx-auto text-gray-400" size={16} /></div>
        ) : participantes.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center">Nenhum participante padrão.</p>
        ) : (
          participantes.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{p.nome}</p>
                <p className="text-[10px] text-gray-500 truncate">{p.email}</p>
              </div>
              {editavel && (
                <button onClick={() => remover(p.id)} className="text-gray-400 hover:text-red-600 p-1">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- FIM DO COMPONENTE INTERNO ---

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

  // Drawer/Detalhe
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [reunioesTipo, setReunioesTipo] = useState([]);
  const [reunioesLoading, setReunioesLoading] = useState(false);

  // Modal Create/Edit
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
  });

  const [showDeleteAuth, setShowDeleteAuth] = useState(false);
  const [delLogin, setDelLogin] = useState("");
  const [delSenha, setDelSenha] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [userLevel, setUserLevel] = useState(null);

  useEffect(() => {
    fetchTipos();
    try {
      const stored = localStorage.getItem("usuario_externo");
      if (stored) {
        const u = JSON.parse(stored);
        setUserLevel(u.nivel);
      }
    } catch (e) {
      console.error("Erro ao ler usuario_externo", e);
    }
  }, []);

  const fetchTipos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tipos_reuniao")
      .select("id, nome, slug, periodicidade, dias_semana, horario_inicio, horario_fim, ata_principal, cor, ordem")
      .order("ordem", { ascending: true, nullsFirst: false })
      .order("nome", { ascending: true });

    if (error) {
      alert("Erro ao carregar Tipos de Reunião.");
      setTipos([]);
    } else {
      setTipos(data || []);
      if (data?.length) fetchCounts(data);
    }
    setLoading(false);
  };

  const fetchCounts = async (list) => {
    setCountsLoading(true);
    try {
      const results = await Promise.all(
        list.map(async (t) => {
          const tipoKey = t?.nome || t?.slug || "";
          const { count } = await supabase
            .from("reunioes")
            .select("id", { count: "exact", head: true })
            .eq(REUNIOES_TIPO_FIELD, tipoKey);
          return [t.id, count ?? 0];
        })
      );
      const map = {};
      results.forEach(([id, c]) => { map[id] = c; });
      setCounts(map);
    } finally {
      setCountsLoading(false);
    }
  };

  const tiposFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return tipos;
    return tipos.filter((t) => 
      String(t?.nome || "").toLowerCase().includes(term) || 
      String(t?.slug || "").toLowerCase().includes(term)
    );
  }, [tipos, q]);

  const openDrawer = async (tipo) => {
    setSelectedTipo(tipo);
    setDrawerOpen(true);
    fetchReunioesTipo(tipo);
  };

  const fetchReunioesTipo = async (tipo) => {
    setReunioesLoading(true);
    const tipoKey = tipo?.nome || tipo?.slug || "";
    const { data } = await supabase
      .from("reunioes")
      .select("id, titulo, data_hora, pauta")
      .eq(REUNIOES_TIPO_FIELD, tipoKey)
      .order("data_hora", { ascending: false })
      .limit(20);
    setReunioesTipo(data || []);
    setReunioesLoading(false);
  };

  const checkEditPermission = () => {
    if (userLevel === "Administrador" || userLevel === "Gestor") return true;
    alert("Permissão negada.");
    return false;
  };

  const saveTipo = async () => {
    if (!form.nome.trim()) return alert("Informe o nome.");
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.slug.trim() || slugify(form.nome),
        horario_inicio: form.horario_inicio ? `${form.horario_inicio}:00` : null,
        horario_fim: form.horario_fim ? `${form.horario_fim}:00` : null,
        ordem: form.ordem ? Number(form.ordem) : null
      };
      delete payload.id;

      if (formMode === "create") {
        await supabase.from("tipos_reuniao").insert(payload);
      } else {
        await supabase.from("tipos_reuniao").update(payload).eq("id", form.id);
      }
      setFormOpen(false);
      fetchTipos();
    } catch (err) {
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const { data: usuario } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("nivel")
        .eq("login", delLogin).eq("senha", delSenha).eq("ativo", true).maybeSingle();

      if (!usuario || (usuario.nivel !== "Administrador" && usuario.nivel !== "Gestor")) {
        alert("Credenciais inválidas ou sem permissão.");
      } else {
        await supabase.from("tipos_reuniao").delete().eq("id", selectedTipo.id);
        setShowDeleteAuth(false);
        fetchTipos();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout title="Tipos de Reunião">
      <div className="flex flex-col h-full relative">
        {/* Modal Auth Delete */}
        {showDeleteAuth && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-600 font-bold border-b pb-2">
                <ShieldAlert size={20} /> Autorização
              </div>
              <p className="text-sm text-gray-600">Confirme exclusão de <b>{selectedTipo?.nome}</b></p>
              <input type="text" placeholder="Login" className="w-full p-2 border rounded" value={delLogin} onChange={e => setDelLogin(e.target.value)} />
              <input type="password" placeholder="Senha" className="w-full p-2 border rounded" value={delSenha} onChange={e => setDelSenha(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteAuth(false)} className="flex-1 py-2 bg-gray-100 rounded font-bold">Cancelar</button>
                <button onClick={confirmDelete} disabled={deleting} className="flex-1 py-2 bg-red-600 text-white rounded font-bold">{deleting ? "..." : "Excluir"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Header Principal */}
        <div className="flex flex-col xl:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
          <div className="flex items-center gap-4 w-full xl:w-auto">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700"><Tags size={24} /></div>
            <h1 className="text-2xl font-bold text-gray-800">Tipos de Reunião</h1>
          </div>
          <div className="flex gap-3 w-full xl:w-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg outline-none border focus:border-blue-300" />
            </div>
            <button onClick={() => { if(checkEditPermission()) { setFormMode("create"); setForm({nome:"", slug:"", periodicidade:"SEMANAL", dias_semana:[1], horario_inicio:"09:00", cor:"#111827"}); setFormOpen(true); }}} className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus size={16}/> Novo</button>
          </div>
        </div>

        {/* Listagem */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pb-10">
          {tiposFiltrados.map(t => (
            <div key={t.id} className="bg-white border p-4 rounded-xl shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-3">
                <div onClick={() => openDrawer(t)} className="cursor-pointer">
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600">{t.nome}</h3>
                  <span className="text-[10px] text-gray-400 uppercase tracking-tighter">ID: {t.slug}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { if(checkEditPermission()) { 
                    setFormMode("edit"); 
                    setForm({...t, 
                      horario_inicio: formatHora(t.horario_inicio), 
                      horario_fim: formatHora(t.horario_fim)
                    }); 
                    setFormOpen(true); 
                  }}} className="p-1.5 hover:bg-gray-100 rounded"><Pencil size={14}/></button>
                  <button onClick={() => { if(checkEditPermission()) { setSelectedTipo(t); setShowDeleteAuth(true); }}} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={14}/></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {badge(<CalendarDays size={12}/>, t.periodicidade)}
                {badge(<Clock size={12}/>, formatHora(t.horario_inicio))}
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full border">
                  {counts[t.id] || 0} reuniões
                </span>
              </div>
              <button onClick={() => openDrawer(t)} className="w-full py-2 text-blue-600 font-bold text-sm bg-blue-50 rounded-lg flex items-center justify-center gap-2">Ver detalhes <ArrowRight size={14}/></button>
            </div>
          ))}
        </div>

        {/* Drawer Lateral */}
        {drawerOpen && selectedTipo && (
          <div className="fixed inset-0 z-[80] flex justify-end bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h2 className="font-bold text-lg">{selectedTipo.nome}</h2>
                <button onClick={() => setDrawerOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                
                {/* ✅ AQUI ESTÁ A LÓGICA DE PARTICIPANTES 
                   INTEGRADA DIRETAMENTE:
                */}
                <ParticipantesInterno 
                  tipoId={selectedTipo.id} 
                  editavel={userLevel === "Administrador" || userLevel === "Gestor"} 
                />

                <div className="border-t pt-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Últimas Reuniões</h4>
                  <div className="space-y-2">
                    {reunioesTipo.map(r => (
                      <div key={r.id} className="p-3 border rounded-lg hover:border-blue-300 cursor-pointer" onClick={() => navigate(`/reunioes/${r.id}`)}>
                        <p className="font-bold text-sm">{r.titulo}</p>
                        <span className="text-[10px] text-gray-500">{new Date(r.data_hora).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Formulário */}
        {formOpen && (
          <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
              <h3 className="font-bold text-xl">{formMode === "create" ? "Novo Tipo" : "Editar Tipo"}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500">NOME</label>
                  <input className="w-full p-2 border rounded mt-1" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">PERIODICIDADE</label>
                  <select className="w-full p-2 border rounded mt-1 font-bold" value={form.periodicidade} onChange={e => setForm({...form, periodicidade: e.target.value})}>
                    {PERIODICIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">HORA PADRÃO</label>
                  <input type="time" className="w-full p-2 border rounded mt-1" value={form.horario_inicio} onChange={e => setForm({...form, horario_inicio: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">ATA PRINCIPAL (GUIA)</label>
                <textarea rows={5} className="w-full p-2 border rounded mt-1 text-sm" value={form.ata_principal} onChange={e => setForm({...form, ata_principal: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setFormOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold">Cancelar</button>
                <button onClick={saveTipo} disabled={saving} className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold">{saving ? "Salvando..." : "Salvar"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

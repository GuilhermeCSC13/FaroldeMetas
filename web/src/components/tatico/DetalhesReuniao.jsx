// src/components/tatico/DetalhesReuniao.jsx
import React, { useMemo, useEffect, useState } from "react";
import { 
  Calendar, Clock, AlignLeft, FileText, Paperclip, Loader2, Plus, Trash2, 
  Download, ImageIcon, ShieldAlert, User, X, Users, Search, AlertCircle 
} from "lucide-react";
import { format, isValid } from "date-fns";
import { supabase, supabaseInove } from "../../supabaseClient";

// Helpers
function extractTime(dateString) {
  if (!dateString) return "";
  if (String(dateString).length <= 8 && String(dateString).includes(":")) {
    return String(dateString).substring(0, 5);
  }
  try {
    const date = new Date(dateString);
    if (isValid(date)) return format(date, "HH:mm");
  } catch (e) {
    console.warn("Data inválida:", dateString);
  }
  return "";
}

function buildNomeSobrenome(u) {
  const nome = String(u?.nome || "").trim();
  const sobrenome = String(u?.sobrenome || "").trim();
  const nomeCompleto = String(u?.nome_completo || "").trim();
  if (nome && sobrenome) return `${nome} ${sobrenome}`;
  if (nomeCompleto) return nomeCompleto;
  if (nome) return nome;
  return "-";
}

export default function DetalhesReuniao({
  formData,
  setFormData,
  editingReuniao,
  tipos = [],
  isRealizada = false,
  onDeleteRequest
}) {
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  
  // Estados para Responsáveis (Organizadores)
  const [listaResponsaveis, setListaResponsaveis] = useState([]);
  const [showSugestoesResp, setShowSugestoesResp] = useState(false);

  // Estados para Participantes da Reunião
  const [listaUsuariosInove, setListaUsuariosInove] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const [searchTermPart, setSearchTermPart] = useState("");
  const [errorPart, setErrorPart] = useState(null);

  // Estados para Materiais
  const [showAuthMaterial, setShowAuthMaterial] = useState(false);
  const [authLoginMat, setAuthLoginMat] = useState("");
  const [authSenhaMat, setAuthSenhaMat] = useState("");
  const [validatingAuthMat, setValidatingAuthMat] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState(null);

  const handleChange = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const selectedTipo = useMemo(() => {
    return tipos.find((t) => String(t.id) === String(formData.tipo_reuniao_id)) || null;
  }, [tipos, formData.tipo_reuniao_id]);

  // Carregar usuários do Inove (para organizadores e participantes)
  useEffect(() => {
    const fetchUsuarios = async () => {
      const { data, error } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("id, nome, sobrenome, nome_completo, email, cargo, ativo")
        .eq("ativo", true)
        .order("nome");
      
      if (error) console.error("Erro ao buscar usuários:", error);
      setListaResponsaveis(data || []);
      setListaUsuariosInove(data || []);
    };
    fetchUsuarios();
  }, []);

  // Carregar Participantes se for uma reunião existente ou se o Tipo mudar
  useEffect(() => {
    if (formData.tipo_reuniao_id) {
        carregarParticipantesPadrao();
    }
  }, [formData.tipo_reuniao_id]);

  const carregarParticipantesPadrao = async () => {
    if (!formData.tipo_reuniao_id) return;
    setLoadingParticipantes(true);
    try {
        const { data, error } = await supabase
            .from("participantes_tipo_reuniao")
            .select("*")
            .eq("tipo_reuniao_id", formData.tipo_reuniao_id);
        
        if (error) throw error;
        setParticipantes(data || []);
    } catch (err) {
        console.error("Erro participantes:", err);
    } finally {
        setLoadingParticipantes(false);
    }
  };

  // Lógica de Upload e Exclusão de Materiais (Mantida do seu original)
  const handleUploadMaterial = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingMaterial(true);
    try {
      const novosMateriais = [];
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const baseId = editingReuniao?.id || "nova"; 
        const fileName = `${baseId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
        const filePath = `anexos/${fileName}`;
        const { error: uploadErr } = await supabase.storage.from('materiais').upload(filePath, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('materiais').getPublicUrl(filePath);
        if (urlData?.publicUrl) {
          novosMateriais.push({ name: file.name, url: urlData.publicUrl, type: file.type, path: filePath });
        }
      }
      const listaAtual = Array.isArray(formData.materiais) ? formData.materiais : [];
      const listaFinal = [...listaAtual, ...novosMateriais];
      handleChange("materiais", listaFinal);
      if (editingReuniao?.id) {
        await supabase.from('reunioes').update({ materiais: listaFinal }).eq('id', editingReuniao.id);
      }
    } catch (err) {
      alert("Erro ao enviar arquivo: " + err.message);
    } finally {
      setUploadingMaterial(false);
      e.target.value = null;
    }
  };

  const confirmDeleteMaterial = async () => {
    if (!authLoginMat || !authSenhaMat) return alert("Informe Login e Senha.");
    setValidatingAuthMat(true);
    try {
      const { data: usuario, error } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("nivel, ativo")
        .eq("login", authLoginMat).eq("senha", authSenhaMat).eq("ativo", true).maybeSingle();
      if (!usuario || (usuario.nivel !== 'Gestor' && usuario.nivel !== 'Administrador')) {
        alert("Acesso negado."); return;
      }
      const listaAtual = Array.isArray(formData.materiais) ? formData.materiais : [];
      const novaLista = listaAtual.filter((_, i) => i !== materialToDelete);
      handleChange("materiais", novaLista);
      if (editingReuniao?.id) {
        await supabase.from('reunioes').update({ materiais: novaLista }).eq('id', editingReuniao.id);
      }
      setShowAuthMaterial(false);
    } catch (err) { alert(err.message); } finally { setValidatingAuthMat(false); }
  };

  // Filtros de busca
  const filteredResponsaveis = useMemo(() => {
    const termo = (formData.responsavel || "").toLowerCase();
    return listaResponsaveis.filter(u => buildNomeSobrenome(u).toLowerCase().includes(termo)).slice(0, 8); 
  }, [listaResponsaveis, formData.responsavel]);

  const filteredUsuariosPart = useMemo(() => {
    if (!searchTermPart) return [];
    return listaUsuariosInove.filter(u => 
        buildNomeSobrenome(u).toLowerCase().includes(searchTermPart.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(searchTermPart.toLowerCase())
    ).slice(0, 5);
  }, [listaUsuariosInove, searchTermPart]);

  const selectResponsavel = (u) => {
    handleChange("responsavel", buildNomeSobrenome(u));
    setShowSugestoesResp(false);
  };

  const addParticipante = (u) => {
    if (participantes.some(p => p.usuario_id === u.id)) return;
    const novo = { 
        id: `temp-${Date.now()}`, 
        usuario_id: u.id, 
        nome: buildNomeSobrenome(u), 
        email: u.email, 
        cargo: u.cargo 
    };
    setParticipantes([...participantes, novo]);
    setSearchTermPart("");
  };

  const removeParticipante = (id) => {
    setParticipantes(participantes.filter(p => p.id !== id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative">
      
      {/* Modal Auth Material */}
      {showAuthMaterial && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-white border border-slate-200 shadow-2xl rounded-xl p-6 text-center relative">
            <button onClick={() => setShowAuthMaterial(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 text-red-600"><ShieldAlert size={20} /></div>
            <h4 className="text-base font-bold text-slate-800 mb-1">Autorização Necessária</h4>
            <div className="space-y-2 text-left my-4">
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Login</label><input type="text" autoFocus className="w-full border p-2 rounded text-sm" value={authLoginMat} onChange={e => setAuthLoginMat(e.target.value)} /></div>
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Senha</label><input type="password" className="w-full border p-2 rounded text-sm" value={authSenhaMat} onChange={e => setAuthSenhaMat(e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAuthMaterial(false)} className="flex-1 py-2 border rounded text-xs font-bold hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={confirmDeleteMaterial} disabled={validatingAuthMat} className="flex-1 py-2 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700">{validatingAuthMat ? "..." : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* COLUNA ESQUERDA: Configurações e Participantes */}
      <div className="lg:col-span-5 space-y-8 flex flex-col">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Configurações</h3>
            {isRealizada && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded border border-green-200">🔒 Realizada</span>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Título</label>
            <input required disabled={isRealizada} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60" value={formData.titulo} onChange={(e) => handleChange("titulo", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data</label>
              <div className="relative"><Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} /><input type="date" disabled={isRealizada} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none disabled:opacity-60" value={formData.data} onChange={(e) => handleChange("data", e.target.value)} /></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Organizador</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input disabled={isRealizada} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60" value={formData.responsavel} onChange={(e) => { handleChange("responsavel", e.target.value); setShowSugestoesResp(true); }} onFocus={() => setShowSugestoesResp(true)} onBlur={() => setTimeout(() => setShowSugestoesResp(false), 200)} placeholder="Buscar organizador..." />
                {showSugestoesResp && filteredResponsaveis.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {filteredResponsaveis.map(u => (
                      <button key={u.id} type="button" onMouseDown={() => selectResponsavel(u)} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 border-b last:border-0">{buildNomeSobrenome(u)}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora Início</label>
              <input type="time" disabled={isRealizada} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" value={formData.hora_inicio} onChange={(e) => handleChange("hora_inicio", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora Término</label>
              <input type="time" disabled={isRealizada} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" value={formData.hora_fim} onChange={(e) => handleChange("hora_fim", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Reunião</label>
            <select disabled={isRealizada} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none font-semibold" value={formData.tipo_reuniao_id || ""} onChange={(e) => handleChange("tipo_reuniao_id", e.target.value)}>
              <option value="">Selecione o tipo...</option>
              {tipos.map((t) => (<option key={t.id} value={t.id}>{t.nome}</option>))}
            </select>
          </div>
        </section>

        {/* SEÇÃO DE PARTICIPANTES (ADICIONADA) */}
        <section className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2"><Users size={14} /> Participantes</h3>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{participantes.length}</span>
          </div>

          {!isRealizada && (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/10" 
                  placeholder="Adicionar participante..." 
                  value={searchTermPart}
                  onChange={(e) => setSearchTermPart(e.target.value)}
                />
              </div>
              {filteredUsuariosPart.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  {filteredUsuariosPart.map(u => (
                    <button key={u.id} type="button" onClick={() => addParticipante(u)} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between group">
                      <div>
                        <p className="font-bold text-slate-700">{buildNomeSobrenome(u)}</p>
                        <p className="text-[10px] text-slate-500">{u.email}</p>
                      </div>
                      <Plus size={14} className="text-slate-300 group-hover:text-blue-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 max-h-48 overflow-y-auto space-y-1">
            {loadingParticipantes ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="animate-spin text-slate-400" size={20} /></div>
            ) : participantes.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic text-center py-4">Nenhum participante.</p>
            ) : (
                participantes.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{p.nome}</p>
                            <p className="text-[10px] text-slate-500 truncate">{p.email}</p>
                        </div>
                        {!isRealizada && (
                            <button type="button" onClick={() => removeParticipante(p.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        )}
                    </div>
                ))
            )}
          </div>
        </section>

        {editingReuniao && (
          <div className="pt-4 border-t border-slate-100 mt-auto">
            <button type="button" onClick={onDeleteRequest} className="text-red-500 font-bold text-xs flex items-center gap-2 hover:bg-red-50 px-3 py-2 rounded-lg w-full justify-center transition-colors"><Trash2 size={16} /> Excluir Reunião</button>
          </div>
        )}
      </div>

      {/* COLUNA DIREITA: ATA e Anexos */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2"><AlignLeft size={16} /> ATA da Reunião</h3>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /><p className="text-xs font-bold text-slate-700">ATA guia</p></div>
            <button type="button" onClick={usarAtaDoTipo} className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 hover:bg-white disabled:opacity-50" disabled={!selectedTipo?.ata_principal || isRealizada}>Usar ATA principal</button>
          </div>
          <div className="mt-3 text-[10px] text-slate-500 whitespace-pre-line max-h-24 overflow-y-auto">{selectedTipo?.ata_principal || "Selecione um tipo."}</div>
        </div>
        <textarea disabled={isRealizada} className="flex-1 w-full min-h-[300px] bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/10 shadow-inner resize-none disabled:opacity-60" placeholder="Descreva a ATA..." value={formData.ata} onChange={(e) => handleChange("ata", e.target.value)} />

        {/* Anexos */}
        <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase"><Paperclip size={14} /> Anexos</div>
              <label className={`cursor-pointer text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition-all ${uploadingMaterial ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingMaterial ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {uploadingMaterial ? "Enviando..." : "Anexar"}
                <input type="file" multiple className="hidden" onChange={handleUploadMaterial} disabled={uploadingMaterial} />
              </label>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              {formData.materiais && formData.materiais.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {formData.materiais.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-100 text-blue-600"><FileText size={16} /></div>
                        <div className="min-w-0"><p className="text-xs font-bold text-slate-700 truncate">{item.name}</p></div>
                      </div>
                      <div className="flex items-center gap-1">
                        <a href={item.url} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600"><Download size={16} /></a>
                        <button type="button" onClick={() => handleRequestDeleteMaterial(idx)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (<div className="text-center py-4 text-slate-400 text-xs italic">Nenhum anexo.</div>)}
            </div>
        </div>
      </div>
    </div>
  );
}

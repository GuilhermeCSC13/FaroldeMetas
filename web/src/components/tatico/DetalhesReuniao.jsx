// src/components/tatico/DetalhesReuniao.jsx
import React, { useMemo, useEffect, useState } from "react";
import { 
  Calendar, Clock, AlignLeft, FileText, Paperclip, Loader2, Plus, Trash2, 
  Download, ImageIcon, ShieldAlert, User, X, Users, Search, CheckCircle2 
} from "lucide-react";
import { format, isValid } from "date-fns";
import { supabase, supabaseInove } from "../../supabaseClient";

// Helper robusto para extrair HH:mm
function extractTime(dateString) {
  if (!dateString) return "";
  if (String(dateString).length <= 8 && String(dateString).includes(":")) {
    return String(dateString).substring(0, 5);
  }
  try {
    const date = new Date(dateString);
    if (isValid(date)) {
      return format(date, "HH:mm");
    }
  } catch (e) {
    console.warn("Data inválida:", dateString);
  }
  return "";
}

// Helper para nome completo
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
  
  // Estados para Responsáveis (Organizadores) e Lista Geral de Usuários
  const [listaResponsaveis, setListaResponsaveis] = useState([]);
  const [showSugestoesResp, setShowSugestoesResp] = useState(false);

  // ✅ Estados para Participantes da Reunião
  const [buscaParticipante, setBuscaParticipante] = useState("");
  const [participantesAtuais, setParticipantesAtuais] = useState([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);

  // Estados para Exclusão de Material
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

  // 1. Carregar usuários do Inove (usado para Organizador E Participantes)
  useEffect(() => {
    const fetchUsuarios = async () => {
      const { data, error } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("id, nome, sobrenome, nome_completo, email, cargo, ativo")
        .eq("ativo", true)
        .order("nome");
      
      if (error) console.error("Erro ao buscar usuários:", error);
      setListaResponsaveis(data || []);
    };
    fetchUsuarios();
  }, []);

  // 2. Carregar Participantes Existentes (Se for edição)
  useEffect(() => {
    const carregarParticipantes = async () => {
      if (!editingReuniao?.id) return;
      
      setLoadingParticipantes(true);
      // Busca na tabela de vínculo (ajuste o nome da tabela se for diferente)
      const { data, error } = await supabase
        .from("participantes_reuniao") 
        .select("*")
        .eq("reuniao_id", editingReuniao.id);

      if (!error) {
        setParticipantesAtuais(data || []);
      }
      setLoadingParticipantes(false);
    };

    carregarParticipantes();
  }, [editingReuniao]);

  // Efeito para carregar dados iniciais da reunião
  useEffect(() => {
    if (editingReuniao) {
      const horaIni = extractTime(editingReuniao.horario_inicio) || extractTime(editingReuniao.data_hora) || "09:00";
      const horaFim = extractTime(editingReuniao.horario_fim) || "10:00";
      
      const materiaisSeguros = Array.isArray(editingReuniao.materiais) ? editingReuniao.materiais : [];

      setFormData(prev => ({
          ...prev,
          hora_inicio: prev.hora_inicio || horaIni,
          hora_fim: prev.hora_fim || horaFim,
          materiais: prev.materiais && prev.materiais.length > 0 ? prev.materiais : materiaisSeguros
      }));
    }
  }, [editingReuniao, setFormData]);

  // ✅ Função para Adicionar Participante
  const handleAddParticipante = async (usuario) => {
    // Verifica se já está na lista visual
    if (participantesAtuais.some(p => p.usuario_id === usuario.id)) return;

    const novoParticipante = {
      usuario_id: usuario.id,
      nome: buildNomeSobrenome(usuario),
      email: usuario.email,
      cargo: usuario.cargo
    };

    // Atualiza visualmente
    const novaLista = [...participantesAtuais, novoParticipante];
    setParticipantesAtuais(novaLista);
    setBuscaParticipante("");

    // Se estiver editando, salva direto no banco
    if (editingReuniao?.id) {
      await supabase.from("participantes_reuniao").insert({
        reuniao_id: editingReuniao.id,
        usuario_id: usuario.id,
        nome: buildNomeSobrenome(usuario),
        email: usuario.email,
        cargo: usuario.cargo
      });
    } else {
      // Se for nova, salva no formData para o pai salvar depois
      handleChange("participantes_lista", novaLista);
    }
  };

  // ✅ Função para Remover Participante
  const handleRemoveParticipante = async (usuarioId) => {
    const novaLista = participantesAtuais.filter(p => p.usuario_id !== usuarioId);
    setParticipantesAtuais(novaLista);

    if (editingReuniao?.id) {
      await supabase
        .from("participantes_reuniao")
        .delete()
        .eq("reuniao_id", editingReuniao.id)
        .eq("usuario_id", usuarioId);
    } else {
      handleChange("participantes_lista", novaLista);
    }
  };

  const usarAtaDoTipo = () => {
    const guia = selectedTipo?.ata_principal || "";
    if (!guia) return;
    handleChange("ata", guia);
  };

  // ✅ UPLOAD COM SALVAMENTO IMEDIATO
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
          novosMateriais.push({ 
            name: file.name, 
            url: urlData.publicUrl, 
            type: file.type, 
            path: filePath 
          });
        }
      }

      const listaAtual = Array.isArray(formData.materiais) ? formData.materiais : [];
      const listaFinal = [...listaAtual, ...novosMateriais];
      handleChange("materiais", listaFinal);

      if (editingReuniao?.id) {
        const { error: dbError } = await supabase
          .from('reunioes')
          .update({ materiais: listaFinal })
          .eq('id', editingReuniao.id);
        
        if (dbError) throw dbError;
      }

    } catch (err) {
      console.error("Erro upload:", err);
      alert("Erro ao enviar arquivo: " + err.message);
    } finally {
      setUploadingMaterial(false);
      e.target.value = null;
    }
  };

  const handleRequestDeleteMaterial = (index) => {
    setMaterialToDelete(index);
    setAuthLoginMat("");
    setAuthSenhaMat("");
    setShowAuthMaterial(true);
  };

  const confirmDeleteMaterial = async () => {
    if (!authLoginMat || !authSenhaMat) return alert("Informe Login e Senha.");
    setValidatingAuthMat(true);
    try {
      const { data: usuario, error } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("nivel, ativo")
        .eq("login", authLoginMat)
        .eq("senha", authSenhaMat)
        .eq("ativo", true)
        .maybeSingle();

      if (error) throw error;
      if (!usuario) { alert("Credenciais inválidas."); return; }
      if (usuario.nivel !== 'Gestor' && usuario.nivel !== 'Administrador') { alert("Apenas Gestores/ADM podem excluir anexos."); return; }
      
      const listaAtual = Array.isArray(formData.materiais) ? formData.materiais : [];
      const novaLista = listaAtual.filter((_, i) => i !== materialToDelete);
      
      handleChange("materiais", novaLista);

      if (editingReuniao?.id) {
        const { error: dbError } = await supabase
          .from('reunioes')
          .update({ materiais: novaLista })
          .eq('id', editingReuniao.id);
        
        if (dbError) throw dbError;
      }

      setShowAuthMaterial(false);
      setMaterialToDelete(null);

    } catch (err) { 
      console.error(err);
      alert("Erro: " + err.message); 
    } finally { 
      setValidatingAuthMat(false); 
    }
  };

  // Filtros de busca (Organizadores)
  const filteredResponsaveis = useMemo(() => {
    const termo = (formData.responsavel || "").toLowerCase();
    return listaResponsaveis.filter(u => buildNomeSobrenome(u).toLowerCase().includes(termo)).slice(0, 8); 
  }, [listaResponsaveis, formData.responsavel]);

  // Filtros de busca (Participantes)
  const filteredParticipantesPossiveis = useMemo(() => {
    if (!buscaParticipante) return [];
    return listaResponsaveis.filter(u => 
      !participantesAtuais.some(p => p.usuario_id === u.id) &&
      (buildNomeSobrenome(u).toLowerCase().includes(buscaParticipante.toLowerCase()) ||
       String(u.email).toLowerCase().includes(buscaParticipante.toLowerCase()))
    ).slice(0, 5);
  }, [listaResponsaveis, buscaParticipante, participantesAtuais]);

  const selectResponsavel = (u) => {
    const nome = buildNomeSobrenome(u);
    handleChange("responsavel", nome);
    setShowSugestoesResp(false);
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

      {/* ESQUERDA */}
      <div className="lg:col-span-5 space-y-8 flex flex-col">
        <section className="space-y-4 flex-1">
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora (início)</label>
              <div className="relative"><Clock className="absolute left-3 top-2.5 text-slate-400" size={16} /><input type="time" disabled={isRealizada} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none disabled:opacity-60" value={formData.hora_inicio} onChange={(e) => handleChange("hora_inicio", e.target.value)} /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora (término)</label>
              <div className="relative"><Clock className="absolute left-3 top-2.5 text-slate-400" size={16} /><input type="time" disabled={isRealizada} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none disabled:opacity-60" value={formData.hora_fim} onChange={(e) => handleChange("hora_fim", e.target.value)} /></div>
            </div>
            
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Organizador</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  disabled={isRealizada}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  value={formData.responsavel}
                  onChange={(e) => { handleChange("responsavel", e.target.value); setShowSugestoesResp(true); }}
                  onFocus={() => setShowSugestoesResp(true)}
                  onBlur={() => setTimeout(() => setShowSugestoesResp(false), 200)}
                  placeholder="Buscar responsável..."
                />
              </div>
              {showSugestoesResp && !isRealizada && filteredResponsaveis.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filteredResponsaveis.map(u => (
                    <button 
                      key={u.id} 
                      type="button" 
                      onMouseDown={(e) => { e.preventDefault(); selectResponsavel(u); }} 
                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 border-b border-slate-50 last:border-0"
                    >
                      {buildNomeSobrenome(u)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ✅ NOVA SEÇÃO DE PARTICIPANTES */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex justify-between">
              <span>Participantes da Reunião</span>
              <span className="text-slate-400 font-normal">{participantesAtuais.length} selecionado(s)</span>
            </label>
            
            {!isRealizada && (
              <div className="relative mb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input 
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400"
                    placeholder="Adicionar participante..."
                    value={buscaParticipante}
                    onChange={e => setBuscaParticipante(e.target.value)}
                  />
                </div>
                {buscaParticipante && filteredParticipantesPossiveis.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    {filteredParticipantesPossiveis.map(u => (
                      <button 
                        key={u.id} 
                        type="button"
                        onClick={() => handleAddParticipante(u)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between group border-b border-slate-50 last:border-0"
                      >
                        <div>
                          <p className="font-bold text-slate-700">{buildNomeSobrenome(u)}</p>
                          <p className="text-[10px] text-slate-500">{u.email}</p>
                        </div>
                        <Plus size={14} className="text-blue-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {loadingParticipantes ? (
                <div className="text-center py-2"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></div>
              ) : participantesAtuais.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                  <p className="text-[10px] text-slate-400">Nenhum participante adicionado.</p>
                </div>
              ) : (
                participantesAtuais.map(p => (
                  <div key={p.usuario_id || p.id} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg shadow-sm">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold">
                        {p.nome?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{p.nome}</p>
                        <p className="text-[10px] text-slate-400 truncate">{p.email}</p>
                      </div>
                    </div>
                    {!isRealizada && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveParticipante(p.usuario_id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          {/* FIM SEÇÃO PARTICIPANTES */}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo</label>
            <select disabled={isRealizada} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none font-semibold disabled:opacity-60" value={formData.tipo_reuniao_id || ""} onChange={(e) => handleChange("tipo_reuniao_id", e.target.value)}>
              <option value="">Selecione...</option>
              {tipos.map((t) => (<option key={t.id} value={t.id}>{t.nome}</option>))}
            </select>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Cor</span>
            <input type="color" disabled={isRealizada} className="w-10 h-8 rounded cursor-pointer border-none bg-transparent disabled:opacity-60" value={formData.cor} onChange={(e) => handleChange("cor", e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select disabled={isRealizada} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none font-semibold disabled:opacity-60" value={formData.status} onChange={(e) => handleChange("status", e.target.value)}>
              <option value="Agendada">Agendada</option>
              <option value="Realizada">Realizada</option>
              <option value="Nao Realizada">Não realizada</option>
            </select>
          </div>
        </section>

        {/* ✅ BOTÃO EXCLUIR */}
        {editingReuniao && (
          <div className="pt-4 border-t border-slate-100 mt-auto">
            <button
              type="button"
              onClick={onDeleteRequest}
              className="text-red-500 font-bold text-xs flex items-center gap-2 hover:bg-red-50 px-3 py-2 rounded-lg w-full justify-center transition-colors"
            >
              <Trash2 size={16} /> Excluir Reunião (Área Restrita)
            </button>
          </div>
        )}
      </div>

      {/* DIREITA */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2"><AlignLeft size={16} /> ATA da Reunião</h3>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /><p className="text-xs font-bold text-slate-700">ATA guia</p></div>
            <button type="button" onClick={usarAtaDoTipo} className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 hover:bg-white disabled:opacity-50" disabled={!selectedTipo?.ata_principal || isRealizada}>Usar ATA principal</button>
          </div>
          <div className="mt-3 text-xs text-slate-600 whitespace-pre-line max-h-28 overflow-y-auto">{selectedTipo?.ata_principal || "Selecione um tipo."}</div>
        </div>
        <textarea disabled={isRealizada} className="flex-1 w-full min-h-[250px] bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 shadow-inner resize-none font-mono disabled:opacity-60" placeholder="Descreva a ATA..." value={formData.ata} onChange={(e) => handleChange("ata", e.target.value)} />

        <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase"><Paperclip size={14} /> Anexos</div>
              <label className={`cursor-pointer text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 flex items-center gap-2 transition-all ${uploadingMaterial ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingMaterial ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {uploadingMaterial ? "Enviando..." : "Anexar"}
                <input type="file" multiple className="hidden" onChange={handleUploadMaterial} disabled={uploadingMaterial} />
              </label>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[80px]">
              {formData.materiais && formData.materiais.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {formData.materiais.map((item, idx) => {
                    const isImage = item.type?.startsWith('image');
                    return (
                      <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isImage ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{isImage ? <ImageIcon size={16} /> : <FileText size={16} />}</div>
                          <div className="min-w-0"><p className="text-xs font-bold text-slate-700 truncate" title={item.name}>{item.name}</p></div>
                        </div>
                        <div className="flex items-center gap-1">
                          <a href={item.url} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md"><Download size={16} /></a>
                          <button type="button" onClick={() => handleRequestDeleteMaterial(idx)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (<div className="text-center py-4 text-slate-400 text-xs italic">Nenhum anexo.</div>)}
            </div>
        </div>
      </div>
    </div>
  );
}

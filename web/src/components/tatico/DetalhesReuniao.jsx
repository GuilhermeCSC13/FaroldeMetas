// src/components/tatico/DetalhesReuniao.jsx
import React, { useMemo, useEffect, useState } from "react";
import { 
  Calendar, 
  Clock, 
  AlignLeft, 
  FileText, 
  Paperclip, 
  Loader2, 
  Plus, 
  Trash2, 
  Download, 
  ImageIcon, 
  ShieldAlert, 
  User, 
  X 
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
}) {
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  
  // Estados para Responsáveis (Sugestões)
  const [listaResponsaveis, setListaResponsaveis] = useState([]);
  const [showSugestoesResp, setShowSugestoesResp] = useState(false);

  // Estados para Exclusão Segura
  const [showAuth, setShowAuth] = useState(false);
  const [authLogin, setAuthLogin] = useState("");
  const [authSenha, setAuthSenha] = useState("");
  const [validatingAuth, setValidatingAuth] = useState(false);
  const [materialIndexToDelete, setMaterialIndexToDelete] = useState(null);

  const handleChange = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const selectedTipo = useMemo(() => {
    return tipos.find((t) => String(t.id) === String(formData.tipo_reuniao_id)) || null;
  }, [tipos, formData.tipo_reuniao_id]);

  // Carregar lista de responsáveis do Inove
  useEffect(() => {
    const fetchResponsaveis = async () => {
      const { data } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("id, nome, sobrenome, nome_completo, ativo")
        .eq("ativo", true)
        .order("nome");
      setListaResponsaveis(data || []);
    };
    fetchResponsaveis();
  }, []);

  // Efeito para carregar dados iniciais
  useEffect(() => {
    if (editingReuniao) {
      const horaIni = extractTime(editingReuniao.horario_inicio) || extractTime(editingReuniao.data_hora) || "09:00";
      const horaFim = extractTime(editingReuniao.horario_fim) || "10:00";

      setFormData(prev => ({
          ...prev,
          hora_inicio: prev.hora_inicio || horaIni,
          hora_fim: prev.hora_fim || horaFim,
          materiais: editingReuniao.materiais || []
      }));
    }
  }, [editingReuniao, setFormData]);

  const usarAtaDoTipo = () => {
    const guia = selectedTipo?.ata_principal || "";
    if (!guia) return;
    handleChange("ata", guia);
  };

  // Upload de Material
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
      const listaAtual = formData.materiais || [];
      handleChange("materiais", [...listaAtual, ...novosMateriais]);
    } catch (err) {
      console.error("Erro upload:", err);
      alert("Erro ao enviar arquivo: " + err.message);
    } finally {
      setUploadingMaterial(false);
      e.target.value = null;
    }
  };

  // --- LÓGICA DE EXCLUSÃO SEGURA ---
  const handleRequestDelete = (index) => {
    setMaterialIndexToDelete(index);
    setAuthLogin("");
    setAuthSenha("");
    setShowAuth(true);
  };

  const confirmDeleteMaterial = async () => {
    if (!authLogin || !authSenha) return alert("Informe Login e Senha.");
    setValidatingAuth(true);

    try {
      // 1. Validar Credenciais
      const { data: usuario, error } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("nivel, ativo")
        .eq("login", authLogin)
        .eq("senha", authSenha)
        .eq("ativo", true)
        .maybeSingle();

      if (error) throw error;
      if (!usuario) {
        alert("Credenciais inválidas.");
        setValidatingAuth(false);
        return;
      }

      // 2. Validar Nível (Gestor ou Adm)
      if (usuario.nivel !== 'Gestor' && usuario.nivel !== 'Administrador') {
        alert("Permissão negada. Apenas Gestores e Administradores podem excluir anexos.");
        setValidatingAuth(false);
        return;
      }

      // 3. Executar Exclusão
      const listaAtual = formData.materiais || [];
      const novaLista = listaAtual.filter((_, i) => i !== materialIndexToDelete);
      handleChange("materiais", novaLista);
      
      setShowAuth(false);
      setMaterialIndexToDelete(null);

    } catch (err) {
      console.error(err);
      alert("Erro ao validar: " + err.message);
    } finally {
      setValidatingAuth(false);
    }
  };

  // --- LÓGICA DE SELEÇÃO DE RESPONSÁVEL ---
  const filteredResponsaveis = useMemo(() => {
    const termo = (formData.responsavel || "").toLowerCase();
    return listaResponsaveis.filter(u => 
      buildNomeSobrenome(u).toLowerCase().includes(termo)
    ).slice(0, 8); // Limita a 8 sugestões
  }, [listaResponsaveis, formData.responsavel]);

  const selectResponsavel = (u) => {
    handleChange("responsavel", buildNomeSobrenome(u));
    setShowSugestoesResp(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative">
      
      {/* MODAL DE AUTENTICAÇÃO (OVERLAY) */}
      {showAuth && (
        <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 rounded-xl animate-in fade-in duration-200 border border-slate-200 shadow-xl h-full">
          <div className="w-full max-w-xs text-center">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 text-red-600">
              <ShieldAlert size={20} />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">Autorização Necessária</h4>
            <p className="text-xs text-slate-500 mb-4">Apenas <b>Gestores</b> ou <b>ADM</b> podem remover anexos.</p>
            
            <div className="space-y-2 text-left">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Login</label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  value={authLogin}
                  onChange={e => setAuthLogin(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Senha</label>
                <input 
                  type="password" 
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  value={authSenha}
                  onChange={e => setAuthSenha(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button 
                type="button"
                onClick={() => setShowAuth(false)}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={confirmDeleteMaterial}
                disabled={validatingAuth}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 disabled:opacity-50"
              >
                {validatingAuth ? "Verificando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LADO ESQUERDO: CONFIGURAÇÃO */}
      <div className="lg:col-span-5 space-y-8">
        <section className="space-y-4">
          <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">
            Configurações da Reunião
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Título</label>
            <input
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
              value={formData.titulo}
              onChange={(e) => handleChange("titulo", e.target.value)}
              placeholder="Ex: DBO - Diretrizes Básicas"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none"
                  value={formData.data}
                  onChange={(e) => handleChange("data", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora (início)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="time"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none"
                  value={formData.hora_inicio}
                  onChange={(e) => handleChange("hora_inicio", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora (término)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="time"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none"
                  value={formData.hora_fim}
                  onChange={(e) => handleChange("hora_fim", e.target.value)}
                />
              </div>
            </div>

            {/* SELEÇÃO DE RESPONSÁVEL INTELIGENTE */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Organizador</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                  value={formData.responsavel}
                  onChange={(e) => {
                    handleChange("responsavel", e.target.value);
                    setShowSugestoesResp(true);
                  }}
                  onFocus={() => setShowSugestoesResp(true)}
                  onBlur={() => setTimeout(() => setShowSugestoesResp(false), 200)}
                  placeholder="Buscar responsável..."
                />
              </div>
              {showSugestoesResp && filteredResponsaveis.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filteredResponsaveis.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => selectResponsavel(u)}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 border-b border-slate-50 last:border-0"
                    >
                      {buildNomeSobrenome(u)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de reunião</label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none font-semibold"
              value={formData.tipo_reuniao_id || ""}
              onChange={(e) => handleChange("tipo_reuniao_id", e.target.value)}
            >
              <option value="">Selecione...</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            {selectedTipo?.nome && (
              <p className="text-[10px] text-slate-400 mt-1 font-bold">{selectedTipo.nome}</p>
            )}
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Cor na agenda</span>
            <input
              type="color"
              className="w-10 h-8 rounded cursor-pointer border-none bg-transparent"
              value={formData.cor}
              onChange={(e) => handleChange("cor", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none font-semibold"
              value={formData.status}
              onChange={(e) => handleChange("status", e.target.value)}
            >
              <option value="Agendada">Agendada</option>
              <option value="Realizada">Realizada</option>
              <option value="Nao Realizada">Não realizada</option>
            </select>
          </div>
        </section>
      </div>

      {/* LADO DIREITO: ATA E MATERIAIS */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
          <AlignLeft size={16} /> ATA da Reunião
        </h3>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-slate-400" />
              <p className="text-xs font-bold text-slate-700">ATA guia do tipo</p>
            </div>
            <button
              type="button"
              onClick={usarAtaDoTipo}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 hover:bg-white"
              disabled={!selectedTipo?.ata_principal}
              title={!selectedTipo?.ata_principal ? "Tipo sem ATA guia" : "Copiar ATA guia para esta reunião"}
            >
              Usar ATA principal do tipo
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-600 whitespace-pre-line max-h-28 overflow-y-auto">
            {selectedTipo?.ata_principal || "Selecione um tipo para visualizar a ATA guia."}
          </div>
        </div>

        <textarea
          className="flex-1 w-full min-h-[250px] bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 shadow-inner resize-none font-mono"
          placeholder="Descreva a ATA desta reunião aqui..."
          value={formData.ata}
          onChange={(e) => handleChange("ata", e.target.value)}
        />

        <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                <Paperclip size={14} /> Materiais e Anexos
              </div>
              <label className={`cursor-pointer text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 flex items-center gap-2 transition-all ${uploadingMaterial ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingMaterial ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {uploadingMaterial ? "Enviando..." : "Anexar"}
                <input type="file" multiple className="hidden" onChange={handleUploadMaterial} disabled={uploadingMaterial} />
              </label>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[80px]">
              {formData.materiais && formData.materiais.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {formData.materiais.map((item, idx) => {
                    const isImage = item.type?.startsWith('image');
                    return (
                      <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isImage ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate" title={item.name}>{item.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase">Anexo</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <a href={item.url} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Baixar">
                            <Download size={16} />
                          </a>
                          <button 
                            type="button" 
                            onClick={() => handleRequestDelete(idx)} 
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" 
                            title="Remover"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-400 text-xs italic">
                  Nenhum material anexado.
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}

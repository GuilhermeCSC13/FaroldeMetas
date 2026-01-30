// src/components/tatico/ModalDetalhesAcao.jsx
import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, X, Trash2, UploadCloud, RotateCw, FileText, File as FileIcon, User, Calendar } from "lucide-react";
import { supabase, supabaseInove } from "../../supabaseClient";

/* =========================
   Helpers
========================= */
function buildNomeSobrenome(u) {
  const nome = String(u?.nome || "").trim();
  const sobrenome = String(u?.sobrenome || "").trim();
  const nomeCompleto = String(u?.nome_completo || "").trim();

  if (nome && sobrenome) return `${nome} ${sobrenome}`;
  if (nomeCompleto) return nomeCompleto;
  if (nome) return nome;
  return "-";
}

function sanitizeFileName(name) {
  return String(name || "").replace(/[^a-zA-Z0-9.]/g, "");
}

// ✅ Validação de UUID para evitar erro "20"
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

function fileKindFromFile(file) {
  const t = String(file?.type || "").toLowerCase();
  const n = String(file?.name || "").toLowerCase();

  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".doc") || n.endsWith(".docx")) return "doc";
  if (n.endsWith(".xls") || n.endsWith(".xlsx")) return "xls";
  if (n.endsWith(".ppt") || n.endsWith(".pptx")) return "ppt";
  return "file";
}

function fileKindFromUrl(url) {
  const u = String(url || "").toLowerCase().split("?")[0];
  if (u.match(/\.(png|jpg|jpeg|webp|gif)$/)) return "image";
  if (u.match(/\.(mp4|mov|webm|mkv)$/)) return "video";
  if (u.endsWith(".pdf")) return "pdf";
  if (u.match(/\.(doc|docx)$/)) return "doc";
  if (u.match(/\.(xls|xlsx)$/)) return "xls";
  if (u.match(/\.(ppt|pptx)$/)) return "ppt";
  return "file";
}

/* =========================
   Component
========================= */
const ModalDetalhesAcao = ({
  aberto,
  acao,
  status,
  onClose,
  onConcluir,
  onAfterSave,
  onAfterDelete,
}) => {
  if (!aberto || !acao) return null;

  // ---------------------------------------------------------------------------
  // ESTADOS LOCAIS
  // ---------------------------------------------------------------------------
  const [statusLocal, setStatusLocal] = useState(status || "Aberta");

  const [obsAcao, setObsAcao] = useState("");
  const [resultado, setResultado] = useState("");
  const [fotosAcao, setFotosAcao] = useState([]);
  const [fotosConclusao, setFotosConclusao] = useState([]);

  const [novosArquivosAcao, setNovosArquivosAcao] = useState([]);
  const [novosArquivosConclusao, setNovosArquivosConclusao] = useState([]);

  const [responsavelTexto, setResponsavelTexto] = useState("");
  const [responsavelId, setResponsavelId] = useState(null);
  const [listaResponsaveis, setListaResponsaveis] = useState([]);
  const [loadingResponsaveis, setLoadingResponsaveis] = useState(false);
  const [openSugestoes, setOpenSugestoes] = useState(false);

  const [vencimento, setVencimento] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);

  // ---------------------------------------------------------------------------
  // INIT / LOAD
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!acao || !aberto) return;

    setStatusLocal(status || acao.status || "Aberta");

    setObsAcao(acao.observacao || "");
    setResultado(acao.resultado || "");

    const baseAcao = Array.isArray(acao.fotos_acao)
      ? acao.fotos_acao
      : Array.isArray(acao.fotos)
      ? acao.fotos
      : [];

    const baseConclusao = Array.isArray(acao.fotos_conclusao) ? acao.fotos_conclusao : [];

    setFotosAcao(baseAcao);
    setFotosConclusao(baseConclusao);
    setNovosArquivosAcao([]);
    setNovosArquivosConclusao([]);

    const respTexto =
      acao.responsavel_nome ||
      acao.responsavel ||
      acao.responsavelName ||
      "";

    setResponsavelTexto(String(respTexto || "").trim());
    
    // ✅ Valida ID ao carregar
    const initialRespId = acao.responsavel_id;
    setResponsavelId(isValidUUID(initialRespId) ? initialRespId : null);

    if (acao.data_vencimento) {
      const d = new Date(acao.data_vencimento);
      setVencimento(d.toISOString().split("T")[0]);
    } else {
      setVencimento("");
    }

    // Carregar responsáveis
    const carregarResponsaveis = async () => {
      try {
        setLoadingResponsaveis(true);
        const { data, error } = await supabaseInove
          .from("usuarios_aprovadores")
          .select("id, nome, sobrenome, nome_completo, ativo")
          .eq("ativo", true)
          .order("nome", { ascending: true });

        if (error) {
          console.error("Erro ao buscar responsáveis (INOVE):", error);
          setListaResponsaveis([]);
          return;
        }

        setListaResponsaveis(data || []);

        if (!isValidUUID(acao.responsavel_id) && respTexto && (data || []).length) {
          const respNorm = String(respTexto).trim().toLowerCase();
          const found = (data || []).find((u) => {
            const label = buildNomeSobrenome(u).toLowerCase();
            const nc = String(u?.nome_completo || "").trim().toLowerCase();
            return label === respNorm || (nc && nc === respNorm);
          });

          if (found?.id) {
            setResponsavelId(found.id);
            setResponsavelTexto(buildNomeSobrenome(found));
          }
        }
      } finally {
        setLoadingResponsaveis(false);
      }
    };

    carregarResponsaveis();
  }, [acao, aberto, status]);

  // ---------------------------------------------------------------------------
  // SUGESTÕES RESPONSÁVEL
  // ---------------------------------------------------------------------------
  const sugestoes = useMemo(() => {
    const q = String(responsavelTexto || "").trim().toLowerCase();
    if (!q) return (listaResponsaveis || []).slice(0, 12);

    return (listaResponsaveis || [])
      .map((u) => ({ u, label: buildNomeSobrenome(u) }))
      .filter((x) => x.label.toLowerCase().includes(q))
      .slice(0, 12);
  }, [listaResponsaveis, responsavelTexto]);

  const selecionarResponsavel = (u) => {
    setResponsavelId(u?.id || null);
    setResponsavelTexto(buildNomeSobrenome(u));
    setOpenSugestoes(false);
  };

  useEffect(() => {
    const txt = String(responsavelTexto || "").trim().toLowerCase();
    if (!txt) {
      setResponsavelId(null);
      return;
    }
    // Tenta achar match exato no texto digitado
    const exact = (listaResponsaveis || []).find((u) => {
      const label = buildNomeSobrenome(u).toLowerCase();
      const nc = String(u?.nome_completo || "").trim().toLowerCase();
      return label === txt || (nc && nc === txt);
    });

    if (exact?.id) setResponsavelId(exact.id);
    // Se não achou exato, mantemos o ID anterior SOMENTE se o texto ainda corresponder, 
    // mas aqui simplificamos: se digitou algo novo que não bate, anula ID.
    else if (responsavelId) {
        // Opcional: checar se o ID atual ainda bate com o texto, se não, null
        const current = (listaResponsaveis || []).find(u => u.id === responsavelId);
        const currentName = current ? buildNomeSobrenome(current).toLowerCase() : "";
        if (currentName !== txt) setResponsavelId(null);
    }
  }, [responsavelTexto, listaResponsaveis, responsavelId]);

  // ---------------------------------------------------------------------------
  // UPLOAD
  // ---------------------------------------------------------------------------
  const uploadArquivos = async (files) => {
    const urls = [];
    for (const file of files) {
      const fileName = `acao-${acao.id}-${Date.now()}-${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage.from("evidencias").upload(fileName, file);
      if (error) {
        console.error("Erro upload evidência:", error);
        continue;
      }
      const { data: urlData } = supabase.storage.from("evidencias").getPublicUrl(fileName);
      if (urlData?.publicUrl) urls.push(urlData.publicUrl);
    }
    return urls;
  };

  // ---------------------------------------------------------------------------
  // SALVAR / EXCLUIR / REABRIR
  // ---------------------------------------------------------------------------
  const handleSalvar = async () => {
    if (!acao) return;
    setSaving(true);
    try {
      const novasUrlsAcao =
        novosArquivosAcao.length > 0 ? await uploadArquivos(novosArquivosAcao) : [];
      const novasUrlsConclusao =
        novosArquivosConclusao.length > 0
          ? await uploadArquivos(novosArquivosConclusao)
          : [];

      const user = (listaResponsaveis || []).find(
        (u) => String(u.id) === String(responsavelId)
      );
      const nomeResp = responsavelId ? buildNomeSobrenome(user) : String(responsavelTexto || "").trim();

      // ✅ Sanitização do ID antes de salvar
      const safeResponsavelId = isValidUUID(responsavelId) ? responsavelId : null;

      const payload = {
        observacao: obsAcao,
        resultado,
        fotos_acao: [...fotosAcao, ...novasUrlsAcao],
        fotos_conclusao: [...fotosConclusao, ...novasUrlsConclusao],
        responsavel_id: safeResponsavelId,
        responsavel: nomeResp || null,
        responsavel_nome: nomeResp || null,
        data_vencimento: vencimento || null,
      };

      if (!acao.fotos_acao && !acao.fotos_conclusao) {
        payload.fotos = payload.fotos_acao;
      }

      const { error } = await supabase.from("acoes").update(payload).eq("id", acao.id);
      if (error) throw error;

      setFotosAcao(payload.fotos_acao);
      setFotosConclusao(payload.fotos_conclusao);
      setNovosArquivosAcao([]);
      setNovosArquivosConclusao([]);

      if (typeof onAfterSave === "function") onAfterSave(acao.id);
    } catch (err) {
      alert("Erro ao salvar alterações da ação: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    if (!acao) return;
    const senha = window.prompt("Para excluir a ação, digite a senha de autorização:");
    if (senha === null) return;
    if (senha !== "excluir") return alert("Senha incorreta. A ação não será excluída.");
    if (!window.confirm("Tem certeza que deseja excluir esta ação?")) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("acoes").delete().eq("id", acao.id);
      if (error) throw error;

      if (typeof onAfterDelete === "function") onAfterDelete(acao.id);
      onClose();
    } catch (err) {
      alert("Erro ao excluir ação: " + (err?.message || err));
    } finally {
      setDeleting(false);
    }
  };

  const handleReabrir = async () => {
    if (!acao) return;
    if (!window.confirm("Reabrir a ação permitirá novas alterações. Deseja continuar?")) return;

    setReabrindo(true);
    try {
      const { error } = await supabase
        .from("acoes")
        .update({ 
            status: "Aberta", 
            data_conclusao: null,
            fechado_por_nome: null,
            fechado_por_aprovador_id: null
        })
        .eq("id", acao.id);

      if (error) throw error;

      setStatusLocal("Aberta");
      if (typeof onAfterSave === "function") onAfterSave(acao.id);
    } catch (err) {
      alert("Erro ao reabrir ação: " + (err?.message || err));
    } finally {
      setReabrindo(false);
    }
  };

  // ---------------------------------------------------------------------------
  // FINALIZAR
  // ---------------------------------------------------------------------------
  const podeConcluirLocal =
    statusLocal !== "Concluída" &&
    resultado.trim().length > 0 &&
    fotosConclusao.length + novosArquivosConclusao.length > 0;

  const handleFinalizarClick = async () => {
    if (!podeConcluirLocal) {
      alert("Para finalizar, registre o que foi realizado e anexe pelo menos uma evidência.");
      return;
    }
    await handleSalvar();
    if (typeof onConcluir === "function") await onConcluir();
    setStatusLocal("Concluída");
  };

  // ---------------------------------------------------------------------------
  // DADOS VISUAIS
  // ---------------------------------------------------------------------------
  const dataCriacao =
    acao.data_criacao || acao.created_at
      ? new Date(acao.data_criacao || acao.created_at).toLocaleString()
      : "-";

  const dataFechamento = acao.data_fechamento || acao.data_conclusao 
    ? new Date(acao.data_fechamento || acao.data_conclusao).toLocaleString() 
    : null;

  const inputsDesabilitados = statusLocal === "Concluída";

  const previewsAcao = useMemo(() => {
    return (novosArquivosAcao || []).map((f, idx) => {
      const kind = fileKindFromFile(f);
      const needsUrl = kind === "image" || kind === "video";
      const url = needsUrl ? URL.createObjectURL(f) : null;
      return { id: `a-${idx}-${f.name}`, file: f, name: f.name, kind, url };
    });
  }, [novosArquivosAcao]);

  const previewsConclusao = useMemo(() => {
    return (novosArquivosConclusao || []).map((f, idx) => {
      const kind = fileKindFromFile(f);
      const needsUrl = kind === "image" || kind === "video";
      const url = needsUrl ? URL.createObjectURL(f) : null;
      return { id: `c-${idx}-${f.name}`, file: f, name: f.name, kind, url };
    });
  }, [novosArquivosConclusao]);

  useEffect(() => {
    return () => {
      (previewsAcao || []).forEach((p) => p?.url && URL.revokeObjectURL(p.url));
      (previewsConclusao || []).forEach((p) => p?.url && URL.revokeObjectURL(p.url));
    };
  }, [previewsAcao, previewsConclusao]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-400">Detalhes da ação</div>
            <div className="text-sm sm:text-base font-semibold text-gray-800 truncate max-w-xl">
              {acao.descricao}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6 bg-gray-50">
          
          {/* BLOCO 1: INFO GERAIS + CRIAÇÃO */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Status */}
                <div className="flex flex-col">
                   <span className="text-[11px] font-bold text-gray-400 uppercase mb-1">Status</span>
                   <span className={`text-sm font-semibold ${statusLocal === 'Concluída' ? 'text-green-600' : 'text-amber-600'}`}>
                     {statusLocal}
                   </span>
                </div>

                {/* Criação */}
                <div className="flex flex-col">
                   <span className="text-[11px] font-bold text-gray-400 uppercase mb-1">Criação</span>
                   <span className="text-sm text-gray-700 flex items-center gap-1">
                     <Calendar size={14} /> {dataCriacao}
                   </span>
                   {acao.criado_por_nome && (
                     <span className="text-[10px] text-blue-600 font-medium mt-0.5 flex items-center gap-1">
                        <User size={10} /> Criado por: {acao.criado_por_nome}
                     </span>
                   )}
                </div>

                {/* Vencimento */}
                <div className="flex flex-col">
                   <span className="text-[11px] font-bold text-gray-400 uppercase mb-1">Vencimento</span>
                   <input
                    type="date"
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    disabled={inputsDesabilitados}
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 w-full"
                  />
                </div>

                {/* Responsável */}
                <div className="flex flex-col relative">
                   <span className="text-[11px] font-bold text-gray-400 uppercase mb-1">Responsável</span>
                   <input
                    value={responsavelTexto}
                    onChange={(e) => {
                      setResponsavelTexto(e.target.value);
                      setOpenSugestoes(true);
                    }}
                    onFocus={() => setOpenSugestoes(true)}
                    onBlur={() => setTimeout(() => setOpenSugestoes(false), 150)}
                    disabled={inputsDesabilitados || loadingResponsaveis}
                    placeholder="Nome do responsável..."
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 w-full"
                  />
                  {openSugestoes && !inputsDesabilitados && (sugestoes || []).length > 0 && (
                    <div className="absolute top-[50px] left-0 w-full bg-white border border-gray-200 rounded shadow-lg z-10 max-h-40 overflow-y-auto">
                      {(sugestoes || []).map(({ u, label }) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => selecionarResponsavel(u)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
             </div>
          </div>

          {/* AÇÃO */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Descrição e Evidências Iniciais</h3>
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 shadow-sm">
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase">Observações da Ação</span>
                <textarea
                  className="mt-1 w-full border border-gray-300 rounded-lg text-sm p-3 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                  rows={3}
                  value={obsAcao}
                  onChange={(e) => setObsAcao(e.target.value)}
                  disabled={inputsDesabilitados}
                  placeholder="Descreva detalhes..."
                />
              </div>

              {/* Evidências Ação */}
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase block mb-2">Anexos (Abertura)</span>
                
                {fotosAcao.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {fotosAcao.map((url, idx) => (
                      <MiniaturaUrl key={`${url}-${idx}`} url={url} />
                    ))}
                  </div>
                )}

                {!inputsDesabilitados && (
                  <>
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-blue-200 rounded-lg cursor-pointer bg-blue-50/50 hover:bg-blue-50 transition-colors group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-8 h-8 text-blue-400 group-hover:text-blue-600 mb-1" />
                        <p className="text-xs text-gray-500"><span className="font-semibold text-blue-600">Clique para enviar</span> ou arraste</p>
                      </div>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        className="hidden"
                        onChange={(e) => setNovosArquivosAcao(Array.from(e.target.files || []))}
                      />
                    </label>

                    {previewsAcao.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Prontos para envio:</div>
                        <div className="flex flex-wrap gap-3">
                          {previewsAcao.map((p) => (
                            <MiniaturaArquivo key={p.id} preview={p} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* CONCLUSÃO */}
          <div>
            <div className="flex items-center justify-between mb-2 ml-1">
                 <h3 className="text-xs font-bold text-gray-500 uppercase">Conclusão da ação</h3>
                 {statusLocal === "Concluída" && (acao.fechado_por_nome || dataFechamento) && (
                     <div className="text-right">
                         {acao.fechado_por_nome && (
                            <span className="text-[10px] text-blue-600 font-bold block">
                                Fechado por: {acao.fechado_por_nome}
                            </span>
                         )}
                         {dataFechamento && (
                            <span className="text-[10px] text-gray-400 block">
                                Em: {dataFechamento}
                            </span>
                         )}
                     </div>
                 )}
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 shadow-sm relative overflow-hidden">
              {statusLocal === "Concluída" && <div className="absolute top-0 right-0 p-2"><CheckCircle className="text-green-100 w-24 h-24 -mt-8 -mr-8 opacity-50"/></div>}
              
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase">O que foi realizado?</span>
                <textarea
                  className="mt-1 w-full border border-gray-300 rounded-lg text-sm p-3 focus:outline-none focus:ring-2 focus:ring-green-100 disabled:bg-gray-50"
                  rows={3}
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  disabled={inputsDesabilitados}
                  placeholder="Descreva a solução..."
                />
              </div>

              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase block mb-2">Anexos (Conclusão)</span>

                {fotosConclusao.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {fotosConclusao.map((url, idx) => (
                      <MiniaturaUrl key={`${url}-${idx}`} url={url} />
                    ))}
                  </div>
                )}

                {!inputsDesabilitados && (
                  <>
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-green-200 rounded-lg cursor-pointer bg-green-50/50 hover:bg-green-50 transition-colors group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-8 h-8 text-green-400 group-hover:text-green-600 mb-1" />
                        <p className="text-xs text-gray-500"><span className="font-semibold text-green-600">Enviar prova de conclusão</span></p>
                      </div>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        className="hidden"
                        onChange={(e) => setNovosArquivosConclusao(Array.from(e.target.files || []))}
                      />
                    </label>

                    {previewsConclusao.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Prontos para envio:</div>
                        <div className="flex flex-wrap gap-3">
                          {previewsConclusao.map((p) => (
                            <MiniaturaArquivo key={p.id} preview={p} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col text-[11px] text-gray-500">
             {statusLocal !== "Concluída" && (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  ! Obrigatório preencher conclusão e anexos para finalizar.
                </span>
             )}
            <button
              onClick={handleSalvar}
              disabled={saving || inputsDesabilitados}
              className="mt-2 self-start px-4 py-2 rounded text-xs font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar rascunho"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {statusLocal === "Concluída" && (
              <button
                onClick={handleReabrir}
                disabled={reabrindo}
                className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
              >
                <RotateCw size={16} />
                {reabrindo ? "Reabrindo..." : "Reabrir"}
              </button>
            )}

            <button
              onClick={handleExcluir}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
            >
              <Trash2 size={16} />
              {deleting ? "..." : "Excluir"}
            </button>

            {statusLocal !== "Concluída" && (
              <button
                onClick={handleFinalizarClick}
                disabled={!podeConcluirLocal || saving || deleting}
                className={`px-6 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                  podeConcluirLocal && !saving && !deleting
                    ? "bg-green-600 text-white hover:bg-green-700 shadow-md transform hover:-translate-y-0.5"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <CheckCircle size={18} />
                Finalizar Ação
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalDetalhesAcao;

/* =========================
   Miniaturas
========================= */
function MiniaturaArquivo({ preview }) {
  const { kind, url, name } = preview;
  const box = "w-16 h-16 rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center relative shadow-sm";
  const caption = "max-w-[64px] text-[9px] text-slate-600 truncate mt-1 text-center";

  if (kind === "image") {
    return (
      <div className="flex flex-col items-center" title={name}>
        <div className={box}>
          <img src={url} alt={name} className="w-full h-full object-cover" />
        </div>
        <div className={caption}>{name}</div>
      </div>
    );
  }
  
  const Icon = kind === "pdf" ? FileText : FileIcon;
  const label = kind.toUpperCase().substring(0,3);
  const color = kind === "pdf" ? "text-red-500" : "text-blue-500";

  return (
    <div className="flex flex-col items-center" title={name}>
      <div className={box}>
        <Icon className={`${color}`} size={24} />
        <span className="absolute bottom-1 text-[8px] font-bold text-gray-400">{label}</span>
      </div>
      <div className={caption}>{name}</div>
    </div>
  );
}

function MiniaturaUrl({ url }) {
  const kind = fileKindFromUrl(url);
  const box = "w-16 h-16 rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-blue-200 transition-all shadow-sm cursor-pointer";
  const caption = "max-w-[64px] text-[9px] text-slate-600 truncate mt-1 text-center";
  
  const name = (() => {
    try {
      const base = String(url).split("?")[0];
      return base.substring(base.lastIndexOf("/") + 1) || "arquivo";
    } catch { return "arquivo"; }
  })();

  if (kind === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex flex-col items-center" title={name}>
        <div className={box}>
          <img src={url} alt={name} className="w-full h-full object-cover" />
        </div>
        <div className={caption}>{name}</div>
      </a>
    );
  }

  const Icon = kind === "pdf" ? FileText : FileIcon;
  const color = kind === "pdf" ? "text-red-500" : "text-blue-500";
  const label = kind === 'image' ? 'IMG' : kind.toUpperCase().substring(0,3);

  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex flex-col items-center" title={name}>
      <div className={box}>
         <Icon className={color} size={24} />
         <span className="absolute bottom-1 text-[8px] font-bold text-gray-400">{label}</span>
      </div>
      <div className={caption}>{name}</div>
    </a>
  );
}

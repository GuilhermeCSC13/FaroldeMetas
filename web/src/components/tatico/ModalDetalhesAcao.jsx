// src/components/tatico/ModalDetalhesAcao.jsx
import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, X, Trash2, UploadCloud, RotateCw, FileText, File as FileIcon } from "lucide-react";
import { supabase, supabaseInove } from "../../supabaseClient";

/* =========================
   Helpers (IGUAL Copiloto)
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

  // ✅ Responsável (IGUAL Copiloto: escrever e sugerir)
  // - Fonte: supabaseInove -> usuarios_aprovadores
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
    setResponsavelId(acao.responsavel_id || null);

    if (acao.data_vencimento) {
      const d = new Date(acao.data_vencimento);
      setVencimento(d.toISOString().split("T")[0]);
    } else {
      setVencimento("");
    }

    // ✅ carrega responsáveis do SUPABASE INOVE
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

        // se não tiver id mas tiver texto, tenta casar
        if (!acao.responsavel_id && respTexto && (data || []).length) {
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
  // SUGESTÕES RESPONSÁVEL (typeahead)
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

  // se o usuário digitar um texto que não casa com ninguém, zera o id
  useEffect(() => {
    const txt = String(responsavelTexto || "").trim().toLowerCase();
    if (!txt) {
      setResponsavelId(null);
      return;
    }

    const exact = (listaResponsaveis || []).find((u) => {
      const label = buildNomeSobrenome(u).toLowerCase();
      const nc = String(u?.nome_completo || "").trim().toLowerCase();
      return label === txt || (nc && nc === txt);
    });

    if (exact?.id) setResponsavelId(exact.id);
    else setResponsavelId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responsavelTexto]);

  // ---------------------------------------------------------------------------
  // Upload evidências (IGUAL Copiloto: múltiplos arquivos + vários tipos)
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
  // SALVAR ALTERAÇÕES (grava responsável igual Copiloto)
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

      const payload = {
        observacao: obsAcao,
        resultado,
        fotos_acao: [...fotosAcao, ...novasUrlsAcao],
        fotos_conclusao: [...fotosConclusao, ...novasUrlsConclusao],

        // ✅ mesmos campos (Copiloto)
        responsavel_id: responsavelId || null,
        responsavel: nomeResp || null,
        responsavel_nome: nomeResp || null,

        data_vencimento: vencimento || null,
      };

      // Compatibilidade com tabela antiga (só "fotos")
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

  // ---------------------------------------------------------------------------
  // EXCLUIR
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // REABRIR
  // ---------------------------------------------------------------------------
  const handleReabrir = async () => {
    if (!acao) return;
    if (
      !window.confirm(
        "Reabrir a ação permitirá novas alterações e uma nova conclusão. Deseja continuar?"
      )
    )
      return;

    setReabrindo(true);
    try {
      const { error } = await supabase
        .from("acoes")
        .update({ status: "Aberta", data_conclusao: null })
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
      alert("Para finalizar, registre o que foi realizado e anexe pelo menos uma evidência de conclusão.");
      return;
    }

    await handleSalvar();
    if (typeof onConcluir === "function") await onConcluir();
    setStatusLocal("Concluída");
  };

  const dataCriacao =
    acao.data_criacao || acao.created_at
      ? new Date(acao.data_criacao || acao.created_at).toLocaleString()
      : "-";

  const dataVencimentoLabel = vencimento ? new Date(vencimento).toLocaleDateString("pt-BR") : "-";
  const inputsDesabilitados = statusLocal === "Concluída";

  // ---------------------------------------------------------------------------
  // UI: previews (novos arquivos)
  // ---------------------------------------------------------------------------
  const previewsAcao = useMemo(() => {
    return (novosArquivosAcao || []).map((f, idx) => {
      const kind = fileKindFromFile(f);
      const needsUrl = kind === "image" || kind === "video";
      const url = needsUrl ? URL.createObjectURL(f) : null;
      return { id: `a-${idx}-${f.name}-${f.size}`, file: f, name: f.name, kind, url };
    });
  }, [novosArquivosAcao]);

  const previewsConclusao = useMemo(() => {
    return (novosArquivosConclusao || []).map((f, idx) => {
      const kind = fileKindFromFile(f);
      const needsUrl = kind === "image" || kind === "video";
      const url = needsUrl ? URL.createObjectURL(f) : null;
      return { id: `c-${idx}-${f.name}-${f.size}`, file: f, name: f.name, kind, url };
    });
  }, [novosArquivosConclusao]);

  useEffect(() => {
    return () => {
      (previewsAcao || []).forEach((p) => p?.url && URL.revokeObjectURL(p.url));
      (previewsConclusao || []).forEach((p) => p?.url && URL.revokeObjectURL(p.url));
    };
  }, [previewsAcao, previewsConclusao]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
          {/* AÇÃO */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Ação</h3>
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              {/* Linha informativa */}
              <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-600">
                <span>
                  <strong className="font-semibold">Status:</strong> {statusLocal}
                </span>
                <span>
                  <strong className="font-semibold">Criação:</strong> {dataCriacao}
                </span>
                <span>
                  <strong className="font-semibold">Vencimento:</strong> {dataVencimentoLabel}
                </span>
                <span>
                  <strong className="font-semibold">Responsável:</strong>{" "}
                  {responsavelTexto || "-"}
                </span>
              </div>

              {/* Responsável (typeahead) / Vencimento */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs sm:text-sm">
                <div className="flex flex-col relative">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Responsável</span>

                  <input
                    value={responsavelTexto}
                    onChange={(e) => {
                      setResponsavelTexto(e.target.value);
                      setOpenSugestoes(true);
                    }}
                    onFocus={() => setOpenSugestoes(true)}
                    onBlur={() => setTimeout(() => setOpenSugestoes(false), 150)}
                    disabled={inputsDesabilitados || loadingResponsaveis}
                    placeholder={loadingResponsaveis ? "Carregando responsáveis..." : "Digite o nome..."}
                    className="mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-72 disabled:bg-gray-100"
                  />

                  {/* dropdown sugestões */}
                  {openSugestoes && !inputsDesabilitados && (sugestoes || []).length > 0 && (
                    <div className="absolute top-[64px] left-0 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10">
                      {(sugestoes || []).map(({ u, label }) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => selecionarResponsavel(u)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* hint de id setado */}
                  {!inputsDesabilitados && (
                    <div className="mt-1 text-[11px] text-gray-400">
                      {responsavelId ? "Responsável vinculado ✅" : "Sem vínculo (selecione pela lista)"}
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Vencimento</span>
                  <input
                    type="date"
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    disabled={inputsDesabilitados}
                    className="mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-40 disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">Observações</span>
                <textarea
                  className="mt-1 w-full border border-gray-300 rounded-lg text-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                  rows={3}
                  value={obsAcao}
                  onChange={(e) => setObsAcao(e.target.value)}
                  disabled={inputsDesabilitados}
                  placeholder="Descreva detalhes da ação..."
                />
              </div>

              {/* Evidências da ação (existentes) */}
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">
                  Evidências (registro da ação)
                </span>

                {fotosAcao.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fotosAcao.map((url, idx) => (
                      <MiniaturaUrl key={`${url}-${idx}`} url={url} />
                    ))}
                  </div>
                )}

                {/* Anexar (IGUAL Copiloto: múltiplos tipos) */}
                {!inputsDesabilitados && (
                  <>
                    <label className="mt-2 inline-flex items-center gap-2 text-xs text-blue-700 cursor-pointer">
                      <UploadCloud size={16} />
                      <span>Anexar evidências da ação</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        className="hidden"
                        onChange={(e) =>
                          setNovosArquivosAcao(Array.from(e.target.files || []))
                        }
                      />
                    </label>

                    {previewsAcao.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[11px] font-semibold text-gray-400 uppercase mb-2">
                          Prévia (novos anexos)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {previewsAcao.map((p) => (
                            <MiniaturaArquivo key={p.id} preview={p} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {fotosAcao.length === 0 && previewsAcao.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Nenhuma evidência anexada à ação.</p>
                )}
              </div>
            </div>
          </div>

          {/* CONCLUSÃO */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Conclusão da ação</h3>
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase">
                  Observação do que foi realizado
                </span>
                <textarea
                  className="mt-1 w-full border border-gray-300 rounded-lg text-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                  rows={3}
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  disabled={inputsDesabilitados}
                  placeholder="Descreva o que foi feito para concluir a ação..."
                />
              </div>

              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase">
                  Evidências do que foi feito
                </span>

                {fotosConclusao.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fotosConclusao.map((url, idx) => (
                      <MiniaturaUrl key={`${url}-${idx}`} url={url} />
                    ))}
                  </div>
                )}

                {/* Anexar (IGUAL Copiloto: múltiplos tipos) */}
                {!inputsDesabilitados && (
                  <>
                    <label className="mt-2 inline-flex items-center gap-2 text-xs text-blue-700 cursor-pointer">
                      <UploadCloud size={16} />
                      <span>Anexar evidências da conclusão</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        className="hidden"
                        onChange={(e) =>
                          setNovosArquivosConclusao(Array.from(e.target.files || []))
                        }
                      />
                    </label>

                    {previewsConclusao.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[11px] font-semibold text-gray-400 uppercase mb-2">
                          Prévia (novos anexos)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {previewsConclusao.map((p) => (
                            <MiniaturaArquivo key={p.id} preview={p} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {fotosConclusao.length === 0 && previewsConclusao.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Nenhuma evidência vinculada à conclusão.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between gap-4">
          <div className="flex flex-col text-[11px] text-gray-500">
            <span>
              Para finalizar, é obrigatório informar a conclusão e anexar evidências de conclusão.
            </span>
            <button
              onClick={handleSalvar}
              disabled={saving || inputsDesabilitados}
              className="mt-1 self-start px-4 py-1.5 rounded-md text-xs font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {statusLocal === "Concluída" && (
              <button
                onClick={handleReabrir}
                disabled={reabrindo}
                className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-60"
              >
                <RotateCw size={16} />
                {reabrindo ? "Reabrindo..." : "Reabrir ação"}
              </button>
            )}

            <button
              onClick={handleExcluir}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-60"
            >
              <Trash2 size={16} />
              {deleting ? "Excluindo..." : "Excluir ação"}
            </button>

            {statusLocal === "Concluída" ? (
              <span className="text-xs font-semibold text-green-600 ml-2">
                Ação já finalizada.
              </span>
            ) : (
              <button
                onClick={handleFinalizarClick}
                disabled={!podeConcluirLocal || saving || deleting}
                className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                  podeConcluirLocal && !saving && !deleting
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                <CheckCircle size={16} />
                Finalizar ação
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
   Miniaturas (IGUAL Copiloto)
========================= */
function MiniaturaArquivo({ preview }) {
  const { kind, url, name } = preview;

  const box =
    "w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center";
  const caption = "max-w-[64px] text-[9px] text-slate-600 truncate mt-1";

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

  if (kind === "video") {
    return (
      <div className="flex flex-col items-center" title={name}>
        <div className={box}>
          <video src={url} className="w-full h-full object-cover" muted playsInline />
        </div>
        <div className={caption}>{name}</div>
      </div>
    );
  }

  const Icon = kind === "pdf" ? FileText : FileIcon;

  const label =
    kind === "pdf"
      ? "PDF"
      : kind === "doc"
      ? "DOC"
      : kind === "xls"
      ? "XLS"
      : kind === "ppt"
      ? "PPT"
      : "ARQ";

  const labelClass =
    kind === "pdf"
      ? "text-red-600"
      : kind === "doc"
      ? "text-blue-700"
      : kind === "xls"
      ? "text-emerald-700"
      : kind === "ppt"
      ? "text-orange-700"
      : "text-slate-700";

  return (
    <div className="flex flex-col items-center" title={name}>
      <div className={box}>
        <div className="flex flex-col items-center justify-center">
          <div className={`text-[10px] font-black ${labelClass}`}>{label}</div>
          <Icon size={18} className="text-slate-500 mt-1" />
        </div>
      </div>
      <div className={caption}>{name}</div>
    </div>
  );
}

function MiniaturaUrl({ url }) {
  const kind = fileKindFromUrl(url);

  const box =
    "w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center hover:bg-slate-50";
  const caption = "max-w-[64px] text-[9px] text-slate-600 truncate mt-1";

  const name = (() => {
    try {
      const base = String(url).split("?")[0];
      return base.substring(base.lastIndexOf("/") + 1) || "arquivo";
    } catch {
      return "arquivo";
    }
  })();

  if (kind === "image") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col items-center"
        title={name}
      >
        <div className={box}>
          <img src={url} alt={name} className="w-full h-full object-cover" />
        </div>
        <div className={caption}>{name}</div>
      </a>
    );
  }

  const Icon = kind === "pdf" ? FileText : FileIcon;

  const label =
    kind === "pdf"
      ? "PDF"
      : kind === "doc"
      ? "DOC"
      : kind === "xls"
      ? "XLS"
      : kind === "ppt"
      ? "PPT"
      : "ARQ";

  const labelClass =
    kind === "pdf"
      ? "text-red-600"
      : kind === "doc"
      ? "text-blue-700"
      : kind === "xls"
      ? "text-emerald-700"
      : kind === "ppt"
      ? "text-orange-700"
      : "text-slate-700";

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col items-center"
      title={name}
    >
      <div className={box}>
        <div className="flex flex-col items-center justify-center">
          <div className={`text-[10px] font-black ${labelClass}`}>{label}</div>
          <Icon size={18} className="text-slate-500 mt-1" />
        </div>
      </div>
      <div className={caption}>{name}</div>
    </a>
  );
}

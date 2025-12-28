// src/components/tatico/ModalDetalhesAcao.jsx
import React, { useEffect, useState } from "react";
import { CheckCircle, X, Trash2, UploadCloud } from "lucide-react";
import { supabase } from "../../supabaseClient";

const ModalDetalhesAcao = ({
  aberto,
  acao,
  status,
  // podeConcluir,  // agora ignoramos esse valor externo
  onClose,
  onConcluir,
  onAfterSave,
  onAfterDelete,
}) => {
  if (!aberto || !acao) return null;

  // ---------------------------------------------------------------------------
  // ESTADOS LOCAIS (edição)
  // ---------------------------------------------------------------------------
  const [obsAcao, setObsAcao] = useState("");
  const [resultado, setResultado] = useState("");
  const [fotosAcao, setFotosAcao] = useState([]);
  const [fotosConclusao, setFotosConclusao] = useState([]);

  const [novosArquivosAcao, setNovosArquivosAcao] = useState([]);
  const [novosArquivosConclusao, setNovosArquivosConclusao] = useState([]);

  // Novos: edição de responsável e vencimento
  const [responsavel, setResponsavel] = useState("");
  const [vencimento, setVencimento] = useState(""); // YYYY-MM-DD

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Quando abrir ou trocar a ação, sincroniza o estado local
  useEffect(() => {
    if (!acao || !aberto) return;

    setObsAcao(acao.observacao || "");
    setResultado(acao.resultado || "");

    const baseAcao = Array.isArray(acao.fotos_acao)
      ? acao.fotos_acao
      : Array.isArray(acao.fotos)
      ? acao.fotos
      : [];

    const baseConclusao = Array.isArray(acao.fotos_conclusao)
      ? acao.fotos_conclusao
      : [];

    setFotosAcao(baseAcao);
    setFotosConclusao(baseConclusao);
    setNovosArquivosAcao([]);
    setNovosArquivosConclusao([]);

    // Responsável
    setResponsavel(acao.responsavel || "");

    // Vencimento -> string yyyy-mm-dd
    if (acao.data_vencimento) {
      const d = new Date(acao.data_vencimento);
      setVencimento(d.toISOString().split("T")[0]);
    } else {
      setVencimento("");
    }
  }, [acao, aberto]);

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  const uploadArquivos = async (files) => {
    const urls = [];
    for (const file of files) {
      const fileName = `acao-${acao.id}-${Date.now()}-${file.name.replace(
        /[^a-zA-Z0-9.]/g,
        ""
      )}`;
      const { data, error } = await supabase.storage
        .from("evidencias")
        .upload(fileName, file);

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("evidencias")
          .getPublicUrl(fileName);
        urls.push(urlData.publicUrl);
      } else {
        console.error("Erro upload evidência:", error);
      }
    }
    return urls;
  };

  const handleSalvar = async () => {
    if (!acao) return;
    setSaving(true);
    try {
      const novasUrlsAcao =
        novosArquivosAcao.length > 0
          ? await uploadArquivos(novosArquivosAcao)
          : [];
      const novasUrlsConclusao =
        novosArquivosConclusao.length > 0
          ? await uploadArquivos(novosArquivosConclusao)
          : [];

      const payload = {
        observacao: obsAcao,
        resultado,
        fotos_acao: [...fotosAcao, ...novasUrlsAcao],
        fotos_conclusao: [...fotosConclusao, ...novasUrlsConclusao],
        responsavel: responsavel || null,
        data_vencimento: vencimento || null,
      };

      // Compatibilidade: se a tabela ainda usa só "fotos"
      if (!acao.fotos_acao && !acao.fotos_conclusao) {
        payload.fotos = payload.fotos_acao;
      }

      const { error } = await supabase
        .from("acoes")
        .update(payload)
        .eq("id", acao.id);

      if (error) throw error;

      setFotosAcao(payload.fotos_acao);
      setFotosConclusao(payload.fotos_conclusao);
      setNovosArquivosAcao([]);
      setNovosArquivosConclusao([]);

      if (typeof onAfterSave === "function") onAfterSave(acao.id);
    } catch (err) {
      alert("Erro ao salvar alterações da ação: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    if (!acao) return;
    const senha = window.prompt(
      "Para excluir a ação, digite a senha de autorização:"
    );

    if (senha === null) return;
    if (senha !== "Excluir") {
      alert("Senha incorreta. A ação não será excluída.");
      return;
    }

    if (!window.confirm("Tem certeza que deseja excluir esta ação?")) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("acoes")
        .delete()
        .eq("id", acao.id);

      if (error) throw error;

      if (typeof onAfterDelete === "function") onAfterDelete(acao.id);
      onClose();
    } catch (err) {
      alert("Erro ao excluir ação: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Regra local para poder concluir:
  // – status != Concluída
  // – há texto de conclusão
  // – há pelo menos 1 evidência de conclusão (já salva ou nova)
  const podeConcluirLocal =
    status !== "Concluída" &&
    resultado.trim().length > 0 &&
    (fotosConclusao.length + novosArquivosConclusao.length) > 0;

  // Agora ignoramos o boolean externo e usamos apenas o estado atual do popup
  const podeConcluirFinal = podeConcluirLocal;

  const handleFinalizarClick = async () => {
    if (!podeConcluirLocal) {
      alert(
        "Para finalizar, registre o que foi realizado e anexe pelo menos uma evidência de conclusão."
      );
      return;
    }

    // Primeiro salva o que está no popup
    await handleSalvar();

    // Depois marca como concluída
    if (typeof onConcluir === "function") onConcluir();
  };

  const dataCriacao =
    acao.data_criacao || acao.created_at
      ? new Date(acao.data_criacao || acao.created_at).toLocaleString()
      : "-";

  const dataVencimentoLabel = vencimento
    ? new Date(vencimento).toLocaleDateString()
    : "-";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-400">
              Detalhes da ação
            </div>
            <div className="text-sm sm:text-base font-semibold text-gray-800 truncate max-w-xl">
              {acao.descricao}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6 bg-gray-50">
          {/* AÇÃO */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
              Ação
            </h3>
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              {/* Linha de status / criação / vencimento / responsável (legível) */}
              <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-600">
                <span>
                  <strong className="font-semibold">Status:</strong> {status}
                </span>
                <span>
                  <strong className="font-semibold">Criação:</strong>{" "}
                  {dataCriacao}
                </span>
                <span>
                  <strong className="font-semibold">Vencimento:</strong>{" "}
                  {dataVencimentoLabel}
                </span>
                <span>
                  <strong className="font-semibold">Responsável:</strong>{" "}
                  {responsavel || "-"}
                </span>
              </div>

              {/* Inputs de edição de responsável e vencimento */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs sm:text-sm">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">
                    Responsável
                  </span>
                  <input
                    type="text"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    className="mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-56"
                    placeholder="Nome do responsável"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">
                    Vencimento
                  </span>
                  <input
                    type="date"
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    className="mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 w-40"
                  />
                </div>
              </div>

              {/* Observações da ação */}
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">
                  Observações
                </span>
                <textarea
                  className="mt-1 w-full border border-gray-300 rounded-lg text-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  rows={3}
                  value={obsAcao}
                  onChange={(e) => setObsAcao(e.target.value)}
                  placeholder="Descreva detalhes da ação..."
                />
              </div>

              {/* Evidências da ação */}
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">
                  Evidências (registro da ação)
                </span>

                {fotosAcao.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fotosAcao.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-16 h-16 rounded-md overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-100 hover:border-blue-400"
                        title={`Abrir evidência ${idx + 1}`}
                      >
                        <img
                          src={url}
                          alt={`Evidência ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}

                <label className="mt-2 inline-flex items-center gap-2 text-xs text-blue-700 cursor-pointer">
                  <UploadCloud size={16} />
                  <span>Anexar evidências da ação</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      setNovosArquivosAcao(Array.from(e.target.files || []))
                    }
                  />
                </label>
                {novosArquivosAcao.length > 0 && (
                  <div className="mt-1 text-[11px] text-gray-500">
                    {novosArquivosAcao.length} arquivo(s) novo(s) selecionado(s)
                    para a ação.
                  </div>
                )}

                {fotosAcao.length === 0 && novosArquivosAcao.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Nenhuma evidência anexada à ação.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* CONCLUSÃO */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
              Conclusão da ação
            </h3>
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase">
                  Observação do que foi realizado
                </span>
                <textarea
                  className="mt-1 w-full border border-gray-300 rounded-lg text-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  rows={3}
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
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
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-16 h-16 rounded-md overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-100 hover:border-blue-400"
                        title={`Abrir evidência de conclusão ${idx + 1}`}
                      >
                        <img
                          src={url}
                          alt={`Evidência de conclusão ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}

                <label className="mt-2 inline-flex items-center gap-2 text-xs text-blue-700 cursor-pointer">
                  <UploadCloud size={16} />
                  <span>Anexar evidências da conclusão</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      setNovosArquivosConclusao(
                        Array.from(e.target.files || [])
                      )
                    }
                  />
                </label>
                {novosArquivosConclusao.length > 0 && (
                  <div className="mt-1 text-[11px] text-gray-500">
                    {novosArquivosConclusao.length} arquivo(s) novo(s)
                    selecionado(s) para a conclusão.
                  </div>
                )}

                {fotosConclusao.length === 0 &&
                  novosArquivosConclusao.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Nenhuma evidência vinculada à conclusão.
                    </p>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between gap-4">
          <div className="flex flex-col text-[11px] text-gray-500">
            <span>
              Para finalizar, é obrigatório informar a conclusão e anexar
              evidências de conclusão.
            </span>
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="mt-1 self-start px-4 py-1.5 rounded-md text-xs font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExcluir}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-60"
            >
              <Trash2 size={16} />
              {deleting ? "Excluindo..." : "Excluir ação"}
            </button>

            {status === "Concluída" ? (
              <span className="text-xs font-semibold text-green-600 ml-2">
                Ação já finalizada.
              </span>
            ) : (
              <button
                onClick={handleFinalizarClick}
                disabled={!podeConcluirFinal || saving || deleting}
                className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                  podeConcluirFinal && !saving && !deleting
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

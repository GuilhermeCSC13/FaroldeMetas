// src/components/tatico/ModalDetalhesAcao.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  X,
  Trash2,
  UploadCloud,
  RotateCw,
  FileText,
  File as FileIcon,
} from "lucide-react";
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

  const [statusLocal, setStatusLocal] = useState(status || acao.status || "Aberta");
  const [obsAcao, setObsAcao] = useState("");
  const [resultado, setResultado] = useState("");
  const [fotosAcao, setFotosAcao] = useState([]);
  const [fotosConclusao, setFotosConclusao] = useState([]);
  const [novosArquivosAcao, setNovosArquivosAcao] = useState([]);
  const [novosArquivosConclusao, setNovosArquivosConclusao] = useState([]);

  const [responsavelTexto, setResponsavelTexto] = useState("");
  const [responsavelId, setResponsavelId] = useState(null);
  const [listaResponsaveis, setListaResponsaveis] = useState([]);
  const [openSugestoes, setOpenSugestoes] = useState(false);

  const [vencimento, setVencimento] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);

  /* =========================
     INIT
  ========================= */
  useEffect(() => {
    if (!acao || !aberto) return;

    setStatusLocal(status || acao.status || "Aberta");
    setObsAcao(acao.observacao || "");
    setResultado(acao.resultado || "");

    setFotosAcao(Array.isArray(acao.fotos_acao) ? acao.fotos_acao : []);
    setFotosConclusao(Array.isArray(acao.fotos_conclusao) ? acao.fotos_conclusao : []);

    setResponsavelTexto(acao.responsavel_nome || "");
    setResponsavelId(null);

    if (acao.data_vencimento) {
      setVencimento(new Date(acao.data_vencimento).toISOString().split("T")[0]);
    } else {
      setVencimento("");
    }

    supabaseInove
      .from("usuarios_aprovadores")
      .select("id, nome, sobrenome, nome_completo")
      .eq("ativo", true)
      .then(({ data }) => setListaResponsaveis(data || []));
  }, [acao, aberto, status]);

  /* =========================
     Upload
  ========================= */
  const uploadArquivos = async (files) => {
    const urls = [];
    for (const file of files) {
      const name = `acao-${acao.id}-${Date.now()}-${sanitizeFileName(file.name)}`;
      await supabase.storage.from("evidencias").upload(name, file);
      const { data } = supabase.storage.from("evidencias").getPublicUrl(name);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    return urls;
  };

  /* =========================
     Salvar
  ========================= */
  const handleSalvar = async () => {
    setSaving(true);
    try {
      const novasA = await uploadArquivos(novosArquivosAcao);
      const novasC = await uploadArquivos(novosArquivosConclusao);

      await supabase.from("acoes").update({
        observacao: obsAcao,
        resultado,
        fotos_acao: [...fotosAcao, ...novasA],
        fotos_conclusao: [...fotosConclusao, ...novasC],

        // 🚫 nunca gravar texto em UUID
        responsavel_id: null,
        responsavel_nome: responsavelTexto || null,

        data_vencimento: vencimento || null,
      }).eq("id", acao.id);

      if (onAfterSave) onAfterSave(acao.id);
    } catch (err) {
      alert("Erro ao salvar ação: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     Finalizar
  ========================= */
  const handleFinalizarClick = async () => {
    if (!resultado.trim() || fotosConclusao.length + novosArquivosConclusao.length === 0) {
      alert("Informe a conclusão e anexe evidências.");
      return;
    }

    const usuario = JSON.parse(
      localStorage.getItem("inove_login") ||
        sessionStorage.getItem("inove_login") ||
        "{}"
    );

    const nomeUsuario =
      usuario?.nome_completo ||
      `${usuario?.nome || ""} ${usuario?.sobrenome || ""}`.trim();

    setSaving(true);
    try {
      await handleSalvar();
      await supabase.from("acoes").update({
        status: "Concluída",
        fechado_por_nome: nomeUsuario || null,
        data_fechamento: new Date().toISOString(),
      }).eq("id", acao.id);

      setStatusLocal("Concluída");
      if (onConcluir) onConcluir();
    } catch (err) {
      alert("Erro ao finalizar ação: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     Datas
  ========================= */
  const criadoLabel = acao.criado_por_nome
    ? `${acao.criado_por_nome} • ${new Date(acao.data_criacao || acao.created_at).toLocaleString("pt-BR")}`
    : "-";

  const fechadoLabel =
    statusLocal === "Concluída"
      ? `${acao.fechado_por_nome || "-"} • ${
          acao.data_fechamento
            ? new Date(acao.data_fechamento).toLocaleString("pt-BR")
            : "-"
        }`
      : null;

  /* =========================
     Render
  ========================= */
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-xl flex flex-col max-h-[90vh]">
        <header className="p-4 border-b flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase">Detalhes da ação</div>
            <div className="font-semibold">{acao.descricao}</div>
          </div>
          <button onClick={onClose}><X /></button>
        </header>

        <div className="p-4 space-y-4 overflow-y-auto bg-gray-50">
          <div className="text-sm text-gray-600 flex flex-wrap gap-4">
            <span><b>Status:</b> {statusLocal}</span>
            <span><b>Criado:</b> {criadoLabel}</span>
            {fechadoLabel && <span><b>Fechado:</b> {fechadoLabel}</span>}
          </div>

          {/* CONCLUSÃO */}
          <div>
            <h3 className="text-xs font-bold uppercase text-gray-500">Conclusão</h3>

            <textarea
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              disabled={statusLocal === "Concluída"}
              className="w-full mt-2 border rounded-lg p-2 text-sm"
              rows={3}
              placeholder="Descreva o que foi feito..."
            />

            {/* Anexo bonito */}
            {statusLocal !== "Concluída" && (
              <label className="mt-3 flex items-center justify-center gap-2 border border-dashed border-green-400 rounded-lg px-4 py-3 text-sm text-green-700 cursor-pointer hover:bg-green-50">
                <UploadCloud size={18} />
                <span className="font-semibold">Adicionar evidências da conclusão</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    setNovosArquivosConclusao(Array.from(e.target.files || []))
                  }
                />
              </label>
            )}
          </div>
        </div>

        <footer className="p-4 border-t flex justify-end gap-2">
          <button onClick={handleSalvar} disabled={saving}
            className="px-4 py-2 text-sm border rounded-lg">
            Salvar
          </button>

          {statusLocal !== "Concluída" && (
            <button onClick={handleFinalizarClick}
              className="px-4 py-2 bg-green-600 text-white rounded-lg flex gap-2">
              <CheckCircle size={16} />
              Finalizar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default ModalDetalhesAcao;

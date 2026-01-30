// src/pages/CentralAtas.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import { getGeminiFlash } from "../services/gemini";
import ModalDetalhesAcao from "../components/tatico/ModalDetalhesAcao"; // ✅ Importado
import {
  Calendar,
  User,
  Search,
  CheckCircle,
  Layers,
  Save,
  Edit3,
  Trash2,
  Plus,
  PlayCircle,
  Headphones,
  ExternalLink,
  MessageSquare,
  Cpu,
  Loader2,
  Clock,
  ImageIcon
} from "lucide-react";

export default function CentralAtas() {
  const [atas, setAtas] = useState([]);
  const [selectedAta, setSelectedAta] = useState(null);
  const [busca, setBusca] = useState("");

  // URLs geradas (signed/public)
  const [mediaUrls, setMediaUrls] = useState({ video: null, audio: null });

  // Dados da Ata
  const [acoesCriadas, setAcoesCriadas] = useState([]);
  const [acoesAnteriores, setAcoesAnteriores] = useState([]);
  const [observacoes, setObservacoes] = useState("");

  // Estados de Interface
  const [isEditing, setIsEditing] = useState(false);
  const [editedPauta, setEditedPauta] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // --- MODAL DE AÇÃO (INTEGRADO) ---
  const [acaoParaModal, setAcaoParaModal] = useState(null);

  // --- POLLING REF ---
  const pollingRef = useRef(null);

  useEffect(() => {
    fetchAtas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedAta) {
      carregarDetalhes(selectedAta);
      setEditedPauta(selectedAta.pauta || "");
      setObservacoes(selectedAta.observacoes || "");
      setIsEditing(false);

      hydrateMediaUrls(selectedAta);
      
      // ✅ Inicia monitoramento automático se necessário
      checkAutoRefresh(selectedAta);
    } else {
      setMediaUrls({ video: null, audio: null });
      stopPolling();
    }

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAta?.id]); 
  // Nota: dependência apenas no ID para não resetar poll a cada update pequeno, 
  // mas o checkAutoRefresh cuida de parar se concluir.

  // =========================
  // ✅ Polling Automático (Substitui botões manuais)
  // =========================
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const checkAutoRefresh = (ata) => {
    stopPolling();
    const stGravacao = String(ata.gravacao_status || "").toUpperCase();
    const stAtaIa = String(ata.ata_ia_status || "").toUpperCase();

    // Se algum estiver processando ou pendente, inicia polling
    const precisaAtualizar = 
      (stGravacao === "PROCESSANDO" || stGravacao === "PENDENTE") ||
      (stAtaIa === "PROCESSANDO" || stAtaIa === "PENDENTE");

    if (precisaAtualizar) {
      pollingRef.current = setInterval(() => {
        refreshSelectedAta(ata.id);
      }, 5000); // 5 segundos
    }
  };

  const refreshSelectedAta = async (id) => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("reunioes")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        // Atualiza estado local mantendo seleção
        setSelectedAta(prev => (prev?.id === data.id ? { ...prev, ...data } : data));
        setAtas(prev => prev.map(r => r.id === data.id ? { ...r, ...data } : r));
        
        // Verifica se ainda precisa continuar polling
        const stGravacao = String(data.gravacao_status || "").toUpperCase();
        const stAtaIa = String(data.ata_ia_status || "").toUpperCase();
        const aindaProcessando = 
            (stGravacao === "PROCESSANDO" || stGravacao === "PENDENTE") ||
            (stAtaIa === "PROCESSANDO" || stAtaIa === "PENDENTE");
            
        if (!aindaProcessando) {
             stopPolling();
             hydrateMediaUrls(data); // atualiza video se ficou pronto
        }
      }
    } catch (e) {
      console.error("Erro polling:", e);
    }
  };

  // =========================
  // ✅ helpers: signed urls
  // =========================
  const getSignedOrPublicUrl = async (bucket, filePath, expiresInSec = 60 * 60) => {
    if (!bucket || !filePath) return null;
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresInSec);
    if (signed?.signedUrl) return signed.signedUrl;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return pub?.publicUrl || null;
  };

  const hydrateMediaUrls = async (ata) => {
    try {
      const videoUrl = await getSignedOrPublicUrl(ata.gravacao_bucket, ata.gravacao_path);
      const audioUrl = await getSignedOrPublicUrl(
        ata.gravacao_audio_bucket || ata.gravacao_bucket,
        ata.gravacao_audio_path
      );
      setMediaUrls({ video: videoUrl, audio: audioUrl });
    } catch (e) {
      console.error("Erro URLs:", e);
    }
  };

  // =========================
  // ✅ Dados principais
  // =========================
  const fetchAtas = async () => {
    const { data, error } = await supabase
      .from("reunioes")
      .select("*")
      .eq("status", "Realizada")
      .order("data_hora", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    setAtas(data || []);
    if (data && data.length > 0 && !selectedAta) setSelectedAta(data[0]);
  };

  const carregarDetalhes = async (ata) => {
    // 1) Ações desta reunião
    const { data: criadas } = await supabase
      .from("acoes")
      .select("*")
      .eq("reuniao_id", ata.id)
      .order("data_criacao", { ascending: false });
    setAcoesCriadas(criadas || []);

    // 2) Pendências Anteriores (mesmo TÍTULO)
    try {
      const tituloBase = (ata.titulo || "").trim();
      if (!tituloBase) {
        setAcoesAnteriores([]);
        return;
      }
      const { data: reunioesAnt } = await supabase
        .from("reunioes")
        .select("id")
        .eq("titulo", tituloBase)
        .neq("id", ata.id)
        .lt("data_hora", ata.data_hora)
        .order("data_hora", { ascending: false })
        .limit(20);

      const listaIds = (reunioesAnt || []).map((r) => r.id);
      if (!listaIds.length) {
        setAcoesAnteriores([]);
        return;
      }

      const { data: anteriores } = await supabase
        .from("acoes")
        .select("*")
        .in("reuniao_id", listaIds)
        .eq("status", "Aberta");

      setAcoesAnteriores(anteriores || []);
    } catch (err) {
      setAcoesAnteriores([]);
    }
  };

  // =========================
  // ✅ Lógica Nova Ação -> Modal
  // =========================
  const handleNovaAcao = async () => {
      if (!selectedAta?.id) return;
      
      // Cria um rascunho
      const { data, error } = await supabase.from('acoes').insert([{
          reuniao_id: selectedAta.id,
          status: 'Aberta',
          descricao: 'Nova Ação', // placeholder
          data_criacao: new Date().toISOString()
      }]).select().single();

      if (error) {
          alert("Erro ao iniciar ação: " + error.message);
          return;
      }

      // Abre o modal com o rascunho
      setAcaoParaModal(data);
  };

  // =========================
  // --- OUTRAS FUNÇÕES ---
  // =========================
  const handleSaveAta = async () => {
    const { error } = await supabase.from("reunioes").update({ pauta: editedPauta, observacoes }).eq("id", selectedAta.id);
    if (!error) {
      setIsEditing(false);
      setSelectedAta((prev) => ({ ...prev, pauta: editedPauta, observacoes }));
      setAtas((prev) => prev.map((a) => (a.id === selectedAta.id ? { ...a, pauta: editedPauta, observacoes } : a)));
      alert("Ata salva com sucesso!");
    } else {
      alert("Erro ao salvar ata: " + error.message);
    }
  };

  const handleRegenerateIA = async () => {
    const audioUrl = mediaUrls.audio;
    if (!audioUrl || !window.confirm("Gerar novo resumo a partir do áudio?")) return;

    setIsGenerating(true);
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error("Falha ao baixar o áudio.");

      const blob = await response.blob();
      const reader = new FileReader();

      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64data = reader.result.split(",")[1];
          const model = getGeminiFlash();
          const titulo = selectedAta.titulo || "Ata da Reunião";
          const dataBR = selectedAta.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString("pt-BR") : "";

          const prompt = `
Você é secretária de reunião e deve gerar a ATA em Markdown usando SOMENTE o conteúdo real do áudio enviado.
Contexto: "${titulo}" - ${dataBR}.

Gere a ata NO MÁXIMO com a seguinte estrutura:
# ${titulo}
**Data:** ${dataBR}

## 1. Resumo
(Resumo fiel do que foi discutido)

## 2. Decisões
- Decisão 1...

## 3. Ações
- Ação — Responsável — Prazo

Preencha cada seção somente com o que estiver claramente no áudio.
          `.trim();

          const result = await model.generateContent([prompt, { inlineData: { data: base64data, mimeType: "audio/webm" } }]);
          const texto = result.response.text();

          setEditedPauta(texto);
          setIsEditing(true);
          alert("Resumo gerado. Revise e Salve.");
        } catch (err) {
          alert("Erro na IA: " + err.message);
        } finally {
          setIsGenerating(false);
        }
      };
    } catch (e) {
      alert("Erro áudio: " + e.message);
      setIsGenerating(false);
    }
  };

  const handleDeleteAta = async () => {
    const senha = window.prompt("Senha para excluir:");
    if (senha === "excluir") {
      await supabase.from("reunioes").delete().eq("id", selectedAta.id);
      window.location.reload();
    }
  };

  // ✅ Busca por Título, Data ou Tipo
  const atasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase();
    return atas.filter((a) => {
        const titulo = (a.titulo || "").toLowerCase();
        const tipo = (a.tipo_reuniao || "").toLowerCase();
        const data = a.data_hora ? new Date(a.data_hora).toLocaleDateString("pt-BR") : "";
        
        return titulo.includes(termo) || tipo.includes(termo) || data.includes(termo);
    });
  }, [atas, busca]);

  const iaStatusNorm = String(selectedAta?.ata_ia_status || "").toUpperCase();
  const badgeClass = (tone) =>
    ({
      green: "bg-green-100 text-green-700 border-green-200",
      blue: "bg-blue-100 text-blue-700 border-blue-200",
      red: "bg-red-100 text-red-700 border-red-200",
      gray: "bg-slate-100 text-slate-700 border-slate-200",
    }[tone] || "bg-slate-100 text-slate-700 border-slate-200");

  return (
    <Layout>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Layers className="text-blue-600" size={20} /> Banco de Atas
            </h2>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2"
                placeholder="Título, Data ou Tipo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {atasFiltradas.map((ata) => (
              <button
                key={ata.id}
                onClick={() => setSelectedAta(ata)}
                className={`w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex flex-col gap-1 ${
                  selectedAta?.id === ata.id ? "bg-blue-50 border-l-4 border-l-blue-600" : "border-l-4 border-l-transparent"
                }`}
              >
                <h3 className={`font-bold text-sm ${selectedAta?.id === ata.id ? "text-blue-800" : "text-slate-700"}`}>{ata.titulo}</h3>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar size={12} /> {ata.data_hora ? new Date(ata.data_hora).toLocaleDateString() : "-"}
                  {ata.tipo_reuniao && <span className="text-[10px] bg-slate-100 px-1 rounded ml-1">{ata.tipo_reuniao}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 custom-scrollbar relative">
          {selectedAta ? (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* HEADER ATA */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-2 block flex items-center gap-1">
                      <CheckCircle size={14} /> Ata Oficial
                    </span>

                    {/* STATUS IA AUTOMÁTICO */}
                    {selectedAta.ata_ia_status && (
                      <div className="mb-2">
                        <span
                          className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase border flex items-center gap-1 w-fit ${
                            iaStatusNorm === "PRONTO" || iaStatusNorm === "PRONTA"
                              ? badgeClass("green")
                              : iaStatusNorm === "PROCESSANDO" || iaStatusNorm === "PENDENTE"
                              ? badgeClass("blue")
                              : iaStatusNorm === "ERRO"
                              ? badgeClass("red")
                              : badgeClass("gray")
                          }`}
                        >
                          {(iaStatusNorm === "PROCESSANDO" || iaStatusNorm === "PENDENTE") && <Loader2 size={10} className="animate-spin" />}
                          IA: {selectedAta.ata_ia_status}
                        </span>
                        {iaStatusNorm === "ERRO" && selectedAta.ata_ia_erro && (
                          <p className="text-xs text-red-600 mt-2">{selectedAta.ata_ia_erro}</p>
                        )}
                      </div>
                    )}

                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedAta.titulo}</h1>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={16} />{" "}
                        {selectedAta.data_hora ? new Date(selectedAta.data_hora).toLocaleDateString() : "-"}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={16} /> {selectedAta.responsavel || "IA"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isEditing ? (
                      <button
                        onClick={handleSaveAta}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg"
                      >
                        <Save size={18} /> Salvar
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="p-2 text-slate-400 hover:text-blue-600 rounded-lg bg-slate-50"
                          title="Editar"
                        >
                          <Edit3 size={20} />
                        </button>
                        <button
                          onClick={handleDeleteAta}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg bg-slate-50"
                          title="Excluir"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* VÍDEO COMPILADO */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <PlayCircle size={14} /> Gravação Compilada
                  </div>

                  {mediaUrls.video ? (
                    <div className="space-y-2">
                      <video controls className="w-full rounded-xl bg-black">
                        <source src={mediaUrls.video} type="video/webm" />
                        Seu navegador não conseguiu reproduzir este vídeo.
                      </video>
                      <a
                        href={mediaUrls.video}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-bold text-blue-700"
                      >
                        <ExternalLink size={14} />
                        Abrir vídeo em nova aba
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2">
                      {String(selectedAta.gravacao_status || "").toUpperCase().includes("PROCESSANDO") 
                        ? <><Loader2 size={14} className="animate-spin text-blue-500" /> Processando vídeo...</>
                        : "Vídeo não disponível ainda."
                      }
                    </div>
                  )}
                </div>

                {/* ÁUDIO */}
                <div className="mb-6 flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="p-2 bg-white rounded-full text-blue-500 shadow-sm">
                    <Headphones size={20} />
                  </div>
                  <div className="flex-1">
                    {mediaUrls.audio ? (
                      <audio controls className="w-full h-8">
                        <source src={mediaUrls.audio} type="audio/webm" />
                        Seu navegador não conseguiu reproduzir este áudio.
                      </audio>
                    ) : (
                      <span className="text-xs text-slate-400">Sem áudio.</span>
                    )}
                  </div>

                  {mediaUrls.audio && !isEditing && (
                    <button
                      onClick={handleRegenerateIA}
                      disabled={isGenerating}
                      className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-bold flex gap-1 disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
                      Gerar Resumo IA
                    </button>
                  )}
                </div>

                <div className="prose prose-slate max-w-none">
                  {isEditing ? (
                    <textarea
                      className="w-full h-64 p-4 border rounded-xl bg-slate-50 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editedPauta}
                      onChange={(e) => setEditedPauta(e.target.value)}
                    />
                  ) : (
                    <div className="text-slate-700 text-sm whitespace-pre-line leading-relaxed">
                      {selectedAta.pauta || "Sem resumo."}
                    </div>
                  )}
                </div>
              </div>

              {/* GRID AÇÕES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* COLUNA 1 */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div> Ações Definidas
                    </h3>
                    <button
                      onClick={handleNovaAcao}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md transition-all active:scale-95"
                    >
                      <Plus size={14} /> Nova Ação
                    </button>
                  </div>

                  <div className="flex-1 space-y-2">
                    {acoesCriadas.map((acao) => (
                      <div
                        key={acao.id}
                        onClick={() => setAcaoParaModal(acao)}
                        className={`p-3 border rounded-lg cursor-pointer hover:shadow-md transition-all group ${
                          acao.status === "Concluída"
                            ? "bg-slate-50 opacity-60"
                            : "bg-white border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                            <div className={`mt-1.5 w-2 h-2 rounded-full ${acao.status === "Concluída" ? "bg-green-500" : "bg-blue-500"}`} />
                          <div className="flex-1">
                            <p
                              className={`text-sm font-medium ${
                                acao.status === "Concluída" ? "line-through text-slate-400" : "text-slate-800"
                              }`}
                            >
                              {acao.descricao}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <User size={10} /> {acao.responsavel}
                              </span>
                              {acao.data_vencimento && (
                                <span className="text-[10px] text-red-500 flex items-center gap-1">
                                  <Clock size={10} /> {new Date(acao.data_vencimento).toLocaleDateString()}
                                </span>
                              )}
                              {acao.fotos && acao.fotos.length > 0 && (
                                <span className="text-[10px] text-blue-500 flex items-center gap-1">
                                  <ImageIcon size={10} /> {acao.fotos.length}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {acoesCriadas.length === 0 && (
                      <p className="text-center text-xs text-slate-400 py-4 italic">Nenhuma ação criada.</p>
                    )}
                  </div>
                </div>

                {/* COLUNA 2 */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div> Pendências Anteriores
                  </h3>
                  <div className="flex-1 space-y-2">
                    {acoesAnteriores.map((acao) => (
                      <div
                        key={acao.id}
                        onClick={() => setAcaoParaModal(acao)}
                        className="p-3 bg-amber-50/30 border border-amber-100 rounded-lg cursor-pointer hover:bg-amber-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1.5 w-2 h-2 rounded-full bg-amber-500`} />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{acao.descricao}</p>
                            <p className="text-[10px] text-amber-600 mt-1">
                              Origem: {acao.data_criacao ? new Date(acao.data_criacao).toLocaleDateString() : "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {acoesAnteriores.length === 0 && (
                      <p className="text-center text-xs text-slate-400 py-4 italic">Tudo em dia!</p>
                    )}
                  </div>
                </div>
              </div>

              {/* OBSERVAÇÕES */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <Edit3 size={18} /> Observações Gerais
                </h3>
                <textarea
                  className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  disabled={!isEditing}
                  placeholder="Notas manuais da reunião..."
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Layers size={64} className="opacity-20 mb-4" />
              <p>Selecione uma Ata</p>
            </div>
          )}
        </div>

        {/* MODAL DE AÇÃO INTEGRADO */}
        {acaoParaModal && (
          <ModalDetalhesAcao
            aberto={!!acaoParaModal}
            acao={acaoParaModal}
            status={acaoParaModal.status}
            onClose={() => setAcaoParaModal(null)}
            onAfterSave={() => carregarDetalhes(selectedAta)}
            onAfterDelete={() => carregarDetalhes(selectedAta)}
            onConcluir={async () => {
                await supabase.from("acoes").update({ status: "Concluída", data_conclusao: new Date().toISOString() }).eq("id", acaoParaModal.id);
                carregarDetalhes(selectedAta);
            }}
          />
        )}
      </div>
    </Layout>
  );
}

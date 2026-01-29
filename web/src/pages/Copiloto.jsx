import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import {
  Bot,
  Search,
  Calendar,
  Lock,
  FileText,
  ClipboardList,
  Plus,
  Save,
  X,
} from "lucide-react";
import { useRecording } from "../context/RecordingContext";

/* =========================
   Helpers
========================= */
const nowIso = () => new Date().toISOString();

const toBR = (dt) => {
  try {
    return dt ? new Date(dt).toLocaleString("pt-BR") : "-";
  } catch {
    return "-";
  }
};

const secondsToMMSS = (s = 0) => {
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
};

/* =========================
   Card simples de ação
========================= */
function AcaoCard({ acao, onToggle }) {
  const concluida = acao.status === "Concluída";

  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={concluida}
          onChange={onToggle}
          className="mt-1 w-4 h-4"
        />
        <div className="flex-1">
          <div
            className={`text-sm font-semibold ${
              concluida
                ? "line-through text-slate-400"
                : "text-slate-900"
            }`}
          >
            {acao.descricao}
          </div>
          <div className="text-[12px] text-slate-600 mt-1">
            <b>Responsável:</b> {acao.responsavel || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Página
========================= */
export default function Copiloto() {
  const { isRecording, isProcessing, timer, startRecording, stopRecording, current } =
    useRecording();

  const [dataFiltro, setDataFiltro] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [busca, setBusca] = useState("");
  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);

  const [tab, setTab] = useState("ata"); // ata | acoes

  // Ata Manual
  const [ataManual, setAtaManual] = useState("");
  const [editAtaManual, setEditAtaManual] = useState(false);

  // Ata Principal (read-only)
  const [ataPrincipal, setAtaPrincipal] = useState("");

  // Ações
  const [acoesReuniao, setAcoesReuniao] = useState([]);
  const [acoesPendentesTipo, setAcoesPendentesTipo] = useState([]);
  const [acaoTab, setAcaoTab] = useState("reuniao"); // reuniao | backlog
  const [novaAcao, setNovaAcao] = useState({ descricao: "", responsavel: "" });
  const [loadingAcoes, setLoadingAcoes] = useState(false);

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    fetchReunioes();
    return () => (mounted.current = false);
  }, []);

  useEffect(() => {
    fetchReunioes();
  }, [dataFiltro]);

  useEffect(() => {
    if (!selecionada) return;
    carregarAtas(selecionada);
    fetchAcoes(selecionada);
    setTab("ata");
  }, [selecionada?.id]);

  /* =========================
     Fetch reuniões
  ========================= */
  const fetchReunioes = async () => {
    const { data, error } = await supabase
      .from("reunioes")
      .select("*")
      .gte("data_hora", `${dataFiltro}T00:00:00`)
      .lte("data_hora", `${dataFiltro}T23:59:59`)
      .order("data_hora");

    if (error) {
      console.error(error);
      return;
    }

    if (!mounted.current) return;
    setReunioes(data || []);

    if (isRecording && current?.reuniaoId) {
      const r = data.find((x) => x.id === current.reuniaoId);
      if (r) setSelecionada(r);
    }
  };

  /* =========================
     Atas
  ========================= */
  const carregarAtas = async (r) => {
    // Ata Manual
    setAtaManual(r.ata_manual || "");
    setEditAtaManual(false);

    // Ata Principal (vem do tipo)
    if (!r.tipo_reuniao_id) {
      setAtaPrincipal("");
      return;
    }

    const { data } = await supabase
      .from("tipos_reuniao")
      .select("ata_principal")
      .eq("id", r.tipo_reuniao_id)
      .single();

    setAtaPrincipal(data?.ata_principal || "");
  };

  const salvarAtaManual = async () => {
    if (!selecionada) return;

    const { error } = await supabase
      .from("reunioes")
      .update({ ata_manual: ataManual })
      .eq("id", selecionada.id);

    if (error) {
      alert("Erro ao salvar ata manual");
      return;
    }

    setEditAtaManual(false);
    fetchReunioes();
  };

  /* =========================
     Gravação
  ========================= */
  const onStart = async () => {
    if (!selecionada) return alert("Selecione uma reunião");
    if (isRecording) return;

    await startRecording({
      reuniaoId: selecionada.id,
      reuniaoTitulo: selecionada.titulo,
    });

    fetchReunioes();
  };

  const onStop = async () => {
    await stopRecording();
    fetchReunioes();
    fetchAcoes(selecionada);
  };

  /* =========================
     Ações
  ========================= */
  const fetchAcoes = async (r) => {
    if (!r?.id || !r?.tipo_reuniao_id) return;

    setLoadingAcoes(true);

    // Ações da reunião
    const { data: daReuniao } = await supabase
      .from("acoes")
      .select("*")
      .eq("reuniao_id", r.id)
      .order("data_criacao", { ascending: false });

    // Backlog pendente do tipo
    const { data: backlog } = await supabase
      .from("acoes")
      .select("*")
      .eq("tipo_reuniao_id", r.tipo_reuniao_id)
      .neq("status", "Concluída")
      .order("data_criacao", { ascending: false });

    if (!mounted.current) return;

    setAcoesReuniao(daReuniao || []);
    setAcoesPendentesTipo(
      (backlog || []).filter((a) => a.reuniao_id !== r.id)
    );
    setLoadingAcoes(false);
  };

  const criarAcao = async () => {
    if (!selecionada || !novaAcao.descricao.trim()) return;

    const payload = {
      descricao: novaAcao.descricao.trim(),
      responsavel: novaAcao.responsavel || null,
      status: "Aberta",
      reuniao_id: selecionada.id,
      tipo_reuniao_id: selecionada.tipo_reuniao_id,
      data_criacao: nowIso(),
    };

    const { data, error } = await supabase
      .from("acoes")
      .insert(payload)
      .select()
      .single();

    if (error) {
      alert("Erro ao criar ação");
      return;
    }

    setNovaAcao({ descricao: "", responsavel: "" });
    setAcoesReuniao((prev) => [data, ...prev]);
    setTab("acoes");
    setAcaoTab("reuniao");
  };

  const toggleAcao = async (acao) => {
    const novoStatus =
      acao.status === "Concluída" ? "Aberta" : "Concluída";

    await supabase
      .from("acoes")
      .update({
        status: novoStatus,
        data_conclusao: novoStatus === "Concluída" ? nowIso() : null,
      })
      .eq("id", acao.id);

    fetchAcoes(selecionada);
  };

  /* =========================
     UI helpers
  ========================= */
  const reunioesFiltradas = useMemo(() => {
    return reunioes.filter((r) =>
      (r.titulo || "").toLowerCase().includes(busca.toLowerCase())
    );
  }, [reunioes, busca]);

  /* =========================
     Render
  ========================= */
  return (
    <Layout>
      <div className="h-screen bg-[#f6f8fc] flex overflow-hidden">
        {/* COLUNA ESQUERDA */}
        <div className="w-[420px] bg-white border-r p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
              <Bot size={20} />
            </div>
            <h1 className="font-black text-lg">Copiloto de Reuniões</h1>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="flex-1 border rounded-xl px-3 py-2 text-xs"
            />
            <input
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 border rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto border rounded-2xl">
            {reunioesFiltradas.map((r) => (
              <button
                key={r.id}
                onClick={() => !isRecording && setSelecionada(r)}
                className={`w-full text-left p-4 border-b ${
                  selecionada?.id === r.id
                    ? "bg-blue-50 border-l-4 border-l-blue-600"
                    : ""
                }`}
              >
                <div className="font-bold text-xs">{r.titulo}</div>
                <div className="text-[11px] text-slate-500">
                  {toBR(r.data_hora)}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 p-4 border rounded-2xl flex justify-between">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">
                Tempo
              </div>
              <div className="font-mono font-black">
                {secondsToMMSS(timer)}
              </div>
            </div>

            {isProcessing ? (
              <div className="text-blue-600 font-bold text-xs">
                FINALIZANDO...
              </div>
            ) : isRecording ? (
              <button
                onClick={onStop}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black"
              >
                ENCERRAR
              </button>
            ) : (
              <button
                onClick={onStart}
                disabled={!selecionada}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black disabled:opacity-30"
              >
                INICIAR
              </button>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="flex-1 p-6 overflow-y-auto">
          {!selecionada ? (
            <div className="text-slate-600">
              Selecione uma reunião
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <Tab active={tab === "ata"} onClick={() => setTab("ata")}>
                  Ata
                </Tab>
                <Tab active={tab === "acoes"} onClick={() => setTab("acoes")}>
                  Ações
                </Tab>
              </div>

              {tab === "ata" ? (
                <>
                  {/* ATA PRINCIPAL */}
                  <Section title="Ata Principal">
                    <pre className="whitespace-pre-wrap text-sm">
                      {ataPrincipal || "—"}
                    </pre>
                  </Section>

                  {/* ATA MANUAL */}
                  <Section title="Ata Manual">
                    {editAtaManual ? (
                      <>
                        <textarea
                          className="w-full min-h-[200px] border rounded-xl p-3 text-sm"
                          value={ataManual}
                          onChange={(e) =>
                            setAtaManual(e.target.value)
                          }
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={salvarAtaManual}
                            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditAtaManual(false)}
                            className="border px-4 py-2 rounded-xl text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <pre className="whitespace-pre-wrap text-sm">
                          {ataManual || "—"}
                        </pre>
                        <button
                          onClick={() => setEditAtaManual(true)}
                          className="mt-2 text-xs font-bold text-blue-600"
                        >
                          Editar ata manual
                        </button>
                      </>
                    )}
                  </Section>
                </>
              ) : (
                <Section title="Ações">
                  <div className="mb-3 flex gap-2">
                    <TabSmall
                      active={acaoTab === "reuniao"}
                      onClick={() => setAcaoTab("reuniao")}
                    >
                      Da reunião
                    </TabSmall>
                    <TabSmall
                      active={acaoTab === "backlog"}
                      onClick={() => setAcaoTab("backlog")}
                    >
                      Pendentes do tipo
                    </TabSmall>
                  </div>

                  <div className="mb-4">
                    <textarea
                      placeholder="Nova ação..."
                      value={novaAcao.descricao}
                      onChange={(e) =>
                        setNovaAcao({
                          ...novaAcao,
                          descricao: e.target.value,
                        })
                      }
                      className="w-full border rounded-xl p-3 text-sm"
                    />
                    <input
                      placeholder="Responsável"
                      value={novaAcao.responsavel}
                      onChange={(e) =>
                        setNovaAcao({
                          ...novaAcao,
                          responsavel: e.target.value,
                        })
                      }
                      className="w-full border rounded-xl p-3 text-sm mt-2"
                    />
                    <button
                      onClick={criarAcao}
                      className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black"
                    >
                      Criar ação
                    </button>
                  </div>

                  {(acaoTab === "reuniao"
                    ? acoesReuniao
                    : acoesPendentesTipo
                  ).map((a) => (
                    <AcaoCard
                      key={a.id}
                      acao={a}
                      onToggle={() => toggleAcao(a)}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

/* =========================
   UI pequenos
========================= */
function Tab({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-xs font-black border ${
        active
          ? "bg-blue-600/10 border-blue-300 text-blue-800"
          : "bg-white border-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function TabSmall({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
        active
          ? "bg-blue-600/10 border-blue-300 text-blue-800"
          : "bg-white border-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white border rounded-2xl p-5 mb-4">
      <div className="font-black text-sm mb-3">{title}</div>
      {children}
    </div>
  );
}

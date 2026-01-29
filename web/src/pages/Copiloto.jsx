import React, { useEffect, useRef, useState } from "react";
import Layout from "../components/tatico/Layout";
import { supabase } from "../supabaseClient";
import { Bot, Lock } from "lucide-react";
import { useRecording } from "../context/RecordingContext";
import ModalDetalhesAcao from "../components/tatico/ModalDetalhesAcao";

/* =========================
   Helpers
========================= */
const hojeInicio = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const hojeFim = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

const toBR = (dt) =>
  dt ? new Date(dt).toLocaleString("pt-BR") : "-";

/* =========================
   Página
========================= */
export default function Copiloto() {
  const {
    isRecording,
    startRecording,
    stopRecording,
    timer,
  } = useRecording();

  const mounted = useRef(true);

  const [reunioes, setReunioes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);

  const [aba, setAba] = useState("principal"); // principal | manual | acoes

  const [ataPrincipal, setAtaPrincipal] = useState("");
  const [ataManual, setAtaManual] = useState("");
  const [editAtaManual, setEditAtaManual] = useState(false);

  const [acoesReuniao, setAcoesReuniao] = useState([]);
  const [acoesBacklog, setAcoesBacklog] = useState([]);
  const [acoesDesdeUltima, setAcoesDesdeUltima] = useState([]);

  const [acaoSelecionada, setAcaoSelecionada] = useState(null);

  const [showUnlock, setShowUnlock] = useState(false);
  const [senhaAdm, setSenhaAdm] = useState("");

  /* =========================
     Load inicial
  ========================= */
  useEffect(() => {
    mounted.current = true;
    fetchReunioesDoDia();
    return () => (mounted.current = false);
  }, []);

  useEffect(() => {
    if (!selecionada) return;
    carregarAtas(selecionada);
    fetchAcoes(selecionada);
  }, [selecionada?.id]);

  /* =========================
     Reuniões (SOMENTE DO DIA)
  ========================= */
  const fetchReunioesDoDia = async () => {
    const { data } = await supabase
      .from("reunioes")
      .select("*")
      .gte("data_hora", hojeInicio())
      .lte("data_hora", hojeFim())
      .order("data_hora");

    if (!mounted.current) return;
    setReunioes(data || []);
  };

  /* =========================
     Atas
  ========================= */
  const carregarAtas = async (r) => {
    setAtaManual(r.ata_manual || "");
    setEditAtaManual(false);

    const { data } = await supabase
      .from("tipos_reuniao")
      .select("ata_principal")
      .eq("id", r.tipo_reuniao_id)
      .single();

    setAtaPrincipal(data?.ata_principal || "");
  };

  const salvarAtaManual = async () => {
    await supabase
      .from("reunioes")
      .update({ ata_manual: ataManual })
      .eq("id", selecionada.id);

    setEditAtaManual(false);
    fetchReunioesDoDia();
  };

  /* =========================
     Gravação
  ========================= */
  const iniciar = async () => {
    if (!selecionada) return;
    await startRecording({ reuniaoId: selecionada.id });
    fetchReunioesDoDia();
  };

  const encerrar = async () => {
    await stopRecording();

    await supabase
      .from("reunioes")
      .update({ status: "Realizada" })
      .eq("id", selecionada.id);

    fetchReunioesDoDia();
  };

  /* =========================
     Reabrir (ADM)
  ========================= */
  const validarSenhaAdm = async () => {
    const { data } = await supabase
      .from("usuarios_aprovadores")
      .select("id")
      .eq("senha", senhaAdm)
      .eq("nivel", "Administrador")
      .eq("ativo", true)
      .single();

    if (!data) return alert("Senha inválida");

    await supabase
      .from("reunioes")
      .update({ status: "Pendente" })
      .eq("id", selecionada.id);

    setShowUnlock(false);
    setSenhaAdm("");
    fetchReunioesDoDia();
  };

  /* =========================
     Ações
  ========================= */
  const fetchAcoes = async (r) => {
    const { data: rAcoes } = await supabase
      .from("acoes")
      .select("*")
      .eq("reuniao_id", r.id);

    const { data: backlog } = await supabase
      .from("acoes")
      .select("*")
      .eq("tipo_reuniao_id", r.tipo_reuniao_id)
      .neq("status", "Concluída");

    const { data: ultima } = await supabase
      .from("reunioes")
      .select("data_hora")
      .eq("tipo_reuniao_id", r.tipo_reuniao_id)
      .lt("data_hora", r.data_hora)
      .order("data_hora", { ascending: false })
      .limit(1)
      .single();

    let realizadas = [];
    if (ultima?.data_hora) {
      const { data } = await supabase
        .from("acoes")
        .select("*")
        .eq("tipo_reuniao_id", r.tipo_reuniao_id)
        .eq("status", "Concluída")
        .gt("data_conclusao", ultima.data_hora);

      realizadas = data || [];
    }

    if (!mounted.current) return;

    setAcoesReuniao(rAcoes || []);
    setAcoesBacklog(backlog || []);
    setAcoesDesdeUltima(realizadas);
  };

  /* =========================
     UI
  ========================= */
  return (
    <Layout>
      <div className="flex h-screen bg-[#f6f8fc]">
        {/* COLUNA ESQUERDA */}
        <div className="w-[420px] bg-white border-r flex flex-col">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl text-white flex items-center justify-center">
                <Bot size={20} />
              </div>
              <h1 className="font-black">Copiloto Tático</h1>
            </div>

            {reunioes.map((r) => (
              <button
                key={r.id}
                onClick={() => !isRecording && setSelecionada(r)}
                className={`w-full p-4 text-left rounded-xl mb-2 ${
                  selecionada?.id === r.id
                    ? "bg-blue-50 border-l-4 border-blue-600"
                    : "bg-white"
                }`}
              >
                <div className="font-bold text-sm">{r.titulo}</div>
                <div className="text-xs text-slate-500">
                  {toBR(r.data_hora)}
                </div>
              </button>
            ))}
          </div>

          {/* RODAPÉ FIXO */}
          <div className="mt-auto p-5 border-t">
            {isRecording ? (
              <button
                onClick={encerrar}
                className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black"
              >
                Encerrar • {timer}
              </button>
            ) : selecionada?.status === "Realizada" ? (
              <button
                onClick={() => setShowUnlock(true)}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-600"
              >
                <Lock size={14} /> Reabrir (ADM)
              </button>
            ) : (
              <button
                onClick={iniciar}
                disabled={!selecionada}
                className="w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-black"
              >
                Iniciar Gravação
              </button>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="flex-1 p-6 overflow-y-auto">
          {!selecionada ? (
            <div>Selecione uma reunião do dia</div>
          ) : (
            <>
              {/* ABAS */}
              <div className="flex gap-2 mb-4">
                <Tab label="Ata Principal" active={aba === "principal"} onClick={() => setAba("principal")} />
                <Tab label="Ata Manual" active={aba === "manual"} onClick={() => setAba("manual")} />
                <Tab label="Ações" active={aba === "acoes"} onClick={() => setAba("acoes")} />
              </div>

              {aba === "principal" && (
                <Section>
                  <pre className="whitespace-pre-wrap">{ataPrincipal || "—"}</pre>
                </Section>
              )}

              {aba === "manual" && (
                <Section>
                  {editAtaManual ? (
                    <>
                      <textarea
                        className="w-full min-h-[240px] border rounded-xl p-3"
                        value={ataManual}
                        onChange={(e) => setAtaManual(e.target.value)}
                      />
                      <button
                        onClick={salvarAtaManual}
                        className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black"
                      >
                        Salvar
                      </button>
                    </>
                  ) : (
                    <>
                      <pre className="whitespace-pre-wrap">{ataManual || "—"}</pre>
                      <button
                        onClick={() => setEditAtaManual(true)}
                        className="text-xs text-blue-600 font-bold mt-2"
                      >
                        Editar
                      </button>
                    </>
                  )}
                </Section>
              )}

              {aba === "acoes" && (
                <>
                  <Section title="Ações da reunião">
                    {acoesReuniao.map((a) => (
                      <LinhaAcao key={a.id} acao={a} onClick={() => setAcaoSelecionada(a)} />
                    ))}
                  </Section>

                  <Section title="Pendências do tipo">
                    {acoesBacklog.map((a) => (
                      <LinhaAcao key={a.id} acao={a} onClick={() => setAcaoSelecionada(a)} />
                    ))}
                  </Section>

                  <Section title="Concluídas desde a última reunião">
                    {acoesDesdeUltima.map((a) => (
                      <LinhaAcao key={a.id} acao={a} onClick={() => setAcaoSelecionada(a)} />
                    ))}
                  </Section>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {acaoSelecionada && (
        <ModalDetalhesAcao
          acao={acaoSelecionada}
          onClose={() => setAcaoSelecionada(null)}
          onSaved={() => fetchAcoes(selecionada)}
        />
      )}

      {showUnlock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl w-[360px]">
            <div className="font-black mb-2">Senha do Administrador</div>
            <input
              type="password"
              value={senhaAdm}
              onChange={(e) => setSenhaAdm(e.target.value)}
              className="w-full border rounded-xl p-3"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={validarSenhaAdm}
                className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black"
              >
                Liberar
              </button>
              <button
                onClick={() => setShowUnlock(false)}
                className="border px-4 py-2 rounded-xl text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* =========================
   Componentes
========================= */
function Section({ title, children }) {
  return (
    <div className="bg-white border rounded-2xl p-5 mb-4">
      {title && <div className="font-black text-sm mb-3">{title}</div>}
      {children}
    </div>
  );
}

function LinhaAcao({ acao, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 border rounded-xl mb-2 hover:bg-slate-50"
    >
      <div className="font-semibold text-sm">{acao.descricao}</div>
      <div className="text-xs text-slate-500">
        {acao.status} • {acao.responsavel || "—"}
      </div>
    </button>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-xs font-black ${
        active ? "bg-blue-600 text-white" : "bg-white border"
      }`}
    >
      {label}
    </button>
  );
}


// src/pages/OperacaoRotinas.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import ConfiguracaoGeral from "../components/tatico/ConfiguracaoGeral";
import { Settings, Download, ChevronDown } from "lucide-react";
import html2canvas from "html2canvas";

const ID_PCO = 4;
const ID_MOTORISTAS = 5;

const MESES = [
  { id: 1, label: "jan/26" },
  { id: 2, label: "fev/26" },
  { id: 3, label: "mar/26" },
  { id: 4, label: "abr/26" },
  { id: 5, label: "mai/26" },
  { id: 6, label: "jun/26" },
  { id: 7, label: "jul/26" },
  { id: 8, label: "ago/26" },
  { id: 9, label: "set/26" },
  { id: 10, label: "out/26" },
  { id: 11, label: "nov/26" },
  { id: 12, label: "dez/26" },
];

/** ✅ Parser único: aceita vírgula ou ponto (PT-BR) */
function parseNumberPtBr(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  let t = s.replace(/\s+/g, "");

  // "." e "," juntos -> BR: "." milhar, "," decimal
  if (t.includes(".") && t.includes(",")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else {
    // só "," -> decimal
    t = t.replace(",", ".");
  }

  // remove lixo
  t = t.replace(/[^0-9.\-]/g, "");

  // remove pontos extras
  const idx = t.indexOf(".");
  if (idx !== -1) {
    t = t.slice(0, idx + 1) + t.slice(idx + 1).replace(/\./g, "");
  }

  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const OperacaoRotinas = () => {
  const [areas, setAreas] = useState([]);
  const [areaSelecionada, setAreaSelecionada] = useState(null);
  const [rotinas, setRotinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  // mantém a funcionalidade existente (filtro responsável),
  // só padroniza o visual para ficar no mesmo "modo" do Farol de Metas.
  const [responsavelFiltro, setResponsavelFiltro] = useState("");

  // ✅ Export (igual Metas)
  const [openExport, setOpenExport] = useState(false);
  const tableWrapRef = useRef(null);

  useEffect(() => {
    fetchAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (areaSelecionada) fetchRotinasData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaSelecionada]);

  const fetchAreas = async () => {
    const { data } = await supabase
      .from("areas")
      .select("*")
      .eq("ativa", true)
      .order("id");

    if (data && data.length > 0) {
      const filtered = data.filter((a) => a.id == ID_PCO || a.id == ID_MOTORISTAS);
      const lista = filtered.length > 0 ? filtered : data;
      setAreas(lista);
      setAreaSelecionada(lista[0].id);
    } else {
      setLoading(false);
    }
  };

  // ✅ Mesma régua de score do Farol de Metas (com cor) + regra META=0
  const calculateScore = (meta, realizado, tipo, pesoTotal) => {
    const peso = Number(pesoTotal);
    if (
      meta === null ||
      meta === undefined ||
      realizado === "" ||
      realizado === null ||
      realizado === undefined ||
      Number.isNaN(Number(realizado)) ||
      Number.isNaN(peso)
    ) {
      return { score: 0, multiplicador: 0, color: "bg-white" };
    }

    const r = Number(realizado);
    const m = Number(meta);

    // Regra META = 0 (mesma filosofia do metas com proteção)
    if (m === 0) {
      // Se tipo for "<=" / menor: só pontua se r === 0 (mantém seu comportamento original)
      const ok =
        tipo === "<=" || tipo === "menor"
          ? r === 0
          : r >= 0; // para ">=" com meta 0, qualquer >=0 fica ok
      return {
        score: ok ? peso : 0,
        multiplicador: ok ? 1 : 0,
        color: ok ? "bg-green-300" : "bg-red-200",
      };
    }

    let atingimento = 0;

    if (tipo === ">=" || tipo === "maior") {
      atingimento = r / m;
    } else {
      atingimento = 1 + (m - r) / m;
    }

    let multiplicador = 0;
    let cor = "bg-red-200";

    if (atingimento >= 1.0) {
      multiplicador = 1.0;
      cor = "bg-green-300";
    } else if (atingimento >= 0.99) {
      multiplicador = 0.75;
      cor = "bg-green-100";
    } else if (atingimento >= 0.98) {
      multiplicador = 0.5;
      cor = "bg-yellow-100";
    } else if (atingimento >= 0.97) {
      multiplicador = 0.25;
      cor = "bg-orange-100";
    } else {
      multiplicador = 0.0;
      cor = "bg-red-200";
    }

    return {
      score: peso * multiplicador,
      multiplicador,
      color: cor,
    };
  };

  const fetchRotinasData = async () => {
    setLoading(true);
    try {
      const { data: defs } = await supabase
        .from("rotinas_indicadores")
        .select("*")
        .eq("area_id", areaSelecionada)
        .order("ordem", { ascending: true });

      const { data: valores } = await supabase
        .from("rotinas_mensais")
        .select("*")
        .eq("ano", 2026);

      const combined = (defs || []).map((r) => {
        const row = { ...r, meses: {} };

        MESES.forEach((mes) => {
          const valObj = valores?.find((v) => v.rotina_id === r.id && v.mes === mes.id);

          // ✅ Normaliza (carrega como número quando existir)
          const realizadoRaw = valObj?.valor_realizado ?? "";
          const metaRaw = valObj?.valor_meta ?? null;

          const realizadoNum =
            realizadoRaw === "" || realizadoRaw === null || realizadoRaw === undefined
              ? ""
              : parseNumberPtBr(realizadoRaw) ?? "";

          const metaNum =
            metaRaw === null || metaRaw === undefined || metaRaw === ""
              ? null
              : parseNumberPtBr(metaRaw);

          const calc = calculateScore(metaNum, realizadoNum, r.tipo_comparacao, r.peso);

          row.meses[mes.id] = {
            realizado: realizadoNum,
            meta: metaNum,
            score: calc.score,
            multiplicador: calc.multiplicador,
            color: calc.color,
          };
        });

        return row;
      });

      setRotinas(combined);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (rotinaId, mesId, valor) => {
    const valorNum = parseNumberPtBr(valor); // ✅ aceita vírgula/ponto

    setRotinas((prev) =>
      prev.map((r) => {
        if (r.id !== rotinaId) return r;

        const novosMeses = { ...r.meses };
        const metaAtual = novosMeses[mesId]?.meta ?? null;

        const calc = calculateScore(metaAtual, valorNum === null ? "" : valorNum, r.tipo_comparacao, r.peso);

        novosMeses[mesId] = {
          ...novosMeses[mesId],
          realizado: valorNum === null ? "" : valorNum,
          score: calc.score,
          multiplicador: calc.multiplicador,
          color: calc.color,
        };

        return { ...r, meses: novosMeses };
      })
    );

    const { error } = await supabase.rpc("atualizar_realizado_rotina", {
      p_rotina_id: rotinaId,
      p_mes: mesId,
      p_valor: valorNum, // null apaga
    });

    if (error) console.error("Erro ao salvar:", error);
  };

  // responsáveis únicos para o filtro (mantém)
  const responsaveisUnicos = useMemo(
    () =>
      Array.from(
        new Set(
          (rotinas || [])
            .map((r) => r.responsavel)
            .filter((r) => r && String(r).trim() !== "")
        )
      ),
    [rotinas]
  );

  const rotinasFiltradas = useMemo(
    () =>
      responsavelFiltro
        ? rotinas.filter((r) => r.responsavel === responsavelFiltro)
        : rotinas,
    [rotinas, responsavelFiltro]
  );

  const totalPeso = useMemo(() => {
    // mantém o total consistente com a tabela exibida (com filtro, como já era sua lógica)
    return rotinasFiltradas.reduce((acc, r) => acc + (Number(r.peso) || 0), 0);
  }, [rotinasFiltradas]);

  const getTotalScore = (mesId) => {
    const total = rotinasFiltradas.reduce((acc, r) => acc + (r.meses[mesId]?.score || 0), 0);
    return total.toFixed(1);
  };

  // ✅ Export igual Metas
  const exportFarol = async (format = "png") => {
    try {
      setOpenExport(false);
      const el = tableWrapRef.current;
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const ext = format === "jpg" ? "jpg" : "png";

      const dataUrl = canvas.toDataURL(mime, format === "jpg" ? 0.92 : undefined);
      const a = document.createElement("a");

      const areaName = areas.find((a) => a.id === areaSelecionada)?.nome || "Operacao";
      a.href = dataUrl;
      a.download = `FarolRotinas_${areaName}_2026.${ext}`;
      a.click();
    } catch (e) {
      console.error("Erro ao exportar farol:", e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded shadow-sm overflow-hidden font-sans">
      {/* Cabeçalho (MESMO MODO do Metas) */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">Farol de Rotinas — Operação</h2>

          {/* Baixar Farol (igual Metas) */}
          <div className="relative">
            <button
              onClick={() => setOpenExport((s) => !s)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
              title="Baixar Farol"
            >
              <Download size={16} />
              Baixar Farol
              <ChevronDown size={16} />
            </button>

            {openExport && (
              <div className="absolute left-0 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden z-50">
                <button
                  onClick={() => exportFarol("png")}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Baixar PNG
                </button>
                <button
                  onClick={() => exportFarol("jpg")}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Baixar JPG
                </button>
              </div>
            )}
          </div>

          {/* Filtro Responsável (mantém funcionalidade, só encaixa no header) */}
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-gray-500 font-semibold">Responsável:</span>
            <select
              value={responsavelFiltro}
              onChange={(e) => setResponsavelFiltro(e.target.value)}
              className="text-xs bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {responsaveisUnicos.map((resp) => (
                <option key={resp} value={resp}>
                  {resp}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Config */}
          <div className="flex items-center gap-2 mr-4 pr-4">
            <button
              onClick={() => setShowConfig(true)}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded-full transition-colors"
              title="Configurações"
            >
              <Settings size={18} />
            </button>
          </div>

          {/* Seletor de Áreas (MESMO MODO do Metas) */}
          <div className="flex space-x-2">
            {areas.map((area) => (
              <button
                key={area.id}
                onClick={() => setAreaSelecionada(area.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all border-b-2 ${
                  areaSelecionada === area.id
                    ? "border-blue-600 text-blue-700 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                {area.nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500 animate-pulse">Carregando dados...</div>
        ) : (
          <div
            ref={tableWrapRef}
            className="border border-gray-300 rounded-xl overflow-hidden shadow-sm"
          >
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#d0e0e3] text-gray-800 text-center font-bold">
                  <th className="p-2 border border-gray-300 w-72 sticky left-0 bg-[#d0e0e3] z-20 text-left">
                    Indicador
                  </th>
                  <th className="p-2 border border-gray-300 w-40 text-left">Responsável</th>
                  <th className="p-2 border border-gray-300 w-12">Peso</th>
                  <th className="p-2 border border-gray-300 w-12">Tipo</th>
                  {MESES.map((mes) => (
                    <th key={mes.id} className="p-2 border border-gray-300 min-w-[90px]">
                      {mes.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rotinasFiltradas.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-gray-50 transition-colors">
                    {/* Indicador (sticky) */}
                    <td className="p-2 border border-gray-300 sticky left-0 bg-white z-10 text-left font-semibold text-gray-800 text-sm">
                      {row.indicador}
                    </td>

                    {/* Responsável */}
                    <td className="p-2 border border-gray-300 text-[11px] text-gray-700 text-left">
                      {row.responsavel || "-"}
                    </td>

                    {/* Peso */}
                    <td className="p-2 border border-gray-300 bg-gray-50 text-center">
                      {row.peso != null ? parseInt(row.peso) : "-"}
                    </td>

                    {/* Tipo */}
                    <td className="p-2 border border-gray-300 font-mono text-gray-500 text-center">
                      {row.tipo_comparacao}
                    </td>

                    {/* Meses */}
                    {MESES.map((mes) => {
                      const dados = row.meses[mes.id];

                      const temMeta = dados?.meta !== null && dados?.meta !== undefined;
                      const valorRealizado =
                        !dados ||
                        dados.realizado === null ||
                        dados.realizado === "" ||
                        Number.isNaN(dados.realizado)
                          ? ""
                          : dados.realizado;

                      // ✅ cor vem do mesmo cálculo do metas
                      const cellColor = dados?.color || "bg-white";

                      return (
                        <td
                          key={mes.id}
                          className={`border border-gray-300 p-0 relative h-12 align-middle ${cellColor}`}
                        >
                          <div className="flex flex-col h-full justify-between">
                            {/* META (alvo) */}
                            <div className="text-[11px] text-blue-700 font-semibold text-right px-1 pt-0.5 bg-white/40">
                              {temMeta
                                ? Number(dados.meta).toFixed(row.formato === "percent" ? 0 : 2)
                                : ""}
                              {temMeta && row.formato === "percent" && "%"}
                            </div>

                            {/* Realizado */}
                            <div className="flex-1 flex items-center justify-center pb-1">
                              <div className="flex items-baseline gap-0.5">
                                {row.formato === "currency" && (
                                  <span className="text-gray-500/70 text-[10px]">R$</span>
                                )}

                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="w-20 text-center bg-transparent focus:outline-none font-bold text-[13px] text-gray-900 placeholder-gray-400/70 focus:bg-white/60 rounded-sm"
                                  placeholder="-"
                                  defaultValue={valorRealizado === "" ? "" : String(valorRealizado)}
                                  onBlur={(e) => handleSave(row.id, mes.id, e.target.value)}
                                />

                                {row.formato === "percent" && (
                                  <span className="text-gray-500/70 text-[10px]">%</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* TOTAL SCORE (mesmo rodapé do Metas) */}
                <tr className="bg-red-600 text-white font-bold border-t-2 border-black">
                  <td className="p-2 sticky left-0 bg-red-600 z-10 border-r border-red-500 text-right pr-4">
                    TOTAL SCORE
                  </td>
                  <td className="p-2 border-r border-red-500"></td>
                  <td className="p-2 border-r border-red-500 text-center">
                    {Number(totalPeso || 0).toFixed(0)}
                  </td>
                  <td className="p-2 border-r border-red-500"></td>
                  {MESES.map((mes) => (
                    <td
                      key={mes.id}
                      className="p-2 text-center border-r border-red-500 text-sm"
                    >
                      {getTotalScore(mes.id)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showConfig && (
        <ConfiguracaoGeral
          onClose={() => {
            setShowConfig(false);
            fetchRotinasData();
          }}
        />
      )}
    </div>
  );
};

export default OperacaoRotinas;

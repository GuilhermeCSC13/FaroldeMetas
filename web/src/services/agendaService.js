// src/services/agendaService.js
import { addDays, addMonths } from "date-fns";
import { supabase } from "../supabaseClient";

export const gerarDatasRecorrentes = (dataInicialISO, regra, qtd = 12) => {
  const datas = [];
  let dataBase = new Date(dataInicialISO);

  for (let i = 0; i < qtd; i++) {
    datas.push(new Date(dataBase));
    if (regra === "semanal") dataBase = addDays(dataBase, 7);
    if (regra === "quinzenal") dataBase = addDays(dataBase, 15);
    if (regra === "mensal") dataBase = addMonths(dataBase, 1);
  }
  return datas;
};

// ✅ AJUSTE: guard para não mandar "09:15" para timestamptz
const ensureIsoDateTime = (value) => {
  if (!value) return value;
  const s = String(value).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    throw new Error(`data_hora inválido (só hora): "${s}"`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString();
};

export const salvarReuniao = async (dados, regraRecorrencia) => {
  const { titulo, tipo_reuniao, data_hora, cor, area_id, responsavel, pauta, ata, horario_inicio, horario_fim, duracao_segundos, status, tipo_reuniao_id } =
    dados;

  const basePayload = {
    titulo,
    tipo_reuniao: tipo_reuniao ?? null, // se existir no banco
    tipo_reuniao_id: tipo_reuniao_id ?? null,
    cor,
    area_id,
    responsavel,
    pauta: pauta ?? ata ?? null,
    horario_inicio: horario_inicio ?? null,
    horario_fim: horario_fim ?? null,
    duracao_segundos: duracao_segundos ?? null,
    status: status ?? "Agendada",
  };

  if (!regraRecorrencia || regraRecorrencia === "unica") {
    return await supabase
      .from("reunioes")
      .insert([{ ...basePayload, data_hora: ensureIsoDateTime(data_hora) }])
      .select();
  }

  const datas = gerarDatasRecorrentes(ensureIsoDateTime(data_hora), regraRecorrencia);
  const payloadSerie = datas.map((dt) => ({
    ...basePayload,
    data_hora: dt.toISOString(),
  }));

  return await supabase.from("reunioes").insert(payloadSerie).select();
};

export const atualizarReuniao = async (id, novosDados, aplicarEmSerie = false) => {
  const patch = { ...novosDados };

  if (patch.data_hora) {
    patch.data_hora = ensureIsoDateTime(patch.data_hora);
  }

  if (!aplicarEmSerie) {
    return await supabase.from("reunioes").update(patch).eq("id", id).select();
  } else {
    const { data: original } = await supabase
      .from("reunioes")
      .select("tipo_reuniao, tipo_reuniao_id, data_hora")
      .eq("id", id)
      .single();

    if (!original) return { error: { message: "Original não encontrada" } };

    // mantém seu comportamento: não mexer data_hora em massa
    const filtroCol = original.tipo_reuniao_id ? "tipo_reuniao_id" : "tipo_reuniao";

    return await supabase
      .from("reunioes")
      .update({
        titulo: patch.titulo,
        cor: patch.cor,
        responsavel: patch.responsavel,
        pauta: patch.pauta ?? patch.ata ?? null,
        tipo_reuniao: patch.tipo_reuniao ?? original.tipo_reuniao ?? null,
        tipo_reuniao_id: patch.tipo_reuniao_id ?? original.tipo_reuniao_id ?? null,
      })
      .eq(filtroCol, original[filtroCol])
      .gte("data_hora", original.data_hora)
      .select();
  }
};

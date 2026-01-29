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

export const salvarReuniao = async (dados, regraRecorrencia) => {
  const {
    titulo,
    data_hora,
    cor,
    area_id,
    responsavel,
    ata,
    status,
    tipo_reuniao_id,
    tipo_reuniao_legacy,
    duracao_segundos,
  } = dados;

  const basePayload = {
    titulo,
    data_hora,
    cor,
    area_id,
    responsavel,
    ata,
    status: status || "Agendada",

    tipo_reuniao_id: tipo_reuniao_id || null,
    tipo_reuniao_legacy: tipo_reuniao_legacy || "Geral", // NOT NULL

    // ✅ só numérico (se existir). Não manda strings tipo "09:00"
    duracao_segundos: duracao_segundos ?? null,
  };

  if (!regraRecorrencia || regraRecorrencia === "unica") {
    return await supabase.from("reunioes").insert([basePayload]);
  }

  const datas = gerarDatasRecorrentes(data_hora, regraRecorrencia);
  const payloadSerie = datas.map((dt) => ({
    ...basePayload,
    data_hora: dt.toISOString(),
  }));

  return await supabase.from("reunioes").insert(payloadSerie);
};

export const atualizarReuniao = async (id, novosDados, aplicarEmSerie = false) => {
  if (!aplicarEmSerie) {
    const payload = { ...novosDados };

    // ✅ garantias: não mandar campos que podem ser timestamptz no banco
    delete payload.horario_inicio;
    delete payload.horario_fim;

    return await supabase.from("reunioes").update(payload).eq("id", id);
  }

  const { data: original, error: errOrig } = await supabase
    .from("reunioes")
    .select("tipo_reuniao_legacy, data_hora")
    .eq("id", id)
    .single();

  if (errOrig || !original) return { error: errOrig || new Error("Original não encontrada") };

  return await supabase
    .from("reunioes")
    .update({
      titulo: novosDados.titulo,
      cor: novosDados.cor,
      responsavel: novosDados.responsavel,
      ata: novosDados.ata,
      status: novosDados.status,
      tipo_reuniao_id: novosDados.tipo_reuniao_id || null,
      tipo_reuniao_legacy:
        novosDados.tipo_reuniao_legacy || original.tipo_reuniao_legacy || "Geral",
      duracao_segundos: novosDados.duracao_segundos ?? null,
    })
    .eq("tipo_reuniao_legacy", original.tipo_reuniao_legacy)
    .gte("data_hora", original.data_hora);
};

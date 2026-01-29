import { addDays, addMonths } from "date-fns";
import { supabase } from "../supabaseClient";

// Gera datas futuras
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

// ✅ blindagem única: remove qualquer HH:MM puro
function sanitizePayload(dados) {
  const clean = { ...dados };

  delete clean.horario_fim;
  delete clean.hora_fim;
  delete clean.horario_inicio;
  delete clean.hora_inicio;

  for (const [k, v] of Object.entries(clean)) {
    if (typeof v === "string" && /^\d{2}:\d{2}$/.test(v)) {
      delete clean[k];
    }
  }

  return clean;
}

// Salva Nova Reunião
export const salvarReuniao = async (dados, regraRecorrencia) => {
  const clean = sanitizePayload(dados);

  const {
    titulo,
    tipo_reuniao,
    tipo_reuniao_id,
    data_hora,
    cor,
    area_id,
    responsavel,
    pauta,
    ata,
    duracao_segundos,
    status,
  } = clean;

  const basePayload = {
    titulo,
    tipo_reuniao: tipo_reuniao ?? null,
    tipo_reuniao_id: tipo_reuniao_id ?? null,
    cor,
    area_id,
    responsavel,
    pauta: pauta ?? ata ?? null,
    duracao_segundos: duracao_segundos ?? null,
    status: status ?? "Agendada",
  };

  if (!regraRecorrencia || regraRecorrencia === "unica") {
    return await supabase
      .from("reunioes")
      .insert([{ ...basePayload, data_hora }]);
  }

  const datas = gerarDatasRecorrentes(data_hora, regraRecorrencia);
  const payloadSerie = datas.map((dt) => ({
    ...basePayload,
    data_hora: dt.toISOString(),
  }));

  return await supabase.from("reunioes").insert(payloadSerie);
};

// Atualiza Reunião
export const atualizarReuniao = async (id, novosDados, aplicarEmSerie = false) => {
  const clean = sanitizePayload(novosDados);

  if (!aplicarEmSerie) {
    return await supabase.from("reunioes").update(clean).eq("id", id);
  } else {
    const { data: original } = await supabase
      .from("reunioes")
      .select("tipo_reuniao, tipo_reuniao_id, data_hora")
      .eq("id", id)
      .single();

    if (!original) return { error: "Original não encontrada" };

    return await supabase
      .from("reunioes")
      .update({
        titulo: clean.titulo,
        cor: clean.cor,
        responsavel: clean.responsavel,
        pauta: clean.pauta ?? clean.ata ?? null,
        tipo_reuniao: clean.tipo_reuniao ?? original.tipo_reuniao ?? null,
        tipo_reuniao_id: clean.tipo_reuniao_id ?? original.tipo_reuniao_id ?? null,
      })
      .eq("tipo_reuniao", original.tipo_reuniao)
      .gte("data_hora", original.data_hora);
  }
};

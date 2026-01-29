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

// Salva Nova Reunião
export const salvarReuniao = async (dados, regraRecorrencia) => {
  // ✅ IMPORTANT: seu banco exige tipo_reuniao_legacy NOT NULL
  const {
    titulo,
    tipo_reuniao_legacy,
    tipo_reuniao_id,
    data_hora,
    cor,
    area_id,
    responsavel,
    pauta,
    ata,
    status,
    horario_inicio,
    horario_fim,
    duracao_segundos,
  } = dados;

  const basePayload = {
    titulo,
    data_hora,
    tipo_reuniao_id: tipo_reuniao_id || null,
    tipo_reuniao_legacy: tipo_reuniao_legacy || "Geral", // ✅ garante não-null
    cor,
    area_id,
    responsavel,
    pauta: pauta ?? null,
    ata: ata ?? null,
    status: status || "Agendada",
    horario_inicio: horario_inicio ?? null,
    horario_fim: horario_fim ?? null,
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

// Atualiza Reunião
export const atualizarReuniao = async (id, novosDados, aplicarEmSerie = false) => {
  if (!aplicarEmSerie) {
    // ✅ garante que tipo_reuniao_legacy nunca vai como null
    const safe = {
      ...novosDados,
      tipo_reuniao_legacy: novosDados.tipo_reuniao_legacy || "Geral",
    };
    return await supabase.from("reunioes").update(safe).eq("id", id);
  }

  // Série: usa tipo_reuniao_legacy como "chave" de agrupamento
  const { data: original } = await supabase
    .from("reunioes")
    .select("tipo_reuniao_legacy, data_hora")
    .eq("id", id)
    .single();

  if (!original) return { error: "Original não encontrada" };

  return await supabase
    .from("reunioes")
    .update({
      titulo: novosDados.titulo,
      cor: novosDados.cor,
      responsavel: novosDados.responsavel,
      tipo_reuniao_legacy: novosDados.tipo_reuniao_legacy || original.tipo_reuniao_legacy || "Geral",
    })
    .eq("tipo_reuniao_legacy", original.tipo_reuniao_legacy) // ✅ aqui
    .gte("data_hora", original.data_hora);
};

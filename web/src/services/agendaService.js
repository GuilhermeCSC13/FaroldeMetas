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
    materiais, // (se você quiser salvar materiais no create)
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

    // se existir no seu schema
    ...(typeof materiais !== "undefined" ? { materiais } : {}),
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
  // 1) Sempre atualiza a reunião atual (por ID), incluindo data_hora se veio no payload
  const payloadAtual = { ...novosDados };

  // ✅ garantias: não mandar campos que podem dar conflito/timestamptz “extra”
  delete payloadAtual.horario_inicio;
  delete payloadAtual.horario_fim;

  // (opcional) se sua coluna materiais existir e vier undefined, não manda
  if (payloadAtual.materiais === undefined) delete payloadAtual.materiais;

  const { error: errUpdateAtual } = await supabase
    .from("reunioes")
    .update(payloadAtual)
    .eq("id", id);

  if (errUpdateAtual) return { error: errUpdateAtual };

  // 2) Se não for pra aplicar na série, acabou aqui
  if (!aplicarEmSerie) {
    return { error: null };
  }

  // 3) Buscar “chave da série” (você está usando tipo_reuniao_legacy como agrupador)
  const { data: original, error: errOrig } = await supabase
    .from("reunioes")
    .select("tipo_reuniao_legacy, data_hora")
    .eq("id", id)
    .single();

  if (errOrig || !original) {
    return { error: errOrig || new Error("Original não encontrada") };
  }

  // 4) Propaga apenas campos “template” para as futuras, sem mexer em data_hora
  const payloadSerie = {
    titulo: novosDados.titulo,
    cor: novosDados.cor,
    responsavel: novosDados.responsavel,
    ata: novosDados.ata,
    status: novosDados.status,
    tipo_reuniao_id: novosDados.tipo_reuniao_id || null,
    tipo_reuniao_legacy:
      novosDados.tipo_reuniao_legacy || original.tipo_reuniao_legacy || "Geral",
    duracao_segundos: novosDados.duracao_segundos ?? null,
  };

  // se você quer propagar materiais também, descomente:
  // if (Array.isArray(novosDados.materiais)) payloadSerie.materiais = novosDados.materiais;

  return await supabase
    .from("reunioes")
    .update(payloadSerie)
    .eq("tipo_reuniao_legacy", original.tipo_reuniao_legacy)
    .gte("data_hora", original.data_hora);
};

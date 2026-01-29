import { addDays, addMonths } from "date-fns";
import { supabase } from "../supabaseClient";

// Gera datas futuras (mantém horário do Date)
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

function normalizeIso(value) {
  if (!value) return null;
  // Se vier "2026-01-29T09:00:00" (sem Z), ainda vira Date ok
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value); // deixa passar, pra ver erro do banco
  return d.toISOString();
}

// Salva Nova Reunião
export const salvarReuniao = async (dados, regraRecorrencia) => {
  const {
    titulo,
    tipo_reuniao,
    tipo_reuniao_id,
    data_hora,
    cor,
    area_id,
    responsavel,

    // ✅ compat: você usa "ata" no form, mas o banco pode ser "pauta"
    ata,
    pauta,

    // ✅ campos que seu CentralReunioes já monta
    horario_inicio,
    horario_fim,
    duracao_segundos,
    status,
  } = dados;

  const basePayload = {
    titulo,
    tipo_reuniao: tipo_reuniao || "Geral",
    tipo_reuniao_id: tipo_reuniao_id || null,
    cor: cor || "#3B82F6",
    area_id: area_id ?? null,
    responsavel: responsavel || null,

    // ✅ salva em "pauta" (usa ata como fallback)
    pauta: pauta ?? ata ?? null,

    horario_inicio: horario_inicio || null,
    horario_fim: horario_fim || null,
    duracao_segundos: duracao_segundos ?? null,

    status: status || "Agendada",
  };

  // ✅ reunião única
  if (!regraRecorrencia || regraRecorrencia === "unica") {
    const payload = { ...basePayload, data_hora: normalizeIso(data_hora) || data_hora };
    return await supabase.from("reunioes").insert([payload]).select().single();
  }

  // ✅ recorrência
  const datas = gerarDatasRecorrentes(data_hora, regraRecorrencia);
  const payloadSerie = datas.map((dt) => ({
    ...basePayload,
    data_hora: dt.toISOString(),
  }));

  return await supabase.from("reunioes").insert(payloadSerie).select();
};

// Atualiza Reunião
export const atualizarReuniao = async (id, novosDados, aplicarEmSerie = false) => {
  // ✅ normaliza data_hora se vier
  const patch = { ...novosDados };
  if (patch.data_hora) patch.data_hora = normalizeIso(patch.data_hora) || patch.data_hora;

  if (!aplicarEmSerie) {
    return await supabase.from("reunioes").update(patch).eq("id", id).select().single();
  }

  const { data: original, error } = await supabase
    .from("reunioes")
    .select("tipo_reuniao, data_hora")
    .eq("id", id)
    .single();

  if (error || !original) return { error: error || "Original não encontrada" };

  return await supabase
    .from("reunioes")
    .update({
      titulo: patch.titulo,
      cor: patch.cor,
      responsavel: patch.responsavel,
      pauta: patch.pauta ?? patch.ata ?? null,
      tipo_reuniao_id: patch.tipo_reuniao_id ?? null,
    })
    .eq("tipo_reuniao", original.tipo_reuniao)
    .gte("data_hora", original.data_hora)
    .select();
};

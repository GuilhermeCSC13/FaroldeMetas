import { addDays, addMonths, parseISO } from 'date-fns';
import { supabase } from '../supabaseClient';

// Gera datas futuras
export const gerarDatasRecorrentes = (dataInicialISO, regra, qtd = 12) => {
  const datas = [];
  let dataBase = new Date(dataInicialISO); // Garante que pega a hora correta

  for (let i = 0; i < qtd; i++) {
    datas.push(new Date(dataBase));
    if (regra === 'semanal') dataBase = addDays(dataBase, 7);
    if (regra === 'quinzenal') dataBase = addDays(dataBase, 15);
    if (regra === 'mensal') dataBase = addMonths(dataBase, 1);
  }
  return datas;
};

// Salva Nova Reunião
export const salvarReuniao = async (dados, regraRecorrencia) => {
  // Desestrutura para garantir que responsável e ata vão pro banco
  const { titulo, tipo_reuniao, data_hora, cor, area_id, responsavel, pauta } = dados; 
  
  const basePayload = {
    titulo, 
    tipo_reuniao, 
    cor, 
    area_id, 
    responsavel, 
    pauta, // Usando o campo 'pauta' como local da ATA ou Resumo Inicial
    status: 'Agendada'
  };

  if (!regraRecorrencia || regraRecorrencia === 'unica') {
    return await supabase.from('reunioes').insert([{ ...basePayload, data_hora }]);
  }

  const datas = gerarDatasRecorrentes(data_hora, regraRecorrencia);
  const payloadSerie = datas.map(dt => ({
    ...basePayload,
    data_hora: dt.toISOString()
  }));

  return await supabase.from('reunioes').insert(payloadSerie);
};

// Atualiza Reunião (Correção da Hora)
export const atualizarReuniao = async (id, novosDados, aplicarEmSerie = false) => {
  // Se for série, atualizamos metadados, mas a HORA é delicada mudar em massa.
  // Por segurança, a edição de série aqui muda titulo, cor e responsável.
  // A data/hora muda APENAS a da reunião atual se for série, ou movemos tudo (complexo).
  // Nesta versão v2: Série muda dados gerais. Única muda tudo (incluindo hora).

  if (!aplicarEmSerie) {
    return await supabase.from('reunioes').update(novosDados).eq('id', id);
  } else {
    // Busca a original para pegar a referência da série
    const { data: original } = await supabase.from('reunioes').select('tipo_reuniao, data_hora').eq('id', id).single();
    if(!original) return { error: 'Original não encontrada' };

    // Atualiza metadados de todas as futuras do mesmo tipo
    return await supabase.from('reunioes')
      .update({
        titulo: novosDados.titulo,
        cor: novosDados.cor,
        responsavel: novosDados.responsavel,
        // Não mudamos data_hora em massa aqui para não quebrar dias diferentes da semana
        // Mas se quiser mudar a HORA de todas mantendo o dia, precisaria de uma logic mais pesada.
        // Por enquanto, atualizamos o conteúdo.
      })
      .eq('tipo_reuniao', original.tipo_reuniao)
      .gte('data_hora', original.data_hora);
  }
};

import { addDays, addMonths, format, parseISO } from 'date-fns';
import { supabase } from '../supabaseClient';

// Gera datas futuras baseadas na regra
export const gerarDatasRecorrentes = (dataInicial, regra, qtdOcorrencias = 4) => {
  const datas = [];
  let dataBase = new Date(dataInicial);

  for (let i = 0; i < qtdOcorrencias; i++) {
    datas.push(new Date(dataBase));
    
    if (regra === 'semanal') dataBase = addDays(dataBase, 7);
    if (regra === 'quinzenal') dataBase = addDays(dataBase, 15);
    if (regra === 'mensal') dataBase = addMonths(dataBase, 1);
  }
  return datas;
};

// Salva reunião (Única ou Série)
export const salvarReuniao = async (dados, regraRecorrencia) => {
  const { titulo, tipo_reuniao, data_hora, cor, area_id } = dados;
  
  // 1. Se for única
  if (!regraRecorrencia || regraRecorrencia === 'unica') {
    return await supabase.from('reunioes').insert([{
      titulo, tipo_reuniao, data_hora, cor, area_id, status: 'Agendada'
    }]);
  }

  // 2. Se for recorrente (Gera 12 ocorrências/3 meses aprox por padrão para não pesar)
  const qtd = regraRecorrencia === 'mensal' ? 12 : 12; // 1 ano se mensal, 3 meses se semanal
  const datas = gerarDatasRecorrentes(data_hora, regraRecorrencia, qtd);

  const payload = datas.map(dt => ({
    titulo,
    tipo_reuniao,
    data_hora: dt.toISOString(),
    cor,
    area_id,
    status: 'Agendada'
  }));

  return await supabase.from('reunioes').insert(payload);
};

// Edição Inteligente (Série vs Única)
export const atualizarReuniao = async (id, novosDados, aplicarEmSerie = false) => {
  if (!aplicarEmSerie) {
    // Atualiza só essa
    return await supabase.from('reunioes').update(novosDados).eq('id', id);
  } else {
    // Atualiza esta e todas as FUTURAS do mesmo tipo
    // ATENÇÃO: A lógica aqui busca pelo "tipo_reuniao" e datas maiores que a atual
    const { data: original } = await supabase.from('reunioes').select('tipo_reuniao, data_hora').eq('id', id).single();
    
    if(!original) return { error: 'Reunião não encontrada' };

    return await supabase.from('reunioes')
      .update({
        titulo: novosDados.titulo,
        cor: novosDados.cor,
        // Nota: Mudar horário em massa é complexo, aqui vamos mudar apenas metadados ou
        // se a hora mudou, teríamos que recalcular o delta para todas. 
        // Para simplificar V1: Atualiza titulo/cor/status em massa.
        status: novosDados.status 
      })
      .eq('tipo_reuniao', original.tipo_reuniao)
      .gte('data_hora', original.data_hora);
  }
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const ReunioesCalendario = () => {
  const navigate = useNavigate();
  const [dataAtual, setDataAtual] = useState(new Date(2026, 0, 1)); // Começa em Jan 2026
  const [reunioes, setReunioes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReunioesMes();
  }, [dataAtual]);

  const fetchReunioesMes = async () => {
    setLoading(true);
    const start = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1).toISOString();
    const end = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0).toISOString();

    const { data } = await supabase
      .from('reunioes')
      .select('*')
      .gte('data_hora', start)
      .lte('data_hora', end)
      .order('data_hora');
    
    setReunioes(data || []);
    setLoading(false);
  };

  const mudarMes = (offset) => {
    setDataAtual(new Date(dataAtual.getFullYear(), dataAtual.getMonth() + offset, 1));
  };

  const getDiasNoMes = () => {
    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const diasTotal = new Date(ano, mes + 1, 0).getDate();
    
    const dias = [];
    for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null); // Espaços vazios
    for (let i = 1; i <= diasTotal; i++) dias.push(new Date(ano, mes, i));
    return dias;
  };

  return (
    <Layout>
      <div className="p-6 h-full flex flex-col font-sans bg-gray-50">
        {/* Header Calendário */}
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700"><CalIcon size={24} /></div>
            <div>
                <h1 className="text-2xl font-bold text-gray-800 capitalize">
                    {MESES[dataAtual.getMonth()]} <span className="text-gray-400">{dataAtual.getFullYear()}</span>
                </h1>
                <p className="text-xs text-gray-500">Agenda Tática Integrada</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => mudarMes(-1)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
            <button onClick={() => setDataAtual(new Date())} className="px-4 py-1 text-sm bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-100">Hoje</button>
            <button onClick={() => mudarMes(1)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight /></button>
          </div>
        </div>

        {/* Grid Calendário */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
            {/* Cabeçalho Dias */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                {DIAS_SEMANA.map(d => <div key={d} className="py-3 text-center text-sm font-bold text-gray-500 uppercase">{d}</div>)}
            </div>
            
            {/* Dias */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                {getDiasNoMes().map((dia, idx) => {
                    if (!dia) return <div key={idx} className="bg-gray-50/50 border-b border-r border-gray-100"></div>;
                    
                    const diaStr = dia.toISOString().split('T')[0];
                    const eventosDia = reunioes.filter(r => r.data_hora.startsWith(diaStr));

                    return (
                        <div key={idx} className="border-b border-r border-gray-100 p-2 min-h-[120px] relative hover:bg-blue-50/20 transition-colors">
                            <span className={`text-sm font-bold ${dia.getDate() === new Date().getDate() && dia.getMonth() === new Date().getMonth() ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-700'}`}>
                                {dia.getDate()}
                            </span>
                            <div className="mt-1 space-y-1">
                                {eventosDia.map(ev => (
                                    <div 
                                        key={ev.id}
                                        onClick={() => navigate(`/reunioes/${ev.id}`)}
                                        className="text-[10px] px-2 py-1 rounded truncate cursor-pointer font-medium text-gray-800 shadow-sm hover:opacity-80 transition-opacity"
                                        style={{ backgroundColor: ev.cor || '#E5E7EB' }}
                                        title={ev.titulo}
                                    >
                                        {new Date(ev.data_hora).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} • {ev.titulo}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReunioesCalendario;

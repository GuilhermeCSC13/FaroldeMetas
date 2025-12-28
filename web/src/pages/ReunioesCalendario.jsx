import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, List, Grid, X, Clock, Edit2, ArrowRight } from 'lucide-react';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const ReunioesCalendario = () => {
  const navigate = useNavigate();
  const [dataAtual, setDataAtual] = useState(new Date(2026, 0, 1));
  const [reunioes, setReunioes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  
  // Estado do Modal de Edição Rápida
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', time: '' });

  useEffect(() => {
    fetchReunioesMes();
  }, [dataAtual]);

  const fetchReunioesMes = async () => {
    setLoading(true);
    const start = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1).toISOString();
    const end = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0, 23, 59, 59).toISOString();

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

  // --- LÓGICA DE EDIÇÃO ---
  const handleEventClick = (e, evento) => {
    e.stopPropagation();
    const dt = new Date(evento.data_hora);
    setSelectedEvent(evento);
    setEditForm({
        date: dt.toISOString().split('T')[0],
        time: dt.toTimeString().substring(0, 5)
    });
    setModalOpen(true);
  };

  const salvarAlteracao = async () => {
    if(!selectedEvent) return;
    
    const novaDataHora = new Date(`${editForm.date}T${editForm.time}:00`);
    const { error } = await supabase
        .from('reunioes')
        .update({ data_hora: novaDataHora })
        .eq('id', selectedEvent.id);

    if(!error) {
        setModalOpen(false);
        fetchReunioesMes(); // Recarrega
    } else {
        alert("Erro ao remarcar.");
    }
  };

  const irParaDetalhes = () => {
    navigate(`/reunioes/${selectedEvent.id}`);
  };

  // --- RENDERIZAÇÃO ---
  const getDiasNoMes = () => {
    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const diasTotal = new Date(ano, mes + 1, 0).getDate();
    const dias = [];
    for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
    for (let i = 1; i <= diasTotal; i++) dias.push(new Date(ano, mes, i));
    return dias;
  };

  return (
    <Layout>
      <div className="p-6 h-full flex flex-col font-sans bg-gray-50 relative">
        
        {/* Header e Controles */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700"><CalIcon size={24} /></div>
            <div>
                <h1 className="text-2xl font-bold text-gray-800 capitalize">
                    {MESES[dataAtual.getMonth()]} <span className="text-gray-400">{dataAtual.getFullYear()}</span>
                </h1>
                <p className="text-xs text-gray-500">Agenda Tática Integrada</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Toggle de Visualização */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md flex items-center gap-2 text-sm font-bold transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}
                >
                    <Grid size={16} /> Grade
                </button>
                <button 
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md flex items-center gap-2 text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}
                >
                    <List size={16} /> Lista
                </button>
            </div>

            <div className="w-px h-8 bg-gray-200"></div>

            <div className="flex items-center gap-2">
                <button onClick={() => mudarMes(-1)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
                <button onClick={() => setDataAtual(new Date())} className="px-4 py-1 text-sm bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-100">Hoje</button>
                <button onClick={() => mudarMes(1)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight /></button>
            </div>
          </div>
        </div>

        {/* --- CONTEÚDO PRINCIPAL --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
            
            {/* MODO GRADE (CALENDÁRIO) */}
            {viewMode === 'grid' && (
                <>
                    <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                        {DIAS_SEMANA.map(d => <div key={d} className="py-3 text-center text-sm font-bold text-gray-500 uppercase">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
                        {getDiasNoMes().map((dia, idx) => {
                            if (!dia) return <div key={idx} className="bg-gray-50/50 border-b border-r border-gray-100"></div>;
                            
                            const diaStr = dia.toISOString().split('T')[0];
                            const eventosDia = reunioes.filter(r => r.data_hora.startsWith(diaStr));
                            const isToday = dia.toDateString() === new Date().toDateString();

                            return (
                                <div key={idx} className="border-b border-r border-gray-100 p-1 min-h-[100px] relative hover:bg-blue-50/20 transition-colors group">
                                    <span className={`text-sm font-bold ml-1 ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-700'}`}>
                                        {dia.getDate()}
                                    </span>
                                    <div className="mt-1 flex flex-col gap-1 overflow-y-auto max-h-[100px] custom-scrollbar">
                                        {eventosDia.map(ev => (
                                            <div 
                                                key={ev.id}
                                                onClick={(e) => handleEventClick(e, ev)}
                                                className="text-[10px] px-2 py-1 rounded cursor-pointer font-semibold text-gray-800 shadow-sm hover:opacity-80 transition-opacity truncate border-l-4 border-black/10 flex items-center justify-between"
                                                style={{ backgroundColor: ev.cor || '#E5E7EB' }}
                                                title={ev.titulo}
                                            >
                                                <span className="truncate">{ev.titulo}</span>
                                                <span className="opacity-60 text-[9px]">{new Date(ev.data_hora).getHours()}:{String(new Date(ev.data_hora).getMinutes()).padStart(2,'0')}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* MODO LISTA (AGENDA) */}
            {viewMode === 'list' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {getDiasNoMes().filter(d => d !== null).map((dia) => {
                        const diaStr = dia.toISOString().split('T')[0];
                        const eventosDia = reunioes.filter(r => r.data_hora.startsWith(diaStr));
                        if(eventosDia.length === 0) return null;

                        return (
                            <div key={diaStr} className="flex gap-4">
                                <div className="w-24 text-right pt-2">
                                    <p className="text-2xl font-bold text-gray-800">{dia.getDate()}</p>
                                    <p className="text-sm text-gray-400 uppercase font-bold">{DIAS_SEMANA[dia.getDay()]}</p>
                                </div>
                                <div className="flex-1 space-y-3 pb-6 border-l-2 border-gray-100 pl-6">
                                    {eventosDia.map(ev => (
                                        <div key={ev.id} onClick={(e) => handleEventClick(e, ev)} className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ev.cor || 'gray' }}></div>
                                                <div>
                                                    <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{ev.titulo}</h3>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Clock size={12}/> {new Date(ev.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {ev.tipo_reuniao}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-gray-300 group-hover:text-blue-500">
                                                <Edit2 size={16} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {reunioes.length === 0 && <p className="text-center text-gray-400 py-20">Nenhuma reunião neste mês.</p>}
                </div>
            )}
        </div>

        {/* MODAL DE EDIÇÃO RÁPIDA / DETALHES */}
        {modalOpen && selectedEvent && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800">Gerenciar Reunião</h3>
                        <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                    </div>
                    
                    <div className="p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">{selectedEvent.titulo}</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarcar Data</label>
                                <input 
                                    type="date" 
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-100 outline-none"
                                    value={editForm.date}
                                    onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarcar Horário</label>
                                <input 
                                    type="time" 
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-100 outline-none"
                                    value={editForm.time}
                                    onChange={(e) => setEditForm({...editForm, time: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button 
                                onClick={salvarAlteracao} 
                                className="flex-1 bg-gray-800 text-white py-2.5 rounded-lg font-bold hover:bg-gray-900 transition-colors text-sm"
                            >
                                Salvar Mudança
                            </button>
                            <button 
                                onClick={irParaDetalhes} 
                                className="flex-1 bg-blue-50 text-blue-700 border border-blue-200 py-2.5 rounded-lg font-bold hover:bg-blue-100 transition-colors text-sm flex items-center justify-center gap-2"
                            >
                                Abrir Ata <ArrowRight size={16}/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>
    </Layout>
  );
};

export default ReunioesCalendario;

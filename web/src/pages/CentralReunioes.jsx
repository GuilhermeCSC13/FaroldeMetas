import React, { useState, useEffect } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, ChevronRight, Plus, Calendar as CalIcon, List, 
  Clock, MapPin, MoreVertical, X, Repeat 
} from 'lucide-react';
import { salvarReuniao, atualizarReuniao } from '../services/agendaService'; // Importe o serviço criado

export default function CentralReunioes() {
  const [view, setView] = useState('calendar'); // 'calendar' | 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reunioes, setReunioes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Criar/Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReuniao, setEditingReuniao] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    titulo: '', tipo_reuniao: 'Geral', data: '', hora: '09:00', cor: '#3B82F6', recorrencia: 'unica'
  });

  useEffect(() => {
    fetchReunioes();
  }, [currentDate]); // Recarrega ao mudar o mês

  const fetchReunioes = async () => {
    setLoading(true);
    // Busca abrangente (poderia filtrar por mês para otimizar)
    const { data } = await supabase.from('reunioes').select('*').order('data_hora');
    setReunioes(data || []);
    setLoading(false);
  };

  // --- Lógica do Calendário ---
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const onDateClick = (day) => {
    setFormData({ ...formData, data: format(day, 'yyyy-MM-dd') });
    setIsModalOpen(true);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  // --- Ações do Formulário ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataCompleta = new Date(`${formData.data}T${formData.hora}:00`);
    
    const dados = {
      titulo: formData.titulo,
      tipo_reuniao: formData.tipo_reuniao,
      data_hora: dataCompleta.toISOString(),
      cor: formData.cor,
      area_id: 4 // Padrão ou criar seletor
    };

    if (editingReuniao) {
      // Lógica de edição
      const aplicarSerie = window.confirm("Deseja aplicar essa alteração para TODAS as reuniões futuras desta série?");
      await atualizarReuniao(editingReuniao.id, dados, aplicarSerie);
    } else {
      // Criação nova com recorrência
      await salvarReuniao(dados, formData.recorrencia);
    }

    setIsModalOpen(false);
    setEditingReuniao(null);
    fetchReunioes(); // Atualiza tela
  };

  const handleEdit = (reuniao) => {
    const dt = new Date(reuniao.data_hora);
    setFormData({
      titulo: reuniao.titulo,
      tipo_reuniao: reuniao.tipo_reuniao,
      data: format(dt, 'yyyy-MM-dd'),
      hora: format(dt, 'HH:mm'),
      cor: reuniao.cor,
      recorrencia: 'unica' // Edição padrão mostra única
    });
    setEditingReuniao(reuniao);
    setIsModalOpen(true);
  };

  return (
    <Layout>
      <div className="flex flex-col h-screen p-6 bg-slate-50 font-sans overflow-hidden">
        
        {/* Header Toolbar */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Agenda Tática</h1>
            <p className="text-sm text-slate-500">Gestão visual de rituais e alinhamentos.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white border p-1 rounded-lg flex shadow-sm">
              <button onClick={() => setView('calendar')} className={`p-2 rounded ${view === 'calendar' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><CalIcon size={18}/></button>
              <button onClick={() => setView('list')} className={`p-2 rounded ${view === 'list' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><List size={18}/></button>
            </div>
            <button 
              onClick={() => { setEditingReuniao(null); setIsModalOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md active:scale-95 transition-all"
            >
              <Plus size={18} /> Nova Reunião
            </button>
          </div>
        </div>

        {/* --- VIEW: CALENDÁRIO --- */}
        {view === 'calendar' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            {/* Nav Mês */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-700 capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft /></button>
                <button onClick={() => setCurrentDate(new Date())} className="text-sm font-bold text-blue-600 px-3">Hoje</button>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight /></button>
              </div>
            </div>

            {/* Dias da Semana */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Grid Dias */}
            <div className="grid grid-cols-7 grid-rows-5 flex-1">
              {calendarDays.map((day, idx) => {
                const isCurrentMonth = isSameMonth(day, monthStart);
                const dayMeetings = reunioes.filter(r => isSameDay(new Date(r.data_hora), day));

                return (
                  <div 
                    key={day.toString()} 
                    onClick={() => onDateClick(day)}
                    className={`border-r border-b border-slate-50 p-2 min-h-[100px] transition-colors hover:bg-slate-50 cursor-pointer flex flex-col gap-1 ${!isCurrentMonth ? 'bg-slate-50/50 text-slate-300' : 'bg-white'}`}
                  >
                    <span className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    
                    {dayMeetings.map(m => (
                      <div 
                        key={m.id}
                        onClick={(e) => { e.stopPropagation(); handleEdit(m); }}
                        className="text-[10px] truncate px-1.5 py-0.5 rounded border-l-2 shadow-sm hover:scale-105 transition-transform"
                        style={{ borderLeftColor: m.cor, backgroundColor: m.cor + '20', color: '#334155' }}
                      >
                        {format(new Date(m.data_hora), 'HH:mm')} {m.titulo}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- VIEW: LISTA (Estilo Agenda) --- */}
        {view === 'list' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-y-auto p-4 custom-scrollbar">
            {reunioes.filter(r => new Date(r.data_hora) >= new Date()).map(r => (
               <div key={r.id} onClick={() => handleEdit(r)} className="flex items-center gap-4 p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex flex-col items-center justify-center w-14 h-14 bg-slate-100 rounded-lg text-slate-600">
                     <span className="text-xs font-bold uppercase">{format(new Date(r.data_hora), 'MMM', { locale: ptBR })}</span>
                     <span className="text-xl font-bold">{format(new Date(r.data_hora), 'dd')}</span>
                  </div>
                  <div className="flex-1">
                     <h3 className="font-bold text-slate-800">{r.titulo}</h3>
                     <p className="text-sm text-slate-500 flex items-center gap-2">
                        <Clock size={14}/> {format(new Date(r.data_hora), 'HH:mm')} • {r.tipo_reuniao}
                     </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${r.status === 'Realizada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                     {r.status}
                  </div>
               </div>
            ))}
          </div>
        )}

      </div>

      {/* --- MODAL DE CRIAÇÃO / EDIÇÃO --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">{editingReuniao ? 'Editar Reunião' : 'Agendar Reunião'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} placeholder="Ex: DBO Operacional" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                   <input type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                     value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora</label>
                   <input type="time" required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                     value={formData.hora} onChange={e => setFormData({...formData, hora: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo / Série</label>
                   <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm"
                     value={formData.tipo_reuniao} onChange={e => setFormData({...formData, tipo_reuniao: e.target.value})} placeholder="Ex: Mensal" />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cor</label>
                   <input type="color" className="w-full h-10 p-1 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                     value={formData.cor} onChange={e => setFormData({...formData, cor: e.target.value})} />
                </div>
              </div>

              {!editingReuniao && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <label className="block text-xs font-bold text-blue-800 uppercase mb-2 flex items-center gap-1"><Repeat size={12}/> Recorrência</label>
                  <div className="flex gap-2">
                    {['unica', 'semanal', 'quinzenal', 'mensal'].map(tipo => (
                      <button 
                        key={tipo}
                        type="button"
                        onClick={() => setFormData({...formData, recorrencia: tipo})}
                        className={`px-3 py-1.5 text-xs font-medium rounded capitalize border transition-all ${formData.recorrencia === tipo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-blue-600 mt-2 italic">
                    {formData.recorrencia !== 'unica' ? `O sistema criará ocorrências automáticas para os próximos meses.` : 'Apenas uma reunião será criada.'}
                  </p>
                </div>
              )}

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg active:scale-[0.98] transition-all">
                {editingReuniao ? 'Salvar Alterações' : 'Agendar Reunião'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

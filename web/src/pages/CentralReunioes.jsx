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
  X, Repeat, User, AlignLeft, Save, Trash2
} from 'lucide-react';
import { salvarReuniao, atualizarReuniao } from '../services/agendaService';

export default function CentralReunioes() {
  const [view, setView] = useState('calendar'); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reunioes, setReunioes] = useState([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReuniao, setEditingReuniao] = useState(null);
  const [activeTab, setActiveTab] = useState('detalhes'); 
  
  const [formData, setFormData] = useState({
    titulo: '', 
    tipo_reuniao: 'Geral', 
    data: '', 
    hora: '09:00', 
    cor: '#3B82F6', 
    responsavel: '',
    pauta: '', 
    recorrencia: 'unica'
  });

  useEffect(() => {
    fetchReunioes();
  }, [currentDate]);

  const fetchReunioes = async () => {
    const { data } = await supabase.from('reunioes').select('*').order('data_hora');
    setReunioes(data || []);
  };

  // --- Helpers de Calendário ---
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  
  const onDateClick = (day) => {
    setEditingReuniao(null);
    setFormData({ 
        titulo: '', tipo_reuniao: 'Geral', data: format(day, 'yyyy-MM-dd'), hora: '09:00', 
        cor: '#3B82F6', responsavel: '', pauta: '', recorrencia: 'unica' 
    });
    setActiveTab('detalhes');
    setIsModalOpen(true);
  };

  const handleEdit = (reuniao) => {
    // CORREÇÃO DE FUSO: Usar parseISO garante que a string UTC do banco
    // seja convertida corretamente para o horário local do navegador.
    const dt = parseISO(reuniao.data_hora);
    
    setFormData({
      titulo: reuniao.titulo,
      tipo_reuniao: reuniao.tipo_reuniao,
      data: format(dt, 'yyyy-MM-dd'),
      hora: format(dt, 'HH:mm'), 
      cor: reuniao.cor,
      responsavel: reuniao.responsavel || '',
      pauta: reuniao.pauta || '',
      recorrencia: 'unica'
    });
    setEditingReuniao(reuniao);
    setActiveTab('ata');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // CORREÇÃO: Cria a data combinando Data + Hora explicitamente
    // Isso cria um objeto Date com o fuso horário do seu computador (Brasil)
    const dataCombined = new Date(`${formData.data}T${formData.hora}:00`);
    
    // Converte para ISO string (UTC) para o Supabase entender e salvar corretamente
    const dataHoraIso = dataCombined.toISOString();
    
    const dados = {
      titulo: formData.titulo,
      tipo_reuniao: formData.tipo_reuniao,
      data_hora: dataHoraIso,
      cor: formData.cor,
      responsavel: formData.responsavel,
      pauta: formData.pauta,
      area_id: 4 
    };

    if (editingReuniao) {
      const aplicarSerie = window.confirm("Você alterou esta reunião. Deseja aplicar as mudanças (exceto data/hora) para todas as futuras desta série?");
      await atualizarReuniao(editingReuniao.id, dados, aplicarSerie);
    } else {
      await salvarReuniao(dados, formData.recorrencia);
    }

    setIsModalOpen(false);
    fetchReunioes();
  };

  // Calendário Render Logic
  const monthStart = startOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endOfWeek(endOfMonth(monthStart)) });

  return (
    <Layout>
      <div className="flex flex-col h-screen p-6 bg-slate-50 font-sans overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Calendário Tático</h1>
            <p className="text-sm text-slate-500">Agendamento e controle de rituais.</p>
          </div>
          <div className="flex gap-2">
             <div className="bg-white border p-1 rounded-lg flex shadow-sm">
              <button onClick={() => setView('calendar')} className={`p-2 rounded ${view === 'calendar' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><CalIcon size={18}/></button>
              <button onClick={() => setView('list')} className={`p-2 rounded ${view === 'list' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><List size={18}/></button>
            </div>
            <button onClick={() => onDateClick(new Date())} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md">
              <Plus size={18} /> Nova
            </button>
          </div>
        </div>

        {/* --- VIEW: CALENDÁRIO --- */}
        {view === 'calendar' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
             {/* Navegação Mês */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-700 capitalize">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h2>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft /></button>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight /></button>
              </div>
            </div>
            
            {/* Cabeçalho Dias */}
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 grid-rows-5 flex-1">
              {calendarDays.map((day) => {
                // CORREÇÃO: Usa parseISO para comparar corretamente o dia
                const dayMeetings = reunioes.filter(r => isSameDay(parseISO(r.data_hora), day));
                const isCurrent = isSameMonth(day, monthStart);
                return (
                  <div key={day.toString()} onClick={() => onDateClick(day)} className={`border-r border-b border-slate-50 p-1 cursor-pointer hover:bg-blue-50/30 transition-colors flex flex-col gap-1 ${!isCurrent ? 'bg-slate-50/50 opacity-50' : ''}`}>
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{format(day, 'd')}</span>
                    {dayMeetings.map(m => (
                      <div key={m.id} onClick={(e) => { e.stopPropagation(); handleEdit(m); }} className="text-[10px] truncate px-1 rounded border-l-2 font-medium" style={{ borderLeftColor: m.cor, backgroundColor: m.cor + '15', color: '#475569' }}>
                        {/* parseISO aqui também */}
                        {format(parseISO(m.data_hora), 'HH:mm')} {m.titulo}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- VIEW: LISTA --- */}
        {view === 'list' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-y-auto p-4 custom-scrollbar">
             {reunioes.map(r => {
                const dt = parseISO(r.data_hora);
                return (
                  <div key={r.id} onClick={() => handleEdit(r)} className="flex items-center gap-4 p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                      <div className="w-12 text-center">
                        <div className="text-xs font-bold uppercase text-slate-400">{format(dt, 'MMM', { locale: ptBR })}</div>
                        <div className="text-xl font-bold text-slate-800">{format(dt, 'dd')}</div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800">{r.titulo}</h4>
                        <p className="text-xs text-slate-500">{r.responsavel ? `Resp: ${r.responsavel}` : 'Sem responsável'} • {format(dt, 'HH:mm')}</p>
                      </div>
                  </div>
               )
             })}
          </div>
        )}
      </div>

      {/* --- MODAL WIDE (GRANDE) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            
            {/* Header do Modal */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {editingReuniao ? 'Editar Reunião' : 'Nova Reunião'}
              </h2>
              <div className="flex gap-2">
                {/* Abas */}
                <div className="flex bg-slate-200 p-1 rounded-lg mr-4">
                    <button onClick={() => setActiveTab('detalhes')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'detalhes' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>Detalhes</button>
                    <button onClick={() => setActiveTab('ata')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'ata' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>Ata / Pauta</button>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X size={20} className="text-slate-500"/></button>
              </div>
            </div>

            {/* Corpo do Modal (Scrollável) */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col md:flex-row overflow-hidden">
                
                {/* COLUNA ESQUERDA: Detalhes */}
                <div className={`flex-1 p-8 overflow-y-auto border-r border-slate-100 ${activeTab === 'ata' ? 'hidden md:block' : ''}`}>
                    <div className="space-y-6 max-w-lg mx-auto">
                        
                        <div>
                            <label className="label-form">Título da Reunião</label>
                            <input required className="input-form text-lg font-bold" value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} placeholder="Ex: Reunião Mensal de Resultados" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label-form">Data</label>
                                <input type="date" required className="input-form" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} />
                            </div>
                            <div>
                                <label className="label-form">Hora</label>
                                <input type="time" required className="input-form" value={formData.hora} onChange={e => setFormData({...formData, hora: e.target.value})} />
                            </div>
                        </div>

                        <div>
                            <label className="label-form">Responsável (Organizador)</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input className="input-form pl-10" value={formData.responsavel} onChange={e => setFormData({...formData, responsavel: e.target.value})} placeholder="Quem está liderando?" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label-form">Tipo / Categoria</label>
                                <input className="input-form" value={formData.tipo_reuniao} onChange={e => setFormData({...formData, tipo_reuniao: e.target.value})} list="tipos" />
                                <datalist id="tipos">
                                    <option value="Operacional" /><option value="Estratégica" /><option value="Feedback" /><option value="Treinamento" />
                                </datalist>
                            </div>
                            <div>
                                <label className="label-form">Cor na Agenda</label>
                                <div className="flex items-center gap-2 h-11">
                                    <input type="color" className="w-10 h-10 rounded border-none cursor-pointer" value={formData.cor} onChange={e => setFormData({...formData, cor: e.target.value})} />
                                    <span className="text-xs text-slate-400">Clique para escolher</span>
                                </div>
                            </div>
                        </div>

                        {!editingReuniao && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <label className="label-form text-blue-800 flex items-center gap-2"><Repeat size={14}/> Recorrência</label>
                                <div className="flex gap-2 mt-2">
                                    {['unica', 'semanal', 'mensal'].map(t => (
                                        <button key={t} type="button" onClick={() => setFormData({...formData, recorrencia: t})} className={`px-3 py-1 text-xs font-bold rounded uppercase ${formData.recorrencia === t ? 'bg-blue-600 text-white' : 'bg-white border text-slate-500'}`}>{t}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUNA DIREITA: ATA / PAUTA */}
                <div className={`flex-1 bg-slate-50/50 p-8 flex flex-col ${activeTab === 'detalhes' ? 'hidden md:flex' : 'flex'}`}>
                    <label className="label-form flex items-center gap-2 mb-2">
                        <AlignLeft size={16}/> Ata da Reunião / Pauta
                        <span className="text-xs font-normal text-slate-400 ml-auto">Markdown suportado</span>
                    </label>
                    <textarea 
                        className="flex-1 w-full bg-white border border-slate-200 rounded-xl p-6 text-slate-700 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-sm"
                        placeholder="Digite aqui os tópicos discutidos, decisões tomadas e próximos passos..."
                        value={formData.pauta}
                        onChange={e => setFormData({...formData, pauta: e.target.value})}
                    ></textarea>
                </div>

            </form>

            {/* Footer Ações */}
            <div className="bg-white p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                {editingReuniao && (
                    <button type="button" className="mr-auto text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-2 px-4">
                        <Trash2 size={16} /> Excluir
                    </button>
                )}
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button onClick={handleSubmit} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg flex items-center gap-2">
                    <Save size={18}/> Salvar Reunião
                </button>
            </div>

          </div>
        </div>
      )}

      {/* CSS Helper Local */}
      <style>{`
        .label-form { @apply block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide; }
        .input-form { @apply w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all; }
      `}</style>
    </Layout>
  );
}

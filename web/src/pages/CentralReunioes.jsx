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
  const [view, setView] = useState('calendar'); // 'calendar' | 'week' | 'list'
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

  // Drag & drop
  const [draggingReuniao, setDraggingReuniao] = useState(null);

  useEffect(() => {
    fetchReunioes();
  }, [currentDate]);

  const fetchReunioes = async () => {
    const { data } = await supabase
      .from('reunioes')
      .select('*')
      .order('data_hora');
    setReunioes(data || []);
  };

  // --- Helper para ignorar fuso horário (Visual = Banco) ---
  const parseDataLocal = (dataString) => {
    if (!dataString) return new Date();
    // Pega apenas os primeiros 19 caracteres (YYYY-MM-DDTHH:mm:ss) ignorando o 'Z' ou offset
    return parseISO(dataString.substring(0, 19));
  };

  const resumoPauta = (pauta) => {
    if (!pauta) return '';
    const clean = pauta.replace(/[#*_>\-]/g, ' ').replace(/\s+/g, ' ').trim();
    return clean.length > 140 ? clean.slice(0, 140) + '...' : clean;
  };

  // --- Helpers de Calendário ---
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  
  const onDateClick = (day) => {
    setEditingReuniao(null);
    setFormData({ 
      titulo: '', 
      tipo_reuniao: 'Geral', 
      data: format(day, 'yyyy-MM-dd'), 
      hora: '09:00', 
      cor: '#3B82F6', 
      responsavel: '', 
      pauta: '', 
      recorrencia: 'unica' 
    });
    setActiveTab('detalhes');
    setIsModalOpen(true);
  };

  const handleEdit = (reuniao) => {
    const dt = parseDataLocal(reuniao.data_hora);
    
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
    
    // grava como string "local" sem .toISOString()
    const dataHoraIso = `${formData.data}T${formData.hora}:00`;
    
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
      const aplicarSerie = window.confirm(
        'Você alterou esta reunião. Deseja aplicar as mudanças (exceto data/hora) para todas as futuras desta série?'
      );
      await atualizarReuniao(editingReuniao.id, dados, aplicarSerie);
    } else {
      await salvarReuniao(dados, formData.recorrencia);
    }

    setIsModalOpen(false);
    fetchReunioes();
  };

  const monthStart = startOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endOfWeek(endOfMonth(monthStart)),
  });

  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const reunioesDoDia = (day) =>
    reunioes.filter((r) => isSameDay(parseDataLocal(r.data_hora), day));

  // --- Drag & Drop ---
  const handleDragStart = (e, reuniao) => {
    setDraggingReuniao(reuniao);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingReuniao(null);
  };

  const handleDragOverDay = (e) => {
    e.preventDefault();
  };

  const handleDropOnDay = async (e, day) => {
    e.preventDefault();
    if (!draggingReuniao) return;

    try {
      const dtOrig = parseDataLocal(draggingReuniao.data_hora);
      const novaDataHora = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        dtOrig.getHours(),
        dtOrig.getMinutes(),
        dtOrig.getSeconds()
      );

      const novaIso = `${format(novaDataHora, 'yyyy-MM-dd')}T${format(
        novaDataHora,
        'HH:mm:ss'
      )}`;

      const { error } = await supabase
        .from('reunioes')
        .update({ data_hora: novaIso })
        .eq('id', draggingReuniao.id);

      if (error) throw error;

      // Atualiza localmente
      setReunioes((prev) =>
        prev.map((r) =>
          r.id === draggingReuniao.id ? { ...r, data_hora: novaIso } : r
        )
      );
    } catch (err) {
      console.error(err);
      alert('Erro ao mover reunião.');
    } finally {
      setDraggingReuniao(null);
    }
  };

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
              <button
                onClick={() => setView('calendar')}
                className={`p-2 rounded ${
                  view === 'calendar' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'
                }`}
              >
                <CalIcon size={18} />
              </button>
              <button
                onClick={() => setView('week')}
                className={`p-2 rounded ${
                  view === 'week' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'
                }`}
              >
                S
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 rounded ${
                  view === 'list' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'
                }`}
              >
                <List size={18} />
              </button>
            </div>
            <button
              onClick={() => onDateClick(new Date())}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md"
            >
              <Plus size={18} /> Nova
            </button>
          </div>
        </div>

        {/* --- VIEW: CALENDÁRIO MENSAL --- */}
        {view === 'calendar' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            {/* Navegação Mês */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-700 capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={prevMonth}
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <ChevronLeft />
                </button>
                <button
                  onClick={nextMonth}
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
            
            {/* Cabeçalho Dias */}
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-bold text-slate-400 uppercase"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grid Mensal */}
            <div className="grid grid-cols-7 flex-1">
              {calendarDays.map((day) => {
                const dayMeetings = reunioesDoDia(day);
                const isCurrent = isSameMonth(day, monthStart);

                return (
                  <div
                    key={day.toString()}
                    onClick={() => onDateClick(day)}
                    onDragOver={handleDragOverDay}
                    onDrop={(e) => handleDropOnDay(e, day)}
                    className={`border-r border-b border-slate-50 p-1 cursor-pointer hover:bg-blue-50/30 transition-colors flex flex-col gap-1 ${
                      !isCurrent ? 'bg-slate-50/50 opacity-50' : ''
                    }`}
                  >
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isSameDay(day, new Date())
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayMeetings.map((m) => {
                      const dt = parseDataLocal(m.data_hora);
                      return (
                        <div
                          key={m.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, m)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(m);
                          }}
                          className="text-[10px] truncate px-1 rounded border-l-2 font-medium"
                          style={{
                            borderLeftColor: m.cor,
                            backgroundColor: m.cor + '15',
                            color: '#475569',
                          }}
                        >
                          {format(dt, 'HH:mm')} {m.titulo}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- VIEW: SEMANAL (GRADE + LISTA POR DIA) --- */}
        {view === 'week' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            {/* Cabeçalho Semana */}
            <div className="flex items-center justify_between p-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-700">
                Semana de {format(weekStart, 'dd/MM', { locale: ptBR })} a{' '}
                {format(weekEnd, 'dd/MM', { locale: ptBR })}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <ChevronLeft />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg border border-blue-100 font-bold"
                >
                  Hoje
                </button>
                <button
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>

            {/* Grade semanal */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-bold text-slate-400 uppercase"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-b border-slate-100">
              {weekDays.map((day) => {
                const dayMeetings = reunioesDoDia(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toString()}
                    onClick={() => onDateClick(day)}
                    onDragOver={handleDragOverDay}
                    onDrop={(e) => handleDropOnDay(e, day)}
                    className="border-r border-slate-100 p-2 min-h-[110px] hover:bg-blue-50/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-bold ${
                          isToday ? 'text-blue-700' : 'text-slate-600'
                        }`}
                      >
                        {format(day, 'd/MM')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 max-h-[80px] overflow-y-auto custom-scrollbar">
                      {dayMeetings.map((m) => {
                        const dt = parseDataLocal(m.data_hora);
                        return (
                          <div
                            key={m.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, m)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(m);
                            }}
                            className="text-[10px] px-2 py-1 rounded border-l-2 font-semibold truncate"
                            style={{
                              borderLeftColor: m.cor,
                              backgroundColor: m.cor + '15',
                              color: '#475569',
                            }}
                          >
                            {format(dt, 'HH:mm')} {m.titulo}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lista da semana separada por dia */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {weekDays.map((day) => {
                const dayMeetings = reunioesDoDia(day);
                if (dayMeetings.length === 0) return null;

                return (
                  <div key={day.toString()} className="flex gap-4">
                    <div className="w-20 text-right pt-2">
                      <p className="text-2xl font-bold text-slate-800">
                        {format(day, 'dd')}
                      </p>
                      <p className="text-xs text-slate-400 uppercase font-bold">
                        {format(day, 'EEE', { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex-1 border-l-2 border-slate-100 pl-4 space-y-3 pb-4">
                      {dayMeetings.map((m) => {
                        const dt = parseDataLocal(m.data_hora);
                        return (
                          <div
                            key={m.id}
                            onClick={() => handleEdit(m)}
                            className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-slate-800">
                                  {m.titulo}
                                </h4>
                                <p className="text-xs text-slate-500">
                                  {format(dt, 'HH:mm')} • {m.tipo_reuniao}
                                  {m.responsavel
                                    ? ` • Resp: ${m.responsavel}`
                                    : ''}
                                </p>
                              </div>
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: m.cor || '#64748b' }}
                              />
                            </div>
                            {m.pauta && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {resumoPauta(m.pauta)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- VIEW: LISTA MENSAL --- */}
        {view === 'list' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-y-auto p-4 custom-scrollbar">
            {reunioes.map((r) => {
              const dt = parseDataLocal(r.data_hora);
              return (
                <div
                  key={r.id}
                  onClick={() => handleEdit(r)}
                  className="flex items-start gap-4 p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                >
                  <div className="w-12 text-center">
                    <div className="text-xs font-bold uppercase text-slate-400">
                      {format(dt, 'MMM', { locale: ptBR })}
                    </div>
                    <div className="text-xl font-bold text-slate-800">
                      {format(dt, 'dd')}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{r.titulo}</h4>
                    <p className="text-xs text-slate-500">
                      {format(dt, 'HH:mm')} • {r.tipo_reuniao}
                      {r.responsavel ? ` • Resp: ${r.responsavel}` : ''}
                    </p>
                    {r.pauta && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {resumoPauta(r.pauta)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {reunioes.length === 0 && (
              <p className="text-center text-slate-400 py-16">
                Nenhuma reunião cadastrada.
              </p>
            )}
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
                  <button
                    onClick={() => setActiveTab('detalhes')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${
                      activeTab === 'detalhes'
                        ? 'bg-white shadow text-blue-700'
                        : 'text-slate-500'
                    }`}
                  >
                    Detalhes
                  </button>
                  <button
                    onClick={() => setActiveTab('ata')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${
                      activeTab === 'ata'
                        ? 'bg-white shadow text-blue-700'
                        : 'text-slate-500'
                    }`}
                  >
                    Ata / Pauta
                  </button>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* Corpo do Modal (Scrollável) */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 flex flex-col md:flex-row overflow-hidden"
            >
              {/* COLUNA ESQUERDA: Detalhes (AJUSTADA) */}
              <div
                className={`flex-1 p-8 overflow-y-auto border-r border-slate-100 ${
                  activeTab === 'ata' ? 'hidden md:block' : ''
                }`}
              >
                <div className="space-y-6 max-w-xl mx-auto">
                  
                  {/* Header interno */}
                  <div>
                    <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase mb-1">
                      Detalhes da reunião
                    </p>
                    <input
                      required
                      className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-lg font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
                      value={formData.titulo}
                      onChange={(e) =>
                        setFormData({ ...formData, titulo: e.target.value })
                      }
                      placeholder="Ex: Reunião Mensal de Resultados"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Defina um título claro que identifique a pauta principal da reunião.
                    </p>
                  </div>

                  {/* Card de Informações */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    {/* Linha Data / Hora */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label-form">Data</label>
                        <input
                          type="date"
                          required
                          className="input-form"
                          value={formData.data}
                          onChange={(e) =>
                            setFormData({ ...formData, data: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="label-form">Hora</label>
                        <input
                          type="time"
                          required
                          className="input-form"
                          value={formData.hora}
                          onChange={(e) =>
                            setFormData({ ...formData, hora: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {/* Linha Responsável / Tipo */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label-form">Responsável (Organizador)</label>
                        <div className="relative">
                          <User
                            className="absolute left-3 top-3 text-slate-400"
                            size={18}
                          />
                          <input
                            className="input-form pl-10"
                            value={formData.responsavel}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                responsavel: e.target.value,
                              })
                            }
                            placeholder="Quem está liderando?"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label-form">Tipo / Categoria</label>
                        <input
                          className="input-form"
                          value={formData.tipo_reuniao}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              tipo_reuniao: e.target.value,
                            })
                          }
                          list="tipos"
                        />
                        <datalist id="tipos">
                          <option value="Operacional" />
                          <option value="Estratégica" />
                          <option value="Feedback" />
                          <option value="Treinamento" />
                        </datalist>
                      </div>
                    </div>

                    {/* Linha Recorrência / Cor */}
                    <div className="grid grid-cols-2 gap-4 items-start">
                      <div>
                        {!editingReuniao && (
                          <>
                            <label className="label-form flex items-center gap-2">
                              <Repeat size={14} />
                              Recorrência
                            </label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {['unica', 'semanal', 'mensal'].map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() =>
                                    setFormData({ ...formData, recorrencia: t })
                                  }
                                  className={`px-3 py-1 text-[11px] font-bold rounded-full uppercase tracking-wide ${
                                    formData.recorrencia === t
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'bg-white border border-slate-300 text-slate-600'
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                        {editingReuniao && (
                          <>
                            <label className="label-form">Recorrência</label>
                            <p className="text-xs text-slate-400">
                              Edição de recorrência é aplicada pelo fluxo de série na gravação.
                            </p>
                          </>
                        )}
                      </div>
                      <div>
                        <label className="label-form">Cor na agenda</label>
                        <div className="flex items-center gap-3 h-11">
                          <input
                            type="color"
                            className="w-10 h-10 rounded border-none cursor-pointer"
                            value={formData.cor}
                            onChange={(e) =>
                              setFormData({ ...formData, cor: e.target.value })
                            }
                          />
                          <span className="text-xs text-slate-400">
                            A cor será usada nas visões de calendário e lista.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card de Pauta Principal (fixa) */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlignLeft size={16} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                          Pauta principal desta reunião
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Resumo executivo em 1–3 linhas
                      </span>
                    </div>
                    <textarea
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none min-h-[64px]"
                      placeholder="Ex: Revisar indicadores DBO, validar plano de ação de KM/L e tratar pendências de segurança."
                      value={formData.pauta}
                      onChange={(e) =>
                        setFormData({ ...formData, pauta: e.target.value })
                      }
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Este campo será utilizado como resumo em listas e visão semanal.
                    </p>
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA: ATA / PAUTA (igual antes) */}
              <div
                className={`flex-1 bg-slate-50/50 p-8 flex flex-col ${
                  activeTab === 'detalhes' ? 'hidden md:flex' : 'flex'
                }`}
              >
                <label className="label-form flex items-center gap-2 mb-2">
                  <AlignLeft size={16} /> Ata da Reunião / Pauta
                  <span className="text-xs font-normal text-slate-400 ml-auto">
                    Markdown suportado
                  </span>
                </label>
                <textarea
                  className="flex-1 w-full bg-white border border-slate-200 rounded-xl p-6 text-slate-700 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-sm"
                  placeholder="Digite aqui os tópicos discutidos, decisões tomadas e próximos passos..."
                  value={formData.pauta}
                  onChange={(e) =>
                    setFormData({ ...formData, pauta: e.target.value })
                  }
                ></textarea>
              </div>
            </form>

            {/* Footer Ações */}
            <div className="bg-white p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              {editingReuniao && (
                <button
                  type="button"
                  className="mr-auto text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-2 px-4"
                >
                  <Trash2 size={16} /> Excluir
                </button>
              )}
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg flex items-center gap-2"
              >
                <Save size={18} /> Salvar Reunião
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



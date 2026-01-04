import React, { useState, useEffect } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalIcon,
  List,
  X,
  AlignLeft,
  Save,
  Trash2
} from 'lucide-react';
import { salvarReuniao, atualizarReuniao } from '../services/agendaService';
import DetalhesReuniao from '../components/tatico/DetalhesReuniao';

const SENHA_EXCLUSAO = 'KM2026';

export default function CentralReunioes() {
  const [view, setView] = useState('calendar'); // 'calendar' | 'week' | 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reunioes, setReunioes] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReuniao, setEditingReuniao] = useState(null);
  const [activeTab, setActiveTab] = useState('principal');

  const [formData, setFormData] = useState({
    titulo: '',
    tipo_reuniao: 'Geral',
    data: '',
    hora: '09:00',
    cor: '#3B82F6',
    responsavel: '',
    pauta_principal: '',
    ata_acoes: '',
    recorrencia: 'unica',
  });

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

  const parseDataLocal = (dataString) => {
    if (!dataString) return new Date();
    return parseISO(String(dataString).substring(0, 19));
  };

  const splitPauta = (texto) => {
    if (!texto) return { pauta_principal: '', ata_acoes: '' };
    const marker = '\n--- ATA / AÇÕES ---\n';
    const raw = String(texto);
    if (!raw.includes(marker)) return { pauta_principal: '', ata_acoes: raw.trim() };
    const [partePauta, parteAta] = raw.split(marker);
    return {
      pauta_principal: partePauta.replace(/^PAUTA PRINCIPAL\s*/i, '').trim(),
      ata_acoes: parteAta.replace(/^ATA \/ AÇÕES\s*/i, '').trim(),
    };
  };

  const joinPauta = ({ pauta_principal, ata_acoes }) => {
    const partes = [];
    if (pauta_principal?.trim()) partes.push(`PAUTA PRINCIPAL\n${pauta_principal.trim()}`);
    if (ata_acoes?.trim()) partes.push(`--- ATA / AÇÕES ---\n${ata_acoes.trim()}`);
    return partes.join('\n\n');
  };

  const resumoPauta = (pautaBruta) => {
    const { pauta_principal, ata_acoes } = splitPauta(pautaBruta || '');
    const base = pauta_principal || ata_acoes;
    if (!base) return '';
    const clean = base.replace(/[#*_>\-]/g, ' ').replace(/\s+/g, ' ').trim();
    return clean.length > 140 ? clean.slice(0, 140) + '...' : clean;
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const onDateClick = (day) => {
    setEditingReuniao(null);
    setFormData({
      titulo: '', tipo_reuniao: 'Geral', data: format(day, 'yyyy-MM-dd'),
      hora: '09:00', cor: '#3B82F6', responsavel: '',
      pauta_principal: '', ata_acoes: '', recorrencia: 'unica',
    });
    setActiveTab('principal');
    setIsModalOpen(true);
  };

  const handleEdit = (reuniao) => {
    const dt = parseDataLocal(reuniao.data_hora);
    const { pauta_principal, ata_acoes } = splitPauta(reuniao.pauta || '');
    setFormData({
      titulo: reuniao.titulo, tipo_reuniao: reuniao.tipo_reuniao,
      data: format(dt, 'yyyy-MM-dd'), hora: format(dt, 'HH:mm'),
      cor: reuniao.cor, responsavel: reuniao.responsavel || '',
      pauta_principal, ata_acoes, recorrencia: 'unica',
    });
    setEditingReuniao(reuniao);
    setActiveTab('principal');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataHoraIso = `${formData.data}T${formData.hora}:00`;
    const dados = {
      titulo: formData.titulo, tipo_reuniao: formData.tipo_reuniao,
      data_hora: dataHoraIso, cor: formData.cor, responsavel: formData.responsavel,
      pauta: joinPauta(formData), area_id: 4,
    };

    if (editingReuniao) {
      const aplicarSerie = window.confirm('Deseja aplicar as mudanças para as futuras desta série?');
      await atualizarReuniao(editingReuniao.id, dados, aplicarSerie);
    } else {
      await salvarReuniao(dados, formData.recorrencia);
    }
    setIsModalOpen(false);
    fetchReunioes();
  };

  const handleDelete = async () => {
    const senha = window.prompt('Digite a senha para excluir:');
    if (senha !== SENHA_EXCLUSAO) return alert('Senha inválida.');
    await supabase.from('reunioes').delete().eq('id', editingReuniao.id);
    setIsModalOpen(false);
    fetchReunioes();
  };

  // Drag & Drop Handlers
  const handleDragStart = (e, reuniao) => { setDraggingReuniao(reuniao); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragEnd = () => setDraggingReuniao(null);
  const handleDragOverDay = (e) => e.preventDefault();
  const handleDropOnDay = async (e, day) => {
    e.preventDefault();
    if (!draggingReuniao) return;
    try {
      const dtOrig = parseDataLocal(draggingReuniao.data_hora);
      const novaDataHora = `${format(day, 'yyyy-MM-dd')}T${format(dtOrig, 'HH:mm:ss')}`;
      await supabase.from('reunioes').update({ data_hora: novaDataHora }).eq('id', draggingReuniao.id);
      fetchReunioes();
    } catch (err) { alert('Erro ao mover.'); }
  };

  const monthStart = startOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(monthStart)),
  });
  const weekDays = eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) });
  const reunioesDoDia = (day) => reunioes.filter((r) => isSameDay(parseDataLocal(r.data_hora), day));

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
              <button onClick={() => setView('calendar')} className={`p-2 rounded ${view === 'calendar' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><CalIcon size={18} /></button>
              <button onClick={() => setView('week')} className={`p-2 rounded ${view === 'week' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>S</button>
              <button onClick={() => setView('list')} className={`p-2 rounded ${view === 'list' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><List size={18} /></button>
            </div>
            <button onClick={() => onDateClick(new Date())} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"><Plus size={18} /> Nova</button>
          </div>
        </div>

        {/* VIEW: MENSAL */}
        {view === 'calendar' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-700 capitalize">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h2>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft /></button>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 bg-slate-50 border-b">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1">
              {calendarDays.map((day) => (
                <div key={day.toString()} onClick={() => onDateClick(day)} onDragOver={handleDragOverDay} onDrop={(e) => handleDropOnDay(e, day)}
                  className={`border-r border-b border-slate-50 p-1 cursor-pointer hover:bg-blue-50/30 transition-colors flex flex-col gap-1 ${!isSameMonth(day, monthStart) ? 'bg-slate-50/50 opacity-50' : ''}`}>
                  <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{format(day, 'd')}</span>
                  {reunioesDoDia(day).map((m) => (
                    <div key={m.id} draggable onDragStart={(e) => handleDragStart(e, m)} onDragEnd={handleDragEnd} onClick={(e) => { e.stopPropagation(); handleEdit(m); }}
                      className="text-[10px] truncate px-1 rounded border-l-2 font-medium" style={{ borderLeftColor: m.cor, backgroundColor: m.cor + '15', color: '#475569' }}>
                      {format(parseDataLocal(m.data_hora), 'HH:mm')} {m.titulo}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: SEMANAL (GRADE + LISTA) */}
        {view === 'week' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-700 uppercase tracking-tight">Semana {format(weekDays[0], 'dd/MM')} — {format(weekDays[6], 'dd/MM')}</h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft /></button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg font-bold">Hoje</button>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b bg-slate-50">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 uppercase">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 border-b h-32">
              {weekDays.map(day => (
                <div key={day.toString()} onClick={() => onDateClick(day)} onDragOver={handleDragOverDay} onDrop={(e) => handleDropOnDay(e, day)}
                  className="border-r p-2 hover:bg-blue-50/20 cursor-pointer">
                  <span className={`text-xs font-bold ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-500'}`}>{format(day, 'd/MM')}</span>
                  <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-20">
                    {reunioesDoDia(day).map(m => (
                      <div key={m.id} draggable onDragStart={(e) => handleDragStart(e, m)} onDragEnd={handleDragEnd} onClick={(e) => { e.stopPropagation(); handleEdit(m); }}
                        className="text-[9px] px-1 rounded border-l-2 truncate font-semibold" style={{ borderLeftColor: m.cor, backgroundColor: m.cor + '15' }}>
                        {format(parseDataLocal(m.data_hora), 'HH:mm')} {m.titulo}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Lista detalhada da semana */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
              {weekDays.map(day => {
                const dayMeetings = reunioesDoDia(day);
                if (dayMeetings.length === 0) return null;
                return (
                  <div key={day.toString()} className="flex gap-4">
                    <div className="w-16 text-right pt-2">
                      <p className="text-xl font-black text-slate-800">{format(day, 'dd')}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">{format(day, 'EEE', { locale: ptBR })}</p>
                    </div>
                    <div className="flex-1 space-y-2">
                      {dayMeetings.map(m => (
                        <div key={m.id} onClick={() => handleEdit(m)} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md cursor-pointer transition-all">
                          <div className="flex justify-between">
                            <h4 className="font-bold text-slate-800 text-sm">{m.titulo}</h4>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.cor }} />
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">{format(parseDataLocal(m.data_hora), 'HH:mm')} • {m.tipo_reuniao}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW: LISTA SEPARADA POR DIA */}
        {view === 'list' && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-y-auto p-6 custom-scrollbar">
            {reunioes.length === 0 ? (
              <p className="text-center text-slate-400 py-16 font-medium">Nenhum ritual agendado.</p>
            ) : (
              reunioes.reduce((acc, r) => {
                const day = format(parseDataLocal(r.data_hora), 'yyyy-MM-dd');
                if (!acc[day]) acc[day] = [];
                acc[day].push(r);
                return acc;
              }, {} && Object.entries(reunioes.reduce((acc, r) => {
                const day = format(parseDataLocal(r.data_hora), 'yyyy-MM-dd');
                if (!acc[day]) acc[day] = [];
                acc[day].push(r);
                return acc;
              }, {})).sort().map(([day, meetings]) => (
                <div key={day} className="mb-8 last:mb-0">
                  <div className="flex items-center gap-3 mb-4 sticky top-0 bg-white z-10 py-1">
                    <span className="text-2xl font-black text-slate-800">{format(parseISO(day), 'dd')}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{format(parseISO(day), 'MMMM yyyy', { locale: ptBR })}</p>
                      <p className="text-[10px] font-black text-blue-600 uppercase">{format(parseISO(day), 'EEEE', { locale: ptBR })}</p>
                    </div>
                    <div className="h-[1px] flex-1 bg-slate-100 ml-2" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {meetings.map(m => (
                      <div key={m.id} onClick={() => handleEdit(m)} className="group bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-blue-300 hover:shadow-md cursor-pointer transition-all">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: m.cor }} />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-blue-700">{m.titulo}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{format(parseDataLocal(m.data_hora), 'HH:mm')} • {m.tipo_reuniao}</p>
                          </div>
                        </div>
                        {m.pauta && <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{resumoPauta(m.pauta)}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {editingReuniao ? 'Editar Ritual' : 'Novo Ritual Tático'}
              </h2>
              <div className="flex gap-2">
                <div className="flex bg-slate-200 p-1 rounded-lg mr-4">
                  <button onClick={() => setActiveTab('principal')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'principal' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>Principal</button>
                  <button onClick={() => setActiveTab('ata')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'ata' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>Ata / Ações</button>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className={`flex-1 md:basis-3/5 p-8 border-r border-slate-100 overflow-y-auto ${activeTab === 'ata' ? 'hidden md:block' : ''}`}>
                <DetalhesReuniao
                  formData={formData}
                  setFormData={setFormData}
                  editingReuniao={editingReuniao}
                  reunioes={reunioes} // Passando para pegar as categorias
                />
              </div>

              <div className={`flex-1 md:basis-2/5 bg-slate-50/50 p-8 flex flex-col ${activeTab === 'principal' ? 'hidden md:flex' : 'flex'}`}>
                <label className="label-form flex items-center gap-2 mb-2"><AlignLeft size={16} /> Ata da reunião / Encaminhamentos</label>
                <textarea
                  className="flex-1 w-full bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-700 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-sm"
                  placeholder="Decisões, prazos e responsáveis..."
                  value={formData.ata_acoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, ata_acoes: e.target.value }))}
                />
              </div>
            </form>

            <div className="bg-white p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              {editingReuniao && (
                <button type="button" onClick={handleDelete} className="mr-auto text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-2 px-4 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /> Excluir</button>
              )}
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-all">Cancelar</button>
              <button onClick={handleSubmit} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all active:scale-95"><Save size={18} /> Salvar Ritual</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .label-form { @apply block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest; }
        .input-form { @apply w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </Layout>
  );
}

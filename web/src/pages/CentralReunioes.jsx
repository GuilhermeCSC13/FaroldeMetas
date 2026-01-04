import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon, List, X, Save, Trash2 } from 'lucide-react';
import { salvarReuniao, atualizarReuniao } from '../services/agendaService';
import DetalhesReuniao from '../components/tatico/DetalhesReuniao';

const SENHA_EXCLUSAO = 'KM2026';

export default function CentralReunioes() {
  const [view, setView] = useState('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reunioes, setReunioes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReuniao, setEditingReuniao] = useState(null);
  
  const [formData, setFormData] = useState({
    titulo: '', tipo_reuniao: 'Geral', data: '', hora: '09:00', 
    cor: '#3B82F6', responsavel: '', pauta: '', recorrencia: 'unica'
  });

  // Mapeia todas as categorias já existentes no banco para sugestão automática
  const categoriasExistentes = useMemo(() => {
    const cats = reunioes.map(r => r.tipo_reuniao);
    const padroes = ['Geral', 'DBO', 'ABS e Turnover', 'Liderança', 'Operacional', 'Estratégica'];
    return [...new Set([...padroes, ...cats])].filter(Boolean).sort();
  }, [reunioes]);

  useEffect(() => { fetchReunioes(); }, [currentDate]);

  const fetchReunioes = async () => {
    const { data } = await supabase.from('reunioes').select('*').order('data_hora');
    setReunioes(data || []);
  };

  const parseDataLocal = (dataString) => dataString ? parseISO(dataString.substring(0, 19)) : new Date();

  const onDateClick = (day) => {
    setEditingReuniao(null);
    setFormData({ 
      titulo: '', tipo_reuniao: 'Geral', data: format(day, 'yyyy-MM-dd'), 
      hora: '09:00', cor: '#3B82F6', responsavel: '', pauta: '', recorrencia: 'unica' 
    });
    setIsModalOpen(true);
  };

  const handleEdit = (reuniao) => {
    const dt = parseDataLocal(reuniao.data_hora);
    setFormData({
      titulo: reuniao.titulo, tipo_reuniao: reuniao.tipo_reuniao,
      data: format(dt, 'yyyy-MM-dd'), hora: format(dt, 'HH:mm'), 
      cor: reuniao.cor, responsavel: reuniao.responsavel || '',
      pauta: reuniao.pauta || '', recorrencia: 'unica'
    });
    setEditingReuniao(reuniao);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataHoraIso = `${formData.data}T${formData.hora}:00`;
    const dados = { ...formData, data_hora: dataHoraIso, area_id: 4 };

    if (editingReuniao) {
      const aplicar = window.confirm('Aplicar mudanças para reuniões futuras desta série?');
      await atualizarReuniao(editingReuniao.id, dados, aplicar);
    } else {
      await salvarReuniao(dados, formData.recorrencia);
    }
    setIsModalOpen(false);
    fetchReunioes();
  };

  const handleDelete = async () => {
    if (window.prompt('Digite a senha para confirmar exclusão:') !== SENHA_EXCLUSAO) return;
    await supabase.from('reunioes').delete().eq('id', editingReuniao.id);
    setIsModalOpen(false);
    fetchReunioes();
  };

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate)),
  });

  return (
    <Layout>
      <div className="flex flex-col h-screen p-6 bg-slate-50 font-sans overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Calendário Tático</h1>
            <p className="text-sm text-slate-500">Gestão integrada de rituais.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('calendar')} className={`p-2 rounded border ${view === 'calendar' ? 'bg-blue-50 text-blue-600' : 'bg-white'}`}><CalIcon size={18} /></button>
            <button onClick={() => setView('list')} className={`p-2 rounded border ${view === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white'}`}><List size={18} /></button>
            <button onClick={() => onDateClick(new Date())} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md"><Plus size={18} /> Nova</button>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-bold text-slate-700 capitalize">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h2>
            <div className="flex gap-2">
              <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft /></button>
              <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 flex-1 overflow-y-auto">
            {calendarDays.map(day => (
              <div key={day.toString()} onClick={() => onDateClick(day)} className={`border-r border-b min-h-[120px] p-2 hover:bg-blue-50/20 cursor-pointer ${!isSameMonth(day, currentDate) ? 'opacity-30' : ''}`}>
                <span className={`text-xs font-bold ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>{format(day, 'd')}</span>
                {reunioes.filter(r => isSameDay(parseDataLocal(r.data_hora), day)).map(m => (
                  <div key={m.id} onClick={(e) => { e.stopPropagation(); handleEdit(m); }} className="text-[10px] truncate p-1 mt-1 rounded border-l-2 font-medium" style={{ borderLeftColor: m.cor, backgroundColor: m.cor + '15' }}>{m.titulo}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-white px-8 py-5 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{editingReuniao ? 'Editar Ritual' : 'Novo Ritual'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-400" /></button>
            </div>

            <form id="form-ritual" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
              <DetalhesReuniao formData={formData} setFormData={setFormData} editingReuniao={editingReuniao} categorias={categoriasExistentes} />
            </form>

            <div className="bg-slate-50 p-5 border-t flex justify-end gap-3 shrink-0">
              {editingReuniao && <button type="button" onClick={handleDelete} className="mr-auto text-red-500 font-bold flex items-center gap-2 px-4 hover:bg-red-50 rounded-lg"><Trash2 size={16} /> Excluir Ritual</button>}
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-bold">Cancelar</button>
              <button type="submit" form="form-ritual" className="px-10 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all"><Save size={18} /> Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

import React from 'react';
import { Calendar, Clock, AlignLeft, Repeat } from 'lucide-react';

export default function DetalhesReuniao({ formData, setFormData, editingReuniao, categorias = [] }) {
  const handleChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* LADO ESQUERDO: CONFIGURAÇÃO */}
      <div className="lg:col-span-5 space-y-8">
        <section className="space-y-4">
          <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Configurações do Ritual</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Título</label>
            <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.titulo} onChange={(e) => handleChange('titulo', e.target.value)} placeholder="Ex: Alinhamento Semanal" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none" value={formData.data} onChange={(e) => handleChange('data', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora</label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none" value={formData.hora} onChange={(e) => handleChange('hora', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Organizador</label>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" value={formData.responsavel} onChange={(e) => handleChange('responsavel', e.target.value)} placeholder="Responsável" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
              <input list="cats" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" value={formData.tipo_reuniao} onChange={(e) => handleChange('tipo_reuniao', e.target.value)} placeholder="Selecione..." />
              <datalist id="cats">{categorias.map((c, i) => <option key={i} value={c} />)}</datalist>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Cor na agenda</span>
            <input type="color" className="w-10 h-8 rounded cursor-pointer border-none bg-transparent" value={formData.cor} onChange={(e) => handleChange('cor', e.target.value)} />
          </div>

          {!editingReuniao && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-2"><Repeat size={14}/>Recorrência</label>
              <div className="flex gap-2">
                {['unica', 'semanal', 'mensal'].map(t => (
                  <button key={t} type="button" onClick={() => handleChange('recorrencia', t)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${formData.recorrencia === t ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:border-blue-300'}`}>{t}</button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* LADO DIREITO: PAUTA */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
          <AlignLeft size={16} /> Pauta Principal do Ritual
        </h3>
        <textarea className="flex-1 w-full min-h-[450px] bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 shadow-inner resize-none font-mono" placeholder="Descreva os tópicos e objetivos aqui..." value={formData.pauta} onChange={(e) => handleChange('pauta', e.target.value)} />
      </div>
    </div>
  );
}

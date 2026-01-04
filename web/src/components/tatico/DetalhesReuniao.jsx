import React from 'react';
import { Calendar, Clock, User, Tag, Repeat, AlignLeft } from 'lucide-react';

export default function DetalhesReuniao({ formData, setFormData, editingReuniao, categorias = [] }) {
  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      
      {/* COLUNA ESQUERDA: CONFIGURAÇÕES */}
      <div className="lg:col-span-5 space-y-8">
        <section>
          <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-4">Informações Básicas</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Título do Ritual</label>
              <input
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                value={formData.titulo}
                onChange={(e) => handleChange('titulo', e.target.value)}
                placeholder="Ex: Weekly Comercial DBM"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400" /> Data
                </label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-all"
                  value={formData.data}
                  onChange={(e) => handleChange('data', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" /> Hora
                </label>
                <input
                  type="time"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-all"
                  value={formData.hora}
                  onChange={(e) => handleChange('hora', e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-4">Classificação e Cor</h3>
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-5">
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Responsável</label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  value={formData.responsavel}
                  onChange={(e) => handleChange('responsavel', e.target.value)}
                  placeholder="Responsável"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Categoria</label>
                <input
                  list="categorias-list"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  value={formData.tipo_reuniao}
                  onChange={(e) => handleChange('tipo_reuniao', e.target.value)}
                  placeholder="Selecione..."
                />
                <datalist id="categorias-list">
                  {categorias.map((cat, index) => (
                    <option key={index} value={cat} />
                  ))}
                  <option value="Geral" />
                  <option value="Tático" />
                  <option value="Operacional" />
                </datalist>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[12px] font-semibold text-slate-700">Cor na agenda</span>
              <input
                type="color"
                className="w-12 h-8 rounded cursor-pointer bg-transparent border-none"
                value={formData.cor}
                onChange={(e) => handleChange('cor', e.target.value)}
              />
            </div>

            {!editingReuniao && (
              <div className="pt-2">
                <label className="block text-[12px] font-semibold text-slate-700 mb-2 flex items-center gap-2">
                   <Repeat size={14} /> Recorrência
                </label>
                <div className="flex gap-2">
                  {['unica', 'semanal', 'mensal'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleChange('recorrencia', t)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        formData.recorrencia === t 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                        : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* COLUNA DIREITA: PAUTA */}
      <div className="lg:col-span-7 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
            <AlignLeft size={14} /> Pauta Principal do Ritual
          </h3>
        </div>
        
        <textarea
          className="flex-1 w-full min-h-[450px] bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 shadow-inner resize-none font-mono"
          placeholder="Estruture aqui os tópicos da reunião..."
          value={formData.pauta || ''}
          onChange={(e) => handleChange('pauta', e.target.value)}
        />
      </div>
    </div>
  );
}

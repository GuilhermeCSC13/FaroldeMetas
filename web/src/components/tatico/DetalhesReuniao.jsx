// src/components/tatico/DetalhesReuniao.jsx
import React from 'react';
import {
  Calendar,
  Clock,
  User,
  Tag,
  RefreshCw,
  Palette,
} from 'lucide-react';

export default function DetalhesReuniao({ formData, setFormData, editingReuniao }) {
  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleRecorrencia = (tipo) => {
    setFormData((prev) => ({ ...prev, recorrencia: tipo }));
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-y-auto pr-2">
      {/* BLOCO 1 – DETALHES GERAIS */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
        {/* TÍTULO */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Detalhes da reunião
          </p>
          <input
            required
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm md:text-base text-slate-800 font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Ex: Reunião Mensal de Resultados"
            value={formData.titulo}
            onChange={handleChange('titulo')}
          />
          <p className="text-[11px] text-slate-400 mt-1.5">
            Defina um título claro que identifique o propósito da reunião.
          </p>
        </div>

        {/* DATA / HORA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label-form flex items-center gap-1">
              <Calendar size={14} /> Data
            </label>
            <div className="relative">
              <input
                type="date"
                required
                className="input-form pl-10"
                value={formData.data}
                onChange={handleChange('data')}
              />
              <Calendar
                className="absolute left-3 top-3.5 text-slate-400"
                size={16}
              />
            </div>
          </div>
          <div>
            <label className="label-form flex items-center gap-1">
              <Clock size={14} /> Hora
            </label>
            <div className="relative">
              <input
                type="time"
                required
                className="input-form pl-10"
                value={formData.hora}
                onChange={handleChange('hora')}
              />
              <Clock
                className="absolute left-3 top-3.5 text-slate-400"
                size={16}
              />
            </div>
          </div>
        </div>

        {/* RESPONSÁVEL / TIPO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label-form flex items-center gap-1">
              <User size={14} /> Responsável (Organizador)
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-3.5 text-slate-400"
                size={16}
              />
              <input
                className="input-form pl-10"
                placeholder="Quem está liderando?"
                value={formData.responsavel}
                onChange={handleChange('responsavel')}
              />
            </div>
          </div>
          <div>
            <label className="label-form flex items-center gap-1">
              <Tag size={14} /> Tipo / Categoria
            </label>
            <input
              className="input-form"
              list="tiposReuniao"
              value={formData.tipo_reuniao}
              onChange={handleChange('tipo_reuniao')}
            />
            <datalist id="tiposReuniao">
              {/* Geral + as que você já usa */}
              <option value="Geral" />
              <option value="Operacional" />
              <option value="Estratégica" />
              <option value="Feedback" />
              <option value="Treinamento" />
            </datalist>
          </div>
        </div>

        {/* RECORRÊNCIA / COR NA AGENDA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label className="label-form flex items-center gap-1">
              <RefreshCw size={14} /> Recorrência
            </label>
            <div className="flex flex-wrap gap-2 mt-1">
              {['unica', 'semanal', 'mensal'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleRecorrencia(t)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-full uppercase tracking-wide ${
                    formData.recorrencia === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-form flex items-center gap-1">
              <Palette size={14} /> Cor na agenda
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-11 h-11 rounded-xl border border-slate-200 cursor-pointer"
                value={formData.cor}
                onChange={handleChange('cor')}
              />
              <p className="text-[11px] text-slate-400 leading-snug">
                A cor será usada nas visões de calendário e na lista.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOCO 2 – PAUTA PRINCIPAL (usa formData.pauta) */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex-1 flex flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Pauta principal desta reunião
        </p>
        <p className="text-[11px] text-slate-400 mb-3">
          Resumo executivo em 1–3 parágrafos. Esse texto será utilizado como
          descrição nas listas e na visão semanal.
        </p>

        <textarea
          className="mt-1 flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
          placeholder="Ex: Revisar indicadores DBO, validar plano de ação de KM/L e tratar pendências de segurança..."
          value={formData.pauta || ''}
          onChange={handleChange('pauta')}
        />
      </section>
    </div>
  );
}

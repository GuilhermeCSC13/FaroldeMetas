// src/components/tatico/DetalhesReuniao.jsx
import React from 'react';
import { Repeat, User, AlignLeft } from 'lucide-react';

/**
 * Componente de detalhes da reunião (lado esquerdo do modal).
 *
 * Props esperadas:
 * - formData: {
 *     titulo, tipo_reuniao, data, hora, cor,
 *     responsavel, pauta, recorrencia
 *   }
 * - setFormData: função do useState para atualizar formData
 * - editingReuniao: objeto da reunião em edição (ou null para nova)
 */
const DetalhesReuniao = ({ formData, setFormData, editingReuniao }) => {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Header interno + título */}
      <div>
        <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase mb-1">
          Detalhes da reunião
        </p>
        <input
          required
          className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-lg font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
          value={formData.titulo}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, titulo: e.target.value }))
          }
          placeholder="Ex: Reunião Mensal de Resultados"
        />
        <p className="mt-1 text-xs text-slate-400">
          Defina um título claro que identifique a pauta principal da reunião.
        </p>
      </div>

      {/* Card de informações principais */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        {/* Data / Hora */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-form">Data</label>
            <input
              type="date"
              required
              className="input-form"
              value={formData.data}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, data: e.target.value }))
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
                setFormData((prev) => ({ ...prev, hora: e.target.value }))
              }
            />
          </div>
        </div>

        {/* Responsável / Tipo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-form">Responsável (Organizador)</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                className="input-form pl-10"
                value={formData.responsavel}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, responsavel: e.target.value }))
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
                setFormData((prev) => ({
                  ...prev,
                  tipo_reuniao: e.target.value,
                }))
              }
              list="tipos-reuniao"
            />
            <datalist id="tipos-reuniao">
              <option value="Operacional" />
              <option value="Estratégica" />
              <option value="Feedback" />
              <option value="Treinamento" />
            </datalist>
          </div>
        </div>

        {/* Recorrência / Cor */}
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
                        setFormData((prev) => ({ ...prev, recorrencia: t }))
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
                  A lógica de recorrência é aplicada na gravação da série.
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
                  setFormData((prev) => ({ ...prev, cor: e.target.value }))
                }
              />
              <span className="text-xs text-slate-400">
                A cor será usada nas visões de calendário e lista.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pauta principal fixa */}
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
            setFormData((prev) => ({ ...prev, pauta: e.target.value }))
          }
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Este campo será utilizado como resumo em listas e na visão semanal.
        </p>
      </div>
    </div>
  );
};

export default DetalhesReuniao;

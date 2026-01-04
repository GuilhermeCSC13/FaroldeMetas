// src/components/tatico/DetalhesReuniao.jsx
import { Calendar, Clock, User, Tag, Repeat, Trash2, AlignLeft } from "lucide-react";

export default function DetalhesReuniao({
  formData,
  setFormData,
  editingReuniao,
  onDelete,
}) {
  const handleDeleteClick = () => {
    const senha = window.prompt(
      "Para excluir definitivamente esta reunião, digite a senha:"
    );
    if (!senha) return;
    onDelete(senha);
  };

  return (
    <div className="flex-1 px-8 py-6 overflow-y-auto border-r border-slate-200 bg-gradient-to-b from-slate-50 to-white">
      {/* HEADER DA COLUNA */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
          Detalhes da Reunião
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Configure data, horário, responsável e resumo executivo.
        </p>
      </div>

      {/* TÍTULO DA REUNIÃO */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-slate-500 mb-1">
          Título da Reunião
        </label>
        <input
          required
          className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3 text-base font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-slate-400"
          placeholder="Ex: Reunião Mensal de Resultados"
          value={formData.titulo}
          onChange={(e) =>
            setFormData({ ...formData, titulo: e.target.value })
          }
        />
        <p className="text-[11px] text-slate-500 mt-1">
          Use um título claro que descreva o objetivo principal da reunião.
        </p>
      </div>

      {/* CARD PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-5 shadow-sm mb-6 space-y-5">
        {/* DATA / HORA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1">
              <Calendar size={14} className="text-slate-400" />
              Data
            </label>
            <input
              type="date"
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 outline-none"
              value={formData.data}
              onChange={(e) =>
                setFormData({ ...formData, data: e.target.value })
              }
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1">
              <Clock size={14} className="text-slate-400" />
              Hora
            </label>
            <input
              type="time"
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 outline-none"
              value={formData.hora}
              onChange={(e) =>
                setFormData({ ...formData, hora: e.target.value })
              }
            />
          </div>
        </div>

        {/* RESPONSÁVEL / TIPO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1">
              <User size={14} className="text-slate-400" />
              Responsável (Organizador)
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"
              />
              <input
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 outline-none placeholder:text-slate-400"
                placeholder="Quem está liderando?"
                value={formData.responsavel}
                onChange={(e) =>
                  setFormData({ ...formData, responsavel: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1">
              <Tag size={14} className="text-slate-400" />
              Tipo / Categoria
            </label>
            <input
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 outline-none"
              value={formData.tipo_reuniao}
              onChange={(e) =>
                setFormData({ ...formData, tipo_reuniao: e.target.value })
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

        {/* RECORRÊNCIA / COR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Recorrência apenas na criação */}
          {!editingReuniao && (
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1">
                <Repeat size={14} className="text-slate-400" />
                Recorrência
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Defina se a reunião será única, semanal ou mensal.
              </p>
              <div className="inline-flex bg-slate-100 rounded-full p-1">
                {["unica", "semanal", "mensal"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, recorrencia: t })
                    }
                    className={`px-3 py-1 text-[11px] font-semibold rounded-full uppercase tracking-wide transition-all ${
                      formData.recorrencia === t
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cor na agenda */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              Cor na Agenda
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-10 h-10 rounded-lg border border-slate-300 shadow-sm cursor-pointer"
                  value={formData.cor}
                  onChange={(e) =>
                    setFormData({ ...formData, cor: e.target.value })
                  }
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-snug max-w-xs">
                Essa cor será usada para destacar a reunião no calendário e nas
                listas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PAUTA PRINCIPAL (RESUMO EXECUTIVO) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlignLeft size={14} className="text-slate-400" />
            <p className="text-xs font-semibold text-slate-600 uppercase">
              Pauta Principal desta Reunião
            </p>
          </div>
          <span className="text-[11px] text-slate-400">
            Resumo executivo em 1–3 linhas
          </span>
        </div>

        <textarea
          rows={3}
          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 outline-none resize-none"
          placeholder="Ex: Revisar indicadores DBO, validar plano de ação de KM/L e tratar pendências de segurança."
          value={formData.pauta}
          onChange={(e) =>
            setFormData({ ...formData, pauta: e.target.value })
          }
        />

        <p className="text-[11px] text-slate-500 mt-2">
          Esse campo será exibido nas visões de lista e semana como resumo da
          reunião.
        </p>
      </div>

      {/* BOTÃO EXCLUIR (APENAS NO MODO EDIÇÃO) */}
      {editingReuniao && (
        <div className="mt-6 flex justify-between items-center">
          <div className="text-[11px] text-slate-400">
            Esta ação é permanente. A ata e as ações vinculadas devem ser
            revisadas antes da exclusão.
          </div>
          <button
            type="button"
            onClick={handleDeleteClick}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors"
          >
            <Trash2 size={14} />
            Excluir reunião
          </button>
        </div>
      )}
    </div>
  );
}

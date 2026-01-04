import { Repeat, User, Tag, Calendar, Clock } from "lucide-react";

export default function DetalhesReuniao({
  formData,
  setFormData,
  editingReuniao,
  onDelete,
}) {
  return (
    <div className="flex-1 p-8 overflow-y-auto border-r border-slate-200">

      {/* TÍTULO SEÇÃO */}
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
        Detalhes da Reunião
      </p>

      {/* TÍTULO REUNIÃO */}
      <div className="mb-6">
        <input
          required
          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-lg font-semibold text-slate-800 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          placeholder="Ex: Reunião Mensal de Resultados"
          value={formData.titulo}
          onChange={(e) =>
            setFormData({ ...formData, titulo: e.target.value })
          }
        />

        <p className="text-xs text-slate-500 mt-1">
          Defina um título claro que identifique o propósito da reunião.
        </p>
      </div>

      {/* CARD PRINCIPAL DE INFORMAÇÕES */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">

        {/* LINHA 1 — DATA / HORA */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
              <Calendar size={14} /> Data
            </label>
            <input
              type="date"
              required
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400"
              value={formData.data}
              onChange={(e) =>
                setFormData({ ...formData, data: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
              <Clock size={14} /> Hora
            </label>
            <input
              type="time"
              required
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400"
              value={formData.hora}
              onChange={(e) =>
                setFormData({ ...formData, hora: e.target.value })
              }
            />
          </div>
        </div>

        {/* LINHA 2 — RESPONSÁVEL / TIPO */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <User size={14} /> Responsável (Organizador)
            </label>
            <input
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400"
              placeholder="Quem está liderando?"
              value={formData.responsavel}
              onChange={(e) =>
                setFormData({ ...formData, responsavel: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <Tag size={14} /> Tipo / Categoria
            </label>
            <input
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400"
              value={formData.tipo_reuniao}
              onChange={(e) =>
                setFormData({ ...formData, tipo_reuniao: e.target.value })
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

        {/* LINHA 3 — RECORRÊNCIA + COR */}
        <div className="grid grid-cols-2 gap-6 items-start">
          
          {/* RECORRÊNCIA */}
          {!editingReuniao && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Repeat size={14} /> Recorrência
              </label>

              <div className="flex gap-2 mt-1">
                {["unica", "semanal", "mensal"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, recorrencia: t })
                    }
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase border transition-all ${
                      formData.recorrencia === t
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* COR */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1">
              Cor na Agenda
            </label>

            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border shadow-sm cursor-pointer"
                value={formData.cor}
                onChange={(e) =>
                  setFormData({ ...formData, cor: e.target.value })
                }
              />
              <span className="text-xs text-slate-500">
                A cor será usada no calendário e listas.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PAUTA PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-bold text-slate-500 uppercase mb-2">
          Pauta Principal desta Reunião
        </p>

        <textarea
          rows={3}
          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400"
          placeholder="Resumo executivo em 1–3 linhas..."
          value={formData.pauta}
          onChange={(e) =>
            setFormData({ ...formData, pauta: e.target.value })
          }
        />

        <p className="text-xs text-slate-500 mt-2">
          Esse resumo será exibido na lista e na visão semanal.
        </p>
      </div>

      {/* BOTÃO EXCLUIR — COM SENHA */}
      {editingReuniao && (
        <div className="mt-6">
          <button
            className="text-red-600 hover:text-red-800 text-sm font-bold px-3 py-2 border border-red-300 rounded-lg"
            onClick={async () => {
              const senha = prompt("Digite a senha para excluir:");

              if (!senha) return;

              onDelete(senha);
            }}
          >
            Excluir reunião
          </button>
        </div>
      )}

    </div>
  );
}

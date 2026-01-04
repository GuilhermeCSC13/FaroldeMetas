import { Calendar, Clock, User, Tag, Repeat } from 'lucide-react';

export default function DetalhesReuniao({ formData, setFormData, editingReuniao }) {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* TÍTULO PRINCIPAL */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.18em] mb-2">
          Detalhes da Reunião
        </h3>
        <label className="block text-[13px] font-medium text-slate-600 mb-1">
          Título da Reunião
        </label>
        <input
          required
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 transition-all"
          value={formData.titulo}
          onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
          placeholder="Ex: Reunião de Liderança – DBM, Reunião Setorial da Manutenção..."
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Use um nome que facilite a identificação da reunião na agenda e nos relatórios.
        </p>
      </section>

      {/* GRID COM DATA, HORA, RESPONSÁVEL, TIPO, COR, RECORRÊNCIA */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Coluna esquerda: data/hora/responsável */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <h4 className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.16em] mb-1">
            Agenda básica
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Data */}
            <div>
              <label className="block text-[12px] font-medium text-slate-600 mb-1">
                Data
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 text-slate-400" size={16} />
                <input
                  type="date"
                  required
                  className="input-form pl-9"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                />
              </div>
            </div>

            {/* Hora */}
            <div>
              <label className="block text-[12px] font-medium text-slate-600 mb-1">
                Hora
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 text-slate-400" size={16} />
                <input
                  type="time"
                  required
                  className="input-form pl-9"
                  value={formData.hora}
                  onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Responsável */}
          <div>
            <label className="block text-[12px] font-medium text-slate-600 mb-1">
              Responsável (Organizador)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={16} />
              <input
                className="input-form pl-9"
                value={formData.responsavel}
                onChange={(e) =>
                  setFormData({ ...formData, responsavel: e.target.value })
                }
                placeholder="Ex: Guilherme, Fernando, Wesley..."
              />
            </div>
          </div>
        </div>

        {/* Coluna direita: tipo, cor, recorrência */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <h4 className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.16em] mb-1">
            Classificação
          </h4>

          {/* Tipo / Categoria */}
          <div>
            <label className="block text-[12px] font-medium text-slate-600 mb-1">
              Tipo / Categoria
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-3 text-slate-400" size={16} />
              <input
                className="input-form pl-9"
                value={formData.tipo_reuniao}
                onChange={(e) =>
                  setFormData({ ...formData, tipo_reuniao: e.target.value })
                }
                list="tipos-reuniao"
                placeholder="Ex: Geral, Liderança, Operacional..."
              />
              <datalist id="tipos-reuniao">
                <option value="Geral" />
                <option value="Liderança" />
                <option value="Operacional" />
                <option value="Estratégica" />
                <option value="Feedback" />
                <option value="Treinamento" />
                <option value="Setorial Manutenção" />
                <option value="Revisão de Indicadores" />
              </datalist>
            </div>
          </div>

          {/* Cor na agenda */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[12px] font-medium text-slate-600 mb-1">
                Cor na agenda
              </label>
              <p className="text-[11px] text-slate-400 leading-snug">
                A cor será usada nas visões de calendário, semanal e lista.
              </p>
            </div>
            <input
              type="color"
              className="w-11 h-11 rounded-lg border border-slate-200 cursor-pointer shadow-sm"
              value={formData.cor}
              onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
            />
          </div>

          {/* Recorrência (quando criando) */}
          {!editingReuniao && (
            <div className="mt-2">
              <label className="block text-[12px] font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                <Repeat size={14} className="text-slate-400" />
                Recorrência
              </label>
              <div className="flex flex-wrap gap-2">
                {['unica', 'semanal', 'quinzenal', 'mensal'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, recorrencia: t })}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-full uppercase tracking-wide ${
                      formData.recorrencia === t
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
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

      {/* PAUTA PRINCIPAL – TEXTO LONGO */}
      <section className="bg-slate-50 border border-slate-200 rounded-2xl p-5 lg:p-6">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div>
            <h4 className="text-[12px] font-semibold text-slate-500 uppercase tracking-[0.16em]">
              Pauta principal desta reunião
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Use este campo para descrever a pauta estruturada: participantes, objetivo
              estratégico, frequência/horário e sequência cronometrada dos tópicos.
            </p>
          </div>
        </div>

        <textarea
          className="w-full min-h-[260px] lg:min-h-[320px] bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 shadow-sm resize-vertical"
          placeholder={`Exemplo de conteúdo:\n\nReunião Liderança – DBM – Diretrizes Básicas da Manutenção\nParticipantes: ...\nObjetivo Estratégico: ...\nFrequência e Horário: ...\n\nPauta Estratificada e Cronometrada\n11:00 - 11:10 – Análise de Performance...\n11:10 - 11:25 – Planejamento e Priorização...\n11:25 - 11:30 – Encerramento e Próximos Passos...\n\nReunião Setorial da Manutenção\nParticipantes: ...\nObjetivo Estratégico: ...\n...`}
          value={formData.pauta || ''}
          onChange={(e) => setFormData({ ...formData, pauta: e.target.value })}
        />
      </section>
    </div>
  );
}

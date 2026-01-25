import React, { useEffect, useMemo } from "react";
import { Calendar, Clock, AlignLeft, Repeat } from "lucide-react";

/**
 * Ajustes para "conversar" com Tipos de Reunião:
 * - tipo_reuniao_id (uuid/int) -> referência do tipo
 * - tipo_reuniao_nome (string) -> redundância útil p/ calendário/legado (opcional)
 * - hora_fim (HH:MM) -> novo campo (término)
 *
 * Props:
 * - tiposReuniao: array de tipos do Supabase (id, nome, horario_inicio, horario_fim, ata_principal, cor)
 *   (se você ainda não tiver, você busca na page pai e passa aqui)
 */
export default function DetalhesReuniao({
  formData,
  setFormData,
  editingReuniao,
  tiposReuniao = [], // ✅ substitui "categorias"
}) {
  const handleChange = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const tiposMap = useMemo(() => {
    const m = new Map();
    (tiposReuniao || []).forEach((t) => m.set(String(t.id), t));
    return m;
  }, [tiposReuniao]);

  // Se já existe tipo selecionado, permite usar como “fonte” de defaults em mudanças futuras
  const selectedTipo = useMemo(() => {
    const id = formData?.tipo_reuniao_id ? String(formData.tipo_reuniao_id) : "";
    return id ? tiposMap.get(id) : null;
  }, [formData?.tipo_reuniao_id, tiposMap]);

  // Normaliza time vindo do Postgres (HH:MM:SS) para input time (HH:MM)
  const toHHMM = (t) => {
    if (!t) return "";
    const s = String(t);
    return s.length >= 5 ? s.slice(0, 5) : s;
  };

  // Quando muda o tipo, autopreenche horário/pauta/cor com regras seguras
  const handleTipoChange = (tipoId) => {
    const idStr = tipoId ? String(tipoId) : "";
    const tipo = idStr ? tiposMap.get(idStr) : null;

    setFormData((prev) => {
      const next = { ...prev, tipo_reuniao_id: tipoId || null };

      // compatibilidade / visual
      next.tipo_reuniao_nome = tipo?.nome || "";

      // horário: só autopreenche se usuário não colocou manualmente
      const inicioTipo = toHHMM(tipo?.horario_inicio);
      const fimTipo = toHHMM(tipo?.horario_fim);

      if (!prev.hora && inicioTipo) next.hora = inicioTipo;
      if (!prev.hora_fim && fimTipo) next.hora_fim = fimTipo;

      // cor: só aplica se não tiver
      if ((!prev.cor || prev.cor === "#000000") && tipo?.cor) {
        next.cor = tipo.cor;
      }

      // pauta: só aplica se estiver vazia (não sobrescreve o que já foi escrito)
      if (!prev.pauta && tipo?.ata_principal) {
        next.pauta = tipo.ata_principal;
      }

      return next;
    });
  };

  // Opcional: se abrir reunião existente (edit), garantir que tipo_reuniao_nome esteja coerente
  useEffect(() => {
    if (!editingReuniao) return;
    if (!formData?.tipo_reuniao_id) return;
    if (formData?.tipo_reuniao_nome) return;

    const t = tiposMap.get(String(formData.tipo_reuniao_id));
    if (t?.nome) {
      setFormData((prev) => ({ ...prev, tipo_reuniao_nome: t.nome }));
    }
  }, [editingReuniao, formData?.tipo_reuniao_id, formData?.tipo_reuniao_nome, tiposMap, setFormData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* LADO ESQUERDO: CONFIGURAÇÃO */}
      <div className="lg:col-span-5 space-y-8">
        <section className="space-y-4">
          <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">
            Configurações do Ritual
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título
            </label>
            <input
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
              value={formData.titulo || ""}
              onChange={(e) => handleChange("titulo", e.target.value)}
              placeholder="Ex: Alinhamento Semanal"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data
              </label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={16}
                />
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none"
                  value={formData.data || ""}
                  onChange={(e) => handleChange("data", e.target.value)}
                />
              </div>
            </div>

            {/* Hora início */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hora (início)
              </label>
              <div className="relative">
                <Clock
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={16}
                />
                <input
                  type="time"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none"
                  value={formData.hora || ""}
                  onChange={(e) => handleChange("hora", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ✅ Hora término */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hora (término)
              </label>
              <div className="relative">
                <Clock
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={16}
                />
                <input
                  type="time"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-sm outline-none"
                  value={formData.hora_fim || ""}
                  onChange={(e) => handleChange("hora_fim", e.target.value)}
                />
              </div>
              {selectedTipo?.horario_fim && !formData?.hora_fim && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Sugestão do tipo: {toHHMM(selectedTipo.horario_fim)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Organizador
              </label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none"
                value={formData.responsavel || ""}
                onChange={(e) => handleChange("responsavel", e.target.value)}
                placeholder="Responsável"
              />
            </div>
          </div>

          {/* Tipo (antes era Categoria) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de reunião
              </label>

              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none"
                value={formData.tipo_reuniao_id || ""}
                onChange={(e) => handleTipoChange(e.target.value)}
              >
                <option value="">Selecione...</option>
                {tiposReuniao.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>

              {!!formData?.tipo_reuniao_nome && (
                <p className="text-[11px] text-slate-400 mt-1">
                  {formData.tipo_reuniao_nome}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-700">
                Cor na agenda
              </span>
              <input
                type="color"
                className="w-10 h-8 rounded cursor-pointer border-none bg-transparent"
                value={formData.cor || "#111827"}
                onChange={(e) => handleChange("cor", e.target.value)}
              />
            </div>
          </div>

          {!editingReuniao && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <Repeat size={14} />
                Recorrência
              </label>
              <div className="flex gap-2">
                {["unica", "semanal", "mensal"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleChange("recorrencia", t)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                      formData.recorrencia === t
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-white text-slate-500 hover:border-blue-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Para recorrentes, o tipo define o padrão; aqui você só marca a cadência.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* LADO DIREITO: PAUTA */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
          <AlignLeft size={16} /> Pauta Principal do Ritual
        </h3>

        <textarea
          className="flex-1 w-full min-h-[450px] bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 shadow-inner resize-none font-mono"
          placeholder="Descreva os tópicos e objetivos aqui..."
          value={formData.pauta || ""}
          onChange={(e) => handleChange("pauta", e.target.value)}
        />

        {/* Ação utilitária: puxar ATA do tipo manualmente */}
        {selectedTipo?.ata_principal && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm(
                  "Deseja substituir a pauta atual pela ATA principal do Tipo de Reunião?"
                );
                if (!ok) return;
                handleChange("pauta", selectedTipo.ata_principal);
              }}
              className="text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
            >
              Usar ATA principal do tipo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useMemo } from "react";
import { Calendar, Clock, AlignLeft, FileText } from "lucide-react";

export default function DetalhesReuniao({
  formData,
  setFormData,
  editingReuniao,
  tipos = [],
}) {
  const handleChange = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const selectedTipo = useMemo(() => {
    return tipos.find((t) => String(t.id) === String(formData.tipo_reuniao_id)) || null;
  }, [tipos, formData.tipo_reuniao_id]);

  const usarAtaDoTipo = () => {
    const guia = selectedTipo?.ata_principal || "";
    if (!guia) return;
    handleChange("ata", guia);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* LADO ESQUERDO: CONFIGURAÇÃO */}
      <div className="lg:col-span-5 space-y-8">
        <section className="space-y-4">
          <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">
            Configurações da Reunião
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título
            </label>
            <input
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
              value={formData.titulo}
              onChange={(e) => handleChange("titulo", e.target.value)}
              placeholder="Ex: DBO - Diretrizes Básicas"
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
                  value={formData.data}
                  onChange={(e) => handleChange("data", e.target.value)}
                />
              </div>
            </div>

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
                  value={formData.hora_inicio}
                  onChange={(e) => handleChange("hora_inicio", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ✅ NOVO: Hora término */}
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
                  value={formData.hora_fim}
                  onChange={(e) => handleChange("hora_fim", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Organizador
              </label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none"
                value={formData.responsavel}
                onChange={(e) => handleChange("responsavel", e.target.value)}
                placeholder="Responsável"
              />
            </div>
          </div>

          {/* ✅ Tipo de reunião via FK */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de reunião
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none font-semibold"
              value={formData.tipo_reuniao_id || ""}
              onChange={(e) => handleChange("tipo_reuniao_id", e.target.value)}
            >
              <option value="">Selecione...</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            {selectedTipo?.nome && (
              <p className="text-[10px] text-slate-400 mt-1 font-bold">
                {selectedTipo.nome}
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
              value={formData.cor}
              onChange={(e) => handleChange("cor", e.target.value)}
            />
          </div>

          {/* ✅ Status (para o indicador no calendário) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none font-semibold"
              value={formData.status}
              onChange={(e) => handleChange("status", e.target.value)}
            >
              <option value="Agendada">Agendada</option>
              <option value="Realizada">Realizada</option>
              <option value="Nao Realizada">Não realizada</option>
            </select>
          </div>
        </section>
      </div>

      {/* LADO DIREITO: ATA */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
          <AlignLeft size={16} /> ATA da Reunião
        </h3>

        {/* ✅ ATA GUIA (do tipo) + botão copiar */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-slate-400" />
              <p className="text-xs font-bold text-slate-700">
                ATA guia do tipo
              </p>
            </div>
            <button
              type="button"
              onClick={usarAtaDoTipo}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 hover:bg-white"
              disabled={!selectedTipo?.ata_principal}
              title={!selectedTipo?.ata_principal ? "Tipo sem ATA guia" : "Copiar ATA guia para esta reunião"}
            >
              Usar ATA principal do tipo
            </button>
          </div>

          <div className="mt-3 text-xs text-slate-600 whitespace-pre-line max-h-28 overflow-y-auto">
            {selectedTipo?.ata_principal
              ? selectedTipo.ata_principal
              : "Selecione um tipo para visualizar a ATA guia."}
          </div>
        </div>

        {/* ✅ ATA desta reunião (instância) */}
        <textarea
          className="flex-1 w-full min-h-[380px] bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 shadow-inner resize-none font-mono"
          placeholder="Descreva a ATA desta reunião aqui..."
          value={formData.ata}
          onChange={(e) => handleChange("ata", e.target.value)}
        />
      </div>
    </div>
  );
}

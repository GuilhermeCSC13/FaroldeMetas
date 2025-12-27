import React from "react";

export default function FarolRotinasSetor({ setor }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h4 className="text-sm font-semibold text-slate-800">
        Farol de Rotinas – {setor}
      </h4>
      <p className="text-xs text-slate-500 mt-1">
        Estrutura para acompanhar as principais rotinas do setor (reuniões,
        checklists, análises, etc.). Mais adiante vamos ligar isso a uma tabela
        de rotinas e execuções.
      </p>

      <div className="mt-3 space-y-2 text-[11px]">
        <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-slate-700">
              Reunião tática do setor
            </p>
            <p className="text-[11px] text-slate-500">
              Frequência, participantes e status.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 border border-emerald-100">
            Em dia (mock)
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-slate-700">
              Rotina crítica do setor
            </p>
            <p className="text-[11px] text-slate-500">
              Ex.: DBO diário, checklist de frota, análise de indicadores.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-1 border border-amber-100">
            Atenção (mock)
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        Posteriormente, este farol será calculado a partir das execuções
        registradas no Supabase para cada rotina do setor.
      </p>
    </section>
  );
}

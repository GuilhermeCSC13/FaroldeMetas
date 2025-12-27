import React from "react";

export default function ResumoSetor({ setor }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h4 className="text-sm font-semibold text-slate-800">
        Resumo – {setor}
      </h4>
      <p className="text-xs text-slate-500 mt-1">
        Espaço para o resumo executivo do setor: principais indicadores,
        destaques, riscos e ações-chave. No futuro, este conteúdo pode vir de
        uma tabela de governança no Supabase.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase text-slate-500 font-semibold">
            Indicadores-chave
          </p>
          <p className="text-xs text-slate-600">
            Resumo dos principais números do setor.
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase text-slate-500 font-semibold">
            Ações prioritárias
          </p>
          <p className="text-xs text-slate-600">
            Principais ações para o período (mock).
          </p>
        </div>
      </div>
    </section>
  );
}

import React from "react";
import ResumoSetor from "./ResumoSetor";
import FarolMetasSetor from "./FarolMetasSetor";
import FarolRotinasSetor from "./FarolRotinasSetor";

export default function SetorSection({ setor }) {
  return (
    <section className="space-y-4 border-t border-slate-200 pt-6">
      {/* Título do setor */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800">{setor}</h3>
        <p className="text-xs text-slate-500 mt-1">
          Resumo, Farol de Metas e Farol de Rotinas para o setor de{" "}
          {setor.toLowerCase()}.
        </p>
      </div>

      {/* Resumo */}
      <ResumoSetor setor={setor} />

      {/* Farol de Metas */}
      <FarolMetasSetor setor={setor} />

      {/* Farol de Rotinas */}
      <FarolRotinasSetor setor={setor} />
    </section>
  );
}

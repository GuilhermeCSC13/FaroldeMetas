import React from "react";
import SetorSection from "../components/tatico/SetorSection";

const SETORES = ["Operação", "Manutenção", "Moov", "Financeiro", "Pessoas"];

export default function PlanejamentoTatico() {
  return (
    <div className="space-y-8">
      {/* Cabeçalho geral da página */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">
          Planejamento Tático
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Para cada setor, organize o resumo executivo, o farol de metas e o
          farol de rotinas. Nesta primeira versão, os blocos são apenas
          estruturais; depois vamos conectar tudo ao Supabase.
        </p>
      </div>

      {/* Um bloco completo por setor: Resumo / Farol de Metas / Farol de Rotinas */}
      {SETORES.map((setor) => (
        <SetorSection key={setor} setor={setor} />
      ))}
    </div>
  );
}

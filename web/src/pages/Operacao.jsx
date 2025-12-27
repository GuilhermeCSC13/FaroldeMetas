// src/pages/Operacao.jsx
import Layout from "../components/tatico/Layout";
import ResumoSetor from "../components/tatico/ResumoSetor";
import FarolMetasSetor from "../components/tatico/FarolMetasSetor";
import FarolRotinasSetor from "../components/tatico/FarolRotinasSetor";

export default function Operacao() {
  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Título da página */}
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
          Planejamento Tático — Operação
        </h1>

        <p className="text-sm text-gray-600 mb-6">
          Página dedicada ao setor de Operação. Aqui o resumo, o farol de metas
          e o farol de rotinas são específicos da Operação, sem misturar dados
          de Manutenção, Moov, Financeiro ou Pessoas.
        </p>

        {/* Resumo da Operação */}
        {/* Por enquanto deixamos “em desenvolvimento” dentro do componente */}
        <ResumoSetor setorKey="operacao" />

        {/* Farol de Metas — Operação (PCO / Gestão de Motoristas, vindo do Supabase) */}
        <FarolMetasSetor setorKey="operacao" />

        {/* Farol de Rotinas — Operação (ainda mock / em desenvolvimento) */}
        <FarolRotinasSetor setorKey="operacao" />
      </div>
    </Layout>
  );
}

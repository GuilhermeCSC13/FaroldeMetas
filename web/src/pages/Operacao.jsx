// web/src/pages/Operacao.jsx
import Layout from "../components/tatico/Layout";
import ResumoSetor from "../components/tatico/ResumoSetor";
import FarolMetasSetor from "../components/tatico/FarolMetasSetor";
import FarolRotinasSetor from "../components/tatico/FarolRotinasSetor";

export default function Operacao() {
  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Título da página */}
        <header>
          <h1 className="text-2xl font-semibold text-gray-800">
            Planejamento Tático — Operação
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Página dedicada ao setor de Operação. Aqui o resumo, o farol de metas
            e o farol de rotinas são apenas da Operação (PCO e Gestão de Motoristas),
            sem misturar Manutenção, Moov, Financeiro ou Pessoas.
          </p>
        </header>

        {/* Seção: Resumo */}
        <section id="resumo">
          {/* Por enquanto, o ResumoSetor("operacao") pode exibir "Em desenvolvimento" */}
          <ResumoSetor setorKey="operacao" />
        </section>

        {/* Seção: Farol de Metas */}
        <section id="metas">
          {/* Aqui entra o Farol de Metas da Operação (PCO / Gestão de Motoristas, vindo do Supabase) */}
          <FarolMetasSetor setorKey="operacao" />
        </section>

        {/* Seção: Farol de Rotinas */}
        <section id="rotinas">
          {/* Ainda em desenvolvimento – pode ser mock por enquanto */}
          <FarolRotinasSetor setorKey="operacao" />
        </section>
      </div>
    </Layout>
  );
}

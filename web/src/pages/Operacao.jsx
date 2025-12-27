// web/src/pages/Operacao.jsx
import Layout from "../components/Layout";
import ResumoSetor from "../components/tatico/ResumoSetor";
import FarolMetasSetor from "../components/tatico/FarolMetasSetor";
import FarolRotinasSetor from "../components/tatico/FarolRotinasSetor";

export default function Operacao() {
  return (
    <Layout>
      {/* Conteúdo da área de Operação */}
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-800">
            Planejamento Tático — Operação
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Página dedicada ao setor de Operação. Aqui o resumo, o farol de
            metas e o farol de rotinas são apenas da Operação (PCO e Gestão de
            Motoristas), sem misturar outros setores.
          </p>
        </header>

        {/* Resumo (em desenvolvimento por enquanto) */}
        <section id="resumo">
          <ResumoSetor setorKey="operacao" />
        </section>

        {/* Farol de Metas (PCO / Gestão de Motoristas) */}
        <section id="metas">
          <FarolMetasSetor setorKey="operacao" />
        </section>

        {/* Farol de Rotinas */}
        <section id="rotinas">
          <FarolRotinasSetor setorKey="operacao" />
        </section>
      </div>
    </Layout>
  );
}

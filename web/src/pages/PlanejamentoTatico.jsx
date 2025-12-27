// web/src/pages/PlanejamentoTatico.jsx
import Layout from "../components/Layout";
import SetorSection from "../components/tatico/SetorSection";

export default function PlanejamentoTatico() {
  return (
    <Layout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-gray-800">
            Planejamento Tático
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Para cada setor, organize o resumo executivo, o farol de metas e o
            farol de rotinas. Nesta primeira versão, os blocos são estruturais;
            depois vamos conectar tudo ao Supabase.
          </p>
        </header>

        {/* Operação */}
        <SetorSection
          setorKey="operacao"
          titulo="Operação"
          descricao="Resumo, Farol de Metas e Farol de Rotinas do setor de Operação."
        />

        {/* Manutenção */}
        <SetorSection
          setorKey="manutencao"
          titulo="Manutenção"
          descricao="Estrutura de planejamento tático para o setor de Manutenção."
        />

        {/* Moov */}
        <SetorSection
          setorKey="moov"
          titulo="Moov"
          descricao="Estrutura de planejamento tático para o Moov."
        />

        {/* Financeiro */}
        <SetorSection
          setorKey="financeiro"
          titulo="Financeiro"
          descricao="Estrutura de planejamento tático para o setor Financeiro."
        />

        {/* Pessoas */}
        <SetorSection
          setorKey="pessoas"
          titulo="Pessoas"
          descricao="Estrutura de planejamento tático para o setor de Pessoas."
        />
      </div>
    </Layout>
  );
}

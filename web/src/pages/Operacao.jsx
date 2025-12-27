// web/src/pages/Operacao.jsx
import { useLocation } from "react-router-dom";
import FarolMetasSetor from "../components/tatico/FarolMetasSetor";

function useSecaoAtiva() {
  const { hash } = useLocation();

  if (hash === "#metas") return "metas";
  if (hash === "#rotinas") return "rotinas";
  // padrão quando entra em /planejamento/operacao ou #resumo
  return "resumo";
}

export default function Operacao() {
  const secaoAtiva = useSecaoAtiva();

  return (
    <div className="space-y-6">
      {/* Título da página */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          Planejamento Tático — Operação
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          Página dedicada ao setor de Operação. Aqui o resumo, o farol de metas
          e o farol de rotinas são apenas da Operação (PCO e Gestão de
          Motoristas), sem misturar outros setores.
        </p>
      </header>

      {/* Conteúdo condicionado pela âncora da URL (#resumo, #metas, #rotinas) */}
      {secaoAtiva === "resumo" && (
        <section
          id="resumo"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
        >
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Resumo — Operação
          </h2>
          <p className="text-sm text-slate-600">
            Em desenvolvimento. Nesta seção vamos trazer o resumo executivo do
            setor (principais indicadores, destaques, riscos e ações-chave) com
            base nas informações consolidadas do farol de metas e das rotinas.
          </p>
        </section>
      )}

      {secaoAtiva === "metas" && (
        <section
          id="metas"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
        >
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Farol de Metas — Operação
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Metas anuais de 2026 carregadas diretamente do Supabase. Cada área
            da Operação (PCO e Gestão de Motoristas) tem seus próprios
            indicadores, pesos e metas mensais.
          </p>

          {/* Componente que monta a tabela PCO / Gestão de Motoristas */}
          <FarolMetasSetor />
        </section>
      )}

      {secaoAtiva === "rotinas" && (
        <section
          id="rotinas"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
        >
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Farol de Rotinas — Operação
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Em desenvolvimento. Aqui vamos controlar as principais rotinas da
            Operação (reuniões, checklists, análises, acompanhamentos de campo
            etc.), ligando cada rotina às metas do setor e calculando o farol de
            cumprimento.
          </p>

          <div className="mt-4 text-xs text-slate-500">
            Em uma próxima etapa, este farol será calculado automaticamente a
            partir das execuções registradas no Supabase para cada rotina.
          </div>
        </section>
      )}
    </div>
  );
}

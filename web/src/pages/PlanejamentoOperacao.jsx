// web/src/pages/PlanejamentoOperacao.jsx
export default function PlanejamentoOperacao() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Cabeçalho */}
      <header className="mb-4">
        <p className="text-xs text-gray-500">Planejamento Tático · Operação</p>
        <h1 className="text-2xl font-bold text-gray-800">
          Operação — Farol de Metas & Rotinas
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Estrutura inicial. Aqui será o piloto com dados reais de Supabase.
        </p>
      </header>

      {/* Resumo */}
      <section id="resumo" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Resumo</h2>
        <p className="text-sm text-gray-600">
          Visão geral dos principais indicadores da Operação (KM/L, intervenções,
          disponibilidade, absenteísmo etc.). Depois vamos montar os cards,
          gráficos e análise.
        </p>
      </section>

      {/* Farol de Metas */}
      <section id="metas" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Farol de Metas
        </h2>
        <p className="text-sm text-gray-600">
          Aqui ficará o farol de metas da Operação, com metas mensais,
          realizado, % de atingimento e cores (verde, amarelo, vermelho).
          Vamos plugar nas tabelas de metas do Supabase.
        </p>
      </section>

      {/* Farol de Rotinas */}
      <section id="rotinas" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Farol de Rotinas
        </h2>
        <p className="text-sm text-gray-600">
          Nesta área vamos listar as principais rotinas da Operação (diárias,
          semanais, mensais), com status de execução para apoiar a governança
          das reuniões táticas.
        </p>
      </section>
    </div>
  );
}

export default function PlanejamentoFinanceiro() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="mb-4">
        <p className="text-xs text-gray-500">Planejamento Tático · Financeiro</p>
        <h1 className="text-2xl font-bold text-gray-800">
          Financeiro — Farol de Metas & Rotinas
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Metas e rotinas ligadas a orçamento, DRE, caixa, custos, etc.
        </p>
      </header>

      <section id="resumo" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Resumo</h2>
        <p className="text-sm text-gray-600">
          Visão geral de resultados, variações, principais desvios.
        </p>
      </section>

      <section id="metas" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Farol de Metas
        </h2>
        <p className="text-sm text-gray-600">
          Metas financeiras: margem, EBITDA, custo/km, orçamento vs realizado,
          etc.
        </p>
      </section>

      <section id="rotinas" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Farol de Rotinas
        </h2>
        <p className="text-sm text-gray-600">
          Rotinas de fechamento, conciliações, revisões de contratos, etc.
        </p>
      </section>
    </div>
  );
}

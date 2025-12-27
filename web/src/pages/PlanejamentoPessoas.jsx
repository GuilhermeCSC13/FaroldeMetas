export default function PlanejamentoPessoas() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="mb-4">
        <p className="text-xs text-gray-500">Planejamento Tático · Pessoas</p>
        <h1 className="text-2xl font-bold text-gray-800">
          Pessoas — Farol de Metas & Rotinas
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Foco em gente e gestão: absenteísmo, turnover, treinamento, clima, etc.
        </p>
      </header>

      <section id="resumo" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Resumo</h2>
        <p className="text-sm text-gray-600">
          Visão geral dos indicadores de pessoas.
        </p>
      </section>

      <section id="metas" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Farol de Metas
        </h2>
        <p className="text-sm text-gray-600">
          Metas ligadas a pessoas: absenteísmo, turnover, treinamento, etc.
        </p>
      </section>

      <section id="rotinas" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Farol de Rotinas
        </h2>
        <p className="text-sm text-gray-600">
          Rotinas de acompanhamento, reuniões, feedbacks, DDS, etc.
        </p>
      </section>
    </div>
  );
}

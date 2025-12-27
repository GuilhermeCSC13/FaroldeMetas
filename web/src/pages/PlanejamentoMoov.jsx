export default function PlanejamentoMoov() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="mb-4">
        <p className="text-xs text-gray-500">Planejamento Tático · Moov</p>
        <h1 className="text-2xl font-bold text-gray-800">
          Moov — Farol de Metas & Rotinas
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Espaço para metas e rotinas ligadas à bilhetagem / sistemas.
        </p>
      </header>

      <section id="resumo" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Resumo</h2>
        <p className="text-sm text-gray-600">
          Status geral de integrações, bilhetagem, SLA de suporte etc.
        </p>
      </section>

      <section id="metas" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Farol de Metas
        </h2>
        <p className="text-sm text-gray-600">
          Metas de disponibilidade de sistema, falhas de validadores, prazos de
          atendimento, etc.
        </p>
      </section>

      <section id="rotinas" className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Farol de Rotinas
        </h2>
        <p className="text-sm text-gray-600">
          Rotinas de verificação, conciliações, backups, checks diários, etc.
        </p>
      </section>
    </div>
  );
}

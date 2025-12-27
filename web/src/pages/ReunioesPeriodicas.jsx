const mockReunioes = [
  {
    id: "dbo-manutencao",
    nome: "DBO Manutenção",
    area: "Manutenção",
    periodicidade: "Diária · 15 minutos",
    horario: "08:00",
    foco: "SRs, SOS, veículos parados e ações do dia.",
  },
  {
    id: "km-l",
    nome: "Reunião de KM/L",
    area: "Operação + Manutenção",
    periodicidade: "Semanal · 30 minutos",
    horario: "Quinta · 14:00",
    foco: "Evolução do consumo, ranking de motoristas e ações por cluster.",
  },
  {
    id: "seguranca",
    nome: "Comitê de Segurança",
    area: "Operação + RH + Segurança",
    periodicidade: "Mensal · 60 minutos",
    horario: "Última sexta · 09:00",
    foco: "Acidentes, incidentes, comportamento e planos de ação.",
  },
];

export default function ReunioesPeriodicas() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">
          Reuniões Periódicas
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Cadastro visual das principais reuniões táticas da operação. Nesta
          fase estamos só desenhando a interface; depois vamos conectar com o
          Supabase e com a transcrição automática.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            Rituais cadastrados
          </span>
          <button className="px-3 py-1.5 text-xs rounded-lg bg-blue-700 text-white hover:bg-blue-800 transition-colors">
            + Nova reunião (visual)
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {mockReunioes.map((r) => (
            <div
              key={r.id}
              className="px-5 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 hover:bg-slate-50"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  {r.nome}
                </h3>
                <p className="text-xs text-slate-500">{r.area}</p>
                <p className="mt-1 text-xs text-slate-500">{r.foco}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p className="font-medium text-slate-700">
                  {r.periodicidade}
                </p>
                <p>{r.horario}</p>
                <p className="mt-1 text-blue-600">
                  (no futuro: link para atas, áudio e transcrição)
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

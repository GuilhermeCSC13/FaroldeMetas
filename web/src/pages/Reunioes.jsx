import { Link } from "react-router-dom";

const mockReunioes = [
  {
    id: "dbo-manutencao",
    nome: "DBO Manutenção",
    periodicidade: "Segunda a Sexta",
    duracao: "15 min"
  },
  {
    id: "km-l",
    nome: "Reunião KM/L",
    periodicidade: "Semanal",
    duracao: "30 min"
  }
];

export default function Reunioes() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          Reuniões Periódicas
        </h1>
        <button className="px-3 py-2 text-sm rounded-md bg-slate-900 text-white">
          + Nova reunião
        </button>
      </div>

      <div className="bg-white rounded-xl shadow divide-y">
        {mockReunioes.map((r) => (
          <Link
            key={r.id}
            to={`/reunioes/${r.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                {r.nome}
              </h2>
              <p className="text-xs text-slate-500">
                {r.periodicidade} · {r.duracao}
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Ver detalhes / gravações
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

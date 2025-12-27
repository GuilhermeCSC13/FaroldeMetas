export default function Dashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">
        Farol de Metas e Rotinas
      </h1>
      <p className="text-sm text-slate-600">
        Aqui teremos os faróis por área (Operação, Manutenção, ADM, Moov),
        metas e cumprimento das rotinas.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Operação – KM/L
          </h2>
          <p className="text-3xl font-bold text-emerald-600 mt-2">2,60</p>
          <p className="text-xs text-slate-500 mt-1">
            Meta 2026: 2,74 (progresso será puxado da base depois).
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Manutenção – MKBF
          </h2>
          <p className="text-3xl font-bold text-indigo-600 mt-2">X km</p>
          <p className="text-xs text-slate-500 mt-1">
            Vamos ligar no futuro com a base do Transnet / SOS.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Rotinas cumpridas
          </h2>
          <p className="text-3xl font-bold text-amber-600 mt-2">0%</p>
          <p className="text-xs text-slate-500 mt-1">
            Depois vamos trazer as rotinas diárias/semanais concluídas.
          </p>
        </div>
      </div>
    </div>
  );
}
  

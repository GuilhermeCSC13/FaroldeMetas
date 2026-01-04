// src/pages/Projetos.jsx
import Layout from "../components/tatico/Layout";

export default function Projetos() {
  return (
    <Layout>
      <div className="flex flex-col gap-4 p-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Projetos Estratégicos
            </h1>
            <p className="text-sm text-slate-500">
              Visão centralizada dos projetos e portfólios (Asana → Supabase).
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              Aqui vamos integrar os portfólios / projetos do Asana com o
              Supabase e exibir:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              <li>Lista de portfólios do Asana</li>
              <li>Projetos por portfólio</li>
              <li>Link com ações / farol tático</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}

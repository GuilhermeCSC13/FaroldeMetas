import { Link, useLocation } from "react-router-dom";

const menu = [
  { path: "/", label: "Dashboard" },
  { path: "/reunioes", label: "Reuniões" },
  { path: "/config", label: "Configurações" }
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-slate-700">
          Farol Quatai
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {menu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-3 py-2 rounded-md text-sm ${
                location.pathname === item.path
                  ? "bg-slate-700 font-semibold"
                  : "hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 text-xs text-slate-400 border-t border-slate-700">
          v0.1 – Farol de Metas e Reuniões
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

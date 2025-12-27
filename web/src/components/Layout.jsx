import { NavLink } from "react-router-dom";

const menu = [
  { path: "/", label: "Início" },
  { path: "/planejamento-tatico", label: "Planejamento Tático" },
  { path: "/reunioes-periodicas", label: "Reuniões Periódicas" },
];

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* Sidebar fixa à ESQUERDA */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-blue-700 text-white flex flex-col shadow-xl z-20">
        {/* Logo / saudação */}
        <div className="px-5 py-4 border-b border-blue-500 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
            🚍
          </div>
          <div className="leading-tight">
            <p className="text-xs text-blue-100">Olá, Guilherme 👋</p>
            <p className="text-sm font-semibold">Seja bem-vindo!</p>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                [
                  "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-blue-100 hover:bg-blue-600/70",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Rodapé */}
        <div className="px-4 py-3 border-t border-blue-500 text-[11px] text-blue-100">
          © {new Date().getFullYear()} InovaQuatai · Farol de Metas
        </div>
      </aside>

      {/* Conteúdo principal com espaço reservado para a sidebar à ESQUERDA */}
      <div className="min-h-screen pl-72">
        {/* Topbar simples */}
        <header className="h-16 flex items-center px-8 border-b bg-white/80 backdrop-blur">
          <div>
            <p className="text-xs text-slate-500">Farol de Metas e Rotinas</p>
            <h1 className="text-lg font-semibold">Planejamento Quatai</h1>
          </div>
        </header>

        <main className="px-8 py-6">{children}</main>
      </div>
    </div>
  );
}

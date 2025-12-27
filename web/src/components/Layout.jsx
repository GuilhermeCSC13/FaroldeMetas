// web/src/components/Layout.jsx
import Sidebar from "./tatico/Sidebar";

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      {/* Sidebar fixa à esquerda */}
      <Sidebar />

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-16 flex items-center px-8 border-b bg-white/80 backdrop-blur">
          <div>
            <p className="text-xs text-slate-500">Farol de Metas e Rotinas</p>
            <h1 className="text-lg font-semibold">Planejamento Quatai</h1>
          </div>
        </header>

        <main className="px-8 py-6 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

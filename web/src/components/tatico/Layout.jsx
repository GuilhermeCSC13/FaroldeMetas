// src/components/tatico/Layout.jsx
import Sidebar from "./Sidebar";
import TacticalAssistant from "./TacticalAssistant";
import RecorderDock from "./RecorderDock"; // ✅ NOVO (dock do gravador)

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Conteúdo da Página */}
        <div className="flex-1 overflow-auto">{children}</div>

        {/* Dock de Gravação (global, sempre disponível) */}
        <RecorderDock />

        {/* Assistente Flutuante (fica por cima de tudo) */}
        <TacticalAssistant />
      </main>
    </div>
  );
}

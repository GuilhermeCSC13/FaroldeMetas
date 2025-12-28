import Sidebar from "./Sidebar";
import TacticalAssistant from "./TacticalAssistant"; // <--- Importe aqui

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Conteúdo da Página */}
        <div className="flex-1 overflow-auto">
           {children}
        </div>
        
        {/* Assistente Flutuante (Fica por cima de tudo) */}
        <TacticalAssistant /> 
      </main>
    </div>
  );
}

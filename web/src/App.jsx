import { BrowserRouter, Routes, Route } from "react-router-dom";

// Páginas
import Inicio from "./pages/Inicio";

// Módulos Táticos
import Operacao from "./pages/Operacao"; // Controlador da Operação
import Moov from "./pages/Moov";         // <--- Novo Controlador da Moov

// Outras Páginas
import ReunioesPeriodicas from "./pages/ReunioesPeriodicas";
import DetalheReuniao from "./pages/DetalheReuniao";
import Configuracoes from "./pages/Configuracoes";

export default function App() {
  return (
    <BrowserRouter>
      {/* Removemos o <Layout> global daqui. 
         Cada módulo (Operacao, Moov, etc) chama seu próprio Layout (tatico/Layout).
      */}
      <Routes>
        <Route path="/" element={<Inicio />} />
        
        {/* --- MÓDULO OPERAÇÃO --- */}
        {/* Gerencia #metas, #rotinas, #resumo */}
        <Route path="/planejamento/operacao" element={<Operacao />} />

        {/* --- MÓDULO MOOV (Novo) --- */}
        {/* Gerencia #metas, #rotinas */}
        <Route path="/moov" element={<Moov />} />

        {/* --- ROTAS SECUNDÁRIAS --- */}
        <Route path="/reunioes-periodicas" element={<ReunioesPeriodicas />} />
        <Route path="/reunioes/:id" element={<DetalheReuniao />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        
        {/* Redirecionamentos */}
        <Route path="/planejamento-tatico" element={<Inicio />} /> 
      </Routes>
    </BrowserRouter>
  );
}

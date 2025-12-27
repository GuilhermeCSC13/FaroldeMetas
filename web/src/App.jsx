import { BrowserRouter, Routes, Route } from "react-router-dom";

// Páginas Principais
import Inicio from "./pages/Inicio";

// Módulos Táticos
import Operacao from "./pages/Operacao";
import Moov from "./pages/Moov";
import Manutencao from "./pages/Manutencao"; // <--- IMPORTAR AQUI

// Outras Páginas
import ReunioesPeriodicas from "./pages/ReunioesPeriodicas";
import DetalheReuniao from "./pages/DetalheReuniao";
import Configuracoes from "./pages/Configuracoes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        
        {/* --- MÓDULO OPERAÇÃO --- */}
        <Route path="/planejamento/operacao" element={<Operacao />} />

        {/* --- MÓDULO MOOV --- */}
        <Route path="/moov" element={<Moov />} />

        {/* --- MÓDULO MANUTENÇÃO (NOVO) --- */}
        <Route path="/manutencao" element={<Manutencao />} />

        {/* --- ROTAS SECUNDÁRIAS --- */}
        <Route path="/reunioes-periodicas" element={<ReunioesPeriodicas />} />
        <Route path="/reunioes/:id" element={<DetalheReuniao />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        
        {/* Redirecionamento Padrão */}
        <Route path="/planejamento-tatico" element={<Inicio />} /> 
      </Routes>
    </BrowserRouter>
  );
}

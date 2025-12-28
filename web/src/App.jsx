import { BrowserRouter, Routes, Route } from "react-router-dom";

// Páginas Principais
import Inicio from "./pages/Inicio";

// Módulos Táticos
import Operacao from "./pages/Operacao";
import Moov from "./pages/Moov";
import Manutencao from "./pages/Manutencao";

// Reuniões & Ações
import ReunioesCalendario from "./pages/ReunioesCalendario";
import DetalheReuniao from "./pages/DetalheReuniao";
import GestaoAcoes from "./pages/GestaoAcoes";
import CentralReunioes from "./pages/CentralReunioes"; // <--- NOVO IMPORT

// Inteligência Artificial
import Copiloto from "./pages/Copiloto";

// Configurações
import Configuracoes from "./pages/Configuracoes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home */}
        <Route path="/" element={<Inicio />} />
        
        {/* --- MÓDULOS DE ÁREAS --- */}
        <Route path="/planejamento/operacao" element={<Operacao />} />
        <Route path="/moov" element={<Moov />} />
        <Route path="/manutencao" element={<Manutencao />} />

        {/* --- MÓDULO REUNIÕES --- */}
        <Route path="/central-reunioes" element={<CentralReunioes />} /> {/* <--- NOVA ROTA PRINCIPAL */}
        <Route path="/reunioes-calendario" element={<ReunioesCalendario />} />
        <Route path="/reunioes/:id" element={<DetalheReuniao />} />
        <Route path="/gestao-acoes" element={<GestaoAcoes />} />

        {/* --- COPILOTO IA --- */}
        <Route path="/copiloto" element={<Copiloto />} />

        {/* --- CONFIGURAÇÕES GERAIS --- */}
        <Route path="/configuracoes" element={<Configuracoes />} />
        
        {/* Redirecionamento de segurança */}
        <Route path="/planejamento-tatico" element={<Inicio />} /> 
      </Routes>
    </BrowserRouter>
  );
}

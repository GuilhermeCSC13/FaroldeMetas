import { BrowserRouter, Routes, Route } from "react-router-dom";

// Páginas Principais
import Inicio from "./pages/Inicio";

// Módulos Táticos
import Operacao from "./pages/Operacao";
import Moov from "./pages/Moov";
import Manutencao from "./pages/Manutencao";
import Financeiro from "./pages/Financeiro"; // NOVO
import Pessoas from "./pages/Pessoas";       // NOVO

// Reuniões & Ações
import ReunioesCalendario from "./pages/ReunioesCalendario";
import DetalheReuniao from "./pages/DetalheReuniao";
import GestaoAcoes from "./pages/GestaoAcoes";

// Novos Módulos de Gestão
import CentralReunioes from "./pages/CentralReunioes";
import CentralAtas from "./pages/CentralAtas";

// Inteligência Artificial
import Copiloto from "./pages/Copiloto";

// Configurações
import Configuracoes from "./pages/Configuracoes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        
        {/* --- MÓDULOS DE ÁREAS --- */}
        <Route path="/planejamento/operacao" element={<Operacao />} />
        <Route path="/planejamento/financeiro" element={<Financeiro />} />
        <Route path="/planejamento/pessoas" element={<Pessoas />} />
        <Route path="/moov" element={<Moov />} />
        <Route path="/manutencao" element={<Manutencao />} />

        {/* --- MÓDULO REUNIÕES & ATAS --- */}
        <Route path="/central-reunioes" element={<CentralReunioes />} />
        <Route path="/central-atas" element={<CentralAtas />} />
        <Route path="/gestao-acoes" element={<GestaoAcoes />} />

        {/* Rotas Legado */}
        <Route path="/reunioes-calendario" element={<ReunioesCalendario />} />
        <Route path="/reunioes/:id" element={<DetalheReuniao />} />

        <Route path="/copiloto" element={<Copiloto />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/planejamento-tatico" element={<Inicio />} /> 
      </Routes>
    </BrowserRouter>
  );
}

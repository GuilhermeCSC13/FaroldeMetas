// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// ✅ NOVO: Landing/Guard
import LandingFarol from "./pages/LandingFarol";

// Páginas Principais
import Inicio from "./pages/Inicio";

// Módulos Táticos
import Operacao from "./pages/Operacao";
import Moov from "./pages/Moov";
import Manutencao from "./pages/Manutencao";
import Administrativo from "./pages/Administrativo";

// Reuniões & Ações
import ReunioesCalendario from "./pages/ReunioesCalendario";
import DetalheReuniao from "./pages/DetalheReuniao";
import GestaoAcoes from "./pages/GestaoAcoes";

// Novos Módulos de Gestão
import CentralReunioes from "./pages/CentralReunioes";
import CentralAtas from "./pages/CentralAtas";

// Tipos de Reunião
import TiposReuniao from "./pages/TiposReuniao";

// IA
import Copiloto from "./pages/Copiloto";

// Configurações
import Configuracoes from "./pages/Configuracoes";

// Projetos
import Projetos from "./pages/Projetos";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ✅ Entrada: se entrar direto no link do Farol, passa no Guard */}
        <Route path="/" element={<LandingFarol />} />

        {/* ✅ Home real do Farol */}
        <Route path="/inicio" element={<Inicio />} />

        {/* --- MÓDULOS DE ÁREAS --- */}
        <Route path="/planejamento/operacao" element={<Operacao />} />
        <Route path="/planejamento/administrativo" element={<Administrativo />} />
        <Route path="/moov" element={<Moov />} />
        <Route path="/manutencao" element={<Manutencao />} />

        {/* --- REUNIÕES & ATAS --- */}
        <Route path="/central-reunioes" element={<CentralReunioes />} />
        <Route path="/tipos-reuniao" element={<TiposReuniao />} />
        <Route path="/central-atas" element={<CentralAtas />} />
        <Route path="/gestao-acoes" element={<GestaoAcoes />} />

        {/* Projetos */}
        <Route path="/projetos" element={<Projetos />} />

        {/* Legado */}
        <Route path="/reunioes-calendario" element={<ReunioesCalendario />} />
        <Route path="/reunioes/:id" element={<DetalheReuniao />} />

        {/* IA / Configurações */}
        <Route path="/copiloto" element={<Copiloto />} />
        <Route path="/configuracoes" element={<Configuracoes />} />

        {/* Alias (mantém compatibilidade) */}
        <Route path="/planejamento-tatico" element={<Navigate to="/inicio" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

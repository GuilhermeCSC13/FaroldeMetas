import { BrowserRouter, Routes, Route } from "react-router-dom";

// Páginas Principais
import Inicio from "./pages/Inicio";

// Módulos Táticos
import Operacao from "./pages/Operacao";
import Moov from "./pages/Moov";
import Manutencao from "./pages/Manutencao";
import Administrativo from "./pages/Administrativo"; // MAIN ADM

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

// Projetos (NOVO)
import Projetos from "./pages/Projetos";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home / Visão Geral */}
        <Route path="/" element={<Inicio />} />

        {/* --- MÓDULOS DE ÁREAS --- */}
        <Route path="/planejamento/operacao" element={<Operacao />} />
        <Route path="/planejamento/administrativo" element={<Administrativo />} />
        <Route path="/moov" element={<Moov />} />
        <Route path="/manutencao" element={<Manutencao />} />

        {/* (opcional) compatibilidade com rotas antigas */}
        {/*
        <Route path="/planejamento/financeiro" element={<Administrativo />} />
        <Route path="/planejamento/pessoas" element={<Administrativo />} />
        */}

        {/* --- MÓDULO REUNIÕES & ATAS --- */}
        <Route path="/central-reunioes" element={<CentralReunioes />} />
        <Route path="/central-atas" element={<CentralAtas />} />
        <Route path="/gestao-acoes" element={<GestaoAcoes />} />

        {/* Projetos (NOVO) */}
        <Route path="/projetos" element={<Projetos />} />

        {/* Rotas legado */}
        <Route path="/reunioes-calendario" element={<ReunioesCalendario />} />
        <Route path="/reunioes/:id" element={<DetalheReuniao />} />

        {/* IA / Configurações */}
        <Route path="/copiloto" element={<Copiloto />} />
        <Route path="/configuracoes" element={<Configuracoes />} />

        {/* Alias geral para Planejamento Tático apontando para a Home */}
        <Route path="/planejamento-tatico" element={<Inicio />} />
      </Routes>
    </BrowserRouter>
  );
}

// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Sidebar from "./components/tatico/Sidebar";

// Páginas
import Inicio from "./pages/Inicio";
import PlanejamentoTatico from "./pages/PlanejamentoTatico";
import Operacao from "./pages/Operacao";
import ReunioesPeriodicas from "./pages/ReunioesPeriodicas";
import DetalheReuniao from "./pages/DetalheReuniao";
import Dashboard from "./pages/Dashboard";
import Configuracoes from "./pages/Configuracoes";

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-100">
        {/* Sidebar fixa à esquerda */}
        <Sidebar />

        {/* Conteúdo principal */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Routes>
            {/* Início */}
            <Route path="/" element={<Inicio />} />

            {/* Planejamento Tático (visão geral dos setores) */}
            <Route
              path="/planejamento-tatico"
              element={<PlanejamentoTatico />}
            />

            {/* Planejamento / Farol da Operação */}
            <Route path="/operacao" element={<Operacao />} />

            {/* Reuniões Periódicas */}
            <Route
              path="/reunioes-periodicas"
              element={<ReunioesPeriodicas />}
            />

            {/* Detalhe de uma reunião específica */}
            <Route
              path="/reunioes-periodicas/:id"
              element={<DetalheReuniao />}
            />

            {/* Dashboard (caso esteja usando como visão sintética) */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Configurações gerais da ferramenta */}
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

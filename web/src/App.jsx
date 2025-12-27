// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Inicio from "./pages/Inicio";
import Dashboard from "./pages/Dashboard";
import PlanejamentoTatico from "./pages/PlanejamentoTatico";
import Operacao from "./pages/Operacao";
import ReunioesPeriodicas from "./pages/ReunioesPeriodicas";
import DetalheReuniao from "./pages/DetalheReuniao";
import Configuracoes from "./pages/Configuracoes";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Visão geral do Planejamento Tático (todos os setores, mock) */}
        <Route path="/planejamento-tatico" element={<PlanejamentoTatico />} />

        {/* Página dedicada da Operação */}
        <Route
          path="/planejamento-tatico/operacao"
          element={<Operacao />}
        />

        {/* Reuniões / Configurações (já existentes) */}
        <Route
          path="/reunioes-periodicas"
          element={<ReunioesPeriodicas />}
        />
        <Route
          path="/reunioes-periodicas/:id"
          element={<DetalheReuniao />}
        />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Routes>
    </Router>
  );
}

export default App;

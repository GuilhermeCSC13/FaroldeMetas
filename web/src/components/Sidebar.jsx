// web/src/App.jsx
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
        {/* Início */}
        <Route path="/" element={<Inicio />} />

        {/* Dashboard (se você estiver usando) */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Visão geral do Planejamento Tático (todos os setores em mock) */}
        <Route path="/planejamento-tatico" element={<PlanejamentoTatico />} />

        {/* PÁGINA EXCLUSIVA DA OPERAÇÃO */}
        <Route
          path="/planejamento/operacao"
          element={<Operacao />}
        />

        {/* (no futuro você pode criar as outras páginas por setor) */}
        {/* <Route path="/planejamento/manutencao" element={<Manutencao />} /> */}
        {/* <Route path="/planejamento/moov" element={<Moov />} /> */}
        {/* ... */}

        {/* Reuniões */}
        <Route
          path="/reunioes-periodicas"
          element={<ReunioesPeriodicas />}
        />
        <Route
          path="/reunioes-periodicas/:id"
          element={<DetalheReuniao />}
        />

        {/* Configurações */}
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Routes>
    </Router>
  );
}

export default App;

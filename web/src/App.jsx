// web/src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Sidebar
import Sidebar from "./components/Sidebar";

// Páginas gerais
import Inicio from "./pages/Inicio";
import PlanejamentoTatico from "./pages/PlanejamentoTatico";
import ReunioesPeriodicas from "./pages/ReunioesPeriodicas";
import DetalheReuniao from "./pages/DetalheReuniao";
import Dashboard from "./pages/Dashboard";
import Configuracoes from "./pages/Configuracoes";

// Páginas de Planejamento por setor
import PlanejamentoOperacao from "./pages/PlanejamentoOperacao";
import PlanejamentoManutencao from "./pages/PlanejamentoManutencao";
import PlanejamentoMoov from "./pages/PlanejamentoMoov";
import PlanejamentoFinanceiro from "./pages/PlanejamentoFinanceiro";
import PlanejamentoPessoas from "./pages/PlanejamentoPessoas";

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

            {/* Visão geral do Planejamento Tático (se quiser usar) */}
            <Route
              path="/planejamento-tatico"
              element={<PlanejamentoTatico />}
            />

            {/* Páginas de cada setor do Planejamento Tático */}
            <Route
              path="/planejamento/operacao"
              element={<PlanejamentoOperacao />}
            />
            <Route
              path="/planejamento/manutencao"
              element={<PlanejamentoManutencao />}
            />
            <Route path="/planejamento/moov" element={<PlanejamentoMoov />} />
            <Route
              path="/planejamento/financeiro"
              element={<PlanejamentoFinanceiro />}
            />
            <Route
              path="/planejamento/pessoas"
              element={<PlanejamentoPessoas />}
            />

            {/* Reuniões Periódicas */}
            <Route
              path="/reunioes-periodicas"
              element={<ReunioesPeriodicas />}
            />
            <Route
              path="/reunioes-periodicas/:id"
              element={<DetalheReuniao />}
            />

            {/* Dashboard geral */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Configurações */}
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

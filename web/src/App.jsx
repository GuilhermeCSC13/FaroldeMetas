// web/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Sidebar (está em web/src/components/Sidebar.jsx)
import Sidebar from "./components/Sidebar";

// Páginas gerais existentes
import Inicio from "./pages/Inicio";
import PlanejamentoTatico from "./pages/PlanejamentoTatico";
import ReunioesPeriodicas from "./pages/ReunioesPeriodicas";
import DetalheReuniao from "./pages/DetalheReuniao";
import Dashboard from "./pages/Dashboard";
import Configuracoes from "./pages/Configuracoes";
// Se você ainda usa a página Operacao antiga, pode manter:
import Operacao from "./pages/Operacao";

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

            {/* Visão geral do Planejamento Tático */}
            <Route
              path="/planejamento-tatico"
              element={<PlanejamentoTatico />}
            />

            {/* Rota antiga de Operação (se quiser manter algum uso atual) */}
            <Route path="/operacao" element={<Operacao />} />

            {/* Qualquer rota de planejamento de setor cai, por enquanto,
               na visão geral de Planejamento Tático.
               Ex.: /planejamento/operacao, /planejamento/manutencao etc.
               (o #resumo, #metas, #rotinas é âncora, o Router ignora) */}
            <Route
              path="/planejamento/:qualquerCoisa"
              element={<PlanejamentoTatico />}
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

            {/* Qualquer rota desconhecida redireciona para Início */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

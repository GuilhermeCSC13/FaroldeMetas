// web/src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";

// Páginas
import Inicio from "./pages/Inicio";
import PlanejamentoTatico from "./pages/PlanejamentoTatico";
import Operacao from "./pages/Operacao";
import ReunioesPeriodicas from "./pages/ReunioesPeriodicas";
import DetalheReuniao from "./pages/DetalheReuniao";
import Configuracoes from "./pages/Configuracoes";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route
            path="/planejamento-tatico"
            element={<PlanejamentoTatico />}
          />
          <Route path="/planejamento/operacao" element={<Operacao />} />
          <Route
            path="/reunioes-periodicas"
            element={<ReunioesPeriodicas />}
          />
          <Route path="/reunioes/:id" element={<DetalheReuniao />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

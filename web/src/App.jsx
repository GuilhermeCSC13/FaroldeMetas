import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Inicio from "./pages/Inicio";
import PlanejamentoTatico from "./pages/PlanejamentoTatico";
import ReunioesPeriodicas from "./pages/ReunioesPeriodicas";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/planejamento-tatico" element={<PlanejamentoTatico />} />
        <Route path="/reunioes-periodicas" element={<ReunioesPeriodicas />} />
      </Routes>
    </Layout>
  );
}

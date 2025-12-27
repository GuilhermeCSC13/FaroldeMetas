import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Reunioes from "./pages/Reunioes";
import DetalheReuniao from "./pages/DetalheReuniao";
import Configuracoes from "./pages/Configuracoes";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reunioes" element={<Reunioes />} />
        <Route path="/reunioes/:id" element={<DetalheReuniao />} />
        <Route path="/config" element={<Configuracoes />} />
      </Routes>
    </Layout>
  );
}

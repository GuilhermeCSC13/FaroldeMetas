import { BrowserRouter, Routes, Route } from "react-router-dom";

// Páginas
import Inicio from "./pages/Inicio";
// O componente Operacao agora age como o "Controlador" (Abas: Resumo, Metas, Rotinas)
import Operacao from "./pages/Operacao"; 
import ReunioesPeriodicas from "./pages/ReunioesPeriodicas";
import DetalheReuniao from "./pages/DetalheReuniao";
import Configuracoes from "./pages/Configuracoes";

export default function App() {
  return (
    <BrowserRouter>
      {/* Removemos o <Layout> global daqui. 
        Agora cada módulo (ex: Operacao) chama seu próprio Layout (tatico/Layout).
      */}
      <Routes>
        <Route path="/" element={<Inicio />} />
        
        {/* Rota principal do Módulo Operação */}
        {/* Este componente gerencia os hashs #metas, #rotinas, #resumo */}
        <Route path="/planejamento/operacao" element={<Operacao />} />

        {/* Rotas secundárias / Placeholders */}
        <Route path="/reunioes-periodicas" element={<ReunioesPeriodicas />} />
        <Route path="/reunioes/:id" element={<DetalheReuniao />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        
        {/* Redirecionamentos ou rotas futuras */}
        <Route path="/planejamento-tatico" element={<Inicio />} /> 
      </Routes>
    </BrowserRouter>
  );
}

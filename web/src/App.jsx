// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RequireFarolAuth from "./routes/RequireFarolAuth";

import { RecordingProvider } from "./context/RecordingContext";

// ✅ Landing público
import LandingFarol from "./pages/LandingFarol";

// ✅ NOVA PAGINA DE LIMPEZA (Crie este arquivo se ainda não criou)
import ReceberAcesso from "./pages/ReceberAcesso";

import Inicio from "./pages/Inicio";
import Operacao from "./pages/Operacao";
import Moov from "./pages/Moov";
import Manutencao from "./pages/Manutencao";
import Administrativo from "./pages/Administrativo";
import ReunioesCalendario from "./pages/ReunioesCalendario";
import DetalheReuniao from "./pages/DetalheReuniao";
import GestaoAcoes from "./pages/GestaoAcoes";
import CentralReunioes from "./pages/CentralReunioes";
import CentralAtas from "./pages/CentralAtas";
import TiposReuniao from "./pages/TiposReuniao";
import Copiloto from "./pages/Copiloto";
import Configuracoes from "./pages/Configuracoes";
import Projetos from "./pages/Projetos";

export default function App() {
  return (
    <RecordingProvider>
      <BrowserRouter>
        <Routes>
          {/* ✅ ROTA ESPECIAL DE LIMPEZA E SINCRONIA */}
          {/* O Inove deve redirecionar para cá: https://farol.../receber-acesso?userData=... */}
          <Route path="/receber-acesso" element={<ReceberAcesso />} />

          {/* ✅ PÚBLICO: Landing padrão */}
          <Route path="/" element={<LandingFarol />} />

          {/* 🔐 PROTEGIDO: Todo o sistema do Farol */}
          <Route element={<RequireFarolAuth />}>
            <Route path="/inicio" element={<Inicio />} />

            <Route path="/planejamento/operacao" element={<Operacao />} />
            <Route path="/planejamento/administrativo" element={<Administrativo />} />
            <Route path="/moov" element={<Moov />} />
            <Route path="/manutencao" element={<Manutencao />} />

            <Route path="/central-reunioes" element={<CentralReunioes />} />
            <Route path="/tipos-reuniao" element={<TiposReuniao />} />
            <Route path="/central-atas" element={<CentralAtas />} />
            <Route path="/gestao-acoes" element={<GestaoAcoes />} />

            <Route path="/projetos" element={<Projetos />} />

            <Route path="/reunioes-calendario" element={<ReunioesCalendario />} />
            <Route path="/reunioes/:id" element={<DetalheReuniao />} />

            <Route path="/copiloto" element={<Copiloto />} />
            <Route path="/configuracoes" element={<Configuracoes />} />

            <Route path="/planejamento-tatico" element={<Navigate to="/inicio" replace />} />
          </Route>

          {/* ✅ Qualquer rota inexistente vai para Landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </RecordingProvider>
  );
}

import { BrowserRouter, Routes, Route } from "react-router-dom";

import Sidebar from "./components/Sidebar";

import Home from "./pages/Home";
import PlanejamentoTatico from "./pages/PlanejamentoTatico";
import Operacao from "./pages/Operacao";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex">
        <Sidebar />

        <main className="ml-64 p-6 w-full min-h-screen bg-slate-50">
          <Routes>

            <Route path="/" element={<Home />} />

            <Route
              path="/planejamento-tatico"
              element={<PlanejamentoTatico />}
            />

            {/* NOVA ROTA */}
            <Route
              path="/operacao"
              element={<Operacao />}
            />

          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

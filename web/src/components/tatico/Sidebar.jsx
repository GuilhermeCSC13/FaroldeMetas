// src/components/Sidebar.jsx
import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  FaHome,
  FaClipboardList,
  FaCogs,
  FaChevronDown,
  FaChevronRight,
  FaCalendarAlt,
  FaTasks,
  FaMicrophone,
  FaTags, // ✅ NOVO
} from "react-icons/fa";

const setores = [
  { key: "operacao", label: "Operação", path: "/planejamento/operacao" },
  { key: "manutencao", label: "Manutenção", path: "/manutencao" },
  { key: "moov", label: "Moov", path: "/moov" },
  { key: "administrativo", label: "Administrativo", path: "/planejamento/administrativo" },
];

export default function Sidebar() {
  const location = useLocation();

  const isPlanejamentoActive = setores.some((s) =>
    location.pathname.startsWith(s.path)
  );

  const [openPlanejamento, setOpenPlanejamento] = useState(isPlanejamentoActive);

  useEffect(() => {
    if (isPlanejamentoActive) {
      setOpenPlanejamento(true);
    }
  }, [location.pathname, isPlanejamentoActive]);

  const linkBaseClasses =
    "flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors";
  const linkInactiveClasses =
    "text-blue-100 hover:text-white hover:bg-blue-600/60";
  const linkActiveClasses = "bg-blue-100 text-blue-700 font-semibold";

  return (
    <aside className="w-64 bg-blue-700 text-white flex flex-col min-h-screen font-sans shrink-0 transition-all duration-300">
      {/* Header */}
      <div className="px-4 py-4 border-b border-blue-500/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center text-xl font-bold backdrop-blur-sm">
            Q
          </div>
          <div>
            <p className="text-xs text-blue-100 opacity-80">Olá, Gestor 👋</p>
            <p className="text-sm font-bold tracking-tight">Farol Tático</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {/* Visão Geral */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            `${linkBaseClasses} ${
              isActive ? linkActiveClasses : linkInactiveClasses
            }`
          }
          end
        >
          <FaHome className="text-sm" />
          <span>Visão Geral</span>
        </NavLink>

        {/* Planejamento Tático → Áreas */}
        <div className="pt-2 pb-1">
          <button
            type="button"
            onClick={() => setOpenPlanejamento((prev) => !prev)}
            className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded-md transition-colors ${
              openPlanejamento
                ? "bg-blue-800/50 text-white"
                : "text-blue-100 hover:bg-blue-600/40"
            }`}
          >
            <span className="flex items-center gap-2 font-medium">
              <FaClipboardList className="text-sm" />
              <span>Planejamento Tático</span>
            </span>
            {openPlanejamento ? (
              <FaChevronDown className="text-[10px] opacity-70" />
            ) : (
              <FaChevronRight className="text-[10px] opacity-70" />
            )}
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              openPlanejamento
                ? "max-h-[500px] opacity-100 mt-1"
                : "max-h-0 opacity-0"
            }`}
          >
            <div className="ml-2 pl-2 border-l border-blue-500/30 space-y-1">
              {setores.map((setor) => (
                <NavLink
                  key={setor.key}
                  to={setor.path}
                  className={({ isActive }) =>
                    `w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-md transition-colors ${
                      isActive
                        ? "bg-blue-500 text-white font-semibold"
                        : "text-blue-50 hover:bg-blue-600/50"
                    }`
                  }
                >
                  <span>{setor.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>

        {/* Copiloto IA */}
        <NavLink
          to="/copiloto"
          className={({ isActive }) =>
            `${linkBaseClasses} ${
              isActive
                ? "bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-100 border border-red-500/30 shadow-sm"
                : "text-red-200 hover:bg-red-500/10 hover:text-white"
            } mt-4 mb-2`
          }
        >
          <FaMicrophone
            className={`text-sm ${
              location.pathname === "/copiloto" ? "animate-pulse" : ""
            }`}
          />
          <span className="font-bold tracking-wide">Copiloto IA</span>
        </NavLink>

        {/* Ferramentas */}
        <div className="pt-2">
          <p className="px-4 text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1">
            Ferramentas
          </p>

          <NavLink
            to="/central-reunioes"
            className={({ isActive }) =>
              `${linkBaseClasses} ${
                isActive ? linkActiveClasses : linkInactiveClasses
              }`
            }
          >
            <FaCalendarAlt className="text-sm" />
            <span>Agenda Tática</span>
          </NavLink>

          {/* ✅ NOVO: Tipos de Reunião (logo abaixo de Agenda Tática) */}
          <NavLink
            to="/tipos-reuniao"
            className={({ isActive }) =>
              `${linkBaseClasses} ${
                isActive ? linkActiveClasses : linkInactiveClasses
              }`
            }
          >
            <FaTags className="text-sm" />
            <span>Tipos de Reunião</span>
          </NavLink>

          <NavLink
            to="/central-atas"
            className={({ isActive }) =>
              `${linkBaseClasses} ${
                isActive ? linkActiveClasses : linkInactiveClasses
              }`
            }
          >
            <FaClipboardList className="text-sm" />
            <span>Banco de Atas</span>
          </NavLink>

          {/* NOVA ABA: Projetos */}
          <NavLink
            to="/projetos"
            className={({ isActive }) =>
              `${linkBaseClasses} ${
                isActive ? linkActiveClasses : linkInactiveClasses
              }`
            }
          >
            <FaTasks className="text-sm" />
            <span>Projetos</span>
          </NavLink>

          <NavLink
            to="/gestao-acoes"
            className={({ isActive }) =>
              `${linkBaseClasses} ${
                isActive ? linkActiveClasses : linkInactiveClasses
              }`
            }
          >
            <FaTasks className="text-sm" />
            <span>Central de Ações</span>
          </NavLink>

          <NavLink
            to="/configuracoes"
            className={({ isActive }) =>
              `${linkBaseClasses} ${
                isActive ? linkActiveClasses : linkInactiveClasses
              }`
            }
          >
            <FaCogs className="text-sm" />
            <span>Configurações</span>
          </NavLink>
        </div>
      </nav>

      {/* Rodapé */}
      <div className="px-4 py-3 border-t border-blue-500/40 text-[10px] text-blue-200/60 text-center">
        Farol Tático v1.2 · 2026
      </div>
    </aside>
  );
}

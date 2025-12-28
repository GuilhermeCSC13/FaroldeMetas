import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaClipboardList,
  FaCogs,
  FaChevronDown,
  FaChevronRight,
  FaCalendarAlt,
  FaTasks,
  FaMicrophone, // <--- Ícone do Copiloto
} from "react-icons/fa";

const setores = [
  { key: "operacao", label: "Operação", path: "/planejamento/operacao" },
  { key: "manutencao", label: "Manutenção", path: "/manutencao" },
  { key: "moov", label: "Moov", path: "/moov" },
  { key: "financeiro", label: "Financeiro", path: "/planejamento/financeiro" },
  { key: "pessoas", label: "Pessoas", path: "/planejamento/pessoas" },
];

const subMenus = [
  { key: "resumo", label: "Resumo", hash: "#resumo" },
  { key: "metas", label: "Farol de Metas", hash: "#metas" },
  { key: "rotinas", label: "Farol de Rotinas", hash: "#rotinas" },
];

export default function Sidebar() {
  const [openPlanejamento, setOpenPlanejamento] = useState(true);
  const [openSetores, setOpenSetores] = useState({
    operacao: false,
    manutencao: false,
    moov: false,
    financeiro: false,
    pessoas: false,
  });

  const location = useLocation();
  const navigate = useNavigate();

  function toggleSetor(key) {
    setOpenSetores((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  const linkBaseClasses =
    "flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors";
  const linkInactiveClasses =
    "text-blue-100 hover:text-white hover:bg-blue-600/60";
  const linkActiveClasses = "bg-blue-100 text-blue-700 font-semibold";

  return (
    <aside className="w-64 bg-blue-700 text-white flex flex-col min-h-screen font-sans">
      {/* Cabeçalho */}
      <div className="px-4 py-4 border-b border-blue-500/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center text-xl font-bold">
            Q
          </div>
          <div>
            <p className="text-xs text-blue-100">Olá, Guilherme 👋</p>
            <p className="text-sm font-semibold">Farol de Metas & Rotinas</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {/* Início */}
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
          <span>Início</span>
        </NavLink>

        {/* Planejamento Tático (pai) */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpenPlanejamento((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm rounded-md hover:bg-blue-600/60 text-blue-50"
          >
            <span className="flex items-center gap-2">
              <FaClipboardList className="text-sm" />
              <span>Planejamento Tático</span>
            </span>
            {openPlanejamento ? (
              <FaChevronDown className="text-xs" />
            ) : (
              <FaChevronRight className="text-xs" />
            )}
          </button>

          {/* Lista de setores */}
          {openPlanejamento && (
            <div className="mt-1 ml-4 space-y-1">
              {setores.map((setor) => (
                <div key={setor.key} className="space-y-1">
                  {/* Cabeçalho do setor */}
                  <button
                    type="button"
                    onClick={() => toggleSetor(setor.key)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-md hover:bg-blue-600/50 text-blue-50"
                  >
                    <span>{setor.label}</span>
                    {openSetores[setor.key] ? (
                      <FaChevronDown className="text-[10px]" />
                    ) : (
                      <FaChevronRight className="text-[10px]" />
                    )}
                  </button>

                  {/* Submenus do setor */}
                  {openSetores[setor.key] && (
                    <div className="mt-1 ml-4 space-y-1">
                      {subMenus.map((sub) => {
                        const currentHash =
                          location.hash && location.hash !== ""
                            ? location.hash
                            : "#resumo";

                        const isActive =
                          location.pathname === setor.path &&
                          currentHash === sub.hash;

                        const baseClasses =
                          "block text-[11px] px-3 py-1 rounded-md text-left";
                        const activeClasses =
                          "bg-blue-100 text-blue-700 font-semibold";
                        const inactiveClasses =
                          "text-blue-100 hover:text-white hover:bg-blue-600/60";

                        return (
                          <button
                            key={sub.key}
                            type="button"
                            onClick={() => navigate(`${setor.path}${sub.hash}`)}
                            className={`${baseClasses} ${
                              isActive ? activeClasses : inactiveClasses
                            }`}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- DESTAQUE: COPILOTO IA --- */}
        <NavLink
          to="/copiloto"
          className={({ isActive }) =>
            `${linkBaseClasses} ${
              isActive 
                ? "bg-red-500/20 text-red-100 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
                : "text-red-200 hover:bg-red-500/10 hover:text-white"
            } mt-6 mb-2`
          }
        >
          <FaMicrophone className={`text-sm ${location.pathname === '/copiloto' ? 'animate-pulse' : ''}`} />
          <span className="font-bold tracking-wide">Copiloto IA</span>
        </NavLink>

        {/* --- Agenda de Reuniões --- */}
        <NavLink
          to="/reunioes-calendario"
          className={({ isActive }) =>
            `${linkBaseClasses} ${
              isActive ? linkActiveClasses : linkInactiveClasses
            }`
          }
        >
          <FaCalendarAlt className="text-sm" />
          <span>Agenda Reuniões</span>
        </NavLink>

        {/* --- Central de Ações --- */}
        <NavLink
          to="/gestao-acoes"
          className={({ isActive }) =>
            `${linkBaseClasses} ${
              isActive ? linkActiveClasses : linkInactiveClasses
            } mt-1`
          }
        >
          <FaTasks className="text-sm" />
          <span>Central de Ações</span>
        </NavLink>

        {/* Configurações */}
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            `${linkBaseClasses} ${
              isActive ? linkActiveClasses : linkInactiveClasses
            } mt-4`
          }
        >
          <FaCogs className="text-sm" />
          <span>Configurações</span>
        </NavLink>
      </nav>

      {/* Rodapé */}
      <div className="px-4 py-3 border-t border-blue-500/40 text-[11px] text-blue-100">
        <p>Versão 1.2 · Farol Tático</p>
      </div>
    </aside>
  );
}

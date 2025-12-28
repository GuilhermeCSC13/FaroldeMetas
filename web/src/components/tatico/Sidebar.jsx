import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaClipboardList,
  FaCogs,
  FaChevronDown,
  FaChevronRight,
  FaCalendarAlt,
  FaTasks,
  FaMicrophone,
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
  const location = useLocation();
  const navigate = useNavigate();

  // CORREÇÃO: O menu só inicia aberto se a URL atual pertencer a um dos setores
  const isPlanejamentoActive = setores.some(s => location.pathname.startsWith(s.path));
  const [openPlanejamento, setOpenPlanejamento] = useState(isPlanejamentoActive);
  
  const [openSetores, setOpenSetores] = useState({
    operacao: false,
    manutencao: false,
    moov: false,
    financeiro: false,
    pessoas: false,
  });

  // Mantém o setor aberto se estiver navegando nele
  useEffect(() => {
    const activeSetor = setores.find(s => location.pathname.startsWith(s.path));
    if (activeSetor) {
        setOpenSetores(prev => ({ ...prev, [activeSetor.key]: true }));
        setOpenPlanejamento(true);
    }
  }, [location.pathname]);

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
    <aside className="w-64 bg-blue-700 text-white flex flex-col min-h-screen font-sans shrink-0 transition-all duration-300">
      {/* Cabeçalho */}
      <div className="px-4 py-4 border-b border-blue-500/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center text-xl font-bold backdrop-blur-sm">
            Q
          </div>
          <div>
            <p className="text-xs text-blue-100 opacity-80">Olá, Guilherme 👋</p>
            <p className="text-sm font-bold tracking-tight">Farol Tático</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
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
          <span>Visão Geral</span>
        </NavLink>

        {/* Planejamento Tático (pai) */}
        <div className="pt-2 pb-1">
          <button
            type="button"
            onClick={() => setOpenPlanejamento((prev) => !prev)}
            className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded-md transition-colors ${openPlanejamento ? 'bg-blue-800/50 text-white' : 'text-blue-100 hover:bg-blue-600/40'}`}
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

          {/* Lista de setores */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openPlanejamento ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
            <div className="ml-2 pl-2 border-l border-blue-500/30 space-y-1">
              {setores.map((setor) => (
                <div key={setor.key}>
                  {/* Cabeçalho do setor */}
                  <button
                    type="button"
                    onClick={() => toggleSetor(setor.key)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-md hover:bg-blue-600/50 text-blue-50 group"
                  >
                    <span className="group-hover:translate-x-1 transition-transform">{setor.label}</span>
                    {openSetores[setor.key] ? (
                      <FaChevronDown className="text-[9px] opacity-50" />
                    ) : (
                      <FaChevronRight className="text-[9px] opacity-50" />
                    )}
                  </button>

                  {/* Submenus do setor */}
                  {openSetores[setor.key] && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l border-blue-500/20 pl-2">
                      {subMenus.map((sub) => {
                         const currentHash = location.hash || "#resumo";
                         const isActive = location.pathname === setor.path && currentHash === sub.hash;

                        return (
                          <button
                            key={sub.key}
                            onClick={() => navigate(`${setor.path}${sub.hash}`)}
                            className={`block w-full text-left text-[11px] px-3 py-1.5 rounded-md transition-colors ${
                              isActive ? "bg-blue-500 text-white font-semibold" : "text-blue-200 hover:text-white hover:bg-blue-600/40"
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
          </div>
        </div>

        {/* --- DESTAQUE: COPILOTO IA --- */}
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
          <FaMicrophone className={`text-sm ${location.pathname === '/copiloto' ? 'animate-pulse' : ''}`} />
          <span className="font-bold tracking-wide">Copiloto IA</span>
        </NavLink>

        {/* --- Ferramentas --- */}
        <div className="pt-2">
            <p className="px-4 text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1">Ferramentas</p>
            
            <NavLink
            to="/reunioes-calendario"
            className={({ isActive }) => `${linkBaseClasses} ${isActive ? linkActiveClasses : linkInactiveClasses}`}
            >
            <FaCalendarAlt className="text-sm" />
            <span>Agenda Reuniões</span>
            </NavLink>

            <NavLink
            to="/gestao-acoes"
            className={({ isActive }) => `${linkBaseClasses} ${isActive ? linkActiveClasses : linkInactiveClasses}`}
            >
            <FaTasks className="text-sm" />
            <span>Central de Ações</span>
            </NavLink>

            <NavLink
            to="/configuracoes"
            className={({ isActive }) => `${linkBaseClasses} ${isActive ? linkActiveClasses : linkInactiveClasses}`}
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

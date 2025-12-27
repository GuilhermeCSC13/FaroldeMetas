// src/components/tatico/Sidebar.jsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FaHome,
  FaClipboardList,
  FaCogs,
  FaChevronDown,
  FaChevronRight,
} from "react-icons/fa";

const setores = [
  { key: "operacao", label: "Operação", basePath: "/planejamento/operacao" },
  { key: "manutencao", label: "Manutenção", basePath: "/planejamento/manutencao" },
  { key: "moov", label: "Moov", basePath: "/planejamento/moov" },
  { key: "financeiro", label: "Financeiro", basePath: "/planejamento/financeiro" },
  { key: "pessoas", label: "Pessoas", basePath: "/planejamento/pessoas" },
];

const subMenus = [
  { key: "resumo", label: "Resumo", suffix: "/resumo" },
  { key: "metas", label: "Farol de Metas", suffix: "/metas" },
  { key: "rotinas", label: "Farol de Rotinas", suffix: "/rotinas" },
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
    <aside className="w-64 bg-blue-700 text-white flex flex-col min-h-screen">
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
                      {subMenus.map((sub) => (
                        <NavLink
                          key={sub.key}
                          to={`${setor.basePath}${sub.suffix}`}
                          className={({ isActive }) =>
                            `block text-[11px] px-3 py-1 rounded-md ${
                              isActive
                                ? "bg-blue-100 text-blue-700 font-semibold"
                                : "text-blue-100 hover:text-white hover:bg-blue-600/60"
                            }`
                          }
                        >
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Configurações (exemplo de item simples no final) */}
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

      {/* Rodapé / botão sair (opcional) */}
      <div className="px-4 py-3 border-t border-blue-500/40 text-[11px] text-blue-100">
        <p>Versão 1.0 · Farol Tático</p>
      </div>
    </aside>
  );
}

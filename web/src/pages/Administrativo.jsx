import React, { useState } from "react";
import Layout from "../components/tatico/Layout";
import AdministrativoMetas from "./AdministrativoMetas";
import AdministrativoRotinas from "./AdministrativoRotinas";

export default function Administrativo() {
  const [aba, setAba] = useState("resumo"); // 'resumo' | 'metas' | 'rotinas'

  const renderContent = () => {
    if (aba === "metas") {
      return <AdministrativoMetas />;
    }
    if (aba === "rotinas") {
      return <AdministrativoRotinas />;
    }

    // RESUMO (padrão)
    return (
      <div className="flex items-center justify-center h-full text-slate-400 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Resumo Administrativo
          </h2>
          <p className="text-sm text-slate-500">
            Aqui você pode acompanhar os principais indicadores e rotinas das
            áreas Financeiro e Pessoas. Use os botões acima para acessar o Farol
            de Metas e o Farol de Rotinas do Administrativo.
          </p>
        </div>
      </div>
    );
  };

  const baseBtn =
    "px-4 py-2 text-xs sm:text-sm font-medium rounded-md border transition-all";
  const inactiveBtn =
    "text-slate-500 border-slate-200 bg-white hover:bg-slate-100";
  const activeBtn = "text-white bg-blue-600 border-blue-600 shadow-sm";

  return (
    <Layout>
      <div className="h-full p-6 bg-slate-50 overflow-hidden flex flex-col">
        {/* Cabeçalho + Botões de Navegação Interna */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800">
              Administrativo
            </h1>
            <p className="text-xs text-slate-400">
              Financeiro e Pessoas · Farol de Metas e Rotinas.
            </p>
          </div>

          <div className="inline-flex bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setAba("resumo")}
              className={`${baseBtn} ${
                aba === "resumo" ? activeBtn : inactiveBtn
              } rounded-none`}
            >
              Resumo
            </button>
            <button
              type="button"
              onClick={() => setAba("metas")}
              className={`${baseBtn} ${
                aba === "metas" ? activeBtn : inactiveBtn
              } rounded-none border-l-0`}
            >
              Farol de Metas
            </button>
            <button
              type="button"
              onClick={() => setAba("rotinas")}
              className={`${baseBtn} ${
                aba === "rotinas" ? activeBtn : inactiveBtn
              } rounded-none border-l-0`}
            >
              Farol de Rotinas
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-h-0">{renderContent()}</div>
      </div>
    </Layout>
  );
}

import React from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/tatico/Layout';
import FinanceiroMetas from './FinanceiroMetas';
import FinanceiroRotinas from './FinanceiroRotinas';

export default function Financeiro() {
  const { hash } = useLocation();

  // Renderização baseada no hash vindo da Sidebar
  const renderContent = () => {
    switch (hash) {
      case '#metas':
        return <FinanceiroMetas />;
      case '#rotinas':
        return <FinanceiroRotinas />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-400 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-800">Resumo Financeiro</h2>
              <p>Selecione Metas ou Rotinas no menu lateral.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout>
      <div className="h-full p-6 bg-slate-50 overflow-hidden flex flex-col">
        {renderContent()}
      </div>
    </Layout>
  );
}

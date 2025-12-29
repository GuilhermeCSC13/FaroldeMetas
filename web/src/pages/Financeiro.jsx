import React from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/tatico/Layout';
import PessoasMetas from './PessoasMetas';
import PessoasRotinas from './PessoasRotinas';

export default function Pessoas() {
  const { hash } = useLocation();

  const renderContent = () => {
    switch (hash) {
      case '#metas':
        return <PessoasMetas />;
      case '#rotinas':
        return <PessoasRotinas />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-400 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="text-center">
              <h2 className="text-xl font-bold text-indigo-900">Resumo Pessoas / RH</h2>
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

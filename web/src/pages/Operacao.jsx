import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/tatico/Layout';

// Importa os seus módulos
import OperacaoMetas from './OperacaoMetas';
import OperacaoRotinas from './OperacaoRotinas'; // <--- O novo componente entra aqui

const Operacao = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('resumo');

  // Monitora o final da URL (#metas, #rotinas)
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    setActiveTab(hash || 'resumo');
  }, [location]);

  // Decide qual tela mostrar
  const renderContent = () => {
    switch (activeTab) {
      case 'metas':
        return <OperacaoMetas />;
      
      case 'rotinas':
        return <OperacaoRotinas />; // <--- Aqui ele chama a tela nova
      
      case 'resumo':
      default:
        return (
          <div className="p-8 bg-white rounded shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Resumo da Operação</h2>
            <p className="text-gray-500">
              Painel gerencial em desenvolvimento. Use o menu lateral para acessar os Faróis.
            </p>
          </div>
        );
    }
  };

  return (
    <Layout>
      {renderContent()}
    </Layout>
  );
};

export default Operacao;

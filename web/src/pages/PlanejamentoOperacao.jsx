import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/tatico/Layout';

// Importação dos Módulos
import OperacaoMetas from './OperacaoMetas'; 
// import OperacaoRotinas from './OperacaoRotinas'; // (Ainda vamos criar)
// import OperacaoResumo from './OperacaoResumo';   // (Ainda vamos criar)

const PlanejamentoOperacao = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('resumo');

  // Monitora mudança no Hash da URL (#metas, #rotinas, #resumo)
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) {
      setActiveTab(hash);
    } else {
      setActiveTab('resumo'); // Default
    }
  }, [location]);

  // Renderiza o componente baseado no hash
  const renderContent = () => {
    switch (activeTab) {
      case 'metas':
        return <OperacaoMetas />;
      case 'rotinas':
        return <div className="p-10 text-gray-500">Módulo de Rotinas (Em desenvolvimento)</div>; // Placeholder
      case 'resumo':
      default:
        return <div className="p-10 text-gray-500">Dashboard Resumo (Em desenvolvimento)</div>; // Placeholder
    }
  };

  return (
    <Layout>
      {renderContent()}
    </Layout>
  );
};

export default PlanejamentoOperacao;

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/tatico/Layout';

import OperacaoMetas from './OperacaoMetas';
import OperacaoRotinas from './OperacaoRotinas';
import OperacaoResumo from './OperacaoResumo'; // <--- Importe aqui

const Operacao = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('resumo');

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    setActiveTab(hash || 'resumo');
  }, [location]);

  const renderContent = () => {
    switch (activeTab) {
      case 'metas':
        return <OperacaoMetas />;
      
      case 'rotinas':
        return <OperacaoRotinas />;
      
      case 'resumo':
      default:
        return <OperacaoResumo />; // <--- Use o componente aqui
    }
  };

  return (
    <Layout>
      {renderContent()}
    </Layout>
  );
};

export default Operacao;

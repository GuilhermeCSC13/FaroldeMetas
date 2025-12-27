import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
// VERIFIQUE ESTA LINHA COM CUIDADO:
import Layout from '../components/tatico/Layout'; 
import OperacaoMetas from './OperacaoMetas';

const Operacao = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('resumo');

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    setActiveTab(hash || 'resumo');
  }, [location]);

  const renderContent = () => {
    switch (activeTab) {
      case 'metas': return <OperacaoMetas />;
      case 'rotinas': return <div className="p-8">Rotinas (Em breve)</div>;
      default: return <div className="p-8">Resumo (Em breve)</div>;
    }
  };

  return <Layout>{renderContent()}</Layout>;
};

export default Operacao;

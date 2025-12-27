import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/tatico/Layout'; // <--- Isso garante que o Sidebar apareça
import MoovMetas from './MoovMetas';
import MoovRotinas from './MoovRotinas';

const Moov = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('metas');

  // Monitora a URL para saber se mostra Metas ou Rotinas
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    setActiveTab(hash || 'metas');
  }, [location]);

  const renderContent = () => {
    switch (activeTab) {
      case 'rotinas':
        return <MoovRotinas />;
      case 'metas':
      default:
        return <MoovMetas />;
    }
  };

  return (
    <Layout>
      {renderContent()}
    </Layout>
  );
};

export default Moov;

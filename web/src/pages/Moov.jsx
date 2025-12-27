import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/tatico/Layout'; // <--- Isso traz o Sidebar de volta
import MoovMetas from './MoovMetas';
import MoovRotinas from './MoovRotinas';

const Moov = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('metas');

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
      <div className="p-6 h-full flex flex-col">
          {/* Título Geral da Página */}
          <div className="mb-6 flex justify-between items-end">
              <div>
                  <h1 className="text-2xl font-bold text-gray-800">Moov — Planejamento Tático</h1>
                  <p className="text-sm text-gray-500">Gestão de indicadores e rotinas mensais</p>
              </div>
          </div>
          
          {/* Conteúdo da Aba */}
          <div className="flex-1 overflow-hidden bg-white rounded-lg shadow-sm border border-gray-200">
             {renderContent()}
          </div>
      </div>
    </Layout>
  );
};

export default Moov;

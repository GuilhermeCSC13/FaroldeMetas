import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/tatico/Layout';
import ManutencaoMetas from './ManutencaoMetas';
import ManutencaoRotinas from './ManutencaoRotinas';

const Manutencao = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('metas');

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    setActiveTab(hash || 'metas');
  }, [location]);

  const renderContent = () => {
    switch (activeTab) {
      case 'rotinas': return <ManutencaoRotinas />;
      case 'metas': default: return <ManutencaoMetas />;
    }
  };

  return (
    <Layout>
      <div className="p-6 h-full flex flex-col font-sans">
          <div className="mb-6 flex justify-between items-end">
              <div>
                  <h1 className="text-2xl font-bold text-gray-800 uppercase tracking-tight">Manutenção</h1>
                  <p className="text-sm text-gray-500">Gestão de frota e indicadores técnicos</p>
              </div>
          </div>
          <div className="flex-1 overflow-hidden bg-white rounded-lg shadow-sm border border-gray-200">
             {renderContent()}
          </div>
      </div>
    </Layout>
  );
};
export default Manutencao;

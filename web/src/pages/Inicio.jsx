import React from 'react';
import { useNavigate } from 'react-router-dom';
// IMPORTAÇÃO NECESSÁRIA PARA A SIDEBAR APARECER
import Layout from '../components/tatico/Layout'; 

const Inicio = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="p-2">
        {/* Cabeçalho */}
        <div className="mb-8 border-b border-gray-200 pb-4">
          <h1 className="text-2xl font-bold text-gray-800">Visão Geral da Ferramenta</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Aqui você vai concentrar o planejamento tático, os faróis de metas e o acompanhamento das reuniões periódicas da Quatai.
          </p>
        </div>

        {/* Cards de Navegação */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Planejamento Tático */}
          <div 
            onClick={() => navigate('/planejamento/operacao')}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wide">Módulo 1</div>
            <h2 className="text-lg font-bold text-gray-800 group-hover:text-blue-700 transition-colors">
              Planejamento Tático
            </h2>
            <p className="text-gray-600 text-sm mt-2 mb-4">
              Estruture as metas anuais, indicadores-chave e conecte cada meta às rotinas diárias.
            </p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>Farol de metas por setor (Operação)</li>
              <li>Acompanhamento mensal</li>
              <li>Rotinas ligadas às metas</li>
            </ul>
          </div>

          {/* Card 2: Reuniões */}
          <div 
            onClick={() => navigate('/reunioes-periodicas')}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="text-xs font-bold text-teal-600 mb-2 uppercase tracking-wide">Módulo 2</div>
            <h2 className="text-lg font-bold text-gray-800 group-hover:text-teal-700 transition-colors">
              Reuniões Periódicas
            </h2>
            <p className="text-gray-600 text-sm mt-2 mb-4">
              Cadastre os rituais (DBO, KM/L, Segurança) e registre pautas e decisões.
            </p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>Agenda por área</li>
              <li>Histórico de encontros</li>
              <li>Integração futura com IA</li>
            </ul>
          </div>

          {/* Card 3: Futuro */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 border-dashed">
            <div className="text-xs font-bold text-orange-600 mb-2 uppercase tracking-wide">Próximos Passos</div>
            <h2 className="text-lg font-bold text-gray-800">Integrações Futuras</h2>
            <p className="text-gray-600 text-xs mt-2 leading-relaxed">
              Conexão com Gemini para transcrição de atas e integração direta com bases de dados (Power BI/Supabase) para preenchimento automático das metas realizadas.
            </p>
          </div>

        </div>
      </div>
    </Layout>
  );
};

export default Inicio;

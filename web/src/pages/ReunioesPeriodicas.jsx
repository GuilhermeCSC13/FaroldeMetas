import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { Calendar, Clock, User, Plus, Search, Filter } from 'lucide-react';

const ReunioesPeriodicas = () => {
  const navigate = useNavigate();
  const [reunioes, setReunioes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('Todas'); // Todas, Agendada, Realizada

  useEffect(() => {
    fetchReunioes();
  }, []);

  const fetchReunioes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reunioes')
        .select(`*, areas(nome)`)
        .order('data_hora', { ascending: false });

      if (error) throw error;
      setReunioes(data || []);
    } catch (error) {
      console.error('Erro ao buscar reuniões:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNovaReuniao = async () => {
    // Cria uma reunião em branco e redireciona para edição
    const { data, error } = await supabase
      .from('reunioes')
      .insert([{ 
          titulo: 'Nova Reunião', 
          data_hora: new Date().toISOString(),
          status: 'Agendada' 
      }])
      .select()
      .single();

    if (!error && data) {
      navigate(`/reunioes/${data.id}`);
    }
  };

  const filteredReunioes = reunioes.filter(r => 
    filtroStatus === 'Todas' ? true : r.status === filtroStatus
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'Realizada': return 'bg-green-100 text-green-700 border-green-200';
      case 'Cancelada': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto font-sans h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Reuniões Periódicas</h1>
            <p className="text-gray-500 mt-1">Gerencie pautas, atas e ações das reuniões táticas.</p>
          </div>
          <button 
            onClick={handleNovaReuniao}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            <Plus size={20} /> Agendar Reunião
          </button>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-4 mb-6 overflow-x-auto pb-2">
          {['Todas', 'Agendada', 'Realizada', 'Cancelada'].map(status => (
            <button
              key={status}
              onClick={() => setFiltroStatus(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
                filtroStatus === status 
                  ? 'bg-gray-800 text-white border-gray-800 shadow-md' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Lista de Cards */}
        {loading ? (
          <div className="text-center py-20 text-gray-400 animate-pulse">Carregando reuniões...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReunioes.map(reuniao => {
              const data = new Date(reuniao.data_hora);
              return (
                <div 
                  key={reuniao.id} 
                  onClick={() => navigate(`/reunioes/${reuniao.id}`)}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold border ${getStatusColor(reuniao.status)}`}>
                        {reuniao.status}
                      </span>
                      {reuniao.areas && (
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {reuniao.areas.nome}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {reuniao.titulo}
                    </h3>

                    <div className="space-y-2 text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <span>{data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-gray-400" />
                        <span>{data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {reuniao.responsavel && (
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-400" />
                          <span>{reuniao.responsavel}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                    <span className="text-blue-600 text-sm font-medium group-hover:underline">Ver detalhes →</span>
                  </div>
                </div>
              );
            })}
            
            {filteredReunioes.length === 0 && (
              <div className="col-span-full text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-400">Nenhuma reunião encontrada com este filtro.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ReunioesPeriodicas;

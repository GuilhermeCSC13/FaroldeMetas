import React, { useState, useEffect } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, CheckCircle2, PlayCircle, FileText, 
  Search, Filter, MoreVertical, Mic, ChevronRight, X 
} from 'lucide-react';

export default function CentralReunioes() {
  const navigate = useNavigate();
  const [reunioes, setReunioes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('agendada'); // 'agendada' | 'realizada'
  const [filtro, setFiltro] = useState('');
  
  // Estado do Modal de Leitura Rápida
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReuniao, setSelectedReuniao] = useState(null);

  useEffect(() => {
    fetchReunioes();
  }, []);

  const fetchReunioes = async () => {
    try {
      const { data, error } = await supabase
        .from('reunioes')
        .select('*')
        .order('data_hora', { ascending: false });
      
      if (error) throw error;
      setReunioes(data || []);
    } catch (error) {
      console.error("Erro ao buscar reuniões:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtragem
  const filtered = reunioes.filter(r => {
    const matchStatus = r.status?.toLowerCase() === tab;
    const matchSearch = r.titulo?.toLowerCase().includes(filtro.toLowerCase()) || 
                        r.tipo_reuniao?.toLowerCase().includes(filtro.toLowerCase());
    return matchStatus && matchSearch;
  });

  const abrirAta = (reuniao) => {
    setSelectedReuniao(reuniao);
    setModalOpen(true);
  };

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto font-sans h-screen flex flex-col">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Central de Reuniões</h1>
            <p className="text-gray-500">Gestão de pautas, atas e memória operacional.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/copiloto')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Mic size={18} /> Novo Copiloto
            </button>
          </div>
        </div>

        {/* Controles e Abas */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden mb-6">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            
            {/* Abas */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setTab('agendada')}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${tab === 'agendada' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Próximas (Agendadas)
              </button>
              <button 
                onClick={() => setTab('realizada')}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${tab === 'realizada' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Acervo (Realizadas)
              </button>
            </div>

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por título ou tipo..." 
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none w-64 transition-all"
              />
            </div>
          </div>

          {/* Lista de Cards */}
          <div className="bg-gray-50/50 p-4 min-h-[400px]">
            {loading ? (
              <div className="text-center p-10 text-gray-400">Carregando dados...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center p-10 text-gray-400 flex flex-col items-center">
                <FileText size={48} className="mb-2 opacity-20"/>
                <p>Nenhuma reunião encontrada nesta categoria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filtered.map(r => (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between hover:shadow-md transition-shadow group">
                    
                    {/* Info Principal */}
                    <div className="flex items-start gap-4 mb-4 md:mb-0">
                      <div 
                        className="w-2 h-16 rounded-full shrink-0" 
                        style={{ backgroundColor: r.cor || '#ccc' }}
                      ></div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">
                            {r.tipo_reuniao || 'Geral'}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={12}/> {new Date(r.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 leading-tight group-hover:text-blue-700 transition-colors">
                          {r.titulo}
                        </h3>
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                          <Calendar size={14} className="text-blue-500"/>
                          {new Date(r.data_hora).toLocaleDateString()}
                          
                          {/* Se realizada, mostra preview da ata */}
                          {tab === 'realizada' && r.pauta && (
                             <span className="hidden md:inline-block text-gray-400 mx-2 text-xs truncate max-w-[300px]">
                               • {r.pauta.replace(/\n/g, ' ').substring(0, 50)}...
                             </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-3 shrink-0">
                      {tab === 'agendada' ? (
                        <>
                          <button onClick={() => navigate('/copiloto')} className="text-sm font-medium text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                             Iniciar Agora <ChevronRight size={16}/>
                          </button>
                        </>
                      ) : (
                        <>
                          {r.audio_url && (
                             <a 
                               href={r.audio_url} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                               title="Ouvir Gravação"
                             >
                               <PlayCircle size={20}/>
                             </a>
                          )}
                          <button 
                            onClick={() => abrirAta(r)}
                            className="bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
                          >
                            <FileText size={16}/> Ver Ata
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- MODAL DE LEITURA RÁPIDA --- */}
      {modalOpen && selectedReuniao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
               <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedReuniao.titulo}</h2>
                  <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <Calendar size={14}/> {new Date(selectedReuniao.data_hora).toLocaleDateString()} 
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="uppercase text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">Realizada</span>
                  </p>
               </div>
               <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                  <X size={20}/>
               </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                
                {/* Audio Player */}
                {selectedReuniao.audio_url && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2">
                            <PlayCircle size={14}/> Gravação Original
                        </label>
                        <audio controls className="w-full h-8" src={selectedReuniao.audio_url}>
                            Seu navegador não suporta áudio.
                        </audio>
                    </div>
                )}

                {/* Resumo IA */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <span className="w-1 h-4 bg-blue-500 rounded-full"></span> Resumo Inteligente (IA)
                    </h3>
                    <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                        {selectedReuniao.pauta || "Nenhum resumo automático disponível."}
                    </div>
                </div>

                {/* Ata Manual / Detalhada */}
                {(selectedReuniao.ata || selectedReuniao.transcricao_full) && (
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 mt-6 flex items-center gap-2">
                            <span className="w-1 h-4 bg-gray-400 rounded-full"></span> Notas / Transcrição
                        </h3>
                        <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line border-t border-gray-100 pt-2">
                            {selectedReuniao.ata || selectedReuniao.transcricao_full}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-2">
                <button 
                    onClick={() => setModalOpen(false)} 
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                    Fechar
                </button>
                <button 
                    onClick={() => {
                        setModalOpen(false);
                        navigate('/copiloto'); // Poderia ir para uma página de edição se quisesse
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                    Editar / Regravar
                </button>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
}

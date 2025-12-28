import React, { useState, useEffect } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { FileText, Search, Calendar, User, ChevronRight, Download } from 'lucide-react';

export default function CentralAtas() {
  const [atas, setAtas] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedAta, setSelectedAta] = useState(null);

  useEffect(() => {
    fetchAtas();
  }, []);

  const fetchAtas = async () => {
    // Busca apenas reuniões que tenham conteúdo na pauta/ata ou status Realizada
    const { data } = await supabase
      .from('reunioes')
      .select('*')
      .or('status.eq.Realizada,pauta.neq.""') // Pega se foi realizada OU se já tem algo escrito
      .order('data_hora', { ascending: false });
    setAtas(data || []);
    setLoading(false);
  };

  const filtered = atas.filter(a => 
    a.titulo?.toLowerCase().includes(busca.toLowerCase()) || 
    a.pauta?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
        
        {/* LADO ESQUERDO: Lista de Documentos */}
        <div className={`w-full md:w-1/3 bg-white border-r border-slate-200 flex flex-col ${selectedAta ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-6 border-b border-slate-100">
                <h1 className="text-2xl font-bold text-slate-800 mb-1">Banco de Atas</h1>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Documentação Oficial</p>
                
                <div className="mt-4 relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                        className="w-full bg-slate-100 border-none rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Pesquisar decisões, tópicos..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {loading ? <p className="p-6 text-center text-slate-400">Carregando...</p> : filtered.map(ata => (
                    <div 
                        key={ata.id}
                        onClick={() => setSelectedAta(ata)}
                        className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedAta?.id === ata.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                    >
                        <h3 className={`font-bold text-sm mb-1 ${selectedAta?.id === ata.id ? 'text-blue-700' : 'text-slate-700'}`}>{ata.titulo}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                            <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(ata.data_hora).toLocaleDateString()}</span>
                            {ata.responsavel && <span className="flex items-center gap-1"><User size={12}/> {ata.responsavel}</span>}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {ata.pauta ? ata.pauta.substring(0, 100) : "Sem conteúdo registrado..."}
                        </p>
                    </div>
                ))}
            </div>
        </div>

        {/* LADO DIREITO: Leitura do Documento */}
        <div className={`flex-1 bg-slate-50 flex flex-col h-full overflow-hidden relative ${!selectedAta ? 'hidden md:flex' : 'flex'}`}>
            {selectedAta ? (
                <>
                    {/* Header Documento */}
                    <div className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shadow-sm z-10">
                        <div>
                            <button onClick={() => setSelectedAta(null)} className="md:hidden text-slate-500 mb-2 flex items-center gap-1 text-xs font-bold uppercase"><ChevronRight className="rotate-180" size={12}/> Voltar</button>
                            <h2 className="text-2xl font-bold text-slate-800">{selectedAta.titulo}</h2>
                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                                <span>{new Date(selectedAta.data_hora).toLocaleDateString()} às {new Date(selectedAta.data_hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span className="font-bold text-blue-600">{selectedAta.tipo_reuniao}</span>
                            </div>
                        </div>
                        <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg" title="Exportar">
                            <Download size={20}/>
                        </button>
                    </div>

                    {/* Conteúdo (Papel) */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="max-w-3xl mx-auto bg-white min-h-[800px] shadow-sm border border-slate-200 p-10 md:p-14 rounded-sm">
                            {selectedAta.pauta ? (
                                <div className="prose prose-slate max-w-none">
                                    <div className="whitespace-pre-line text-slate-700 leading-relaxed">
                                        {selectedAta.pauta}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                                    <FileText size={48} className="mb-4 opacity-50"/>
                                    <p>Nenhuma ata registrada para esta reunião.</p>
                                </div>
                            )}
                        </div>
                        <div className="h-20"></div> {/* Espaço final */}
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                        <FileText size={40} className="text-slate-400"/>
                    </div>
                    <p className="text-lg font-medium">Selecione uma ata para leitura</p>
                </div>
            )}
        </div>
      </div>
    </Layout>
  );
}

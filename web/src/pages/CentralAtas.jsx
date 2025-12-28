import React, { useState, useEffect } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  FileText, Calendar, User, Search, ChevronRight, CheckCircle, 
  Clock, AlertTriangle, Layers, Download, Share2, Save, Edit3
} from 'lucide-react';

export default function CentralAtas() {
  const [atas, setAtas] = useState([]);
  const [selectedAta, setSelectedAta] = useState(null);
  const [busca, setBusca] = useState('');
  
  // Dados detalhados
  const [acoesCriadas, setAcoesCriadas] = useState([]);
  const [acoesAnteriores, setAcoesAnteriores] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  useEffect(() => {
    fetchAtas();
  }, []);

  useEffect(() => {
    if (selectedAta) {
      carregarDetalhes(selectedAta);
    }
  }, [selectedAta]);

  const fetchAtas = async () => {
    const { data } = await supabase
      .from('reunioes')
      .select('*')
      .eq('status', 'Realizada') // Só mostra o que já aconteceu
      .order('data_hora', { ascending: false });
    setAtas(data || []);
    if (data && data.length > 0) setSelectedAta(data[0]);
  };

  const carregarDetalhes = async (ata) => {
    setLoadingDetalhes(true);
    setObservacoes(ata.observacoes || ''); // Assume que existe ou começa vazio
    
    try {
      // 1. Busca Ações Criadas NESTA reunião
      const { data: criadas } = await supabase
        .from('acoes')
        .select('*')
        .eq('reuniao_id', ata.id);
      setAcoesCriadas(criadas || []);

      // 2. Busca Ações Pendentes de Reuniões ANTERIORES do mesmo tipo
      // Primeiro pegamos IDs de reuniões do mesmo tipo
      const { data: idsDoTipo } = await supabase
        .from('reunioes')
        .select('id')
        .eq('tipo_reuniao', ata.tipo_reuniao)
        .neq('id', ata.id) // Não pega a atual
        .lt('data_hora', ata.data_hora); // Apenas reuniões passadas
      
      const listaIds = idsDoTipo?.map(r => r.id) || [];
      
      if (listaIds.length > 0) {
        const { data: anteriores } = await supabase
          .from('acoes')
          .select('*')
          .in('reuniao_id', listaIds)
          .eq('status', 'Aberta'); // Apenas o que ficou pendente
        setAcoesAnteriores(anteriores || []);
      } else {
        setAcoesAnteriores([]);
      }

    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const salvarObservacoes = async () => {
    if (!selectedAta) return;
    const { error } = await supabase
      .from('reunioes')
      .update({ observacoes: observacoes }) // Certifique-se de criar essa coluna no Supabase se não existir
      .eq('id', selectedAta.id);
      
    if (!error) alert("Observações salvas!");
  };

  // Filtro lateral
  const atasFiltradas = atas.filter(a => 
    a.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    a.tipo_reuniao?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
        
        {/* --- SIDEBAR: LISTA DE ATAS --- */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Layers className="text-blue-600" size={20}/> Banco de Atas
            </h2>
            <p className="text-xs text-slate-400 mt-1">Histórico oficial e auditável.</p>
            
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
              <input 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="Buscar por título ou área..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {atasFiltradas.map(ata => (
              <button
                key={ata.id}
                onClick={() => setSelectedAta(ata)}
                className={`w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex flex-col gap-1 ${selectedAta?.id === ata.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}`}
              >
                <h3 className={`font-bold text-sm ${selectedAta?.id === ata.id ? 'text-blue-800' : 'text-slate-700'}`}>
                  {ata.titulo}
                </h3>
                <div className="flex items-center justify-between mt-1">
                   <span className="text-xs text-slate-500 flex items-center gap-1">
                     <Calendar size={12}/> {new Date(ata.data_hora).toLocaleDateString()}
                   </span>
                   <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">
                     {ata.tipo_reuniao || 'Geral'}
                   </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* --- MAIN: DETALHE DA ATA --- */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 custom-scrollbar">
          {selectedAta ? (
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* HEADER DO DOCUMENTO */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-2 block flex items-center gap-1">
                      <CheckCircle size={14}/> Documento Finalizado
                    </span>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedAta.titulo}</h1>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5"><Calendar size={16}/> {new Date(selectedAta.data_hora).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1.5"><Clock size={16}/> {new Date(selectedAta.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      <span className="flex items-center gap-1.5"><User size={16}/> {selectedAta.responsavel || 'IA Copiloto'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Exportar PDF"><Download size={20}/></button>
                    <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Compartilhar"><Share2 size={20}/></button>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full mb-6"></div>

                {/* RESUMO DA IA */}
                <div className="prose prose-slate max-w-none">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <FileText className="text-blue-500" size={20}/> Resumo da Inteligência Artificial
                  </h3>
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-slate-700 leading-relaxed text-sm whitespace-pre-line">
                     {selectedAta.pauta || "Nenhum resumo registrado para esta reunião."}
                  </div>
                </div>
              </div>

              {/* GRID DE AÇÕES (CRÍTICO) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. O que foi criado AQUI */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Ações Definidas
                    </h3>
                    <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">{acoesCriadas.length} novas</span>
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    {acoesCriadas.length > 0 ? acoesCriadas.map(acao => (
                      <div key={acao.id} className="p-3 bg-green-50/50 border border-green-100 rounded-lg flex items-start gap-3">
                        <input type="checkbox" disabled checked={acao.status === 'Concluída'} className="mt-1 rounded border-green-300 text-green-600 focus:ring-green-500"/>
                        <div>
                          <p className="text-sm text-slate-800 font-medium">{acao.descricao}</p>
                          <p className="text-xs text-slate-500 mt-1">Resp: {acao.responsavel}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-slate-400 text-xs italic">Nenhuma ação gerada nesta reunião.</div>
                    )}
                  </div>
                </div>

                {/* 2. O que estava pendente ANTES (Contexto) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      Pendências Anteriores
                    </h3>
                    <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{acoesAnteriores.length} em aberto</span>
                  </div>

                  <div className="flex-1 space-y-3">
                    {acoesAnteriores.length > 0 ? acoesAnteriores.map(acao => (
                      <div key={acao.id} className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg flex items-start gap-3 opacity-80 hover:opacity-100 transition-opacity">
                        <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0"/>
                        <div>
                          <p className="text-sm text-slate-700">{acao.descricao}</p>
                          <p className="text-[10px] text-amber-600 mt-1 font-bold">Vem de outra reunião ({new Date(acao.data_criacao).toLocaleDateString()})</p>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-slate-400 text-xs italic">Tudo limpo! Sem pendências passadas.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* OBSERVAÇÕES MANUAIS */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <Edit3 className="text-slate-400" size={18}/> Observações / Anotações Manuais
                 </h3>
                 <textarea 
                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                    placeholder="Espaço para anotações extras da liderança..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                 />
                 <div className="flex justify-end mt-3">
                    <button onClick={salvarObservacoes} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg">
                        <Save size={16}/> Salvar Notas
                    </button>
                 </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Layers size={64} className="mb-4 opacity-20"/>
              <p className="text-lg font-medium">Selecione uma Ata para visualizar</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

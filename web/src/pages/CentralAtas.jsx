import React, { useState, useEffect } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { getGeminiFlash } from '../services/gemini';
import { 
  FileText, Calendar, User, Search, CheckCircle, 
  Clock, Layers, Download, Save, Edit3, Trash2, Plus, X, 
  Image as ImageIcon, Loader2, Cpu, PlayCircle, Headphones, Camera, ExternalLink, MessageSquare
} from 'lucide-react';

export default function CentralAtas() {
  const [atas, setAtas] = useState([]);
  const [selectedAta, setSelectedAta] = useState(null);
  const [busca, setBusca] = useState('');
  
  // Dados da Ata
  const [acoesCriadas, setAcoesCriadas] = useState([]);
  const [acoesAnteriores, setAcoesAnteriores] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  
  // Estados de Interface
  const [isEditing, setIsEditing] = useState(false);
  const [editedPauta, setEditedPauta] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // --- MODAL DE AÇÃO (NOVO) ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionForm, setActionForm] = useState({
    id: null,
    descricao: '',
    responsavel: '',
    data_vencimento: '',
    observacao: '',
    fotos: [] // URLs existentes
  });
  const [newFiles, setNewFiles] = useState([]); // Arquivos novos para upload

  useEffect(() => {
    fetchAtas();
  }, []);

  useEffect(() => {
    if (selectedAta) {
      carregarDetalhes(selectedAta);
      setEditedPauta(selectedAta.pauta || '');
      setObservacoes(selectedAta.observacoes || '');
      setIsEditing(false);
    }
  }, [selectedAta]);

  const fetchAtas = async () => {
    const { data } = await supabase
      .from('reunioes')
      .select('*')
      .eq('status', 'Realizada')
      .order('data_hora', { ascending: false });
    setAtas(data || []);
    if (data && data.length > 0 && !selectedAta) setSelectedAta(data[0]);
  };

  const carregarDetalhes = async (ata) => {
    // 1. Ações desta reunião
    const { data: criadas } = await supabase
      .from('acoes')
      .select('*')
      .eq('reuniao_id', ata.id)
      .order('data_criacao', { ascending: false });
    setAcoesCriadas(criadas || []);

    // 2. Ações Pendentes Anteriores
    if (ata.tipo_reuniao) {
        const { data: idsDoTipo } = await supabase
            .from('reunioes')
            .select('id')
            .eq('tipo_reuniao', ata.tipo_reuniao)
            .neq('id', ata.id)
            .lt('data_hora', ata.data_hora);
        
        const listaIds = (idsDoTipo || []).map(r => r.id);
        
        if (listaIds.length > 0) {
            const { data: anteriores } = await supabase
            .from('acoes')
            .select('*')
            .in('reuniao_id', listaIds)
            .eq('status', 'Aberta');
            setAcoesAnteriores(anteriores || []);
        } else {
            setAcoesAnteriores([]);
        }
    } else {
        setAcoesAnteriores([]);
    }
  };

  // --- MANIPULAÇÃO DO MODAL DE AÇÃO ---

  const openNewActionModal = () => {
    setActionForm({ id: null, descricao: '', responsavel: '', data_vencimento: '', observacao: '', fotos: [] });
    setNewFiles([]);
    setIsModalOpen(true);
  };

  const openEditActionModal = (acao) => {
    setActionForm({
        id: acao.id,
        descricao: acao.descricao,
        responsavel: acao.responsavel,
        data_vencimento: acao.data_vencimento || '',
        observacao: acao.observacao || '',
        fotos: acao.fotos || []
    });
    setNewFiles([]);
    setIsModalOpen(true);
  };

  const handleFileSelect = (e) => {
    if (e.target.files) setNewFiles([...newFiles, ...Array.from(e.target.files)]);
  };

  const handleSaveAction = async () => {
    if (!actionForm.descricao) return alert("A descrição é obrigatória.");
    setModalLoading(true);

    try {
        // 1. Upload de novas fotos (se houver)
        let uploadedUrls = [];
        if (newFiles.length > 0) {
            for (const file of newFiles) {
                const fileName = `evidencia-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                const { error } = await supabase.storage.from('evidencias').upload(fileName, file);
                if (!error) {
                    const { data } = supabase.storage.from('evidencias').getPublicUrl(fileName);
                    uploadedUrls.push(data.publicUrl);
                }
            }
        }

        const finalFotos = [...actionForm.fotos, ...uploadedUrls];

        const payload = {
            descricao: actionForm.descricao,
            responsavel: actionForm.responsavel || 'Geral',
            data_vencimento: actionForm.data_vencimento || null,
            observacao: actionForm.observacao,
            fotos: finalFotos,
            reuniao_id: selectedAta.id, // Sempre vincula a esta ata se for nova
            // Se for edição, mantém o ID original, se nova, cria.
        };

        if (actionForm.id) {
            // EDITAR
            const { error } = await supabase.from('acoes').update(payload).eq('id', actionForm.id);
            if (error) throw error;
        } else {
            // CRIAR NOVA
            payload.status = 'Aberta';
            payload.data_criacao = new Date().toISOString(); // Importante para o erro que deu
            const { error } = await supabase.from('acoes').insert([payload]);
            if (error) throw error;
        }

        await carregarDetalhes(selectedAta); // Recarrega listas
        setIsModalOpen(false);

    } catch (error) {
        alert("Erro ao salvar ação: " + error.message);
    } finally {
        setModalLoading(false);
    }
  };

  const toggleStatusAcao = async (acao, e) => {
    e.stopPropagation(); // Evita abrir o modal
    const novoStatus = acao.status === 'Aberta' ? 'Concluída' : 'Aberta';
    
    // Otimista
    const updateList = (lista) => lista.map(a => a.id === acao.id ? {...a, status: novoStatus} : a);
    setAcoesCriadas(updateList(acoesCriadas));
    setAcoesAnteriores(updateList(acoesAnteriores));

    await supabase.from('acoes').update({ status: novoStatus }).eq('id', acao.id);
  };

  // --- OUTRAS FUNÇÕES (Ata, IA, Delete) ---
  const handleSaveAta = async () => {
    const { error } = await supabase.from('reunioes').update({ pauta: editedPauta, observacoes }).eq('id', selectedAta.id);
    if (!error) {
        setIsEditing(false);
        setSelectedAta(prev => ({...prev, pauta: editedPauta, observacoes}));
        setAtas(prev => prev.map(a => a.id === selectedAta.id ? {...a, pauta: editedPauta, observacoes} : a));
        alert("Salvo!");
    }
  };

  const handleRegenerateIA = async () => {
    if(!selectedAta.audio_url || !window.confirm("Gerar novo resumo?")) return;
    setIsGenerating(true);
    try {
        const response = await fetch(selectedAta.audio_url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64data = reader.result.split(',')[1];
            const model = getGeminiFlash();
            const result = await model.generateContent([
                "Atue como Secretária. Gere ATA MARKDOWN: # Título ## 1. Resumo ## 2. Decisões ## 3. Ações", 
                { inlineData: { data: base64data, mimeType: 'audio/webm' } }
            ]);
            const texto = result.response.text();
            await supabase.from('reunioes').update({ pauta: texto }).eq('id', selectedAta.id);
            setEditedPauta(texto);
            setIsGenerating(false);
        };
    } catch (e) { alert("Erro IA"); setIsGenerating(false); }
  };

  const atasFiltradas = atas.filter(a => a.titulo.toLowerCase().includes(busca.toLowerCase()));

  return (
    <Layout>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
        
        {/* SIDEBAR */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Layers className="text-blue-600" size={20}/> Banco de Atas</h2>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {atasFiltradas.map(ata => (
              <button key={ata.id} onClick={() => setSelectedAta(ata)} className={`w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex flex-col gap-1 ${selectedAta?.id === ata.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}`}>
                <h3 className={`font-bold text-sm ${selectedAta?.id === ata.id ? 'text-blue-800' : 'text-slate-700'}`}>{ata.titulo}</h3>
                <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={12}/> {new Date(ata.data_hora).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 custom-scrollbar relative">
          {selectedAta ? (
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* HEADER ATA */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-2 block flex items-center gap-1"><CheckCircle size={14}/> Ata Oficial</span>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedAta.titulo}</h1>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><Calendar size={16}/> {new Date(selectedAta.data_hora).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><User size={16}/> {selectedAta.responsavel || 'IA'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isEditing ? (
                        <button onClick={handleSaveAta} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg"><Save size={18}/> Salvar</button>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg bg-slate-50" title="Editar"><Edit3 size={20}/></button>
                    )}
                  </div>
                </div>

                <div className="mb-6 flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="p-2 bg-white rounded-full text-blue-500 shadow-sm"><Headphones size={20}/></div>
                    <div className="flex-1">
                        {selectedAta.audio_url ? <audio controls src={selectedAta.audio_url} className="w-full h-8"/> : <span className="text-xs text-slate-400">Sem áudio.</span>}
                    </div>
                    {selectedAta.audio_url && !isEditing && (
                        <button onClick={handleRegenerateIA} disabled={isGenerating} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-bold flex gap-1">
                            {isGenerating ? <Loader2 size={14} className="animate-spin"/> : <Cpu size={14}/>} IA Refazer
                        </button>
                    )}
                </div>

                <div className="prose prose-slate max-w-none">
                  {isEditing ? 
                    <textarea className="w-full h-64 p-4 border rounded-xl bg-slate-50 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={editedPauta} onChange={(e) => setEditedPauta(e.target.value)}/> 
                    : <div className="text-slate-700 text-sm whitespace-pre-line leading-relaxed">{selectedAta.pauta || "Sem resumo."}</div>
                  }
                </div>
              </div>

              {/* GRID AÇÕES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* COLUNA 1: AÇÕES DA REUNIÃO */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Ações Definidas</h3>
                    <button onClick={openNewActionModal} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md transition-all active:scale-95">
                        <Plus size={14}/> Nova Ação
                    </button>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    {acoesCriadas.map(acao => (
                      <div key={acao.id} onClick={() => openEditActionModal(acao)} className={`p-3 border rounded-lg cursor-pointer hover:shadow-md transition-all group ${acao.status === 'Concluída' ? 'bg-slate-50 opacity-60' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                        <div className="flex items-start gap-3">
                            <input type="checkbox" checked={acao.status === 'Concluída'} onChange={(e) => toggleStatusAcao(acao, e)} className="mt-1 cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                            <div className="flex-1">
                                <p className={`text-sm font-medium ${acao.status === 'Concluída' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{acao.descricao}</p>
                                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1"><User size={10}/> {acao.responsavel}</span>
                                    {acao.data_vencimento && <span className="text-[10px] text-red-500 flex items-center gap-1"><Clock size={10}/> {new Date(acao.data_vencimento).toLocaleDateString()}</span>}
                                    {acao.fotos && acao.fotos.length > 0 && <span className="text-[10px] text-blue-500 flex items-center gap-1"><ImageIcon size={10}/> {acao.fotos.length}</span>}
                                    {acao.observacao && <span className="text-[10px] text-amber-500 flex items-center gap-1"><MessageSquare size={10}/> Obs</span>}
                                </div>
                            </div>
                        </div>
                      </div>
                    ))}
                    {acoesCriadas.length === 0 && <p className="text-center text-xs text-slate-400 py-4 italic">Nenhuma ação criada.</p>}
                  </div>
                </div>

                {/* COLUNA 2: PENDÊNCIAS ANTERIORES */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><div className="w-2 h-2 bg-amber-500 rounded-full"></div> Pendências Anteriores</h3>
                  <div className="flex-1 space-y-2">
                    {acoesAnteriores.map(acao => (
                      <div key={acao.id} onClick={() => openEditActionModal(acao)} className="p-3 bg-amber-50/30 border border-amber-100 rounded-lg cursor-pointer hover:bg-amber-50 transition-colors">
                        <div className="flex items-start gap-3">
                            <input type="checkbox" checked={acao.status === 'Concluída'} onChange={(e) => toggleStatusAcao(acao, e)} className="mt-1"/>
                            <div>
                                <p className="text-sm font-medium text-slate-800">{acao.descricao}</p>
                                <p className="text-[10px] text-amber-600 mt-1">Origem: {new Date(acao.data_criacao).toLocaleDateString()}</p>
                            </div>
                        </div>
                      </div>
                    ))}
                    {acoesAnteriores.length === 0 && <p className="text-center text-xs text-slate-400 py-4 italic">Tudo em dia!</p>}
                  </div>
                </div>
              </div>

              {/* OBSERVAÇÕES DA ATA */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><Edit3 size={18}/> Observações Gerais</h3>
                 <textarea className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none" 
                    value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={!isEditing} placeholder="Notas manuais da reunião..." />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400"><Layers size={64} className="opacity-20 mb-4"/><p>Selecione uma Ata</p></div>
          )}
        </div>

        {/* --- MODAL DE AÇÃO (CRIAÇÃO E DETALHES) --- */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800">{actionForm.id ? 'Detalhes da Ação' : 'Nova Ação'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full"><X size={20} className="text-slate-500"/></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">O que precisa ser feito?</label>
                            <textarea 
                                className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                                value={actionForm.descricao}
                                onChange={e => setActionForm({...actionForm, descricao: e.target.value})}
                                placeholder="Descreva a tarefa..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Responsável</label>
                                <input className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500" 
                                    value={actionForm.responsavel} onChange={e => setActionForm({...actionForm, responsavel: e.target.value})} placeholder="Nome" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vencimento</label>
                                <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500" 
                                    value={actionForm.data_vencimento} onChange={e => setActionForm({...actionForm, data_vencimento: e.target.value})} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações / Comentários</label>
                            <textarea 
                                className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none bg-slate-50"
                                value={actionForm.observacao}
                                onChange={e => setActionForm({...actionForm, observacao: e.target.value})}
                                placeholder="Detalhes extras..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Evidências (Fotos)</label>
                            
                            {/* Lista de Fotos Existentes */}
                            {actionForm.fotos.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {actionForm.fotos.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noreferrer" className="block relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                                            <img src={url} className="w-full h-full object-cover" alt="evidencia"/>
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <ExternalLink className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" size={16}/>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* Upload */}
                            <label className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors text-slate-400 hover:text-blue-500">
                                <Camera size={24} className="mb-1"/>
                                <span className="text-xs font-bold">Adicionar Foto</span>
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                            </label>
                            {newFiles.length > 0 && <p className="text-xs text-green-600 mt-1 font-bold">{newFiles.length} novos arquivos selecionados.</p>}
                        </div>
                    </div>

                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg text-sm">Cancelar</button>
                        <button onClick={handleSaveAction} disabled={modalLoading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm flex items-center gap-2 shadow-lg disabled:opacity-50">
                            {modalLoading ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle size={16}/>}
                            {actionForm.id ? 'Salvar Alterações' : 'Criar Ação'}
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </Layout>
  );
}

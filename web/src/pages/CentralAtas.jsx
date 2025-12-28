import React, { useState, useEffect } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { getGeminiFlash } from '../services/gemini';
import { 
  FileText, Calendar, User, Search, CheckCircle, 
  Clock, Layers, Download, Save, Edit3, Trash2, Plus, X, 
  Image as ImageIcon, Loader2, Cpu, PlayCircle, Headphones, Camera
} from 'lucide-react';

export default function CentralAtas() {
  const [atas, setAtas] = useState([]);
  const [selectedAta, setSelectedAta] = useState(null);
  const [busca, setBusca] = useState('');
  
  // Estados de Detalhes
  const [acoesCriadas, setAcoesCriadas] = useState([]);
  const [acoesAnteriores, setAcoesAnteriores] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  
  // Estados de Edição e UI
  const [isEditing, setIsEditing] = useState(false);
  const [editedPauta, setEditedPauta] = useState('');
  const [viewingAction, setViewingAction] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Nova Ação (Com Fotos)
  const [novaAcao, setNovaAcao] = useState({ descricao: '', responsavel: '' });
  const [fotosAcao, setFotosAcao] = useState([]);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    fetchAtas();
  }, []);

  useEffect(() => {
    if (selectedAta) {
      carregarDetalhes(selectedAta);
      setEditedPauta(selectedAta.pauta || '');
      setObservacoes(selectedAta.observacoes || '');
      setIsEditing(false);
      // Limpa form ao trocar de ata
      setNovaAcao({ descricao: '', responsavel: '' });
      setFotosAcao([]);
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
    // 1. Busca Ações Criadas
    const { data: criadas } = await supabase
      .from('acoes')
      .select('*')
      .eq('reuniao_id', ata.id)
      .order('data_criacao', { ascending: false });
    setAcoesCriadas(criadas || []);

    // 2. Busca Pendências Anteriores
    if (ata.tipo_reuniao) {
        const { data: idsDoTipo } = await supabase
            .from('reunioes')
            .select('id')
            .eq('tipo_reuniao', ata.tipo_reuniao)
            .neq('id', ata.id)
            .lt('data_hora', ata.data_hora);
        
        const listaIds = idsDoTipo?.map(r => r.id) || [];
        
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
    }
  };

  // --- FUNÇÕES DE AÇÃO ---

  const handleSaveEdit = async () => {
    // 1. Salva no banco
    const { error } = await supabase
      .from('reunioes')
      .update({ pauta: editedPauta, observacoes: observacoes })
      .eq('id', selectedAta.id);
      
    if (!error) {
        setIsEditing(false);
        // 2. Atualiza estado local para refletir na lista e na tela sem reload
        const novasAtas = atas.map(a => a.id === selectedAta.id ? {...a, pauta: editedPauta, observacoes} : a);
        setAtas(novasAtas);
        setSelectedAta(prev => ({...prev, pauta: editedPauta, observacoes}));
        alert("Alterações salvas com sucesso!");
    } else {
        alert("Erro ao salvar: " + error.message);
    }
  };

  const handleDeleteAta = async () => {
    const senha = window.prompt("Digite a senha para excluir esta ata permanentemente:");
    if (senha === "excluir") {
        const { error } = await supabase.from('reunioes').delete().eq('id', selectedAta.id);
        if (!error) {
            alert("Ata excluída.");
            window.location.reload();
        } else {
            alert("Erro ao excluir: " + error.message);
        }
    } else if (senha !== null) {
        alert("Senha incorreta.");
    }
  };

  // --- NOVA LÓGICA DE AÇÃO (Com Upload) ---
  const handlePhotoSelect = (e) => {
    if (e.target.files) {
        setFotosAcao(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const uploadFotos = async () => {
    const urls = [];
    for (const file of fotosAcao) {
        const fileName = `evidencia-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const { error } = await supabase.storage.from('evidencias').upload(fileName, file);
        if (!error) {
            const { data } = supabase.storage.from('evidencias').getPublicUrl(fileName);
            urls.push(data.publicUrl);
        }
    }
    return urls;
  };

  const handleAddAcao = async () => {
    if (!novaAcao.descricao) return;
    setLoadingAction(true);
    
    try {
        const urlsFotos = await uploadFotos();

        const payload = {
            descricao: novaAcao.descricao,
            responsavel: novaAcao.responsavel || 'Geral',
            reuniao_id: selectedAta.id,
            status: 'Aberta',
            data_criacao: new Date().toISOString(),
            fotos: urlsFotos // Salva array de URLs
        };

        const { data, error } = await supabase.from('acoes').insert([payload]).select();
        
        if (error) throw error;

        if (data) {
            setAcoesCriadas([data[0], ...acoesCriadas]);
            setNovaAcao({ descricao: '', responsavel: '' });
            setFotosAcao([]);
        }
    } catch (error) {
        alert("Erro ao criar ação: " + error.message);
    } finally {
        setLoadingAction(false);
    }
  };

  const toggleStatusAcao = async (acao) => {
    const novoStatus = acao.status === 'Aberta' ? 'Concluída' : 'Aberta';
    const updateList = (lista) => lista.map(a => a.id === acao.id ? {...a, status: novoStatus} : a);
    setAcoesCriadas(updateList(acoesCriadas));
    setAcoesAnteriores(updateList(acoesAnteriores));
    await supabase.from('acoes').update({ status: novoStatus }).eq('id', acao.id);
  };

  // --- IA RESUMIR ---
  const handleRegenerateIA = async () => {
    if (!selectedAta.audio_url) return alert("Não há gravação de áudio disponível.");
    if(!window.confirm("Isso irá substituir o resumo atual. Deseja continuar?")) return;

    setIsGenerating(true);
    try {
        const response = await fetch(selectedAta.audio_url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64data = reader.result.split(',')[1];
            const model = getGeminiFlash();
            const prompt = `
                Atue como Secretária Executiva. Analise o áudio da reunião "${selectedAta.titulo}".
                Gere uma ATA em Markdown:
                # ATA DE REUNIÃO
                ## 1. Resumo Executivo
                ## 2. Decisões Tomadas
                ## 3. Ações e Prazos
            `;
            const result = await model.generateContent([prompt, { inlineData: { data: base64data, mimeType: 'audio/webm' } }]);
            const textoNovo = result.response.text();

            const { error } = await supabase.from('reunioes').update({ pauta: textoNovo }).eq('id', selectedAta.id);
            if (!error) {
                setEditedPauta(textoNovo);
                setSelectedAta(prev => ({...prev, pauta: textoNovo}));
                setAtas(prev => prev.map(a => a.id === selectedAta.id ? {...a, pauta: textoNovo} : a));
                alert("Resumo atualizado!");
            }
            setIsGenerating(false);
        };
    } catch (error) {
        alert("Erro IA: " + error.message);
        setIsGenerating(false);
    }
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
              <input className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100" placeholder="Buscar ata..." value={busca} onChange={e => setBusca(e.target.value)} />
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
              
              {/* HEADER */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-2 block flex items-center gap-1"><CheckCircle size={14}/> Documento Oficial</span>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedAta.titulo}</h1>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5"><Calendar size={16}/> {new Date(selectedAta.data_hora).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1.5"><User size={16}/> {selectedAta.responsavel || 'IA'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isEditing ? (
                        <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg"><Save size={18}/> Salvar</button>
                    ) : (
                        <>
                            <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar Ata"><Edit3 size={20}/></button>
                            <button onClick={handleDeleteAta} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir"><Trash2 size={20}/></button>
                        </>
                    )}
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full mb-6"></div>

                {/* AUDIO & IA */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Headphones className="text-blue-500" size={20}/> Registro de Áudio</h3>
                        {selectedAta.audio_url && !isEditing && (
                            <button onClick={handleRegenerateIA} disabled={isGenerating} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                                {isGenerating ? <Loader2 size={14} className="animate-spin"/> : <Cpu size={14}/>}
                                {isGenerating ? 'Analisando...' : 'Gerar Resumo IA'}
                            </button>
                        )}
                    </div>
                    {selectedAta.audio_url ? (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><PlayCircle size={24}/></div>
                            <audio controls src={selectedAta.audio_url} className="w-full h-8" />
                            <a href={selectedAta.audio_url} download target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600 p-2"><Download size={20}/></a>
                        </div>
                    ) : <div className="bg-slate-50 border border-dashed border-slate-300 p-4 rounded-xl text-center text-slate-400 text-sm italic">Nenhum áudio disponível.</div>}
                </div>

                {/* RESUMO */}
                <div className="prose prose-slate max-w-none">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><FileText className="text-blue-500" size={20}/> Resumo da Reunião</h3>
                  {isEditing ? (
                      <textarea className="w-full h-64 p-4 border border-blue-200 rounded-xl bg-blue-50/50 text-slate-800 text-sm outline-none resize-none font-mono" value={editedPauta} onChange={(e) => setEditedPauta(e.target.value)} />
                  ) : (
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-slate-700 leading-relaxed text-sm whitespace-pre-line">
                         {selectedAta.pauta || "Nenhum resumo registrado."}
                      </div>
                  )}
                </div>
              </div>

              {/* GRID AÇÕES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* AÇÕES NOVAS */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Ações Definidas</h3>
                  
                  {/* Form */}
                  <div className="flex gap-2 mb-4">
                    <input className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs outline-none focus:border-blue-400" placeholder="Nova ação..." value={novaAcao.descricao} onChange={e => setNovaAcao({...novaAcao, descricao: e.target.value})} />
                    <input className="w-20 bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs outline-none focus:border-blue-400" placeholder="Resp." value={novaAcao.responsavel} onChange={e => setNovaAcao({...novaAcao, responsavel: e.target.value})} />
                    
                    {/* Botão Foto */}
                    <label className="bg-slate-50 border border-slate-200 rounded px-2 flex items-center cursor-pointer hover:bg-slate-100">
                        <Camera size={16} className="text-slate-400"/>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                        {fotosAcao.length > 0 && <span className="text-[10px] ml-1 font-bold text-green-600">{fotosAcao.length}</span>}
                    </label>

                    <button onClick={handleAddAcao} disabled={loadingAction} className="bg-blue-600 text-white rounded px-3 hover:bg-blue-700 disabled:opacity-50">
                        {loadingAction ? <Loader2 size={14} className="animate-spin"/> : <Plus size={16}/>}
                    </button>
                  </div>

                  <div className="flex-1 space-y-2">
                    {acoesCriadas.map(acao => (
                      <div key={acao.id} className={`p-3 border rounded-lg flex items-start gap-3 ${acao.status === 'Concluída' ? 'bg-slate-50 opacity-60' : 'bg-green-50/50 border-green-100'}`}>
                        <input type="checkbox" checked={acao.status === 'Concluída'} onChange={() => toggleStatusAcao(acao)} className="mt-1 cursor-pointer"/>
                        <div className="flex-1 cursor-pointer" onClick={() => setViewingAction(acao)}>
                          <p className={`text-sm font-medium ${acao.status === 'Concluída' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{acao.descricao}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs text-slate-500">Resp: {acao.responsavel}</span>
                             {acao.fotos && acao.fotos.length > 0 && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 rounded flex items-center gap-1"><ImageIcon size={10}/> Evidências</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PENDÊNCIAS */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><div className="w-2 h-2 bg-amber-500 rounded-full"></div> Pendências Anteriores</h3>
                  <div className="flex-1 space-y-2">
                    {acoesAnteriores.length > 0 ? acoesAnteriores.map(acao => (
                      <div key={acao.id} className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg flex items-start gap-3">
                        <input type="checkbox" checked={acao.status === 'Concluída'} onChange={() => toggleStatusAcao(acao)} className="mt-1 cursor-pointer"/>
                        <div className="flex-1 cursor-pointer" onClick={() => setViewingAction(acao)}>
                          <p className="text-sm font-medium text-slate-800">{acao.descricao}</p>
                          <p className="text-[10px] text-amber-600 mt-1">Vem de: {new Date(acao.data_criacao).toLocaleDateString()}</p>
                        </div>
                      </div>
                    )) : <p className="text-xs text-slate-400 italic text-center mt-10">Nenhuma pendência.</p>}
                  </div>
                </div>
              </div>

              {/* OBSERVAÇÕES */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><Edit3 className="text-slate-400" size={18}/> Observações Extras</h3>
                 <textarea className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none resize-none" placeholder="Anotações manuais..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={!isEditing} />
                 {isEditing && <p className="text-xs text-blue-500 mt-2">*Salve para registrar as alterações.</p>}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400"><Layers size={64} className="mb-4 opacity-20"/><p className="text-lg font-medium">Selecione uma Ata</p></div>
          )}

          {/* MODAL EVIDÊNCIAS */}
          {viewingAction && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-xl max-w-2xl w-full p-6 relative">
                    <button onClick={() => setViewingAction(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800"><X size={24}/></button>
                    <h3 className="text-lg font-bold text-slate-800 pr-8 mb-1">Evidências da Ação</h3>
                    <p className="text-sm text-slate-500 mb-4">{viewingAction.descricao}</p>
                    <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {viewingAction.fotos && viewingAction.fotos.length > 0 ? (
                            viewingAction.fotos.map((url, idx) => (
                                <a key={idx} href={url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg border border-slate-200 hover:shadow-lg transition-all">
                                    <img src={url} alt={`Evidência ${idx}`} className="w-full h-40 object-cover group-hover:scale-105 transition-transform" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center"><Download className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" /></div>
                                </a>
                            ))
                        ) : <div className="col-span-2 text-center py-10 text-slate-400 bg-slate-50 rounded-lg"><ImageIcon size={32} className="mx-auto mb-2 opacity-30"/><p>Sem fotos.</p></div>}
                    </div>
                </div>
             </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

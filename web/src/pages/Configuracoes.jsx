// src/pages/Configuracoes.jsx
import React, { useState, useEffect } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { 
  Settings, 
  Save, 
  Terminal, 
  RefreshCw, 
  Edit3, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export default function Configuracoes() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_prompts')
      .select('*')
      .order('titulo', { ascending: true });

    if (error) {
      console.error('Erro ao buscar prompts:', error);
    } else {
      setPrompts(data || []);
    }
    setLoading(false);
  };

  const handleUpdatePrompt = (id, newText) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, prompt_text: newText } : p));
  };

  const savePrompt = async (prompt) => {
    setSavingId(prompt.id);
    try {
      const { error } = await supabase
        .from('app_prompts')
        .update({ 
          prompt_text: prompt.prompt_text,
          updated_at: new Date().toISOString()
        })
        .eq('id', prompt.id);

      if (error) throw error;
      
      // Feedback visual rápido (opcional, pode ser um toast)
      alert(`Prompt "${prompt.titulo}" atualizado com sucesso!`);
    } catch (e) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Layout>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* HEADER */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <Settings className="text-blue-600" size={24} />
                  </div>
                  Configuração de IA
                </h1>
                <p className="text-slate-500 mt-2 text-sm font-medium">
                  Gerencie os prompts do sistema ("Cérebro da IA") sem precisar alterar o código.
                </p>
              </div>
              
              <button 
                onClick={fetchPrompts}
                className="p-2 text-slate-400 hover:text-blue-600 transition-colors bg-white border border-slate-200 rounded-lg shadow-sm"
                title="Recarregar dados"
              >
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {/* LISTA DE PROMPTS */}
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                <LoaderSkeleton />
                <span className="text-xs font-bold uppercase tracking-wider">Carregando configurações...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {prompts.map((prompt) => (
                  <div key={prompt.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden group hover:border-blue-300 transition-all">
                    
                    {/* CABEÇALHO DO CARD */}
                    <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className="mt-1 p-1.5 bg-blue-50 rounded text-blue-600">
                          <Terminal size={16} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            {prompt.titulo}
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                              {prompt.slug}
                            </span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">{prompt.descricao}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => savePrompt(prompt)}
                        disabled={savingId === prompt.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          savingId === prompt.id
                            ? 'bg-blue-100 text-blue-400 cursor-wait'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                        }`}
                      >
                        {savingId === prompt.id ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                        {savingId === prompt.id ? 'Salvando...' : 'Salvar Alterações'}
                      </button>
                    </div>

                    {/* ÁREA DE EDIÇÃO */}
                    <div className="p-4 bg-slate-50 relative">
                      <div className="absolute top-4 right-4 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow">
                          Markdown Suportado
                        </span>
                      </div>
                      <textarea
                        value={prompt.prompt_text}
                        onChange={(e) => handleUpdatePrompt(prompt.id, e.target.value)}
                        className="w-full h-64 bg-slate-900 text-slate-300 font-mono text-xs p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 custom-scrollbar resize-y border border-slate-800 shadow-inner"
                        spellCheck="false"
                      />
                      
                      {/* DICA DE VARIÁVEIS */}
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
                        <AlertCircle size={12} />
                        <span>
                          Dica: Mantenha as variáveis como 
                          <strong className="text-blue-600 mx-1">{'{titulo}'}</strong> e 
                          <strong className="text-blue-600 mx-1">{'{data}'}</strong> 
                          para o sistema substituir automaticamente.
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {prompts.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                    <p className="text-slate-400 text-sm">Nenhum prompt configurado no banco de dados.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Pequeno skeleton loader para dar um charme
const LoaderSkeleton = () => (
  <div className="animate-pulse flex space-x-4">
    <div className="h-12 w-12 bg-slate-200 rounded-full"></div>
  </div>
);

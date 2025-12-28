import React, { useState, useEffect } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { CheckCircle, Clock, AlertCircle, Camera, ExternalLink } from 'lucide-react';

const GestaoAcoes = () => {
  const [acoes, setAcoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAcoes(); }, []);

  const fetchAcoes = async () => {
    const { data } = await supabase.from('acoes').select('*, reunioes(titulo)').order('created_at', { ascending: false });
    setAcoes(data || []);
    setLoading(false);
  };

  const handleConcluir = async (id) => {
    if(!confirm("Marcar ação como concluída?")) return;
    await supabase.from('acoes').update({ status: 'Concluída', data_conclusao: new Date() }).eq('id', id);
    fetchAcoes();
  };

  return (
    <Layout>
      <div className="p-8 h-full font-sans">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Central de Ações e Pendências</h1>
        
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                    <tr>
                        <th className="p-4">Status</th>
                        <th className="p-4">Descrição</th>
                        <th className="p-4">Responsável</th>
                        <th className="p-4">Origem</th>
                        <th className="p-4">Evidência</th>
                        <th className="p-4 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {acoes.map(acao => (
                        <tr key={acao.id} className="hover:bg-gray-50">
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    acao.status === 'Concluída' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {acao.status}
                                </span>
                            </td>
                            <td className="p-4 font-medium text-gray-800">{acao.descricao}</td>
                            <td className="p-4 flex items-center gap-2">
                                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                                    {acao.responsavel.charAt(0)}
                                </div>
                                {acao.responsavel}
                            </td>
                            <td className="p-4 text-gray-500 text-xs">{acao.reunioes?.titulo || 'N/A'}</td>
                            <td className="p-4">
                                {acao.evidencia_url ? (
                                    <a href={acao.evidencia_url} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1"><ExternalLink size={14}/> Ver</a>
                                ) : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="p-4 text-center">
                                {acao.status !== 'Concluída' && (
                                    <button onClick={() => handleConcluir(acao.id)} className="text-green-600 hover:bg-green-50 p-2 rounded-full" title="Concluir">
                                        <CheckCircle size={18} />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </Layout>
  );
};
export default GestaoAcoes;

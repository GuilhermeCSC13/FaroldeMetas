import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Save, Calendar, Clock, AlertCircle, Camera, CheckCircle, ExternalLink, Play } from 'lucide-react';

const DetalheReuniao = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reuniao, setReuniao] = useState({});
  const [acoesPendentes, setAcoesPendentes] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ descricao: '', responsavel: '' });

  useEffect(() => { fetchDados(); }, [id]);

  const fetchDados = async () => {
    try {
      const { data: r, error } = await supabase.from('reunioes').select('*').eq('id', id).single();
      if (error) throw error;
      setReuniao(r);
      if (r.tipo_reuniao) fetchAcoes(r.tipo_reuniao);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchAcoes = async (tipo) => {
    const { data } = await supabase.from('acoes').select('*').eq('tipo_reuniao', tipo).neq('status', 'Concluída').order('created_at', { ascending: false });
    setAcoesPendentes(data || []);
  };

  const handleSaveReuniao = async () => {
    await supabase.from('reunioes').update({ pauta: reuniao.pauta, ata: reuniao.ata }).eq('id', id);
    alert('Salvo com sucesso!');
  };

  const handleCriarAcao = async () => {
    if(!novaAcao.descricao || !novaAcao.responsavel) return alert("Preencha dados");
    await supabase.from('acoes').insert({ reuniao_origem_id: id, tipo_reuniao: reuniao.tipo_reuniao, descricao: novaAcao.descricao, responsavel: novaAcao.responsavel, status: 'Aberta' });
    setNovaAcao({ descricao: '', responsavel: '' });
    fetchAcoes(reuniao.tipo_reuniao);
  };

  const handleConcluirAcao = async (acaoId) => {
    if(!confirm("Concluir ação?")) return;
    await supabase.from('acoes').update({ status: 'Concluída', data_conclusao: new Date() }).eq('id', acaoId);
    fetchAcoes(reuniao.tipo_reuniao);
  };

  const handleUpload = async (acaoId, file) => {
    setUploading(true);
    const fileName = `evidencia-${acaoId}-${Date.now()}`;
    const { data } = await supabase.storage.from('evidencias').upload(fileName, file);
    if(data) {
        const publicUrl = supabase.storage.from('evidencias').getPublicUrl(fileName).data.publicUrl;
        await supabase.from('acoes').update({ evidencia_url: publicUrl }).eq('id', acaoId);
        fetchAcoes(reuniao.tipo_reuniao);
    }
    setUploading(false);
  };

  if (loading) return <Layout><div className="p-10 text-center">Carregando...</div></Layout>;
  const dataObj = new Date(reuniao.data_hora);

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto h-full flex flex-col font-sans">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/reunioes-calendario')} className="flex items-center text-gray-500 hover:text-gray-800"><ArrowLeft size={20} className="mr-2" /> Voltar</button>
          <button onClick={handleSaveReuniao} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Save size={18} /> Salvar Ata</button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 flex justify-between items-center" style={{ borderLeft: `6px solid ${reuniao.cor}` }}>
            <div>
                <h1 className="text-2xl font-bold text-gray-800">{reuniao.titulo}</h1>
                <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Calendar size={14}/> {dataObj.toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Clock size={14}/> {dataObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-bold uppercase">{reuniao.tipo_reuniao}</span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
            <div className="flex flex-col gap-6 overflow-y-auto pr-2">
                
                {/* --- PLAYER DE ÁUDIO --- */}
                {reuniao.audio_url && (
                    <div className="bg-slate-800 p-4 rounded-xl shadow-md text-white flex items-center gap-4">
                        <div className="bg-white/10 p-3 rounded-full"><Play size={20} fill="currentColor"/></div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-300 uppercase mb-1">Gravação da Reunião</p>
                            <audio controls src={reuniao.audio_url} className="w-full h-8" />
                        </div>
                    </div>
                )}

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex-1">
                    <h3 className="font-bold text-gray-700 mb-2">📋 Pauta (Resumo IA)</h3>
                    <textarea className="w-full h-32 p-3 bg-gray-50 rounded border border-gray-200 text-sm focus:outline-blue-500" value={reuniao.pauta || ''} onChange={e => setReuniao({...reuniao, pauta: e.target.value})} />
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex-1">
                    <h3 className="font-bold text-gray-700 mb-2">✍️ Ata da Reunião</h3>
                    <textarea className="w-full h-64 p-3 bg-yellow-50 rounded border border-yellow-200 text-sm focus:outline-yellow-500" value={reuniao.ata || ''} onChange={e => setReuniao({...reuniao, ata: e.target.value})} />
                </div>
            </div>

            <div className="bg-red-50 p-5 rounded-xl border border-red-100 flex flex-col h-full overflow-hidden">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-red-800 flex items-center gap-2"><AlertCircle size={20}/> Pendências ({reuniao.tipo_reuniao})</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                    {acoesPendentes.length === 0 && <p className="text-center text-gray-400 text-sm mt-10">Nenhuma pendência.</p>}
                    {acoesPendentes.map(acao => (
                        <div key={acao.id} className="bg-white p-3 rounded-lg shadow-sm border border-red-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{acao.descricao}</p>
                                    <div className="flex gap-2 mt-1 text-xs text-gray-500">
                                        <span className="bg-blue-100 text-blue-700 px-1.5 rounded">{acao.responsavel}</span>
                                        <span>{new Date(acao.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <button onClick={() => handleConcluirAcao(acao.id)} className="text-green-500 hover:bg-green-50 p-1 rounded"><CheckCircle size={18}/></button>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                                {acao.evidencia_url ? (<a href={acao.evidencia_url} target="_blank" className="text-xs text-blue-600 flex items-center gap-1 hover:underline"><ExternalLink size={12}/> Ver Evidência</a>) : (<span className="text-xs text-gray-400">Sem evidência</span>)}
                                <label className="cursor-pointer text-gray-400 hover:text-blue-500 flex items-center gap-1 text-xs"><Camera size={14}/> {uploading ? '...' : 'Anexar'} <input type="file" className="hidden" onChange={(e) => handleUpload(acao.id, e.target.files[0])} /></label>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="bg-white p-3 rounded-lg border border-red-200">
                    <div className="flex gap-2 mb-2">
                        <input className="flex-1 p-2 border border-gray-200 rounded text-sm" placeholder="O que precisa ser feito?" value={novaAcao.descricao} onChange={e => setNovaAcao({...novaAcao, descricao: e.target.value})} />
                        <input className="w-1/3 p-2 border border-gray-200 rounded text-sm" placeholder="Responsável" value={novaAcao.responsavel} onChange={e => setNovaAcao({...novaAcao, responsavel: e.target.value})} />
                    </div>
                    <button onClick={handleCriarAcao} className="w-full bg-red-600 text-white py-1.5 rounded text-sm font-bold hover:bg-red-700">+ Adicionar Pendência</button>
                </div>
            </div>
        </div>
      </div>
    </Layout>
  );
};
export default DetalheReuniao;

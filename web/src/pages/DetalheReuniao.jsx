import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Save, Calendar, Clock, User, Trash2 } from 'lucide-react';

const DetalheReuniao = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Estado do formulário
  const [form, setForm] = useState({
    titulo: '',
    data: '',
    hora: '',
    responsavel: '',
    area_id: '',
    status: 'Agendada',
    pauta: '',
    ata: ''
  });

  const [areas, setAreas] = useState([]);

  useEffect(() => {
    fetchDados();
  }, [id]);

  const fetchDados = async () => {
    try {
      // Carrega Áreas para o select
      const { data: areasData } = await supabase.from('areas').select('*').eq('ativa', true);
      setAreas(areasData || []);

      // Carrega Reunião
      const { data: reuniao, error } = await supabase
        .from('reunioes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (reuniao) {
        const dataObj = new Date(reuniao.data_hora);
        setForm({
          titulo: reuniao.titulo,
          data: dataObj.toISOString().split('T')[0],
          hora: dataObj.toTimeString().split(' ')[0].substring(0, 5),
          responsavel: reuniao.responsavel || '',
          area_id: reuniao.area_id || '',
          status: reuniao.status,
          pauta: reuniao.pauta || '',
          ata: reuniao.ata || ''
        });
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao carregar reunião.');
      navigate('/reunioes-periodicas');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Monta o timestamp
      const dataHoraCombined = new Date(`${form.data}T${form.hora}:00`);

      const { error } = await supabase
        .from('reunioes')
        .update({
          titulo: form.titulo,
          data_hora: dataHoraCombined,
          responsavel: form.responsavel,
          area_id: form.area_id || null,
          status: form.status,
          pauta: form.pauta,
          ata: form.ata
        })
        .eq('id', id);

      if (error) throw error;
      alert('Reunião salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta reunião?')) return;
    try {
        await supabase.from('reunioes').delete().eq('id', id);
        navigate('/reunioes-periodicas');
    } catch (error) {
        console.error(error);
    }
  };

  if (loading) return <Layout><div className="p-10 text-center">Carregando...</div></Layout>;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto h-full flex flex-col font-sans">
        
        {/* Header de Navegação */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/reunioes-periodicas')} className="flex items-center text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft size={20} className="mr-2" /> Voltar para lista
          </button>
          
          <div className="flex items-center gap-3">
             <button onClick={handleDelete} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                <Trash2 size={20} />
             </button>
             <button 
                onClick={handleSave} 
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50"
             >
                <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
             </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
            
            {/* Barra Superior: Dados Principais */}
            <div className="p-6 border-b border-gray-100 bg-gray-50 grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-8">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Título da Reunião</label>
                    <input 
                        type="text" 
                        value={form.titulo}
                        onChange={e => setForm({...form, titulo: e.target.value})}
                        className="w-full text-2xl font-bold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none pb-1 placeholder-gray-300"
                        placeholder="Ex: Reunião Semanal..."
                    />
                </div>
                
                <div className="md:col-span-4 flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Status</label>
                        <select 
                            value={form.status}
                            onChange={e => setForm({...form, status: e.target.value})}
                            className={`w-full p-2 rounded-lg text-sm font-semibold border ${
                                form.status === 'Realizada' ? 'bg-green-50 text-green-700 border-green-200' :
                                form.status === 'Cancelada' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                        >
                            <option value="Agendada">Agendada</option>
                            <option value="Realizada">Realizada</option>
                            <option value="Cancelada">Cancelada</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Campos Secundários */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 bg-white border-b border-gray-100">
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1"><Calendar size={14}/> Data</label>
                    <input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-100 outline-none text-gray-700" />
                </div>
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1"><Clock size={14}/> Horário</label>
                    <input type="time" value={form.hora} onChange={e => setForm({...form, hora: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-100 outline-none text-gray-700" />
                </div>
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1"><User size={14}/> Responsável</label>
                    <input type="text" value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-100 outline-none text-gray-700" placeholder="Nome..." />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Área Relacionada</label>
                    <select value={form.area_id} onChange={e => setForm({...form, area_id: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-100 outline-none text-gray-700">
                        <option value="">Sem vínculo</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                </div>
            </div>

            {/* Editores de Texto */}
            <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto">
                <div className="flex flex-col h-full">
                    <h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                        📋 Pauta <span className="text-xs font-normal text-gray-400">(O que será discutido)</span>
                    </h3>
                    <textarea 
                        value={form.pauta}
                        onChange={e => setForm({...form, pauta: e.target.value})}
                        className="flex-1 w-full p-4 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm text-gray-700 leading-relaxed"
                        placeholder="- Tópico 1&#10;- Tópico 2&#10;- Tópico 3..."
                    ></textarea>
                </div>

                <div className="flex flex-col h-full">
                    <h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                        ✅ Ata & Ações <span className="text-xs font-normal text-gray-400">(Decisões tomadas)</span>
                    </h3>
                    <textarea 
                        value={form.ata}
                        onChange={e => setForm({...form, ata: e.target.value})}
                        className="flex-1 w-full p-4 border border-gray-200 rounded-lg bg-yellow-50/30 focus:bg-white focus:ring-2 focus:ring-yellow-100 outline-none resize-none text-sm text-gray-700 leading-relaxed"
                        placeholder="Resumo do que foi decidido e próximos passos..."
                    ></textarea>
                </div>
            </div>

        </div>
      </div>
    </Layout>
  );
};

export default DetalheReuniao;

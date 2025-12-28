import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { CheckCircle, ExternalLink, Search } from 'lucide-react';

const GestaoAcoes = () => {
  const [acoes, setAcoes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados dos Filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todas'); // Todas, Aberta, Concluída
  const [filtroResponsavel, setFiltroResponsavel] = useState('Todos');
  const [filtroOrigem, setFiltroOrigem] = useState('Todas');

  // Listas para os Selects (Preenchidas dinamicamente)
  const [listaResponsaveis, setListaResponsaveis] = useState([]);
  const [listaOrigens, setListaOrigens] = useState([]);

  useEffect(() => {
    fetchAcoes();
  }, []);

  const fetchAcoes = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('acoes')
      .select('*')
      .order('data_criacao', { ascending: false });

    if (error) {
      console.error('Erro ao buscar ações:', error);
      setAcoes([]);
      setLoading(false);
      return;
    }

    if (data) {
      setAcoes(data);
      // Extrair valores únicos para os filtros (se no futuro tiver tipo_reuniao na tabela)
      const resps = [...new Set(data.map(item => item.responsavel).filter(Boolean))].sort();
      const origens = [...new Set(data.map(item => item.tipo_reuniao).filter(Boolean))].sort();
      setListaResponsaveis(resps);
      setListaOrigens(origens);
    }

    setLoading(false);
  };

  const handleConcluir = async (id) => {
    if (!confirm("Marcar ação como concluída?")) return;
    await supabase
      .from('acoes')
      .update({ status: 'Concluída', data_conclusao: new Date().toISOString() })
      .eq('id', id);
    fetchAcoes();
  };

  // regra: só pode concluir se tiver resultado preenchido e pelo menos 1 foto
  const podeConcluirAcao = (acao) => {
    const temResultado = (acao.resultado || '').trim().length > 0;
    const temEvidencia = Array.isArray(acao.fotos) && acao.fotos.length > 0;
    return temResultado && temEvidencia && acao.status !== 'Concluída';
  };

  // Lógica de Filtragem
  const acoesFiltradas = useMemo(() => {
    return acoes.filter(acao => {
      // 1. Texto (Descrição)
      const matchTexto = (acao.descricao || '')
        .toLowerCase()
        .includes(filtroTexto.toLowerCase());
      
      // 2. Status
      const matchStatus =
        filtroStatus === 'Todas' ? true : acao.status === filtroStatus;

      // 3. Responsável
      const matchResp =
        filtroResponsavel === 'Todos' ? true : acao.responsavel === filtroResponsavel;

      // 4. Origem (se um dia tiver tipo_reuniao na tabela)
      const matchOrigem =
        filtroOrigem === 'Todas' ? true : acao.tipo_reuniao === filtroOrigem;

      return matchTexto && matchStatus && matchResp && matchOrigem;
    });
  }, [acoes, filtroTexto, filtroStatus, filtroResponsavel, filtroOrigem]);

  return (
    <Layout>
      <div className="p-8 h-full font-sans flex flex-col bg-gray-50">
        
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800">Central de Ações e Pendências</h1>
          <div className="text-sm text-gray-500">
            Total: <b>{acoesFiltradas.length}</b> ações encontradas
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          
          {/* Busca Texto */}
          <div className="col-span-2">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Buscar Descrição</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Digite para buscar..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>

          {/* Filtro Status */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Status</label>
            <select 
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none"
            >
              <option value="Todas">Todos</option>
              <option value="Aberta">Aberta</option>
              <option value="Concluída">Concluída</option>
            </select>
          </div>

          {/* Filtro Responsável */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Responsável</label>
            <select 
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none"
            >
              <option value="Todos">Todos</option>
              {listaResponsaveis.map(resp => (
                <option key={resp} value={resp}>{resp}</option>
              ))}
            </select>
          </div>

          {/* Filtro Origem (por enquanto vai ficar vazio até ligarmos com a tabela de reuniões) */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Origem (Reunião)</label>
            <select 
              value={filtroOrigem}
              onChange={(e) => setFiltroOrigem(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none"
            >
              <option value="Todas">Todas</option>
              {listaOrigens.map(origem => (
                <option key={origem} value={origem}>{origem}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="p-4 w-24">Status</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4 w-48">Responsável</th>
                  <th className="p-4 w-48">Origem</th>
                  <th className="p-4 w-32">Data</th>
                  <th className="p-4 w-24 text-center">Evidência</th>
                  <th className="p-4 w-20 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                ) : acoesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-gray-400">
                      Nenhuma ação encontrada.
                    </td>
                  </tr>
                ) : (
                  acoesFiltradas.map(acao => {
                    const temFotos = Array.isArray(acao.fotos) && acao.fotos.length > 0;
                    const primeiraFoto = temFotos ? acao.fotos[0] : null;
                    const podeConcluir = podeConcluirAcao(acao);
                    const dataBase = acao.data_criacao || acao.created_at;

                    return (
                      <tr key={acao.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold border ${
                              acao.status === 'Concluída'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {acao.status || 'Aberta'}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-gray-800">
                          {acao.descricao}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 uppercase border border-gray-200">
                              {acao.responsavel?.charAt(0)}
                            </div>
                            <span className="text-gray-600">{acao.responsavel}</span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-500 text-xs font-mono bg-gray-50/50 rounded px-2">
                          {acao.tipo_reuniao || 'Geral'}
                        </td>
                        <td className="p-4 text-gray-500 text-xs">
                          {dataBase ? new Date(dataBase).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-4 text-center">
                          {primeiraFoto ? (
                            <a
                              href={primeiraFoto}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex justify-center"
                              title="Ver Evidência"
                            >
                              <ExternalLink size={16} />
                            </a>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {acao.status !== 'Concluída' && (
                            <>
                              <button
                                onClick={() => podeConcluir && handleConcluir(acao.id)}
                                disabled={!podeConcluir}
                                className={`p-1.5 rounded-full transition-all ${
                                  podeConcluir
                                    ? 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                    : 'text-gray-300 cursor-not-allowed'
                                }`}
                                title={
                                  podeConcluir
                                    ? 'Concluir ação'
                                    : 'Só é possível concluir com resultado preenchido e evidência'
                                }
                              >
                                <CheckCircle size={20} />
                              </button>
                              {!podeConcluir && (
                                <span className="block text-[10px] text-red-400 mt-1">
                                  Preencha resultado e evidência
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default GestaoAcoes;

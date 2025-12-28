import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { CheckCircle, ExternalLink, Search } from 'lucide-react';

const GestaoAcoes = () => {
  const [acoes, setAcoes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [acaoSelecionada, setAcaoSelecionada] = useState(null);
  
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

      // Define uma ação selecionada inicial se ainda não houver
      if (!acaoSelecionada && data.length > 0) {
        setAcaoSelecionada(data[0]);
      }

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
    await fetchAcoes();
  };

  // regra: só pode concluir se tiver resultado preenchido e pelo menos 1 foto
  const podeConcluirAcao = (acao) => {
    if (!acao) return false;
    const temResultado = (acao.resultado || '').trim().length > 0;
    const temEvidencia = Array.isArray(acao.fotos) && acao.fotos.length > 0;
    return temResultado && temEvidencia && acao.status !== 'Concluída';
  };

  // Lógica de Filtragem
  const acoesFiltradas = useMemo(() => {
    return acoes.filter(acao => {
      const matchTexto = (acao.descricao || '')
        .toLowerCase()
        .includes(filtroTexto.toLowerCase());
      
      const matchStatus =
        filtroStatus === 'Todas' ? true : acao.status === filtroStatus;

      const matchResp =
        filtroResponsavel === 'Todos' ? true : acao.responsavel === filtroResponsavel;

      const matchOrigem =
        filtroOrigem === 'Todas' ? true : acao.tipo_reuniao === filtroOrigem;

      return matchTexto && matchStatus && matchResp && matchOrigem;
    });
  }, [acoes, filtroTexto, filtroStatus, filtroResponsavel, filtroOrigem]);

  const acaoDetalhe = acaoSelecionada;
  const podeConcluirSelecionada = podeConcluirAcao(acaoDetalhe);

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

          {/* Filtro Origem */}
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

        {/* Tabela + Detalhes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          {/* Tabela */}
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
                      <tr
                        key={acao.id}
                        className={`hover:bg-blue-50/30 transition-colors group cursor-pointer ${
                          acaoSelecionada?.id === acao.id ? 'bg-blue-50/40' : ''
                        }`}
                        onClick={() => setAcaoSelecionada(acao)}
                      >
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
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
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
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {acao.status !== 'Concluída' && (
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
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Detalhes da Ação */}
          {acaoDetalhe && (
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-5 space-y-6">
              
              {/* PARTE DE CIMA - AÇÃO */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
                  Detalhes da Ação
                </h3>
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">
                      Ação
                    </span>
                    <p className="text-sm font-semibold text-gray-800">
                      {acaoDetalhe.descricao}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-[11px] text-gray-500 mt-1">
                    <span>
                      <strong className="font-semibold text-gray-600">Criação:</strong>{' '}
                      {acaoDetalhe.data_criacao
                        ? new Date(acaoDetalhe.data_criacao).toLocaleString()
                        : '-'}
                    </span>
                    <span>
                      <strong className="font-semibold text-gray-600">Vencimento:</strong>{' '}
                      {acaoDetalhe.data_vencimento
                        ? new Date(acaoDetalhe.data_vencimento).toLocaleDateString()
                        : '-'}
                    </span>
                    <span>
                      <strong className="font-semibold text-gray-600">Responsável:</strong>{' '}
                      {acaoDetalhe.responsavel || '-'}
                    </span>
                  </div>

                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">
                      Observações
                    </span>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">
                      {acaoDetalhe.observacao || 'Sem observações registradas.'}
                    </p>
                  </div>

                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">
                      Evidências
                    </span>
                    {Array.isArray(acaoDetalhe.fotos) && acaoDetalhe.fotos.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {acaoDetalhe.fotos.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-16 h-16 rounded-md overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-100 hover:border-blue-400"
                            title={`Abrir evidência ${idx + 1}`}
                          >
                            <img
                              src={url}
                              alt={`Evidência ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">
                        Nenhuma evidência anexada à ação.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* PARTE DE BAIXO - CONCLUSÃO */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
                  Conclusão da Ação
                </h3>
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">
                      Observação do que foi realizado
                    </span>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">
                      {acaoDetalhe.resultado && acaoDetalhe.resultado.trim().length > 0
                        ? acaoDetalhe.resultado
                        : 'Ainda não foi registrada a conclusão desta ação.'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase">
                      Evidências do que foi feito
                    </span>
                    {Array.isArray(acaoDetalhe.fotos) && acaoDetalhe.fotos.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {acaoDetalhe.fotos.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-16 h-16 rounded-md overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-100 hover:border-blue-400"
                            title={`Abrir evidência ${idx + 1}`}
                          >
                            <img
                              src={url}
                              alt={`Evidência ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">
                        Nenhuma evidência vinculada à conclusão.
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex justify-end">
                    {acaoDetalhe.status === 'Concluída' ? (
                      <span className="text-xs font-semibold text-green-600">
                        Ação já finalizada em fluxo anterior.
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          podeConcluirSelecionada && handleConcluir(acaoDetalhe.id)
                        }
                        disabled={!podeConcluirSelecionada}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                          podeConcluirSelecionada
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle size={16} />
                        Finalizar ação
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default GestaoAcoes;

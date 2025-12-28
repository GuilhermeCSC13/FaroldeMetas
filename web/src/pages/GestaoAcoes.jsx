// src/pages/GestaoAcoes.jsx
import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/tatico/Layout';
import { supabase } from '../supabaseClient';
import { CheckCircle, ExternalLink, Search } from 'lucide-react';
import ModalDetalhesAcao from '../components/tatico/ModalDetalhesAcao';

const GestaoAcoes = () => {
  const [acoes, setAcoes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [acaoSelecionada, setAcaoSelecionada] = useState(null);
  const [showModalDetalhes, setShowModalDetalhes] = useState(false);
  
  // Filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todas'); // Todas, Pendente, Vencida, Concluída
  const [filtroResponsavel, setFiltroResponsavel] = useState('Todos'); 
  const [filtroOrigem, setFiltroOrigem] = useState('Todas');

  // Listas para selects
  const [listaResponsaveis, setListaResponsaveis] = useState([]);
  const [listaOrigens, setListaOrigens] = useState([]);

  useEffect(() => {
    fetchAcoes();
  }, []);

  // --------- REGRAS DE STATUS ----------
  const getStatusAcao = (acao) => {
    if (!acao) return 'Pendente';

    if (acao.status === 'Concluída') return 'Concluída';

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (acao.data_vencimento) {
      const dt = new Date(acao.data_vencimento);
      dt.setHours(0, 0, 0, 0);
      if (dt < hoje) return 'Vencida';
    }

    return 'Pendente';
  };

  // Só pode concluir se tiver resultado + evidência de conclusão
  const podeConcluirAcao = (acao) => {
    if (!acao) return false;

    const temResultado = (acao.resultado || '').trim().length > 0;
    const evidenciasConclusao = Array.isArray(acao.fotos_conclusao)
      ? acao.fotos_conclusao
      : [];
    const temEvidenciaConclusao = evidenciasConclusao.length > 0;

    return temResultado && temEvidenciaConclusao && getStatusAcao(acao) !== 'Concluída';
  };

  // --------- BUSCA NO SUPABASE ----------
  const fetchAcoes = async (idParaManterSelecionado = null) => {
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

      // listas para filtros
      const resps = [...new Set(data.map(item => item.responsavel).filter(Boolean))].sort();
      const origens = [...new Set(data.map(item => item.tipo_reuniao).filter(Boolean))].sort();
      setListaResponsaveis(resps);
      setListaOrigens(origens);

      if (idParaManterSelecionado) {
        const encontrada = data.find(a => a.id === idParaManterSelecionado);
        setAcaoSelecionada(encontrada || null);
      } else if (acaoSelecionada) {
        const encontrada = data.find(a => a.id === acaoSelecionada.id);
        setAcaoSelecionada(encontrada || null);
      }
    }

    setLoading(false);
  };

  const handleConcluir = async (id) => {
    if (!confirm('Marcar ação como concluída?')) return;

    await supabase
      .from('acoes')
      .update({ status: 'Concluída', data_conclusao: new Date().toISOString() })
      .eq('id', id);

    await fetchAcoes(id);
    setShowModalDetalhes(false);
  };

  // --------- FILTRAGEM ----------
  const acoesFiltradas = useMemo(() => {
    return acoes.filter(acao => {
      const statusCalculado = getStatusAcao(acao);

      const matchTexto = (acao.descricao || '')
        .toLowerCase()
        .includes(filtroTexto.toLowerCase());
      
      const matchStatus =
        filtroStatus === 'Todas' ? true : statusCalculado === filtroStatus;

      const matchResp =
        filtroResponsavel === 'Todos' ? true : acao.responsavel === filtroResponsavel;

      const matchOrigem =
        filtroOrigem === 'Todas' ? true : acao.tipo_reuniao === filtroOrigem;

      return matchTexto && matchStatus && matchResp && matchOrigem;
    });
  }, [acoes, filtroTexto, filtroStatus, filtroResponsavel, filtroOrigem]);

  // --------- CARDS RESUMO ----------
  const cardsResumo = useMemo(() => {
    let pendente = 0;
    let vencida = 0;
    let concluida = 0;

    acoesFiltradas.forEach(a => {
      const s = getStatusAcao(a);
      if (s === 'Concluída') concluida++;
      else if (s === 'Vencida') vencida++;
      else pendente++;
    });

    return { pendente, vencida, concluida };
  }, [acoesFiltradas]);

  const abrirModalDetalhes = (acao) => {
    setAcaoSelecionada(acao);
    setShowModalDetalhes(true);
  };

  const fecharModalDetalhes = () => {
    setShowModalDetalhes(false);
  };

  const acaoDetalhe = acaoSelecionada;
  const statusDetalhe = acaoDetalhe ? getStatusAcao(acaoDetalhe) : 'Pendente';
  const podeConcluirSelecionada = podeConcluirAcao(acaoDetalhe);

  return (
    <Layout>
      <div className="p-8 h-full font-sans flex flex-col bg-gray-50">
        
        {/* Header */}
        <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800">Central de Ações e Pendências</h1>
          <div className="text-sm text-gray-500">
            Total: <b>{acoesFiltradas.length}</b> ações encontradas
          </div>
        </div>

        {/* Cards Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <div className="text-xs text-yellow-700 font-bold uppercase">Pendente</div>
            <div className="text-2xl font-bold text-yellow-900">
              {cardsResumo.pendente}
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="text-xs text-red-700 font-bold uppercase">Vencida</div>
            <div className="text-2xl font-bold text-red-900">
              {cardsResumo.vencida}
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="text-xs text-green-700 font-bold uppercase">Concluída</div>
            <div className="text-2xl font-bold text-green-900">
              {cardsResumo.concluida}
            </div>
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
              <option value="Pendente">Pendente</option>
              <option value="Vencida">Vencida</option>
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
                    const statusCalculado = getStatusAcao(acao);

                    const evidenciasAcao = Array.isArray(acao.fotos_acao)
                      ? acao.fotos_acao
                      : Array.isArray(acao.fotos)
                        ? acao.fotos
                        : [];
                    const evidenciasConclusao = Array.isArray(acao.fotos_conclusao)
                      ? acao.fotos_conclusao
                      : [];

                    const temFotos = evidenciasAcao.length > 0 || evidenciasConclusao.length > 0;
                    const primeiraFoto = temFotos
                      ? (evidenciasConclusao[0] || evidenciasAcao[0])
                      : null;

                    const dataBase = acao.data_criacao || acao.created_at;

                    return (
                      <tr
                        key={acao.id}
                        className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                        onClick={() => abrirModalDetalhes(acao)}
                      >
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold border ${
                              statusCalculado === 'Concluída'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : statusCalculado === 'Vencida'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}
                          >
                            {statusCalculado}
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
                          {statusCalculado !== 'Concluída' && (
                            <button
                              onClick={() => abrirModalDetalhes(acao)}
                              className="p-1.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                              title="Ver detalhes / concluir"
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
        </div>

        {/* MODAL REUTILIZÁVEL */}
        <ModalDetalhesAcao
          aberto={showModalDetalhes}
          acao={acaoDetalhe}
          status={statusDetalhe}
          podeConcluir={podeConcluirSelecionada}
          onClose={fecharModalDetalhes}
          onConcluir={() => acaoDetalhe && podeConcluirSelecionada && handleConcluir(acaoDetalhe.id)}
        />
      </div>
    </Layout>
  );
};

export default GestaoAcoes;

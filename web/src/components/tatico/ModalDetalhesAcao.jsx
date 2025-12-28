// src/components/tatico/ModalDetalhesAcao.jsx
import React from 'react';
import { CheckCircle, X } from 'lucide-react';

const ModalDetalhesAcao = ({
  aberto,
  acao,
  status,
  podeConcluir,
  onClose,
  onConcluir,
}) => {
  if (!aberto || !acao) return null;

  // Evidências da criação/registro da ação
  const evidenciasAcao = Array.isArray(acao.fotos_acao)
    ? acao.fotos_acao
    : Array.isArray(acao.fotos)
      ? acao.fotos
      : [];

  // Evidências específicas de conclusão
  const evidenciasConclusao = Array.isArray(acao.fotos_conclusao)
    ? acao.fotos_conclusao
    : [];

  const dataCriacao =
    acao.data_criacao || acao.created_at
      ? new Date(acao.data_criacao || acao.created_at).toLocaleString()
      : '-';

  const dataVencimento = acao.data_vencimento
    ? new Date(acao.data_vencimento).toLocaleDateString()
    : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-400">
              Detalhes da ação
            </div>
            <div className="text-sm font-semibold text-gray-800 truncate max-w-xl">
              {acao.descricao}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6 bg-gray-50">
          
          {/* PARTE DE CIMA - AÇÃO */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
              Ação
            </h3>
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
              <div className="flex flex-wrap gap-4 text-[11px] text-gray-500 mt-1">
                <span>
                  <strong className="font-semibold text-gray-600">Status:</strong>{' '}
                  {status}
                </span>
                <span>
                  <strong className="font-semibold text-gray-600">Criação:</strong>{' '}
                  {dataCriacao}
                </span>
                <span>
                  <strong className="font-semibold text-gray-600">Vencimento:</strong>{' '}
                  {dataVencimento}
                </span>
                <span>
                  <strong className="font-semibold text-gray-600">Responsável:</strong>{' '}
                  {acao.responsavel || '-'}
                </span>
              </div>

              <div className="mt-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">
                  Observações
                </span>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">
                  {acao.observacao || 'Sem observações registradas.'}
                </p>
              </div>

              <div className="mt-3">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">
                  Evidências (registro da ação)
                </span>
                {evidenciasAcao.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {evidenciasAcao.map((url, idx) => (
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
                  {acao.resultado && acao.resultado.trim().length > 0
                    ? acao.resultado
                    : 'Ainda não foi registrada a conclusão desta ação.'}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase">
                  Evidências do que foi feito
                </span>
                {evidenciasConclusao.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {evidenciasConclusao.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-16 h-16 rounded-md overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-100 hover:border-blue-400"
                        title={`Abrir evidência de conclusão ${idx + 1}`}
                      >
                        <img
                          src={url}
                          alt={`Evidência de conclusão ${idx + 1}`}
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
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Para finalizar, é obrigatório informar a conclusão e anexar evidências de conclusão.
          </span>
          {status === 'Concluída' ? (
            <span className="text-xs font-semibold text-green-600">
              Ação já finalizada.
            </span>
          ) : (
            <button
              onClick={onConcluir}
              disabled={!podeConcluir}
              className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                podeConcluir
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
  );
};

export default ModalDetalhesAcao;

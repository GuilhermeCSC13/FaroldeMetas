// src/components/tatico/ParticipantesTipoReuniao.tsx
import React, { useEffect, useState } from "react";
import { Plus, Trash2, Users, AlertCircle, Loader } from "lucide-react";
import { supabase, supabaseInove } from "../../supabaseClient";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  cargo?: string;
}

interface ParticipantePadrao {
  id: string;
  tipo_reuniao_id: string;
  usuario_id: string;
  nome: string;
  email: string;
  cargo?: string;
  created_at: string;
}

interface ParticipantesTipoReuniaoProps {
  tipoReuniaoId: string;
  tipoReuniaoNome: string;
  editavel?: boolean;
}

export default function ParticipantesTipoReuniao({
  tipoReuniaoId,
  tipoReuniaoNome,
  editavel = false,
}: ParticipantesTipoReuniaoProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [participantes, setParticipantes] = useState<ParticipantePadrao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [adicionando, setAdicionando] = useState(false);

  // Carregar dados ao montar
  useEffect(() => {
    carregarDados();
  }, [tipoReuniaoId]);

  const carregarDados = async () => {
    setLoading(true);
    setError(null);

    try {
      // Carregar usuários do supabaseInove
      const { data: usuariosData, error: usuariosError } = await supabaseInove
        .from("usuarios_aprovadores")
        .select("id, nome, email, cargo")
        .order("nome", { ascending: true });

      if (usuariosError) throw new Error(`Erro ao carregar usuários: ${usuariosError.message}`);

      setUsuarios(usuariosData || []);

      // Carregar participantes padrão do tipo de reunião
      const { data: participantesData, error: participantesError } = await supabase
        .from("participantes_tipo_reuniao")
        .select("id, tipo_reuniao_id, usuario_id, nome, email, cargo, created_at")
        .eq("tipo_reuniao_id", tipoReuniaoId)
        .order("nome", { ascending: true });

      if (participantesError) throw new Error(`Erro ao carregar participantes: ${participantesError.message}`);

      setParticipantes(participantesData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const adicionarParticipante = async (usuario: Usuario) => {
    if (participantes.some((p) => p.usuario_id === usuario.id)) {
      setError("Este usuário já está na lista");
      return;
    }

    setAdicionando(true);
    try {
      const { data, error } = await supabase
        .from("participantes_tipo_reuniao")
        .insert({
          tipo_reuniao_id: tipoReuniaoId,
          usuario_id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          cargo: usuario.cargo || null,
        })
        .select();

      if (error) throw error;

      setParticipantes([...participantes, data[0]]);
      setSearchTerm("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar participante");
      console.error(err);
    } finally {
      setAdicionando(false);
    }
  };

  const removerParticipante = async (participanteId: string) => {
    try {
      const { error } = await supabase
        .from("participantes_tipo_reuniao")
        .delete()
        .eq("id", participanteId);

      if (error) throw error;

      setParticipantes(participantes.filter((p) => p.id !== participanteId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover participante");
      console.error(err);
    }
  };

  const usuariosDisponiveis = usuarios.filter(
    (u) => !participantes.some((p) => p.usuario_id === u.id)
  );

  const usuariosFiltrados = usuariosDisponiveis.filter((u) =>
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center gap-2">
        <Users size={20} className="text-blue-600" />
        <h3 className="font-bold text-slate-800">Participantes Padrão</h3>
        <span className="ml-auto text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
          {participantes.length}
        </span>
      </div>

      {/* MENSAGEM DE ERRO */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* MODO VISUALIZAÇÃO */}
      {!editavel ? (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 text-center">
              <Loader className="animate-spin mx-auto text-slate-400 mb-2" size={24} />
              <p className="text-slate-400">Carregando...</p>
            </div>
          ) : participantes.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              Nenhum participante padrão definido
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {participantes.map((participante) => (
                <div key={participante.id} className="p-3 hover:bg-slate-50">
                  <p className="font-medium text-slate-800">{participante.nome}</p>
                  <p className="text-xs text-slate-500">{participante.email}</p>
                  {participante.cargo && (
                    <p className="text-xs text-slate-600 mt-1">{participante.cargo}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* MODO EDIÇÃO */
        <div className="space-y-4">
          {/* SEÇÃO DE ADIÇÃO */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="text-sm font-bold text-slate-700">Adicionar Participante</div>

            {/* BUSCA */}
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading || adicionando}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100"
            />

            {/* LISTA DE USUÁRIOS DISPONÍVEIS */}
            {searchTerm && (
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {loading ? (
                  <div className="p-3 text-center text-slate-400 text-sm">Carregando...</div>
                ) : usuariosFiltrados.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-sm">
                    {usuariosDisponiveis.length === 0
                      ? "Todos os usuários já foram adicionados"
                      : "Nenhum usuário encontrado"}
                  </div>
                ) : (
                  usuariosFiltrados.map((usuario) => (
                    <div
                      key={usuario.id}
                      className="p-3 border-b border-slate-100 hover:bg-slate-100 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{usuario.nome}</p>
                        <p className="text-xs text-slate-500 truncate">{usuario.email}</p>
                        {usuario.cargo && (
                          <p className="text-xs text-slate-600">{usuario.cargo}</p>
                        )}
                      </div>
                      <button
                        onClick={() => adicionarParticipante(usuario)}
                        disabled={adicionando}
                        className="ml-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors flex-shrink-0"
                        title="Adicionar"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* LISTA DE PARTICIPANTES */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-6 text-center">
                <Loader className="animate-spin mx-auto text-slate-400 mb-2" size={24} />
                <p className="text-slate-400">Carregando...</p>
              </div>
            ) : participantes.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                Nenhum participante adicionado
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {participantes.map((participante) => (
                  <div
                    key={participante.id}
                    className="p-3 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800">{participante.nome}</p>
                      <p className="text-xs text-slate-500">{participante.email}</p>
                      {participante.cargo && (
                        <p className="text-xs text-slate-600">{participante.cargo}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removerParticipante(participante.id)}
                      disabled={adicionando}
                      className="ml-2 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors flex-shrink-0"
                      title="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

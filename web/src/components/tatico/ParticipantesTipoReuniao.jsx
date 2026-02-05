import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { Search, Plus, Trash2, Users, Loader2 } from "lucide-react";

/**
 * Componente de Participantes para Tipo de Reunião
 * - Gerencia participantes padrão de um tipo de reunião
 * - Permite adicionar/remover participantes
 * - Recebe usuários aprovadores para busca
 */
function ParticipantesTipoReuniao({ tipoId, editavel = false, usuariosAprovadores = [] }) {
  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (tipoId) fetchParticipantes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoId]);

  const fetchParticipantes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("participantes_tipo_reuniao")
        .select("*")
        .eq("tipo_reuniao_id", tipoId)
        .order("nome", { ascending: true });

      if (error) {
        console.warn("Erro ao carregar participantes_tipo_reuniao:", error.message);
        setParticipantes([]);
        return;
      }

      setParticipantes(data || []);
    } finally {
      setLoading(false);
    }
  };

  const adicionar = async (usuario) => {
    if (!tipoId || !usuario?.id) return;

    // Dedupe por usuario_id
    if (participantes.some((p) => String(p.usuario_id) === String(usuario.id))) return;

    const payload = {
      tipo_reuniao_id: tipoId,
      usuario_id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
    };

    try {
      const { data, error } = await supabase
        .from("participantes_tipo_reuniao")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn("Erro ao inserir participante:", error.message);
        alert("Erro ao adicionar participante.");
        return;
      }

      setParticipantes((prev) => [...prev, data]);
      setBusca("");
    } catch (err) {
      console.error(err);
      alert("Erro ao adicionar participante.");
    }
  };

  const remover = async (id) => {
    try {
      const { error } = await supabase
        .from("participantes_tipo_reuniao")
        .delete()
        .eq("id", id);

      if (error) {
        console.warn("Erro ao remover participante:", error.message);
        alert("Erro ao remover participante.");
        return;
      }

      setParticipantes((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      alert("Erro ao remover participante.");
    }
  };

  const usuariosFiltrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return [];

    return (usuariosAprovadores || [])
      .filter((u) => {
        if (!u?.id) return false;

        // Não mostrar quem já está adicionado
        const jaExiste = participantes.some((p) => String(p.usuario_id) === String(u.id));
        if (jaExiste) return false;

        const nome = String(u?.nome || "").toLowerCase();
        const email = String(u?.email || "").toLowerCase();

        return nome.includes(term) || email.includes(term);
      })
      .slice(0, 5);
  }, [usuariosAprovadores, participantes, busca]);

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
          <Users size={14} /> Participantes Padrão
          <span className="bg-gray-100 text-gray-600 px-1.5 rounded-full ml-1">
            {participantes.length}
          </span>
        </label>
      </div>

      {editavel && (
        <div className="relative mb-3">
          <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-100">
            <div className="pl-2 text-gray-400">
              <Search size={14} />
            </div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome ou email para adicionar..."
              className="w-full text-sm p-2 outline-none"
            />
          </div>

          {busca.length > 0 && usuariosFiltrados.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden">
              {usuariosFiltrados.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => adicionar(u)}
                  className="w-full text-left p-2 hover:bg-blue-50 text-sm flex justify-between items-center group border-b border-gray-50 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-gray-700 truncate">{u.nome}</div>
                    <div className="text-[10px] text-gray-400 truncate">{u.email}</div>
                  </div>
                  <Plus size={14} className="text-blue-600 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {busca.length > 0 && usuariosFiltrados.length === 0 && (
            <div className="mt-2 text-[11px] text-gray-400">
              Nenhum usuário encontrado (ou já adicionado).
            </div>
          )}
        </div>
      )}

      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-center py-2">
            <Loader2 className="animate-spin mx-auto text-gray-400" size={16} />
          </div>
        ) : participantes.length === 0 ? (
          <div className="text-xs text-gray-400 italic text-center p-2 border border-dashed rounded bg-gray-50">
            Nenhum participante fixo definido.
          </div>
        ) : (
          participantes.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between bg-white p-2 rounded border border-gray-200 shadow-sm"
            >
              <div className="min-w-0 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {String(p.nome || "?").charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{p.nome || "-"}</p>
                  <p className="text-[10px] text-gray-500 truncate">{p.email || "-"}</p>
                </div>
              </div>

              {editavel && (
                <button
                  type="button"
                  onClick={() => remover(p.id)}
                  className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                  title="Remover"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ParticipantesTipoReuniao;

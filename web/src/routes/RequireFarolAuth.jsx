import { useEffect } from "react";
import { Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function hasStoredExternalUser() {
  try {
    const v = localStorage.getItem("usuario_externo");
    if (!v) return false;
    const p = JSON.parse(v);
    return !!(p && (p.nome || p.login));
  } catch {
    return false;
  }
}

export default function RequireFarolAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const userDataParam = params.get("userData");

  // 🔴 CORREÇÃO CRÍTICA:
  // Se existir "userData" na URL, NÃO deixe entrar na rota protegida (ex: /inicio)
  // mesmo que tenha alguém logado no storage.
  // Mande para o Landing (/) processar a troca de usuário primeiro.
  if (userDataParam) {
    // Redireciona para a raiz mantendo os parâmetros de URL para o LandingFarol ler
    return <Navigate to={`/${location.search}`} replace />;
  }

  useEffect(() => {
    const run = async () => {
      // 1. Verifica localStorage
      if (hasStoredExternalUser()) return;

      // 2. Verifica Supabase
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) return;
      } catch {}

      // 3. Se não tiver login, redireciona para o Landing
      const sp = new URLSearchParams();
      if (location.pathname !== "/") {
        sp.set("next", location.pathname + location.search);
      }
      navigate(`/?${sp.toString()}`, { replace: true });
    };

    run();
  }, [location, navigate]);

  return <Outlet />;
}

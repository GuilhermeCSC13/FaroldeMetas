// src/routes/RequireFarolAuth.jsx
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

  // 🔴 GUARDA DE INTEGRIDADE:
  // Se existir "userData" na URL, NÃO renderize a rota protegida ainda.
  // Mande para o Landing (Raiz) processar esse login novo primeiro.
  // Isso impede que o "Guilherme" (cache) seja mostrado quando o "Josue" (URL) está chegando.
  if (userDataParam) {
    return <Navigate to={`/${location.search}`} replace />;
  }

  useEffect(() => {
    const run = async () => {
      // 1. Verifica localStorage
      if (hasStoredExternalUser()) return;

      // 2. Verifica Supabase Auth
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) return;
      } catch {}

      // 3. Se falhar tudo, manda para o Landing com parâmetro 'next'
      const currentPath = location.pathname + location.search;
      const sp = new URLSearchParams();
      if (currentPath && currentPath !== "/") {
        sp.set("next", currentPath);
      }

      // Redireciona para o Landing
      navigate(`/?${sp.toString()}`, { replace: true });
    };

    run();
  }, [location, navigate]);

  // Enquanto verifica, renderiza o Outlet (ou um loading simples se preferir)
  // Mas o useEffect acima vai chutar se não estiver autenticado.
  return <Outlet />;
}

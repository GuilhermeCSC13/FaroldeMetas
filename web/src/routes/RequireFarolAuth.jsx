// src/routes/RequireFarolAuth.jsx
import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function hasStoredExternalUser() {
  try {
    const v = localStorage.getItem("usuario_externo");
    if (!v) return false;
    JSON.parse(v);
    return true;
  } catch {
    return false;
  }
}

export default function RequireFarolAuth() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      // ✅ 1) usuário externo já salvo => libera
      if (hasStoredExternalUser()) return;

      // ✅ 2) sessão supabase (se existir) => libera
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) return;
      } catch {}

      // ❌ aqui NÃO manda pro INOVE
      // ✅ manda pro Landing, preservando intenção
      const current = `${location.pathname}${location.search || ""}`;
      const sp = new URLSearchParams();
      if (current && current !== "/") sp.set("next", current);

      navigate(`/?${sp.toString()}`, { replace: true });
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return <Outlet />;
}

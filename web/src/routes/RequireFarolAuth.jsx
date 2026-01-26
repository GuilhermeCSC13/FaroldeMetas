// src/routes/RequireFarolAuth.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const FAROL_URL = "https://faroldemetas.onrender.com";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login";

function hasFromInove() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("from") === "inove";
  } catch {
    return false;
  }
}

function hasSessionFlag() {
  return sessionStorage.getItem("farol_ok") === "1";
}

export default function RequireFarolAuth({ children }) {
  const location = useLocation();

  useEffect(() => {
    // 1) Se veio do INOVE agora, marca sessão (vale para o resto das rotas)
    if (hasFromInove()) {
      sessionStorage.setItem("farol_ok", "1");

      // opcional: limpar o from=inove da URL para não sujar navegação
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("from");
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch {
        // ignore
      }

      return;
    }

    // 2) Se já está liberado nesta sessão, segue
    if (hasSessionFlag()) return;

    // 3) Caso contrário, manda para o login do INOVE, retornando para a rota atual do Farol
    const returnTo = `${FAROL_URL}${location.pathname}${location.search || ""}`;
    const redirect = encodeURIComponent(returnTo);
    window.location.replace(`${INOVE_LOGIN}?redirect=${redirect}`);
  }, [location.pathname, location.search]);

  // Enquanto valida/redireciona, não renderiza a página protegida
  return children;
}

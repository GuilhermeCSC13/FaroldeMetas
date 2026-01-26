import { useEffect } from "react";

const FAROL_HOME = "/inicio";

// ✅ Coloque a URL real do INOVE aqui
// (se preferir, use env: import.meta.env.VITE_INOVE_URL)
const INOVE_URL = "https://SEU-INOVE.onrender.com";

// ✅ Seu Farol
const FAROL_URL = "https://faroldemetas.onrender.com";

function getQueryParam(name) {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  } catch {
    return null;
  }
}

export default function LandingFarol() {
  useEffect(() => {
    // 1) Se veio um "sso" na URL, salva como token local (MVP)
    const sso = getQueryParam("sso");
    if (sso) {
      localStorage.setItem("FAROL_ACCESS_TOKEN", sso);

      // limpa a URL para não ficar com token exposto no histórico
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("sso");
      window.history.replaceState({}, "", cleanUrl.toString());
    }

    // 2) Se já tem token/local liberado, entra
    const token = localStorage.getItem("FAROL_ACCESS_TOKEN");
    if (token) {
      window.location.replace(FAROL_HOME);
      return;
    }

    // 3) Se não tem liberação, manda pro INOVE (login/portal) com returnTo
    const returnTo = encodeURIComponent(FAROL_URL);
    window.location.replace(`${INOVE_URL}/portal?returnTo=${returnTo}`);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-2xl px-8 py-6 shadow-sm text-slate-600">
        Validando acesso...
      </div>
    </div>
  );
}

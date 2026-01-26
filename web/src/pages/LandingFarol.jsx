import { useEffect } from "react";

const FAROL_HOME = "/inicio";
const FAROL_URL = "https://faroldemetas.onrender.com/";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login";

export default function LandingFarol() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");

    // ✅ Se não veio do INOVE, manda pro login do INOVE com redirect
    if (from !== "inove") {
      const redirect = encodeURIComponent(FAROL_URL);
      window.location.replace(`${INOVE_LOGIN}?redirect=${redirect}`);
      return;
    }

    // ✅ Se veio do INOVE, entra no Farol e limpa a URL (opcional)
    window.history.replaceState({}, "", "/");
    window.location.replace(FAROL_HOME);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-2xl px-8 py-6 shadow-sm text-slate-600">
        Validando acesso...
      </div>
    </div>
  );
}

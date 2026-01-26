import { useEffect } from "react";

const INOVE_LOGIN_URL = "https://inovequatai.onrender.com/login";
const FAROL_ORIGIN = "https://faroldemetas.onrender.com";

export default function LandingFarol() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const from = url.searchParams.get("from");

    // ✅ Se veio do INOVE, entra
    if (from === "inove") {
      window.location.replace("/inicio" + url.search); // preserva query se houver
      return;
    }

    // ✅ Se entrou direto: manda para INOVE login com redirect de volta
    const redirectBack = encodeURIComponent(`${FAROL_ORIGIN}/?from=inove`);
    window.location.replace(`${INOVE_LOGIN_URL}?redirect=${redirectBack}`);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-2xl px-8 py-6 shadow-sm text-slate-600">
        Validando acesso...
      </div>
    </div>
  );
}

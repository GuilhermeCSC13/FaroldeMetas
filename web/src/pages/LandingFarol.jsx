import { useEffect } from "react";

const INOVE_URL = "https://inovequatai.onrender.com"; // ajuste
const FAROL_URL = "https://faroldemetas.onrender.com";

export default function LandingFarol() {
  useEffect(() => {
    // Regra mínima: se não tiver token liberado pelo INOVE, volta pro INOVE
    const token = localStorage.getItem("FAROL_ACCESS_TOKEN");

    if (!token) {
      const url = `${INOVE_URL}/portal?returnTo=${encodeURIComponent(FAROL_URL)}`;
      window.location.replace(url);
      return;
    }

    // Se tiver token, segue para a home real do Farol
    window.location.replace("/inicio"); // ajuste para sua rota principal do Farol
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-2xl px-8 py-6 shadow-sm text-slate-600">
        Validando acesso...
      </div>
    </div>
  );
}

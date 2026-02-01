// src/pages/ReceberAcesso.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function ReceberAcesso() {
  const navigate = useNavigate();

  useEffect(() => {
    const processar = () => {
      // 1. CAPTURA A URL
      const params = new URLSearchParams(window.location.search);
      const userDataParam = params.get("userData");

      console.log("🔥 ROTA DE LIMPEZA ACIONADA");

      // 2. LIMPEZA NUCLEAR (Apaga tudo do domínio)
      localStorage.clear(); 
      sessionStorage.clear();

      if (userDataParam) {
        try {
          // 3. GRAVA O NOVO USUÁRIO
          const newUser = JSON.parse(decodeURIComponent(userDataParam));
          localStorage.setItem("usuario_externo", JSON.stringify(newUser));
          console.log("✅ Novo usuário gravado:", newUser.nome);
          
          // 4. MANDA PARA O INICIO (Agora limpo)
          // O replace: true impede que o usuário volte para esta tela de loading
          navigate("/inicio", { replace: true });
        } catch (e) {
          console.error("Erro no JSON", e);
          navigate("/", { replace: true });
        }
      } else {
        // Se entrou aqui sem dados, manda pro login
        navigate("/", { replace: true });
      }
    };

    // Pequeno delay para garantir que o navegador processe o clear()
    setTimeout(processar, 100);

  }, [navigate]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <Loader2 className="animate-spin mb-4" size={48} />
      <h1 className="text-xl font-bold">Sincronizando Acesso...</h1>
      <p className="text-slate-400 text-sm">Validando credenciais do Inove</p>
    </div>
  );
}

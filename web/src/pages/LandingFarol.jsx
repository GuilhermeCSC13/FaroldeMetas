import { useEffect } from "react";
import { supabase } from "../supabaseClient";

const FAROL_HOME = "/inicio";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login"; // Ajuste se necessário
const CURRENT_URL = window.location.origin;

export default function LandingFarol() {
  useEffect(() => {
    const processarLogin = async () => {
      // 1. Se já tem sessão no Supabase local, entra direto
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.location.replace(FAROL_HOME);
        return;
      }

      // 2. Lê parâmetros da URL
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      const userDataParam = params.get("userData");

      // 3. Verifica se veio dados do usuário (Login via INOVE)
      let usuarioValidado = false;
      if (userDataParam) {
        try {
          const userObj = JSON.parse(decodeURIComponent(userDataParam));
          // Grava auditoria para o Sidebar usar
          localStorage.setItem("usuario_externo", JSON.stringify(userObj));
          console.log("Acesso externo liberado:", userObj.email);
          usuarioValidado = true;
        } catch (e) {
          console.error("Dados de usuário inválidos:", e);
        }
      }

      // 4. Lógica de Redirecionamento (Anti-Loop)
      // Se NÃO veio do Inove E NÃO tem usuário validado, precisa logar lá
      if (from !== "inove" && !usuarioValidado) {
        
        // Proteção: Limite de tentativas para não travar o navegador
        const loopCount = parseInt(sessionStorage.getItem("redirect_count") || "0");
        
        if (loopCount > 2) {
           console.warn("Loop de redirecionamento detectado. Abortando.");
           sessionStorage.removeItem("redirect_count");
           // Falha segura: vai para home (provavelmente cairá no login local)
           window.location.replace(FAROL_HOME); 
           return;
        }

        sessionStorage.setItem("redirect_count", loopCount + 1);
        
        // Manda o usuário para o INOVE pedindo para voltar com os dados
        const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
        window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
        return;
      }

      // 5. Sucesso: Limpa contadores e URL, e entra
      sessionStorage.removeItem("redirect_count");
      window.history.replaceState({}, "", "/");
      window.location.replace(FAROL_HOME);
    };

    processarLogin();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 font-sans text-sm">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span>Validando credenciais...</span>
      </div>
    </div>
  );
}

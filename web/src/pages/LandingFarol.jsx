import { useEffect } from "react";
import { supabase } from "../supabaseClient";

const FAROL_HOME = "/inicio";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login";
const CURRENT_URL = window.location.origin;

export default function LandingFarol() {
  useEffect(() => {
    const processarLogin = async () => {
      // 1. PRIMEIRO: Analisa a URL e Salva os Dados (Resolve o problema do nome "Gestor")
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      const userDataParam = params.get("userData");

      let usuarioValidado = false;
      
      // Se vieram dados do INOVE, grava imediatamente (sobrescreve o antigo)
      if (userDataParam) {
        try {
          const userObj = JSON.parse(decodeURIComponent(userDataParam));
          
          // ✅ GRAVAÇÃO OBRIGATÓRIA PARA O SIDEBAR LER O NOME
          localStorage.setItem("usuario_externo", JSON.stringify(userObj));
          console.log("✅ DADOS RECEBIDOS E SALVOS:", userObj);
          
          usuarioValidado = true;
        } catch (e) {
          console.error("Erro ao processar dados do usuário:", e);
        }
      }

      // 2. SEGUNDO: Verifica sessão do Supabase local
      const { data: { session } } = await supabase.auth.getSession();
      
      // Se tem sessão OU se acabou de validar os dados via URL, libera o acesso
      if (session || usuarioValidado) {
        window.history.replaceState({}, "", "/"); // Limpa a URL
        window.location.replace(FAROL_HOME);
        return;
      }

      // 3. TERCEIRO: Proteção Anti-Loop (Só redireciona se não tiver nada)
      if (from !== "inove") {
        
        // Conta quantas vezes tentou redirecionar para evitar travar o navegador
        const loopCount = parseInt(sessionStorage.getItem("redirect_count") || "0");
        
        if (loopCount > 2) {
           console.warn("Loop detectado. Entrando em modo de segurança.");
           sessionStorage.removeItem("redirect_count");
           window.location.replace(FAROL_HOME); 
           return;
        }

        sessionStorage.setItem("redirect_count", loopCount + 1);
        
        // Manda pro INOVE pedindo login
        const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
        window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
        return;
      }

      // Se passou por tudo, limpa contadores e entra
      sessionStorage.removeItem("redirect_count");
      window.location.replace(FAROL_HOME);
    };

    processarLogin();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans text-slate-600 gap-4">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="text-sm font-medium">Sincronizando perfil...</div>
    </div>
  );
}

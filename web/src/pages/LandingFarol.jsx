import { useEffect } from "react";
import { supabase } from "../supabaseClient";

const FAROL_HOME = "/inicio";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login";
const CURRENT_URL = window.location.origin;

export default function LandingFarol() {
  useEffect(() => {
    const processarLogin = async () => {
      // 1. Verifica se já existe sessão ativa no Supabase do Farol
      const { data: { session } } = await supabase.auth.getSession();
      
      // Se já está logado no Supabase, libera acesso direto
      if (session) {
        window.location.replace(FAROL_HOME);
        return;
      }

      // 2. Analisa a URL
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      const userDataParam = params.get("userData");

      // 3. Captura e Grava quem está logando (AUDITORIA)
      let usuarioIdentificado = false;
      if (userDataParam) {
        try {
          const userObj = JSON.parse(decodeURIComponent(userDataParam));
          // ✅ Grava no navegador para o Sidebar ler depois
          localStorage.setItem("usuario_externo", JSON.stringify(userObj));
          console.log("Acesso externo identificado:", userObj.email);
          usuarioIdentificado = true;
        } catch (e) {
          console.error("Erro ao processar dados do usuário:", e);
        }
      }

      // 4. Validação de Origem (CORREÇÃO DO BUG DE LOOP)
      // Só manda voltar pro INOVE se:
      // A) Não veio o parametro 'from=inove'
      // B) E TAMBÉM não veio os dados do usuário (se veio dados, confiamos que é válido)
      if (from !== "inove" && !usuarioIdentificado) {
        
        // Proteção extra: Conta quantas vezes tentou redirecionar para evitar loop infinito
        const loopCount = parseInt(sessionStorage.getItem("inove_loop_count") || "0");
        
        if (loopCount > 2) {
           console.warn("Loop detectado. Parando redirecionamento.");
           sessionStorage.removeItem("inove_loop_count");
           // Se falhar 3x, manda para o inicio (o router vai decidir se manda pro login local)
           window.location.replace(FAROL_HOME); 
           return;
        }

        // Incrementa contador e redireciona
        sessionStorage.setItem("inove_loop_count", loopCount + 1);
        const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
        window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
        return;
      }

      // Se passou (Sucesso), limpa o contador de loop
      sessionStorage.removeItem("inove_loop_count");

      // 5. Entra no Sistema
      // Limpa a URL para ficar bonita (remove os tokens visuais)
      window.history.replaceState({}, "", "/");
      window.location.replace(FAROL_HOME);
    };

    processarLogin();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl px-8 py-8 shadow-sm flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-slate-600 font-medium text-sm">
          Sincronizando credenciais...
        </div>
      </div>
    </div>
  );
}

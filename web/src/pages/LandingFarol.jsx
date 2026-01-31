import { useEffect } from "react";
import { supabase } from "../supabaseClient"; // Certifique-se de importar o client

const FAROL_HOME = "/inicio";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login";
const CURRENT_URL = window.location.origin; // Pega a URL atual automaticamente (localhost ou produção)

export default function LandingFarol() {
  useEffect(() => {
    const processarLogin = async () => {
      // 1. Verifica se já existe sessão ativa no Supabase do Farol
      const { data: { session } } = await supabase.auth.getSession();
      
      // Se já está logado, não perde tempo: vai para o início
      if (session) {
        window.location.replace(FAROL_HOME);
        return;
      }

      // 2. Analisa a URL vindo do INOVE
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      const userDataParam = params.get("userData"); // Esperando que o INOVE mande dados (opcional)

      // Se veio com dados de usuário na URL (JSON stringfied), salvamos para auditoria
      if (userDataParam) {
        try {
          const userObj = JSON.parse(decodeURIComponent(userDataParam));
          localStorage.setItem("usuario_externo", JSON.stringify(userObj));
          console.log("Usuário externo identificado:", userObj.email);
        } catch (e) {
          console.error("Erro ao processar dados do usuário:", e);
        }
      }

      // 3. Validação de Origem
      // Se NÃO veio do INOVE e NÃO tem sessão, manda pro login
      if (from !== "inove") {
        // Codifica a URL de retorno adicionando o parâmetro ?from=inove para garantir a volta correta
        const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
        window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
        return;
      }

      // 4. Se chegou aqui: Veio do INOVE corretamente (?from=inove)
      // Limpa a URL para ficar bonita e redireciona
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
          Sincronizando acesso com Portal INOVE...
        </div>
      </div>
    </div>
  );
}

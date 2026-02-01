import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const FAROL_HOME = "/inicio";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login";
const CURRENT_URL = window.location.origin;

export default function LandingFarol() {
  const [status, setStatus] = useState("Validando acesso...");

  useEffect(() => {
    const processarLogin = async () => {
      // 1. Analisa a URL
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      const userDataParam = params.get("userData");

      // 2. Tenta capturar dados do usuário (Login via INOVE)
      let usuarioValidado = false;
      if (userDataParam) {
        try {
          const userObj = JSON.parse(decodeURIComponent(userDataParam));
          
          // ✅ Grava os dados para o Sidebar
          localStorage.setItem("usuario_externo", JSON.stringify(userObj));
          console.log("✅ [Landing] Dados salvos:", userObj);
          usuarioValidado = true;
        } catch (e) {
          console.error("❌ [Landing] Erro ao ler userData:", e);
        }
      }

      // 3. Verifica sessão local do Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      // === REGRA DE DECISÃO ===

      // A) Se tem sessão ou dados válidos -> Entra no sistema
      if (session || usuarioValidado) {
        setStatus("Acesso autorizado. Redirecionando...");
        window.history.replaceState({}, "", "/"); // Limpa URL
        window.location.replace(FAROL_HOME);
        return;
      }

      // B) 🔥 QUEBRA DE LOOP: Se veio do Inove mas falhou em validar
      // NÃO manda de volta. Deixa entrar no /inicio (o Sidebar vai ficar como "Gestor")
      // Isso impede o ping-pong infinito.
      if (from === "inove") {
        console.warn("⚠️ [Landing] Veio do Inove mas sem dados válidos. Entrando em modo de segurança.");
        setStatus("Entrando em modo restrito...");
        window.location.replace(FAROL_HOME);
        return;
      }

      // C) Se não veio do Inove e não tem sessão -> Manda logar no Inove
      // (Com proteção de contagem para evitar loops locais)
      const loopCount = parseInt(sessionStorage.getItem("redirect_count") || "0");
      
      if (loopCount > 1) {
         console.warn("⚠️ [Landing] Loop detectado. Parando redirecionamento.");
         setStatus("Redirecionamento interrompido por segurança.");
         window.location.replace(FAROL_HOME); 
         return;
      }

      setStatus("Redirecionando para login corporativo...");
      sessionStorage.setItem("redirect_count", loopCount + 1);
      
      const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
      window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
    };

    processarLogin();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans text-slate-600 gap-4">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="text-sm font-medium">{status}</div>
      <div className="text-xs text-slate-400 mt-4">
        Caso trave, <a href="/inicio" className="underline text-blue-500">clique aqui</a>.
      </div>
    </div>
  );
}

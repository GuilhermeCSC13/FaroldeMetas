import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { LogIn, CheckCircle, AlertTriangle } from "lucide-react";

const FAROL_HOME = "/inicio";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login";
const CURRENT_URL = window.location.origin;

export default function LandingFarol() {
  const [status, setStatus] = useState("idle"); // idle, success, error
  const [msg, setMsg] = useState("Verificando credenciais...");
  const [userDetected, setUserDetected] = useState(null);

  useEffect(() => {
    const processarLogin = async () => {
      // 1. Limpa contadores de loop antigos para evitar travamentos falsos
      sessionStorage.removeItem("redirect_count");

      // 2. Analisa URL
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      const userDataParam = params.get("userData");

      // 3. SE VEIO DO INOVE COM DADOS (Cenário de Sucesso)
      if (userDataParam) {
        try {
          const userObj = JSON.parse(decodeURIComponent(userDataParam));
          
          // ✅ Grava os dados CRÍTICOS
          localStorage.setItem("usuario_externo", JSON.stringify(userObj));
          console.log("✅ Dados salvos com sucesso:", userObj);
          
          setUserDetected(userObj.nome || "Usuário");
          setStatus("success");
          setMsg("Acesso autorizado!");
          
          // Limpa a URL visualmente
          window.history.replaceState({}, "", "/");
          return;
        } catch (e) {
          console.error(e);
          setStatus("error");
          setMsg("Dados de acesso inválidos.");
        }
      }

      // 4. Se já tem sessão local ou dados salvos anteriormente
      const { data: { session } } = await supabase.auth.getSession();
      const storedUser = localStorage.getItem("usuario_externo");

      if (session || storedUser) {
        setStatus("success");
        setMsg("Sessão ativa encontrada.");
        // Se já estava aqui, podemos tentar o auto-redirect com cuidado
        // Mas para quebrar o loop hoje, vamos deixar o botão aparecer.
        return;
      }

      // 5. Se não tem nada e não veio do Inove -> Manda logar lá
      if (from !== "inove") {
        setStatus("redirect");
        setMsg("Redirecionando para login corporativo...");
        const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
        window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
      } else {
        // Veio do inove mas sem dados? Erro.
        setStatus("error");
        setMsg("Falha na autenticação cruzada.");
      }
    };

    processarLogin();
  }, []);

  const handleEntrar = () => {
    window.location.href = FAROL_HOME;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans p-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center gap-6 max-w-sm w-full text-center">
        
        {status === "idle" || status === "redirect" ? (
          <>
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">{msg}</p>
          </>
        ) : status === "success" ? (
          <>
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
              <CheckCircle size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bem-vindo, {userDetected}!</h2>
              <p className="text-slate-500 text-sm mt-1">Suas credenciais foram validadas.</p>
            </div>
            
            {/* ✅ BOTÃO MANUAL PARA QUEBRAR O LOOP */}
            <button 
              onClick={handleEntrar}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              Acessar Sistema <LogIn size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
              <AlertTriangle size={32} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Erro de Acesso</h2>
              <p className="text-slate-500 text-sm mt-1">{msg}</p>
            </div>
            <a 
              href={INOVE_LOGIN}
              className="text-blue-600 font-bold hover:underline text-sm"
            >
              Voltar para o Login
            </a>
          </>
        )}

      </div>
      
      <p className="mt-8 text-xs text-slate-400">Farol Tático v1.2</p>
    </div>
  );
}

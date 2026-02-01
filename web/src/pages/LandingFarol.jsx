import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { LogIn, CheckCircle, AlertTriangle } from "lucide-react";

const FAROL_HOME = "/inicio";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login";
const CURRENT_URL = window.location.origin;

// ✅ Anti-loop real
const LOOP_KEY = "redirect_count";
const MAX_REDIRECTS = 1;

export default function LandingFarol() {
  const [status, setStatus] = useState("idle"); // idle | success | error | redirect
  const [msg, setMsg] = useState("Verificando credenciais...");
  const [userDetected, setUserDetected] = useState(null);

  useEffect(() => {
    const processarLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      const userDataParam = params.get("userData");

      // 1) Se já tem usuário externo salvo, considera autenticado
      const storedUserRaw = localStorage.getItem("usuario_externo");
      if (storedUserRaw) {
        try {
          const u = JSON.parse(storedUserRaw);
          setUserDetected(u?.nome || "Usuário");
        } catch {
          setUserDetected("Usuário");
        }
        setStatus("success");
        setMsg("Sessão ativa encontrada.");
        return;
      }

      // 2) Se veio do INOVE com userData, salva e valida
      if (userDataParam) {
        try {
          const userObj = JSON.parse(decodeURIComponent(userDataParam));
          localStorage.setItem("usuario_externo", JSON.stringify(userObj));

          setUserDetected(userObj.nome || "Usuário");
          setStatus("success");
          setMsg("Acesso autorizado!");

          // ✅ limpa só querystring
          window.history.replaceState({}, "", window.location.pathname);

          // ✅ reset contador
          sessionStorage.removeItem(LOOP_KEY);

          return;
        } catch (e) {
          console.error(e);
          setStatus("error");
          setMsg("Dados de acesso inválidos.");
          return;
        }
      }

      // 3) Se já tem sessão supabase (auth nativo), valida
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setStatus("success");
        setMsg("Sessão ativa encontrada.");
        sessionStorage.removeItem(LOOP_KEY);
        return;
      }

      // 4) Se veio do INOVE mas SEM userData -> NÃO faz redirect automático (evita ping-pong)
      if (from === "inove") {
        setStatus("error");
        setMsg("Falha na autenticação cruzada (sem userData). Faça login novamente pelo INOVE.");
        return;
      }

      // 5) Se não veio do INOVE e não tem sessão, tenta redirect 1 vez
      const c = Number(sessionStorage.getItem(LOOP_KEY) || 0);
      if (c >= MAX_REDIRECTS) {
        setStatus("error");
        setMsg("Loop detectado. Clique para ir ao Login do INOVE.");
        return;
      }

      sessionStorage.setItem(LOOP_KEY, String(c + 1));
      setStatus("redirect");
      setMsg("Redirecionando para login corporativo...");

      const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
      window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
    };

    processarLogin();
  }, []);

  const handleEntrar = () => {
    window.location.href = FAROL_HOME;
  };

  const handleVoltarLogin = () => {
    const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
    window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
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
              <h2 className="text-xl font-bold text-slate-800">
                Bem-vindo, {userDetected || "Usuário"}!
              </h2>
              <p className="text-slate-500 text-sm mt-1">Suas credenciais foram validadas.</p>
            </div>

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

            {/* ✅ botão explícito (não automático) */}
            <button
              type="button"
              onClick={handleVoltarLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all"
            >
              Ir para Login do INOVE
            </button>
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-slate-400">Farol Tático v1.2</p>
    </div>
  );
}

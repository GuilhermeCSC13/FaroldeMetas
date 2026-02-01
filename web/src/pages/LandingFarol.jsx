import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { LogIn, CheckCircle, AlertTriangle } from "lucide-react";

const FAROL_HOME = "/inicio";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login";
const CURRENT_URL = window.location.origin;

// ✅ Anti-loop
const LOOP_KEY = "redirect_count";
const MAX_REDIRECTS = 2;

// ✅ flag de autenticação cruzada (quebra loop mesmo se perder URL)
const FAROL_AUTH_FLAG = "farol_authed_via_inove";

export default function LandingFarol() {
  const [status, setStatus] = useState("idle"); // idle, success, error, redirect
  const [msg, setMsg] = useState("Verificando credenciais...");
  const [userDetected, setUserDetected] = useState(null);

  useEffect(() => {
    const processarLogin = async () => {
      // 1) Analisa URL
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      const userDataParam = params.get("userData");

      // 2) Se já tem dados salvos (sessão "externa") OU flag, não redireciona nunca
      const storedUserRaw = localStorage.getItem("usuario_externo");
      const alreadyAuthedViaInove = sessionStorage.getItem(FAROL_AUTH_FLAG) === "1";

      if (storedUserRaw || alreadyAuthedViaInove) {
        try {
          const u = storedUserRaw ? JSON.parse(storedUserRaw) : null;
          setUserDetected(u?.nome || "Usuário");
        } catch {
          setUserDetected("Usuário");
        }
        setStatus("success");
        setMsg("Sessão ativa encontrada.");
        return;
      }

      // 3) SE VEIO DO INOVE COM DADOS (Cenário de Sucesso)
      if (userDataParam) {
        try {
          const userObj = JSON.parse(decodeURIComponent(userDataParam));

          // ✅ Grava os dados CRÍTICOS
          localStorage.setItem("usuario_externo", JSON.stringify(userObj));

          // ✅ Marca flag para evitar loop se URL perder parâmetros
          sessionStorage.setItem(FAROL_AUTH_FLAG, "1");

          console.log("✅ Dados salvos com sucesso:", userObj);

          setUserDetected(userObj.nome || "Usuário");
          setStatus("success");
          setMsg("Acesso autorizado!");

          // ✅ Limpa só querystring (não joga para "/")
          // Mantém o path atual e evita reativar redirect por acidente
          const cleanUrl = window.location.pathname; // ex: "/"
          window.history.replaceState({}, "", cleanUrl);

          // ✅ Zera contador de loop após sucesso
          sessionStorage.removeItem(LOOP_KEY);

          return;
        } catch (e) {
          console.error(e);
          setStatus("error");
          setMsg("Dados de acesso inválidos.");
          return;
        }
      }

      // 4) Se já tem sessão Supabase (auth nativo)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setStatus("success");
        setMsg("Sessão ativa encontrada.");
        sessionStorage.removeItem(LOOP_KEY);
        return;
      }

      // 5) Se não tem nada -> decide redirect
      // ✅ Anti-loop real
      const c = Number(sessionStorage.getItem(LOOP_KEY) || 0);

      if (from !== "inove") {
        // Vai redirecionar pro Inove com returnUrl
        if (c >= MAX_REDIRECTS) {
          setStatus("error");
          setMsg("Loop detectado. Volte ao Login e tente novamente.");
          return;
        }

        sessionStorage.setItem(LOOP_KEY, String(c + 1));

        setStatus("redirect");
        setMsg("Redirecionando para login corporativo...");

        const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
        window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
        return;
      }

      // 6) Veio do Inove mas sem userData e sem sessão/usuario_externo: erro controlado (sem ping-pong)
      setStatus("error");
      setMsg("Falha na autenticação cruzada. Faça login novamente pelo INOVE.");
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
              <h2 className="text-xl font-bold text-slate-800">
                Bem-vindo, {userDetected || "Usuário"}!
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Suas credenciais foram validadas.
              </p>
            </div>

            {/* ✅ BOTÃO MANUAL (mantido) */}
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

            {/* ✅ Volta pro INOVE já com redirect de retorno ao Farol */}
            <a
              href={`${INOVE_LOGIN}?redirect=${encodeURIComponent(`${CURRENT_URL}/?from=inove`)}`}
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

// src/pages/LandingFarol.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { LogIn, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FAROL_HOME = "/inicio";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login"; // Confirme se a URL está correta
const CURRENT_URL = window.location.origin;

const LOOP_KEY = "redirect_count";
const MAX_REDIRECTS = 1;

export default function LandingFarol() {
  const [status, setStatus] = useState("idle");
  const [msg, setMsg] = useState("Conectando ao satélite...");
  const [userDetected, setUserDetected] = useState(null);
  const [nextPath, setNextPath] = useState(FAROL_HOME);

  const navigate = useNavigate();

  useEffect(() => {
    const processarLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      const userDataParam = params.get("userData");
      const next = params.get("next");

      // Define destino pós-login
      if (next && typeof next === "string" && next.startsWith("/")) {
        setNextPath(next);
      } else {
        setNextPath(FAROL_HOME);
      }

      // -----------------------------------------------------------------------
      // 1) PRIORIDADE ABSOLUTA: DADOS DO INOVE NA URL
      // Se vier "userData", ignora quem estava logado antes (Guilherme) e usa o novo (Josue)
      // -----------------------------------------------------------------------
      if (userDataParam) {
        try {
          setMsg("Processando novas credenciais...");
          
          // Decodifica
          const jsonString = decodeURIComponent(userDataParam);
          const userObj = JSON.parse(jsonString);

          // 🛑 LIMPEZA PROFUNDA: Remove o usuário antigo para não haver confusão
          localStorage.removeItem("usuario_externo");
          
          // Grava o novo usuário (Josue)
          localStorage.setItem("usuario_externo", JSON.stringify(userObj));

          // Atualiza estado visual
          setUserDetected(userObj.nome || userObj.login || "Novo Usuário");
          setStatus("success");
          setMsg("Credenciais atualizadas com sucesso!");

          // Limpa a URL para não ficar expondo o JSON
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Reseta contadores de loop
          sessionStorage.removeItem(LOOP_KEY);
          return; // Encerra aqui, garantindo que o cache antigo não seja lido abaixo

        } catch (e) {
          console.error("Erro ao processar userData:", e);
          setStatus("error");
          setMsg("O pacote de credenciais veio corrompido.");
          return;
        }
      }

      // -----------------------------------------------------------------------
      // 2) SE NÃO VEIO PELA URL, CHECA SE JÁ TEM ALGUÉM NO CACHE
      // -----------------------------------------------------------------------
      const storedUserRaw = localStorage.getItem("usuario_externo");
      if (storedUserRaw) {
        try {
          const u = JSON.parse(storedUserRaw);
          setUserDetected(u?.nome || "Usuário");
          setStatus("success");
          setMsg("Sessão ativa recuperada.");
          return;
        } catch {
          // Se o JSON estiver quebrado, limpa
          localStorage.removeItem("usuario_externo");
        }
      }

      // -----------------------------------------------------------------------
      // 3) CHECA SESSÃO NATIVA DO SUPABASE
      // -----------------------------------------------------------------------
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus("success");
        setMsg("Sessão Supabase validada.");
        sessionStorage.removeItem(LOOP_KEY);
        return;
      }

      // -----------------------------------------------------------------------
      // 4) SE CHEGOU AQUI: NÃO TEM USUÁRIO NEM NA URL, NEM NO CACHE
      // -----------------------------------------------------------------------
      
      // Evita loop infinito se veio do Inove mas falhou em trazer dados
      if (from === "inove") {
        setStatus("error");
        setMsg("Falha na autenticação. O Inove não enviou as credenciais.");
        return;
      }

      // Contador de segurança contra redirecionamento infinito
      const c = Number(sessionStorage.getItem(LOOP_KEY) || 0);
      if (c >= MAX_REDIRECTS) {
        setStatus("error");
        setMsg("Não foi possível validar seu acesso. Tente entrar pelo Inove novamente.");
        return;
      }

      // Redireciona para o Inove buscar login
      sessionStorage.setItem(LOOP_KEY, String(c + 1));
      setStatus("redirect");
      setMsg("Redirecionando para login corporativo...");

      const returnUrl = encodeURIComponent(
        `${CURRENT_URL}/?from=inove${next ? `&next=${encodeURIComponent(next)}` : ""}`
      );

      // Delay visual curto antes de ir
      setTimeout(() => {
        window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
      }, 800);
    };

    processarLogin();
  }, [navigate]);

  const handleEntrar = () => {
    navigate(nextPath, { replace: true });
  };

  const handleVoltarLogin = () => {
    localStorage.removeItem("usuario_externo"); // Garante limpeza
    const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
    window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl flex flex-col items-center gap-6 max-w-sm w-full text-center relative overflow-hidden">
        
        {/* Barra de Status Topo */}
        <div className={`absolute top-0 left-0 w-full h-1.5 ${
            status === 'success' ? 'bg-green-500' : 
            status === 'error' ? 'bg-red-500' : 
            'bg-blue-500 animate-pulse'
        }`} />

        {status === "idle" || status === "redirect" ? (
          <>
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium animate-pulse">{msg}</p>
          </>
        ) : status === "success" ? (
          <>
            <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-2 shadow-sm">
              <CheckCircle size={40} strokeWidth={2.5} />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-800">
                Olá, {userDetected}!
              </h2>
              <p className="text-slate-500 text-sm">{msg}</p>
            </div>

            <button
              onClick={handleEntrar}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
            >
              Acessar Painel <LogIn size={20} />
            </button>
            
            <button 
              onClick={handleVoltarLogin}
              className="text-xs text-slate-400 hover:text-blue-600 underline"
            >
              Não é {userDetected}? Trocar conta
            </button>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-2 shadow-sm">
              <AlertTriangle size={40} strokeWidth={2.5} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-800">Acesso Negado</h2>
              <p className="text-slate-500 text-sm px-2">{msg}</p>
            </div>

            <button
              type="button"
              onClick={handleVoltarLogin}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} /> Tentar Login Novamente
            </button>
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-slate-400 font-mono">
        FAROL TÁTICO v2.0 • INTEGRAÇÃO INOVE
      </p>
    </div>
  );
}

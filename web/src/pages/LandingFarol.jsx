import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { LogIn, CheckCircle, AlertTriangle, RefreshCw, UserX } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FAROL_HOME = "/inicio";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login"; // Confirme se sua URL está certa
const CURRENT_URL = window.location.origin;

const LOOP_KEY = "redirect_count";
const MAX_REDIRECTS = 1;

export default function LandingFarol() {
  const [status, setStatus] = useState("idle");
  const [msg, setMsg] = useState("Verificando credenciais...");
  const [userDetected, setUserDetected] = useState(null);
  const [nextPath, setNextPath] = useState(FAROL_HOME);

  const navigate = useNavigate();

  useEffect(() => {
    const processarLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      const userDataParam = params.get("userData");
      const next = params.get("next");

      if (next && typeof next === "string" && next.startsWith("/")) {
        setNextPath(next);
      }

      // =====================================================================
      // 1. REGRA DE OURO: SE VEIO 'userData', QUEM MANDA É ELE (Inove)
      // =====================================================================
      if (userDataParam) {
        try {
          console.log("🔄 Recebendo novo login do Inove...");
          setMsg("Atualizando usuário...");

          // 1. Decodifica o novo usuário
          const novoUsuario = JSON.parse(decodeURIComponent(userDataParam));

          // 2. 🛑 LIMPEZA TOTAL: Remove qualquer rastro do usuário anterior (Josue)
          localStorage.removeItem("usuario_externo");
          localStorage.removeItem("farol_ia_date"); // Opcional: limpa cache da IA
          localStorage.removeItem("farol_ia_text");
          
          // 3. Grava o novo usuário (Guilherme)
          localStorage.setItem("usuario_externo", JSON.stringify(novoUsuario));

          // 4. Limpa a URL para não ficar "suja" com JSON
          window.history.replaceState({}, document.title, window.location.pathname);

          // 5. Sucesso
          setUserDetected(novoUsuario.nome || novoUsuario.login);
          setStatus("success");
          setMsg("Troca de usuário realizada com sucesso!");
          return; // PARE AQUI. Não verifique mais nada.

        } catch (e) {
          console.error("Erro ao processar userData:", e);
          setStatus("error");
          setMsg("Erro ao processar dados do login.");
          return;
        }
      }

      // =====================================================================
      // 2. SE NÃO VEIO 'userData', VERIFICA SE JÁ TEM ALGUÉM LOGADO
      // =====================================================================
      const storedUserRaw = localStorage.getItem("usuario_externo");
      if (storedUserRaw) {
        try {
          const u = JSON.parse(storedUserRaw);
          setUserDetected(u.nome || "Usuário");
          setStatus("success");
          setMsg("Login recuperado da memória.");
          return;
        } catch {
          localStorage.removeItem("usuario_externo");
        }
      }

      // 3. Verifica sessão nativa Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus("success");
        setMsg("Sessão Supabase ativa.");
        return;
      }

      // =====================================================================
      // 4. SE NÃO TEM NINGUÉM -> MANDA PRO INOVE LOGAR
      // =====================================================================
      
      // Proteção contra loop infinito
      if (from === "inove") {
        setStatus("error");
        setMsg("Falha: O Inove não enviou as credenciais (userData ausente).");
        return;
      }

      const c = Number(sessionStorage.getItem(LOOP_KEY) || 0);
      if (c >= MAX_REDIRECTS) {
        setStatus("error");
        setMsg("Não foi possível logar. Tente reiniciar o processo.");
        return;
      }

      sessionStorage.setItem(LOOP_KEY, String(c + 1));
      setStatus("redirect");
      setMsg("Buscando login no Inove...");

      const returnUrl = encodeURIComponent(
        `${CURRENT_URL}/?from=inove${next ? `&next=${encodeURIComponent(next)}` : ""}`
      );

      setTimeout(() => {
        window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
      }, 1000);
    };

    processarLogin();
  }, []);

  const handleEntrar = () => {
    navigate(nextPath, { replace: true });
  };

  const handleSairTrocar = () => {
    localStorage.clear(); // Limpa tudo
    const returnUrl = encodeURIComponent(`${CURRENT_URL}/?from=inove`);
    window.location.replace(`${INOVE_LOGIN}?redirect=${returnUrl}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 font-sans p-4">
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-sm w-full text-center border border-slate-200">
        
        {status === "idle" || status === "redirect" ? (
          <div className="flex flex-col items-center py-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">{msg}</p>
          </div>
        ) : status === "success" ? (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle size={40} strokeWidth={2.5} />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-1">
              Olá, {userDetected}!
            </h2>
            <p className="text-slate-500 text-sm mb-6">{msg}</p>

            <button
              onClick={handleEntrar}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-200 mb-3 flex items-center justify-center gap-2"
            >
              <LogIn size={20} /> Entrar no Painel
            </button>
            
            <button 
              onClick={handleSairTrocar}
              className="text-sm text-slate-400 hover:text-red-500 flex items-center gap-1 mx-auto mt-2"
            >
              <UserX size={14} /> Não é você? Trocar conta
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Bloqueado</h2>
            <p className="text-slate-500 text-sm mb-6">{msg}</p>
            
            <button
              onClick={handleSairTrocar}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all"
            >
              <RefreshCw className="inline mr-2" size={18}/> Tentar Novamente
            </button>
          </div>
        )}
      </div>
      <div className="mt-8 text-xs text-slate-400">FAROL TÁTICO SYSTEM</div>
    </div>
  );
}

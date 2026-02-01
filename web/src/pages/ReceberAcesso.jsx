// src/pages/ReceberAcesso.jsx (FAROL)
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient"; // Importe o client do Supabase

export default function ReceberAcesso() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Iniciando limpeza...");

  useEffect(() => {
    const processar = async () => {
      setStatus("Desconectando sessões antigas...");
      
      // 1. DERRUBA A SESSÃO DO SUPABASE (O SEGREDO ESTÁ AQUI)
      try {
        await supabase.auth.signOut(); 
      } catch (e) {
        console.warn("Erro ao fazer logout do supabase (ignorado):", e);
      }

      // 2. LIMPEZA NUCLEAR DO STORAGE
      localStorage.clear();
      sessionStorage.clear();

      // 3. CAPTURA A URL
      const params = new URLSearchParams(window.location.search);
      const userDataParam = params.get("userData");

      if (userDataParam) {
        try {
          setStatus("Gravando novo usuário...");
          
          // 4. GRAVA O NOVO USUÁRIO
          const newUser = JSON.parse(decodeURIComponent(userDataParam));
          
          // Define a chave principal que o Farol usa
          localStorage.setItem("usuario_externo", JSON.stringify(newUser));
          
          console.log("✅ Troca realizada com sucesso para:", newUser.nome);
          
          // 5. MANDA PARA O INICIO
          // Pequeno delay para garantir que o navegador salvou o storage
          setTimeout(() => {
             navigate("/inicio", { replace: true });
          }, 100);
          
        } catch (e) {
          console.error("JSON Inválido", e);
          navigate("/", { replace: true });
        }
      } else {
        // Se não veio dados, manda para o Landing
        navigate("/", { replace: true });
      }
    };

    processar();
  }, [navigate]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
      <Loader2 className="animate-spin mb-6 text-blue-500" size={64} />
      <h1 className="text-2xl font-bold mb-2">Sincronizando Acesso</h1>
      <p className="text-slate-400 text-sm animate-pulse">{status}</p>
    </div>
  );
}

// src/services/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1) API Key do .env (Vite)
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// 2) Validação (não quebra build)
if (!API_KEY) {
  console.error("❌ ERRO CRÍTICO: API Key do Google não encontrada. Verifique seu arquivo .env (VITE_GOOGLE_API_KEY).");
}

// 3) Inicializa o client
const genAI = new GoogleGenerativeAI(API_KEY || "");

/**
 * ✅ Flash: para tarefas rápidas
 */
export const getGeminiFlash = () => {
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
};

/**
 * ✅ Pro: Ajustado para evitar o erro 404.
 * Usamos "gemini-1.5-pro-latest" ou "gemini-1.5-pro-001" (versão fixa estável).
 */
export const getGeminiPro = () => {
  // Tente esta versão primeiro (geralmente resolve o 404):
  return genAI.getGenerativeModel({ model: "gemini-2.0-pro-001" });
  
  // OBS: Se o "latest" ainda der erro 404, troque a linha acima por:
  // return genAI.getGenerativeModel({ model: "gemini-1.5-pro-001" });
};

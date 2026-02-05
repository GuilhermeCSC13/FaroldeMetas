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
 * ✅ Flash: para tarefas rápidas (se você quiser usar em outros lugares)
 */
export const getGeminiFlash = () => {
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
};

/**
 * ✅ Pro: para ATA (mais detalhado/estável)
 */
export const getGeminiPro = () => {
  return genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
};


import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Tenta pegar a chave do arquivo .env
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// 2. Validação de segurança para você saber se deu erro
if (!API_KEY) {
  console.error("❌ ERRO CRÍTICO: API Key do Google não encontrada. Verifique seu arquivo .env");
}

// 3. Inicializa a biblioteca
// (Usa uma string vazia como fallback para não quebrar o build se a chave faltar temporariamente)
const genAI = new GoogleGenerativeAI(API_KEY || "");

// 4. Exporta a função que seus componentes (Inicio e Copiloto) estão chamando
export const getGeminiFlash = () => {
  return genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
};

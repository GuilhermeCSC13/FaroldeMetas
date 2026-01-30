// src/supabaseClient.js (ou o arquivo que você já usa)
import { createClient } from "@supabase/supabase-js";

// ✅ SUPABASE PRINCIPAL (app do Farol/Copiloto)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase PRINCIPAL NÃO configurado: verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ✅ SUPABASE INOVE (usuarios_aprovadores)
const supaInoveUrl = import.meta.env.VITE_SUPABASE_INOVE_URL;
const supaInoveAnonKey = import.meta.env.VITE_SUPABASE_INOVE_ANON_KEY;

if (!supaInoveUrl || !supaInoveAnonKey) {
  console.warn(
    "Supabase INOVE NÃO configurado: verifique VITE_SUPABASE_INOVE_URL e VITE_SUPABASE_INOVE_ANON_KEY."
  );
}

export const supabaseInove = createClient(supaInoveUrl, supaInoveAnonKey);

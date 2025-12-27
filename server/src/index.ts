import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Rota de saúde / teste
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "API Farol de Metas e Reuniões rodando"
  });
});

// (FUTURO) Rotas para:
// - Faróis de Metas
// - Rotinas
// - Reuniões
// - Upload de áudio + transcrição Gemini

app.listen(PORT, () => {
  console.log(`Server rodando na porta ${PORT}`);
});

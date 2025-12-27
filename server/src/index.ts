import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import multer from "multer";
import { VertexAI } from "@google-cloud/vertexai";
// ROTA DE SAÚDE
app.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "API Farol de Metas e Reuniões rodando",
  });
});

// ROTA: TRANSCRIÇÃO + RESUMO COM GEMINI
app.post(
  "/api/reunioes/:id/transcrever",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    // ... resto do código igual
  }
);

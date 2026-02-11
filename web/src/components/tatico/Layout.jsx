// src/components/tatico/Layout.jsx
import React, { useEffect, useMemo, useState } from "react";

import Sidebar from "./Sidebar";
import TacticalAssistant from "./TacticalAssistant";
import RecorderDock from "./RecorderDock"; // ✅ NOVO (dock do gravador)

const DEFAULT_APP_ZOOM = 0.7; // 70%

export default function Layout({ children }) {
  const [appZoom, setAppZoom] = useState(DEFAULT_APP_ZOOM);

  // carrega do storage (ou fixa 70% na primeira vez)
  useEffect(() => {
    const saved = localStorage.getItem("farol_app_zoom");
    if (saved) {
      const v = Number(saved);
      if (!Number.isNaN(v) && v >= 0.5 && v <= 1) {
        setAppZoom(v);
        return;
      }
    }
    localStorage.setItem("farol_app_zoom", String(DEFAULT_APP_ZOOM));
    setAppZoom(DEFAULT_APP_ZOOM);
  }, []);

  // persiste quando mudar (se você quiser no futuro um seletor)
  useEffect(() => {
    localStorage.setItem("farol_app_zoom", String(appZoom));
  }, [appZoom]);

  // estilo do "zoom do app"
  const zoomStyle = useMemo(() => {
    return {
      transform: `scale(${appZoom})`,
      transformOrigin: "top left",
      width: `${100 / appZoom}%`, // compensa o scale para não “encolher” a área útil
      height: `${100 / appZoom}%`,
    };
  }, [appZoom]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Conteúdo da Página (aplica zoom aqui) */}
        <div className="flex-1 overflow-auto">
          <div style={zoomStyle}>{children}</div>
        </div>

        {/* Dock de Gravação (global, sempre disponível) */}
        <RecorderDock />

        {/* Assistente Flutuante (fica por cima de tudo) */}
        <TacticalAssistant />
      </main>
    </div>
  );
}

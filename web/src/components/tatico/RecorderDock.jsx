// src/components/tatico/RecorderDock.jsx
import React from "react";
import { Monitor, Loader2 } from "lucide-react";
import { useRecording } from "../../context/RecordingContext";

export default function RecorderDock() {
  const { isRecording, isProcessing, timerLabel, current, stopRecording } = useRecording();

  if (!isRecording && !isProcessing) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 shadow-xl backdrop-blur w-[320px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isRecording ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Monitor size={20} />}
            </div>

            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Gravação</div>
              <div className="text-sm font-black truncate">
                {current?.reuniaoTitulo || "Sessão ativa"}
              </div>
              <div className="text-xs font-mono text-slate-200">{timerLabel}</div>
            </div>
          </div>

          <button
            onClick={stopRecording}
            disabled={isProcessing}
            className="bg-white text-slate-900 px-4 py-2 rounded-xl font-black text-xs disabled:opacity-50"
          >
            ENCERRAR
          </button>
        </div>

        {isProcessing && (
          <div className="mt-3 text-xs text-blue-300 font-bold animate-pulse">
            FINALIZANDO E SUBINDO...
          </div>
        )}
      </div>
    </div>
  );
}

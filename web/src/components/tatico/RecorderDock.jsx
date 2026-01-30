import React from "react";
import { Loader2 } from "lucide-react";
import { useRecording } from "../../context/RecordingContext";

export default function RecorderDock() {
  const { isRecording, isProcessing, timerLabel, stopRecording } = useRecording();

  if (!isRecording && !isProcessing) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-6">
          {/* Status e Timer */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isRecording ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
            }`}>
              {isProcessing ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>
            
            <div className="text-xl font-mono font-bold text-slate-100 tracking-tighter">
              {timerLabel}
            </div>
          </div>

          {/* Botão Encerrar */}
          <button
            onClick={stopRecording}
            disabled={isProcessing}
            className="bg-white text-slate-900 px-5 py-2.5 rounded-xl font-black text-xs hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? "PROCESSANDO" : "ENCERRAR"}
          </button>
        </div>

        {isProcessing && (
          <div className="mt-3 text-[10px] text-blue-400 font-bold animate-pulse text-center tracking-widest">
            FINALIZANDO E SUBINDO...
          </div>
        )}
      </div>
    </div>
  );
}

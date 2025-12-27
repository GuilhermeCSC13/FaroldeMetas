import { useParams } from "react-router-dom";

export default function DetalheReuniao() {
  const { id } = useParams();

  // Futuro: buscar dados reais dessa reunião e histórico de atas
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">
        Reunião: {id}
      </h1>

      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">
            Última reunião
          </h2>
          <p className="text-xs text-slate-500">
            Aqui vamos mostrar data, participantes, principais decisões,
            pendências etc.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">
            Upload / gravação de áudio
          </h3>
          <input
            type="file"
            accept="audio/*"
            className="text-sm"
          />
          <button className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white">
            Enviar para transcrição (Gemini)
          </button>
          <p className="text-xs text-slate-500">
            Depois vamos ligar este botão na API do servidor
            (/api/reunioes/:id/transcrever).
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            Transcrição / Resumo
          </h3>
          <p className="text-xs text-slate-500">
            Aqui o sistema vai exibir a transcrição gerada pelo Gemini e um
            resumo estruturado (decisões, responsáveis, prazos).
          </p>
        </div>
      </div>
    </div>
  );
}

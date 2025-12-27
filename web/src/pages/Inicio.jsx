export default function Inicio() {
  return (
    <div className="space-y-6">
      {/* Cabeçalho local da página */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">
          Visão Geral da Ferramenta
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Aqui você vai concentrar o planejamento tático, os faróis de metas e
          o acompanhamento das reuniões periódicas da Quatai. Essa tela é só um
          resumo e uma porta de entrada para os módulos principais.
        </p>
      </div>

      {/* Cards de destaque */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            Módulo 1
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-800">
            Planejamento Tático
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Estruture as metas anuais, indicadores-chave (KM/L, MKBF, absenteísmo,
            segurança etc.) e conecte cada meta às rotinas diárias, semanais e
            mensais.
          </p>
          <ul className="mt-3 text-xs text-slate-500 space-y-1">
            <li>• Farol de metas por área</li>
            <li>• Metas por ano/mês</li>
            <li>• Rotinas ligadas às metas</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
            Módulo 2
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-800">
            Reuniões Periódicas
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Cadastre os rituais (DBO, KM/L, Segurança, RH) e registre cada
            reunião com pauta, decisões, responsáveis e pendências.
          </p>
          <ul className="mt-3 text-xs text-slate-500 space-y-1">
            <li>• Agenda de reuniões por área</li>
            <li>• Histórico de encontros</li>
            <li>• Espaço para transcrição e resumo automático</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100 md:col-span-2 xl:col-span-1">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
            Próximos passos
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-800">
            Integrações futuras
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Em seguida vamos conectar o Gemini para transcrever automaticamente
            as reuniões e gerar resumos, além de integrar com as bases de KM/L,
            SOS, avarias e demais KPIs.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Esta seção é apenas informativa por enquanto — a ideia é que o
            painel inicial mostre, no futuro, o status geral do planejamento e
            do cumprimento das rotinas.
          </p>
        </div>
      </div>
    </div>
  );
}

// web/src/pages/Inicio.jsx
export default function Inicio() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          Visão Geral da Ferramenta
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Aqui você vai concentrar o planejamento tático, os faróis de metas e
          o acompanhamento das reuniões periódicas da Quatai. Essa tela é só um
          resumo e uma porta de entrada para os módulos principais.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Módulo 1 */}
        <section className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
          <p className="text-xs font-semibold text-blue-500 tracking-wide">
            MÓDULO 1
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Planejamento Tático
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Estruture as metas anuais, indicadores-chave e conecte cada meta às
            rotinas diárias, semanais e mensais.
          </p>
          <ul className="mt-3 text-sm text-slate-600 list-disc list-inside space-y-1">
            <li>Farol de metas por área</li>
            <li>Metas por ano/mês</li>
            <li>Rotinas ligadas às metas</li>
          </ul>
        </section>

        {/* Módulo 2 */}
        <section className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
          <p className="text-xs font-semibold text-emerald-500 tracking-wide">
            MÓDULO 2
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Reuniões Periódicas
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Cadastre os rituais (DBO, KM/L, Segurança, RH) e registre cada
            reunião com pauta, decisões, responsáveis e pendências.
          </p>
          <ul className="mt-3 text-sm text-slate-600 list-disc list-inside space-y-1">
            <li>Agenda de reuniões por área</li>
            <li>Histórico de encontros</li>
            <li>Espaço para transcrição e resumo automático</li>
          </ul>
        </section>

        {/* Módulo 3 / Futuro */}
        <section className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
          <p className="text-xs font-semibold text-orange-500 tracking-wide">
            PRÓXIMOS PASSOS
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Integrações futuras
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Em seguida vamos conectar o Gemini para transcrever automaticamente
            as reuniões e gerar resumos, além de integrar com as bases de KM/L,
            SOS, avarias e demais KPIs.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Esta seção é apenas informativa por enquanto — a ideia é que o
            painel inicial mostre, no futuro, o status geral do planejamento e
            do cumprimento das rotinas.
          </p>
        </section>
      </div>
    </div>
  );
}

export default function Configuracoes() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">
        Configurações
      </h1>
      <p className="text-sm text-slate-600">
        Nesta área você vai cadastrar:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
        <li>Áreas (Operação, Manutenção, ADM, Moov...)</li>
        <li>Metas anuais/mensais por área</li>
        <li>Rotinas (diária, semanal, mensal) ligadas às metas</li>
        <li>Estrutura das reuniões periódicas</li>
      </ul>
    </div>
  );
}

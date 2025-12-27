// src/components/tatico/FarolMetasSetor.jsx

export default function FarolMetasSetor({ setor = "Setor" }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-800 mb-2">
        Farol de Metas — {setor}
      </h2>
      <p className="text-sm text-gray-600">
        Componente placeholder do Farol de Metas. Aqui vamos exibir as metas,
        realizado, % de atingimento e o farol (verde / amarelo / vermelho)
        quando conectarmos com o Supabase.
      </p>
      <p className="text-xs text-gray-500 mt-2">
        Por enquanto é só estrutura visual para não quebrar o build do projeto.
      </p>
    </div>
  );
}

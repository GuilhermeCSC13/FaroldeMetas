import React from 'react';
import { Settings, Construction, Clock, ChevronRight } from 'lucide-react';

export default function Configuracoes() {
  return (
    <div className="max-w-6xl mx-auto p-8 font-sans h-[80vh] flex flex-col justify-center items-center animate-in fade-in duration-700">
      
      {/* ÍCONE CENTRAL COM ANIMAÇÃO */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="relative bg-white border border-slate-100 p-8 rounded-full shadow-xl">
          <Construction size={64} className="text-blue-600 animate-bounce" />
        </div>
      </div>

      {/* TEXTO PRINCIPAL */}
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-4xl font-black text-slate-800 tracking-tighter italic uppercase">
          Módulo de Configuração
        </h1>
        <div className="flex items-center justify-center gap-2 px-4 py-1 bg-amber-50 border border-amber-100 rounded-full w-fit mx-auto">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Em Desenvolvimento</span>
        </div>
        
        <p className="text-slate-500 text-sm leading-relaxed font-medium">
          Estamos preparando este espaço para você gerenciar categorias oficiais, padrões de cores, segurança por senha e integrações automáticas.
        </p>
      </div>

      {/* GRID DE PREVIEW DAS FUNCIONALIDADES (O QUE VIRÁ) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 w-full max-w-4xl">
        {[
          { label: 'Categorias', desc: 'Padronização de rituais' },
          { label: 'Segurança', desc: 'Controle de exclusão' },
          { label: 'Padrões', desc: 'Cores e taxonomias' }
        ].map((item, i) => (
          <div key={i} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-start gap-3 opacity-60 grayscale hover:grayscale-0 transition-all">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Settings size={16} className="text-slate-400" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-700 uppercase">{item.label}</p>
              <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="mt-16 flex items-center gap-2 text-slate-300">
        <Clock size={14} />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Disponível em breve nas atualizações</span>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getGeminiFlash } from '../../services/gemini'; // <--- IMPORT CENTRALIZADO
import { MessageSquare, X, Send, Bot, Loader2 } from 'lucide-react';

const TacticalAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou seu Copiloto Tático. Pode me perguntar sobre metas, resultados ou o que foi decidido nas reuniões.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchContexto = async () => {
    const { data: metas } = await supabase.from('metas_farol').select('indicador, peso, realizado_atual (resultados_farol(valor_realizado, mes))');
    const { data: reunioes } = await supabase.from('reunioes').select('titulo, data_hora, pauta, status').order('data_hora', { ascending: false }).limit(5);
    const { data: acoes } = await supabase.from('acoes').select('descricao, responsavel, status, data_abertura').eq('status', 'Aberta');

    let contexto = "DADOS ATUAIS DO SISTEMA:\n\n";
    if(metas) {
      contexto += "--- INDICADORES E METAS ---\n";
      metas.forEach(m => { contexto += `- Indicador: ${m.indicador} (Peso: ${m.peso}).\n`; });
    }
    if(reunioes) {
      contexto += "\n--- ÚLTIMAS REUNIÕES ---\n";
      reunioes.forEach(r => { contexto += `- ${new Date(r.data_hora).toLocaleDateString()} [${r.titulo}]: ${r.pauta ? 'Tem resumo.' : 'Sem resumo.'} Status: ${r.status}\n`; });
    }
    if(acoes) {
      contexto += "\n--- AÇÕES PENDENTES ---\n";
      acoes.forEach(a => { contexto += `- [${a.responsavel}] deve resolver: "${a.descricao}" (Desde: ${a.data_abertura})\n`; });
    }
    return contexto;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const dadosContexto = await fetchContexto();
      const model = getGeminiFlash(); // <--- USA O SERVIÇO

      const prompt = `
        Você é o Copiloto Tático.
        Dados reais:
        ${dadosContexto}

        Usuário: "${userMsg}"
        Responda com base nos dados.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      setMessages(prev => [...prev, { role: 'assistant', text: text }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', text: 'Erro ao processar. Verifique a chave.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 z-50 animate-bounce-slow"
        >
          <Bot size={28} />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 overflow-hidden font-sans animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-lg"><Bot size={18} /></div>
              <div>
                <h3 className="font-bold text-sm">Copiloto Tático</h3>
                <p className="text-[10px] text-blue-200 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span> Online</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded transition-colors"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                  {msg.text.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
                </div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-100 shadow-sm flex items-center gap-2 text-gray-400 text-xs"><Loader2 size={14} className="animate-spin" /> Analisando dados...</div></div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <input className="flex-1 bg-transparent outline-none text-sm text-gray-700" placeholder="Ex: Como estão as metas?" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
              <button onClick={handleSend} disabled={loading || !input.trim()} className="text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"><Send size={18} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default TacticalAssistant;

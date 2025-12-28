import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getGeminiFlash } from '../../services/gemini';
import { MessageSquare, X, Send, Bot, Loader2 } from 'lucide-react';

const TacticalAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou seu Copiloto Tático. Pode me perguntar sobre reuniões antigas, ações pendentes ou indicadores.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchContexto = async () => {
    // AUMENTADO: Busca as últimas 10 reuniões (antes era 5) para achar as de Teste
    const { data: reunioes } = await supabase.from('reunioes').select('titulo, data_hora, pauta, status').order('data_hora', { ascending: false }).limit(10);
    const { data: acoes } = await supabase.from('acoes').select('descricao, responsavel, status, data_abertura').eq('status', 'Aberta');
    const { data: metas } = await supabase.from('metas_farol').select('indicador, peso, realizado_atual');

    let contexto = "DADOS DO SISTEMA:\n";
    
    if(reunioes) {
      contexto += "\n--- HISTÓRICO DE REUNIÕES ---\n";
      reunioes.forEach(r => { 
        contexto += `- Data: ${new Date(r.data_hora).toLocaleDateString()} | Título: "${r.titulo}" | Status: ${r.status}\n`; 
        if(r.pauta) contexto += `  Resumo da Ata: ${r.pauta.substring(0, 150)}...\n`;
      });
    }

    if(acoes) {
      contexto += "\n--- AÇÕES PENDENTES ---\n";
      acoes.forEach(a => { contexto += `- ${a.responsavel}: ${a.descricao}\n`; });
    }

    if(metas) {
      contexto += "\n--- METAS ---\n";
      metas.forEach(m => { contexto += `- ${m.indicador}: ${m.realizado_atual}\n`; });
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
      const model = getGeminiFlash();

      const prompt = `
        Você é o Copiloto Tático da Quatai.
        
        CONTEXTO DE DADOS (Use isso para responder):
        ${dadosContexto}

        PERGUNTA DO USUÁRIO: "${userMsg}"

        IMPORTANTE: 
        1. Se o usuário perguntar de uma reunião específica (ex: "reunião de teste"), procure na lista acima por nomes parecidos (ex: "Teste de Gravação").
        2. Se achar a reunião, fale o que tem no resumo dela.
        3. Se não achar, diga que não encontrou nos registros das últimas 10 reuniões.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setMessages(prev => [...prev, { role: 'assistant', text: response.text() }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', text: 'Erro de conexão com a IA.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 z-50 animate-bounce-slow">
          <Bot size={28} />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 overflow-hidden font-sans animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <Bot size={18} />
              <h3 className="font-bold text-sm">Copiloto Tático</h3>
            </div>
            <button onClick={() => setIsOpen(false)}><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                  {msg.text.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
                </div>
              </div>
            ))}
            {loading && <div className="text-gray-400 text-xs flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> Consultando banco...</div>}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 bg-white border-t">
            <div className="flex gap-2">
              <input className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none" placeholder="Digite sua pergunta..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
              <button onClick={handleSend} disabled={loading} className="text-blue-600"><Send size={20} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default TacticalAssistant;

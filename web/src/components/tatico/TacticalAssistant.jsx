import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getGeminiFlash } from '../../services/gemini';
import { MessageSquare, X, Send, Bot, Loader2, Check, Trash2 } from 'lucide-react';
import { salvarReuniao } from '../../services/agendaService';

const TacticalAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // MENSAGEM PADRÃO
  const welcomeMsg = { role: 'assistant', text: 'Olá! Sou seu Copiloto. Posso consultar dados ou agendar reuniões para você (Ex: "Marcar reunião mensal toda quarta").' };

  // 1. CARREGAR DO STORAGE (Com verificação de tempo)
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('farol_chat_history');
    const timestamp = localStorage.getItem('farol_chat_time');
    
    // Se existir histórico e for menor que 6 horas, recupera. Se não, reseta.
    if (saved && timestamp) {
      const hoursPassed = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60);
      if (hoursPassed < 6) return JSON.parse(saved);
    }
    return [welcomeMsg];
  });

  // 2. SALVAR NO STORAGE (Sempre que muda)
  useEffect(() => {
    localStorage.setItem('farol_chat_history', JSON.stringify(messages));
    localStorage.setItem('farol_chat_time', Date.now().toString());
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 3. FUNÇÃO LIMPAR (Reset Manual)
  const clearChat = () => {
    setMessages([welcomeMsg]);
    localStorage.removeItem('farol_chat_history');
    localStorage.removeItem('farol_chat_time');
  };

  const handleCreateMeetingIntent = async (dadosJSON) => {
    try {
        const dados = JSON.parse(dadosJSON);
        const confirmacao = {
            role: 'assistant',
            type: 'confirmation',
            data: dados,
            text: `Entendi. Quer agendar "${dados.titulo}" para ${dados.data} às ${dados.hora}? (${dados.recorrencia})`
        };
        setMessages(prev => [...prev, confirmacao]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', text: "Tentei agendar, mas não entendi os dados." }]);
    }
  };

  const confirmarAgendamento = async (dados) => {
    setLoading(true);
    try {
        await salvarReuniao({
            titulo: dados.titulo,
            tipo_reuniao: dados.titulo.split(' ')[0], 
            data_hora: `${dados.data}T${dados.hora}:00`,
            cor: '#10B981',
            area_id: 4,
            responsavel: 'IA Copiloto',
            pauta: 'Agendamento automático via Chatbot.'
        }, dados.recorrencia || 'unica');

        setMessages(prev => [...prev, { role: 'assistant', text: "✅ Feito! Reunião agendada e adicionada ao calendário." }]);
    } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', text: "Erro ao salvar no banco." }]);
    } finally {
        setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const model = getGeminiFlash();
      
      const prompt = `
        Você é um assistente de agendamento e análise.
        O usuário disse: "${userMsg}"
        Data de Hoje: ${new Date().toISOString().split('T')[0]}

        SE FOR AGENDAMENTO:
        Retorne APENAS um JSON: { "intent": "schedule", "titulo": "...", "data": "YYYY-MM-DD", "hora": "HH:MM", "recorrencia": "unica" | "semanal" | "mensal" }
        
        SE NÃO: Responda texto normal curto.
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      if (text.trim().startsWith('{') && text.includes('"intent": "schedule"')) {
        await handleCreateMeetingIntent(text);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: text }]);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', text: 'Erro de processamento.' }]);
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
          
          {/* HEADER COM BOTÃO LIMPAR */}
          <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
                <Bot size={18} />
                <h3 className="font-bold text-sm">Copiloto</h3>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={clearChat} title="Nova Conversa" className="p-1 hover:bg-blue-500 rounded text-blue-100 hover:text-white transition-colors">
                    <Trash2 size={16} />
                </button>
                <button onClick={() => setIsOpen(false)} title="Minimizar">
                    <X size={18} />
                </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                {msg.type === 'confirmation' ? (
                    <div className="bg-white border border-blue-200 p-4 rounded-xl shadow-sm w-[90%] animate-in zoom-in-95">
                        <p className="text-sm text-gray-700 mb-3">{msg.text}</p>
                        <div className="flex gap-2">
                            <button onClick={() => confirmarAgendamento(msg.data)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                                <Check size={14}/> Confirmar
                            </button>
                            <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2 rounded-lg">Cancelar</button>
                        </div>
                    </div>
                ) : (
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                        {msg.text}
                    </div>
                )}
              </div>
            ))}
            {loading && <div className="text-gray-400 text-xs flex items-center gap-2"><Loader2 size={12} className="animate-spin"/></div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t">
            <div className="flex gap-2">
              <input className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none" placeholder="Digite sua mensagem..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
              <button onClick={handleSend} disabled={loading} className="text-blue-600"><Send size={20} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default TacticalAssistant;

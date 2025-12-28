import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getGeminiFlash } from '../../services/gemini';
import { MessageSquare, X, Send, Bot, Loader2, CalendarPlus, Check } from 'lucide-react';
import { salvarReuniao } from '../../services/agendaService'; // Usa o serviço

const TacticalAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou seu Copiloto. Posso consultar dados ou agendar reuniões para você (Ex: "Marcar reunião mensal toda quarta").' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Função que a IA chama indiretamente
  const handleCreateMeetingIntent = async (dadosJSON) => {
    try {
        const dados = JSON.parse(dadosJSON);
        // Pergunta ao usuário na tela (Simulação de UI Agente)
        const confirmacao = {
            role: 'assistant',
            type: 'confirmation', // Tipo especial de mensagem
            data: dados,
            text: `Entendi. Quer agendar "${dados.titulo}" para ${dados.data} às ${dados.hora}? (${dados.recorrencia})`
        };
        setMessages(prev => [...prev, confirmacao]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', text: "Tentei agendar, mas não entendi os dados. Pode repetir?" }]);
    }
  };

  const confirmarAgendamento = async (dados) => {
    setLoading(true);
    try {
        await salvarReuniao({
            titulo: dados.titulo,
            tipo_reuniao: dados.titulo.split(' ')[0], // Pega a primeira palavra como tipo
            data_hora: `${dados.data}T${dados.hora}:00`,
            cor: '#10B981',
            area_id: 4
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
      
      // PROMPT AGENTE (COMANDO JSON)
      const prompt = `
        Você é um assistente de agendamento.
        O usuário disse: "${userMsg}"
        Data de Hoje: ${new Date().toISOString().split('T')[0]}

        SE O USUÁRIO QUISER MARCAR REUNIÃO:
        Retorne APENAS um JSON neste formato (sem markdown):
        { "intent": "schedule", "titulo": "...", "data": "YYYY-MM-DD", "hora": "HH:MM", "recorrencia": "unica" | "semanal" | "mensal" }
        
        SE NÃO FOR AGENDAMENTO:
        Responda normalmente com texto, consultando seus conhecimentos gerais.
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Tenta detectar se é JSON
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
          <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2"><Bot size={18} /><h3 className="font-bold text-sm">Copiloto</h3></div>
            <button onClick={() => setIsOpen(false)}><X size={18} /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                {/* MENSAGEM ESPECIAL: CONFIRMAÇÃO DE AGENDAMENTO */}
                {msg.type === 'confirmation' ? (
                    <div className="bg-white border border-blue-200 p-4 rounded-xl shadow-sm w-[90%]">
                        <p className="text-sm text-gray-700 mb-3">{msg.text}</p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => confirmarAgendamento(msg.data)}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1"
                            >
                                <Check size={14}/> Confirmar
                            </button>
                            <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2 rounded-lg">
                                Cancelar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                        {msg.text}
                    </div>
                )}
              </div>
            ))}
            {loading && <div className="text-gray-400 text-xs flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> Pensando...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t">
            <div className="flex gap-2">
              <input className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none" placeholder="Ex: Marcar DBO dia 05/01 as 09h" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
              <button onClick={handleSend} disabled={loading} className="text-blue-600"><Send size={20} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default TacticalAssistant;

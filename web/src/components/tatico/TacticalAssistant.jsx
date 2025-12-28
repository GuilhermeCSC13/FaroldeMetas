import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getGeminiFlash } from '../../services/gemini';
import { MessageSquare, X, Send, Bot, Loader2, Check, Trash2, CalendarClock, Ban } from 'lucide-react'; // Adicionei Ban icon
import { salvarReuniao } from '../../services/agendaService';

const TacticalAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const welcomeMsg = { role: 'assistant', text: 'Olá. Tenho acesso total à sua Agenda e Atas. \n\nPosso:\n1. Consultar decisões passadas.\n2. Verificar disponibilidade.\n3. Agendar novas reuniões.' };

  // --- 1. MEMÓRIA LOCAL ---
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('farol_chat_history');
      const timestamp = localStorage.getItem('farol_chat_time');
      if (saved && timestamp) {
        const hoursPassed = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60);
        if (hoursPassed < 4) return JSON.parse(saved); 
      }
    } catch (e) { console.warn(e); }
    return [welcomeMsg];
  });

  useEffect(() => {
    localStorage.setItem('farol_chat_history', JSON.stringify(messages));
    localStorage.setItem('farol_chat_time', Date.now().toString());
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearChat = () => {
    setMessages([welcomeMsg]);
    localStorage.removeItem('farol_chat_history');
    localStorage.removeItem('farol_chat_time');
  };

  // --- 2. CÉREBRO: BUSCA DADOS ---
  const buscarContextoDados = async () => {
    try {
        const hoje = new Date().toISOString();
        const [resAgenda, resHistorico] = await Promise.all([
            supabase.from('reunioes').select('titulo, data_hora, tipo_reuniao').gte('data_hora', hoje).order('data_hora', { ascending: true }).limit(10),
            supabase.from('reunioes').select('titulo, data_hora, pauta').lte('data_hora', hoje).eq('status', 'Realizada').order('data_hora', { ascending: false }).limit(5)
        ]);

        let contexto = `\n--- 📅 AGENDA FUTURA ---\n`;
        if (resAgenda.data?.length) {
            resAgenda.data.forEach(r => {
                const dt = new Date(r.data_hora);
                contexto += `- ${dt.toLocaleDateString()} ${dt.toLocaleTimeString().slice(0,5)}: ${r.titulo}\n`;
            });
        } else { contexto += "(Livre)\n"; }

        contexto += `\n--- 📚 HISTÓRICO ---\n`;
        if (resHistorico.data?.length) {
            resHistorico.data.forEach(r => contexto += `- ${r.titulo} (${new Date(r.data_hora).toLocaleDateString()}): ${r.pauta ? r.pauta.substring(0, 50) : ''}...\n`);
        } else { contexto += "(Vazio)\n"; }

        return contexto;
    } catch (err) { return " (Erro ao ler agenda. Responda com base no chat.)"; }
  };

  // --- 3. PROCESSAMENTO DA IA ---
  const handleSend = async () => {
    if (!input.trim()) return;
    if (!navigator.onLine) { setMessages(prev => [...prev, { role: 'assistant', text: "⚠️ Sem internet." }]); return; }

    const userMsg = input;
    setInput('');
    const newMessages = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const dadosContexto = await buscarContextoDados();
      const model = getGeminiFlash();

      const historicoChat = newMessages.slice(-6).map(m => 
        `${m.role === 'user' ? 'USUÁRIO' : 'IA'}: ${m.text}`
      ).join('\n');

      const prompt = `
        Você é o Copiloto do Farol Tático.
        DADOS: ${dadosContexto}
        HISTÓRICO: ${historicoChat}
        HOJE: ${new Date().toLocaleString('pt-BR')}

        INSTRUÇÕES:
        1. Analise o histórico. Se eu respondi um horário ou título pendente, use para finalizar.
        2. Se tiver todos os dados, retorne JSON.
        3. Se faltar algo, pergunte.

        FORMATO JSON (Agendar): { "intent": "schedule", "titulo": "...", "data": "YYYY-MM-DD", "hora": "HH:MM", "recorrencia": "unica" }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

      if (cleanText.startsWith('{') && cleanText.includes('"intent": "schedule"')) {
        await handleCreateMeetingIntent(cleanText);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: text }]);
      }

    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', text: `⚠️ Erro na IA: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // --- 4. FUNÇÕES DE AGENDAMENTO ---
  const handleCreateMeetingIntent = async (dadosJSON) => {
    try {
        const dados = JSON.parse(dadosJSON);
        if (!dados.hora) dados.hora = "09:00"; 
        if (!dados.titulo) dados.titulo = "Reunião";

        const confirmacao = {
            role: 'assistant', type: 'confirmation', data: dados,
            text: `Confirmar agendamento?`
        };
        setMessages(prev => [...prev, confirmacao]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', text: "Erro ao processar agendamento." }]);
    }
  };

  const confirmarAgendamento = async (dados) => {
    setLoading(true);
    try {
        await salvarReuniao({
            titulo: dados.titulo,
            tipo_reuniao: 'Geral',
            data_hora: `${dados.data}T${dados.hora}:00`,
            cor: '#2563EB',
            area_id: 4,
            responsavel: 'IA Copiloto',
            pauta: `Agendado via IA.`
        }, dados.recorrencia || 'unica');

        setMessages(prev => [...prev, { role: 'assistant', text: `✅ Confirmado! Reunião "${dados.titulo}" agendada.` }]);
    } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', text: "Erro ao gravar no banco." }]);
    } finally {
        setLoading(false);
    }
  };

  // --- NOVA FUNÇÃO: CANCELAR ---
  const cancelarAgendamento = () => {
    setMessages(prev => [...prev, { role: 'assistant', text: "🚫 Operação cancelada. Como mais posso ajudar?" }]);
  };

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 z-50 animate-bounce-slow border-2 border-blue-500">
          <Bot size={28} />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-slate-200 overflow-hidden font-sans animate-in slide-in-from-bottom-10 fade-in duration-300">
          {/* Header */}
          <div className="bg-slate-900 p-4 flex justify-between items-center text-white border-b border-blue-900">
            <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg"><Bot size={16} /></div>
                <div><h3 className="font-bold text-sm">Copiloto IA</h3><p className="text-[10px] text-blue-200">Online</p></div>
            </div>
            <div className="flex gap-1">
                <button onClick={clearChat} className="p-2 hover:bg-white/10 rounded-lg"><Trash2 size={16}/></button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={18}/></button>
            </div>
          </div>
          
          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.type === 'confirmation' ? (
                    <div className="bg-white border border-blue-200 p-4 rounded-xl shadow-md w-[95%] animate-in zoom-in-95">
                        <div className="flex items-center gap-2 mb-3 text-blue-700 font-bold text-xs uppercase border-b border-blue-50 pb-2">
                            <CalendarClock size={14}/> Validação de Agenda
                        </div>
                        <div className="mb-4 text-sm text-slate-700 space-y-1.5">
                            <p><span className="text-slate-400 font-medium w-16 inline-block">Evento:</span> <strong>{msg.data.titulo}</strong></p>
                            <p><span className="text-slate-400 font-medium w-16 inline-block">Data:</span> {msg.data.data}</p>
                            <p><span className="text-slate-400 font-medium w-16 inline-block">Hora:</span> {msg.data.hora}</p>
                        </div>
                        
                        {/* --- BOTÕES AJUSTADOS --- */}
                        <div className="flex gap-3 mt-2">
                            <button 
                                onClick={() => confirmarAgendamento(msg.data)} 
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                            >
                                <Check size={16} className="stroke-[3]" /> Confirmar
                            </button>
                            <button 
                                onClick={cancelarAgendamento} // Agora funciona!
                                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                            >
                                <Ban size={14} /> Cancelar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm whitespace-pre-line ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'}`}>{msg.text}</div>
                )}
              </div>
            ))}
            {loading && <div className="flex items-center gap-2 text-slate-400 text-xs pl-2"><Loader2 size={14} className="animate-spin text-blue-500"/><span>Digitando...</span></div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-slate-100">
            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <input className="flex-1 bg-transparent px-4 py-2 text-sm outline-none text-slate-700" placeholder="Digite aqui..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
              <button onClick={handleSend} disabled={loading} className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-sm"><Send size={18} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default TacticalAssistant;

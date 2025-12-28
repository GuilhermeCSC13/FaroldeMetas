import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getGeminiFlash } from '../../services/gemini';
import { X, Send, Bot, Loader2, Trash2, CalendarClock, ArrowRight } from 'lucide-react';
import { salvarReuniao } from '../../services/agendaService';
import { useNavigate } from 'react-router-dom';

const TacticalAssistant = () => {
  const navigate = useNavigate(); 
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const welcomeMsg = { role: 'assistant', text: 'Olá. Tenho acesso à sua Agenda e Atas. \n\nPosso:\n1. Resumir o que foi decidido nas reuniões.\n2. Agendar novos compromissos.' };

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
        
        // Busca agenda futura
        const { data: agenda } = await supabase
            .from('reunioes')
            .select('titulo, data_hora, tipo_reuniao')
            .gte('data_hora', hoje)
            .order('data_hora', { ascending: true })
            .limit(10);

        // Busca histórico passado 
        const { data: historico } = await supabase
            .from('reunioes')
            .select('titulo, data_hora, pauta, status')
            .lte('data_hora', hoje)
            .order('data_hora', { ascending: false })
            .limit(5);

        let contexto = `\n--- 📅 AGENDA FUTURA ---\n`;
        if (agenda?.length) {
            agenda.forEach(r => contexto += `- ${new Date(r.data_hora).toLocaleDateString()} ${new Date(r.data_hora).toLocaleTimeString().slice(0,5)}: ${r.titulo}\n`);
        } else { contexto += "(Livre)\n"; }

        contexto += `\n--- 📚 HISTÓRICO DE REUNIÕES (PASSADO) ---\n`;
        if (historico?.length) {
            historico.forEach(r => {
                const temPauta = r.pauta && r.pauta.length > 20;
                contexto += `- Reunião: "${r.titulo}" (${new Date(r.data_hora).toLocaleDateString()})\n`;
                contexto += `  STATUS ATA: ${temPauta ? 'CRIADA' : 'PENDENTE'}\n`;
                contexto += `  CONTEÚDO: ${temPauta ? r.pauta.substring(0, 800) : '(Vazio - Usuário precisa gravar no Copiloto)'}\n\n`;
            });
        } else { contexto += "(Sem histórico recente)\n"; }

        return contexto;
    } catch (err) { return ""; }
  };

  // --- 3. PROCESSAMENTO DA IA ---
  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const dadosContexto = await buscarContextoDados();
      const model = getGeminiFlash();

      const prompt = `
        Você é o Assistente do Farol Tático.
        
        DADOS REAIS (Não invente nada fora disso):
        ${dadosContexto}

        HOJE: ${new Date().toLocaleString('pt-BR')}

        INSTRUÇÕES ESTRITAS:
        1. Se o usuário perguntar sobre uma reunião passada:
           - Verifique o campo "STATUS ATA" nos dados acima.
           - Se for "CRIADA": Resuma o "CONTEÚDO" listado.
           - Se for "PENDENTE" ou Vazio: Responda EXATAMENTE: "Ata_Missing" (apenas essa palavra).
        
        2. Se for para agendar reunião futura:
           - Retorne JSON: { "intent": "schedule", "titulo": "...", "data": "YYYY-MM-DD", "hora": "HH:MM" }

        PERGUNTA DO USUÁRIO: "${userMsg}"
      `;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();

      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

      if (cleanText.includes('Ata_Missing')) {
        setMessages(prev => [...prev, { 
            role: 'assistant', 
            type: 'action_required',
            text: "Esta reunião ocorreu, mas a Ata ainda não foi gerada pela IA.",
            action: 'copiloto'
        }]);
      } 
      else if (cleanText.startsWith('{') && cleanText.includes('"intent": "schedule"')) {
        await handleCreateMeetingIntent(cleanText);
      } 
      else {
        setMessages(prev => [...prev, { role: 'assistant', text: text }]);
      }

    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', text: "Erro ao processar." }]);
    } finally {
      setLoading(false);
    }
  };

  // --- 4. AGENDAMENTO ---
  const handleCreateMeetingIntent = async (dadosJSON) => {
    try {
        const dados = JSON.parse(dadosJSON);
        if (!dados.hora) dados.hora = "09:00"; 
        if (!dados.titulo) dados.titulo = "Reunião";
        setMessages(prev => [...prev, { role: 'assistant', type: 'confirmation', data: dados, text: `Confirmar agendamento?` }]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', text: "Erro nos dados." }]);
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
            pauta: ''
        }, 'unica');
        setMessages(prev => [...prev, { role: 'assistant', text: `✅ Agendado: ${dados.titulo}.` }]);
    } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', text: "Erro ao salvar." }]);
    } finally {
        setLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 z-50 border-2 border-blue-500">
          <Bot size={28} />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-slate-200 overflow-hidden font-sans animate-in slide-in-from-bottom-10">
          <div className="bg-slate-900 p-4 flex justify-between items-center text-white border-b border-blue-900">
            <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg"><Bot size={16} /></div>
                <div><h3 className="font-bold text-sm">Copiloto</h3><p className="text-[10px] text-blue-200">Online</p></div>
            </div>
            <div className="flex gap-1">
                <button onClick={clearChat} className="p-2 hover:bg-white/10 rounded-lg"><Trash2 size={16}/></button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={18}/></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                {msg.type === 'confirmation' ? (
                    <div className="bg-white border border-blue-200 p-4 rounded-xl shadow-md w-[90%]">
                        <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold text-xs uppercase"><CalendarClock size={14}/> Agendar</div>
                        <p className="text-sm mb-3"><strong>{msg.data.titulo}</strong><br/>{msg.data.data} às {msg.data.hora}</p>
                        <div className="flex gap-2">
                            <button onClick={() => confirmarAgendamento(msg.data)} className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-lg">Confirmar</button>
                            <button className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-lg">Cancelar</button>
                        </div>
                    </div>
                ) : msg.type === 'action_required' ? (
                    <div className="bg-white border border-orange-200 p-4 rounded-xl shadow-md w-[90%]">
                        <p className="text-sm text-slate-700 mb-3">{msg.text}</p>
                        <button 
                            onClick={() => { setIsOpen(false); navigate('/copiloto'); }} 
                            className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                            Ir para Copiloto (Gerar Ata) <ArrowRight size={14}/>
                        </button>
                    </div>
                ) : (
                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm whitespace-pre-line ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'}`}>
                        {msg.text}
                    </div>
                )}
              </div>
            ))}
            {loading && <div className="flex items-center gap-2 text-slate-400 text-xs pl-2"><Loader2 size={14} className="animate-spin text-blue-500"/>Processando...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-slate-100">
            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-full border border-slate-200">
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

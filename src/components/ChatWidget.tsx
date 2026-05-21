import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, X, MessageSquare, Sparkles, User, ShieldCheck, ArrowRight, CornerDownLeft, RefreshCw 
} from 'lucide-react';
import { ChatSession, Message, KnowledgeConfig } from '../types';

interface ChatWidgetProps {
  config: KnowledgeConfig;
  session: ChatSession | null;
  onStartSession: (visitor: { name: string; email: string; phone: string; department: string }) => void;
  onSendMessage: (text: string) => void;
  onTakeoverToggle: (val: boolean) => void;
  onClose?: () => void;
}

export default function ChatWidget({
  config,
  session,
  onStartSession,
  onSendMessage,
  onTakeoverToggle,
  onClose
}: ChatWidgetProps) {
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorDept, setVisitorDept] = useState('MBBS Admissions');
  const [inputMsg, setInputMsg] = useState('');
  const [validationError, setValidationError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages]);

  const handleSubmitStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim() || !visitorEmail.trim()) {
      setValidationError('Provide both Name & Email to begin consultation.');
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(visitorEmail)) {
      setValidationError('Please use a valid email address.');
      return;
    }
    setValidationError('');
    onStartSession({
      name: visitorName,
      email: visitorEmail,
      phone: visitorPhone,
      department: visitorDept
    });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    onSendMessage(inputMsg);
    setInputMsg('');
  };

  const quickQuestions = [
    "How structural is MBBS admission for international candidates?",
    "What are the outpatient department schedules for cardiologists?",
    "Do you offer AC hostels for student accommodation?"
  ];

  return (
    <div id="rcmc-ai-support-window" className="w-full h-full bg-white flex flex-col rounded-xl border border-neutral-200 overflow-hidden shadow-xl font-sans">
      
      {/* Widget Custom Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 shrink-0 flex items-center justify-between border-b border-emerald-950">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center font-bold text-lg text-emerald-800 border-2 border-emerald-550 shadow-sm">
            🏥
          </div>
          <div>
            <h4 className="font-extrabold text-sm tracking-tight leading-tight uppercase">RCMC Support Chat</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider font-mono">
                {session?.takeover ? 'Expert Officer Connected' : 'Support Assistant Active'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {session && (
            <span className="bg-emerald-950 text-emerald-300 font-mono text-[9px] px-2 py-0.5 rounded-md border border-emerald-800">
              ID: {session.id.split('-').slice(-2).join('-')}
            </span>
          )}
          {onClose && (
            <button 
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-emerald-950/40 rounded transition-colors text-emerald-250 hover:text-white cursor-pointer"
              title="Minimize Chat"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Discussion Feed */}
      <div className="flex-1 overflow-y-auto p-4 bg-neutral-50 flex flex-col space-y-3.5 min-h-0">
        
        {!session ? (
          /* CONNECTING LOADER */
          <div className="my-auto text-center space-y-4 p-6">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xl border-2 border-emerald-300 shadow-sm mx-auto animate-bounce">
              🏥
            </div>
            <div>
              <h5 className="font-bold text-neutral-800 text-sm tracking-wide">Initializing Medical Advisor...</h5>
              <p className="text-neutral-500 text-[11px] mt-1.5 leading-relaxed max-w-xs mx-auto">
                Setting up your secure support session. No login required.
              </p>
            </div>
            <div className="flex justify-center items-center gap-1">
              <span className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        ) : (
          /* CONVERSATION LOG */
          <>
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-2.5 text-[10px] leading-relaxed flex items-start gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                Session established for <strong>{session.visitorName}</strong> ({session.department}). Answers generate from live RCMC customized database configurations.
              </div>
            </div>

            {session.messages.map((m) => {
              const isUser = m.sender === 'visitor';
              const isSystem = m.sender === 'system';
              
              if (isSystem) {
                return (
                  <div key={m.id} className="text-center my-2.5">
                    <span className="inline-block bg-neutral-200 text-neutral-700 text-[9px] font-bold py-0.5 px-3 rounded-full border border-neutral-300">
                      {m.text}
                    </span>
                  </div>
                );
              }

              return (
                <div 
                  key={m.id} 
                  className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-emerald-100 border border-emerald-300 text-emerald-800">
                      {m.sender === 'ai' ? '🤖' : '👩‍⚕️'}
                    </div>
                  )}
                  <div className="max-w-[80%]">
                    <div className={`text-[8px] text-neutral-400 mb-0.5 ${isUser ? 'text-right' : 'text-left'}`}>
                      <span className="font-bold text-neutral-600">{m.senderName}</span> • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap ${isUser ? 'bg-emerald-700 text-white rounded-tr-none' : 'bg-white text-neutral-800 border border-neutral-200 shadow-2xs rounded-tl-none'}`}>
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input box section */}
      {session && (
        <div className="border-t border-neutral-200 p-3 bg-white shrink-0 space-y-2">
          
          {/* Quick inquiries template helper */}
          {!session.takeover && (
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hidden">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(q)}
                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border border-neutral-200 text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 transition-all cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Quick call response team layout */}
          <div className="bg-amber-50 rounded-lg p-2 border border-amber-100 flex items-center justify-between text-[9px]">
            <span className="font-semibold text-amber-900">Need real hospital support operator input?</span>
            <button
              onClick={() => onTakeoverToggle(!session.takeover)}
              className={`font-bold px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${session.takeover ? 'bg-red-100 border-red-200 text-red-700' : 'bg-emerald-750 text-white border-emerald-850'}`}
            >
              {session.takeover ? 'Switch to Automated' : 'Call Desk Officer'}
            </button>
          </div>

          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={inputMsg}
              required
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Ask an admission question here..."
              className="flex-1 text-xs border border-neutral-200 rounded-lg px-3 py-2.5 bg-neutral-25 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
            />
            <button 
              type="submit"
              className="bg-emerald-750 hover:bg-emerald-650 text-white rounded-lg p-2.5 flex items-center justify-center cursor-pointer transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

    </div>
  );
}

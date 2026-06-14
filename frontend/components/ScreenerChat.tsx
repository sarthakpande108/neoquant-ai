import React, { useState, useRef, useEffect } from 'react';
import type { TickerInfo } from '../types';
import { ALL_TICKERS } from '../services/tickerData';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  tickers?: string[];
}

interface Props {
  onSelectTicker: (ticker: TickerInfo) => void;
}

export const ScreenerChat: React.FC<Props> = ({ onSelectTicker }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: "I am NeoQuant Screener. Tell me what kind of stocks you're looking for. E.g., 'Find me undervalued banks with good momentum' or 'What are the top IT stocks?'",
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const query = inputValue.trim();
    setInputValue('');
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const allTickersString = ALL_TICKERS.map(t => `${t.symbol} | ${t.name} | ${t.sector}`).join('\n');
      
      const response = await fetch(`${backendUrl}/api/chat-screener`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          chatHistory: messages.map(m => ({ role: m.role, content: m.content })),
          allTickersString
        }),
      });

      if (!response.ok) throw new Error('Screener request failed');
      const data = await response.json();

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.text || "Here are some matches I found.",
        tickers: data.matchedTickers || [],
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "⚠ ERROR: Connection failed. My brain is temporarily offline.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-[600px] flex flex-col neo-card-flat bg-slate-50 border-2 border-black overflow-hidden">
      {/* Header */}
      <div className="bg-neo-purple border-b-[3px] border-black p-4 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-full border-2 border-black bg-white flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          🤖
        </div>
        <div>
          <h2 className="font-black text-black uppercase tracking-tight text-lg leading-none">NeoQuant Screener</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest text-black/70">AI Powered Search</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
              msg.role === 'user' ? 'bg-neo-lime' : 'bg-white'
            }`}>
              <p className="font-bold text-black text-sm whitespace-pre-wrap">{msg.content}</p>
              
              {/* Render Stock Cards if any */}
              {msg.tickers && msg.tickers.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Matched Instruments:</p>
                  <div className="flex flex-col gap-2">
                    {msg.tickers.map(sym => {
                      const info = ALL_TICKERS.find(t => t.symbol === sym);
                      return info ? (
                        <button
                          key={sym}
                          onClick={() => onSelectTicker(info)}
                          className="text-left w-full border-2 border-black bg-slate-100 hover:bg-neo-yellow transition-colors p-2 flex justify-between items-center group"
                        >
                          <div>
                            <div className="font-black text-sm uppercase text-black">{info.name.split(' ')[0]}</div>
                            <div className="text-[10px] font-bold text-slate-600">{info.symbol}</div>
                          </div>
                          <span className="font-black text-xs px-2 py-1 bg-black text-white group-hover:bg-white group-hover:text-black transition-colors">
                            ANALYZE ↗
                          </span>
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex gap-1">
              <div className="w-2 h-2 bg-black rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t-[3px] border-black shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="E.g., 'Find oversold auto stocks...'"
            className="flex-1 neo-input"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="neo-btn bg-black text-white hover:bg-neo-yellow hover:text-black px-6"
          >
            {isLoading ? '...' : 'SEND'}
          </button>
        </form>
      </div>
    </div>
  );
};

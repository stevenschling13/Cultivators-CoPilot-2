

import React, { useState, useRef, useEffect, memo } from 'react';
import { Send, Image as ImageIcon, Sparkles, ExternalLink, Terminal, ChevronUp, ChevronDown, Trash2, X } from 'lucide-react';
import { ChatMessage, ChatAttachment, GrowLog, GrowSetup, PlantBatch, EnvironmentReading, CalculatedMetrics, LogProposal } from '../types';
import { geminiService } from '../services/geminiService';
import { Haptic } from '../utils/haptics';
import { ImageUtils } from '../services/imageUtils';
import { AnalysisCard } from './ui/AnalysisCard';

interface ChatInterfaceProps {
  context: GrowSetup;
  batches: PlantBatch[];
  logs: GrowLog[];
  envReading?: EnvironmentReading | null;
  metrics?: CalculatedMetrics;
  onLogProposal: (log: LogProposal) => void;
}

// --- Memoized Sub-Components to prevent Re-renders on 1Hz Telemetry ---

const ChatHeader = memo(({ 
  showContextDetails, 
  setShowContextDetails, 
  envReading, 
  metrics, 
  batchesCount,
  onClearHistory
}: { 
  showContextDetails: boolean, 
  setShowContextDetails: (v: boolean) => void, 
  envReading?: EnvironmentReading | null, 
  metrics?: CalculatedMetrics, 
  batchesCount: number,
  onClearHistory: () => void
}) => (
  <div className="pt-safe-top bg-[#080808]/90 backdrop-blur-xl border-b border-white/5 z-30">
     <div className="px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neon-green/10 rounded-lg border border-neon-green/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-neon-green" />
            </div>
            <div>
                <h2 className="font-mono font-bold text-xs text-white tracking-widest uppercase">Copilot v3.1</h2>
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse shadow-[0_0_5px_currentColor]"></span>
                    <span className="text-[9px] text-gray-500 font-mono uppercase">System Online</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
               onClick={() => { Haptic.tap(); onClearHistory(); }}
               className="p-1.5 rounded-md border border-white/10 bg-white/5 text-gray-400 hover:text-alert-red hover:bg-alert-red/10 transition-colors"
               title="Clear Memory"
            >
                <Trash2 className="w-3 h-3" />
            </button>
            <button 
               onClick={() => setShowContextDetails(!showContextDetails)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[10px] font-mono transition-all ${showContextDetails ? 'bg-neon-green/10 border-neon-green text-neon-green' : 'bg-white/5 border-white/10 text-gray-400'}`}
            >
                CONTEXT_STREAM
                {showContextDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
        </div>
     </div>

     {showContextDetails && (
        <div className="px-4 pb-4 animate-slide-down border-t border-white/5 pt-4 bg-[#0a0a0a]">
           <div className="grid grid-cols-3 gap-2 font-mono">
              <div className="p-2 bg-black border border-white/10 rounded">
                  <div className="text-[8px] text-gray-500 uppercase mb-1">Temp/RH</div>
                  <div className="text-[10px] text-neon-blue">{envReading ? `${envReading.temperature.toFixed(1)}° / ${envReading.humidity.toFixed(0)}%` : '--'}</div>
              </div>
              <div className="p-2 bg-black border border-white/10 rounded">
                  <div className="text-[8px] text-gray-500 uppercase mb-1">VPD</div>
                  <div className="text-[10px] text-neon-green">{metrics?.vpd.toFixed(2) || '--'} kPa</div>
              </div>
               <div className="p-2 bg-black border border-white/10 rounded">
                  <div className="text-[8px] text-gray-500 uppercase mb-1">Batches</div>
                  <div className="text-[10px] text-white">{batchesCount} Active</div>
              </div>
           </div>
        </div>
     )}
  </div>
));

ChatHeader.displayName = 'ChatHeader';

const MessageBubble = memo(({ msg, onLogSave }: { msg: ChatMessage, onLogSave: (log: LogProposal) => void }) => {
  const isUser = msg.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-slide-up group`}>
       <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
          
          {/* Metadata / Name */}
          <div className={`text-[10px] font-mono text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
             <span className={isUser ? 'text-neon-blue' : 'text-neon-green'}>{isUser ? 'OPERATOR' : 'GEMINI 3 PRO'}</span>
             <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>

          <div className={`
             relative rounded-2xl p-4 border backdrop-blur-sm shadow-sm transition-all duration-300
             ${isUser 
                ? 'bg-neon-blue/10 border-neon-blue/20 rounded-tr-sm text-white' 
                : 'bg-[#121212] border-white/10 rounded-tl-sm text-gray-200'}
          `}>
             {msg.attachment && (
                <div className="mb-3 rounded-lg overflow-hidden border border-white/10 bg-black/50">
                    <img src={msg.attachment.url} alt="Attachment" className="max-w-full h-auto max-h-48 object-contain mx-auto" />
                </div>
             )}

             {msg.isThinking ? (
                <div className="flex items-center gap-2 text-neon-green text-xs font-mono animate-pulse">
                   <Terminal className="w-3 h-3" />
                   <span>ANALYZING BIO-METRICS...</span>
                </div>
             ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                   {msg.text}
                </div>
             )}

             {/* Tool Call Result: Log Proposal */}
             {msg.toolCallPayload && (
                 <AnalysisCard data={msg.toolCallPayload} onSave={() => onLogSave(msg.toolCallPayload!)} />
             )}

             {/* Grounding Citations */}
             {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                 <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                     {msg.groundingUrls.map((g, i) => (
                         <a 
                             key={i} 
                             href={g.uri} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="text-[10px] flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-gray-400 hover:text-white transition-colors border border-white/5"
                         >
                             <ExternalLink className="w-2.5 h-2.5" />
                             {g.title || new URL(g.uri).hostname}
                         </a>
                     ))}
                 </div>
             )}
          </div>
       </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

// --- Main Component ---

export const ChatInterface = memo(({ context, batches, logs, envReading, metrics, onLogProposal }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachment | undefined>(undefined);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load History
  useEffect(() => {
    try {
        const saved = localStorage.getItem('chatHistory');
        if (saved) {
            setMessages(JSON.parse(saved));
        } else {
            // Initial Welcome Message
            setMessages([{
                id: 'init',
                role: 'model',
                text: "Systems Online. I have full access to your environment telemetry and batch history. Ready for diagnostic queries.",
                timestamp: Date.now()
            }]);
        }
    } catch(e) { console.error("History load failed", e); }
  }, []);

  // Save History
  useEffect(() => {
    if (messages.length > 0) {
        localStorage.setItem('chatHistory', JSON.stringify(messages.slice(-50))); // Keep last 50
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleClearHistory = () => {
    localStorage.removeItem('chatHistory');
    setMessages([{
        id: crypto.randomUUID(),
        role: 'model',
        text: "Memory cleared. Starting fresh session.",
        timestamp: Date.now()
    }]);
    Haptic.success();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const processed = await ImageUtils.processImage(file);
        setAttachment({
            type: 'image',
            url: processed.full,
            mimeType: file.type
        });
        Haptic.success();
    } catch (err) {
        console.error(err);
        Haptic.error();
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isThinking) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input,
      timestamp: Date.now(),
      attachment
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachment(undefined);
    setIsThinking(true);
    Haptic.tap();

    // Prepare Model Placeholder
    const modelMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, {
        id: modelMsgId,
        role: 'model',
        text: '',
        timestamp: Date.now(),
        isThinking: true
    }]);

    try {
      const chatContext = {
         setup: context,
         environment: envReading || undefined,
         metrics: metrics,
         batches: batches,
         recentLogs: logs.slice(0, 5)
      };

      await geminiService.chatStream(
        messages, // Pass full history (service handles formatting)
        userMsg.text,
        userMsg.attachment?.url || null, // Image context if present
        chatContext,
        (chunkText, grounding) => {
           setMessages(prev => prev.map(m => {
               if (m.id === modelMsgId) {
                   return {
                       ...m,
                       isThinking: false,
                       text: m.text + chunkText,
                       groundingUrls: grounding?.groundingChunks?.map((c: any) => c.web).filter(Boolean)
                   };
               }
               return m;
           }));
        },
        (toolPayload) => {
           setMessages(prev => prev.map(m => {
               if (m.id === modelMsgId) {
                   return { ...m, toolCallPayload: toolPayload };
               }
               return m;
           }));
           Haptic.success();
        }
      );

    } catch (e) {
       console.error(e);
       setMessages(prev => prev.map(m => {
           if (m.id === modelMsgId) {
               return { ...m, isThinking: false, text: "Connection interrupted. Please retry." };
           }
           return m;
       }));
       Haptic.error();
    } finally {
       setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] relative">
      <ChatHeader 
         showContextDetails={showContextDetails} 
         setShowContextDetails={setShowContextDetails}
         envReading={envReading}
         metrics={metrics}
         batchesCount={batches.length}
         onClearHistory={handleClearHistory}
      />

      <div className="flex-1 overflow-y-auto p-4 pb-32 no-scrollbar scroll-smooth">
         {messages.map(m => (
            <MessageBubble key={m.id} msg={m} onLogSave={onLogProposal} />
         ))}
         <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black to-transparent pb-safe-bottom z-30">
         {attachment && (
            <div className="mb-2 inline-flex items-center gap-2 bg-[#111] px-3 py-2 rounded-xl border border-white/10 animate-slide-up">
                <img src={attachment.url} className="w-8 h-8 rounded object-cover" alt="preview" />
                <span className="text-xs text-gray-400">Attached</span>
                <button onClick={() => setAttachment(undefined)} className="ml-2 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
         )}
         
         <div className="flex items-end gap-2 bg-[#121212] border border-white/10 rounded-[24px] p-2 pl-4 shadow-2xl focus-within:border-neon-green/50 transition-colors">
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="mb-2 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
                <ImageIcon className="w-5 h-5" />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload}
            />
            
            <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Ask Copilot about your grow..."
                className="flex-1 bg-transparent text-white text-sm max-h-32 py-3 focus:outline-none placeholder-gray-600 resize-none font-sans"
                rows={1}
            />

            <button 
                onClick={handleSend}
                disabled={(!input && !attachment) || isThinking}
                className={`
                   mb-1 p-3 rounded-full transition-all active:scale-90
                   ${(!input && !attachment) || isThinking ? 'bg-white/5 text-gray-600' : 'bg-neon-green text-black shadow-[0_0_15px_rgba(0,255,163,0.4)]'}
                `}
            >
                {isThinking ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Send className="w-5 h-5" />
                )}
            </button>
         </div>
      </div>
    </div>
  );
}
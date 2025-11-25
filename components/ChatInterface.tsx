import React, { useState, useRef, useEffect, memo } from 'react';
import { Send, Image as ImageIcon, Sparkles, X, Zap, Terminal, Plus } from 'lucide-react';
import { ChatMessage, ChatAttachment, GrowLog, GrowSetup, PlantBatch, EnvironmentReading, CalculatedMetrics, LogProposal } from '../types';
import { geminiService } from '../services/geminiService';
import { dbService } from '../services/db';
import { Haptic } from '../utils/haptics';
import { ImageUtils } from '../services/imageUtils';
import { generateUUID } from '../utils/uuid';
import { ChatHeader } from './chat/ChatHeader';
import { MessageBubble } from './chat/MessageBubble';

interface ChatInterfaceProps {
  context: GrowSetup;
  batches: PlantBatch[];
  logs: GrowLog[];
  envReading?: EnvironmentReading | null;
  metrics?: CalculatedMetrics;
  onLogProposal: (log: LogProposal) => void;
  onOpenCamera: () => void;
}

const QUICK_PROMPTS = [
    "Diagnose recent issues",
    "Check VPD status",
    "Log a watering event",
    "Recommend nutrients",
    "Analyze growth rate"
];

export const ChatInterface = memo(({ context, batches, logs, envReading, metrics, onLogProposal, onOpenCamera }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachment | undefined>(undefined);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load History from IndexedDB
  useEffect(() => {
    const loadHistory = async () => {
        try {
            const history = await dbService.getChatHistory(50);
            if (history.length > 0) {
                setMessages(history);
            } else {
                // Initial Welcome Message
                const welcomeMsg: ChatMessage = {
                    id: generateUUID(),
                    role: 'model',
                    text: "Systems Online. I have full access to your environment telemetry and batch history. Ready for diagnostic queries.",
                    timestamp: Date.now()
                };
                setMessages([welcomeMsg]);
                await dbService.saveChatMessage(welcomeMsg);
            }
        } catch(e) { console.error("History load failed", e); }
    };
    loadHistory();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleClearHistory = async () => {
    await dbService.clearChatHistory();
    const newMsg: ChatMessage = {
        id: generateUUID(),
        role: 'model',
        text: "Memory cleared. Starting fresh session.",
        timestamp: Date.now()
    };
    setMessages([newMsg]);
    await dbService.saveChatMessage(newMsg);
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

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if ((!textToSend.trim() && !attachment) || isThinking) return;

    const userMsg: ChatMessage = {
      id: generateUUID(),
      role: 'user',
      text: textToSend,
      timestamp: Date.now(),
      attachment
    };

    setMessages(prev => [...prev, userMsg]);
    dbService.saveChatMessage(userMsg);
    setInput('');
    setAttachment(undefined);
    setIsThinking(true);
    Haptic.tap();

    // Prepare Model Placeholder
    const modelMsgId = generateUUID();
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
        async (toolName, toolPayload) => {
           if (toolName === 'proposeLog') {
               const proposal = toolPayload as unknown as LogProposal;
               setMessages(prev => {
                   const updated = prev.map(m => {
                       if (m.id === modelMsgId) {
                           return { ...m, toolCallPayload: proposal };
                       }
                       return m;
                   });
                   const finalMsg = updated.find(m => m.id === modelMsgId);
                   if (finalMsg) dbService.saveChatMessage(finalMsg);
                   return updated;
               });
               Haptic.success();
           } else if (toolName === 'openCamera') {
               Haptic.success();
               onOpenCamera();
               const finalMsg = {
                   id: modelMsgId,
                   role: 'model' as const,
                   text: 'Opening optical scanner...',
                   timestamp: Date.now(),
                   isThinking: false
               };
               dbService.saveChatMessage(finalMsg);
           }
        }
      );

      setTimeout(() => {
          setMessages(currentMessages => {
              const lastMsg = currentMessages.find(m => m.id === modelMsgId);
              if (lastMsg && !lastMsg.isThinking) {
                  dbService.saveChatMessage(lastMsg);
              }
              return currentMessages;
          });
      }, 1000);

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
    <div className="flex flex-col h-full bg-[#050505] relative overflow-hidden">
      <ChatHeader 
         showContextDetails={showContextDetails} 
         setShowContextDetails={setShowContextDetails}
         envReading={envReading}
         metrics={metrics}
         batchesCount={batches.length}
         onClearHistory={handleClearHistory}
      />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 safe-area-bottom pb-28 mask-gradient-top scroll-smooth">
         {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60 px-6 text-center animate-fade-in">
               <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.03)]">
                  <Terminal className="w-10 h-10 text-neon-green" />
               </div>
               <p className="text-xs font-mono uppercase tracking-widest mb-8 text-gray-400">System Ready</p>
               
               <div className="flex flex-wrap justify-center gap-3 max-w-sm">
                   {QUICK_PROMPTS.map(prompt => (
                       <button 
                          key={prompt}
                          onClick={() => handleSend(prompt)}
                          className="px-4 py-2 rounded-xl bg-[#111] border border-white/10 text-[10px] font-bold font-mono text-gray-400 hover:text-neon-green hover:border-neon-green/30 transition-all active:scale-95 flex items-center gap-2"
                       >
                           <Zap className="w-3 h-3" />
                           {prompt}
                       </button>
                   ))}
               </div>
            </div>
         ) : (
            messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onLogSave={onLogProposal} />
            ))
         )}
         
         {/* Invisible element to scroll to */}
         <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-safe-bottom pt-2 bg-gradient-to-t from-black via-black/90 to-transparent">
         <div className="glass-panel rounded-[24px] p-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all focus-within:border-neon-green/30 focus-within:shadow-[0_0_30px_rgba(0,255,163,0.1)] mb-4">
            
            {attachment && (
               <div className="mx-2 mt-2 mb-2 flex items-center gap-3 bg-[#111] p-2 rounded-xl border border-white/10 animate-slide-up">
                  <div className="w-12 h-12 rounded-lg bg-black/50 overflow-hidden border border-white/5 shrink-0">
                      <img src={attachment.url} className="w-full h-full object-cover" alt="preview" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[10px] text-neon-green font-bold uppercase tracking-wide truncate">Analysis Mode</span>
                      <span className="text-[9px] text-gray-500 font-mono truncate">Image appended to context</span>
                  </div>
                  <button onClick={() => setAttachment(undefined)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                     <X className="w-4 h-4 text-gray-400" />
                  </button>
               </div>
            )}

            <div className="flex items-end gap-2">
               <button 
                  onClick={() => { Haptic.tap(); fileInputRef.current?.click(); }}
                  className={`p-3.5 rounded-2xl transition-all active:scale-95 ${attachment ? 'bg-neon-green/10 text-neon-green' : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5'}`}
               >
                  <Plus className="w-5 h-5" />
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
                  placeholder="Ask Gemini..."
                  className="flex-1 bg-transparent border-none text-white text-sm placeholder-gray-600 focus:ring-0 resize-none py-3.5 max-h-32 font-sans leading-relaxed"
                  rows={1}
               />

               <button 
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && !attachment) || isThinking}
                  className={`
                     p-3.5 rounded-2xl transition-all font-bold active:scale-95
                     ${(!input.trim() && !attachment) || isThinking 
                        ? 'bg-white/5 text-gray-600 cursor-not-allowed' 
                        : 'bg-neon-green text-black shadow-[0_0_20px_rgba(0,255,163,0.3)] hover:bg-neon-green/90'}
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
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';
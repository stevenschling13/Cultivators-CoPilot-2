
import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Sparkles, ExternalLink } from 'lucide-react';
import { ChatMessage, ChatAttachment, GrowLog, GrowSetup } from '../types';
import { geminiService } from '../services/geminiService';
import { Haptic } from '../utils/haptics';
import { ImageUtils } from '../services/imageUtils';
import { AnalysisCard } from './ui/AnalysisCard';

interface ChatInterfaceProps {
  context: GrowSetup;
  onLogProposal: (log: Partial<GrowLog>) => void;
}

const SUGGESTED_PROMPTS = [
  "Analyze this plant image",
  "Check for nutrient deficiencies",
  "Estimate days to harvest",
  "Is my VPD optimal?",
  "Identify these pests"
];

export const ChatInterface = ({ context, onLogProposal }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "I'm connected to your grow environment. Upload a photo for a health check or ask me anything.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if ((!textToSend.trim() && !attachment) || isTyping) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: textToSend,
      timestamp: Date.now(),
      attachment: attachment || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachment(null);
    setIsTyping(true);
    Haptic.light();

    const currentHistory = messages.concat(userMsg);
    let responseText = '';
    let currentId = crypto.randomUUID();

    // Create placeholder for model response
    setMessages(prev => [...prev, { id: currentId, role: 'model', text: '', timestamp: Date.now(), isThinking: true }]);

    try {
      await geminiService.chatStream(
        currentHistory, 
        userMsg.text, 
        userMsg.attachment?.url || null, 
        { context },
        (chunk, grounding) => {
          responseText += chunk;
          setMessages(prev => prev.map(m => 
            m.id === currentId 
              ? { ...m, text: responseText, isThinking: false, groundingUrls: grounding?.groundingChunks?.map((c: any) => c.web?.uri ? { uri: c.web.uri, title: c.web.title } : null).filter(Boolean) } 
              : m
          ));
        },
        (toolPayload) => {
            // Update the placeholder message to include the tool payload and final text
            setMessages(prev => prev.map(m => 
                m.id === currentId 
                ? { 
                    ...m, 
                    text: "I've analyzed the data.", 
                    isThinking: false,
                    toolCallPayload: toolPayload 
                  } 
                : m
            ));
            Haptic.success();
        }
      );
    } catch (e: any) {
      console.error("Chat Interaction Error:", e);
      
      let friendlyError = "I lost connection to the neural network. Please check your internet and try again.";
      
      if (e.message) {
        if (e.message.includes('429')) {
          friendlyError = "I'm receiving too many requests right now. Please wait a moment before trying again.";
        } else if (e.message.includes('503') || e.message.includes('Overloaded')) {
          friendlyError = "The system is currently overloaded. Please try again in a minute.";
        } else if (e.message.includes('SAFETY')) {
          friendlyError = "I couldn't process that request due to safety guidelines. Please try rephrasing.";
        }
      }
      
      setMessages(prev => prev.map(m => m.id === currentId ? { 
        ...m, 
        text: friendlyError, 
        isThinking: false 
      } : m));
      Haptic.error();
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const base64 = await ImageUtils.compressImage(file);
      setAttachment({
        type: 'image',
        url: base64,
        mimeType: file.type
      });
      Haptic.tap();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3 pt-safe-top bg-black/80 backdrop-blur-md sticky top-0 z-20">
         <div className="p-2 bg-gradient-to-tr from-neon-green to-neon-blue rounded-full shadow-[0_0_15px_rgba(0,255,163,0.3)]">
            <Sparkles className="w-5 h-5 text-black fill-current" />
         </div>
         <div>
             <h2 className="font-bold text-sm text-white">Gemini Command</h2>
             <div className="text-[10px] text-neon-green font-mono uppercase tracking-widest flex items-center gap-1">
                 <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse"></span>
                 Online
             </div>
         </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
         {messages.map(msg => (
             <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[90%] md:max-w-[80%] space-y-2`}>
                     {msg.attachment && (
                         <div className="mb-2 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                            <img src={msg.attachment.url} alt="Attachment" className="max-h-64 w-full object-cover" />
                         </div>
                     )}
                     
                     {msg.text && (
                         <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                             msg.role === 'user' 
                             ? 'bg-white/10 text-white rounded-tr-sm' 
                             : 'bg-[#1A1A1A] border border-white/5 text-gray-200 rounded-tl-sm shadow-md'
                         }`}>
                             {msg.text}
                         </div>
                     )}

                     {msg.isThinking && (
                        <div className="flex gap-1 pl-2 items-center h-6">
                             <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '0ms'}}></div>
                             <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '150ms'}}></div>
                             <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '300ms'}}></div>
                        </div>
                     )}

                     {/* Grounding Chips */}
                     {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                           {msg.groundingUrls.map((url, idx) => (
                               <a 
                                 key={idx} 
                                 href={url.uri} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="flex items-center gap-1 px-2 py-1 bg-[#0F0F0F] border border-white/5 rounded-full text-[10px] text-gray-400 hover:text-neon-blue transition-colors"
                               >
                                  <ExternalLink className="w-3 h-3" />
                                  <span className="truncate max-w-[150px]">{url.title}</span>
                               </a>
                           ))}
                        </div>
                     )}

                     {/* Rich Analysis Card */}
                     {msg.toolCallPayload && (
                        <AnalysisCard 
                           data={msg.toolCallPayload} 
                           onSave={() => onLogProposal(msg.toolCallPayload!)} 
                        />
                     )}
                 </div>
             </div>
         ))}
         <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 pt-2 bg-black/90 backdrop-blur-xl border-t border-white/10 pb-safe-bottom space-y-3">
         
         {/* Suggestion Chips */}
         {!attachment && messages.length < 4 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mask-fade-right">
               {SUGGESTED_PROMPTS.map(prompt => (
                  <button 
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="flex-shrink-0 px-3 py-1.5 bg-white/5 border border-white/5 rounded-full text-[11px] text-gray-300 hover:bg-white/10 hover:border-neon-green/30 hover:text-white transition-all whitespace-nowrap"
                  >
                    {prompt}
                  </button>
               ))}
            </div>
         )}

         {attachment && (
            <div className="flex items-center gap-2 p-2 bg-[#1A1A1A] rounded-xl w-full border border-white/10 animate-slide-up">
                <div className="w-10 h-10 rounded-lg bg-gray-800 overflow-hidden shrink-0">
                    <img src={attachment.url} className="w-full h-full object-cover" alt="preview"/>
                </div>
                <div className="flex-1 min-w-0">
                   <div className="text-xs text-white font-medium truncate">Image ready for analysis</div>
                   <div className="text-[10px] text-gray-500">Gemini 3 Pro will scan for pests & deficiencies</div>
                </div>
                <button onClick={() => setAttachment(null)} className="p-2 text-gray-500 hover:text-white"><div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">×</div></button>
            </div>
         )}

         <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-3xl p-1 pl-4 border border-white/10 focus-within:border-neon-green/50 transition-colors shadow-lg">
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="p-2 text-gray-400 hover:text-neon-green transition-colors active:scale-90"
            >
               <ImageIcon className="w-5 h-5" />
            </button>
            <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               accept="image/*" 
               onChange={handleFileSelect}
            />
            <input 
               type="text" 
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder={attachment ? "Add specific questions..." : "Message Copilot..."}
               className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none py-3"
            />
            <button 
               onClick={() => handleSend()}
               disabled={(!input && !attachment) || isTyping}
               className={`p-3 rounded-full transition-all transform active:scale-90 ${(!input && !attachment) ? 'bg-white/5 text-gray-600' : 'bg-neon-green text-black shadow-[0_0_10px_rgba(0,255,163,0.4)]'}`}
            >
               <Send className="w-4 h-4" />
            </button>
         </div>
      </div>
    </div>
  );
};

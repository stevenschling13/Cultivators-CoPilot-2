
import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Sparkles, ExternalLink, Wifi, Leaf, Thermometer, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { ChatMessage, ChatAttachment, GrowLog, GrowSetup, PlantBatch, EnvironmentReading, CalculatedMetrics } from '../types';
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
  onLogProposal: (log: Partial<GrowLog>) => void;
}

export const ChatInterface = ({ context, batches, logs, envReading, metrics, onLogProposal }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "System synchronized. Telemetry active for BLUE/GREEN. Ready for tactical support.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [showContextDetails, setShowContextDetails] = useState(false);
  
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
      // Build Rich Context
      const chatContext = {
        setup: context,
        environment: envReading || undefined,
        batches,
        recentLogs: logs,
        metrics
      };

      await geminiService.chatStream(
        currentHistory, 
        userMsg.text, 
        userMsg.attachment?.url || null, 
        chatContext,
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
                    text: "Analysis complete. Data packet prepared.", 
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
      let friendlyError = "Neural link unstable. Check connection.";
      if (e.message) {
        if (e.message.includes('429')) friendlyError = "Rate limit exceeded. Cooling down.";
        else if (e.message.includes('SAFETY')) friendlyError = "Safety protocol engaged. Request blocked.";
      }
      setMessages(prev => prev.map(m => m.id === currentId ? { ...m, text: friendlyError, isThinking: false } : m));
      Haptic.error();
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      try {
        const base64 = await ImageUtils.compressImage(file);
        setAttachment({
          type: 'image',
          url: base64,
          mimeType: 'image/webp' 
        });
        Haptic.tap();
      } catch (err) {
        console.error("Image processing error:", err);
      }
    }
  };

  const getSuggestedPrompts = () => {
     return [
        "Analyze this plant image",
        "Check my VPD levels",
        batches.length > 0 ? `Status of ${batches[0].batchTag}` : "Batch Status",
     ];
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white font-sans">
      {/* Header HUD */}
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
            <button 
               onClick={() => setShowContextDetails(!showContextDetails)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[10px] font-mono transition-all ${showContextDetails ? 'bg-neon-green/10 border-neon-green text-neon-green' : 'bg-white/5 border-white/10 text-gray-400'}`}
            >
                CONTEXT_STREAM
                {showContextDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
         </div>

         {/* HUD Details */}
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
                      <div className="text-[10px] text-white truncate">{batches.length} Active</div>
                  </div>
               </div>
            </div>
         )}
      </div>

      {/* Terminal Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 scroll-smooth">
         {messages.map(msg => (
             <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                 <div className={`max-w-[85%] md:max-w-[75%] space-y-2`}>
                     {msg.attachment && (
                         <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                            <img src={msg.attachment.url} alt="Attachment" className="max-h-64 w-full object-cover" />
                         </div>
                     )}
                     
                     {msg.text && (
                         <div className={`p-3.5 rounded-xl text-xs md:text-sm leading-relaxed font-mono ${
                             msg.role === 'user' 
                             ? 'bg-transparent border border-white/20 text-white rounded-tr-none' 
                             : 'bg-[#151515] border border-white/5 text-gray-300 rounded-tl-none shadow-lg'
                         }`}>
                             {msg.role === 'model' && <span className="text-neon-green mr-2 font-bold">❯</span>}
                             {msg.text}
                         </div>
                     )}

                     {msg.isThinking && (
                        <div className="flex gap-1 pl-2 items-center h-4">
                             <div className="w-1 h-1 bg-neon-green rounded-full animate-pulse"></div>
                             <div className="w-1 h-1 bg-neon-green rounded-full animate-pulse delay-75"></div>
                             <div className="w-1 h-1 bg-neon-green rounded-full animate-pulse delay-150"></div>
                        </div>
                     )}

                     {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 px-1">
                           {msg.groundingUrls.map((url, idx) => (
                               <a 
                                 key={idx} 
                                 href={url.uri} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="flex items-center gap-1 px-2 py-1 bg-[#0F0F0F] border border-white/10 rounded text-[9px] text-gray-400 hover:text-neon-blue hover:border-neon-blue/30 transition-colors font-mono"
                               >
                                  <ExternalLink className="w-3 h-3" />
                                  <span className="truncate max-w-[150px]">{url.title}</span>
                               </a>
                           ))}
                        </div>
                     )}

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

      {/* Command Input */}
      <div className="p-4 pt-2 bg-[#050505]/95 backdrop-blur-xl border-t border-white/10 pb-safe-bottom space-y-3 z-40">
         {!attachment && messages.length < 4 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
               {getSuggestedPrompts().map(prompt => (
                  <button 
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="flex-shrink-0 px-3 py-1.5 bg-[#111] border border-white/10 rounded-md text-[10px] font-mono text-gray-400 hover:border-neon-green/40 hover:text-white transition-all uppercase tracking-wide"
                  >
                    {prompt}
                  </button>
               ))}
            </div>
         )}

         {attachment && (
            <div className="flex items-center gap-3 p-2 bg-[#111] rounded-lg w-full border border-neon-green/30 animate-slide-up">
                <div className="w-12 h-12 rounded bg-black overflow-hidden shrink-0 border border-white/10">
                    <img src={attachment.url} className="w-full h-full object-cover opacity-80" alt="preview"/>
                </div>
                <div className="flex-1 min-w-0">
                   <div className="text-[10px] text-neon-green font-mono uppercase font-bold">Image Attached</div>
                   <div className="text-[10px] text-gray-500 font-mono">Processing visual telemetry...</div>
                </div>
                <button onClick={() => setAttachment(null)} className="p-2 text-gray-500 hover:text-white"><div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">×</div></button>
            </div>
         )}

         <div className="flex items-center gap-2 bg-[#0A0A0A] rounded-lg p-2 border border-white/10 focus-within:border-neon-green/30 transition-colors shadow-lg">
            <div className="text-gray-600 pl-2">
               <Terminal className="w-4 h-4" />
            </div>
            <input 
               type="text" 
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder={attachment ? "Add notes..." : "Enter command..."}
               className="flex-1 bg-transparent text-xs font-mono text-white placeholder-gray-600 focus:outline-none py-2"
            />
            <div className="flex items-center gap-1">
               <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-500 hover:text-white transition-colors"
               >
                  <ImageIcon className="w-4 h-4" />
               </button>
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileSelect}
               />
               
               <button 
                  onClick={() => handleSend()}
                  disabled={(!input && !attachment) || isTyping}
                  className={`p-2 rounded-md transition-all ${(!input && !attachment) ? 'bg-white/5 text-gray-700' : 'bg-neon-green text-black shadow-[0_0_10px_rgba(0,255,163,0.2)]'}`}
               >
                  <Send className="w-4 h-4" />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

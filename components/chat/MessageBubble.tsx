
import React, { memo } from 'react';
import { Terminal, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, LogProposal } from '../../types';
import { AnalysisCard } from '../ui/AnalysisCard';

interface MessageBubbleProps {
  msg: ChatMessage;
  onLogSave: (log: LogProposal) => void;
}

// Security: Strict Protocol Check
// Prevents XSS via malicious links (javascript:, vbscript:, etc.)
const isSafeUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'data:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
};

export const MessageBubble = memo(({ msg, onLogSave }: MessageBubbleProps) => {
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
             {/* Safe Attachment Rendering */}
             {msg.attachment && isSafeUrl(msg.attachment.url) && (
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
                <div className="text-sm leading-relaxed font-sans prose prose-invert prose-p:my-1 prose-headings:my-2 prose-strong:text-white prose-code:text-neon-blue prose-code:bg-white/10 prose-code:px-1 prose-code:rounded prose-code:font-mono prose-code:text-[10px] max-w-none">
                    <ReactMarkdown 
                        components={{
                            a: ({node, ...props}) => {
                                // Double-check href safety even inside markdown to prevent javascript: links
                                if (!isSafeUrl(props.href as string)) {
                                    return <span className="text-gray-500 line-through" title="Unsafe Link">{props.children}</span>;
                                }
                                return (
                                    <a 
                                        {...props} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-neon-blue hover:underline" 
                                    />
                                );
                            },
                            img: ({node, ...props}) => {
                                // Strict sanitization for markdown images
                                if (!isSafeUrl(props.src as string)) {
                                    return null;
                                }
                                return (
                                    <img 
                                        {...props} 
                                        className="rounded-lg border border-white/10 max-w-full h-auto my-2" 
                                        loading="lazy" 
                                        alt={props.alt || "AI Content"}
                                    />
                                );
                            },
                            // Add extra styling for code blocks
                            code: ({node, ...props}) => (
                                <code className="bg-white/10 text-neon-green px-1 py-0.5 rounded font-mono text-xs" {...props} />
                            )
                        }}
                    >
                        {msg.text}
                    </ReactMarkdown>
                </div>
             )}

             {/* Tool Call Result: Log Proposal */}
             {msg.toolCallPayload && (
                 <AnalysisCard data={msg.toolCallPayload} onSave={() => onLogSave(msg.toolCallPayload!)} />
             )}

             {/* Safe Grounding Citations */}
             {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                 <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                     {msg.groundingUrls.map((g, i) => {
                         if (!isSafeUrl(g.uri)) return null;
                         return (
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
                         );
                     })}
                 </div>
             )}
          </div>
       </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

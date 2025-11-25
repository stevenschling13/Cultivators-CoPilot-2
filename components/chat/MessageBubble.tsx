

import React, { memo } from 'react';
import { Terminal, ExternalLink } from 'lucide-react';
import { ChatMessage, LogProposal } from '../../types';
import { AnalysisCard } from '../ui/AnalysisCard';

interface MessageBubbleProps {
  msg: ChatMessage;
  onLogSave: (log: LogProposal) => void;
}

// Simple Markdown Renderer component to avoid heavy libraries
const MarkdownText = ({ text }: { text: string }) => {
  if (!text) return null;

  // Split by newlines to handle paragraphs
  const lines = text.split('\n');

  return (
    <div className="text-sm leading-relaxed font-sans space-y-2">
      {lines.map((line, i) => {
        // Handle Empty Lines
        if (!line.trim()) return <div key={i} className="h-2" />;

        // Handle Bullet Points
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
           return (
             <div key={i} className="flex gap-2 pl-2">
                <span className="text-neon-green/70 mt-1.5 w-1 h-1 rounded-full bg-current shrink-0"></span>
                <span dangerouslySetInnerHTML={{ __html: formatInlineStyles(line.substring(2)) }} />
             </div>
           );
        }
        
        // Handle Headers (Simple # support)
        if (line.trim().startsWith('### ')) {
           return <h4 key={i} className="text-neon-green font-bold text-xs uppercase tracking-wider mt-2" dangerouslySetInnerHTML={{ __html: formatInlineStyles(line.substring(4)) }} />;
        }
         if (line.trim().startsWith('## ')) {
           return <h3 key={i} className="text-white font-bold text-sm mt-3 border-b border-white/10 pb-1" dangerouslySetInnerHTML={{ __html: formatInlineStyles(line.substring(3)) }} />;
        }

        // Default Paragraph
        return <div key={i} dangerouslySetInnerHTML={{ __html: formatInlineStyles(line) }} />;
      })}
    </div>
  );
};

// Helper to handle bold/italic regex
const formatInlineStyles = (text: string) => {
  // **Bold**
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
  // *Italic*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em class="text-gray-300">$1</em>');
  // `Code`
  formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 rounded font-mono text-[10px] text-neon-blue">$1</code>');
  return formatted;
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
                <MarkdownText text={msg.text} />
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
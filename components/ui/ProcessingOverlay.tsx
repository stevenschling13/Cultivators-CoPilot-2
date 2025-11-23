
import React from 'react';
import { Sparkles } from 'lucide-react';

export const ProcessingOverlay = ({ isProcessing }: { isProcessing: boolean }) => {
  if (!isProcessing) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in touch-none">
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 border-t-4 border-neon-green rounded-full animate-[spin_1s_linear_infinite]"></div>
        <div className="absolute inset-2 border-r-4 border-neon-blue rounded-full animate-[spin_2s_linear_infinite]"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-white animate-pulse" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-white tracking-widest uppercase animate-pulse">Analyzing Biology</h2>
      <p className="text-sm text-neon-green font-mono mt-2">Gemini 3 Pro Processing...</p>
    </div>
  );
};


import React, { memo } from 'react';
import { Sparkles, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { EnvironmentReading, CalculatedMetrics } from '../../types';
import { Haptic } from '../../utils/haptics';

interface ChatHeaderProps {
  showContextDetails: boolean;
  setShowContextDetails: (v: boolean) => void;
  envReading?: EnvironmentReading | null;
  metrics?: CalculatedMetrics;
  batchesCount: number;
  onClearHistory: () => void;
}

export const ChatHeader = memo(({ 
  showContextDetails, 
  setShowContextDetails, 
  envReading, 
  metrics, 
  batchesCount,
  onClearHistory
}: ChatHeaderProps) => (
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

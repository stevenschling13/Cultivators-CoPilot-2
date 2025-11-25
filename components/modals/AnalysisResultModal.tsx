
import React, { memo, useState } from 'react';
import { Play, Loader2, Film } from 'lucide-react';
import { AiDiagnosis, GrowLog } from '../../types';
import { Haptic } from '../../utils/haptics';

interface AnalysisResultModalProps {
  result: AiDiagnosis;
  log: GrowLog;
  onSave: () => void;
  onDiscard: () => void;
  onSimulate: (img: string) => Promise<string>;
}

export const AnalysisResultModal = memo(({ result, log, onSave, onDiscard, onSimulate }: AnalysisResultModalProps) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleSimulate = async () => {
      if (!log.imageUrl) return;
      Haptic.tap();
      setIsSimulating(true);
      try {
          const url = await onSimulate(log.imageUrl);
          setVideoUrl(url);
          Haptic.success();
      } catch (e) {
          // Error handled by controller toast
          Haptic.error();
      } finally {
          setIsSimulating(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[#050505] flex flex-col animate-slide-up safe-area-top safe-area-bottom">
       <div className="p-6 border-b border-white/10 bg-[#0A0A0A]">
         <div className="text-neon-green text-xs font-mono tracking-widest mb-1">
             AI CONFIDENCE: {((result.confidenceScore ?? 0.85) * 100).toFixed(0)}%
         </div>
         <h2 className="text-2xl font-bold text-white">Phytopathology Report</h2>
       </div>
       
       <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
             <div className="w-32 h-32 rounded-full border-4 border-neon-green flex items-center justify-center relative">
                <div className="text-4xl font-bold text-white">{result.healthScore}</div>
                <div className="absolute bottom-6 text-[10px] text-gray-400 uppercase">Health</div>
             </div>
             <div className="flex-1 pl-6 space-y-3">
                <div>
                   <div className="text-[10px] text-gray-500 uppercase tracking-widest">Pests</div>
                   <div className="text-white text-sm">{result.detectedPests.length > 0 ? result.detectedPests.join(', ') : 'None Detected'}</div>
                </div>
                <div>
                   <div className="text-[10px] text-gray-500 uppercase tracking-widest">Deficiencies</div>
                   <div className="text-white text-sm">{result.nutrientDeficiencies.length > 0 ? result.nutrientDeficiencies.join(', ') : 'None Detected'}</div>
                </div>
             </div>
          </div>

          {/* Veo Simulation Section */}
          {videoUrl ? (
             <div className="rounded-2xl overflow-hidden border border-white/10 bg-black relative shadow-2xl">
                 <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 flex items-center gap-1">
                     <Film className="w-3 h-3 text-neon-blue" /> VEO SIMULATION
                 </div>
                 <video 
                    src={videoUrl} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full h-48 object-cover"
                 />
             </div>
          ) : (
            <button 
                onClick={handleSimulate}
                disabled={isSimulating}
                className="w-full py-4 bg-gradient-to-r from-uv-purple/20 to-neon-blue/20 border border-uv-purple/30 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSimulating ? (
                    <>
                        <Loader2 className="w-5 h-5 text-neon-blue animate-spin" />
                        <span className="text-sm font-bold text-neon-blue">Generating Growth Simulation (Veo)...</span>
                    </>
                ) : (
                    <>
                        <Play className="w-5 h-5 text-uv-purple group-hover:text-white transition-colors" />
                        <span className="text-sm font-bold text-white">Simulate Future Growth (Veo)</span>
                    </>
                )}
            </button>
          )}

          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
             <h3 className="text-xs font-mono text-neon-blue uppercase tracking-widest mb-2">AI Reasoning</h3>
             <p className="text-sm text-gray-300 leading-relaxed">{result.morphologyNotes}</p>
          </div>

          {result.harvestPrediction && (
             <div className="bg-uv-purple/10 rounded-2xl p-4 border border-uv-purple/20">
                <h3 className="text-xs font-mono text-uv-purple uppercase tracking-widest mb-2">Harvest Adjust</h3>
                <div className="flex justify-between items-center">
                   <span className="text-white font-bold">Predicted Date</span>
                   <span className="text-uv-purple">{new Date(result.harvestPrediction.predictedDate).toLocaleDateString()}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">{result.harvestPrediction.reasoning}</div>
             </div>
          )}
       </div>

       <div className="p-6 bg-[#0A0A0A] border-t border-white/10 flex gap-4">
          <button onClick={() => { Haptic.tap(); onDiscard(); }} className="flex-1 py-4 rounded-xl bg-white/5 text-white font-medium active:scale-95 transition-all">Discard</button>
          <button onClick={() => { Haptic.tap(); onSave(); }} className="flex-1 py-4 rounded-xl bg-neon-green text-black font-bold active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,163,0.3)]">Save to Log</button>
       </div>
    </div>
  );
});
AnalysisResultModal.displayName = 'AnalysisResultModal';

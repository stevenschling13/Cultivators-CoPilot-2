import React from 'react';
import { LogProposal } from '../../types';
import { Activity, AlertTriangle, Bug, CheckCircle2, PlusCircle, Leaf } from 'lucide-react';
import { Haptic } from '../../utils/haptics';

interface AnalysisCardProps {
  data: LogProposal;
  onSave: () => void;
}

export const AnalysisCard = ({ data, onSave }: AnalysisCardProps) => {
  if (!data) return null;

  // Construct a pseudo-diagnosis object for consistent rendering with LogProposal flat structure
  const diagnosis = {
    healthScore: data.healthScore,
    detectedPests: data.detectedPests,
    nutrientDeficiencies: data.nutrientDeficiencies,
    recommendations: data.recommendations,
    morphologyNotes: data.manualNotes
  };

  const isHealthy = diagnosis.healthScore && diagnosis.healthScore > 80;
  const healthColor = isHealthy ? 'text-neon-green' : diagnosis.healthScore && diagnosis.healthScore > 60 ? 'text-yellow-500' : 'text-alert-red';
  const borderColor = isHealthy ? 'border-neon-green/30' : 'border-white/10';

  return (
    <div className={`mt-3 bg-[#121212] rounded-2xl overflow-hidden border ${borderColor} animate-slide-up shadow-2xl`}>
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <Activity className={`w-4 h-4 ${healthColor}`} />
           <span className="text-xs font-bold text-white uppercase tracking-wider">Plant Health Analysis</span>
        </div>
        <div className={`text-lg font-black ${healthColor}`}>{diagnosis.healthScore}</div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        
        {/* Summary Notes */}
        <p className="text-sm text-gray-300 leading-relaxed">
           {diagnosis.morphologyNotes}
        </p>

        {/* Risks Grid */}
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-black/40 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                 <Bug className="w-3 h-3 text-gray-500" />
                 <span className="text-[10px] text-gray-500 uppercase font-bold">Pests</span>
              </div>
              <div className="text-sm text-white font-medium">
                 {diagnosis.detectedPests && diagnosis.detectedPests.length > 0 
                   ? <span className="text-alert-red">{diagnosis.detectedPests.join(', ')}</span>
                   : <span className="text-gray-500">None Detected</span>
                 }
              </div>
           </div>
           <div className="bg-black/40 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                 <Leaf className="w-3 h-3 text-gray-500" />
                 <span className="text-[10px] text-gray-500 uppercase font-bold">Nutrients</span>
              </div>
              <div className="text-sm text-white font-medium">
                 {diagnosis.nutrientDeficiencies && diagnosis.nutrientDeficiencies.length > 0 
                   ? <span className="text-yellow-500">{diagnosis.nutrientDeficiencies.join(', ')}</span>
                   : <span className="text-gray-500">Balanced</span>
                 }
              </div>
           </div>
        </div>

        {/* Recommendations */}
        {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
           <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold mb-2">Recommended Actions</div>
              <ul className="space-y-2">
                 {diagnosis.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                       <CheckCircle2 className="w-3 h-3 text-neon-green shrink-0 mt-0.5" />
                       {rec}
                    </li>
                 ))}
              </ul>
           </div>
        )}

        {/* Footer Action */}
        <button 
           onClick={() => { Haptic.tap(); onSave(); }}
           className="w-full py-3 bg-neon-green/10 border border-neon-green/30 text-neon-green text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-neon-green hover:text-black transition-all active:scale-95"
        >
           <PlusCircle className="w-4 h-4" />
           Log to Journal
        </button>
      </div>
    </div>
  );
};
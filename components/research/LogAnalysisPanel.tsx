import React from 'react';
import { Beaker, Microscope, X, ShieldAlert, AlertTriangle, FileText, Bug, Sprout, CheckCircle2 } from 'lucide-react';
import { GrowLog } from '../../types';
import { Haptic } from '../../utils/haptics';
import { Card } from '../ui/Card';

interface LogAnalysisPanelProps {
  log: GrowLog;
  onClose: () => void;
}

export const LogAnalysisPanel = ({ log, onClose }: LogAnalysisPanelProps) => {
  const diagnosis = log.aiDiagnosis;

  if (!diagnosis) {
    return (
      <div className="bg-[#121212] rounded-[32px] p-8 border border-white/10 animate-slide-up relative text-center">
        <button onClick={() => { Haptic.tap(); onClose(); }} className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
           <Beaker className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-white font-bold text-lg">No Biological Metadata</h3>
        <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto">This entry lacks AI diagnostic data. Upload a photo to generate a full phytopathology report.</p>
      </div>
    );
  }

  const isHealthy = diagnosis.healthScore >= 85;
  const healthColor = isHealthy ? 'text-neon-green' : diagnosis.healthScore >= 70 ? 'text-yellow-500' : 'text-alert-red';
  const borderColor = isHealthy ? 'border-neon-green/30' : 'border-white/10';

  return (
    <div className={`bg-[#0A0A0A] rounded-[32px] border ${borderColor} overflow-hidden animate-slide-up shadow-2xl relative`}>
       {/* Hero Section */}
       <div className="relative h-64 w-full group">
          {log.imageUrl ? (
            <img src={log.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Specimen" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#111]"><Microscope className="w-12 h-12 text-gray-700" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent"></div>
          
          <button onClick={() => { Haptic.tap(); onClose(); }} className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-white/10 z-20 active:scale-90 transition-all">
             <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-0 left-0 p-6 w-full">
             <div className="flex justify-between items-end">
                <div>
                   <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                         {log.actionType}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono uppercase">{new Date(log.timestamp).toLocaleDateString()}</span>
                   </div>
                   <h2 className="text-2xl font-black text-white tracking-tight">Specimen Report</h2>
                </div>
                <div className="text-right">
                   <div className={`text-4xl font-black ${healthColor} tracking-tighter`}>{diagnosis.healthScore}</div>
                   <div className="text-[9px] text-gray-500 uppercase font-mono tracking-widest">Verdant Score</div>
                   {diagnosis.confidenceScore !== undefined && (
                       <div className="text-[9px] text-neon-blue font-mono mt-1 opacity-80">
                           {Math.round(diagnosis.confidenceScore * 100)}% CONFIDENCE
                       </div>
                   )}
                </div>
             </div>
          </div>
       </div>

       {/* Detailed Metrics */}
       <div className="p-6 space-y-6">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
             <h3 className="text-[10px] font-mono text-neon-blue uppercase tracking-widest mb-2 flex items-center gap-2">
               <FileText className="w-3 h-3" /> Morphology Observations
             </h3>
             <p className="text-sm text-gray-300 leading-relaxed font-sans">{diagnosis.morphologyNotes}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <Card noPadding className="p-4 !rounded-2xl !bg-[#111]">
                <div className="flex items-center gap-2 mb-3">
                   <ShieldAlert className="w-4 h-4 text-alert-red" />
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vectors</span>
                </div>
                {diagnosis.detectedPests.length > 0 ? (
                   <div className="flex flex-wrap gap-1">
                      {diagnosis.detectedPests.map((p,i) => <span key={i} className="text-xs font-bold text-alert-red bg-alert-red/10 px-2 py-1 rounded">{p}</span>)}
                   </div>
                ) : <div className="text-xs text-gray-600 font-mono">None Detected</div>}
             </Card>

             <Card noPadding className="p-4 !rounded-2xl !bg-[#111]">
                <div className="flex items-center gap-2 mb-3">
                   <AlertTriangle className="w-4 h-4 text-yellow-500" />
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nutrients</span>
                </div>
                {diagnosis.nutrientDeficiencies.length > 0 ? (
                   <div className="flex flex-wrap gap-1">
                      {diagnosis.nutrientDeficiencies.map((d,i) => <span key={i} className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">{d}</span>)}
                   </div>
                ) : <div className="text-xs text-gray-600 font-mono">Balanced Profile</div>}
             </Card>
          </div>
          
          {diagnosis.recommendations?.length > 0 && (
             <div>
                <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Sprout className="w-3 h-3" /> Remediation Protocol
                </h3>
                <div className="space-y-2">
                   {diagnosis.recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-3 items-start bg-[#111] p-3 rounded-xl border border-white/5">
                         <CheckCircle2 className="w-4 h-4 text-neon-green shrink-0 mt-0.5" />
                         <span className="text-xs text-gray-300">{rec}</span>
                      </div>
                   ))}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};
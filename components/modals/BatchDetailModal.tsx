import React, { memo, useState } from 'react';
import { X, Thermometer, Droplet, Wind, Sun, Info, Calendar, Activity } from 'lucide-react';
import { PlantBatch, GrowLog } from '../../types';
import { FLIP_DATE, STAGE_INFO } from '../../constants';
import { SwipeableLogItem } from '../SwipeableLogItem';
import { LogEditModal } from './LogEditModal';
import { Haptic } from '../../utils/haptics';

interface BatchDetailModalProps {
  batch: PlantBatch;
  onClose: () => void;
  logs: GrowLog[];
  onDeleteLog: (id: string) => void;
  onUpdateLog: (log: GrowLog) => void;
}

export const BatchDetailModal = memo(({ batch, onClose, logs, onDeleteLog, onUpdateLog }: BatchDetailModalProps) => {
  const [editingLog, setEditingLog] = useState<GrowLog | null>(null);

  const daysInFlower = Math.floor((Date.now() - new Date(FLIP_DATE).getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = batch.projectedHarvestDate 
    ? Math.ceil((batch.projectedHarvestDate - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const currentStageInfo = STAGE_INFO[batch.currentStage] || STAGE_INFO['Vegetative'];
  const latestLog = logs[0];

  const handleSaveEdit = (updatedLog: GrowLog) => {
    onUpdateLog(updatedLog);
    setEditingLog(null);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[#050505] flex flex-col animate-slide-up overflow-y-auto safe-area-bottom safe-area-top">
      {editingLog && (
        <LogEditModal 
          log={editingLog} 
          onSave={handleSaveEdit} 
          onClose={() => setEditingLog(null)} 
        />
      )}

      {/* Hero Section */}
      <div className="relative h-[45vh] w-full shrink-0">
        {latestLog ? (
           <img src={latestLog.imageUrl} className="w-full h-full object-cover" alt="Batch Hero" />
        ) : (
           <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center text-gray-700 font-mono text-xs">NO VISUAL DATA</div>
        )}
        
        {/* Advanced Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#050505]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent"></div>

        <button onClick={() => { Haptic.tap(); onClose(); }} className="absolute top-6 right-6 p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-white/10 transition-colors z-50">
           <X className="w-6 h-6" />
        </button>
        
        <div className="absolute bottom-0 left-0 p-6 w-full z-10">
           <div className="flex items-center gap-2 mb-3">
             <div className="text-neon-green text-[10px] font-bold font-mono uppercase tracking-widest px-2 py-1 bg-neon-green/10 border border-neon-green/20 rounded backdrop-blur-md">{batch.batchTag}</div>
             <div className="text-gray-400 text-[10px] font-mono uppercase border border-white/10 px-2 py-1 rounded bg-black/40 backdrop-blur-md">ID: {batch.id.slice(0,6)}</div>
           </div>
           <h1 className="text-3xl font-bold text-white leading-tight mb-3 tracking-tight drop-shadow-lg">{batch.strain}</h1>
           <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10 backdrop-blur-md">
                 <Activity className="w-3 h-3 text-gray-400"/>
                 <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">{batch.currentStage}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-uv-purple/10 border border-uv-purple/20 backdrop-blur-md">
                 <Calendar className="w-3 h-3 text-uv-purple"/>
                 <span className="text-[10px] font-bold uppercase tracking-wider text-uv-purple">Day {daysInFlower} Flower</span>
              </div>
           </div>
        </div>
      </div>

      <div className="px-5 -mt-8 relative z-20 pb-32 space-y-6">
        {/* Harvest Projection Card */}
        <div className="bg-[#0A0A0A]/90 backdrop-blur-xl rounded-[24px] p-5 border border-white/10 shadow-2xl">
           <div className="flex justify-between items-end mb-4">
             <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Harvest Countdown</h3>
             <div className="text-right">
                <div className="text-2xl font-mono font-bold text-white">{daysLeft} DAYS</div>
             </div>
           </div>
           {/* Progress Track */}
           <div className="w-full bg-[#151515] h-3 rounded-full overflow-hidden border border-white/5 relative">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_2px,#000_2px)] bg-[size:4px_100%] opacity-20 z-10"></div>
              <div className="h-full bg-gradient-to-r from-neon-green to-neon-blue shadow-[0_0_15px_rgba(0,255,163,0.4)]" style={{ width: `${Math.min(100, (daysInFlower / (daysInFlower + daysLeft)) * 100)}%` }}></div>
           </div>
           <div className="mt-3 flex justify-between text-[9px] text-gray-600 font-mono uppercase">
              <span>Start</span>
              <span>Projected Finish</span>
           </div>
        </div>

        {/* Target Matrix */}
        <div className="bg-[#0A0A0A] rounded-[24px] p-5 border border-white/5">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Phase Targets</h3>
                <Info className="w-4 h-4 text-gray-600" />
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                    { icon: Thermometer, label: 'Temp', value: currentStageInfo.temp, color: 'text-white' },
                    { icon: Droplet, label: 'RH', value: currentStageInfo.rh, color: 'text-white' },
                    { icon: Wind, label: 'VPD', value: currentStageInfo.vpd, color: 'text-neon-blue' },
                    { icon: Sun, label: 'PPFD', value: currentStageInfo.ppfd, color: 'text-neon-green' }
                ].map((metric, i) => (
                    <div key={i} className="bg-[#111] rounded-xl p-3 border border-white/5">
                        <div className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase mb-1">
                            <metric.icon className="w-3 h-3"/> {metric.label}
                        </div>
                        <div className={`text-sm font-mono font-bold ${metric.color}`}>{metric.value}</div>
                    </div>
                ))}
            </div>
            <div className="text-xs text-gray-400 leading-relaxed border-t border-white/5 pt-3 font-mono">
                {currentStageInfo.desc}
            </div>
        </div>

        {/* Data Timeline */}
        <div>
            <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
                <Activity className="w-3 h-3"/> Operations Log
            </h3>
            <div className="relative pl-4 ml-2">
                {/* Continuous Line */}
                <div className="absolute left-[7px] top-0 bottom-0 w-px bg-gradient-to-b from-neon-green/50 via-white/10 to-transparent"></div>
                
                <div className="space-y-6">
                    {logs.length > 0 ? logs.map(log => (
                        <div key={log.id} className="relative pl-6">
                            {/* Connector Line */}
                            <div className="absolute left-[7px] top-0 bottom-0 w-px bg-white/10 z-0"></div>
                            
                            {/* Node */}
                            <div className={`absolute -left-[3px] top-4 w-[21px] h-[21px] rounded-full bg-[#050505] border-2 flex items-center justify-center z-10 ${log.aiDiagnosis ? 'border-neon-green shadow-[0_0_8px_rgba(0,255,163,0.4)]' : 'border-gray-700'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${log.aiDiagnosis ? 'bg-neon-green' : 'bg-gray-500'}`}></div>
                            </div>
                            
                            <SwipeableLogItem 
                            log={log} 
                            onDelete={onDeleteLog} 
                            onClick={(l) => setEditingLog(l)}
                            isFlipDate={new Date(FLIP_DATE).getTime()} 
                            />
                        </div>
                    )) : (
                    <div className="text-xs text-gray-600 pl-6 py-4 font-mono border border-dashed border-white/10 rounded-xl text-center">NO EVENTS LOGGED</div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
});
BatchDetailModal.displayName = 'BatchDetailModal';
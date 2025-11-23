
import React, { memo, useState } from 'react';
import { X, Thermometer, Droplet, Wind, Sun, Info } from 'lucide-react';
import { PlantBatch, GrowLog } from '../../types';
import { FLIP_DATE, STAGE_INFO } from '../../constants';
import { SwipeableLogItem } from '../SwipeableLogItem';
import { LogEditModal } from './LogEditModal';

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
    <div className="fixed inset-0 z-[90] bg-black flex flex-col animate-slide-up overflow-y-auto safe-area-bottom safe-area-top">
      {editingLog && (
        <LogEditModal 
          log={editingLog} 
          onSave={handleSaveEdit} 
          onClose={() => setEditingLog(null)} 
        />
      )}

      <div className="relative h-[40vh] w-full shrink-0">
        {latestLog ? (
           <img src={latestLog.imageUrl} className="w-full h-full object-cover" alt="Batch Hero" />
        ) : (
           <div className="w-full h-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center text-gray-600">No Image Data</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black"></div>
        <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/10 transition-colors z-50">
           <X className="w-6 h-6" />
        </button>
        <div className="absolute bottom-0 left-0 p-6">
           <div className="text-neon-green text-xs font-bold font-mono mb-2 uppercase tracking-widest">{batch.batchTag}</div>
           <h1 className="text-3xl font-bold text-white leading-tight mb-2">{batch.strain}</h1>
           <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider border border-white/10">{batch.currentStage}</span>
              <span className="px-2 py-1 rounded bg-uv-purple/20 text-uv-purple text-[10px] font-bold uppercase tracking-wider border border-uv-purple/30">Day {daysInFlower} Flower</span>
           </div>
        </div>
      </div>

      <div className="px-6 -mt-4 relative z-10 pb-32 space-y-6">
        <div className="bg-[#121212] rounded-3xl p-6 border border-white/10">
           <div className="flex justify-between items-end mb-4">
             <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Harvest Projection</h3>
             <div className="text-right">
                <div className="text-2xl font-bold text-white">{daysLeft} Days</div>
                <div className="text-[10px] text-gray-500">Remaining</div>
             </div>
           </div>
           <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-neon-green to-neon-blue" style={{ width: `${Math.min(100, (daysInFlower / (daysInFlower + daysLeft)) * 100)}%` }}></div>
           </div>
           <div className="mt-4 text-xs text-gray-400 leading-relaxed">
              Based on genetic baseline ({batch.breederHarvestDays} days) and AI analysis of recent trichome development.
           </div>
        </div>

        {/* Grow Stage Details Section */}
        <div className="bg-[#121212] rounded-3xl p-6 border border-white/10">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Stage Targets</h3>
                    <div className="text-white font-bold text-lg mt-1">{batch.currentStage} Phase</div>
                </div>
                <Info className="w-5 h-5 text-gray-600" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white/5 rounded-xl p-3 flex flex-col">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1"><Thermometer className="w-3 h-3"/> Temp</span>
                    <span className="text-sm font-mono font-bold text-white">{currentStageInfo.temp}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 flex flex-col">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1"><Droplet className="w-3 h-3"/> Humidity</span>
                    <span className="text-sm font-mono font-bold text-white">{currentStageInfo.rh}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 flex flex-col">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1"><Wind className="w-3 h-3"/> VPD (kPa)</span>
                    <span className="text-sm font-mono font-bold text-neon-blue">{currentStageInfo.vpd}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 flex flex-col">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1"><Sun className="w-3 h-3"/> PPFD</span>
                    <span className="text-sm font-mono font-bold text-neon-green">{currentStageInfo.ppfd}</span>
                </div>
            </div>
            <div className="text-xs text-gray-500 leading-relaxed border-t border-white/5 pt-3">
                {currentStageInfo.desc}
            </div>
        </div>

        <div className="bg-[#121212] rounded-3xl p-6 border border-white/10">
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4">Substrate Configuration</h3>
          <div className="space-y-4">
            <div>
               <div className="text-white font-medium text-sm">Soil Mix</div>
               <div className="text-gray-500 text-xs mt-1">{batch.soilMix}</div>
            </div>
            <div>
               <div className="text-white font-medium text-sm">Notes</div>
               <div className="text-gray-500 text-xs mt-1">{batch.notes}</div>
            </div>
          </div>
        </div>

        {/* Chronological Timeline */}
        <div>
            <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4 px-2">Growth Timeline</h3>
            <div className="relative pl-4 border-l border-white/10 space-y-8 ml-2">
                {logs.length > 0 ? logs.map(log => (
                    <div key={log.id} className="relative pl-6">
                        {/* Dot on line */}
                        <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border border-black ${log.aiDiagnosis ? 'bg-neon-green' : 'bg-gray-600'}`} />
                        
                        <SwipeableLogItem 
                          log={log} 
                          onDelete={onDeleteLog} 
                          onClick={(l) => setEditingLog(l)}
                          isFlipDate={new Date(FLIP_DATE).getTime()} 
                        />
                    </div>
                )) : (
                  <div className="text-xs text-gray-500 pl-6 py-4">No timeline events recorded yet.</div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
});
BatchDetailModal.displayName = 'BatchDetailModal';

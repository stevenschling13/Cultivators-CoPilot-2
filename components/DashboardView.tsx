
import React, { memo, useState } from 'react';
import { Clock, CheckCircle2, ScanEye, Upload, Plus, Box, ArrowRight, Volume2, Mic, Droplet, FileText } from 'lucide-react';
import { Haptic } from '../utils/haptics';
import { FLIP_DATE } from '../constants';
import { FacilityBriefing, Room, PlantBatch, LogProposal } from '../types';
import { BentoCard } from './ui/Primitives';
import { RoomTile } from './ui/RoomTile';
import { useAppController } from '../hooks/useAppController';

interface DashboardViewProps {
  briefing: FacilityBriefing | null;
  rooms: Room[];
  batches: PlantBatch[]; 
  onBackup: () => void;
  onImport: () => void;
  onCamera: () => void;
  onSelectBatch: (batch: PlantBatch) => void;
  onAddBatch?: () => void;
  onAddRoom?: () => void;
  onEditRoom?: (room: Room) => void;
  onVoiceCommand?: () => void;
}

export const DashboardView = memo(({ 
  briefing, 
  rooms, 
  batches, 
  onBackup, 
  onImport, 
  onCamera, 
  onSelectBatch,
  onAddBatch,
  onAddRoom,
  onEditRoom,
  onVoiceCommand
}: DashboardViewProps) => {
  const daysSinceFlip = Math.floor((Date.now() - new Date(FLIP_DATE).getTime()) / (1000 * 60 * 60 * 24));
  const { actions } = useAppController(); 
  const [showQuickActions, setShowQuickActions] = useState(false);

  const activeBatches = batches.filter(b => b.isActive !== false);
  const isEmptyState = rooms.length === 0 && activeBatches.length === 0;

  const handleQuickLog = (type: string) => {
      Haptic.tap();
      setShowQuickActions(false);
      const batchId = activeBatches[0]?.id;
      if (batchId) {
          const proposal: LogProposal = {
              actionType: type,
              manualNotes: `Quick Log: ${type}`,
          };
          actions.handleLogProposal(proposal);
      }
  };

  return (
    <div className="p-6 pt-safe-top pb-32 space-y-6 animate-fade-in relative min-h-screen">
      <div className="flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-1">COMMAND CENTER</h1>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-gray-500 tracking-widest">
               <Clock className="w-3 h-3" />
               <span>{new Date().toLocaleDateString()} • Day {daysSinceFlip}F</span>
            </div>
         </div>
         <div className="flex gap-2">
            {onVoiceCommand && (
                <button 
                  onClick={() => { Haptic.tap(); onVoiceCommand(); }}
                  className="p-3 bg-[#111] text-neon-green border border-neon-green/20 rounded-full active:scale-95 transition-all hover:bg-neon-green/10 shadow-[0_0_15px_rgba(0,255,163,0.1)]"
                  title="Field Agent"
                >
                    <Mic className="w-5 h-5" />
                </button>
            )}
            {onAddBatch && (
              <button 
                onClick={() => { Haptic.tap(); onAddBatch(); }}
                className="p-3 bg-[#111] rounded-full border border-white/10 hover:border-white/20 active:scale-95 transition-all"
                title="New Run"
              >
                  <Plus className="w-5 h-5" />
              </button>
            )}
         </div>
      </div>

      {isEmptyState ? (
          <div className="bg-[#111] border border-dashed border-white/20 rounded-[32px] p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-neon-green/10 rounded-full flex items-center justify-center mx-auto">
                 <Box className="w-8 h-8 text-neon-green" />
              </div>
              <div>
                  <h2 className="text-xl font-bold text-white mb-2">Facility Initializing...</h2>
                  <p className="text-gray-400 text-sm max-w-xs mx-auto">
                      No grow rooms or active batches detected. Configure your digital twin to begin telemetry tracking.
                  </p>
              </div>
              <div className="space-y-3">
                  {onAddRoom && (
                    <button 
                        onClick={() => { Haptic.tap(); onAddRoom(); }}
                        className="w-full py-3 bg-neon-green text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-neon-green/90 transition-colors"
                    >
                        Create Grow Room <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  {onAddBatch && (
                    <button 
                        onClick={() => { Haptic.tap(); onAddBatch(); }}
                        className="w-full py-3 bg-white/5 text-white font-bold rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                    >
                        Plan First Batch
                    </button>
                  )}
              </div>
          </div>
      ) : (
        <>
            {/* Facility Briefing Card - Optimized Layout */}
            {briefing && (
                <BentoCard 
                    className="!bg-[#0A0A0A] !border-l-4 border-l-neon-green" 
                    title="Facility Briefing"
                    headerAction={
                        <button 
                            onClick={() => { Haptic.tap(); actions.playAudioBriefing(briefing.summary); }}
                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neon-green transition-colors"
                            title="Play Audio Report"
                        >
                            <Volume2 className="w-4 h-4" />
                        </button>
                    }
                >
                    <div className="px-5 pb-5">
                        <div className="flex items-baseline justify-between mb-2">
                            <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 flex-1 mr-4">{briefing.summary}</p>
                            <div className={`text-[10px] font-bold px-2 py-0.5 rounded border ${briefing.status === 'OPTIMAL' ? 'text-neon-green border-neon-green/30 bg-neon-green/5' : 'text-alert-red border-alert-red/30 bg-alert-red/5'}`}>
                                {briefing.status}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            {briefing.actionItems.slice(0, 2).map((item, i) => (
                                <div key={i} className="flex gap-2 items-center text-[10px] text-gray-400 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                                    <CheckCircle2 className="w-3 h-3 text-neon-blue shrink-0" />
                                    <span className="truncate">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </BentoCard>
            )}

            {/* Rooms List */}
            <div className="grid grid-cols-1 gap-4">
                {rooms.map(room => (
                    <RoomTile 
                        key={room.id} 
                        room={room} 
                        onClick={(r) => {
                            const batch = activeBatches.find(b => b.id === r.activeBatchId);
                            if (batch) onSelectBatch(batch);
                        }}
                        onEdit={() => onEditRoom && onEditRoom(room)}
                    />
                ))}
                {onAddRoom && (
                    <button
                        onClick={() => { Haptic.tap(); onAddRoom(); }}
                        className="w-full py-4 border border-dashed border-white/10 rounded-[24px] flex items-center justify-center gap-2 text-gray-500 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
                    >
                        <Box className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Add Facility Room</span>
                    </button>
                )}
            </div>

            {/* Visual Scan & Actions Grid */}
            <div className="grid grid-cols-2 gap-4">
                {/* Visual Scan - Lens Aesthetic */}
                <BentoCard 
                    onClick={onCamera}
                    className="h-32 relative overflow-hidden group !bg-[#050505] border-white/10"
                >
                    {/* Lens Effect */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,163,0.15)_0%,transparent_70%)] opacity-50 group-hover:opacity-80 transition-opacity"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 border border-neon-green/20 rounded-full flex items-center justify-center relative animate-[spin_10s_linear_infinite]">
                            <div className="absolute inset-2 border border-neon-green/10 rounded-full border-dashed"></div>
                        </div>
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                        <ScanEye className="w-8 h-8 text-neon-green drop-shadow-[0_0_10px_rgba(0,255,163,0.5)]" />
                        <span className="text-xs font-bold text-white uppercase tracking-widest">VISUAL SCAN</span>
                    </div>
                </BentoCard>

                {/* Import Data */}
                <BentoCard 
                    onClick={() => { Haptic.tap(); onImport(); }}
                    className="h-32 flex flex-col items-center justify-center gap-3 !bg-[#111] hover:bg-white/5 transition-colors group border-white/10"
                >
                    <div className="p-3 rounded-full bg-white/5 group-hover:scale-110 transition-transform border border-white/5">
                        <Upload className="w-6 h-6 text-neon-blue" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">Import Legacy Data</span>
                </BentoCard>
            </div>

            {/* Active Batches Grid */}
            <div>
                <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3 px-2">Active Runs</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeBatches.map(batch => (
                        <div 
                            key={batch.id}
                            onClick={() => { Haptic.tap(); onSelectBatch(batch); }}
                            className="bg-[#111] border border-white/5 rounded-2xl p-4 flex justify-between items-center active:scale-[0.98] transition-all hover:border-white/10 cursor-pointer group"
                        >
                             <div>
                                 <div className="flex items-center gap-2 mb-1">
                                     <span className="text-[9px] font-bold text-black bg-neon-green px-1.5 py-0.5 rounded uppercase">{batch.batchTag}</span>
                                     <span className="text-[9px] text-gray-500 font-mono uppercase">{batch.currentStage}</span>
                                 </div>
                                 <div className="text-sm font-bold text-white group-hover:text-neon-green transition-colors truncate max-w-[180px]">
                                     {batch.strain}
                                 </div>
                             </div>
                             <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                        </div>
                    ))}
                </div>
            </div>
        </>
      )}

      {/* Quick Actions FAB */}
      <div className="fixed bottom-24 right-6 z-40">
          {showQuickActions && (
              <div className="absolute bottom-16 right-0 flex flex-col gap-2 mb-2 animate-slide-up items-end">
                  {[
                      { label: 'Water', icon: Droplet, color: 'bg-neon-blue text-black' },
                      { label: 'Log Note', icon: FileText, color: 'bg-white text-black' }
                  ].map((action) => (
                      <button 
                          key={action.label}
                          onClick={() => handleQuickLog(action.label)}
                          className={`flex items-center gap-3 px-4 py-2 rounded-full shadow-lg ${action.color} font-bold text-xs uppercase tracking-wider active:scale-95 transition-transform`}
                      >
                          {action.label}
                          <action.icon className="w-4 h-4" />
                      </button>
                  ))}
              </div>
          )}
          <button 
              onClick={() => { Haptic.tap(); setShowQuickActions(!showQuickActions); }}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,255,163,0.3)] transition-all active:scale-90 ${showQuickActions ? 'bg-white text-black rotate-45' : 'bg-neon-green text-black'}`}
          >
              <Plus className="w-6 h-6" />
          </button>
      </div>
    </div>
  );
});

DashboardView.displayName = 'DashboardView';

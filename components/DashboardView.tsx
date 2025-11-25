import React, { memo } from 'react';
import { Plus, Mic, Volume2, Database, Upload } from 'lucide-react';
import { FacilityBriefing, Room, PlantBatch } from '../types';
import { RoomTile } from './ui/RoomTile';
import { BentoCard, SkeletonCard, StageProgressBar, StatusBadge } from './ui/Primitives';
import { Haptic } from '../utils/haptics';

interface DashboardViewProps {
  briefing: FacilityBriefing | null;
  rooms: Room[];
  batches: PlantBatch[];
  onBackup: () => void;
  onImport: () => void;
  onCamera: () => void;
  onSelectBatch: (b: PlantBatch) => void;
  onAddBatch: () => void;
  onAddRoom: () => void;
  onEditRoom: (r: Room) => void;
  onVoiceCommand: () => void;
}

export const DashboardView = memo(({ 
  briefing, rooms, batches, 
  onBackup, onImport, onCamera, onSelectBatch, onAddBatch, onAddRoom, onEditRoom, onVoiceCommand 
}: DashboardViewProps) => {

  const activeBatches = batches.filter(b => b.isActive !== false);

  const getBriefingBorderColor = (status: string) => {
      switch (status) {
          case 'CRITICAL': return 'border-l-alert-red';
          case 'ATTENTION': return 'border-l-yellow-500';
          case 'OPTIMAL': 
          default: return 'border-l-neon-green';
      }
  };

  return (
    <div className="p-4 sm:p-6 pt-safe-top animate-fade-in pb-32 space-y-8 max-w-7xl mx-auto">
        
        {/* Top Header */}
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white mb-1 drop-shadow-xl font-sans">COMMAND CENTER</h1>
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse shadow-[0_0_8px_#00ffa3]"></span>
                    Gemini 3 Pro Active
                </div>
            </div>
            
            <button 
                onClick={() => { Haptic.tap(); onVoiceCommand(); }}
                className="relative group p-4 bg-[#111] rounded-full border border-white/10 hover:border-neon-green/50 transition-all active:scale-95 shadow-lg"
            >
                <Mic className="w-6 h-6 text-white group-hover:text-neon-green transition-colors" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-neon-green shadow-[0_0_5px_#00ffa3]"></span>
                </span>
            </button>
        </div>

        {/* Facility Briefing Card */}
        {briefing ? (
            <BentoCard 
                className={`!bg-[#0A0A0A] !border-l-4 ${getBriefingBorderColor(briefing.status)} shadow-2xl`} 
                title="FACILITY BRIEFING"
                headerAction={
                    <div className="flex items-center gap-2">
                         <StatusBadge status={briefing.status} pulse={briefing.status === 'CRITICAL'} size="sm" />
                        <button 
                            onClick={() => { Haptic.tap(); /* Play Audio */ }}
                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neon-green transition-colors active:scale-90"
                        >
                            <Volume2 className="w-4 h-4" />
                        </button>
                    </div>
                }
            >
                <div className="px-5 pb-5 pt-2">
                    <p className="text-sm text-gray-300 leading-relaxed font-medium max-w-3xl mb-6">{briefing.summary}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {briefing.actionItems.length > 0 ? briefing.actionItems.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex items-center justify-between bg-[#111] px-4 py-3 rounded-xl border border-white/5 hover:border-white/20 hover:bg-[#161616] transition-all group cursor-pointer active:scale-[0.99]">
                                <div className="flex gap-3 items-center overflow-hidden flex-1 mr-2">
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.priority === 'High' ? 'bg-alert-red shadow-[0_0_5px_#ff0055]' : 'bg-neon-blue'}`} />
                                    <span className="text-xs text-gray-300 truncate group-hover:text-white transition-colors font-medium tracking-wide">{item.task}</span>
                                </div>
                                {item.dueDate && (
                                    <span className="text-[9px] text-gray-600 font-mono whitespace-nowrap bg-black px-1.5 py-0.5 rounded border border-white/5">
                                        {item.dueDate}
                                    </span>
                                )}
                            </div>
                        )) : (
                            <div className="col-span-full text-[10px] text-gray-600 font-mono text-center py-4 border border-dashed border-white/5 rounded-xl bg-white/[0.02]">
                                No pending actions
                            </div>
                        )}
                    </div>
                </div>
            </BentoCard>
        ) : (
            <SkeletonCard />
        )}

        {/* Rooms Section */}
        <section className="space-y-4">
            <div className="flex justify-between items-center px-1">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1 h-1 bg-gray-500 rounded-full"></span> Environments
                </h2>
                <button onClick={() => { Haptic.tap(); onAddRoom(); }} className="text-[10px] font-bold text-neon-blue hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-white/5 bg-transparent border border-transparent hover:border-white/10">
                    <Plus className="w-3 h-3" /> Add Room
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {rooms.map(room => (
                    <RoomTile 
                        key={room.id} 
                        room={room} 
                        onClick={() => onEditRoom(room)} 
                        onEdit={onEditRoom} 
                    />
                ))}
            </div>
        </section>

        {/* Active Batches Section */}
        <section className="space-y-4">
            <div className="flex justify-between items-center px-1">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1 h-1 bg-gray-500 rounded-full"></span> Active Cohorts
                </h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {activeBatches.map(batch => {
                    const daysInStage = Math.floor((Date.now() - batch.startDate) / (1000 * 60 * 60 * 24));
                    const totalDaysEst = batch.currentStage === 'Flowering' ? (batch.breederHarvestDays || 65) : 30; 
                    
                    return (
                        <BentoCard 
                            key={batch.id}
                            title={batch.batchTag}
                            className="p-5 !bg-[#111] min-h-[160px]"
                            onClick={() => onSelectBatch(batch)}
                            active={true}
                            accent="neon-blue"
                        >
                            <div className="h-full flex flex-col justify-between">
                                <div>
                                    <div className="text-sm font-bold text-white mb-1 line-clamp-1">{batch.strain}</div>
                                    <div className="text-[10px] text-gray-500 mb-4">{batch.soilMix}</div>
                                </div>
                                <div className="mt-auto">
                                   <StageProgressBar 
                                       current={daysInStage} 
                                       total={totalDaysEst} 
                                       label={batch.currentStage as string} 
                                   />
                                </div>
                            </div>
                        </BentoCard>
                    );
                })}

                {/* Quick Action Tile */}
                <button 
                    onClick={() => { Haptic.tap(); onAddBatch(); }}
                    className="rounded-[24px] border border-dashed border-white/10 bg-[#0A0A0A] flex flex-col items-center justify-center gap-3 p-4 cursor-pointer hover:bg-white/5 hover:border-white/20 transition-all active:scale-[0.99] group min-h-[160px]"
                >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-neon-green/10 transition-colors border border-white/5">
                        <Plus className="w-6 h-6 text-gray-500 group-hover:text-neon-green transition-colors" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-white transition-colors">Start New Run</span>
                </button>
            </div>
        </section>

        {/* Footer */}
        <div className="pt-8 pb-4 flex justify-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
            <button onClick={onImport} className="flex items-center gap-2 text-[10px] font-mono text-gray-500 hover:text-white transition-colors uppercase tracking-wider">
                <Upload className="w-3 h-3" /> Import Legacy
            </button>
            <div className="w-px h-3 bg-gray-700"></div>
            <button onClick={onBackup} className="flex items-center gap-2 text-[10px] font-mono text-gray-500 hover:text-white transition-colors uppercase tracking-wider">
                <Database className="w-3 h-3" /> Backup Data
            </button>
        </div>
    </div>
  );
});

DashboardView.displayName = 'DashboardView';
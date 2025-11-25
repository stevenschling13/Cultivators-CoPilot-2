import React, { memo } from 'react';
import { Haptic } from '../../utils/haptics';
import { Room } from '../../types';
import { TrendSparkline, StatusBadge } from './Primitives';
import { Thermometer, Droplet, WifiOff, Settings, Activity, Wind, Wifi } from 'lucide-react';

interface RoomTileProps {
  room: Room;
  onClick: (room: Room) => void;
  onEdit?: (room: Room) => void;
}

export const RoomTile = memo(({ room, onClick, onEdit }: RoomTileProps) => {
  const { metrics } = room;
  const isOffline = metrics.status === 'OFFLINE';
  
  // Theme logic
  let borderColor = 'border-white/5';
  let accentGradient = 'from-gray-800/20 to-transparent';
  let vpdColor = 'text-white';
  
  switch (metrics.status) {
    case 'CRITICAL':
      borderColor = 'border-alert-red/40';
      accentGradient = 'from-alert-red/10 to-transparent';
      vpdColor = 'text-alert-red text-glow-red';
      break;
    case 'WARNING':
      borderColor = 'border-yellow-500/40';
      accentGradient = 'from-yellow-500/10 to-transparent';
      vpdColor = 'text-yellow-500';
      break;
    case 'NOMINAL':
      borderColor = 'border-white/10';
      accentGradient = 'from-neon-green/5 to-transparent';
      vpdColor = 'text-neon-green text-glow-green';
      break;
  }

  const formatTimeSince = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    const diff = Date.now() - timestamp;
    const min = Math.floor(diff / 60000);
    if (min < 1) return '<1m';
    if (min < 60) return `${min}m`;
    const hours = Math.floor(min / 60);
    return `${hours}h`;
  };

  return (
    <div
      className={`
        relative w-full rounded-[32px] p-6 flex flex-col justify-between
        bg-[#0A0A0A] border ${borderColor}
        transition-all duration-300 overflow-hidden group
        hover:border-white/20 hover:bg-[#111]
      `}
    >
      {/* Click handler */}
      <div 
         className="absolute inset-0 z-0 cursor-pointer active:scale-[0.99] transition-transform"
         onClick={() => { Haptic.tap(); onClick(room); }}
      />

      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accentGradient} opacity-50 pointer-events-none transition-opacity duration-500`} />

      {/* Header */}
      <div className="w-full flex justify-between items-start z-10 pointer-events-none relative mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
             <div className="text-white font-bold text-lg leading-tight tracking-tight">
                {room.name}
             </div>
             {isOffline && <span className="w-2 h-2 rounded-full bg-gray-600" />}
          </div>
          <div className="flex items-center gap-2">
             <StatusBadge status={room.stage} size="sm" />
             <span className="text-[10px] font-mono text-gray-500 uppercase">Day {room.stageDay}</span>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
             <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border border-white/5 backdrop-blur-md ${isOffline ? 'bg-red-500/10' : 'bg-black/40'}`}>
                {isOffline ? (
                   <WifiOff className="w-3 h-3 text-red-400" />
                ) : (
                   <Wifi className="w-3 h-3 text-neon-green" />
                )}
                {isOffline && metrics.lastUpdated > 0 && (
                   <span className="text-[9px] font-mono text-red-400">{formatTimeSince(metrics.lastUpdated)} ago</span>
                )}
             </div>

             {onEdit && (
                 <button 
                    onClick={(e) => { e.stopPropagation(); Haptic.tap(); onEdit(room); }}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5 active:scale-90"
                 >
                     <Settings className="w-4 h-4" />
                 </button>
             )}
        </div>
      </div>

      {/* Metrics Grid - Strict Layout */}
      <div className="grid grid-cols-12 gap-6 z-10 relative pointer-events-none h-24">
          
          {/* Main Metric: VPD (Col 1-7) */}
          <div className="col-span-7 flex flex-col justify-end">
              <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1 flex items-center gap-1.5">
                 <Wind className="w-3 h-3 opacity-70" /> VPD
              </div>
              <div className="flex items-baseline gap-1.5">
                  <div className={`text-6xl font-black tracking-tighter font-mono ${vpdColor} ${isOffline ? 'opacity-50 grayscale' : ''}`}>
                      {metrics.vpd.toFixed(2)}
                  </div>
                  <span className="text-sm font-medium text-gray-600 font-sans transform -translate-y-2">kPa</span>
              </div>
              
              {/* Sparkline */}
              <div className={`h-8 w-full mt-2 ${isOffline ? 'opacity-20 grayscale' : 'opacity-60'}`}>
                  <TrendSparkline data={metrics.history} />
              </div>
          </div>

          {/* Secondary Metrics (Col 8-12) */}
          <div className="col-span-5 flex flex-col justify-between pl-4 border-l border-white/5 py-1">
              
              {/* Temp */}
              <div>
                 <div className="flex justify-between items-end mb-1">
                    <div className="flex items-center gap-1.5 text-gray-500 text-[9px] font-mono uppercase font-bold tracking-wider">
                       <Thermometer className="w-3 h-3" /> Temp
                    </div>
                    <span className={`text-sm font-mono font-bold ${isOffline ? 'text-gray-500' : 'text-white'}`}>{metrics.temp.toFixed(0)}°</span>
                 </div>
                 <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                     <div className={`h-full transition-all duration-1000 ${isOffline ? 'bg-gray-600' : 'bg-white/80'}`} style={{ width: `${Math.min(100, Math.max(0, (metrics.temp - 60) * 2.5))}%` }} />
                 </div>
              </div>

              {/* RH */}
              <div>
                 <div className="flex justify-between items-end mb-1">
                    <div className="flex items-center gap-1.5 text-gray-500 text-[9px] font-mono uppercase font-bold tracking-wider">
                       <Droplet className="w-3 h-3" /> RH
                    </div>
                    <span className={`text-sm font-mono font-bold ${isOffline ? 'text-gray-500' : 'text-white'}`}>{metrics.rh.toFixed(0)}%</span>
                 </div>
                 <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                     <div className={`h-full transition-all duration-1000 ${isOffline ? 'bg-gray-600' : 'bg-neon-blue'}`} style={{ width: `${metrics.rh}%` }} />
                 </div>
              </div>

              {/* CO2 */}
              <div className="flex justify-between items-center pt-1">
                  <div className="flex items-center gap-1.5 text-gray-500 text-[9px] font-mono uppercase font-bold tracking-wider">
                      <Activity className="w-3 h-3" /> CO2
                  </div>
                  <span className={`text-xs font-mono font-bold ${isOffline ? 'text-gray-600' : 'text-gray-400'}`}>{metrics.co2}</span>
              </div>
          </div>
      </div>
    </div>
  );
});
RoomTile.displayName = 'RoomTile';
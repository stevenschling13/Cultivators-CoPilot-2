
import React, { memo } from 'react';
import { Haptic } from '../../utils/haptics';
import { Room } from '../../types';
import { TrendSparkline } from './Primitives';
import { Thermometer, Droplet, WifiOff, Sprout, Activity } from 'lucide-react';

interface RoomTileProps {
  room: Room;
  onClick: (room: Room) => void;
}

export const RoomTile = memo(({ room, onClick }: RoomTileProps) => {
  const { metrics } = room;
  
  // Determine Theme based on Status
  let borderColor = 'border-white/5';
  let statusColor = 'text-white';
  let bgClass = 'bg-[#080808]';
  let ledColor = 'bg-gray-600';

  switch (metrics.status) {
    case 'CRITICAL':
      borderColor = 'border-alert-red/50';
      statusColor = 'text-alert-red';
      bgClass = 'bg-alert-red/5';
      ledColor = 'bg-alert-red shadow-[0_0_8px_#ff0055]';
      break;
    case 'WARNING':
      borderColor = 'border-yellow-500/50';
      statusColor = 'text-yellow-500';
      bgClass = 'bg-yellow-500/5';
      ledColor = 'bg-yellow-500 shadow-[0_0_8px_#eab308]';
      break;
    case 'OFFLINE':
      borderColor = 'border-gray-800';
      statusColor = 'text-gray-500';
      ledColor = 'bg-gray-700';
      break;
    case 'NOMINAL':
    default:
      borderColor = 'border-white/10';
      statusColor = 'text-neon-green';
      ledColor = 'bg-neon-green shadow-[0_0_8px_#00ffa3]';
      break;
  }

  const isOffline = metrics.status === 'OFFLINE';

  return (
    <button
      onClick={() => { Haptic.tap(); onClick(room); }}
      className={`
        relative w-full aspect-square rounded-[24px] p-5 flex flex-col justify-between
        ${bgClass} border ${borderColor}
        transition-all duration-300 active:scale-[0.98] overflow-hidden group
        hover:border-white/20
      `}
    >
      {/* Scanline Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>
      
      {/* Noise */}
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay"></div>

      {/* Header */}
      <div className="w-full flex justify-between items-start z-10">
        <div className="text-left max-w-[80%]">
          <div className="text-white font-bold text-sm leading-tight line-clamp-1 flex items-center gap-2">
             <span className="font-mono tracking-tighter text-[9px] text-gray-500 bg-white/5 px-1 rounded">RM.01</span>
             {room.name}
          </div>
          <div className="text-[9px] font-mono text-gray-400 uppercase mt-1.5 flex items-center gap-1.5">
             <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                <Sprout className="w-3 h-3 text-neon-green" /> 
                <span className="text-white font-bold">DAY {room.stageDay}</span>
             </div>
             <span className="opacity-50">{room.stage}</span>
          </div>
        </div>
        
        {isOffline ? (
           <WifiOff className="w-4 h-4 text-gray-600" />
        ) : (
           <div className={`w-2 h-2 rounded-full ${ledColor} animate-pulse`} />
        )}
      </div>

      {/* Primary Metric: VPD */}
      <div className="z-10 flex flex-col items-start my-auto py-2">
         <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Vapor Pressure Deficit</div>
         <div className={`text-4xl font-bold tracking-tighter font-mono ${statusColor} drop-shadow-sm`}>
            {isOffline ? '--' : metrics.vpd.toFixed(2)}
            <span className="text-xs font-medium text-gray-500 ml-1 font-sans opacity-70">kPa</span>
         </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="flex items-center gap-4 z-10 relative">
         <div className="flex items-center gap-1.5">
             <Thermometer className="w-3 h-3 text-gray-500" />
             <span className="text-xs font-mono font-bold text-gray-300">{isOffline ? '--' : metrics.temp.toFixed(0)}°</span>
         </div>
         <div className="w-px h-3 bg-white/10"></div>
         <div className="flex items-center gap-1.5">
             <Droplet className="w-3 h-3 text-gray-500" />
             <span className="text-xs font-mono font-bold text-gray-300">{isOffline ? '--' : metrics.rh.toFixed(0)}%</span>
         </div>
         <div className="w-px h-3 bg-white/10"></div>
         <div className="flex items-center gap-1.5">
             <Activity className="w-3 h-3 text-gray-500" />
             <span className="text-xs font-mono font-bold text-gray-300">{isOffline ? '--' : metrics.co2}</span>
         </div>
      </div>

      {/* Sparkline Background */}
      <div className="absolute bottom-0 left-0 right-0 h-28 opacity-20 pointer-events-none mix-blend-screen mask-image-gradient">
         <TrendSparkline data={metrics.history} />
      </div>
    </button>
  );
});
RoomTile.displayName = 'RoomTile';

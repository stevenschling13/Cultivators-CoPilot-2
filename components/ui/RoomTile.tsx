
import React, { memo } from 'react';
import { Haptic } from '../../utils/haptics';
import { Room } from '../../types';
import { TrendSparkline } from './Primitives';
import { Thermometer, Droplet, WifiOff } from 'lucide-react';

interface RoomTileProps {
  room: Room;
  onClick: (room: Room) => void;
}

export const RoomTile = memo(({ room, onClick }: RoomTileProps) => {
  const { metrics } = room;
  
  // Determine Theme based on Status
  let borderColor = 'border-white/5';
  let glowColor = '';
  let statusColor = 'text-white';
  let bgGradient = 'from-[#0F0F0F] to-[#0F0F0F]';

  switch (metrics.status) {
    case 'CRITICAL':
      borderColor = 'border-alert-red';
      glowColor = 'shadow-[0_0_15px_rgba(255,0,85,0.3)]';
      statusColor = 'text-alert-red';
      bgGradient = 'from-alert-red/10 to-[#0F0F0F]';
      break;
    case 'WARNING':
      borderColor = 'border-yellow-500';
      statusColor = 'text-yellow-500';
      glowColor = 'shadow-[0_0_10px_rgba(234,179,8,0.2)]';
      break;
    case 'OFFLINE':
      borderColor = 'border-gray-700';
      statusColor = 'text-gray-500';
      break;
    case 'NOMINAL':
    default:
      borderColor = 'border-white/10';
      statusColor = 'text-neon-green';
      break;
  }

  const isOffline = metrics.status === 'OFFLINE';

  return (
    <button
      onClick={() => { Haptic.tap(); onClick(room); }}
      className={`
        relative w-full aspect-[1/1.1] rounded-3xl p-4 flex flex-col justify-between
        bg-gradient-to-b ${bgGradient} border ${borderColor} ${glowColor}
        transition-all duration-300 active:scale-[0.98] overflow-hidden group
        ${isOffline ? 'opacity-60' : ''}
      `}
    >
      {/* Header: Name & Stage */}
      <div className="w-full flex justify-between items-start z-10">
        <div className="text-left">
          <div className="text-white font-bold text-sm leading-tight line-clamp-1">{room.name}</div>
          <div className="text-[10px] font-mono text-gray-400 uppercase mt-0.5">
            {room.stage} · Day {room.stageDay}
          </div>
        </div>
        
        {isOffline ? (
           <WifiOff className="w-4 h-4 text-gray-500" />
        ) : (
           <div className={`w-2 h-2 rounded-full ${metrics.status === 'NOMINAL' ? 'bg-neon-green' : metrics.status === 'WARNING' ? 'bg-yellow-500' : 'bg-alert-red'} animate-pulse`} />
        )}
      </div>

      {/* Primary Metric: VPD */}
      <div className="z-10 mt-2">
         <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">VPD (kPa)</div>
         <div className={`text-3xl font-bold tracking-tighter ${statusColor}`}>
            {isOffline ? '--' : metrics.vpd.toFixed(2)}
         </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 z-10 mt-1">
         <div className="flex flex-col">
             <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <Thermometer className="w-3 h-3" /> Temp
             </div>
             <div className="text-sm font-medium text-gray-200">{isOffline ? '--' : metrics.temp}°</div>
         </div>
         <div className="flex flex-col">
             <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <Droplet className="w-3 h-3" /> RH
             </div>
             <div className="text-sm font-medium text-gray-200">{isOffline ? '--' : metrics.rh}%</div>
         </div>
      </div>

      {/* Bottom: Sparkline */}
      <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 pointer-events-none">
         <TrendSparkline data={metrics.history} />
      </div>
      
      {/* Glassy shine effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </button>
  );
});
RoomTile.displayName = 'RoomTile';

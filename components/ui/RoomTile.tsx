
import React, { memo } from 'react';
import { Haptic } from '../../utils/haptics';
import { Room } from '../../types';
import { TrendSparkline } from './Primitives';
import { Thermometer, Droplet, WifiOff, Sprout, Activity, Settings, Wind } from 'lucide-react';

interface RoomTileProps {
  room: Room;
  onClick: (room: Room) => void;
  onEdit?: (room: Room) => void;
}

export const RoomTile = memo(({ room, onClick, onEdit }: RoomTileProps) => {
  const { metrics } = room;
  
  // Determine Theme based on Status
  let borderColor = 'border-white/5';
  let statusColor = 'text-white';
  let bgClass = 'bg-[#080808]';
  let ledColor = 'bg-gray-600';
  let accentGradient = 'from-gray-800/20 to-transparent';

  switch (metrics.status) {
    case 'CRITICAL':
      borderColor = 'border-alert-red/50';
      statusColor = 'text-alert-red';
      bgClass = 'bg-alert-red/5';
      ledColor = 'bg-alert-red shadow-[0_0_8px_#ff0055]';
      accentGradient = 'from-alert-red/20 to-transparent';
      break;
    case 'WARNING':
      borderColor = 'border-yellow-500/50';
      statusColor = 'text-yellow-500';
      bgClass = 'bg-yellow-500/5';
      ledColor = 'bg-yellow-500 shadow-[0_0_8px_#eab308]';
      accentGradient = 'from-yellow-500/20 to-transparent';
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
      accentGradient = 'from-neon-green/10 to-transparent';
      break;
  }

  const isOffline = metrics.status === 'OFFLINE';

  return (
    <div
      className={`
        relative w-full aspect-[1.8/1] sm:aspect-[2.5/1] rounded-[32px] p-6 flex flex-col justify-between
        ${bgClass} border ${borderColor}
        transition-all duration-300 overflow-hidden group
        hover:border-white/20
      `}
    >
      {/* Clickable Area Overlay */}
      <div 
         className="absolute inset-0 z-0 cursor-pointer active:scale-[0.98] transition-transform"
         onClick={() => { Haptic.tap(); onClick(room); }}
      />

      {/* Dynamic Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accentGradient} opacity-50 pointer-events-none`} />

      {/* Scanline Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>
      
      {/* Noise Texture */}
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay"></div>

      {/* Header Row */}
      <div className="w-full flex justify-between items-start z-10 pointer-events-none relative">
        <div>
          <div className="text-white font-bold text-lg leading-tight line-clamp-1 flex items-center gap-2">
             {room.name}
             <span className="font-mono tracking-tighter text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                {room.id.slice(-4).toUpperCase()}
             </span>
          </div>
          <div className="text-[10px] font-mono text-gray-400 uppercase mt-1 flex items-center gap-2">
             <div className="flex items-center gap-1">
                <Sprout className="w-3 h-3 text-gray-500" /> 
                <span className="opacity-70">{room.stage} • Day {room.stageDay}</span>
             </div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-3 pointer-events-auto">
             {onEdit && (
                 <button 
                    onClick={(e) => { e.stopPropagation(); Haptic.tap(); onEdit(room); }}
                    className="p-2 rounded-full bg-black/20 hover:bg-white/10 text-gray-400 hover:text-white transition-colors backdrop-blur-md border border-white/5"
                 >
                     <Settings className="w-4 h-4" />
                 </button>
             )}
             <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-2 py-1 rounded-full border border-white/5">
                {isOffline ? (
                    <WifiOff className="w-3 h-3 text-gray-600" />
                ) : (
                    <div className={`w-2 h-2 rounded-full ${ledColor} animate-pulse`} />
                )}
                <span className="text-[9px] font-mono font-bold text-gray-500">{metrics.status}</span>
             </div>
        </div>
      </div>

      {/* Content Grid - Split Layout to fill void */}
      <div className="flex-1 grid grid-cols-5 gap-4 mt-4 z-10 relative pointer-events-none">
          
          {/* Left Col: Hero Metric (VPD) */}
          <div className="col-span-3 flex flex-col justify-center">
              <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1 flex items-center gap-1.5">
                 <Wind className="w-3 h-3 opacity-70" /> Vapor Pressure Deficit
              </div>
              <div className={`text-5xl sm:text-6xl font-black tracking-tighter font-mono ${statusColor} drop-shadow-lg`}>
                  {isOffline ? '--' : metrics.vpd.toFixed(2)}
                  <span className="text-lg font-medium text-gray-500 ml-1 font-sans opacity-60">kPa</span>
              </div>
              <div className="h-8 w-3/4 opacity-60 mt-2">
                  <TrendSparkline data={metrics.history} />
              </div>
          </div>

          {/* Right Col: Telemetry Stack */}
          <div className="col-span-2 flex flex-col justify-center gap-2 border-l border-white/5 pl-4">
              {/* Temp */}
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-gray-400">
                      <Thermometer className="w-3 h-3" />
                      <span className="text-[10px] font-mono uppercase">Temp</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-white">{isOffline ? '--' : metrics.temp.toFixed(0)}°F</span>
              </div>
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-white opacity-80" style={{ width: `${Math.min(100, Math.max(0, (metrics.temp - 60) * 2.5))}%` }} />
              </div>

              {/* RH */}
              <div className="flex justify-between items-center mt-1">
                  <div className="flex items-center gap-2 text-gray-400">
                      <Droplet className="w-3 h-3" />
                      <span className="text-[10px] font-mono uppercase">RH</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-white">{isOffline ? '--' : metrics.rh.toFixed(0)}%</span>
              </div>
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                   <div className="h-full bg-neon-blue" style={{ width: `${metrics.rh}%` }} />
              </div>

              {/* CO2 */}
              <div className="flex justify-between items-center mt-1">
                  <div className="flex items-center gap-2 text-gray-400">
                      <Activity className="w-3 h-3" />
                      <span className="text-[10px] font-mono uppercase">CO2</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-gray-300">{isOffline ? '--' : metrics.co2}</span>
              </div>
          </div>
      </div>
    </div>
  );
});
RoomTile.displayName = 'RoomTile';


import React, { memo } from 'react';
import { ArOverlayData, RoomMetrics } from '../../types';
import { Thermometer, Droplet, Wind, Hash, Leaf, Activity, AlertTriangle } from 'lucide-react';

interface ArHudProps {
  data: ArOverlayData;
  isScanning: boolean;
  metrics?: RoomMetrics | null;
}

export const ArHud = memo(({ data, isScanning, metrics }: ArHudProps) => {
  
  // Dynamic Colors based on state
  const isWarning = data.status === 'WARNING' || !!data.criticalWarning;
  const isLocked = data.status === 'LOCKED' || data.status === 'ANALYZING';
  const isAcquiring = data.status === 'ACQUIRING' || data.status === 'INITIALIZING';

  const mainColor = isWarning ? '#ff0055' : isLocked ? '#00ffa3' : isAcquiring ? '#ff3333' : '#ffffff';
  const strokeWidth = 1.5;

  // Calculate Ring Size based on Stability (0-100)
  // Stability 0 = Large Ring (Acquiring)
  // Stability 100 = Tight Ring (Locked)
  // Invert logic: Lower stability = Larger radius
  const baseRadius = 15;
  const stabilityOffset = Math.max(0, (100 - data.stability) * 0.8); 
  const ringRadius = baseRadius + stabilityOffset;
  
  // Determine ring color: Red (unstable) -> Yellow -> Green (stable)
  const ringColor = data.stability < 50 ? '#ff0055' : data.stability < 80 ? '#eab308' : '#00ffa3';
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="scanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
             <stop offset="0%" stopColor="transparent" />
             <stop offset="50%" stopColor={mainColor} stopOpacity="0.5" />
             <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* --- CENTRAL RETICLE SYSTEM --- */}
        <g transform="translate(50, 50)" filter="url(#glow)">
           {/* Dynamic Locking Ring */}
           <circle 
              cx="0" cy="0" r={ringRadius} 
              fill="none" 
              stroke={ringColor} 
              strokeWidth={strokeWidth} 
              strokeDasharray="10 5"
              className="transition-all duration-300 ease-out"
           />
           
           {/* Center Dot */}
           <circle cx="0" cy="0" r="0.5" fill={mainColor} />
           
           {/* Crosshairs */}
           <line x1="-5" y1="0" x2="-2" y2="0" stroke={mainColor} strokeWidth={strokeWidth} />
           <line x1="2" y1="0" x2="5" y2="0" stroke={mainColor} strokeWidth={strokeWidth} />
           <line x1="0" y1="-5" x2="0" y2="-2" stroke={mainColor} strokeWidth={strokeWidth} />
           <line x1="0" y1="2" x2="0" y2="5" stroke={mainColor} strokeWidth={strokeWidth} />

           {/* Scanning Laser Line (Vertical Sweep) */}
           {isScanning && (
               <rect x="-40" y="-50" width="80" height="2" fill="url(#scanGradient)" opacity="0.5">
                   <animateTransform 
                      attributeName="transform" 
                      type="translate" 
                      from="0 -40" 
                      to="0 40" 
                      dur="1.5s" 
                      repeatCount="indefinite" 
                   />
               </rect>
           )}
        </g>

        {/* --- CORNER BRACKETS --- */}
        <g stroke={mainColor} strokeWidth={strokeWidth} fill="none" opacity="0.6">
           {/* Top Left */}
           <path d="M 5 15 L 5 5 L 15 5" />
           {/* Top Right */}
           <path d="M 85 5 L 95 5 L 95 15" />
           {/* Bottom Left */}
           <path d="M 5 85 L 5 95 L 15 95" />
           {/* Bottom Right */}
           <path d="M 85 95 L 95 95 L 95 85" />
        </g>

        {/* --- STABILITY BAR (Top Center) --- */}
        <g transform="translate(35, 8)">
           {/* Background Track */}
           <rect x="0" y="0" width="30" height="1" fill="#333" />
           {/* Stability Indicator */}
           <rect 
              x={15 - (data.stability * 0.15)} 
              y="0" 
              width={data.stability * 0.3} 
              height="1" 
              fill={ringColor}
              className="transition-all duration-200" 
           />
           <text x="15" y="-2" textAnchor="middle" fill={ringColor} fontSize="2" fontFamily="monospace" fontWeight="bold">
              {data.stability < 50 ? "STABILIZE" : "LOCKED"}
           </text>
        </g>

      </svg>

      {/* --- HTML OVERLAYS (For complex text layout) --- */}
      
      {/* TOP RIGHT: Telemetry Group */}
      {metrics && (
         <div className="absolute top-6 right-6 text-right font-mono">
            <div className="text-[10px] text-neon-blue uppercase tracking-widest mb-1 opacity-80">Telemetry</div>
            <div className="flex flex-col gap-1 bg-black/40 backdrop-blur border-r-2 border-neon-blue p-2 pr-3">
               <div className="flex items-center justify-end gap-2 text-white text-xs">
                  <span>{metrics.temp.toFixed(0)}°F</span> <Thermometer className="w-3 h-3 text-gray-400" />
               </div>
               <div className="flex items-center justify-end gap-2 text-white text-xs">
                  <span>{metrics.rh.toFixed(0)}%</span> <Droplet className="w-3 h-3 text-gray-400" />
               </div>
               <div className="flex items-center justify-end gap-2 text-neon-green text-xs font-bold">
                  <span>{metrics.vpd.toFixed(2)} kPa</span> <Wind className="w-3 h-3" />
               </div>
            </div>
         </div>
      )}

      {/* LEFT: Biological Metrics Group */}
      {(data.colaCount !== undefined || data.biomassEstimate) && (
         <div className="absolute top-1/3 left-6 font-mono flex flex-col gap-3 animate-slide-in-left">
             {/* Cola Count */}
             <div className="flex items-center gap-3">
                 <div className="w-8 h-8 flex items-center justify-center border border-neon-green/50 bg-neon-green/10 rounded">
                     <Hash className="w-4 h-4 text-neon-green" />
                 </div>
                 <div>
                     <div className="text-[8px] text-gray-400 uppercase">Cola Count</div>
                     <div className="text-lg font-bold text-white leading-none">{data.colaCount || '--'}</div>
                 </div>
             </div>

             {/* Biomass */}
             <div className="flex items-center gap-3">
                 <div className="w-8 h-8 flex items-center justify-center border border-neon-blue/50 bg-neon-blue/10 rounded">
                     <Leaf className="w-4 h-4 text-neon-blue" />
                 </div>
                 <div>
                     <div className="text-[8px] text-gray-400 uppercase">Biomass</div>
                     <div className="text-xs font-bold text-white leading-none">{data.biomassEstimate || 'SCANNING'}</div>
                 </div>
             </div>

             {/* Health */}
             <div className="flex items-center gap-3">
                 <div className="w-8 h-8 flex items-center justify-center border border-uv-purple/50 bg-uv-purple/10 rounded">
                     <Activity className="w-4 h-4 text-uv-purple" />
                 </div>
                 <div>
                     <div className="text-[8px] text-gray-400 uppercase">Vigor</div>
                     <div className="text-xs font-bold text-white leading-none">{data.healthStatus || 'PENDING'}</div>
                 </div>
             </div>
         </div>
      )}

      {/* CENTER GUIDANCE PILL */}
      {data.guidance && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2">
              <div className={`
                  px-4 py-1.5 rounded-full border backdrop-blur-md text-xs font-bold font-mono uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(0,0,0,0.5)]
                  ${isWarning 
                      ? 'bg-alert-red/20 border-alert-red text-alert-red animate-pulse' 
                      : 'bg-black/60 border-neon-green text-neon-green'}
              `}>
                  {isWarning && <AlertTriangle className="w-3 h-3" />}
                  {data.guidance}
              </div>
          </div>
      )}

      {/* BOTTOM: System Status */}
      <div className="absolute bottom-32 left-6 right-6 flex justify-between items-end opacity-80 font-mono">
          <div className="text-[9px] text-neon-green">
              <div>SYS: {data.status}</div>
              <div>STABILITY: {data.stability.toFixed(0)}%</div>
          </div>
          <div className="text-[9px] text-neon-blue text-right">
              <div>CONF: {(data.confidence || 0).toFixed(0)}%</div>
              <div>V.3.1.0 SMART-VIS</div>
          </div>
      </div>
    </div>
  );
});

ArHud.displayName = 'ArHud';

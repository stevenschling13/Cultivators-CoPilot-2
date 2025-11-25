import React, { memo, useEffect, useState, useRef } from 'react';
import { ArOverlayData, RoomMetrics } from '../../types';
import { Activity, Leaf, Hash, AlertTriangle, Target, MessageSquare, Thermometer, Droplet, Wind } from 'lucide-react';
import { Haptic } from '../../utils/haptics';

interface ArHudProps {
  data: ArOverlayData | null;
  isScanning: boolean;
  metrics?: RoomMetrics | null;
  onMetricSelect?: (metric: string) => void;
}

export const ArHud = memo(({ data, isScanning, metrics, onMetricSelect }: ArHudProps) => {
  const [scanLinePos, setScanLinePos] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulated Spectral Graph Animation
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    const bands = 20;
    const values = new Array(bands).fill(0);

    const animate = () => {
        // Update simulated spectral values
        for(let i=0; i<bands; i++) {
            values[i] = Math.max(0.1, Math.min(1.0, values[i] + (Math.random() - 0.5) * 0.2));
        }

        ctx.clearRect(0, 0, 100, 40);
        const barWidth = 4;
        const gap = 1;
        
        values.forEach((v, i) => {
            const h = v * 30;
            // Color gradient based on frequency band (simulated)
            ctx.fillStyle = i < 5 ? '#00d4ff' : i < 15 ? '#00ffa3' : '#bd00ff'; 
            ctx.fillRect(i * (barWidth + gap), 40 - h, barWidth, h);
        });
        
        frameId = requestAnimationFrame(animate);
    };
    
    if (isScanning) animate();
    return () => cancelAnimationFrame(frameId);
  }, [isScanning]);

  // Scan Line Animation
  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      setScanLinePos(prev => (prev + 1.5) % 100);
    }, 20);
    return () => clearInterval(interval);
  }, [isScanning]);

  const statusColor = data?.criticalWarning ? 'text-alert-red' : 'text-neon-green';
  const borderColor = data?.criticalWarning ? 'border-alert-red/50' : 'border-neon-green/50';

  // Stress Gauge Logic
  const stressLevel = data?.stressLevel || 10; // Default nominal

  const handleMetricClick = (metric: string) => {
      if (onMetricSelect) {
          Haptic.tap();
          onMetricSelect(metric);
      }
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono">
      {/* Grid Overlay */}
      <div className="absolute inset-0 opacity-10" 
           style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 163, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 163, 0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      {/* Scanning Line */}
      {isScanning && (
        <div 
          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-neon-green to-transparent opacity-50 z-0"
          style={{ top: `${scanLinePos}%` }}
        />
      )}

      {/* Corners */}
      <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-neon-green opacity-50 rounded-tl-lg"></div>
      <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-neon-green opacity-50 rounded-tr-lg"></div>
      <div className="absolute bottom-24 left-6 w-8 h-8 border-b-2 border-l-2 border-neon-green opacity-50 rounded-bl-lg"></div>
      <div className="absolute bottom-24 right-6 w-8 h-8 border-b-2 border-r-2 border-neon-green opacity-50 rounded-br-lg"></div>

      {/* Central Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 flex items-center justify-center opacity-60 pointer-events-none">
          <div className={`absolute inset-0 border border-dashed rounded-full animate-[spin_10s_linear_infinite] ${borderColor}`}></div>
          <div className="absolute inset-4 border border-white/10 rounded-full"></div>
          <Target className={`w-8 h-8 ${statusColor} opacity-80`} />
          
          {/* Reticle Ticks */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-4 bg-neon-green"></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1px] h-4 bg-neon-green"></div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-neon-green"></div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-neon-green"></div>
      </div>

      {/* --- HUD LAYOUT --- */}

      {/* Top Right: Sensor Fusion Overlay */}
      {metrics && (
         <div className="absolute top-8 right-8 flex flex-col items-end gap-1 animate-slide-in-left pointer-events-auto cursor-pointer active:scale-95 transition-transform" onClick={() => handleMetricClick('environment')}>
            <div className="text-[8px] text-neon-blue uppercase tracking-widest mb-1">Real-time Telemetry</div>
            <div className="flex items-center gap-4 bg-black/60 backdrop-blur-md border border-neon-blue/30 p-2 rounded-lg hover:bg-neon-blue/10 transition-colors">
                <div className="flex flex-col items-center">
                   <div className="flex items-center gap-1 text-gray-400 text-[9px]">
                      <Thermometer className="w-3 h-3" /> T
                   </div>
                   <span className="text-sm font-bold text-white">{metrics.temp.toFixed(0)}°</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col items-center">
                   <div className="flex items-center gap-1 text-gray-400 text-[9px]">
                      <Droplet className="w-3 h-3" /> RH
                   </div>
                   <span className="text-sm font-bold text-white">{metrics.rh.toFixed(0)}%</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col items-center">
                   <div className="flex items-center gap-1 text-gray-400 text-[9px]">
                      <Wind className="w-3 h-3" /> VPD
                   </div>
                   <span className={`text-sm font-bold ${metrics.vpd > 1.6 ? 'text-alert-red' : 'text-neon-green'}`}>
                      {metrics.vpd.toFixed(2)}
                   </span>
                </div>
            </div>
         </div>
      )}

      {/* Center Top: AI Guidance */}
      {data?.guidance && (
         <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-auto cursor-pointer active:scale-95 transition-transform" onClick={() => handleMetricClick('guidance')}>
             <div className="bg-neon-green/20 border border-neon-green/50 text-neon-green px-4 py-1 rounded-full text-xs font-bold tracking-wide flex items-center gap-2 animate-pulse shadow-[0_0_15px_rgba(0,255,163,0.4)] hover:bg-neon-green/30">
                 <MessageSquare className="w-3 h-3" />
                 {data.guidance.toUpperCase()}
             </div>
         </div>
      )}

      {/* Left Sidebar: Analysis Data */}
      <div className="absolute top-1/3 left-6 flex flex-col gap-4 pointer-events-auto">
          <div onClick={() => handleMetricClick('colaCount')} className="bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded-lg flex items-center gap-3 animate-slide-in-left cursor-pointer hover:bg-white/10 active:scale-95 transition-all">
             <div className="p-1.5 bg-neon-green/10 rounded">
                <Hash className="w-4 h-4 text-neon-green" />
             </div>
             <div>
                <div className="text-[8px] text-gray-400 uppercase">Colas</div>
                <div className="text-lg font-bold text-white leading-none">{data?.colaCount ?? '--'}</div>
             </div>
          </div>

          <div onClick={() => handleMetricClick('biomass')} className="bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded-lg flex items-center gap-3 animate-slide-in-left cursor-pointer hover:bg-white/10 active:scale-95 transition-all" style={{ animationDelay: '100ms' }}>
             <div className="p-1.5 bg-neon-blue/10 rounded">
                <Leaf className="w-4 h-4 text-neon-blue" />
             </div>
             <div>
                <div className="text-[8px] text-gray-400 uppercase">Biomass</div>
                <div className="text-xs font-bold text-white leading-none">{data?.biomassEstimate || 'SCANNING'}</div>
             </div>
          </div>
          
          <div onClick={() => handleMetricClick('health')} className="bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded-lg flex items-center gap-3 animate-slide-in-left cursor-pointer hover:bg-white/10 active:scale-95 transition-all" style={{ animationDelay: '200ms' }}>
             <div className="p-1.5 bg-uv-purple/10 rounded">
                <Activity className="w-4 h-4 text-uv-purple" />
             </div>
             <div>
                <div className="text-[8px] text-gray-400 uppercase">Health</div>
                <div className="text-xs font-bold text-white leading-none">{data?.healthStatus || 'ANALYZING'}</div>
             </div>
          </div>
      </div>

      {/* Right Sidebar: Stress Gauge & Spectrum */}
      <div className="absolute top-1/3 right-6 flex flex-col gap-6 items-end pointer-events-auto">
          {/* Stress Gauge */}
          <div onClick={() => handleMetricClick('stress')} className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform group">
             <div className="relative w-16 h-16 group-hover:scale-110 transition-transform">
                 <svg className="w-full h-full -rotate-90">
                     <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="transparent" />
                     <circle 
                        cx="32" cy="32" r="28" 
                        stroke={stressLevel > 50 ? '#ff0055' : '#00ffa3'} 
                        strokeWidth="4" 
                        fill="transparent"
                        strokeDasharray="175.9" // 2 * pi * 28
                        strokeDashoffset={(175.9 * (100 - stressLevel)) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                     />
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center flex-col">
                     <span className="text-[10px] font-bold text-white">{stressLevel}%</span>
                     <span className="text-[6px] text-gray-400 uppercase group-hover:text-neon-green transition-colors">Stress</span>
                 </div>
             </div>
          </div>

          {/* Spectral Graph */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded-lg">
              <div className="text-[8px] text-gray-500 uppercase mb-1 text-right">Spectral Analysis</div>
              <canvas ref={canvasRef} width={100} height={40} />
          </div>
      </div>

      {/* Status Bar (Top Center) */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 shadow-lg pointer-events-none">
          <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-neon-green animate-pulse' : 'bg-alert-red'}`}></div>
          <span className="text-[10px] font-bold text-white tracking-widest">
             {data?.status || "SYSTEM INITIALIZING"}
          </span>
      </div>

      {/* Warnings (Bottom Center) */}
      {data?.criticalWarning && (
         <div onClick={() => handleMetricClick('warning')} className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-alert-red/20 border border-alert-red/50 backdrop-blur-md px-6 py-3 rounded-xl flex items-center gap-3 animate-bounce shadow-[0_0_20px_rgba(255,0,85,0.3)] pointer-events-auto cursor-pointer active:scale-95 transition-transform">
            <AlertTriangle className="w-5 h-5 text-alert-red" />
            <div className="text-xs font-bold text-white uppercase tracking-widest">
               WARNING: {data.criticalWarning}
            </div>
         </div>
      )}

      {/* Bottom Data Stream Decoration */}
      <div className="absolute bottom-24 right-6 flex flex-col items-end gap-1 opacity-60 pointer-events-none">
         <div className="text-[8px] text-neon-green">STREAM_BITRATE: 4.2 MBPS</div>
         <div className="text-[8px] text-neon-green">LATENCY: 24ms</div>
         <div className="flex gap-1 mt-1">
            {[...Array(5)].map((_, i) => (
               <div key={i} className={`w-1 h-3 bg-neon-green ${i > 2 ? 'opacity-30' : 'opacity-100'}`}></div>
            ))}
         </div>
      </div>
    </div>
  );
});

ArHud.displayName = 'ArHud';
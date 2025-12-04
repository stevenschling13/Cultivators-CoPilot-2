import { Sparkles } from 'lucide-react';

// --- Custom Tooltip ---
export interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

export const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0F0F0F]/95 border border-white/10 p-3 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-xl z-50 min-w-[140px]">
        <p className="text-[10px] text-gray-400 font-mono mb-2 uppercase tracking-wide border-b border-white/10 pb-1">{label}</p>
        {payload.map((p: any, idx: number) => (
          <div key={idx} className="flex flex-col mb-1.5">
             <div className="flex items-center justify-between gap-4 text-xs font-mono" style={{ color: p.color }}>
                <div className="flex items-center gap-2">
                   <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: p.color }}></span>
                   <span className="font-medium opacity-90">{p.name}</span>
                </div>
                <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
             </div>
             {p.payload?.avgConfidence !== undefined && (
                 <div className="flex justify-end mt-1">
                    <span className={`text-[9px] px-1.5 py-px rounded font-mono border flex items-center gap-1 ${p.payload.avgConfidence >= 0.85 ? 'bg-neon-green/10 text-neon-green border-neon-green/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                        <Sparkles className="w-2 h-2" />
                        AI CONF: {(p.payload.avgConfidence * 100).toFixed(0)}%
                    </span>
                 </div>
             )}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- Custom Axis Tick for Pathology Badges ---
export const PathologyAxisTick = ({ x, y, payload, data }: any) => {
    if (!payload || !payload.value) return null;
    const { value } = payload;
    const stat = data.find((d: any) => d.name === value);
    const conf = stat?.avgConfidence;
    
    // Determine color based on confidence threshold
    const isHighConf = conf >= 0.85;
    const badgeColor = isHighConf ? '#00ffa3' : '#eab308';
    const badgeBg = isHighConf ? 'rgba(0, 255, 163, 0.08)' : 'rgba(234, 179, 8, 0.08)';

    return (
        <g transform={`translate(${x},${y})`}>
            {/* Label Name */}
            <text 
                x={-12} 
                y={conf !== undefined ? -5 : 4} 
                textAnchor="end" 
                fill="#9ca3af" 
                fontSize={10} 
                fontWeight={600} 
                style={{ textTransform: 'uppercase', letterSpacing: '0.02em' }}
            >
                {value}
            </text>
            
            {/* Confidence Badge */}
            {conf !== undefined && (
                <g>
                   <rect x={-58} y={2} width={46} height={12} rx={3} fill={badgeBg} />
                   <text x={-35} y={11} textAnchor="middle" fill={badgeColor} fontSize={8} fontWeight="bold" fontFamily="monospace">
                      {(conf * 100).toFixed(0)}% CONF
                   </text>
                </g>
            )}
        </g>
    );
};
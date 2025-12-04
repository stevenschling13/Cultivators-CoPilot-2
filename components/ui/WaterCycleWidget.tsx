import { memo } from 'react';
import { Droplet, Clock } from 'lucide-react';
import { Haptic } from '../../utils/haptics';

interface WaterCycleWidgetProps {
  lastWaterTimestamp: number;
  onLogWater: () => void;
  drybackHours?: number;
}

export const WaterCycleWidget = memo(({ lastWaterTimestamp, onLogWater, drybackHours = 72 }: WaterCycleWidgetProps) => {
  
  const hoursSince = Math.max(0, Math.floor((Date.now() - lastWaterTimestamp) / (1000 * 60 * 60)));
  
  let status = 'SATURATED';
  let color = 'text-neon-green';
  let bgColor = 'bg-neon-green';
  let borderColor = 'border-neon-green/30';
  let progress = Math.min(100, (hoursSince / drybackHours) * 100);

  if (hoursSince > (drybackHours * 0.66)) {
      status = 'DRY';
      color = 'text-alert-red';
      bgColor = 'bg-alert-red';
      borderColor = 'border-alert-red/30';
  } else if (hoursSince > (drybackHours * 0.33)) {
      status = 'DRYING';
      color = 'text-yellow-500';
      bgColor = 'bg-yellow-500';
      borderColor = 'border-yellow-500/30';
  }

  const moistureLevel = 100 - progress;

  return (
    <div 
      onClick={() => { Haptic.tap(); onLogWater(); }}
      className={`relative overflow-hidden rounded-[24px] bg-[#111] border ${borderColor} p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group`}
    >
        <div className={`absolute bottom-0 left-0 top-0 opacity-10 transition-all duration-1000 ${bgColor}`} style={{ width: `${moistureLevel}%` }}></div>
        
        <div className="flex items-center gap-3 z-10">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border bg-black/40 backdrop-blur ${borderColor}`}>
                <Droplet className={`w-5 h-5 ${color}`} />
            </div>
            <div>
                <div className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>{status}</div>
                <div className="text-xs text-gray-400 font-mono flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {hoursSince === 0 ? 'Just now' : `${hoursSince}h since feed`}
                </div>
            </div>
        </div>

        <div className="z-10 flex flex-col items-end gap-1">
            <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white border border-white/5 transition-colors group-hover:border-white/20">
                Log Feed
            </button>
            <div className="text-[8px] text-gray-600 font-mono">Target: {drybackHours}h</div>
        </div>
    </div>
  );
});
WaterCycleWidget.displayName = 'WaterCycleWidget';
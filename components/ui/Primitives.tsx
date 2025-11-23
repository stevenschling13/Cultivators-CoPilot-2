
import React, { memo, ReactNode, useMemo } from 'react';
import { Haptic } from '../../utils/haptics';
import { VpdZone } from '../../types';
import { ChevronRight } from 'lucide-react';

// --- MetricGauge ---

interface MetricGaugeProps {
  label: string;
  value: string | number;
  unit: string;
  status: VpdZone;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'stable';
}

export const MetricGauge = memo(({ label, value, unit, status, icon: Icon, trend }: MetricGaugeProps) => {
  const isDanger = status === VpdZone.DANGER;
  const isWarning = status === VpdZone.LEECHING; // Using Leeching as generic warning for now
  
  let themeClass = 'bg-neon-green/10 text-neon-green border-neon-green/20';
  let barClass = 'bg-neon-green shadow-[0_0_10px_rgba(0,255,163,0.4)]';
  
  if (isDanger) {
    themeClass = 'bg-alert-red/10 text-alert-red border-alert-red/20';
    barClass = 'bg-alert-red shadow-[0_0_10px_rgba(255,0,85,0.4)]';
  } else if (isWarning) {
    themeClass = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    barClass = 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]';
  }

  return (
    <div className="flex flex-col justify-between h-full relative overflow-hidden">
      <div className="flex justify-between items-start z-10">
         <div className={`p-2.5 rounded-xl border ${themeClass} backdrop-blur-md transition-colors duration-300`}>
           <Icon className="w-5 h-5" aria-hidden="true" />
         </div>
         <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider">{unit}</span>
            {trend && (
              <span className={`text-[9px] font-mono ${trend === 'up' ? 'text-neon-green' : 'text-alert-red'}`}>
                {trend === 'up' ? '▲' : '▼'}
              </span>
            )}
         </div>
      </div>
      
      <div className="z-10 mt-2">
        <div className="text-3xl font-bold text-white tracking-tighter tabular-nums leading-none">{value}</div>
        <div className="text-[11px] font-medium text-gray-400 mt-1 flex items-center gap-1">
           {label}
           {isDanger && <span className="w-2 h-2 bg-alert-red rounded-full animate-pulse"/>}
        </div>
      </div>

      {/* Progress Bar Background */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
         <div className={`h-full ${barClass} transition-all duration-700 ease-out`} style={{ width: isDanger ? '90%' : '60%' }} />
      </div>
    </div>
  );
});
MetricGauge.displayName = 'MetricGauge';

// --- BentoCard ---

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
  title?: string;
  active?: boolean;
  accent?: string;
  bgImage?: string;
  onClick?: () => void;
  headerAction?: ReactNode;
}

export const BentoCard = memo(({ children, className = "", title, onClick, active, accent = "neon-green", bgImage, headerAction, ...props }: BentoCardProps) => {
  const borderColor = active ? `border-${accent}` : 'border-white/5';
  
  return (
    <div 
      onClick={() => { if (onClick) { Haptic.tap(); onClick(); } }}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      role={onClick ? "button" : "region"}
      tabIndex={onClick ? 0 : undefined}
      className={`
        group relative overflow-hidden rounded-[28px] border bg-[#0F0F0F] transition-all duration-300
        ${borderColor}
        ${onClick ? 'active:scale-[0.98] cursor-pointer hover:border-white/15 hover:bg-[#141414]' : ''}
        ${className}
      `}
      {...props}
    >
      {bgImage && (
        <div className="absolute inset-0 z-0 pointer-events-none">
           <img src={bgImage} className="w-full h-full object-cover opacity-20 grayscale group-hover:grayscale-0 group-hover:scale-105 group-hover:opacity-30 transition-all duration-700" alt="" aria-hidden="true" />
           <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F]/90 to-[#0F0F0F]/40" />
        </div>
      )}
      
      {(title || headerAction) && (
        <div className="relative z-20 flex justify-between items-center mb-4 px-1 pt-1">
          {title && (
            <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
              {title}
            </div>
          )}
          {headerAction}
        </div>
      )}
      
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </div>
  );
});
BentoCard.displayName = 'BentoCard';

// --- Stage Progress Bar ---

export const StageProgressBar = ({ current, total, label }: { current: number, total: number, label: string }) => {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1.5 uppercase tracking-wider">
        <span>{label}</span>
        <span className="text-white">{Math.round(percentage)}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-neon-blue to-uv-purple shadow-[0_0_10px_rgba(189,0,255,0.3)]" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// --- Trend Sparkline ---

export const TrendSparkline = memo(({ data }: { data: number[] }) => {
  // Simple SVG sparkline
  const computedPoints = useMemo(() => {
    if (!data.length) return '';
    const max = Math.max(...data, 100);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    return data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((d - min) / range) * 100;
      return `${x},${y}`;
    }).join(' ');
  }, [data]);

  if (!computedPoints) return null;

  return (
    <div className="h-8 w-24 opacity-50">
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
        <polyline
          points={computedPoints}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-neon-green"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});
TrendSparkline.displayName = 'TrendSparkline';

// --- Skeletons ---

export const SkeletonLine = ({ width = "100%", height = "1rem", className = "" }: { width?: string, height?: string, className?: string }) => (
  <div style={{ width, height }} className={`bg-white/5 rounded animate-pulse ${className}`} />
);

export const SkeletonCard = () => (
  <div className="bg-[#121212] rounded-[32px] h-64 w-full border border-white/5 overflow-hidden relative">
    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
    <div className="absolute bottom-6 left-6 right-6 space-y-3">
      <SkeletonLine width="30%" height="0.8rem" />
      <SkeletonLine width="60%" height="2rem" />
    </div>
  </div>
);

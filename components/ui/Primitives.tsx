import React, { memo, ReactNode, useMemo } from 'react';
import { Haptic } from '../../utils/haptics';
import { VpdZone } from '../../types';
import { ChevronRight, Loader2 } from 'lucide-react';

// --- NeonButton ---

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ElementType;
}

export const NeonButton = memo(({ className = "", variant = 'primary', size = 'md', isLoading, icon: Icon, children, onClick, ...props }: NeonButtonProps) => {
  const baseStyles = "relative rounded-xl font-bold font-mono uppercase tracking-wide transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden group select-none";
  
  let variantStyles = "";
  switch (variant) {
    case 'primary':
      variantStyles = "bg-neon-green text-black shadow-[0_0_20px_rgba(0,255,163,0.3)] hover:shadow-[0_0_30px_rgba(0,255,163,0.5)] border border-neon-green hover:bg-neon-green/90";
      break;
    case 'secondary':
      variantStyles = "bg-[#1A1A1A] text-white border border-white/10 hover:bg-white/10 hover:border-white/20";
      break;
    case 'outline':
      variantStyles = "bg-transparent text-neon-green border border-neon-green/50 hover:bg-neon-green/10";
      break;
    case 'danger':
      variantStyles = "bg-alert-red/10 text-alert-red border border-alert-red/30 hover:bg-alert-red/20 shadow-[0_0_15px_rgba(255,0,85,0.1)]";
      break;
    case 'ghost':
      variantStyles = "bg-transparent text-gray-400 hover:text-white hover:bg-white/5";
      break;
  }

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base"
  }[size];

  return (
    <button 
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      onClick={(e) => { if (onClick && !isLoading) { Haptic.tap(); onClick(e); } }}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4" />}
          {children}
        </>
      )}
      {/* Shine effect for primary */}
      {variant === 'primary' && !isLoading && (
        <div className="absolute inset-0 -translate-x-full group-hover:animate-shine bg-gradient-to-r from-transparent via-white/30 to-transparent z-10 pointer-events-none" />
      )}
    </button>
  );
});
NeonButton.displayName = 'NeonButton';

// --- StatusBadge ---

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const StatusBadge = memo(({ status, size = 'md', pulse = false }: StatusBadgeProps) => {
  const s = status.toUpperCase();
  let colors = "bg-gray-800 text-gray-400 border-gray-700"; // Default
  
  if (['OPTIMAL', 'NOMINAL', 'CONNECTED', 'ACTIVE'].some(k => s.includes(k))) {
    colors = "bg-neon-green/10 text-neon-green border-neon-green/20 shadow-[0_0_8px_rgba(0,255,163,0.1)]";
  } else if (['CRITICAL', 'DANGER', 'OFFLINE', 'HIGH', 'SEVERE'].some(k => s.includes(k))) {
    colors = "bg-alert-red/10 text-alert-red border-alert-red/20 shadow-[0_0_8px_rgba(255,0,85,0.1)]";
  } else if (['WARNING', 'ATTENTION', 'LEECHING', 'MEDIUM'].some(k => s.includes(k))) {
    colors = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  } else if (s.includes('VEG') || s.includes('VEGETATIVE')) {
     colors = "bg-neon-green/5 text-neon-green border-neon-green/20";
  } else if (s.includes('FLOWER')) {
    colors = "bg-neon-blue/10 text-neon-blue border-neon-blue/20";
  } else if (s.includes('CLONE')) {
    colors = "bg-white/10 text-white border-white/20";
  } else if (s.includes('DRYING')) {
     colors = "bg-yellow-500/5 text-yellow-500 border-yellow-500/20";
  } else if (s.includes('CURING')) {
     colors = "bg-uv-purple/10 text-uv-purple border-uv-purple/20";
  }

  const sizeClasses = size === 'sm' ? "text-[9px] px-2 py-0.5" : "text-[10px] px-3 py-1";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-bold uppercase tracking-wide select-none ${sizeClasses} ${colors}`}>
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span>
        </span>
      )}
      {status}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

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
  const isWarning = status === VpdZone.LEECHING;
  
  let barColor = 'bg-neon-green';
  let glowColor = 'shadow-[0_0_15px_rgba(0,255,163,0.4)]';
  let textColor = 'text-neon-green';
  
  if (isDanger) {
    barColor = 'bg-alert-red';
    glowColor = 'shadow-[0_0_15px_rgba(255,0,85,0.4)]';
    textColor = 'text-alert-red';
  } else if (isWarning) {
    barColor = 'bg-yellow-500';
    glowColor = 'shadow-[0_0_15px_rgba(234,179,8,0.4)]';
    textColor = 'text-yellow-500';
  }

  // Calculate simulated height
  const fillHeight = isDanger ? '90%' : isWarning ? '80%' : '65%';

  return (
    <div className="relative flex flex-col justify-between h-full p-4 bg-[#0A0A0A] rounded-[20px] border border-white/5 overflow-hidden group hover:border-white/10 transition-colors">
      {/* Background Texture */}
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 pointer-events-none"></div>

      <div className="flex justify-between items-start z-10 relative">
         <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
               <Icon className="w-3 h-3 text-gray-600" aria-hidden="true" />
               {label}
            </span>
            <div className={`text-2xl font-bold tracking-tighter font-mono ${textColor} drop-shadow-sm`}>{value}</div>
         </div>
         
         {/* Vertical HUD Bar */}
         <div className="w-2 h-10 bg-[#151515] rounded-full overflow-hidden border border-white/5 relative">
             <div 
                className={`absolute bottom-0 left-0 right-0 ${barColor} ${glowColor} transition-all duration-1000 ease-in-out`} 
                style={{ height: fillHeight }}
             >
                {/* Glowing Tip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-50 shadow-[0_0_8px_white]"></div>
             </div>
             {/* Scan lines on bar */}
             <div className="absolute inset-0 bg-[linear-gradient(transparent_2px,#000_1px)] bg-[size:100%_3px] opacity-30"></div>
         </div>
      </div>
      
      <div className="z-10 mt-auto pt-2 flex items-center justify-between">
         <span className="text-[10px] font-mono text-gray-600 uppercase font-bold">{unit}</span>
         {trend && (
           <span className={`text-[9px] font-mono flex items-center gap-0.5 ${trend === 'up' ? 'text-neon-green/80' : trend === 'down' ? 'text-alert-red/80' : 'text-gray-500'}`}>
             {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '−'} 
             <span className="opacity-80 tracking-tight">{trend.toUpperCase()}</span>
           </span>
         )}
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
  isLoading?: boolean;
}

export const BentoCard = memo(({ children, className = "", title, onClick, active, accent = "neon-green", bgImage, headerAction, isLoading, ...props }: BentoCardProps) => {
  const borderColor = active ? `border-${accent}` : 'border-white/5';
  const bgGradient = active 
    ? `bg-gradient-to-br from-${accent}/5 to-transparent`
    : 'bg-gradient-to-br from-white/5 to-transparent';
  
  return (
    <div 
      onClick={() => { if (onClick && !isLoading) { Haptic.tap(); onClick(); } }}
      onKeyDown={(e) => { if (onClick && !isLoading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      role={onClick ? "button" : "region"}
      tabIndex={onClick ? 0 : undefined}
      className={`
        group relative overflow-hidden rounded-[24px] border bg-[#0A0A0A] transition-all duration-300
        ${borderColor}
        ${onClick ? 'active:scale-[0.99] cursor-pointer hover:border-white/10 hover:bg-[#111]' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Active Background Gradient */}
      <div className={`absolute inset-0 ${bgGradient} opacity-30 pointer-events-none transition-opacity duration-500`}></div>

      {/* Noise Texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay bg-noise z-0"></div>

      {/* Gloss Effect */}
      <div className="absolute -inset-[100%] top-0 block h-[200%] w-[50%] -rotate-12 bg-gradient-to-r from-transparent to-white/5 opacity-0 group-hover:animate-shine pointer-events-none z-10" />

      {bgImage && (
        <div className="absolute inset-0 z-0 pointer-events-none">
           <img src={bgImage} className="w-full h-full object-cover opacity-20 grayscale group-hover:grayscale-0 group-hover:scale-105 group-hover:opacity-30 transition-all duration-700" alt="" aria-hidden="true" />
           <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/90 to-[#0A0A0A]/40" />
        </div>
      )}
      
      {(title || headerAction) && (
        <div className="relative z-20 flex justify-between items-center mb-3 px-1 pt-1">
          {title && (
            <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
              {title}
            </div>
          )}
          {headerAction}
        </div>
      )}
      
      <div className="relative z-10 h-full w-full">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[100px]">
             <Loader2 className="w-6 h-6 text-gray-700 animate-spin" />
          </div>
        ) : (
          children
        )}
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
        <span className="text-white font-bold">{Math.round(percentage)}%</span>
      </div>
      <div className="h-1.5 w-full bg-[#151515] rounded-full overflow-hidden border border-white/5">
        <div 
          className="h-full bg-gradient-to-r from-neon-blue to-uv-purple shadow-[0_0_10px_rgba(189,0,255,0.3)] relative transition-all duration-1000 ease-out" 
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_2px,rgba(255,255,255,0.3)_2px)] bg-[size:4px_100%] opacity-30"></div>
          {/* Pulse effect for active growth */}
          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

// --- Trend Sparkline ---

export const TrendSparkline = memo(({ data }: { data?: number[] }) => {
  const computedPoints = useMemo(() => {
    if (!data || !data.length) return '';
    const len = data.length;
    if (len < 2) return ''; 
    const max = Math.max(...data, 100);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    return data.map((d, i) => {
      const x = (i / (len - 1)) * 100;
      const y = 100 - ((d - min) / range) * 100;
      return `${x},${y}`;
    }).join(' ');
  }, [data]);

  if (!computedPoints) return null;

  return (
    <div className="h-full w-full opacity-60">
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparklineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,255,163,0.2)" />
            <stop offset="100%" stopColor="rgba(0,255,163,1)" />
          </linearGradient>
        </defs>
        <polyline
          points={computedPoints}
          fill="none"
          stroke="url(#sparklineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          filter="drop-shadow(0 0 4px rgba(0,255,163,0.3))"
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
import React, { memo, ReactNode, useMemo, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, HTMLAttributes, ElementType } from 'react';
import { Haptic } from '../../utils/haptics';
import { VpdZone } from '../../types';
import { ChevronRight, Loader2, ChevronDown } from 'lucide-react';
import { palette } from '../../theme/colors';

// --- NeonButton ---

export interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: ElementType;
  className?: string;
  children?: ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const NeonButton = memo(({ className = "", variant = 'primary', size = 'md', isLoading, icon: Icon, children, onClick, style, ...props }: NeonButtonProps) => {
  
  const styleVars = useMemo(() => {
    switch (variant) {
      case 'primary':
        return {
          '--nb-bg': palette.neonGreen,
          '--nb-text': palette.textDark,
          '--nb-border': palette.neonGreen,
          '--nb-shadow': `0 0 20px ${palette.neonGreen}4D`,
          '--nb-hover-bg': `${palette.neonGreen}E6`, // 90%
          '--nb-hover-shadow': `0 0 30px ${palette.neonGreen}80`,
        };
      case 'danger':
        return {
          '--nb-bg': `${palette.alertRed}1A`, // 10%
          '--nb-text': palette.alertRed,
          '--nb-border': `${palette.alertRed}4D`, // 30%
          '--nb-shadow': `0 0 15px ${palette.alertRed}1A`,
          '--nb-hover-bg': `${palette.alertRed}33`, // 20%
          '--nb-hover-shadow': `0 0 20px ${palette.alertRed}33`,
        };
      case 'outline':
        return {
          '--nb-bg': 'transparent',
          '--nb-text': palette.neonGreen,
          '--nb-border': `${palette.neonGreen}80`, // 50%
          '--nb-shadow': 'none',
          '--nb-hover-bg': `${palette.neonGreen}1A`, // 10%
          '--nb-hover-shadow': 'none',
        };
      case 'ghost':
        return {
          '--nb-bg': 'transparent',
          '--nb-text': palette.textMuted,
          '--nb-border': 'transparent',
          '--nb-shadow': 'none',
          '--nb-hover-bg': 'rgba(255,255,255,0.05)',
          '--nb-hover-shadow': 'none',
          '--nb-hover-text': palette.text,
        };
      case 'secondary':
      default:
        return {
          '--nb-bg': palette.surfaceHighlight, // #1A1A1A
          '--nb-text': palette.text,
          '--nb-border': palette.border,
          '--nb-shadow': 'none',
          '--nb-hover-bg': palette.borderHighlight,
          '--nb-hover-shadow': 'none',
        };
    }
  }, [variant]);

  const baseStyles = "relative rounded-xl font-bold font-mono uppercase tracking-wide transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden group select-none";
  
  // Using arbitrary values to bind to the CSS variables defined in styleVars
  const dynamicStyles = `
    bg-[var(--nb-bg)] 
    text-[var(--nb-text)] 
    border border-[var(--nb-border)] 
    shadow-[var(--nb-shadow)] 
    hover:bg-[var(--nb-hover-bg)] 
    hover:shadow-[var(--nb-hover-shadow)]
    ${variant === 'ghost' ? 'hover:text-[var(--nb-hover-text)]' : ''}
  `;

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base"
  }[size];

  return (
    <button 
      className={`${baseStyles} ${dynamicStyles} ${sizeStyles} ${className}`}
      style={{ ...styleVars, ...style } as React.CSSProperties}
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

// --- NeonInput ---

export interface NeonInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ElementType;
  rightElement?: ReactNode;
  className?: string;
}

export const NeonInput = memo(({ label, icon: Icon, rightElement, className = "", ...props }: NeonInputProps) => (
  <div className="space-y-2">
    {label && (
      <label className="text-xs text-gray-500 uppercase font-mono tracking-wider flex items-center gap-2">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </label>
    )}
    <div className="relative">
      <input 
        className={`w-full rounded-xl px-4 py-3 text-white transition-all placeholder-gray-700 focus:outline-none focus:ring-1 ${className}`}
        style={{
            backgroundColor: palette.surfaceDark,
            borderColor: palette.border,
            borderWidth: '1px'
        }}
        // Tailwind classes for focus states that are harder to inline style without state
        // We use arbitrary values for specific palette overrides
        onFocus={(e) => {
            e.currentTarget.style.borderColor = palette.neonGreen;
            e.currentTarget.style.boxShadow = `0 0 0 1px ${palette.neonGreen}80`;
        }}
        onBlur={(e) => {
            e.currentTarget.style.borderColor = palette.border;
            e.currentTarget.style.boxShadow = 'none';
        }}
        {...props}
      />
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
           {rightElement}
        </div>
      )}
    </div>
  </div>
));
NeonInput.displayName = 'NeonInput';

// --- NeonSelect ---

export interface NeonSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  icon?: ElementType;
  options: { value: string | number; label: string }[];
  className?: string;
}

export const NeonSelect = memo(({ label, icon: Icon, options, className = "", ...props }: NeonSelectProps) => (
  <div className="space-y-2">
    {label && (
      <label className="text-xs text-gray-500 uppercase font-mono tracking-wider flex items-center gap-2">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </label>
    )}
    <div className="relative">
       <select
          className={`w-full rounded-xl pl-4 pr-10 py-3 text-white transition-all appearance-none focus:outline-none ${className}`}
          style={{
            backgroundColor: palette.surfaceDark,
            borderColor: palette.border,
            borderWidth: '1px'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = palette.neonGreen;
            e.currentTarget.style.boxShadow = `0 0 0 1px ${palette.neonGreen}80`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = palette.border;
            e.currentTarget.style.boxShadow = 'none';
          }}
          {...props}
       >
          {options.map(opt => (
             <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
       </select>
       <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
    </div>
  </div>
));
NeonSelect.displayName = 'NeonSelect';

// --- StatusBadge ---

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const StatusBadge = memo(({ status, size = 'md', pulse = false }: StatusBadgeProps) => {
  const s = status.toUpperCase();
  
  // Default Fallback
  let bg = '#1f2937'; // gray-800
  let text = '#9ca3af'; // gray-400
  let border = '#374151'; // gray-700
  let shadow = 'none';

  if (['OPTIMAL', 'NOMINAL', 'CONNECTED', 'ACTIVE'].some(k => s.includes(k))) {
    bg = `${palette.neonGreen}1A`;
    text = palette.neonGreen;
    border = `${palette.neonGreen}33`;
    shadow = `0 0 8px ${palette.neonGreen}1A`;
  } else if (['CRITICAL', 'DANGER', 'OFFLINE', 'HIGH', 'SEVERE'].some(k => s.includes(k))) {
    bg = `${palette.alertRed}1A`;
    text = palette.alertRed;
    border = `${palette.alertRed}33`;
    shadow = `0 0 8px ${palette.alertRed}1A`;
  } else if (['WARNING', 'ATTENTION', 'LEECHING', 'MEDIUM'].some(k => s.includes(k))) {
    bg = `${palette.warningYellow}1A`;
    text = palette.warningYellow;
    border = `${palette.warningYellow}33`;
  } else if (s.includes('VEG') || s.includes('VEGETATIVE')) {
     bg = `${palette.neonGreen}0D`;
     text = palette.neonGreen;
     border = `${palette.neonGreen}33`;
  } else if (s.includes('FLOWER')) {
    bg = `${palette.neonBlue}1A`;
    text = palette.neonBlue;
    border = `${palette.neonBlue}33`;
  } else if (s.includes('CLONE')) {
    bg = `${palette.text}1A`;
    text = palette.text;
    border = `${palette.text}33`;
  } else if (s.includes('DRYING')) {
     bg = `${palette.warningYellow}0D`;
     text = palette.warningYellow;
     border = `${palette.warningYellow}33`;
  } else if (s.includes('CURING')) {
     bg = `${palette.uvPurple}1A`;
     text = palette.uvPurple;
     border = `${palette.uvPurple}33`;
  }

  const sizeClasses = size === 'sm' ? "text-[9px] px-2 py-0.5" : "text-[10px] px-3 py-1";

  return (
    <span 
        className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-bold uppercase tracking-wide select-none ${sizeClasses}`}
        style={{ backgroundColor: bg, color: text, borderColor: border, boxShadow: shadow }}
    >
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
  
  let barColor: string = palette.neonGreen;
  let glowColor = `0 0 15px ${palette.neonGreen}66`;
  let textColor: string = palette.neonGreen;
  
  if (isDanger) {
    barColor = palette.alertRed;
    glowColor = `0 0 15px ${palette.alertRed}66`;
    textColor = palette.alertRed;
  } else if (isWarning) {
    barColor = palette.warningYellow;
    glowColor = `0 0 15px ${palette.warningYellow}66`;
    textColor = palette.warningYellow;
  }

  const fillHeight = isDanger ? '90%' : isWarning ? '80%' : '65%';

  return (
    <div className="relative flex flex-col justify-between h-full p-4 bg-[#0A0A0A] rounded-[20px] border border-white/5 overflow-hidden group hover:border-white/10 transition-colors">
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 pointer-events-none"></div>

      <div className="flex justify-between items-start z-10 relative">
         <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
               <Icon className="w-3 h-3 text-gray-600" aria-hidden="true" />
               {label}
            </span>
            <div className="text-2xl font-bold tracking-tighter font-mono drop-shadow-sm" style={{ color: textColor }}>{value}</div>
         </div>
         
         <div className="w-2 h-10 bg-[#151515] rounded-full overflow-hidden border border-white/5 relative">
             <div 
                className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-in-out" 
                style={{ height: fillHeight, backgroundColor: barColor, boxShadow: glowColor }}
             >
                <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-50 shadow-[0_0_8px_white]"></div>
             </div>
             <div className="absolute inset-0 bg-[linear-gradient(transparent_2px,#000_1px)] bg-[size:100%_3px] opacity-30"></div>
         </div>
      </div>
      
      <div className="z-10 mt-auto pt-2 flex items-center justify-between">
         <span className="text-[10px] font-mono text-gray-600 uppercase font-bold">{unit}</span>
         {trend && (
           <span className="text-[9px] font-mono flex items-center gap-0.5" style={{ color: trend === 'up' ? palette.neonGreen : trend === 'down' ? palette.alertRed : palette.textMuted }}>
             {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '−'} 
             <span className="opacity-80 tracking-tight">{trend.toUpperCase()}</span>
           </span>
         )}
      </div>
    </div>
  );
});
MetricGauge.displayName = 'MetricGauge';

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
            <stop offset="0%" stopColor={`${palette.neonGreen}33`} />
            <stop offset="100%" stopColor={palette.neonGreen} />
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
          filter={`drop-shadow(0 0 4px ${palette.neonGreen}4D)`}
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
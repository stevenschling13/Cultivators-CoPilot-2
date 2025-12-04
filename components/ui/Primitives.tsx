
import React, { memo, ReactNode, useMemo, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, ElementType } from 'react';
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
      case 'primary': return { '--nb-bg': palette.neonGreen, '--nb-text': palette.textDark, '--nb-border': palette.neonGreen, '--nb-shadow': `0 0 20px ${palette.neonGreen}4D`, '--nb-hover-bg': `${palette.neonGreen}E6`, '--nb-hover-shadow': `0 0 30px ${palette.neonGreen}80` };
      case 'danger': return { '--nb-bg': `${palette.alertRed}1A`, '--nb-text': palette.alertRed, '--nb-border': `${palette.alertRed}4D`, '--nb-shadow': `0 0 15px ${palette.alertRed}1A`, '--nb-hover-bg': `${palette.alertRed}33`, '--nb-hover-shadow': `0 0 20px ${palette.alertRed}33` };
      case 'outline': return { '--nb-bg': 'transparent', '--nb-text': palette.neonGreen, '--nb-border': `${palette.neonGreen}80`, '--nb-shadow': 'none', '--nb-hover-bg': `${palette.neonGreen}1A`, '--nb-hover-shadow': 'none' };
      case 'ghost': return { '--nb-bg': 'transparent', '--nb-text': palette.textMuted, '--nb-border': 'transparent', '--nb-shadow': 'none', '--nb-hover-bg': 'rgba(255,255,255,0.05)', '--nb-hover-shadow': 'none', '--nb-hover-text': palette.text };
      default: return { '--nb-bg': palette.surfaceHighlight, '--nb-text': palette.text, '--nb-border': palette.border, '--nb-shadow': 'none', '--nb-hover-bg': palette.borderHighlight, '--nb-hover-shadow': 'none' };
    }
  }, [variant]);

  return (
    <button 
      className={`relative rounded-xl font-bold font-mono uppercase tracking-wide transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden group select-none 
        bg-[var(--nb-bg)] text-[var(--nb-text)] border border-[var(--nb-border)] shadow-[var(--nb-shadow)] hover:bg-[var(--nb-hover-bg)] hover:shadow-[var(--nb-hover-shadow)]
        ${size === 'sm' ? "px-3 py-1.5 text-xs" : size === 'lg' ? "px-8 py-4 text-base" : "px-6 py-3 text-sm"} ${className}`}
      style={{ ...styleVars, ...style } as React.CSSProperties}
      onClick={(e) => { if (onClick && !isLoading) { Haptic.tap(); onClick(e); } }}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{Icon && <Icon className="w-4 h-4" />}{children}</>}
      {variant === 'primary' && !isLoading && <div className="absolute inset-0 -translate-x-full group-hover:animate-shine bg-gradient-to-r from-transparent via-white/30 to-transparent z-10 pointer-events-none" />}
    </button>
  );
});
NeonButton.displayName = 'NeonButton';

export const NeonInput = memo((props: any) => (
  <div className="space-y-2">
    {props.label && <label className="text-xs text-gray-500 uppercase font-mono tracking-wider flex items-center gap-2">{props.icon && <props.icon className="w-3 h-3" />} {props.label}</label>}
    <div className="relative">
      <input 
        className={`w-full rounded-xl px-4 py-3 text-white transition-all placeholder-gray-700 focus:outline-none focus:ring-1 focus:border-neon-green focus:shadow-[0_0_0_1px_rgba(0,255,163,0.5)] bg-[#050505] border-white/10 border ${props.className}`}
        {...props}
      />
      {props.rightElement && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">{props.rightElement}</div>}
    </div>
  </div>
));
NeonInput.displayName = 'NeonInput';

export const NeonSelect = memo(({ options, ...props }: any) => (
  <div className="space-y-2">
    {props.label && <label className="text-xs text-gray-500 uppercase font-mono tracking-wider flex items-center gap-2">{props.icon && <props.icon className="w-3 h-3" />} {props.label}</label>}
    <div className="relative">
       <select className={`w-full rounded-xl pl-4 pr-10 py-3 text-white transition-all appearance-none focus:outline-none bg-[#050505] border-white/10 border focus:border-neon-green focus:shadow-[0_0_0_1px_rgba(0,255,163,0.5)] ${props.className}`} {...props}>
          {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
       </select>
       <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
    </div>
  </div>
));
NeonSelect.displayName = 'NeonSelect';

export const StatusBadge = memo(({ status, size = 'md', pulse = false }: { status: string, size?: 'sm'|'md', pulse?: boolean }) => {
  const s = status.toUpperCase();
  const style = useMemo(() => {
      if (['OPTIMAL', 'NOMINAL', 'CONNECTED', 'ACTIVE'].some(k => s.includes(k))) return { bg: `${palette.neonGreen}1A`, text: palette.neonGreen, border: `${palette.neonGreen}33` };
      if (['CRITICAL', 'DANGER', 'OFFLINE'].some(k => s.includes(k))) return { bg: `${palette.alertRed}1A`, text: palette.alertRed, border: `${palette.alertRed}33` };
      if (['WARNING', 'ATTENTION'].some(k => s.includes(k))) return { bg: `${palette.warningYellow}1A`, text: palette.warningYellow, border: `${palette.warningYellow}33` };
      if (s.includes('FLOWER')) return { bg: `${palette.neonBlue}1A`, text: palette.neonBlue, border: `${palette.neonBlue}33` };
      return { bg: '#1f2937', text: '#9ca3af', border: '#374151' };
  }, [s]);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-bold uppercase tracking-wide select-none ${size === 'sm' ? "text-[9px] px-2 py-0.5" : "text-[10px] px-3 py-1"}`}
        style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}>
      {pulse && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span></span>}
      {status}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// --- Trend Sparkline (Optimized) ---
export const TrendSparkline = memo(({ data }: { data?: number[] }) => {
  // 1. Memoize the points calculation string. Only recalc when data prop changes ref/value.
  const points = useMemo(() => {
    if (!data || data.length < 2) return '';
    
    const max = Math.max(...data, 100);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    
    // Use fixed precision to reduce string size and DOM churn
    return data.map((d, i) => {
      const x = ((i / (data.length - 1)) * 100).toFixed(1);
      const y = (100 - ((d - min) / range) * 100).toFixed(1);
      return `${x},${y}`;
    }).join(' ');
  }, [data]);

  if (!points) return null;

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
          points={points}
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

export const SkeletonCard = memo(() => (
  <div className="bg-[#121212] rounded-[32px] h-64 w-full border border-white/5 overflow-hidden relative">
    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
    <div className="absolute bottom-6 left-6 right-6 space-y-3">
      <div className="h-3 bg-white/5 rounded w-1/3 animate-pulse" />
      <div className="h-8 bg-white/5 rounded w-2/3 animate-pulse" />
    </div>
  </div>
));
SkeletonCard.displayName = 'SkeletonCard';

export const StageProgressBar = memo(({ current, total, label }: { current: number, total: number, label: string }) => {
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
          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
});
StageProgressBar.displayName = 'StageProgressBar';

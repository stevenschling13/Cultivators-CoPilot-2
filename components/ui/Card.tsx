import React, { ReactNode, memo, forwardRef } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import { Haptic } from '../../utils/haptics';

export type CardAccent = 'neon-green' | 'neon-blue' | 'alert-red' | 'uv-purple' | 'yellow-500' | 'white' | 'gray';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children?: ReactNode;
  title?: ReactNode;
  subtitle?: string;
  active?: boolean;
  accent?: CardAccent;
  bgImage?: string;
  action?: ReactNode;
  isLoading?: boolean;
  noPadding?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export const Card = memo(forwardRef<HTMLDivElement, CardProps>(({ 
  children, 
  className = "", 
  title, 
  subtitle,
  onClick, 
  active = false, 
  accent = "neon-green", 
  bgImage, 
  action, 
  isLoading, 
  noPadding = false,
  disabled = false,
  ...props 
}, ref) => {
  
  // Mapping accents to Tailwind classes for Borders and Text
  const accentMap: Record<CardAccent, { border: string, glow: string, text: string, shadow: string }> = {
    'neon-green': { border: 'border-neon-green', glow: 'from-neon-green/10', text: 'text-neon-green', shadow: 'shadow-[0_0_20px_rgba(0,255,163,0.15)]' },
    'neon-blue': { border: 'border-neon-blue', glow: 'from-neon-blue/10', text: 'text-neon-blue', shadow: 'shadow-[0_0_20px_rgba(0,212,255,0.15)]' },
    'alert-red': { border: 'border-alert-red', glow: 'from-alert-red/10', text: 'text-alert-red', shadow: 'shadow-[0_0_20px_rgba(255,0,85,0.15)]' },
    'uv-purple': { border: 'border-uv-purple', glow: 'from-uv-purple/10', text: 'text-uv-purple', shadow: 'shadow-[0_0_20px_rgba(189,0,255,0.15)]' },
    'yellow-500': { border: 'border-yellow-500', glow: 'from-yellow-500/10', text: 'text-yellow-500', shadow: 'shadow-[0_0_20px_rgba(234,179,8,0.15)]' },
    'white': { border: 'border-white', glow: 'from-white/10', text: 'text-white', shadow: 'shadow-[0_0_20px_rgba(255,255,255,0.1)]' },
    'gray': { border: 'border-gray-500', glow: 'from-gray-500/10', text: 'text-gray-500', shadow: '' },
  };

  const styles = accentMap[accent] || accentMap['neon-green'];
  
  const borderColor = active ? styles.border : 'border-white/5';
  const shadow = active ? styles.shadow : '';
  const bgGradient = active 
    ? `bg-gradient-to-br ${styles.glow} to-transparent`
    : 'bg-gradient-to-br from-white/5 to-transparent';

  const handleClick = () => {
    if (onClick && !isLoading && !disabled) {
      Haptic.tap();
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && !isLoading && !disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      Haptic.tap();
      onClick();
    }
  };

  return (
    <div 
      ref={ref}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : "region"}
      aria-disabled={disabled}
      tabIndex={onClick && !disabled ? 0 : undefined}
      className={`
        relative overflow-hidden rounded-[24px] border bg-[#0A0A0A] transition-all duration-300 group
        ${borderColor} ${shadow}
        ${onClick && !disabled ? 'active:scale-[0.98] cursor-pointer hover:border-white/10 hover:bg-[#111] focus:outline-none focus:ring-2 focus:ring-neon-green/50' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
        ${className}
      `}
      {...props}
    >
      {/* 1. Active State Background Gradient */}
      <div className={`absolute inset-0 ${bgGradient} opacity-30 pointer-events-none transition-opacity duration-500`} />

      {/* 2. Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-noise z-0" />

      {/* 3. Gloss/Shine Animation */}
      {!disabled && (
        <div className="absolute -inset-[100%] top-0 block h-[200%] w-[50%] -rotate-12 bg-gradient-to-r from-transparent to-white/5 opacity-0 group-hover:animate-shine pointer-events-none z-10" />
      )}

      {/* 4. Background Image (Optional) */}
      {bgImage && (
        <div className="absolute inset-0 z-0 pointer-events-none">
           <img 
              src={bgImage} 
              className="w-full h-full object-cover opacity-20 grayscale group-hover:grayscale-0 group-hover:scale-105 group-hover:opacity-40 transition-all duration-700 ease-out" 
              alt="" 
              aria-hidden="true" 
            />
           {/* Gradient fade for text readability */}
           <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-[#0A0A0A]/30" />
        </div>
      )}
      
      {/* 5. Header Section */}
      {(title || action || subtitle) && (
        <div className="relative z-20 flex justify-between items-start mb-2 px-5 pt-5">
          <div className="flex flex-col gap-0.5 min-w-0">
             {title && (
                <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2 group-hover:text-gray-300 transition-colors">
                  {title}
                </div>
             )}
             {subtitle && (
                <div className={`text-sm font-bold truncate leading-tight ${active ? 'text-white' : 'text-gray-300'}`}>
                  {subtitle}
                </div>
             )}
          </div>
          {action && (
            <div className="pl-2 shrink-0">
              {action}
            </div>
          )}
        </div>
      )}
      
      {/* 6. Content Body */}
      <div className={`relative z-10 h-full w-full ${noPadding ? '' : 'p-5 pt-2'}`}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
             <Loader2 className={`w-6 h-6 animate-spin ${styles.text}`} />
             <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Loading Data...</span>
          </div>
        ) : (
          children
        )}
      </div>

      {/* 7. Hover Chevron (Only if clickable and no custom action) */}
      {onClick && !action && !isLoading && !disabled && (
        <div className="absolute top-5 right-5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-2 group-hover:translate-x-0 pointer-events-none">
            <ChevronRight className="w-4 h-4 text-gray-600" />
        </div>
      )}
    </div>
  );
}));

Card.displayName = 'Card';

/* 
   USAGE EXAMPLE:
   
   <Card 
     title="ACTIVE BATCH" 
     subtitle="Blue Pheno (Day 45)"
     bgImage="/images/grow_room.jpg"
     accent="neon-blue"
     active={true}
     onClick={() => console.log('Card tapped')}
     className="h-48"
   >
     <div className="text-gray-400 text-xs">
       Additional content or charts go here...
     </div>
   </Card>
*/
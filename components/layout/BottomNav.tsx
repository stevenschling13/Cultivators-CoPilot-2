
import React, { memo } from 'react';
import { LayoutDashboard, FlaskConical, ScanEye, MessageCircle, Settings } from 'lucide-react';
import { Haptic } from '../../utils/haptics';

export type ViewType = 'dashboard' | 'camera' | 'settings' | 'chat' | 'research';

interface BottomNavProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}

export const BottomNav = memo(({ currentView, onNavigate }: BottomNavProps) => {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dash' },
    { id: 'research', icon: FlaskConical, label: 'Lab' },
    { id: 'camera', icon: ScanEye, label: 'Scan', main: true },
    { id: 'chat', icon: MessageCircle, label: 'Ask' },
    { id: 'settings', icon: Settings, label: 'Sys' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-[#050505]/90 backdrop-blur-2xl border-t border-white/5 flex justify-around items-start pt-4 px-2 pb-safe-bottom z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      {/* Navigation Reflection Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-20 pointer-events-none"></div>
      
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => { Haptic.tap(); onNavigate(item.id as ViewType); }}
          className={`
            relative flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all duration-300 group z-10
            ${currentView === item.id ? 'text-neon-green' : 'text-gray-500 hover:text-gray-300'}
            ${item.main ? '-mt-8' : ''}
          `}
        >
          {item.main ? (
             <div className={`w-16 h-16 rounded-full flex items-center justify-center bg-[#111] border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.8)] transition-all duration-300 ${currentView === item.id ? 'border-neon-green shadow-[0_0_20px_rgba(0,255,163,0.3)] scale-110' : 'group-hover:border-white/30'}`}>
                 <item.icon className={`w-7 h-7 ${currentView === item.id ? 'text-neon-green' : 'text-white'}`} />
             </div>
          ) : (
             <>
                 <item.icon className={`w-6 h-6 transition-transform duration-300 ${currentView === item.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(0,255,163,0.6)]' : ''}`} />
                 <span className={`text-[9px] font-mono mt-1 uppercase tracking-wider transition-opacity duration-300 ${currentView === item.id ? 'opacity-100 font-bold' : 'opacity-60'}`}>{item.label}</span>
                 {currentView === item.id && (
                    <div className="absolute -bottom-2 w-1 h-1 bg-neon-green rounded-full shadow-[0_0_5px_#00ffa3]" />
                 )}
             </>
          )}
        </button>
      ))}
    </div>
  );
});

BottomNav.displayName = 'BottomNav';

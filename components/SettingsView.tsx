
import React, { memo } from 'react';
import { Bell, BellOff, Wifi, Database, ThermometerSun, Sliders, Trash2, RotateCcw, Save, CloudCog } from 'lucide-react';
import { Haptic } from '../utils/haptics';
import { GrowSetup } from '../types';
import { hardwareService } from '../services/hardwareService';
import { Card } from './ui/Card';

interface SettingsViewProps {
  setup: GrowSetup;
  onUpdateSetup: (setup: GrowSetup) => void;
  onBack: () => void;
  onRestore: () => void;
  onSaveConfig: () => void;
}

export const SettingsView = memo(({ setup, onUpdateSetup, onBack, onRestore, onSaveConfig }: SettingsViewProps) => {
  const toggleNotifications = () => {
     Haptic.tap();
     const newState = !setup.vpdNotifications;
     onUpdateSetup({...setup, vpdNotifications: newState});
     hardwareService.setNotificationsEnabled(newState);
     if (newState) {
         hardwareService.requestNotificationPermission();
     }
  };

  const handleOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      onUpdateSetup({...setup, leafTempOffset: val});
  };

  const toggleIntegration = (key: 'acInfinity' | 'trolMaster') => {
      Haptic.tap();
      const current = setup.integrations || {};
      const newState = !current[key];
      onUpdateSetup({
          ...setup,
          integrations: {
              ...current,
              [key]: newState
          }
      });
  };

  return (
    <div className="p-4 sm:p-0 animate-slide-up pb-32 space-y-6">
       <div className="space-y-6">
          {/* Environment Physics */}
          <Card title="Environment Physics" className="!bg-[#0A0A0A]">
             <div className="space-y-6">
                <div>
                   <div className="flex justify-between items-center mb-4">
                      <label className="text-xs text-gray-400 flex items-center gap-2 font-bold uppercase tracking-wider">
                          <ThermometerSun className="w-4 h-4 text-neon-blue" /> Leaf Surface Offset
                      </label>
                      <span className="text-sm font-mono font-bold text-neon-blue bg-neon-blue/10 px-2 py-1 rounded border border-neon-blue/20">
                          {setup.leafTempOffset > 0 ? '+' : ''}{setup.leafTempOffset}°F
                      </span>
                   </div>
                   
                   <div className="relative h-12 flex items-center">
                       {/* Custom Range Slider Track */}
                       <div className="absolute left-0 right-0 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                           <div className="h-full bg-gradient-to-r from-neon-blue/20 to-neon-blue/80" style={{ width: `${((setup.leafTempOffset + 5) / 7) * 100}%` }}></div>
                       </div>
                       <input 
                          type="range" 
                          min="-5" max="2" step="1"
                          value={setup.leafTempOffset || -2}
                          onChange={handleOffsetChange}
                          className="w-full absolute z-10 opacity-0 cursor-pointer h-10"
                       />
                       {/* Thumb Indicator Visual */}
                       <div 
                          className="absolute w-6 h-6 bg-white rounded-full shadow-[0_0_10px_rgba(0,212,255,0.5)] border-2 border-neon-blue pointer-events-none transition-all"
                          style={{ left: `calc(${((setup.leafTempOffset + 5) / 7) * 100}% - 12px)` }}
                       ></div>
                   </div>

                   <div className="flex justify-between text-[9px] text-gray-600 font-mono mt-1 px-1">
                      <span>-5° (LED)</span>
                      <span>0° (Ambient)</span>
                      <span>+2° (HPS)</span>
                   </div>
                   <p className="text-[10px] text-gray-500 mt-3 leading-relaxed border-t border-white/5 pt-2">
                      Adjusts VPD calculation based on leaf temperature delta. LEDs typically run cooler (-2°F), HPS hotter.
                   </p>
                </div>
                
                <div>
                   <label className="block text-xs text-gray-400 mb-2 font-bold uppercase tracking-wider">Target VPD Range (kPa)</label>
                   <div className="relative">
                       <Sliders className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                       <input 
                          type="text" 
                          value={setup.targetVpd} 
                          onChange={(e) => onUpdateSetup({...setup, targetVpd: e.target.value})}
                          className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-neon-green focus:outline-none font-mono text-white transition-colors"
                       />
                   </div>
                </div>
             </div>
          </Card>
          
          {/* Cloud Integrations (NEW) */}
          <Card title="Cloud Integrations" className="!bg-[#0A0A0A]">
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-white/5">
                             <CloudCog className="w-5 h-5 text-gray-400" />
                          </div>
                          <div>
                              <div className="text-sm font-bold text-white">AC Infinity</div>
                              <div className="text-[10px] text-gray-500">Controller 69 Pro (WiFi)</div>
                          </div>
                      </div>
                      <button 
                        onClick={() => toggleIntegration('acInfinity')}
                        className={`px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase transition-all ${setup.integrations?.acInfinity ? 'bg-neon-green/10 border-neon-green text-neon-green' : 'bg-transparent border-white/10 text-gray-500'}`}
                      >
                         {setup.integrations?.acInfinity ? 'Connected' : 'Connect'}
                      </button>
                  </div>
              </div>
          </Card>

          {/* Permissions & Hardware */}
          <Card title="Permissions & Hardware" className="!bg-[#0A0A0A]">
              <div className="space-y-3">
                <div onClick={toggleNotifications} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 active:bg-white/10 transition-colors cursor-pointer group">
                   <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-lg transition-colors ${setup.vpdNotifications ? 'bg-neon-green/10 text-neon-green' : 'bg-gray-800 text-gray-500'}`}>
                           {setup.vpdNotifications ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                       </div>
                       <div>
                         <span className="text-sm font-bold text-white block group-hover:text-neon-green transition-colors">VPD Alerts</span>
                         <span className="text-[10px] text-gray-500 block">Push notifications for critical drift</span>
                       </div>
                   </div>
                   <div className={`w-10 h-6 rounded-full transition-colors relative ${setup.vpdNotifications ? 'bg-neon-green' : 'bg-gray-700'}`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${setup.vpdNotifications ? 'translate-x-4' : 'translate-x-0'}`} />
                   </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 opacity-50 cursor-not-allowed">
                   <div className="flex items-center gap-3">
                       <div className="p-2 rounded-lg bg-neon-blue/10">
                           <Wifi className="w-5 h-5 text-neon-blue" />
                       </div>
                       <div>
                         <span className="text-sm font-bold text-white block">Hardware Scan</span>
                         <span className="text-[10px] text-gray-500 block">Auto-connect interval (Simulation)</span>
                       </div>
                   </div>
                   <span className="text-[9px] font-bold text-neon-blue uppercase bg-neon-blue/10 px-2 py-1 rounded border border-neon-blue/20">AUTO</span>
                </div>
              </div>
          </Card>

          {/* Data Management */}
          <Card title="Data Management" className="!bg-[#0A0A0A]">
             <div className="grid grid-cols-2 gap-3">
                 <button 
                    onClick={() => { Haptic.tap(); onRestore(); }}
                    className="py-4 bg-white/5 rounded-xl text-xs font-bold text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/10 transition-all flex flex-col items-center gap-2"
                 >
                    <RotateCcw className="w-5 h-5" />
                    Restore DB
                 </button>
                 <button 
                    onClick={() => { Haptic.tap(); onSaveConfig(); }}
                    className="py-4 bg-white text-black font-bold rounded-xl shadow-xl active:scale-95 transition-transform flex flex-col items-center gap-2"
                 >
                    <Save className="w-5 h-5" />
                    Save Config
                 </button>
             </div>
             
             <div className="mt-6 pt-6 border-t border-white/5">
                 <div className="flex items-center gap-2 mb-3">
                    <Trash2 className="w-4 h-4 text-alert-red" />
                    <span className="text-[10px] font-mono font-bold text-alert-red uppercase tracking-widest">Danger Zone</span>
                 </div>
                 <button 
                    onClick={async () => {
                        Haptic.tap();
                        if (confirm("Reset ALL data? This cannot be undone.")) {
                            await indexedDB.deleteDatabase('cultivator-db');
                            window.location.reload();
                        }
                    }}
                    className="w-full py-3 bg-alert-red/5 rounded-xl text-xs font-bold text-alert-red border border-alert-red/20 hover:bg-alert-red/10 transition-colors"
                 >
                    Factory Reset Device
                 </button>
             </div>
          </Card>
       </div>
    </div>
  );
}, (prev, next) => {
  // Ignore function prop changes which are unstable in App.tsx
  return prev.setup === next.setup;
});

SettingsView.displayName = 'SettingsView';

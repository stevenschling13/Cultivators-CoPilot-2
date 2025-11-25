


import React, { useState, useEffect } from 'react';
import { X, Save, Box, Activity, Thermometer, Wifi, Trash2, Sparkles } from 'lucide-react';
import { Room, GrowStage, SensorDevice, PlantBatch, EnvironmentalTargets } from '../../types';
import { STAGE_INFO } from '../../constants';
import { hardwareService } from '../../services/hardwareService';
import { geminiService } from '../../services/geminiService';
import { Haptic } from '../../utils/haptics';
import { generateUUID } from '../../utils/uuid';

interface RoomEditModalProps {
  room?: Room | null;
  batches?: PlantBatch[]; // Optional context for AI calibration
  onSave: (room: Room) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const RoomEditModal = ({ room, batches, onSave, onDelete, onClose }: RoomEditModalProps) => {
  const [name, setName] = useState(room?.name || '');
  const [stage, setStage] = useState<GrowStage>(room?.stage || GrowStage.VEG);
  const [stageDay, setStageDay] = useState(room?.stageDay || 1);
  const [selectedSensor, setSelectedSensor] = useState(room?.sensorId || '');
  const [availableDevices, setAvailableDevices] = useState<SensorDevice[]>([]);
  
  // AI Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [customTargets, setCustomTargets] = useState<EnvironmentalTargets | null>(null);

  useEffect(() => {
    // Load available sensors for binding
    const loadDevices = async () => {
      const devices = await hardwareService.scanForDevices();
      setAvailableDevices(devices);
    };
    loadDevices();
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;

    const newRoom: Room = {
      id: room?.id || generateUUID(),
      name,
      stage,
      stageDay,
      sensorId: selectedSensor,
      activeBatchId: room?.activeBatchId, // Preserve batch link if exists
      metrics: room?.metrics || {
        temp: 0,
        rh: 0,
        vpd: 0,
        co2: 400,
        lastUpdated: Date.now(),
        status: 'OFFLINE',
        history: []
      }
    };

    Haptic.success();
    onSave(newRoom);
  };

  const handleDelete = () => {
      if (room?.id && confirm('Delete this room? History will be lost.')) {
          Haptic.tap();
          onDelete(room.id);
      }
  };

  const handleAiCalibration = async () => {
      if (!room?.activeBatchId || !batches) return;
      
      const activeBatch = batches.find(b => b.id === room.activeBatchId);
      if (!activeBatch) return;

      setIsCalibrating(true);
      Haptic.tap();
      try {
          const targets = await geminiService.calibrateEnvironment(activeBatch.strain, stage, stageDay);
          setCustomTargets(targets);
          Haptic.success();
      } catch (e) {
          console.error(e);
          Haptic.error();
      } finally {
          setIsCalibrating(false);
      }
  };

  const currentStageDefaults = STAGE_INFO[stage] || STAGE_INFO['Vegetative'];

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#121212] rounded-3xl border border-white/10 overflow-hidden animate-slide-up shadow-2xl">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2">
             <Box className="w-5 h-5 text-neon-blue" />
             <h3 className="text-lg font-bold text-white">{room ? 'Configure Room' : 'Add New Room'}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Room Identity */}
          <div>
            <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 block">Room Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 4x4 Flower Tent"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-blue focus:outline-none focus:ring-1 focus:ring-neon-blue/50"
              autoFocus
            />
          </div>

          {/* Stage Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 block">Grow Stage</label>
               <select 
                  value={stage}
                  onChange={(e) => setStage(e.target.value as GrowStage)}
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:border-neon-blue focus:outline-none"
               >
                  {Object.values(GrowStage).map(s => (
                      <option key={s} value={s}>{s}</option>
                  ))}
               </select>
            </div>
            <div>
               <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 block">Current Day</label>
               <input
                  type="number"
                  value={stageDay}
                  onChange={(e) => setStageDay(parseInt(e.target.value) || 1)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-blue focus:outline-none"
               />
            </div>
          </div>

          {/* Target Preview */}
          <div className={`bg-white/5 rounded-xl p-3 border ${customTargets ? 'border-neon-green/30' : 'border-white/5'} transition-all`}>
              <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] text-gray-400 uppercase flex items-center gap-2">
                      <Activity className="w-3 h-3" /> Target Parameters
                  </div>
                  {room?.activeBatchId && (
                      <button 
                        onClick={handleAiCalibration}
                        disabled={isCalibrating}
                        className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 transition-all ${customTargets ? 'bg-neon-green/10 text-neon-green' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                      >
                         <Sparkles className={`w-3 h-3 ${isCalibrating ? 'animate-spin' : ''}`} />
                         {customTargets ? 'AI CALIBRATED' : 'AUTO-TUNE'}
                      </button>
                  )}
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div>
                      <span className="text-gray-500 block">Temp</span>
                      <span className="text-white font-bold">{customTargets ? customTargets.temp : currentStageDefaults.temp}</span>
                  </div>
                  <div>
                      <span className="text-gray-500 block">RH</span>
                      <span className="text-white font-bold">{customTargets ? customTargets.rh : currentStageDefaults.rh}</span>
                  </div>
                  <div>
                      <span className="text-gray-500 block">VPD</span>
                      <span className="text-neon-green font-bold">{customTargets ? customTargets.vpd : currentStageDefaults.vpd}</span>
                  </div>
              </div>
              {customTargets && (
                  <div className="mt-2 text-[9px] text-neon-green/80 italic border-t border-white/5 pt-1">
                      "{customTargets.reasoning}"
                  </div>
              )}
          </div>

          {/* Sensor Binding */}
          <div>
            <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 flex items-center gap-2">
                <Wifi className="w-3 h-3" /> Hardware Binding
            </label>
            <div className="space-y-2">
                {availableDevices.map(device => (
                    <div 
                        key={device.id}
                        onClick={() => setSelectedSensor(device.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all active:scale-98 ${selectedSensor === device.id ? 'bg-neon-blue/10 border-neon-blue' : 'bg-[#151515] border-white/5 hover:bg-white/5'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${device.isConnected ? 'bg-neon-green' : 'bg-gray-500'}`}></div>
                            <div>
                                <div className={`text-sm font-bold ${selectedSensor === device.id ? 'text-white' : 'text-gray-300'}`}>{device.name}</div>
                                <div className="text-[10px] text-gray-500 font-mono">{device.type} • {device.batteryLevel}% Bat</div>
                            </div>
                        </div>
                        {selectedSensor === device.id && <div className="w-3 h-3 rounded-full bg-neon-blue shadow-[0_0_8px_#00d4ff]"></div>}
                    </div>
                ))}
                {availableDevices.length === 0 && (
                    <div className="text-center p-4 text-gray-500 text-xs italic border border-dashed border-white/10 rounded-xl">
                        Scanning for devices...
                    </div>
                )}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            {room && (
                <button 
                    onClick={handleDelete}
                    className="p-4 rounded-xl bg-alert-red/10 text-alert-red hover:bg-alert-red/20 transition-colors"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            )}
            <button 
              onClick={handleSave}
              className="flex-1 py-4 bg-neon-blue text-black font-bold rounded-xl shadow-[0_0_20px_rgba(0,212,255,0.3)] active:scale-95 transition-transform"
            >
              {room ? 'Save Configuration' : 'Create Room'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

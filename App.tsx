import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, Scan, MessageCircle, LayoutDashboard, Droplet, Wind, Thermometer, Plus, Download, Upload, FlaskConical, Zap, CheckCircle2, AlertTriangle, Leaf, Activity, ArrowLeft, Sprout, Fan, ScanEye, RefreshCw, Clock } from 'lucide-react';
import { EnvironmentService } from './services/environmentService';
import { geminiService } from './services/geminiService';
import { dbService } from './services/db';
import { ImageUtils } from './services/imageUtils';
import { hardwareService } from './services/hardwareService';
import { BackupService } from './services/backupService';
import { errorService } from './services/errorService'; // New Import
import type { EnvironmentReading, GrowLog, PlantBatch, AiDiagnosis, GrowSetup, Room, FacilityBriefing, ArPreferences, LogProposal, GrowStage } from './types';
import { VpdZone } from './types';
import { MOCK_BATCHES, DEFAULT_GROW_SETUP, MOCK_ROOMS, FLIP_DATE } from './constants';
import { SystemErrorBoundary } from './components/SystemErrorBoundary';
import { ToastContainer, ToastMsg } from './components/ui/Toast';
import { ProcessingOverlay } from './components/ui/ProcessingOverlay';
import { MetricGauge, BentoCard } from './components/ui/Primitives';
import { RoomTile } from './components/ui/RoomTile';
import { CameraView } from './components/CameraView';
import { BatchDetailModal } from './components/modals/BatchDetailModal';
import { AnalysisResultModal } from './components/modals/AnalysisResultModal';
import { LegacyImportModal } from './components/modals/LegacyImportModal';
import { BackupModal } from './components/modals/BackupModal';
import { ChatInterface } from './components/ChatInterface';
import { ResearchView } from './components/ResearchView';
import { Haptic } from './utils/haptics';

// Map physical sensor IDs to logical Room IDs
const SENSOR_MAP: Record<string, string> = {
  'gov-h5075-88a1': 'tent-blue',  // Garage
  'sp-ht1-b2': 'tent-green'       // Tent
};

export const App = () => {
  const [view, setView] = useState<'dashboard' | 'camera' | 'settings' | 'chat' | 'research'>('dashboard');
  const [cameraMode, setCameraMode] = useState<'default' | 'ar'>('default');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [batches, setBatches] = useState<PlantBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<PlantBatch | null>(null);
  const [logs, setLogs] = useState<GrowLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [envReading, setEnvReading] = useState<EnvironmentReading | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [settings, setSettings] = useState<GrowSetup>(DEFAULT_GROW_SETUP);
  const [briefing, setBriefing] = useState<FacilityBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [backupModalMode, setBackupModalMode] = useState<'backup' | 'restore' | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<{ diagnosis: AiDiagnosis; image: string; thumbnail: string } | null>(null);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  /**
   * Initializes room structure.
   * Only called on mount to set up the skeleton. Live updates handle the rest.
   */
  const initializeRooms = useCallback((currentBatches: PlantBatch[]): Room[] => {
      return MOCK_ROOMS.map(templateRoom => {
          const batch = currentBatches.find(b => b.id === templateRoom.activeBatchId);
          let dynamicStageDay = 0;
          
          if (batch) {
             const startDate = batch.currentStage === 'Flowering' ? new Date(FLIP_DATE).getTime() : batch.startDate;
             dynamicStageDay = Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24));
          }

          return {
              ...templateRoom,
              name: batch ? `${batch.strain} (${templateRoom.name.split('(')[1] || templateRoom.name})` : templateRoom.name,
              stageDay: dynamicStageDay,
              stage: (batch?.currentStage as GrowStage) || templateRoom.stage,
          };
      });
  }, []);

  /**
   * Update stage timers (Day X) without clobbering sensor data.
   * Runs on an interval to ensure "Day 53" rolls over to "Day 54" automatically.
   */
  const updateStageTimers = useCallback(() => {
    setRooms(currentRooms => {
      let hasChanges = false;
      const updated = currentRooms.map(room => {
          const batch = batches.find(b => b.id === room.activeBatchId);
          if (!batch) return room;
          
          const startDate = batch.currentStage === 'Flowering' ? new Date(FLIP_DATE).getTime() : batch.startDate;
          const newStageDay = Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24));
          
          if (newStageDay !== room.stageDay) {
             hasChanges = true;
             return { ...room, stageDay: newStageDay };
          }
          return room;
      });
      return hasChanges ? updated : currentRooms;
    });
  }, [batches]);

  const refreshBriefing = async (currentRooms: Room[], currentLogs: GrowLog[]) => {
      setBriefingLoading(true);
      errorService.addBreadcrumb('api', 'Refreshing Facility Briefing');
      try {
          const briefingData = await geminiService.generateFacilityBriefing(currentRooms, currentLogs);
          setBriefing(briefingData);
          addToast("Briefing Updated", "success");
      } catch (e) {
          console.error("Briefing failed", e);
          errorService.captureError(e as Error, { severity: 'MEDIUM', metadata: { context: 'refreshBriefing' } });
          addToast("Briefing Update Failed", "error");
      } finally {
          setBriefingLoading(false);
      }
  };

  const handleUpdateArPreferences = useCallback(async (prefs: ArPreferences) => {
    const newSettings = { ...settings, arPreferences: prefs };
    setSettings(newSettings);
    await dbService.saveSettings(newSettings);
  }, [settings]);

  // --- INITIALIZATION EFFECT ---
  useEffect(() => {
    // 1. Initialize Error Monitoring System
    errorService.init(addToast);

    const load = async () => {
      try {
        errorService.addBreadcrumb('system', 'Loading Core Data');
        const [b, l, s] = await Promise.all([
          dbService.getBatches(),
          dbService.getLogs(),
          dbService.getSettings()
        ]);
        setBatches(b.length > 0 ? b : MOCK_BATCHES);
        setLogs([...l].sort((a, b) => b.timestamp - a.timestamp));
        setSettings(s);
        setRooms(MOCK_ROOMS);
        
        const activeBatches = b.length > 0 ? b : MOCK_BATCHES;
        setBatches(activeBatches);
        const sortedLogs = [...l].sort((a, b) => b.timestamp - a.timestamp);
        setLogs(sortedLogs);
        setSettings(s);
        
        const initialRooms = initializeRooms(activeBatches);
        setRooms(initialRooms);

        try {
          const briefingData = await geminiService.generateFacilityBriefing(initialRooms, sortedLogs);
          setBriefing(briefingData);
        } catch (e) { 
            console.log("Briefing skipped/failed", e); 
            // Low severity, silent fail is ok for initial briefing
            errorService.addBreadcrumb('api', 'Initial Briefing Skipped');
        }
      } catch (e) {
        console.error("Init failed", e);
        errorService.captureError(e as Error, { severity: 'CRITICAL', metadata: { context: 'App Init' } });
        addToast("Initialization Error", 'error');
      } finally { setLoading(false); }
    };
    load();

    // Start Hardware Scans
    hardwareService.scanForDevices().then(devices => {
       // Connect to all discovered devices to simulate full facility
       devices.forEach(d => hardwareService.connectToDevice(d.id));
    });
  }, [addToast, initializeRooms]);

  // --- HEARTBEAT EFFECT (Stage Timers) ---
  useEffect(() => {
     // Check for day rollover every minute
     const timer = setInterval(updateStageTimers, 60000);
     return () => clearInterval(timer);
  }, [updateStageTimers]);

  // --- VISIBILITY REFRESH EFFECT ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
         errorService.addBreadcrumb('system', 'App Foregrounded');
         // App came to foreground, ensure timers are fresh
         updateStageTimers();
         // Auto-refresh briefing if very stale (> 8 hours)
         if (briefing?.timestamp && (Date.now() - briefing.timestamp > 8 * 60 * 60 * 1000)) {
            refreshBriefing(rooms, logs);
         }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [briefing, rooms, logs, updateStageTimers]);

  // --- REAL-TIME SENSOR BINDING ---
  useEffect(() => {
    // Subscribe with deviceId support
    const unsub = hardwareService.onReading((deviceId, reading) => {
        // Update global "primary" reading for HUD if it matches first room
        if (deviceId === 'gov-h5075-88a1') { 
            setEnvReading(reading);
        }
        
        // Route sensor data to the specific room
        setRooms(prevRooms => {
            return prevRooms.map(room => {
                // Check if this sensor belongs to this room
                const mappedRoomId = SENSOR_MAP[deviceId];
                
                if (mappedRoomId === room.id) {
                    const metrics = EnvironmentService.processReading(reading);
                    return {
                        ...room,
                        metrics: {
                            ...room.metrics,
                            temp: reading.temperature,
                            rh: reading.humidity,
                            vpd: metrics.vpd,
                            co2: reading.co2,
                            lastUpdated: reading.timestamp,
                            status: metrics.vpdStatus === VpdZone.DANGER ? 'CRITICAL' : 'NOMINAL',
                            // Append to history (keep last 7 points for sparkline)
                            history: [...room.metrics.history.slice(-6), metrics.vpd]
                        }
                    };
                }
                return room;
            });
        });
    });
    return () => unsub();
  }, [addToast]);

  const metrics = useMemo(() => {
    return envReading ? EnvironmentService.processReading(envReading) : { vpd: 1.25, dli: 35, vpdStatus: VpdZone.TRANSPIRATION };
  }, [envReading]);

  const currentBatch = useMemo(() => selectedBatch || batches[0] || MOCK_BATCHES[0], [batches, selectedBatch]);
  
  // Calculate Briefing Freshness
  const isBriefingStale = useMemo(() => {
    if (!briefing?.timestamp) return false;
    return Date.now() - briefing.timestamp > 4 * 60 * 60 * 1000;
  }, [briefing]);

  const handleCapture = useCallback(async (file: File) => {
    try {
      setAnalyzing(true);
      errorService.addBreadcrumb('ui', 'Analyzing Capture', { size: file.size });
      // Process locally first
      const processed = await ImageUtils.processImage(file);
      
      // AI Analysis
      const diagnosis = await geminiService.analyzePlantImage(processed.full);
      
      setAnalysisData({
        diagnosis,
        image: processed.full,
        thumbnail: processed.thumbnail
      });
    } catch (e) {
      console.error(e);
      errorService.captureError(e as Error, { severity: 'HIGH', metadata: { context: 'ImageAnalysis' } });
      addToast((e as Error).message || "Analysis Failed", "error");
    } finally {
      setAnalyzing(false);
    }
  }, [addToast]);

  const handleSaveAnalysis = useCallback(async () => {
    if (!analysisData || !currentBatch) return;

    const newLog: GrowLog = {
        id: crypto.randomUUID(),
        plantBatchId: currentBatch.id,
        timestamp: Date.now(),
        imageUrl: analysisData.image,
        thumbnailUrl: analysisData.thumbnail,
        actionType: 'Observation',
        aiDiagnosis: analysisData.diagnosis,
        manualNotes: analysisData.diagnosis.morphologyNotes
    };

    await dbService.saveLog(newLog);
    setLogs(prev => [newLog, ...prev]);
    setAnalysisData(null);
    addToast("Diagnosis Saved", "success");
    Haptic.success();
  }, [addToast, analysisData, currentBatch]);

  const handleLogProposal = useCallback(async (proposal: Partial<GrowLog>) => {
    if (!currentBatch) return;

    const newLog: GrowLog = {
        id: crypto.randomUUID(),
        plantBatchId: currentBatch.id,
        timestamp: Date.now(),
        actionType: proposal.actionType || 'Observation',
        manualNotes: proposal.manualNotes || 'Added via Copilot',
        aiDiagnosis: proposal.aiDiagnosis
    };

    await dbService.saveLog(newLog);
    setLogs(prev => [newLog, ...prev]);
    addToast("Log Entry Created via AI", "success");
  }, [addToast, currentBatch]);

  const handleUpdateLog = useCallback(async (updatedLog: GrowLog) => {
    await dbService.saveLog(updatedLog);
    setLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
    addToast("Log Entry Updated", "success");
  }, [addToast]);

  const handleDeleteLog = useCallback(async (id: string) => {
    await dbService.deleteLog(id);
    setLogs(prev => prev.filter(l => l.id !== id));
    addToast("Log Entry Deleted", "info");
  }, [addToast]);

  const handleSimulate = useCallback(async (img: string) => {
    addToast("Initializing Veo Simulation...", "info");
    try {
        const videoUrl = await geminiService.generateGrowthSimulation(img);
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = "growth_sim_veo.mp4";
        a.click();
        addToast("Simulation Ready & Downloaded", "success");
    } catch (e) {
        addToast("Simulation Failed: " + (e as Error).message, "error");
    }
  }, [addToast]);

  const handleRoomClick = useCallback((room: Room) => {
     const batch = batches.find(b => b.id === room.activeBatchId) || batches[0];
     if (batch) {
        setSelectedBatch(batch);
     } else {
        addToast("No Active Batch in Room", "info");
     }
  }, [addToast, batches]);

  const handleBackup = useCallback(async (password: string) => {
    try {
      await BackupService.createEncryptedBackup(password);
      addToast("Backup Created & Downloaded", "success");
      return true;
    } catch (e) {
      console.error(e);
      addToast("Backup Failed", "error");
      return false;
    }
  }, [addToast]);

  const handleRestore = useCallback(async (password: string, file?: File) => {
    if (!file) return false;
    try {
       const success = await BackupService.restoreFromBackup(file, password);
       if (success) {
           addToast("System Restored. Rebooting...", "success");
           setTimeout(() => window.location.reload(), 2000);
           return true;
       } else {
           return false;
       }
    } catch (e) {
       console.error(e);
       return false;
    }
  }, [addToast]);

  const selectedBatchLogs = useMemo(() => selectedBatch ? logs.filter(l => l.plantBatchId === selectedBatch.id) : [], [logs, selectedBatch]);
  const saveLog = async () => {
    if (!analysisData) return;
    
    const newLog: GrowLog = {
      id: crypto.randomUUID(),
      plantBatchId: currentBatch.id,
      timestamp: Date.now(),
      actionType: 'Observation',
      aiDiagnosis: analysisData.diagnosis,
      imageUrl: analysisData.image,
      thumbnailUrl: analysisData.thumbnail,
      manualNotes: analysisData.diagnosis.morphologyNotes
    };

    await dbService.saveLog(newLog);
    setLogs(prev => [newLog, ...prev]);
    setAnalysisData(null);
    setView('dashboard');
    addToast("Log Saved", "success");
    errorService.addBreadcrumb('ui', 'Log Saved');
  };

  const deleteLog = async (id: string) => {
    await dbService.deleteLog(id);
    setLogs(prev => prev.filter(l => l.id !== id));
    addToast("Entry Deleted", "info");
  };

  const updateLog = async (updatedLog: GrowLog) => {
    await dbService.saveLog(updatedLog);
    setLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
    addToast("Entry Updated", "success");
  };

  const handleBackupRestore = async (password: string, file?: File) => {
      if (backupModalMode === 'backup') {
          await BackupService.createEncryptedBackup(password);
          return true;
      } else if (backupModalMode === 'restore' && file) {
          const success = await BackupService.restoreFromBackup(file, password);
          if (success) {
            // Reload data
            window.location.reload();
            return true;
          }
          return false;
      }
      return false;
  };
  
  const handleSimulateFuture = (img: string) => {
    // Switch to chat and simulate
    setAnalysisData(null);
    setView('chat');
    // Pre-seed chat state? (This requires more complex state lifting, for now user can just ask in chat)
    // Alternatively, expose a method on ChatInterface or pass initial prompt
    // For V3 MVP, we can just switch views. The advanced implementation would require ChatInterface to accept an 'initialAction'.
    addToast("Ask Gemini to 'Simulate future growth' in Chat", "info");
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-neon-green/30 selection:text-white overflow-x-hidden">
      <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
      <ProcessingOverlay isProcessing={analyzing} />

      {showImport && (
        <LegacyImportModal 
           onClose={() => setShowImport(false)}
           onImportComplete={() => {
              setShowImport(false);
              addToast("Import Completed Successfully", "success");
              dbService.getLogs().then(l => setLogs(l.sort((a, b) => b.timestamp - a.timestamp)));
           }}
        />
      )}
      
      {backupModalMode && (
         <BackupModal 
            mode={backupModalMode}
            onClose={() => setBackupModalMode(null)}
            onConfirm={(p, f) => {
                if (backupModalMode === 'backup') {
                    return handleBackup(p);
                } else {
                    return handleRestore(p, f);
                }
            }}
         />
      )}

      {selectedBatch && (
        <BatchDetailModal
           batch={selectedBatch}
           onClose={() => setSelectedBatch(null)}
           logs={selectedBatchLogs}
           onDeleteLog={handleDeleteLog}
           onUpdateLog={handleUpdateLog}
        />
      )}

      {view === 'camera' && (
         <CameraView 
           onCapture={handleCapture} 
           onCancel={() => setView('dashboard')} 
         />
      )}

      {/* --- DASHBOARD VIEW --- */}
      {view === 'dashboard' && (
        <div className="pb-32 animate-fade-in">
          {/* Header */}
          <div className="pt-safe-top px-6 pb-6 bg-gradient-to-b from-[#080808] to-transparent sticky top-0 z-20 backdrop-blur-xl border-b border-white/5">
             <div className="flex justify-between items-center mb-4">
                <div>
                   <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                      <Leaf className="w-6 h-6 text-neon-green" />
                      Command Center
                   </h1>
                   <p className="text-xs text-gray-400 font-mono mt-1">
                      {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                   </p>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => { Haptic.tap(); setBackupModalMode('backup'); }} className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-gray-400">
                      <Download className="w-5 h-5" />
                   </button>
                   <button onClick={() => { Haptic.tap(); setView('settings'); }} className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-gray-400">
                      <Settings className="w-5 h-5" />
                   </button>
                </div>
             </div>

             {/* Environment HUD */}
             <div className="bg-[#121212] rounded-[28px] p-1 border border-white/5 shadow-2xl relative overflow-hidden group">
                 <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none mix-blend-overlay"></div>
                 <div className="grid grid-cols-3 gap-px bg-white/5 p-px rounded-[24px] overflow-hidden">
                    <div className="bg-[#0A0A0A] p-4 flex flex-col items-center justify-center relative group/metric">
                       <Thermometer className="w-5 h-5 text-gray-500 mb-2 group-hover/metric:text-white transition-colors" />
                       <div className="text-2xl font-bold font-mono text-white tracking-tighter">{metrics.vpdStatus === VpdZone.DANGER ? <span className="text-alert-red animate-pulse">{envReading?.temperature.toFixed(0)}°</span> : <span>{envReading?.temperature.toFixed(0)}°</span>}</div>
                       <div className="text-[9px] text-gray-600 uppercase font-bold mt-1">Temp</div>
                    </div>
                    <div className="bg-[#0A0A0A] p-4 flex flex-col items-center justify-center relative group/metric">
                       <Droplet className="w-5 h-5 text-gray-500 mb-2 group-hover/metric:text-neon-blue transition-colors" />
                       <div className="text-2xl font-bold font-mono text-white tracking-tighter">{envReading?.humidity.toFixed(0)}<span className="text-sm align-top opacity-50">%</span></div>
                       <div className="text-[9px] text-gray-600 uppercase font-bold mt-1">Humidity</div>
                    </div>
                    <div className="bg-[#0A0A0A] p-4 flex flex-col items-center justify-center relative group/metric">
                       <Wind className={`w-5 h-5 mb-2 transition-colors ${metrics.vpdStatus === VpdZone.DANGER ? 'text-alert-red' : 'text-gray-500 group-hover/metric:text-neon-green'}`} />
                       <div className={`text-2xl font-bold font-mono tracking-tighter ${metrics.vpdStatus === VpdZone.DANGER ? 'text-alert-red' : 'text-neon-green'}`}>{metrics.vpd.toFixed(2)}</div>
                       <div className="text-[9px] text-gray-600 uppercase font-bold mt-1">VPD (kPa)</div>
                    </div>
                 </div>
             </div>
          </div>

          <div className="px-6 space-y-6">
             {/* Facility Briefing */}
             <BentoCard 
                className={`p-5 relative overflow-hidden !bg-[#0F0F0F] !border-l-4 ${briefing?.status === 'CRITICAL' ? '!border-l-alert-red' : briefing?.status === 'ATTENTION' ? '!border-l-yellow-500' : '!border-l-neon-green'}`}
                headerAction={
                    <div className="flex items-center gap-2">
                         {isBriefingStale && (
                             <span className="text-[9px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded font-mono border border-yellow-500/20">STALE DATA</span>
                         )}
                         <button 
                            onClick={(e) => { e.stopPropagation(); Haptic.tap(); refreshBriefing(rooms, logs); }}
                            className={`p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all ${briefingLoading ? 'animate-spin' : ''}`}
                         >
                            <RefreshCw className="w-3.5 h-3.5" />
                         </button>
                    </div>
                }
             >
                <div className="flex justify-between items-start mb-2">
                   <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${briefing?.status === 'CRITICAL' ? 'bg-alert-red animate-ping' : briefing?.status === 'ATTENTION' ? 'bg-yellow-500' : 'bg-neon-green'}`}></div>
                       <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-widest">Facility Briefing</h3>
                   </div>
                   {briefing?.timestamp && (
                       <div className="text-[9px] text-gray-600 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(briefing.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </div>
                   )}
                </div>
                {briefing ? (
                   <>
                      <p className="text-sm font-medium text-white leading-relaxed mb-3">{briefing.summary}</p>
                      <div className="space-y-2">
                         {briefing.actionItems.slice(0, 2).map((item, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-400 bg-black/20 p-2 rounded-lg border border-white/5">
                               <CheckCircle2 className="w-3.5 h-3.5 text-neon-green shrink-0 mt-0.5" />
                               {item}
                            </div>
                         ))}
                      </div>
                   </>
                ) : (
                    <div className="text-xs text-gray-500 italic py-2">Initializing AI Commander...</div>
                )}
             </BentoCard>

             {/* Room Tiles (Grid) */}
             <div>
                <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3 px-1">Active Environments</h3>
                <div className="grid grid-cols-2 gap-3">
                   {rooms.map(room => (
                      <RoomTile 
                         key={room.id} 
                         room={room} 
                         onClick={() => {
                            const batch = batches.find(b => b.id === room.activeBatchId);
                            if (batch) setSelectedBatch(batch);
                         }} 
                      />
                   ))}
                   {/* Add Room Button */}
                   <button className="aspect-square rounded-[24px] border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-colors group">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                         <Plus className="w-5 h-5 text-gray-400" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Add Room</span>
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- CAMERA VIEW --- */}
      {view === 'camera' && (
        <CameraView
          onCapture={handleCapture}
          onCancel={() => setView('dashboard')}
          ghostImage={currentBatch?.id === 'blue-pheno' ? '/ghost_overlay_blue.png' : undefined}
          autoStartAr={cameraMode === 'ar'}
          arPreferences={settings.arPreferences || { showColaCount: true, showBiomass: true, showHealth: true }}
          onUpdatePreferences={handleUpdateArPreferences}
        />
      )}

      {/* --- CHAT VIEW --- */}
      {view === 'chat' && (
        <ChatInterface 
           context={settings}
           batches={batches}
           logs={logs}
           envReading={envReading}
           metrics={metrics}
           onLogProposal={handleLogProposal}
        />
      )}

      {/* --- RESEARCH VIEW --- */}
      {view === 'research' && (
         <ResearchView 
            logs={logs} 
            batches={batches}
            currentBatchId={currentBatch.id}
         />
      )}

      {/* --- SETTINGS VIEW --- */}
      {view === 'settings' && (
         <div className="min-h-screen bg-[#050505] animate-slide-up">
            <div className="pt-safe-top px-6 pb-6 border-b border-white/5 bg-[#080808]">
               <button onClick={() => { Haptic.tap(); setView('dashboard'); }} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4">
                  <ArrowLeft className="w-4 h-4" /> Back
               </button>
               <h1 className="text-2xl font-bold text-white">System Configuration</h1>
            </div>
            
            <div className="p-6 space-y-8">
               {/* Grow Setup Form */}
               <section className="space-y-4">
                  <h3 className="text-xs font-mono text-neon-green uppercase tracking-widest">Facility Parameters</h3>
                  <div className="space-y-4">
                     <div>
                        <label className="block text-xs text-gray-500 uppercase font-bold mb-2">Environment</label>
                        <input 
                           type="text" 
                           value={settings.environmentType}
                           onChange={(e) => setSettings({...settings, environmentType: e.target.value})}
                           className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-green focus:outline-none transition-colors"
                        />
                     </div>
                     <div>
                        <label className="block text-xs text-gray-500 uppercase font-bold mb-2">Lighting System</label>
                        <input 
                           type="text" 
                           value={settings.lightingType}
                           onChange={(e) => setSettings({...settings, lightingType: e.target.value})}
                           className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-green focus:outline-none transition-colors"
                        />
                     </div>
                     <div>
                        <label className="block text-xs text-gray-500 uppercase font-bold mb-2">Nutrient Line</label>
                        <input 
                           type="text" 
                           value={settings.nutrients}
                           onChange={(e) => setSettings({...settings, nutrients: e.target.value})}
                           className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-green focus:outline-none transition-colors"
                        />
                     </div>
                  </div>
               </section>

               <section className="space-y-4">
                  <h3 className="text-xs font-mono text-neon-blue uppercase tracking-widest">Data Management</h3>
                  <div className="grid grid-cols-2 gap-4">
                     <button 
                        onClick={() => { Haptic.tap(); setBackupModalMode('backup'); }}
                        className="p-4 bg-[#121212] border border-white/10 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform"
                     >
                        <Download className="w-6 h-6 text-neon-green" />
                        <span className="text-xs font-bold text-white">Export Backup</span>
                     </button>
                     <button 
                        onClick={() => { Haptic.tap(); setBackupModalMode('restore'); }}
                        className="p-4 bg-[#121212] border border-white/10 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform"
                     >
                        <Upload className="w-6 h-6 text-neon-blue" />
                        <span className="text-xs font-bold text-white">Restore Data</span>
                     </button>
                     <button 
                        onClick={() => { Haptic.tap(); setShowImport(true); }}
                        className="p-4 bg-[#121212] border border-white/10 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition-transform col-span-2"
                     >
                        <Clock className="w-6 h-6 text-uv-purple" />
                        <span className="text-xs font-bold text-white">Legacy Import (Time Capsule)</span>
                     </button>
                  </div>
               </section>

               <div className="pt-8 border-t border-white/5">
                  <button 
                     onClick={() => {
                        Haptic.success();
                        dbService.saveSettings(settings);
                        setView('dashboard');
                        addToast("Settings Saved", "success");
                     }}
                     className="w-full py-4 bg-white text-black font-bold rounded-xl shadow-xl active:scale-95 transition-transform"
                  >
                     Save Configuration
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* --- GLOBAL MODALS --- */}
      {selectedBatch && (
         <BatchDetailModal 
            batch={selectedBatch} 
            logs={logs.filter(l => l.plantBatchId === selectedBatch.id).sort((a,b) => b.timestamp - a.timestamp)}
            onClose={() => setSelectedBatch(null)}
            onDeleteLog={deleteLog}
            onUpdateLog={updateLog}
         />
      )}

      {analysisData && (
         <AnalysisResultModal 
            result={analysisData.diagnosis}
            log={{
               id: 'temp', 
               plantBatchId: currentBatch.id, 
               timestamp: Date.now(), 
               actionType: 'Observation', 
               imageUrl: analysisData.image
            }}
            onSave={saveLog}
            onDiscard={() => { setAnalysisData(null); setView('camera'); }}
            onSimulate={handleSimulateFuture}
         />
      )}

      {showImport && (
         <LegacyImportModal 
            onClose={() => setShowImport(false)}
            onImportComplete={() => {
               setShowImport(false);
               window.location.reload(); // Simple reload to fetch new data
            }}
         />
      )}

      {backupModalMode && (
          <BackupModal 
             mode={backupModalMode}
             onClose={() => setBackupModalMode(null)}
             onConfirm={handleBackupRestore}
          />
      )}

      {/* --- NAVIGATION BAR --- */}
      {view !== 'camera' && view !== 'chat' && view !== 'settings' && (
         <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe-bottom z-50 pointer-events-none">
            <div className="mx-auto max-w-sm bg-[#121212]/90 backdrop-blur-xl border border-white/10 rounded-full p-2 flex justify-between items-center shadow-2xl pointer-events-auto">
               <button 
                  onClick={() => { Haptic.tap(); setView('dashboard'); }}
                  className={`p-3 rounded-full transition-all ${view === 'dashboard' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
               >
                  <LayoutDashboard className="w-5 h-5" />
               </button>
               <button 
                  onClick={() => { 
                     Haptic.tap(); 
                     setCameraMode('default');
                     setView('camera'); 
                  }}
                  className="w-14 h-14 rounded-full bg-neon-green text-black flex items-center justify-center shadow-[0_0_20px_rgba(0,255,163,0.4)] border-4 border-[#121212] -mt-6 active:scale-95 transition-transform"
               >
                  <ScanEye className="w-6 h-6" />
               </button>
               <button 
                  onClick={() => { Haptic.tap(); setView('research'); }}
                  className={`p-3 rounded-full transition-all ${view === 'research' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
               >
                  <FlaskConical className="w-5 h-5" />
               </button>
               <button 
                  onClick={() => { Haptic.tap(); setView('chat'); }}
                  className={`p-3 rounded-full transition-all ${view === 'chat' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
               >
                  <MessageCircle className="w-5 h-5" />
               </button>
            </div>
         </div>
      )}
    </div>
  );
}
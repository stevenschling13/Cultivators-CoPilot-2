import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, Scan, MessageCircle, LayoutDashboard, Droplet, Wind, Thermometer, Plus, Download, Upload, FlaskConical, Zap, CheckCircle2, AlertTriangle, Leaf, Activity, ArrowLeft, Sprout, Fan, ScanEye } from 'lucide-react';
import { EnvironmentService } from './services/environmentService';
import { geminiService } from './services/geminiService';
import { dbService } from './services/db';
import { ImageUtils } from './services/imageUtils';
import { hardwareService } from './services/hardwareService';
import { BackupService } from './services/backupService';
import type { EnvironmentReading, GrowLog, PlantBatch, AiDiagnosis, GrowSetup, Room, FacilityBriefing } from './types';
import { VpdZone } from './types';
import { MOCK_BATCHES, DEFAULT_GROW_SETUP, MOCK_ROOMS } from './constants';
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

export const App = () => {
  const [view, setView] = useState<'dashboard' | 'camera' | 'settings' | 'chat' | 'research'>('dashboard');
  const [cameraMode, setCameraMode] = useState<'default' | 'ar'>('default');
  const [rooms, setRooms] = useState<Room[]>(MOCK_ROOMS);
  const [batches, setBatches] = useState<PlantBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<PlantBatch | null>(null);
  const [logs, setLogs] = useState<GrowLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [envReading, setEnvReading] = useState<EnvironmentReading | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [settings, setSettings] = useState<GrowSetup>(DEFAULT_GROW_SETUP);
  const [briefing, setBriefing] = useState<FacilityBriefing | null>(null);
  const [backupModalMode, setBackupModalMode] = useState<'backup' | 'restore' | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<{ diagnosis: AiDiagnosis; image: string; thumbnail: string } | null>(null);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    let id: string;
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        id = crypto.randomUUID();
      } else {
        id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      }
    } catch (e) { id = Date.now().toString(); }
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [b, l, s] = await Promise.all([
          dbService.getBatches(),
          dbService.getLogs(),
          dbService.getSettings()
        ]);
        setBatches(b.length > 0 ? b : MOCK_BATCHES);
        setLogs(l.sort((a, b) => b.timestamp - a.timestamp));
        setSettings(s);
        setRooms(MOCK_ROOMS); 
        try {
          const briefingData = await geminiService.generateFacilityBriefing(MOCK_ROOMS, l);
          setBriefing(briefingData);
        } catch (e) { console.log("Briefing skipped/failed", e); }
      } catch (e) {
        console.error("Init failed", e);
        addToast("Initialization Error", 'error');
      } finally { setLoading(false); }
    };
    load();
    const unsub = hardwareService.onReading((reading) => setEnvReading(reading));
    hardwareService.scanForDevices().then(devices => {
       if(devices.length > 0) hardwareService.connectToDevice(devices[0].id);
    });
    return () => unsub();
  }, [addToast]);

  const metrics = useMemo(() => {
    return envReading ? EnvironmentService.processReading(envReading) : { vpd: 1.25, dli: 35, vpdStatus: VpdZone.TRANSPIRATION };
  }, [envReading]);

  const currentBatch = useMemo(() => selectedBatch || batches[0] || MOCK_BATCHES[0], [batches, selectedBatch]);

  const handleCapture = useCallback(async (file: File) => {
    setView('dashboard');
    setAnalyzing(true);
    try {
        const processed = await ImageUtils.processImage(file);
        const diagnosis = await geminiService.analyzePlantImage(
            processed.full, 
            settings, 
            undefined, 
            envReading || undefined, 
            currentBatch?.breederHarvestDays,
            currentBatch?.currentStage // Pass current stage for context-aware analysis
        );
        setAnalysisData({ diagnosis, image: processed.full, thumbnail: processed.thumbnail });
        Haptic.success();
    } catch (e) {
        console.error("Analysis Error:", e);
        addToast("Analysis Failed. Please try again.", "error");
        Haptic.error();
    } finally { setAnalyzing(false); }
  }, [addToast, currentBatch, envReading, settings]);

  const handleSaveAnalysis = useCallback(async () => {
    if (!analysisData || !currentBatch) return;
    let id = crypto.randomUUID();
    const newLog: GrowLog = {
        id, plantBatchId: currentBatch.id, timestamp: Date.now(), imageUrl: analysisData.image, thumbnailUrl: analysisData.thumbnail, actionType: 'Observation', aiDiagnosis: analysisData.diagnosis, manualNotes: analysisData.diagnosis.morphologyNotes
    };
    await dbService.saveLog(newLog);
    setLogs(prev => [newLog, ...prev]);
    setAnalysisData(null);
    addToast("Diagnosis Saved", "success");
    Haptic.success();
  }, [addToast, analysisData, currentBatch]);

  const handleLogProposal = useCallback(async (proposal: Partial<GrowLog>) => {
    if (!currentBatch) return;
    const id = crypto.randomUUID();
    const newLog: GrowLog = {
        id, plantBatchId: currentBatch.id, timestamp: Date.now(), actionType: proposal.actionType || 'Observation', manualNotes: proposal.manualNotes || 'Added via Copilot', aiDiagnosis: proposal.aiDiagnosis
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

  const handleQuickLog = useCallback(async (type: string) => {
     if (!currentBatch) return;
     const id = crypto.randomUUID();
     const newLog: GrowLog = { id, plantBatchId: currentBatch.id, timestamp: Date.now(), actionType: type, manualNotes: `Quick Log: ${type}` };
     await dbService.saveLog(newLog);
     setLogs(prev => [newLog, ...prev]);
     addToast(`${type} Logged`, "success");
     Haptic.success();
  }, [currentBatch, addToast]);

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
     if (batch) setSelectedBatch(batch);
     else addToast("No Active Batch in Room", "info");
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
       } else return false;
    } catch (e) { console.error(e); return false; }
  }, [addToast]);

  const selectedBatchLogs = useMemo(() => selectedBatch ? logs.filter(l => l.plantBatchId === selectedBatch.id) : [], [logs, selectedBatch]);

  if (loading) return <div className="h-screen bg-black text-white flex flex-col items-center justify-center font-mono animate-pulse tracking-widest text-xs"><div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin mb-4"></div>INITIALIZING SYSTEMS...</div>;

  return (
    <SystemErrorBoundary>
      <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
      <ProcessingOverlay isProcessing={analyzing} />
      {analysisData && <AnalysisResultModal result={analysisData.diagnosis} log={{ imageUrl: analysisData.image } as GrowLog} onSave={handleSaveAnalysis} onDiscard={() => setAnalysisData(null)} onSimulate={handleSimulate} />}
      {showImport && <LegacyImportModal onClose={() => setShowImport(false)} onImportComplete={() => { setShowImport(false); addToast("Import Completed Successfully", "success"); dbService.getLogs().then(l => setLogs(l.sort((a, b) => b.timestamp - a.timestamp))); }} />}
      {backupModalMode && <BackupModal mode={backupModalMode} onClose={() => setBackupModalMode(null)} onConfirm={(p, f) => backupModalMode === 'backup' ? handleBackup(p) : handleRestore(p, f)} />}
      {selectedBatch && <BatchDetailModal batch={selectedBatch} onClose={() => setSelectedBatch(null)} logs={selectedBatchLogs} onDeleteLog={handleDeleteLog} onUpdateLog={handleUpdateLog} />}
      {view === 'camera' && <CameraView onCapture={handleCapture} onCancel={() => setView('dashboard')} autoStartAr={cameraMode === 'ar'} />}

      <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-neon-green/30 flex flex-col pb-20">
        
        {/* === VIEW: DASHBOARD === */}
        {view === 'dashboard' && (
           <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
             <header className="flex-none flex justify-between items-center px-6 py-5 pt-safe-top bg-[#080808]/90 backdrop-blur-xl border-b border-white/5 z-30">
                <div>
                   <div className="flex items-center gap-2 text-neon-green mb-1.5">
                      <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse shadow-[0_0_5px_currentColor]"></div>
                      <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-80">System Nominal</span>
                   </div>
                   <h1 className="text-2xl font-bold tracking-tight text-white font-mono">COMMAND.CENTER</h1>
                </div>
                <button onClick={() => { Haptic.tap(); setView('settings'); }} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full border border-white/5 hover:bg-white/10 active:scale-95 transition-all">
                    <Settings className="w-5 h-5 text-gray-400" />
                </button>
             </header>

             <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24 scroll-smooth">
               {briefing && (
                  <BentoCard className="p-5 !bg-gradient-to-br !from-[#121212] !to-[#080808] !border-neon-green/20 shadow-2xl">
                      <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl shrink-0 ${briefing.status === 'CRITICAL' ? 'bg-alert-red/10 text-alert-red' : 'bg-neon-green/10 text-neon-green'}`}>
                             {briefing.status === 'CRITICAL' ? <AlertTriangle className="w-6 h-6"/> : <Zap className="w-6 h-6"/>}
                          </div>
                          <div>
                             <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-1.5">Daily Briefing</h3>
                             <p className="text-sm text-gray-300 leading-relaxed mb-3">{briefing.summary}</p>
                             {briefing.actionItems.length > 0 && (
                               <div className="flex flex-wrap gap-2">
                                  {briefing.actionItems.map((item, i) => (
                                     <div key={i} className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-gray-400 flex items-center gap-1.5 hover:bg-white/10 transition-colors">
                                        <CheckCircle2 className="w-3 h-3 text-neon-blue" /> {item}
                                     </div>
                                  ))}
                               </div>
                             )}
                          </div>
                      </div>
                  </BentoCard>
               )}

               <div>
                  <div className="flex justify-between items-center mb-4 px-1">
                     <h2 className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Environment Triage
                     </h2>
                     <div className="flex items-center gap-1.5 bg-neon-green/5 border border-neon-green/10 px-2 py-1 rounded-md">
                         <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse"></span>
                         <span className="text-[9px] text-neon-green font-mono tracking-wider">LIVE FEED</span>
                     </div>
                  </div>
                  
                  {/* High Density Metric Grid */}
                  <div className="grid grid-cols-3 gap-3 h-36">
                      <MetricGauge 
                         label="VPD" 
                         value={metrics.vpd.toFixed(2)} 
                         unit="kPa" 
                         status={metrics.vpdStatus} 
                         icon={Wind} 
                         trend="stable" 
                      />
                      <MetricGauge 
                         label="Temp" 
                         value={envReading?.temperature.toFixed(1) || '--'} 
                         unit="°F" 
                         status={VpdZone.TRANSPIRATION} 
                         icon={Thermometer} 
                         trend="up" 
                      />
                      <MetricGauge 
                         label="RH" 
                         value={envReading?.humidity.toFixed(0) || '--'} 
                         unit="%" 
                         status={VpdZone.TRANSPIRATION} 
                         icon={Droplet} 
                         trend="down" 
                      />
                  </div>
               </div>

               <div>
                  <h2 className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 px-1 flex items-center gap-2">
                     <LayoutDashboard className="w-3 h-3" /> Active Zones
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                     {rooms.map(room => {
                        const batch = batches.find(b => b.id === room.activeBatchId);
                        return <RoomTile key={room.id} room={{...room, name: batch?.strain || room.name}} onClick={handleRoomClick} />;
                     })}
                  </div>
               </div>

               <div>
                  <h2 className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 px-1">Quick Actions</h2>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                     {[
                        { id: 'AR Scout', icon: ScanEye, color: 'neon-green', action: () => { setCameraMode('ar'); setView('camera'); } },
                        { id: 'Water', icon: Droplet, color: 'neon-blue' },
                        { id: 'Feed', icon: Leaf, color: 'neon-green' },
                        { id: 'Defoliate', icon: Activity, color: 'uv-purple' },
                        { id: 'Import', icon: Plus, color: 'white', action: () => setShowImport(true) }
                     ].map((action) => (
                        <button 
                           key={action.id} 
                           onClick={() => { Haptic.tap(); action.action ? action.action() : handleQuickLog(action.id); }} 
                           className="flex flex-col items-center gap-2 min-w-[72px] group"
                        >
                           <div className={`w-14 h-14 rounded-[20px] bg-[#121212] border border-white/10 flex items-center justify-center transition-all active:scale-90 group-hover:border-${action.color}/50 group-hover:bg-white/5 shadow-lg relative overflow-hidden`}>
                              <div className={`absolute inset-0 bg-${action.color}/10 opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                              <action.icon className={`w-6 h-6 text-${action.color} relative z-10`} />
                           </div>
                           <span className="text-[9px] text-gray-500 font-mono font-bold uppercase group-hover:text-white transition-colors text-center">{action.id}</span>
                        </button>
                     ))}
                  </div>
               </div>
             </div>
           </div>
        )}

        {view === 'research' && <ResearchView logs={logs} batches={batches} currentBatchId={selectedBatch?.id} />}
        {view === 'chat' && <div className="flex-1 h-full overflow-hidden"><ChatInterface context={settings} batches={batches} logs={logs} envReading={envReading} metrics={metrics} onLogProposal={handleLogProposal} /></div>}
        {view === 'settings' && (
            <div className="p-6 pt-safe-top animate-fade-in space-y-6">
                <div className="flex items-center gap-3 mb-6">
                   <button onClick={() => { Haptic.tap(); setView('dashboard'); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-90 transition-all"><ArrowLeft className="w-6 h-6" /></button>
                   <h2 className="text-xl font-bold font-mono uppercase tracking-wider">System Config</h2>
                </div>
                <div className="space-y-4">
                    <BentoCard className="p-5">
                        <label className="text-[10px] text-gray-500 uppercase font-mono tracking-wider block mb-2">Environment</label>
                        <div className="text-white font-medium text-sm">{settings.environmentType}</div>
                    </BentoCard>
                    <BentoCard className="p-5">
                        <label className="text-[10px] text-gray-500 uppercase font-mono tracking-wider block mb-2">Lighting</label>
                        <div className="text-white font-medium text-sm">{settings.lightingType}</div>
                    </BentoCard>
                    <div className="pt-4 border-t border-white/5">
                        <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3 px-1">Data Sovereignty</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { Haptic.tap(); setBackupModalMode('backup'); }} className="p-4 bg-[#121212] border border-white/10 rounded-2xl flex flex-col items-center gap-2 active:scale-95 transition-all hover:bg-white/5 group">
                                <div className="w-10 h-10 rounded-full bg-neon-green/10 flex items-center justify-center group-hover:bg-neon-green/20 transition-colors"><Download className="w-5 h-5 text-neon-green" /></div>
                                <span className="text-xs font-bold text-gray-300">Backup</span>
                            </button>
                            <button onClick={() => { Haptic.tap(); setBackupModalMode('restore'); }} className="p-4 bg-[#121212] border border-white/10 rounded-2xl flex flex-col items-center gap-2 active:scale-95 transition-all hover:bg-white/5 group">
                                <div className="w-10 h-10 rounded-full bg-neon-blue/10 flex items-center justify-center group-hover:bg-neon-blue/20 transition-colors"><Upload className="w-5 h-5 text-neon-blue" /></div>
                                <span className="text-xs font-bold text-gray-300">Restore</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* === BOTTOM NAVIGATION === */}
        {view !== 'camera' && view !== 'settings' && (
            <div className="fixed bottom-0 left-0 right-0 bg-[#050505]/90 backdrop-blur-xl border-t border-white/10 pb-safe-bottom z-50">
                <div className="flex justify-around items-center h-20 px-2">
                    <button onClick={() => { Haptic.tap(); setView('dashboard'); }} className={`flex flex-col items-center gap-1 w-16 transition-all duration-300 ${view === 'dashboard' ? 'text-neon-green translate-y-[-2px]' : 'text-gray-600'}`}>
                        <LayoutDashboard className={`w-6 h-6 ${view === 'dashboard' ? 'drop-shadow-[0_0_8px_rgba(0,255,163,0.5)]' : ''}`} />
                        <span className="text-[9px] font-bold uppercase tracking-wider font-mono">Base</span>
                    </button>
                    
                    <button onClick={() => { Haptic.tap(); setView('research'); }} className={`flex flex-col items-center gap-1 w-16 transition-all duration-300 ${view === 'research' ? 'text-uv-purple translate-y-[-2px]' : 'text-gray-600'}`}>
                        <FlaskConical className={`w-6 h-6 ${view === 'research' ? 'drop-shadow-[0_0_8px_rgba(189,0,255,0.5)]' : ''}`} />
                        <span className="text-[9px] font-bold uppercase tracking-wider font-mono">Lab</span>
                    </button>

                    <button onClick={() => { Haptic.tap(); setCameraMode('default'); setView('camera'); }} className="relative -top-6 group">
                        <div className="absolute inset-0 bg-neon-green/30 rounded-full blur-xl group-hover:bg-neon-green/50 transition-all opacity-50 group-hover:opacity-80"></div>
                        <div className="relative w-16 h-16 bg-black border border-neon-green rounded-full flex items-center justify-center text-neon-green shadow-[0_0_20px_rgba(0,255,163,0.2)] active:scale-95 transition-transform">
                            <Scan className="w-7 h-7" />
                        </div>
                    </button>

                    <button onClick={() => { Haptic.tap(); setView('chat'); }} className={`flex flex-col items-center gap-1 w-16 transition-all duration-300 ${view === 'chat' ? 'text-neon-blue translate-y-[-2px]' : 'text-gray-600'}`}>
                        <MessageCircle className={`w-6 h-6 ${view === 'chat' ? 'drop-shadow-[0_0_8px_rgba(0,212,255,0.5)]' : ''}`} />
                        <span className="text-[9px] font-bold uppercase tracking-wider font-mono">AI</span>
                    </button>
                </div>
            </div>
        )}
      </div>
    </SystemErrorBoundary>
  );
};
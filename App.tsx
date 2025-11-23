
import React, { 
  useState, 
  useEffect, 
} from 'react';
import { 
  Settings,
  Scan,
  MessageCircle,
  LayoutDashboard,
  Droplet,
  Wind,
  Thermometer,
  Plus
} from 'lucide-react';

// Services
import { EnvironmentService } from './services/environmentService';
import { geminiService } from './services/geminiService';
import { dbService } from './services/db';
import { ImageUtils } from './services/imageUtils';
import { hardwareService } from './services/hardwareService';

// Types & Constants
import type { 
  EnvironmentReading, 
  GrowLog, 
  PlantBatch, 
  AiDiagnosis,
  GrowSetup,
  Room
} from './types';
import { VpdZone } from './types';
import { MOCK_BATCHES, DEFAULT_GROW_SETUP, MOCK_ROOMS } from './constants';

// Components
import { SystemErrorBoundary } from './components/SystemErrorBoundary';
import { ToastContainer, ToastMsg } from './components/ui/Toast';
import { ProcessingOverlay } from './components/ui/ProcessingOverlay';
import { MetricGauge } from './components/ui/Primitives';
import { RoomTile } from './components/ui/RoomTile';
import { CameraView } from './components/CameraView';
import { BatchDetailModal } from './components/modals/BatchDetailModal';
import { AnalysisResultModal } from './components/modals/AnalysisResultModal';
import { LegacyImportModal } from './components/modals/LegacyImportModal';
import { ChatInterface } from './components/ChatInterface';
import { Haptic } from './utils/haptics';

// --- App Main Component ---

export const App = () => {
  const [view, setView] = useState<'dashboard' | 'camera' | 'settings' | 'chat'>('dashboard');
  const [rooms, setRooms] = useState<Room[]>(MOCK_ROOMS);
  const [batches, setBatches] = useState<PlantBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<PlantBatch | null>(null);
  const [logs, setLogs] = useState<GrowLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [envReading, setEnvReading] = useState<EnvironmentReading | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [settings, setSettings] = useState<GrowSetup>(DEFAULT_GROW_SETUP);
  
  // AI Analysis States
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<{ diagnosis: AiDiagnosis; image: string } | null>(null);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const b = await dbService.getBatches();
        setBatches(b.length > 0 ? b : MOCK_BATCHES);
        const l = await dbService.getLogs();
        setLogs(l.sort((a, b) => b.timestamp - a.timestamp));
        const s = await dbService.getSettings();
        setSettings(s);
        setRooms(MOCK_ROOMS); // In prod, fetch from DB
      } catch (e) {
        console.error("Init failed", e);
        addToast("Initialization Error", 'error');
      } finally {
        setLoading(false);
      }
    };
    load();

    // Hardware simulation subscription
    const unsub = hardwareService.onReading((reading) => {
      setEnvReading(reading);
    });
    
    hardwareService.scanForDevices().then(devices => {
       if(devices.length > 0) hardwareService.connectToDevice(devices[0].id);
    });

    return () => unsub();
  }, []);

  const handleCapture = async (file: File) => {
    setView('dashboard');
    setAnalyzing(true);
    
    try {
        const compressed = await ImageUtils.compressImage(file);
        const batch = selectedBatch || batches[0] || MOCK_BATCHES[0];
        
        const diagnosis = await geminiService.analyzePlantImage(
            compressed,
            settings,
            undefined, 
            envReading || undefined,
            batch?.breederHarvestDays
        );
        
        setAnalysisData({ diagnosis, image: compressed });
        Haptic.success();
    } catch (e) {
        console.error("Analysis Error:", e);
        addToast("Analysis Failed. Please try again.", "error");
        Haptic.error();
    } finally {
        setAnalyzing(false);
    }
  };

  const handleSaveAnalysis = async () => {
    if (!analysisData) return;
    const batch = selectedBatch || batches[0] || MOCK_BATCHES[0];
    
    const newLog: GrowLog = {
        id: crypto.randomUUID(),
        plantBatchId: batch.id,
        timestamp: Date.now(),
        imageUrl: analysisData.image,
        thumbnailUrl: await ImageUtils.createThumbnail(analysisData.image),
        actionType: 'Observation',
        aiDiagnosis: analysisData.diagnosis,
        manualNotes: analysisData.diagnosis.morphologyNotes
    };
    
    await dbService.saveLog(newLog);
    setLogs(prev => [newLog, ...prev]);
    setAnalysisData(null);
    addToast("Diagnosis Saved", "success");
    Haptic.success();
  };

  const handleLogProposal = async (proposal: Partial<GrowLog>) => {
    const batch = selectedBatch || batches[0] || MOCK_BATCHES[0];
    const newLog: GrowLog = {
        id: crypto.randomUUID(),
        plantBatchId: batch.id,
        timestamp: Date.now(),
        actionType: proposal.actionType || 'Observation',
        manualNotes: proposal.manualNotes || 'Added via Copilot',
        aiDiagnosis: proposal.aiDiagnosis
    };
    
    await dbService.saveLog(newLog);
    setLogs(prev => [newLog, ...prev]);
    addToast("Log Entry Created via AI", "success");
  };

  const handleUpdateLog = async (updatedLog: GrowLog) => {
    await dbService.saveLog(updatedLog);
    setLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
    addToast("Log Entry Updated", "success");
  };

  const handleDeleteLog = async (id: string) => {
    await dbService.deleteLog(id);
    setLogs(prev => prev.filter(l => l.id !== id));
    addToast("Log Entry Deleted", "info");
  };

  const handleSimulate = async (img: string) => {
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
  };

  const handleRoomClick = (room: Room) => {
     const batch = batches.find(b => b.id === room.activeBatchId) || batches[0];
     if (batch) {
        setSelectedBatch(batch);
     } else {
        addToast("No Active Batch in Room", "info");
     }
  };

  const metrics = envReading ? EnvironmentService.processReading(envReading) : { vpd: 1.25, dli: 35, vpdStatus: VpdZone.TRANSPIRATION };

  if (loading) return <div className="h-screen bg-black text-white flex items-center justify-center font-mono animate-pulse tracking-widest text-xs">ESTABLISHING UPLINK...</div>;

  return (
    <SystemErrorBoundary>
      <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
      <ProcessingOverlay isProcessing={analyzing} />
      
      {analysisData && (
        <AnalysisResultModal 
            result={analysisData.diagnosis}
            log={{ imageUrl: analysisData.image } as GrowLog} 
            onSave={handleSaveAnalysis}
            onDiscard={() => setAnalysisData(null)}
            onSimulate={handleSimulate}
        />
      )}

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

      {selectedBatch && (
        <BatchDetailModal 
           batch={selectedBatch} 
           onClose={() => setSelectedBatch(null)}
           logs={logs.filter(l => l.plantBatchId === selectedBatch.id)}
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

      <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-neon-green/30 flex flex-col pb-20">
        
        {/* === VIEW: DASHBOARD === */}
        {view === 'dashboard' && (
           <div className="p-5 space-y-6 animate-fade-in flex-1 overflow-y-auto">
             {/* Header */}
             <header className="flex justify-between items-center pt-safe-top">
                <div>
                   <div className="flex items-center gap-2 text-neon-green mb-1">
                      <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Facility Online</span>
                   </div>
                   <h1 className="text-xl font-bold tracking-tight text-white">Command Center <span className="text-gray-600 font-normal text-sm">v3.1</span></h1>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setView('settings')} className="w-10 h-10 flex items-center justify-center bg-[#1A1A1A] rounded-full border border-white/5 hover:bg-white/10 active:scale-95 transition-all">
                       <Settings className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
             </header>

             {/* Global Ticker / Telemetry */}
             <div>
                <div className="flex justify-between items-end mb-3 px-1">
                   <h2 className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">Aggregate Telemetry</h2>
                   <div className="text-[9px] text-gray-600 font-mono">LIVE DATA</div>
                </div>
                <div className="grid grid-cols-2 gap-3 h-32">
                    <MetricGauge 
                        label="VPD (kPa)" 
                        value={metrics.vpd} 
                        unit="kPa"
                        status={metrics.vpdStatus}
                        icon={Wind}
                    />
                    <div className="grid grid-rows-2 gap-3">
                        <div className="bg-[#121212] rounded-2xl border border-white/5 p-3 flex items-center justify-between relative overflow-hidden">
                            <div>
                                <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Temp</div>
                                <div className="text-xl font-bold text-white">{envReading ? envReading.temperature.toFixed(1) : '--'}°</div>
                            </div>
                            <Thermometer className="w-5 h-5 text-gray-600 absolute right-3 top-3 opacity-50" />
                            <div className="w-1 h-8 bg-gradient-to-b from-orange-500 to-yellow-500 rounded-full absolute right-3 bottom-3"></div>
                        </div>
                        <div className="bg-[#121212] rounded-2xl border border-white/5 p-3 flex items-center justify-between relative overflow-hidden">
                            <div>
                                <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Humidity</div>
                                <div className="text-xl font-bold text-white">{envReading ? envReading.humidity.toFixed(1) : '--'}%</div>
                            </div>
                            <Droplet className="w-5 h-5 text-gray-600 absolute right-3 top-3 opacity-50" />
                            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-cyan-400 rounded-full absolute right-3 bottom-3"></div>
                        </div>
                    </div>
                </div>
             </div>

             {/* Active Rooms Grid */}
             <div>
                <h2 className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 px-1">Grow Zones</h2>
                <div className="grid grid-cols-2 gap-3">
                   {rooms.map(room => (
                      <RoomTile key={room.id} room={room} onClick={handleRoomClick} />
                   ))}
                </div>
             </div>

             {/* Quick Actions */}
             <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setShowImport(true)} className="bg-[#121212] border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-all">
                    <Plus className="w-6 h-6 text-gray-400" />
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Import</span>
                </button>
                <div className="col-span-2 bg-gradient-to-r from-neon-green/10 to-transparent border border-neon-green/20 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <div className="text-neon-green font-bold text-sm">Next Task</div>
                        <div className="text-xs text-gray-400">Defoliation due in 2 days</div>
                    </div>
                    <button className="px-3 py-1.5 bg-neon-green text-black text-xs font-bold rounded-lg">View</button>
                </div>
             </div>
           </div>
        )}

        {/* === VIEW: CHAT === */}
        {view === 'chat' && (
            <div className="flex-1 h-full overflow-hidden">
                <ChatInterface context={settings} onLogProposal={handleLogProposal} />
            </div>
        )}

        {/* === VIEW: SETTINGS === */}
        {view === 'settings' && (
            <div className="p-6 pt-safe-top animate-fade-in">
                <h2 className="text-2xl font-bold mb-6">Settings</h2>
                <div className="space-y-4">
                    <div className="p-4 bg-[#121212] rounded-xl border border-white/10">
                        <label className="text-xs text-gray-500 uppercase block mb-2">Grow Environment</label>
                        <div className="text-white font-medium">{settings.environmentType}</div>
                    </div>
                    <div className="p-4 bg-[#121212] rounded-xl border border-white/10">
                        <label className="text-xs text-gray-500 uppercase block mb-2">Lighting System</label>
                        <div className="text-white font-medium">{settings.lightingType}</div>
                    </div>
                    <button onClick={() => setView('dashboard')} className="w-full py-3 bg-white/10 rounded-xl text-white font-bold">Back to Dashboard</button>
                </div>
            </div>
        )}

        {/* === BOTTOM NAVIGATION === */}
        {view !== 'camera' && (
            <div className="fixed bottom-0 left-0 right-0 bg-[#050505]/90 backdrop-blur-lg border-t border-white/10 pb-safe-bottom z-50">
                <div className="flex justify-around items-center h-16">
                    <button 
                       onClick={() => { Haptic.tap(); setView('dashboard'); }}
                       className={`flex flex-col items-center gap-1 w-16 transition-colors ${view === 'dashboard' ? 'text-neon-green' : 'text-gray-600'}`}
                    >
                        <LayoutDashboard className="w-6 h-6" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Base</span>
                    </button>

                    {/* Center Action Button (Scanner) */}
                    <button 
                       onClick={() => { Haptic.tap(); setView('camera'); }}
                       className="relative -top-6 bg-black border border-neon-green/50 p-1 rounded-full shadow-[0_0_20px_rgba(0,255,163,0.3)] active:scale-95 transition-transform"
                    >
                        <div className="w-14 h-14 bg-neon-green rounded-full flex items-center justify-center text-black">
                            <Scan className="w-7 h-7" />
                        </div>
                    </button>

                    <button 
                       onClick={() => { Haptic.tap(); setView('chat'); }}
                       className={`flex flex-col items-center gap-1 w-16 transition-colors ${view === 'chat' ? 'text-neon-blue' : 'text-gray-600'}`}
                    >
                        <MessageCircle className="w-6 h-6" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Copilot</span>
                    </button>
                </div>
            </div>
        )}

      </div>
    </SystemErrorBoundary>
  );
};

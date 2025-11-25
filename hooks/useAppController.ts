

import { useState, useEffect, useRef, useMemo } from 'react';
import { errorService } from '../services/errorService';
import { dbService } from '../services/db';
import { hardwareService } from '../services/hardwareService';
import { geminiService } from '../services/geminiService';
import { ImageUtils } from '../services/imageUtils';
import { EnvironmentService } from '../services/environmentService';
import { Haptic } from '../utils/haptics';
import { generateUUID } from '../utils/uuid';
import { 
  Room, PlantBatch, GrowLog, GrowSetup, FacilityBriefing, ToastMsg, 
  AiDiagnosis, LogProposal, VpdZone, ArPreferences, VoiceCommandResponse,
  ArOverlayData
} from '../types';
import { MOCK_ROOMS, MOCK_BATCHES, DEFAULT_GROW_SETUP } from '../constants';

export const useAppController = () => {
  // Navigation
  const [view, setView] = useState<'dashboard' | 'camera' | 'settings' | 'chat' | 'research'>('dashboard');

  // Domain Data
  const [rooms, setRooms] = useState<Room[]>(MOCK_ROOMS);
  const [batches, setBatches] = useState<PlantBatch[]>(MOCK_BATCHES);
  const [logs, setLogs] = useState<GrowLog[]>([]);
  const [setup, setSetup] = useState<GrowSetup>(DEFAULT_GROW_SETUP);
  const [briefing, setBriefing] = useState<FacilityBriefing | null>(null);

  // UI State
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<PlantBatch | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ result: AiDiagnosis, log: GrowLog } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState<'backup' | 'restore' | null>(null);
  const [arPreferences, setArPreferences] = useState<ArPreferences>(DEFAULT_GROW_SETUP.arPreferences || { showColaCount: true, showBiomass: true, showHealth: true });
  
  // Room Management UI
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Voice UI
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  const stateRef = useRef({ briefing, rooms, logs, setup });

  // Update ref for visibility checks
  useEffect(() => {
    stateRef.current = { briefing, rooms, logs, setup };
  }, [briefing, rooms, logs, setup]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = generateUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const refreshBriefing = async (currentRooms: Room[], currentLogs: GrowLog[]) => {
    try {
        const newBriefing = await geminiService.generateFacilityBriefing(currentRooms, currentLogs);
        setBriefing(newBriefing);
    } catch (e) {
        console.warn("Briefing refresh failed", e);
    }
  };

  // Initialization & Hardware Subscriptions
  useEffect(() => {
    const init = async () => {
      errorService.init((msg, type) => addToast(msg, type));
      
      try {
        const [loadedBatches, loadedLogs, loadedSettings, loadedRooms] = await Promise.all([
          dbService.getBatches(),
          dbService.getLogs(),
          dbService.getSettings(),
          dbService.getRooms()
        ]);

        if (loadedBatches.length > 0) setBatches(loadedBatches);
        if (loadedLogs.length > 0) setLogs(loadedLogs.sort((a, b) => b.timestamp - a.timestamp));
        if (loadedRooms.length > 0) setRooms(loadedRooms);

        if (loadedSettings) {
            setSetup(loadedSettings);
            if (loadedSettings.arPreferences) setArPreferences(loadedSettings.arPreferences);
        }

        hardwareService.setNotificationsEnabled(loadedSettings?.vpdNotifications ?? true);
        const devices = await hardwareService.scanForDevices();
        devices.forEach(d => hardwareService.connectToDevice(d.id));

        if (loadedLogs.length > 0) {
            refreshBriefing(loadedRooms.length > 0 ? loadedRooms : MOCK_ROOMS, loadedLogs);
        }

      } catch (e) {
        errorService.captureError(e as Error, { severity: 'CRITICAL', metadata: { phase: 'AppInit' } });
      }
    };

    init();

    // Dynamic Sensor Mapping based on Room.sensorId
    const unsubSensors = hardwareService.onReading((deviceId, reading) => {
      setRooms(prevRooms => {
        // Find if any room is listening to this device
        const targetRoomIndex = prevRooms.findIndex(r => r.sensorId === deviceId);
        if (targetRoomIndex === -1) return prevRooms; // No room mapped to this sensor

        const targetRoom = prevRooms[targetRoomIndex];
        const settings = stateRef.current.setup;
        const leafOffset = settings.leafTempOffset ?? -2; // Default to -2 if not set

        const metrics = EnvironmentService.processReading(reading, leafOffset);
        
        let status: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL';
        if (metrics.vpdStatus === VpdZone.DANGER) status = 'CRITICAL';
        else if (metrics.vpdStatus === VpdZone.LEECHING) status = 'WARNING';

        const newHistory = [...targetRoom.metrics.history, metrics.vpd].slice(-20);

        const updatedRoom = {
          ...targetRoom,
          metrics: {
            ...targetRoom.metrics,
            temp: reading.temperature,
            rh: reading.humidity,
            co2: reading.co2,
            vpd: metrics.vpd,
            lastUpdated: reading.timestamp,
            status,
            history: newHistory
          }
        };

        // Immutable update
        const newRooms = [...prevRooms];
        newRooms[targetRoomIndex] = updatedRoom;
        return newRooms;
      });
    });

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            hardwareService.wakeUp();
            const lastBriefing = stateRef.current.briefing;
            const ONE_HOUR = 60 * 60 * 1000;
            if (!lastBriefing || (Date.now() - (lastBriefing.timestamp || 0) > ONE_HOUR)) {
                refreshBriefing(stateRef.current.rooms, stateRef.current.logs);
            }
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        unsubSensors();
        hardwareService.disconnect();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Action Handlers
  const handleManualCapture = async (file: File) => {
    setIsProcessing(true);
    setView('dashboard');
    try {
      const processed = await ImageUtils.processImage(file);
      const diagnosis = await geminiService.analyzePlantImage(processed.full);
      
      const newLog: GrowLog = {
        id: generateUUID(),
        plantBatchId: batches[0]?.id, // Default to first batch if unknown
        timestamp: Date.now(),
        thumbnailUrl: processed.thumbnail,
        imageUrl: processed.full,
        actionType: 'Observation',
        aiDiagnosis: diagnosis,
        manualNotes: diagnosis.morphologyNotes
      };

      setAnalysisResult({ result: diagnosis, log: newLog });
    } catch (e) {
      addToast('Analysis Failed', 'error');
      errorService.captureError(e as Error, { severity: 'HIGH', metadata: { context: 'ManualCapture' } });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogSave = async (log: GrowLog) => {
    await dbService.saveLog(log);
    setLogs(prev => [log, ...prev]);
    setAnalysisResult(null);
    addToast('Entry Logged', 'success');
    Haptic.success();
  };

  const handleLogUpdate = async (updatedLog: GrowLog) => {
    await dbService.saveLog(updatedLog);
    setLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
    addToast('Entry Updated', 'success');
  };

  const handleLogDelete = async (id: string) => {
    await dbService.deleteLog(id);
    setLogs(prev => prev.filter(l => l.id !== id));
    Haptic.tap();
  };

  const handleLogProposal = async (proposal: LogProposal) => {
    const newLog: GrowLog = {
      id: generateUUID(),
      plantBatchId: batches[0]?.id,
      timestamp: Date.now(),
      actionType: proposal.actionType,
      manualNotes: proposal.manualNotes,
      aiDiagnosis: {
         healthScore: proposal.healthScore || 0,
         detectedPests: proposal.detectedPests || [],
         nutrientDeficiencies: proposal.nutrientDeficiencies || [],
         morphologyNotes: proposal.manualNotes,
         recommendations: proposal.recommendations || []
      }
    };
    await handleLogSave(newLog);
  };

  // Convert AR Data to a Log Proposal
  const handleArSnapshot = async (data: ArOverlayData) => {
      Haptic.success();
      const stress = data.stressLevel || 0;
      const healthScore = Math.max(0, 100 - stress);
      
      let note = `AR Scan Snapshot. `;
      if (data.colaCount) note += `Visible Colas: ${data.colaCount}. `;
      if (data.biomassEstimate) note += `Biomass: ${data.biomassEstimate}. `;
      if (data.healthStatus) note += `Status: ${data.healthStatus}. `;
      if (data.criticalWarning) note += `WARNING: ${data.criticalWarning}. `;
      
      const proposal: LogProposal = {
          actionType: 'Observation',
          manualNotes: note,
          healthScore: healthScore,
          detectedPests: data.criticalWarning ? ['Potential Issue Detected via AR'] : [],
          nutrientDeficiencies: [],
          recommendations: data.guidance ? [data.guidance] : []
      };

      await handleLogProposal(proposal);
      addToast('AR Data Pinned to Log', 'success');
      setView('dashboard');
  };

  const handleVeoSimulation = async (imgUrl: string): Promise<string> => {
      try {
        addToast("Generating Growth Simulation...", "info");
        const videoUrl = await geminiService.generateGrowthSimulation(imgUrl);
        
        // Append API Key to the URI for playback
        const playbackUrl = `${videoUrl}&key=${(process.env as any).API_KEY}`;
        
        // Log simulation completion (optional: could save to log)
        const log = stateRef.current.logs.find(l => l.imageUrl === imgUrl);
        if (log) {
            const updated = { ...log, videoUrl: playbackUrl };
            await dbService.saveLog(updated);
            setLogs(prev => prev.map(l => l.id === log.id ? updated : l));
        }

        addToast("Simulation Complete", "success");
        return playbackUrl;
      } catch (e) {
          addToast("Simulation Failed", "error");
          console.error(e);
          throw e;
      }
  };
  
  const handleImportComplete = async () => {
     const newLogs = await dbService.getLogs();
     setLogs(newLogs.sort((a,b) => b.timestamp - a.timestamp));
     setShowImportModal(false);
     addToast("Import Complete", "success");
  };

  const updateArPreferences = (prefs: ArPreferences) => {
     setArPreferences(prefs);
     const newSetup = { ...setup, arPreferences: prefs };
     setSetup(newSetup);
     dbService.saveSettings(newSetup);
  };

  const playAudioBriefing = async (text: string) => {
      try {
          addToast("Synthesizing Briefing...", "info");
          const audioBuffer = await geminiService.generateAudioBriefing(text);
          
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const decoded = await ctx.decodeAudioData(audioBuffer);
          const source = ctx.createBufferSource();
          source.buffer = decoded;
          source.connect(ctx.destination);
          source.start(0);
      } catch (e) {
          addToast("Audio Failed", "error");
          console.error(e);
      }
  };

  // --- Room Management Handlers ---

  const handleSaveRoom = async (room: Room) => {
      await dbService.saveRoom(room);
      setRooms(prev => {
          const idx = prev.findIndex(r => r.id === room.id);
          if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = room;
              return updated;
          }
          return [...prev, room];
      });
      if (room.sensorId) {
          hardwareService.connectToDevice(room.sensorId);
      }
      setShowRoomModal(false);
      setEditingRoom(null);
      addToast('Room Configuration Saved', 'success');
  };

  const handleDeleteRoom = async (id: string) => {
      await dbService.deleteRoom(id);
      setRooms(prev => prev.filter(r => r.id !== id));
      setShowRoomModal(false);
      setEditingRoom(null);
      addToast('Room Deleted', 'info');
  };

  const handleArchiveBatch = async (id: string) => {
      await dbService.archiveBatch(id);
      setBatches(prev => prev.map(b => b.id === id ? { ...b, isActive: false } : b));
      addToast('Batch Archived', 'info');
      setSelectedBatch(null);
  };

  const handleUpdateBatch = async (updatedBatch: PlantBatch) => {
      await dbService.saveBatch(updatedBatch);
      setBatches(prev => prev.map(b => b.id === updatedBatch.id ? updatedBatch : b));
      setSelectedBatch(updatedBatch); // Update the modal view
      addToast('Batch Details Updated', 'success');
  };

  // --- Voice Agent Handler ---
  const handleVoiceCommand = async (cmd: VoiceCommandResponse) => {
      setShowVoiceModal(false);
      switch(cmd.intent) {
          case 'NAVIGATE':
              if (cmd.targetView) setView(cmd.targetView as any);
              break;
          case 'LOG':
              if (cmd.logProposal) {
                  await handleLogProposal(cmd.logProposal);
              }
              break;
          case 'QUERY':
              if (cmd.queryText) {
                  // Route to Chat with pre-filled text or auto-send logic could be implemented
                  setView('chat');
                  // In a fuller implementation, we would inject the message into the chat flow
                  addToast("Opening Chat for Query...", "info");
              }
              break;
          default:
              addToast("Command Not Understood", "error");
      }
  };

  const activeBatches = useMemo(() => batches.filter(b => b.isActive !== false), [batches]);
  const activeMetrics = useMemo(() => rooms[0]?.metrics || MOCK_ROOMS[0].metrics, [rooms]);

  return {
    state: {
      view, rooms, batches, logs, setup, briefing, toasts, isProcessing,
      selectedBatch, analysisResult, showImportModal, showBackupModal, arPreferences,
      activeMetrics, showRoomModal, editingRoom, showVoiceModal, activeBatches
    },
    actions: {
      setView,
      addToast,
      setSetup,
      setSelectedBatch,
      setAnalysisResult,
      setShowImportModal,
      setShowBackupModal,
      setArPreferences,
      updateArPreferences,
      handleManualCapture,
      handleLogSave,
      handleLogUpdate,
      handleLogDelete,
      handleLogProposal,
      handleArSnapshot,
      handleVeoSimulation,
      handleImportComplete,
      playAudioBriefing,
      // Room Actions
      setShowRoomModal,
      setEditingRoom,
      handleSaveRoom,
      handleDeleteRoom,
      handleArchiveBatch,
      handleUpdateBatch,
      // Voice
      setShowVoiceModal,
      handleVoiceCommand
    }
  };
};
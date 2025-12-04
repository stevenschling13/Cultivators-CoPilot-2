
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useServices } from '../contexts/ServiceContext';
import { ImageUtils } from '../services/imageUtils';
import { LocalIntelligence } from '../services/localIntelligence'; // Import Local Logic
import { Haptic } from '../utils/haptics';
import { generateUUID } from '../utils/uuid';
import { 
  Room, PlantBatch, GrowLog, GrowSetup, FacilityBriefing, ToastMsg, 
  AiDiagnosis, LogProposal, ArPreferences, VoiceCommandResponse,
  ArOverlayData
} from '../types';
import { DEFAULT_GROW_SETUP, MOCK_ROOMS } from '../constants';
import { useGrowLogs } from './useGrowLogs';
import { useRooms } from './useRooms';
import { useBatches } from './useBatches';
import { useModalController } from './useModalController';

export const useAppController = () => {
  const { dbService, geminiService, hardwareService, errorService } = useServices();

  // --- Domain Hooks ---
  const { 
    logs, isLoadingLogs, hasMoreLogs, loadMoreLogs, addLog, updateLog, deleteLog, setLogs 
  } = useGrowLogs();
  
  const { 
    rooms, saveRoom, deleteRoom, subscribeToHardware, setRooms 
  } = useRooms();
  
  const { 
    batches, activeBatches, updateBatch, archiveBatch, setBatches 
  } = useBatches();

  // --- Modal Controller ---
  const {
    modalState, closeModal, openBatchWizard, openRoomModal, 
    openBatchDetail, openAnalysis, openImport, openBackup, openVoice, openWatering
  } = useModalController();

  // --- UI State ---
  const [view, setView] = useState<'dashboard' | 'camera' | 'settings' | 'chat' | 'research'>('dashboard');
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [setup, setSetup] = useState<GrowSetup>(DEFAULT_GROW_SETUP);
  
  // OPTIMIZATION: Initialize state with null, but fill instantly in useEffect
  const [briefing, setBriefing] = useState<FacilityBriefing | null>(null);
  
  // Preferences
  const [arPreferences, setArPreferences] = useState<ArPreferences>(
      DEFAULT_GROW_SETUP.arPreferences || { showColaCount: true, showBiomass: true, showHealth: true }
  );

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = generateUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // --- Initialization ---
  useEffect(() => {
    const init = async () => {
      errorService.init((msg, type) => addToast(msg, type));
      
      try {
        // 1. Load Critical Data (Parallel)
        const [loadedBatches, loadedRooms, loadedSettings] = await Promise.all([
            dbService.getBatches().catch(() => []),
            dbService.getRooms().catch(() => []),
            dbService.getSettings().catch(() => DEFAULT_GROW_SETUP)
        ]);

        // 2. Hydrate State
        if (loadedBatches.length > 0) setBatches(loadedBatches);
        if (loadedRooms.length > 0) setRooms(loadedRooms);
        if (loadedSettings) {
            setSetup(loadedSettings);
            if (loadedSettings.arPreferences) setArPreferences(loadedSettings.arPreferences);
            hardwareService.setNotificationsEnabled(loadedSettings.vpdNotifications ?? true);
        }

        // 3. INSTANT BRIEFING (Deterministic)
        // Generate immediately from loaded data so user sees Dashboard instantly
        const instantBriefing = LocalIntelligence.generateBriefing(
            loadedRooms.length > 0 ? loadedRooms : MOCK_ROOMS, 
            loadedBatches, 
            [] // Logs not needed for instant check
        );
        setBriefing(instantBriefing);

        // 4. Background Processes (Non-Blocking)
        
        // A: Hardware Scan
        hardwareService.scanForDevices().then(devices => {
             devices.forEach(d => hardwareService.connectToDevice(d.id));
        });

        // B: Load Logs & Enhance Briefing with AI
        loadMoreLogs(true).then(async () => {
            const initialLogs = await dbService.getLogsPaginated(undefined, 20).catch(() => []);
            const contextRooms = loadedRooms.length > 0 ? loadedRooms : MOCK_ROOMS;
            
            // Only call AI if we have meaningful data to analyze
            if (initialLogs.length > 0) {
                try {
                    // Silent upgrade: AI briefing replaces local one when ready
                    const aiBriefing = await geminiService.generateFacilityBriefing(contextRooms, initialLogs);
                    setBriefing(aiBriefing);
                } catch (e) {
                    console.warn("AI Briefing failed, keeping local version", e);
                }
            }
        });

      } catch (e) {
        errorService.captureError(e as Error, { severity: 'CRITICAL', metadata: { phase: 'AppInit' } });
      }
    };

    init();
    
    return () => {
        hardwareService.disconnect();
    };
  }, []);

  // --- Hardware Subscription ---
  useEffect(() => {
     const unsub = subscribeToHardware(setup.leafTempOffset ?? -2);
     return () => unsub();
  }, [setup.leafTempOffset, subscribeToHardware]);


  // --- Action Handlers ---

  const handleManualCapture = useCallback(async (file: File) => {
    setIsProcessing(true);
    setView('dashboard');
    try {
      const processed = await ImageUtils.processImage(file);
      const diagnosis = await geminiService.analyzePlantImage(processed.full);
      const newLog: GrowLog = {
        id: generateUUID(),
        plantBatchId: batches[0]?.id, 
        timestamp: Date.now(),
        thumbnailUrl: processed.thumbnail,
        imageUrl: processed.full,
        actionType: 'Observation',
        aiDiagnosis: diagnosis,
        manualNotes: diagnosis.morphologyNotes
      };
      openAnalysis(diagnosis, newLog);
    } catch (e) {
      addToast('Analysis Failed', 'error');
      errorService.captureError(e as Error, { severity: 'HIGH', metadata: { context: 'ManualCapture' } });
    } finally {
      setIsProcessing(false);
    }
  }, [batches, geminiService, openAnalysis, addToast]);

  const handleLogSave = useCallback(async (log: GrowLog) => {
    await addLog(log);
    addToast('Entry Logged', 'success');
    Haptic.success();
  }, [addLog, addToast]);

  const handleLogProposal = useCallback(async (proposal: LogProposal) => {
    const newLog: GrowLog = {
      id: generateUUID(),
      plantBatchId: batches[0]?.id,
      timestamp: Date.now(),
      actionType: proposal.actionType,
      manualNotes: proposal.manualNotes,
      wateringData: proposal.wateringData,
      aiDiagnosis: {
         healthScore: proposal.healthScore || 0,
         detectedPests: proposal.detectedPests || [],
         nutrientDeficiencies: proposal.nutrientDeficiencies || [],
         morphologyNotes: proposal.manualNotes,
         recommendations: proposal.recommendations || [],
         progressionAnalysis: 'Pending Analysis'
      }
    };
    await handleLogSave(newLog);
  }, [batches, handleLogSave]);

  const handleArSnapshot = useCallback(async (data: ArOverlayData) => {
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
  }, [handleLogProposal, addToast]);

  const handleVeoSimulation = useCallback(async (imgUrl: string): Promise<string> => {
      try {
        addToast("Generating Growth Simulation...", "info");
        const playbackUrl = await geminiService.generateGrowthSimulation(imgUrl);
        const log = logs.find(l => l.imageUrl === imgUrl);
        if (log) {
            const updated = { ...log, videoUrl: playbackUrl };
            await updateLog(updated);
        }
        addToast("Simulation Complete", "success");
        return playbackUrl;
      } catch (e) {
          addToast("Simulation Failed", "error");
          console.error(e);
          throw e;
      }
  }, [geminiService, logs, updateLog, addToast]);
  
  const handleImportComplete = useCallback(async () => {
     await loadMoreLogs(true);
     closeModal();
     addToast("Import Complete", "success");
  }, [loadMoreLogs, closeModal, addToast]);

  const updateArPreferences = useCallback((prefs: ArPreferences) => {
     setArPreferences(prefs);
     const newSetup = { ...setup, arPreferences: prefs };
     setSetup(newSetup);
     dbService.saveSettings(newSetup);
  }, [setup]);

  const handleVoiceCommand = useCallback(async (cmd: VoiceCommandResponse) => {
      closeModal();
      switch(cmd.intent) {
          case 'NAVIGATE':
              if (cmd.targetView) setView(cmd.targetView as any);
              break;
          case 'LOG':
              if (cmd.logProposal) await handleLogProposal(cmd.logProposal);
              break;
          case 'QUERY':
              if (cmd.queryText) {
                  setView('chat');
                  addToast("Opening Chat for Query...", "info");
              }
              break;
          default:
              addToast("Command Not Understood", "error");
      }
  }, [closeModal, handleLogProposal, addToast]);

  const playAudioBriefing = useCallback(async (text: string) => {
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
  }, [geminiService, addToast]);

  const setAnalysisResult = useCallback((res: { result: AiDiagnosis, log: GrowLog } | null) => {
      if (!res) closeModal(); 
      else openAnalysis(res.result, res.log);
  }, [closeModal, openAnalysis]);

  const activeMetrics = useMemo(() => rooms[0]?.metrics || MOCK_ROOMS[0].metrics, [rooms]);

  // Memoize state and actions to prevent re-renders in children
  const state = useMemo(() => ({
      view, rooms, batches, logs, setup, briefing, toasts, isProcessing,
      isLoadingLogs, hasMoreLogs, arPreferences, activeMetrics, activeBatches,
      modalState 
  }), [view, rooms, batches, logs, setup, briefing, toasts, isProcessing, isLoadingLogs, hasMoreLogs, arPreferences, activeMetrics, activeBatches, modalState]);

  const actions = useMemo(() => ({
      setView, addToast, setSetup, 
      setArPreferences, updateArPreferences,
      handleManualCapture, handleLogSave, handleLogUpdate: updateLog, handleLogDelete: deleteLog,
      handleLogProposal, handleArSnapshot, handleVeoSimulation, handleImportComplete,
      playAudioBriefing,
      handleSaveRoom: saveRoom, handleDeleteRoom: deleteRoom,
      handleArchiveBatch: archiveBatch, handleUpdateBatch: updateBatch,
      handleVoiceCommand, loadMoreLogs,
      closeModal, openBatchWizard, openRoomModal, openBatchDetail, 
      openAnalysis, openImport, openBackup, openVoice,
      openWatering,
      setAnalysisResult
  }), [addToast, updateArPreferences, handleManualCapture, handleLogSave, updateLog, deleteLog, handleLogProposal, handleArSnapshot, handleVeoSimulation, handleImportComplete, playAudioBriefing, saveRoom, deleteRoom, archiveBatch, updateBatch, handleVoiceCommand, loadMoreLogs, closeModal, openBatchWizard, openRoomModal, openBatchDetail, openAnalysis, openImport, openBackup, openVoice, openWatering, setAnalysisResult]);

  return { state, actions };
};

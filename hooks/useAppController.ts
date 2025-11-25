
import { useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { useServices } from '../contexts/ServiceContext';
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

interface AppState {
  view: 'dashboard' | 'camera' | 'settings' | 'chat' | 'research';
  rooms: Room[];
  batches: PlantBatch[];
  logs: GrowLog[];
  setup: GrowSetup;
  briefing: FacilityBriefing | null;
  toasts: ToastMsg[];
  isProcessing: boolean;
  isLoadingLogs: boolean;
  hasMoreLogs: boolean;
  lastLogTimestamp?: number;
  selectedBatch: PlantBatch | null;
  analysisResult: { result: AiDiagnosis, log: GrowLog } | null;
  showImportModal: boolean;
  showBackupModal: 'backup' | 'restore' | null;
  showRoomModal: boolean;
  editingRoom: Room | null;
  showVoiceModal: boolean;
  arPreferences: ArPreferences;
}

const initialState: AppState = {
  view: 'dashboard',
  rooms: MOCK_ROOMS,
  batches: MOCK_BATCHES,
  logs: [],
  setup: DEFAULT_GROW_SETUP,
  briefing: null,
  toasts: [],
  isProcessing: false,
  isLoadingLogs: false,
  hasMoreLogs: true,
  lastLogTimestamp: undefined,
  selectedBatch: null,
  analysisResult: null,
  showImportModal: false,
  showBackupModal: null,
  showRoomModal: false,
  editingRoom: null,
  showVoiceModal: false,
  arPreferences: DEFAULT_GROW_SETUP.arPreferences || { showColaCount: true, showBiomass: true, showHealth: true }
};

type Action = 
  | { type: 'SET_VIEW'; payload: AppState['view'] }
  | { type: 'ADD_TOAST'; payload: ToastMsg }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'SET_SETUP'; payload: GrowSetup }
  | { type: 'SET_ROOMS'; payload: Room[] }
  | { type: 'UPDATE_ROOM'; payload: Room }
  | { type: 'DELETE_ROOM'; payload: string }
  | { type: 'SET_BATCHES'; payload: PlantBatch[] }
  | { type: 'UPDATE_BATCH'; payload: PlantBatch }
  | { type: 'SET_LOGS'; payload: GrowLog[] }
  | { type: 'APPEND_LOGS'; payload: { logs: GrowLog[]; hasMore: boolean; lastTimestamp?: number } }
  | { type: 'ADD_LOG'; payload: GrowLog }
  | { type: 'UPDATE_LOG'; payload: GrowLog }
  | { type: 'DELETE_LOG'; payload: string }
  | { type: 'SET_BRIEFING'; payload: FacilityBriefing }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_LOADING_LOGS'; payload: boolean }
  | { type: 'SET_SELECTED_BATCH'; payload: PlantBatch | null }
  | { type: 'SET_ANALYSIS_RESULT'; payload: { result: AiDiagnosis, log: GrowLog } | null }
  | { type: 'SET_SHOW_IMPORT'; payload: boolean }
  | { type: 'SET_SHOW_BACKUP'; payload: 'backup' | 'restore' | null }
  | { type: 'SET_SHOW_ROOM_MODAL'; payload: boolean }
  | { type: 'SET_EDITING_ROOM'; payload: Room | null }
  | { type: 'SET_SHOW_VOICE'; payload: boolean }
  | { type: 'SET_AR_PREFS'; payload: ArPreferences };

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW': return { ...state, view: action.payload };
    case 'ADD_TOAST': return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST': return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    case 'SET_SETUP': return { ...state, setup: action.payload };
    case 'SET_ROOMS': return { ...state, rooms: action.payload };
    case 'UPDATE_ROOM': {
        const idx = state.rooms.findIndex(r => r.id === action.payload.id);
        const newRooms = [...state.rooms];
        if (idx >= 0) newRooms[idx] = action.payload;
        else newRooms.push(action.payload);
        return { ...state, rooms: newRooms };
    }
    case 'DELETE_ROOM': return { ...state, rooms: state.rooms.filter(r => r.id !== action.payload) };
    case 'SET_BATCHES': return { ...state, batches: action.payload };
    case 'UPDATE_BATCH': return { ...state, batches: state.batches.map(b => b.id === action.payload.id ? action.payload : b) };
    case 'SET_LOGS': return { 
        ...state, 
        logs: action.payload,
        hasMoreLogs: true, 
        lastLogTimestamp: action.payload.length > 0 ? action.payload[action.payload.length - 1].timestamp : undefined
    };
    case 'APPEND_LOGS': return {
        ...state,
        logs: [...state.logs, ...action.payload.logs],
        hasMoreLogs: action.payload.hasMore,
        lastLogTimestamp: action.payload.lastTimestamp
    };
    case 'ADD_LOG': return { ...state, logs: [action.payload, ...state.logs] };
    case 'UPDATE_LOG': return { ...state, logs: state.logs.map(l => l.id === action.payload.id ? action.payload : l) };
    case 'DELETE_LOG': return { ...state, logs: state.logs.filter(l => l.id !== action.payload) };
    case 'SET_BRIEFING': return { ...state, briefing: action.payload };
    case 'SET_PROCESSING': return { ...state, isProcessing: action.payload };
    case 'SET_LOADING_LOGS': return { ...state, isLoadingLogs: action.payload };
    case 'SET_SELECTED_BATCH': return { ...state, selectedBatch: action.payload };
    case 'SET_ANALYSIS_RESULT': return { ...state, analysisResult: action.payload };
    case 'SET_SHOW_IMPORT': return { ...state, showImportModal: action.payload };
    case 'SET_SHOW_BACKUP': return { ...state, showBackupModal: action.payload };
    case 'SET_SHOW_ROOM_MODAL': return { ...state, showRoomModal: action.payload };
    case 'SET_EDITING_ROOM': return { ...state, editingRoom: action.payload };
    case 'SET_SHOW_VOICE': return { ...state, showVoiceModal: action.payload };
    case 'SET_AR_PREFS': return { ...state, arPreferences: action.payload };
    default: return state;
  }
}

export const useAppController = () => {
  const { dbService, geminiService, hardwareService, errorService } = useServices();
  const [state, dispatch] = useReducer(appReducer, initialState);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = generateUUID();
    dispatch({ type: 'ADD_TOAST', payload: { id, message, type } });
    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: id });
    }, 4000);
  }, []);

  const DEFAULT_BRIEFING: FacilityBriefing = {
      status: 'OPTIMAL',
      summary: 'System initialized. Monitoring active.',
      actionItems: [],
      timestamp: Date.now()
  };

  const refreshBriefing = useCallback(async (currentRooms: Room[], currentLogs: GrowLog[]) => {
    try {
        // 8-second timeout protection to prevent infinite loading skeleton
        const timeout = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Briefing generation timed out")), 8000)
        );

        const newBriefing = await Promise.race([
            geminiService.generateFacilityBriefing(currentRooms, currentLogs),
            timeout
        ]) as FacilityBriefing;

        dispatch({ type: 'SET_BRIEFING', payload: newBriefing });
    } catch (e) {
        console.warn("Briefing refresh failed or timed out", e);
        // Fallback: Use existing or default to ensure UI loads
        dispatch({ 
            type: 'SET_BRIEFING', 
            payload: DEFAULT_BRIEFING
        });
    }
  }, [geminiService]);

  const loadMoreLogs = useCallback(async (reset = false) => {
    if (!reset && (state.isLoadingLogs || !state.hasMoreLogs)) return;
    dispatch({ type: 'SET_LOADING_LOGS', payload: true });
    try {
      const timestampCursor = reset ? undefined : state.lastLogTimestamp;
      const limit = 20;
      const newLogs = await dbService.getLogsPaginated(undefined, limit, timestampCursor);
      if (reset) {
         dispatch({ type: 'SET_LOGS', payload: newLogs });
      } else {
         dispatch({ 
             type: 'APPEND_LOGS', 
             payload: { 
                 logs: newLogs, 
                 hasMore: newLogs.length >= limit,
                 lastTimestamp: newLogs.length > 0 ? newLogs[newLogs.length - 1].timestamp : state.lastLogTimestamp
             } 
         });
      }
    } catch (e) {
      console.error("Failed to load logs", e);
    } finally {
      dispatch({ type: 'SET_LOADING_LOGS', payload: false });
    }
  }, [dbService, state.isLoadingLogs, state.hasMoreLogs, state.lastLogTimestamp]);

  useEffect(() => {
    const init = async () => {
      errorService.init((msg, type) => addToast(msg, type));
      
      try {
        const [loadedBatches, loadedSettings, loadedRooms] = await Promise.all([
          dbService.getBatches().catch(() => []),
          dbService.getSettings().catch(() => DEFAULT_GROW_SETUP),
          dbService.getRooms().catch(() => [])
        ]);

        if (loadedBatches.length > 0) dispatch({ type: 'SET_BATCHES', payload: loadedBatches });
        if (loadedRooms.length > 0) dispatch({ type: 'SET_ROOMS', payload: loadedRooms });
        if (loadedSettings) {
            dispatch({ type: 'SET_SETUP', payload: loadedSettings });
            if (loadedSettings.arPreferences) dispatch({ type: 'SET_AR_PREFS', payload: loadedSettings.arPreferences });
        }

        hardwareService.setNotificationsEnabled(loadedSettings?.vpdNotifications ?? true);
        const devices = await hardwareService.scanForDevices();
        devices.forEach(d => hardwareService.connectToDevice(d.id));

        await loadMoreLogs(true);
        
        const initialLogs = await dbService.getLogsPaginated(undefined, 20).catch(() => []);
        const contextRooms = loadedRooms.length > 0 ? loadedRooms : MOCK_ROOMS;
        
        refreshBriefing(contextRooms, initialLogs);

      } catch (e) {
        errorService.captureError(e as Error, { severity: 'CRITICAL', metadata: { phase: 'AppInit' } });
        // Ensure UI doesn't hang on skeleton if init fails
        dispatch({ type: 'SET_BRIEFING', payload: DEFAULT_BRIEFING });
      }
    };

    init();
    
    return () => {
        hardwareService.disconnect();
    };
  }, []);

  const roomsRef = useRef(state.rooms);
  useEffect(() => { roomsRef.current = state.rooms; }, [state.rooms]);
  const setupRef = useRef(state.setup);
  useEffect(() => { setupRef.current = state.setup; }, [state.setup]);

  useEffect(() => {
     const unsub = hardwareService.onReading((deviceId, reading) => {
        const currentRooms = roomsRef.current;
        const targetRoom = currentRooms.find(r => r.sensorId === deviceId);
        if (targetRoom) {
            const settings = setupRef.current;
            const leafOffset = settings.leafTempOffset ?? -2;
            const metrics = EnvironmentService.processReading(reading, leafOffset);
            let status: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL';
            if (metrics.vpdStatus === VpdZone.DANGER) status = 'CRITICAL';
            else if (metrics.vpdStatus === VpdZone.LEECHING) status = 'WARNING';
            const newHistory = [...targetRoom.metrics.history, metrics.vpd].slice(-20);
            const updatedRoom: Room = {
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
            dispatch({ type: 'UPDATE_ROOM', payload: updatedRoom });
        }
     });
     return () => unsub();
  }, []);

  const handleManualCapture = async (file: File) => {
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
    try {
      const processed = await ImageUtils.processImage(file);
      const diagnosis = await geminiService.analyzePlantImage(processed.full);
      const newLog: GrowLog = {
        id: generateUUID(),
        plantBatchId: state.batches[0]?.id, 
        timestamp: Date.now(),
        thumbnailUrl: processed.thumbnail,
        imageUrl: processed.full,
        actionType: 'Observation',
        aiDiagnosis: diagnosis,
        manualNotes: diagnosis.morphologyNotes
      };
      dispatch({ type: 'SET_ANALYSIS_RESULT', payload: { result: diagnosis, log: newLog } });
    } catch (e) {
      addToast('Analysis Failed', 'error');
      errorService.captureError(e as Error, { severity: 'HIGH', metadata: { context: 'ManualCapture' } });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  };

  const handleLogSave = async (log: GrowLog) => {
    await dbService.saveLog(log);
    dispatch({ type: 'ADD_LOG', payload: log });
    dispatch({ type: 'SET_ANALYSIS_RESULT', payload: null });
    addToast('Entry Logged', 'success');
    Haptic.success();
  };

  const handleLogUpdate = async (updatedLog: GrowLog) => {
    await dbService.saveLog(updatedLog);
    dispatch({ type: 'UPDATE_LOG', payload: updatedLog });
    addToast('Entry Updated', 'success');
  };

  const handleLogDelete = async (id: string) => {
    await dbService.deleteLog(id);
    dispatch({ type: 'DELETE_LOG', payload: id });
    Haptic.tap();
  };

  const handleLogProposal = async (proposal: LogProposal) => {
    const newLog: GrowLog = {
      id: generateUUID(),
      plantBatchId: state.batches[0]?.id,
      timestamp: Date.now(),
      actionType: proposal.actionType,
      manualNotes: proposal.manualNotes,
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
  };

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
      dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
  };

  const handleVeoSimulation = async (imgUrl: string): Promise<string> => {
      try {
        addToast("Generating Growth Simulation...", "info");
        const playbackUrl = await geminiService.generateGrowthSimulation(imgUrl);
        const log = state.logs.find(l => l.imageUrl === imgUrl);
        if (log) {
            const updated = { ...log, videoUrl: playbackUrl };
            await dbService.saveLog(updated);
            dispatch({ type: 'UPDATE_LOG', payload: updated });
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
     await loadMoreLogs(true);
     dispatch({ type: 'SET_SHOW_IMPORT', payload: false });
     addToast("Import Complete", "success");
  };

  const updateArPreferences = (prefs: ArPreferences) => {
     dispatch({ type: 'SET_AR_PREFS', payload: prefs });
     const newSetup = { ...state.setup, arPreferences: prefs };
     dispatch({ type: 'SET_SETUP', payload: newSetup });
     dbService.saveSettings(newSetup);
  };

  const handleSaveRoom = async (room: Room) => {
      await dbService.saveRoom(room);
      dispatch({ type: 'UPDATE_ROOM', payload: room });
      if (room.sensorId) hardwareService.connectToDevice(room.sensorId);
      dispatch({ type: 'SET_SHOW_ROOM_MODAL', payload: false });
      dispatch({ type: 'SET_EDITING_ROOM', payload: null });
      addToast('Room Configuration Saved', 'success');
  };

  const handleDeleteRoom = async (id: string) => {
      await dbService.deleteRoom(id);
      dispatch({ type: 'DELETE_ROOM', payload: id });
      dispatch({ type: 'SET_SHOW_ROOM_MODAL', payload: false });
      dispatch({ type: 'SET_EDITING_ROOM', payload: null });
      addToast('Room Deleted', 'info');
  };

  const handleArchiveBatch = async (id: string) => {
      await dbService.archiveBatch(id);
      const batch = state.batches.find(b => b.id === id);
      if (batch) dispatch({ type: 'UPDATE_BATCH', payload: { ...batch, isActive: false } });
      addToast('Batch Archived', 'info');
      dispatch({ type: 'SET_SELECTED_BATCH', payload: null });
  };

  const handleUpdateBatch = async (updatedBatch: PlantBatch) => {
      await dbService.saveBatch(updatedBatch);
      dispatch({ type: 'UPDATE_BATCH', payload: updatedBatch });
      dispatch({ type: 'SET_SELECTED_BATCH', payload: updatedBatch });
      addToast('Batch Details Updated', 'success');
  };

  const handleVoiceCommand = async (cmd: VoiceCommandResponse) => {
      dispatch({ type: 'SET_SHOW_VOICE', payload: false });
      switch(cmd.intent) {
          case 'NAVIGATE':
              if (cmd.targetView) dispatch({ type: 'SET_VIEW', payload: cmd.targetView as any });
              break;
          case 'LOG':
              if (cmd.logProposal) await handleLogProposal(cmd.logProposal);
              break;
          case 'QUERY':
              if (cmd.queryText) {
                  dispatch({ type: 'SET_VIEW', payload: 'chat' });
                  addToast("Opening Chat for Query...", "info");
              }
              break;
          default:
              addToast("Command Not Understood", "error");
      }
  };

  const activeBatches = useMemo(() => state.batches.filter(b => b.isActive !== false), [state.batches]);
  const activeMetrics = useMemo(() => state.rooms[0]?.metrics || MOCK_ROOMS[0].metrics, [state.rooms]);

  return {
    state: { ...state, activeBatches, activeMetrics },
    actions: {
      setView: (v: AppState['view']) => dispatch({ type: 'SET_VIEW', payload: v }),
      addToast,
      setSetup: (s: GrowSetup) => dispatch({ type: 'SET_SETUP', payload: s }),
      setSelectedBatch: (b: PlantBatch | null) => dispatch({ type: 'SET_SELECTED_BATCH', payload: b }),
      setAnalysisResult: (r: any) => dispatch({ type: 'SET_ANALYSIS_RESULT', payload: r }),
      setShowImportModal: (v: boolean) => dispatch({ type: 'SET_SHOW_IMPORT', payload: v }),
      setShowBackupModal: (v: 'backup' | 'restore' | null) => dispatch({ type: 'SET_SHOW_BACKUP', payload: v }),
      setArPreferences: (p: ArPreferences) => dispatch({ type: 'SET_AR_PREFS', payload: p }),
      updateArPreferences,
      handleManualCapture,
      handleLogSave,
      handleLogUpdate,
      handleLogDelete,
      handleLogProposal,
      handleArSnapshot,
      handleVeoSimulation,
      handleImportComplete,
      playAudioBriefing: async (text: string) => {
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
      },
      setShowRoomModal: (v: boolean) => dispatch({ type: 'SET_SHOW_ROOM_MODAL', payload: v }),
      setEditingRoom: (r: Room | null) => dispatch({ type: 'SET_EDITING_ROOM', payload: r }),
      handleSaveRoom,
      handleDeleteRoom,
      handleArchiveBatch,
      handleUpdateBatch,
      setShowVoiceModal: (v: boolean) => dispatch({ type: 'SET_SHOW_VOICE', payload: v }),
      handleVoiceCommand,
      loadMoreLogs
    }
  };
};


import React, { Suspense, lazy, useCallback, useMemo, memo } from 'react';
import { Mic, ArrowLeft, FlaskConical } from 'lucide-react';
import { dbService } from './services/db';
import { useAppController } from './hooks/useAppController';
import { VpdZone, PlantBatch, Room, GrowSetup } from './types';

import { ToastContainer } from './components/ui/Toast';
import { ProcessingOverlay } from './components/ui/ProcessingOverlay';
import { ModalManager } from './components/modals/ModalManager';
import { SystemErrorBoundary } from './components/SystemErrorBoundary';

// Layout Components
import { AppLayout } from './components/layout/AppLayout';
import { BottomNav } from './components/layout/BottomNav';
import { Header } from './components/layout/Header';

// Critical Views - Eager Load for Instant Dashboard
import { DashboardView } from './components/DashboardView';

// Lazy Load Secondary Views with Memoization to prevent parent-induced re-renders
const SettingsView = memo(lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView }))));
const CameraView = lazy(() => import('./components/CameraView').then(m => ({ default: m.CameraView })));

// Wrap Lazy Chat in Memo to enforce prop stability checks before entering Suspense/Render cycle.
const ChatInterface = memo(lazy(() => import('./components/ChatInterface').then(m => ({ default: m.ChatInterface }))));

const ResearchView = lazy(() => import('./components/ResearchView').then(m => ({ default: m.ResearchView })));

const ViewLoader = () => (
  <div className="flex flex-col items-center justify-center h-[50vh] animate-pulse">
    <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin mb-4"></div>
    <span className="text-xs font-mono text-neon-green uppercase tracking-widest">Loading Module...</span>
  </div>
);

export const App = () => {
  const { state, actions } = useAppController();
  const { 
    view, rooms, batches, logs, setup, briefing, toasts, isProcessing,
    arPreferences, activeMetrics, modalState
  } = state;

  // --- Stable Callbacks for Dashboard ---
  // Using useCallback ensures these functions maintain referential equality
  // preventing DashboardView (which is memoized) from re-rendering unless necessary.
  const handleBackup = useCallback(() => actions.openBackup('backup'), [actions]);
  const handleCameraView = useCallback(() => actions.setView('camera'), [actions]);
  const handleAddRoom = useCallback(() => actions.openRoomModal(null), [actions]);
  const handleDashboardNavigate = useCallback(() => actions.setView('dashboard'), [actions]);
  const handleRestore = useCallback(() => actions.openBackup('restore'), [actions]);
  const handleImport = useCallback(() => actions.openImport(), [actions]);
  const handleAddBatch = useCallback(() => actions.openBatchWizard(), [actions]);
  
  // Explicitly stabilize action references for DashboardView with strict typing
  const handleSelectBatch = useCallback((b: PlantBatch) => actions.openBatchDetail(b), [actions]);
  const handleEditRoom = useCallback((r: Room) => actions.openRoomModal(r), [actions]);
  const handleVoiceCommand = useCallback(() => actions.openVoice(), [actions]);
  const handleLogWater = useCallback((tag: string) => actions.openWatering(tag), [actions]);
  
  // --- Stable Callbacks for Settings ---
  const handleUpdateSetup = useCallback((newSetup: GrowSetup) => actions.setSetup(newSetup), [actions]);
  const handleSaveConfig = useCallback(() => { 
      dbService.saveSettings(setup); 
      actions.addToast("Settings Saved", "success"); 
  }, [actions, setup]);

  // --- Stable Data for Chat (Noise Filtered) ---
  // Pre-calculate stable primitives to prevent useMemo from re-running on micro-fluctuations (e.g. 72.11 vs 72.12)
  // This effectively "quantizes" the high-frequency sensor data for the UI.
  const stableTemp = Number(activeMetrics.temp.toFixed(1));
  const stableRh = Math.round(activeMetrics.rh);
  const stableCo2 = Math.round(activeMetrics.co2);
  const stableVpd = Number(activeMetrics.vpd.toFixed(2));

  // These objects will strictly maintain referential equality as long as the *displayed* values don't change.
  const chatEnv = useMemo(() => ({
      temperature: stableTemp,
      humidity: stableRh,
      co2: stableCo2,
      ppfd: 0,
      timestamp: Date.now() // ChatInterface memo ignores this field, but we keep it for types
  }), [stableTemp, stableRh, stableCo2]);

  const chatMetrics = useMemo(() => ({
      vpd: stableVpd,
      dli: 0,
      vpdStatus: VpdZone.TRANSPIRATION
  }), [stableVpd]);

  // Centralized Header Logic
  const renderHeader = () => {
    switch (view) {
      case 'dashboard':
        return (
          <Header 
            title="COMMAND CENTER"
            subtitle={
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse shadow-[0_0_8px_#00ffa3]"></span>
                Gemini 3 Pro Active
              </div>
            }
            rightAction={
              <button 
                onClick={handleVoiceCommand}
                className="relative group p-3 bg-[#111] rounded-full border border-white/10 hover:border-neon-green/50 transition-all active:scale-95 shadow-lg"
              >
                <Mic className="w-5 h-5 text-white group-hover:text-neon-green transition-colors" />
              </button>
            }
          />
        );
      case 'settings':
        return (
          <Header 
            title="SYSTEM CONFIG"
            subtitle="Global Preferences & Hardware"
            leftAction={
              <button onClick={handleDashboardNavigate} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            }
          />
        );
      case 'research':
        return (
          <Header 
            title="RESEARCH LAB"
            subtitle="Genetic Performance & Pathology"
            leftAction={
               <div className="p-2 bg-neon-blue/10 rounded-lg">
                  <FlaskConical className="w-5 h-5 text-neon-blue" />
               </div>
            }
          />
        );
      case 'camera': // Fullscreen views handle their own UI
      case 'chat':
        return null;
      default:
        return null;
    }
  };

  return (
    <AppLayout 
      header={renderHeader()}
      bottomNav={view !== 'camera' ? <BottomNav currentView={view} onNavigate={actions.setView} /> : null}
    >
      {/* Global GPU-Accelerated Filters */}
      <svg className="absolute w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <defs>
          {/* Chlorophyll Map: Isolates Green, suppresses Red/Blue to highlight biomass density */}
          <filter id="chlorophyll">
            <feColorMatrix 
              type="matrix" 
              values="0 0 0 0 0
                      0 1.2 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0" 
            />
            <feComponentTransfer>
               <feFuncG type="gamma" exponent="0.5" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      <ToastContainer toasts={toasts} removeToast={(id) => actions.addToast("Dismissed", "info")} />
      <ProcessingOverlay isProcessing={isProcessing} />

      <ModalManager 
         modalState={modalState}
         actions={actions}
         data={{
             logs,
             batches,
             hasMoreLogs: state.hasMoreLogs,
             isLoadingLogs: state.isLoadingLogs
         }}
      />

      {/* Main View Router */}
      <SystemErrorBoundary>
        <Suspense fallback={<ViewLoader />}>
          {view === 'dashboard' && (
            <DashboardView 
              briefing={briefing}
              rooms={rooms}
              batches={batches}
              logs={logs}
              onBackup={handleBackup}
              onImport={handleImport}
              onCamera={handleCameraView}
              onSelectBatch={handleSelectBatch}
              onAddBatch={handleAddBatch}
              onAddRoom={handleAddRoom}
              onEditRoom={handleEditRoom}
              onVoiceCommand={handleVoiceCommand}
              onLogWater={handleLogWater}
            />
          )}

          {view === 'settings' && (
            <SettingsView 
              setup={setup}
              onUpdateSetup={handleUpdateSetup}
              onBack={handleDashboardNavigate}
              onRestore={handleRestore}
              onSaveConfig={handleSaveConfig}
            />
          )}

          {view === 'camera' && (
            <CameraView 
              onCapture={actions.handleManualCapture}
              onCancel={handleDashboardNavigate}
              arPreferences={arPreferences}
              onUpdatePreferences={actions.updateArPreferences}
              activeMetrics={rooms[0]?.metrics} // Pass live metrics to AR HUD
              onSaveArData={actions.handleArSnapshot}
            />
          )}

          {view === 'chat' && (
             <ChatInterface 
               context={setup}
               batches={batches}
               logs={logs}
               envReading={chatEnv}
               metrics={chatMetrics}
               onLogProposal={actions.handleLogProposal}
               onOpenCamera={handleCameraView}
             />
          )}

          {view === 'research' && (
             <ResearchView 
               logs={logs}
               batches={batches}
             />
          )}
        </Suspense>
      </SystemErrorBoundary>
    </AppLayout>
  );
};

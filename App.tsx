
import React, { Suspense, lazy, useState } from 'react';
import { Mic, ArrowLeft, FlaskConical } from 'lucide-react';
import { dbService } from './services/db';
import { BackupService } from './services/backupService';
import { useAppController } from './hooks/useAppController';
import { VpdZone } from './types';

import { ToastContainer } from './components/ui/Toast';
import { ProcessingOverlay } from './components/ui/ProcessingOverlay';
import { BatchDetailModal } from './components/modals/BatchDetailModal';
import { AnalysisResultModal } from './components/modals/AnalysisResultModal';
import { LegacyImportModal } from './components/modals/LegacyImportModal';
import { BackupModal } from './components/modals/BackupModal';
import { BatchWizardModal } from './components/modals/BatchWizardModal';
import { RoomEditModal } from './components/modals/RoomEditModal';
import { VoiceCommandModal } from './components/modals/VoiceCommandModal';
import { SystemErrorBoundary } from './components/SystemErrorBoundary';

// Layout Components
import { AppLayout } from './components/layout/AppLayout';
import { BottomNav } from './components/layout/BottomNav';
import { Header } from './components/layout/Header';

// Lazy Load All Views for Consistent Bundle Splitting
const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const CameraView = lazy(() => import('./components/CameraView').then(m => ({ default: m.CameraView })));
const ChatInterface = lazy(() => import('./components/ChatInterface').then(m => ({ default: m.ChatInterface })));
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
    selectedBatch, analysisResult, showImportModal, showBackupModal, arPreferences, activeMetrics,
    showRoomModal, editingRoom, showVoiceModal
  } = state;

  const [showBatchWizard, setShowBatchWizard] = useState(false);

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
                onClick={() => actions.setShowVoiceModal(true)}
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
              <button onClick={() => actions.setView('dashboard')} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
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
      <ToastContainer toasts={toasts} removeToast={actions.removeToast} />
      <ProcessingOverlay isProcessing={isProcessing} />

      {/* Modals */}
      {showVoiceModal && (
          <VoiceCommandModal 
              onClose={() => actions.setShowVoiceModal(false)}
              onCommandProcessed={actions.handleVoiceCommand}
          />
      )}

      {showBatchWizard && (
        <BatchWizardModal 
          onClose={() => setShowBatchWizard(false)} 
          onBatchCreated={() => {
             window.location.reload(); 
          }}
        />
      )}

      {showRoomModal && (
        <RoomEditModal 
            room={editingRoom}
            batches={batches}
            onSave={actions.handleSaveRoom}
            onDelete={actions.handleDeleteRoom}
            onClose={() => { actions.setEditingRoom(null); actions.setShowRoomModal(false); }}
        />
      )}

      {selectedBatch && (
        <BatchDetailModal 
          batch={selectedBatch} 
          onClose={() => actions.setSelectedBatch(null)} 
          logs={logs.filter(l => l.plantBatchId === selectedBatch.id)}
          onDeleteLog={actions.handleLogDelete}
          onUpdateLog={actions.handleLogUpdate}
          onLoadMore={() => actions.loadMoreLogs()}
          hasMore={state.hasMoreLogs}
          isLoading={state.isLoadingLogs}
        />
      )}

      {analysisResult && (
        <AnalysisResultModal 
          result={analysisResult.result}
          log={analysisResult.log}
          onSave={() => actions.handleLogSave(analysisResult.log)}
          onDiscard={() => actions.setAnalysisResult(null)}
          onSimulate={actions.handleVeoSimulation}
        />
      )}

      {showImportModal && (
        <LegacyImportModal 
          onClose={() => actions.setShowImportModal(false)} 
          onImportComplete={actions.handleImportComplete} 
        />
      )}

      {showBackupModal && (
        <BackupModal 
           mode={showBackupModal}
           onClose={() => actions.setShowBackupModal(null)}
           onConfirm={async (pw, file) => {
              if (showBackupModal === 'backup') {
                 await BackupService.createEncryptedBackup(pw);
                 return true;
              } else if (file) {
                 const success = await BackupService.restoreFromBackup(file, pw);
                 if (success) window.location.reload();
                 return success;
              }
              return false;
           }}
        />
      )}

      {/* Main View Router */}
      <SystemErrorBoundary>
        <Suspense fallback={<ViewLoader />}>
          {view === 'dashboard' && (
            <DashboardView 
              briefing={briefing}
              rooms={rooms}
              batches={batches}
              onBackup={() => actions.setShowBackupModal('backup')}
              onImport={() => actions.setShowImportModal(true)}
              onSelectBatch={(b) => actions.setSelectedBatch(b)}
              onAddBatch={() => setShowBatchWizard(true)}
              onAddRoom={() => actions.setShowRoomModal(true)}
              onEditRoom={(r) => { actions.setEditingRoom(r); actions.setShowRoomModal(true); }}
              onVoiceCommand={() => actions.setShowVoiceModal(true)}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              setup={setup}
              onUpdateSetup={actions.setSetup}
              onRestore={() => actions.setShowBackupModal('restore')}
              onSaveConfig={() => {
                  dbService.saveSettings(setup);
                  actions.addToast("Settings Saved", "success");
              }}
            />
          )}

          {view === 'camera' && (
            <CameraView 
              onCapture={actions.handleManualCapture} 
              onCancel={() => actions.setView('dashboard')}
              arPreferences={arPreferences}
              onUpdatePreferences={actions.updateArPreferences}
              activeMetrics={activeMetrics}
              onSaveArData={actions.handleArSnapshot}
            />
          )}

          {view === 'chat' && (
            <ChatInterface 
              context={setup}
              batches={batches}
              logs={logs}
              envReading={{
                  temperature: activeMetrics.temp,
                  humidity: activeMetrics.rh,
                  co2: activeMetrics.co2,
                  ppfd: 0,
                  timestamp: Date.now()
              }}
              metrics={{
                  vpd: activeMetrics.vpd,
                  dli: 0,
                  vpdStatus: VpdZone.TRANSPIRATION
              }}
              onLogProposal={actions.handleLogProposal}
              onOpenCamera={() => actions.setView('camera')}
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

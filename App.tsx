import React, { Suspense, lazy, useState } from 'react';
import { Settings, MessageCircle, LayoutDashboard, ScanEye, FlaskConical } from 'lucide-react';
import { dbService } from './services/db';
import { BackupService } from './services/backupService';
import { useAppController } from './hooks/useAppController';
import { Haptic } from './utils/haptics';
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

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans selection:bg-neon-green/30">
      <ToastContainer toasts={toasts} removeToast={(id) => actions.addToast("Dismissed", "info")} />
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
              onCamera={() => actions.setView('camera')}
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
              onBack={() => actions.setView('dashboard')}
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

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-[#050505]/90 backdrop-blur-2xl border-t border-white/5 flex justify-around items-start pt-4 px-2 pb-safe-bottom z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {/* Navigation Reflection Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-20 pointer-events-none"></div>
        
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Dash' },
          { id: 'research', icon: FlaskConical, label: 'Lab' },
          { id: 'camera', icon: ScanEye, label: 'Scan', main: true },
          { id: 'chat', icon: MessageCircle, label: 'Ask' },
          { id: 'settings', icon: Settings, label: 'Sys' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => { Haptic.tap(); actions.setView(item.id as any); }}
            className={`
              relative flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all duration-300 group z-10
              ${view === item.id ? 'text-neon-green' : 'text-gray-500 hover:text-gray-300'}
              ${item.main ? '-mt-8' : ''}
            `}
          >
            {item.main ? (
               <div className={`w-16 h-16 rounded-full flex items-center justify-center bg-[#111] border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.8)] transition-all duration-300 ${view === item.id ? 'border-neon-green shadow-[0_0_20px_rgba(0,255,163,0.3)] scale-110' : 'group-hover:border-white/30'}`}>
                   <item.icon className={`w-7 h-7 ${view === item.id ? 'text-neon-green' : 'text-white'}`} />
               </div>
            ) : (
               <>
                   <item.icon className={`w-6 h-6 transition-transform duration-300 ${view === item.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(0,255,163,0.6)]' : ''}`} />
                   <span className={`text-[9px] font-mono mt-1 uppercase tracking-wider transition-opacity duration-300 ${view === item.id ? 'opacity-100 font-bold' : 'opacity-60'}`}>{item.label}</span>
                   {view === item.id && (
                      <div className="absolute -bottom-2 w-1 h-1 bg-neon-green rounded-full shadow-[0_0_5px_#00ffa3]" />
                   )}
               </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
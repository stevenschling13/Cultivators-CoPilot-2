
import React, { memo } from 'react';
import { BatchWizardModal } from './BatchWizardModal';
import { RoomEditModal } from './RoomEditModal';
import { BatchDetailModal } from './BatchDetailModal';
import { AnalysisResultModal } from './AnalysisResultModal';
import { LegacyImportModal } from './LegacyImportModal';
import { BackupModal } from './BackupModal';
import { VoiceCommandModal } from './VoiceCommandModal';
import { WateringModal } from './WateringModal'; // New Import
import { ModalState } from '../../hooks/useModalController';
import { GrowLog, PlantBatch, Room, LogProposal, ArOverlayData, AiDiagnosis } from '../../types';

interface ModalManagerProps {
  modalState: ModalState;
  actions: {
    closeModal: () => void;
    handleUpdateBatch: (batch: PlantBatch) => void;
    handleSaveRoom: (room: Room) => Promise<void>;
    handleDeleteRoom: (id: string) => Promise<void>;
    handleLogDelete: (id: string) => Promise<void>;
    handleLogUpdate: (log: GrowLog) => Promise<void>;
    handleLogSave: (log: GrowLog) => Promise<void>;
    handleLogProposal: (proposal: LogProposal) => Promise<void>;
    handleVeoSimulation: (url: string) => Promise<string>;
    handleImportComplete: () => Promise<void>;
    handleVoiceCommand: (cmd: any) => Promise<void>;
    loadMoreLogs: () => void;
    setAnalysisResult: (res: { result: AiDiagnosis, log: GrowLog } | null) => void;
  };
  data: {
    logs: GrowLog[];
    batches: PlantBatch[];
    hasMoreLogs: boolean;
    isLoadingLogs: boolean;
  };
}

export const ModalManager = memo(({ modalState, actions, data }: ModalManagerProps) => {
  const { type, data: modalData } = modalState;

  if (type === 'none') return null;

  return (
    <>
      {type === 'voice' && (
        <VoiceCommandModal 
          onClose={actions.closeModal}
          onCommandProcessed={actions.handleVoiceCommand}
        />
      )}

      {type === 'batchWizard' && (
        <BatchWizardModal 
          onClose={actions.closeModal} 
          onBatchCreated={() => window.location.reload()} 
        />
      )}

      {type === 'roomEdit' && (
        <RoomEditModal 
          room={modalData.room}
          batches={data.batches}
          onSave={async (r) => { await actions.handleSaveRoom(r); actions.closeModal(); }}
          onDelete={async (id) => { await actions.handleDeleteRoom(id); actions.closeModal(); }}
          onClose={actions.closeModal}
        />
      )}

      {type === 'batchDetail' && modalData.batch && (
        <BatchDetailModal 
          batch={modalData.batch} 
          onClose={actions.closeModal} 
          logs={data.logs.filter(l => l.plantBatchId === modalData.batch!.id)}
          onDeleteLog={actions.handleLogDelete}
          onUpdateLog={actions.handleLogUpdate}
          onLoadMore={actions.loadMoreLogs}
          hasMore={data.hasMoreLogs}
          isLoading={data.isLoadingLogs}
        />
      )}

      {type === 'analysis' && modalData.analysis && (
        <AnalysisResultModal 
          result={modalData.analysis.result}
          log={modalData.analysis.log}
          onSave={() => { actions.handleLogSave(modalData.analysis!.log); actions.closeModal(); }}
          onDiscard={() => { actions.setAnalysisResult(null); actions.closeModal(); }}
          onSimulate={actions.handleVeoSimulation}
        />
      )}

      {type === 'import' && (
        <LegacyImportModal 
          onClose={actions.closeModal} 
          onImportComplete={actions.handleImportComplete} 
        />
      )}

      {type === 'watering' && (
          <WateringModal 
             onClose={actions.closeModal}
             onSave={actions.handleLogProposal}
             batchTag={modalData.batchTag}
          />
      )}

      {type === 'backup' && modalData.backupMode && (
        <BackupModal 
          mode={modalData.backupMode}
          onClose={actions.closeModal}
          onConfirm={async (pw, file) => {
             const { BackupService } = await import('../../services/backupService');
             if (modalData.backupMode === 'backup') {
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
    </>
  );
});

ModalManager.displayName = 'ModalManager';

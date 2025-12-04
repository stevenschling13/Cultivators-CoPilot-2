
import { useState, useCallback } from 'react';
import { Room, PlantBatch, GrowLog, AiDiagnosis } from '../types';

export type ModalType = 'none' | 'batchWizard' | 'roomEdit' | 'batchDetail' | 'analysis' | 'import' | 'backup' | 'voice' | 'watering';

export interface ModalState {
  type: ModalType;
  data: {
    room?: Room | null;
    batch?: PlantBatch | null;
    analysis?: { result: AiDiagnosis, log: GrowLog } | null;
    backupMode?: 'backup' | 'restore' | null;
    batchTag?: string; // For watering modal
  };
}

export const useModalController = () => {
  const [modalState, setModalState] = useState<ModalState>({ type: 'none', data: {} });

  const closeModal = useCallback(() => setModalState({ type: 'none', data: {} }), []);

  const openBatchWizard = useCallback(() => setModalState({ type: 'batchWizard', data: {} }), []);
  
  const openRoomModal = useCallback((room: Room | null = null) => {
    setModalState({ type: 'roomEdit', data: { room } });
  }, []);

  const openBatchDetail = useCallback((batch: PlantBatch) => {
    setModalState({ type: 'batchDetail', data: { batch } });
  }, []);

  const openAnalysis = useCallback((result: AiDiagnosis, log: GrowLog) => {
    setModalState({ type: 'analysis', data: { analysis: { result, log } } });
  }, []);

  const openImport = useCallback(() => setModalState({ type: 'import', data: {} }), []);

  const openBackup = useCallback((mode: 'backup' | 'restore') => {
    setModalState({ type: 'backup', data: { backupMode: mode } });
  }, []);

  const openVoice = useCallback(() => setModalState({ type: 'voice', data: {} }), []);

  const openWatering = useCallback((batchTag: string) => {
      setModalState({ type: 'watering', data: { batchTag } });
  }, []);

  return {
    modalState,
    closeModal,
    openBatchWizard,
    openRoomModal,
    openBatchDetail,
    openAnalysis,
    openImport,
    openBackup,
    openVoice,
    openWatering
  };
};

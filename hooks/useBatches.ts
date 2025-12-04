import { useState, useCallback, useMemo } from 'react';
import { PlantBatch } from '../types';
import { dbService } from '../services/db';
import { MOCK_BATCHES } from '../constants';

export const useBatches = (initialBatches: PlantBatch[] = MOCK_BATCHES) => {
  const [batches, setBatches] = useState<PlantBatch[]>(initialBatches);
  const [selectedBatch, setSelectedBatch] = useState<PlantBatch | null>(null);

  const activeBatches = useMemo(() => batches.filter(b => b.isActive !== false), [batches]);

  const updateBatch = useCallback(async (batch: PlantBatch) => {
    await dbService.saveBatch(batch);
    setBatches(prev => prev.map(b => b.id === batch.id ? batch : b));
    if (selectedBatch?.id === batch.id) {
      setSelectedBatch(batch);
    }
  }, [selectedBatch]);

  const archiveBatch = useCallback(async (id: string) => {
    await dbService.archiveBatch(id);
    setBatches(prev => prev.map(b => b.id === id ? { ...b, isActive: false } : b));
    if (selectedBatch?.id === id) {
      setSelectedBatch(null);
    }
  }, [selectedBatch]);

  const createBatch = useCallback(async (batch: PlantBatch) => {
      await dbService.saveBatch(batch);
      setBatches(prev => [...prev, batch]);
  }, []);

  return {
    batches,
    activeBatches,
    selectedBatch,
    setSelectedBatch,
    setBatches,
    updateBatch,
    archiveBatch,
    createBatch
  };
};

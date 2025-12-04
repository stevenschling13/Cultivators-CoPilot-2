import { useState, useCallback } from 'react';
import { GrowLog } from '../types';
import { dbService } from '../services/db';
import { errorService } from '../services/errorService';

export const useGrowLogs = (initialLogs: GrowLog[] = []) => {
  const [logs, setLogs] = useState<GrowLog[]>(initialLogs);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [lastLogTimestamp, setLastLogTimestamp] = useState<number | undefined>();

  const loadMoreLogs = useCallback(async (reset = false) => {
    if (!reset && (isLoadingLogs || !hasMoreLogs)) return;
    setIsLoadingLogs(true);
    try {
      const timestampCursor = reset ? undefined : lastLogTimestamp;
      const limit = 20;
      const newLogs = await dbService.getLogsPaginated(undefined, limit, timestampCursor);
      
      if (reset) {
        setLogs(newLogs);
        setHasMoreLogs(newLogs.length >= limit);
        setLastLogTimestamp(newLogs.length > 0 ? newLogs[newLogs.length - 1].timestamp : undefined);
      } else {
        setLogs(prev => [...prev, ...newLogs]);
        setHasMoreLogs(newLogs.length >= limit);
        setLastLogTimestamp(newLogs.length > 0 ? newLogs[newLogs.length - 1].timestamp : lastLogTimestamp);
      }
    } catch (e) {
      errorService.captureError(e as Error, { severity: 'MEDIUM', metadata: { context: 'useGrowLogs.loadMoreLogs' } });
    } finally {
      setIsLoadingLogs(false);
    }
  }, [isLoadingLogs, hasMoreLogs, lastLogTimestamp]);

  const addLog = useCallback(async (log: GrowLog) => {
    await dbService.saveLog(log);
    setLogs(prev => [log, ...prev]);
  }, []);

  const updateLog = useCallback(async (log: GrowLog) => {
    await dbService.saveLog(log);
    setLogs(prev => prev.map(l => l.id === log.id ? log : l));
  }, []);

  const deleteLog = useCallback(async (id: string) => {
    await dbService.deleteLog(id);
    setLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  return {
    logs,
    isLoadingLogs,
    hasMoreLogs,
    setLogs,
    loadMoreLogs,
    addLog,
    updateLog,
    deleteLog
  };
};

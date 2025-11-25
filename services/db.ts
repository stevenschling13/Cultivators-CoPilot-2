
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { PlantBatch, GrowLog, GrowSetup, AppError, ChatMessage, Room } from '../types';
import { MOCK_BATCHES, DEFAULT_GROW_SETUP, MOCK_ROOMS } from '../constants';
import { generateUUID } from '../utils/uuid';

interface CultivatorDB extends DBSchema {
  batches: {
    key: string;
    value: PlantBatch;
  };
  logs: {
    key: string;
    value: GrowLog;
    indexes: { 
      'by-batch': string,
      'by-timestamp': number 
    };
  };
  settings: {
    key: string;
    value: GrowSetup;
  };
  sys_errors: {
    key: string;
    value: AppError;
    indexes: {
      'by-timestamp': number;
      'by-severity': string;
    };
  };
  chat_history: {
    key: string;
    value: ChatMessage;
    indexes: {
        'by-timestamp': number;
    }
  };
  rooms: {
    key: string;
    value: Room;
  };
}

class DbService {
  private dbPromise: Promise<IDBPDatabase<CultivatorDB>>;
  private readyPromise: Promise<void>;

  constructor() {
    this.dbPromise = openDB<CultivatorDB>('cultivator-db', 7, { 
      upgrade(db, oldVersion, newVersion, transaction) {
        // Reset stores for V3 to ensure custom data seeding applies cleanly
        if (oldVersion < 3) {
            if (db.objectStoreNames.contains('batches')) db.deleteObjectStore('batches');
            if (db.objectStoreNames.contains('logs')) db.deleteObjectStore('logs');
            if (db.objectStoreNames.contains('settings')) db.deleteObjectStore('settings');

            db.createObjectStore('batches', { keyPath: 'id' });
            
            const logStore = db.createObjectStore('logs', { keyPath: 'id' });
            logStore.createIndex('by-batch', 'plantBatchId');
            logStore.createIndex('by-timestamp', 'timestamp');

            db.createObjectStore('settings');
        }

        // Version 4: Error Logging
        if (oldVersion < 4) {
           if (!db.objectStoreNames.contains('sys_errors')) {
               const errorStore = db.createObjectStore('sys_errors', { keyPath: 'id' });
               errorStore.createIndex('by-timestamp', 'timestamp');
               errorStore.createIndex('by-severity', 'severity');
           }
        }

        // Version 5: Backfill Green Pheno Data
        if (oldVersion < 5) {
            if (db.objectStoreNames.contains('batches')) transaction.objectStore('batches').clear();
            if (db.objectStoreNames.contains('logs')) transaction.objectStore('logs').clear();
        }

        // Version 6: Chat History Persistence
        if (oldVersion < 6) {
           if (!db.objectStoreNames.contains('chat_history')) {
              const chatStore = db.createObjectStore('chat_history', { keyPath: 'id' });
              chatStore.createIndex('by-timestamp', 'timestamp');
           }
        }

        // Version 7: Room Persistence (Dynamic Infrastructure)
        if (oldVersion < 7) {
            if (!db.objectStoreNames.contains('rooms')) {
                db.createObjectStore('rooms', { keyPath: 'id' });
            }
        }
      },
    });
    this.readyPromise = this.seedDefaults();
  }

  private async seedDefaults() {
    try {
      const db = await this.dbPromise;
      const count = await db.count('batches');
      if (count === 0) {
        const tx = db.transaction(['batches', 'logs', 'settings', 'rooms'], 'readwrite');
        
        // 1. Batches (Added isActive flag)
        const activeBatches = MOCK_BATCHES.map(b => ({ ...b, isActive: true }));
        for (const batch of activeBatches) await tx.objectStore('batches').put(batch);
        
        // 2. Settings
        await tx.objectStore('settings').put(DEFAULT_GROW_SETUP, 'main');
        
        // 3. Rooms (Seeding Mock Rooms)
        for (const room of MOCK_ROOMS) await tx.objectStore('rooms').put(room);

        // 4. Generate Historical Logs based on User Context
        const logs: GrowLog[] = [];
        const blueId = MOCK_BATCHES[0].id;
        const greenId = MOCK_BATCHES[1].id;

        // --- BLUE PHENO MILESTONES ---
        const blueMilestones = [
            { date: '2025-08-02', action: 'Observation', note: 'Sprout Date. Seedlings established.' },
            { date: '2025-08-27', action: 'Training', note: 'Topping Window (Mainlining start).' },
            { date: '2025-09-10', action: 'Training', note: 'Aggressive LST started. Pulling branches horizontal.' },
            { date: '2025-09-24', action: 'Training', note: 'Manifold structure complete. 8 main colas established.' },
            { date: '2025-10-02', action: 'Other', note: 'FLIP TO FLOWER (12/12). Canopy even.' },
            { date: '2025-11-18', action: 'Observation', note: 'Trichome Inspection. 5% Clear, 90% Cloudy, 5% Amber. Peak approach.' }
        ];

        blueMilestones.forEach(m => {
            logs.push({
                id: generateUUID(),
                plantBatchId: blueId,
                timestamp: new Date(m.date).getTime(),
                actionType: m.action,
                manualNotes: m.note,
                aiDiagnosis: undefined
            });
        });

        // --- GREEN PHENO MILESTONES (Added for Data Completeness) ---
        const greenMilestones = [
            { date: '2025-08-02', action: 'Observation', note: 'Sprout Date. High vigor noted immediately.' },
            { date: '2025-08-30', action: 'Training', note: 'Topped. Recovery was instant (<12 hours).' },
            { date: '2025-09-15', action: 'Feed', note: 'Heavy feeding. Showing salt tolerance. EC 2.8.' },
            { date: '2025-10-02', action: 'Other', note: 'FLIP TO FLOWER. Stretch potential high.' },
            { date: '2025-10-25', action: 'Observation', note: 'Stacking vertically. Intermodal spacing larger than Blue.' },
            { date: '2025-11-20', action: 'Observation', note: 'Frost development heavy. Slower ripening than Blue.' }
        ];

        greenMilestones.forEach(m => {
            logs.push({
                id: generateUUID(),
                plantBatchId: greenId,
                timestamp: new Date(m.date).getTime(),
                actionType: m.action,
                manualNotes: m.note,
                aiDiagnosis: undefined
            });
        });

        // Weekly Environment Logs (from provided data)
        const weeklyData = [
            {"week_ending": "2025-08-03", "Temp_F_avg": 85.85, "RH_avg": 56.82, "VPD_avg": 1.62},
            {"week_ending": "2025-08-10", "Temp_F_avg": 85.91, "RH_avg": 62.91, "VPD_avg": 1.38},
            {"week_ending": "2025-08-17", "Temp_F_avg": 81.50, "RH_avg": 63.72, "VPD_avg": 1.14},
            {"week_ending": "2025-08-24", "Temp_F_avg": 83.66, "RH_avg": 61.21, "VPD_avg": 1.32},
            {"week_ending": "2025-08-31", "Temp_F_avg": 80.96, "RH_avg": 57.81, "VPD_avg": 1.33},
            {"week_ending": "2025-09-07", "Temp_F_avg": 76.39, "RH_avg": 56.34, "VPD_avg": 1.19},
            {"week_ending": "2025-09-14", "Temp_F_avg": 81.35, "RH_avg": 63.21, "VPD_avg": 1.14},
            {"week_ending": "2025-09-21", "Temp_F_avg": 83.35, "RH_avg": 64.37, "VPD_avg": 1.18},
            {"week_ending": "2025-09-28", "Temp_F_avg": 78.29, "RH_avg": 59.69, "VPD_avg": 1.15},
            {"week_ending": "2025-10-05", "Temp_F_avg": 80.89, "RH_avg": 64.45, "VPD_avg": 1.10},
            {"week_ending": "2025-10-12", "Temp_F_avg": 73.41, "RH_avg": 54.26, "VPD_avg": 1.13},
            {"week_ending": "2025-10-19", "Temp_F_avg": 71.61, "RH_avg": 52.89, "VPD_avg": 1.16},
            {"week_ending": "2025-10-26", "Temp_F_avg": 70.74, "RH_avg": 46.89, "VPD_avg": 1.29},
            {"week_ending": "2025-11-02", "Temp_F_avg": 70.90, "RH_avg": 48.87, "VPD_avg": 1.26},
            {"week_ending": "2025-11-09", "Temp_F_avg": 70.77, "RH_avg": 43.55, "VPD_avg": 1.39},
            {"week_ending": "2025-11-16", "Temp_F_avg": 71.32, "RH_avg": 48.88, "VPD_avg": 1.26},
            {"week_ending": "2025-11-23", "Temp_F_avg": 74.17, "RH_avg": 49.02, "VPD_avg": 1.39}
        ];

        weeklyData.forEach(w => {
            // Blue Pheno Log
            logs.push({
                id: generateUUID(),
                plantBatchId: blueId,
                timestamp: new Date(w.week_ending).getTime(),
                actionType: 'Observation',
                manualNotes: `Weekly Summary (Left): ${w.Temp_F_avg.toFixed(1)}°F / ${w.RH_avg.toFixed(1)}% RH. VPD: ${w.VPD_avg} kPa.`,
                aiDiagnosis: {
                   healthScore: w.VPD_avg > 1.5 || w.VPD_avg < 0.8 ? 75 : 95,
                   detectedPests: [],
                   nutrientDeficiencies: [],
                   morphologyNotes: "Environmental Checkpoint",
                   recommendations: [],
                   progressionAnalysis: "Stable",
                   harvestPrediction: undefined
                }
            });

            // Green Pheno Log (Simulated Microclimate - Garage Right)
            const greenTemp = w.Temp_F_avg + 1.2;
            const greenRh = w.RH_avg - 1.5;
            const greenVpd = w.VPD_avg + 0.12; 

            logs.push({
                id: generateUUID(),
                plantBatchId: greenId,
                timestamp: new Date(w.week_ending).getTime(),
                actionType: 'Observation',
                manualNotes: `Weekly Summary (Right): ${greenTemp.toFixed(1)}°F / ${greenRh.toFixed(1)}% RH. VPD: ${greenVpd.toFixed(2)} kPa.`,
                aiDiagnosis: {
                   healthScore: greenVpd > 1.6 || greenVpd < 0.8 ? 78 : 96,
                   detectedPests: [],
                   nutrientDeficiencies: [],
                   morphologyNotes: "Environmental Checkpoint - Vigorous uptake noted.",
                   recommendations: [],
                   progressionAnalysis: "Rapid Growth",
                   harvestPrediction: undefined
                }
            });
        });

        for (const log of logs) {
            await tx.objectStore('logs').put(log);
        }

        await tx.done;
      }
    } catch (e) {
      console.error("Error seeding database:", e);
    }
  }

  // --- Batch Operations ---
  public async getBatches(): Promise<PlantBatch[]> {
    await this.readyPromise;
    const db = await this.dbPromise;
    const batches = await db.getAll('batches');
    return batches; 
  }

  public async saveBatch(batch: PlantBatch) {
    await this.readyPromise;
    const db = await this.dbPromise;
    if (batch.isActive === undefined) batch.isActive = true;
    await db.put('batches', batch);
  }

  public async archiveBatch(id: string) {
    await this.readyPromise;
    const db = await this.dbPromise;
    const batch = await db.get('batches', id);
    if (batch) {
        batch.isActive = false;
        await db.put('batches', batch);
    }
  }

  // --- Log Operations ---

  public async updateBatch(batch: PlantBatch) {
    await this.saveBatch(batch);
  }

  public async getLogs(batchId?: string): Promise<GrowLog[]> {
    await this.readyPromise;
    const db = await this.dbPromise;
    if (batchId) {
      return db.getAllFromIndex('logs', 'by-batch', batchId);
    }
    return db.getAll('logs');
  }

  /**
   * Paginated Log Fetching for infinite scrolling support.
   */
  public async getLogsPaginated(batchId?: string, limit = 20, lastTimestamp?: number): Promise<GrowLog[]> {
    await this.readyPromise;
    const db = await this.dbPromise;
    const range = lastTimestamp ? IDBKeyRange.upperBound(lastTimestamp, true) : undefined;
    let cursor = await db.transaction('logs').store.index('by-timestamp').openCursor(range, 'prev');
    
    const results: GrowLog[] = [];
    while (cursor && results.length < limit) {
      if (!batchId || cursor.value.plantBatchId === batchId) {
        results.push(cursor.value);
      }
      cursor = await cursor.continue();
    }
    return results;
  }

  public async getLatestLog(batchId: string): Promise<GrowLog | undefined> {
     await this.readyPromise;
     const db = await this.dbPromise;
     const cursor = await db.transaction('logs').store.index('by-batch').openCursor(IDBKeyRange.only(batchId), 'prev');
     return cursor?.value;
  }

  public async saveLog(log: GrowLog) {
    await this.readyPromise;
    const db = await this.dbPromise;
    await db.put('logs', log);
  }
  
  public async deleteLog(id: string) {
    await this.readyPromise;
    const db = await this.dbPromise;
    await db.delete('logs', id);
  }

  // --- Settings ---
  public async getSettings(): Promise<GrowSetup> {
    await this.readyPromise;
    const db = await this.dbPromise;
    return (await db.get('settings', 'main')) || DEFAULT_GROW_SETUP;
  }

  public async saveSettings(settings: GrowSetup) {
    await this.readyPromise;
    const db = await this.dbPromise;
    await db.put('settings', settings, 'main');
  }

  // --- Room Operations ---
  public async getRooms(): Promise<Room[]> {
      await this.readyPromise;
      const db = await this.dbPromise;
      const rooms = await db.getAll('rooms');
      if (!rooms || rooms.length === 0) return MOCK_ROOMS; // Fallback during migration
      return rooms;
  }

  public async saveRoom(room: Room) {
      await this.readyPromise;
      const db = await this.dbPromise;
      await db.put('rooms', room);
  }

  public async deleteRoom(id: string) {
      await this.readyPromise;
      const db = await this.dbPromise;
      await db.delete('rooms', id);
  }

  // --- Error Logging ---
  public async logError(error: AppError) {
    try {
        const db = await this.dbPromise;
        await db.put('sys_errors', error);
    } catch (e) {
        console.error("Critical: Failed to log error to DB", e);
    }
  }

  public async getRecentErrors(limit = 50): Promise<AppError[]> {
      await this.readyPromise;
      const db = await this.dbPromise;
      const all = await db.getAll('sys_errors');
      return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  // --- Chat History ---
  public async saveChatMessage(msg: ChatMessage) {
      try {
          await this.readyPromise;
          const db = await this.dbPromise;
          await db.put('chat_history', msg);
      } catch (e) {
          console.error("Failed to save chat message", e);
      }
  }

  public async getChatHistory(limit = 50): Promise<ChatMessage[]> {
      await this.readyPromise;
      const db = await this.dbPromise;
      const all = await db.getAll('chat_history');
      return all.sort((a, b) => a.timestamp - b.timestamp).slice(-limit);
  }

  public async clearChatHistory() {
      await this.readyPromise;
      const db = await this.dbPromise;
      await db.clear('chat_history');
  }
}

export const dbService = new DbService();

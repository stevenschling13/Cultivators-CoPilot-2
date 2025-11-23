
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { PlantBatch, GrowLog, GrowSetup } from '../types';
import { MOCK_BATCHES, DEFAULT_GROW_SETUP } from '../constants';

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
}

class DbService {
  private dbPromise: Promise<IDBPDatabase<CultivatorDB>>;
  private readyPromise: Promise<void>;

  constructor() {
    this.dbPromise = openDB<CultivatorDB>('cultivator-db', 3, { 
      upgrade(db, oldVersion, newVersion, transaction) {
        // Reset stores for V3 to ensure custom data seeding applies cleanly
        if (db.objectStoreNames.contains('batches')) db.deleteObjectStore('batches');
        if (db.objectStoreNames.contains('logs')) db.deleteObjectStore('logs');
        if (db.objectStoreNames.contains('settings')) db.deleteObjectStore('settings');

        db.createObjectStore('batches', { keyPath: 'id' });
        
        const logStore = db.createObjectStore('logs', { keyPath: 'id' });
        logStore.createIndex('by-batch', 'plantBatchId');
        logStore.createIndex('by-timestamp', 'timestamp');

        db.createObjectStore('settings');
      },
    });
    this.readyPromise = this.seedDefaults();
  }

  private async seedDefaults() {
    try {
      const db = await this.dbPromise;
      const count = await db.count('batches');
      if (count === 0) {
        const tx = db.transaction(['batches', 'logs', 'settings'], 'readwrite');
        
        // 1. Batches
        for (const batch of MOCK_BATCHES) await tx.objectStore('batches').put(batch);
        
        // 2. Settings
        await tx.objectStore('settings').put(DEFAULT_GROW_SETUP, 'main');

        // 3. Generate Historical Logs based on User Context
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
                id: crypto.randomUUID(),
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
                id: crypto.randomUUID(),
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
            logs.push({
                id: crypto.randomUUID(),
                plantBatchId: blueId,
                timestamp: new Date(w.week_ending).getTime(),
                actionType: 'Observation',
                manualNotes: `Weekly Summary: ${w.Temp_F_avg.toFixed(1)}°F / ${w.RH_avg.toFixed(1)}% RH. VPD: ${w.VPD_avg} kPa.`,
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

  public async getBatches(): Promise<PlantBatch[]> {
    await this.readyPromise;
    const db = await this.dbPromise;
    return db.getAll('batches');
  }

  public async updateBatch(batch: PlantBatch) {
    await this.readyPromise;
    const db = await this.dbPromise;
    await db.put('batches', batch);
  }

  public async getLogs(batchId?: string): Promise<GrowLog[]> {
    await this.readyPromise;
    const db = await this.dbPromise;
    if (batchId) {
      return db.getAllFromIndex('logs', 'by-batch', batchId);
    }
    return db.getAll('logs');
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
}

export const dbService = new DbService();

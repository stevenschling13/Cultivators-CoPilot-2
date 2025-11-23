
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
    this.dbPromise = openDB<CultivatorDB>('cultivator-db', 2, { // Incremented Version
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('batches')) db.createObjectStore('batches', { keyPath: 'id' });
        
        let logStore;
        if (!db.objectStoreNames.contains('logs')) {
          logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('by-batch', 'plantBatchId');
        } else {
          logStore = transaction.objectStore('logs');
        }

        // Add Timestamp Index for sorting
        if (!logStore.indexNames.contains('by-timestamp')) {
          logStore.createIndex('by-timestamp', 'timestamp');
        }

        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      },
    });
    this.readyPromise = this.seedDefaults();
  }

  private async seedDefaults() {
    try {
      const db = await this.dbPromise;
      const count = await db.count('batches');
      if (count === 0) {
        const tx = db.transaction('batches', 'readwrite');
        for (const batch of MOCK_BATCHES) await tx.store.put(batch);
        await tx.done;
      }
      const settings = await db.get('settings', 'main');
      if (!settings) await db.put('settings', DEFAULT_GROW_SETUP, 'main');
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
    // Optimization: Use the timestamp index directly if possible, or just getAll
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

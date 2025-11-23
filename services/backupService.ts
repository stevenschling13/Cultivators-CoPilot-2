
import { dbService } from './db';
import { CryptoService } from './cryptoService';

export class BackupService {
  
  /**
   * Gathers all app data, encrypts it, and triggers a browser download.
   */
  public static async createEncryptedBackup(password: string) {
    // 1. Gather Data
    const batches = await dbService.getBatches();
    const logs = await dbService.getLogs();
    const settings = await dbService.getSettings();
    
    const fullDump = {
      version: 1,
      timestamp: Date.now(),
      batches,
      logs,
      settings
    };

    // 2. Encrypt
    const encryptedBlob = await CryptoService.encryptData(fullDump, password);

    // 3. Trigger Download (iOS "Save to Files" / Android "Download")
    const url = URL.createObjectURL(encryptedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cultivator-backup-${new Date().toISOString().split('T')[0]}.ccbak`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // OPTIMIZATION: Delay revoking URL significantly to allow iOS Safari to capture the download context
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /**
   * Reads an encrypted backup file and restores the database.
   * WARNING: This overwrites current data.
   */
  public static async restoreFromBackup(file: File, password: string): Promise<boolean> {
    try {
      const decryptedData = await CryptoService.decryptData(file, password);
      
      if (!decryptedData.version || !decryptedData.batches) {
        throw new Error("Invalid Backup Format");
      }

      // Restore Logic
      for (const batch of decryptedData.batches) {
        await dbService.updateBatch(batch);
      }
      
      for (const log of decryptedData.logs) {
        await dbService.saveLog(log);
      }

      if (decryptedData.settings) {
        await dbService.saveSettings(decryptedData.settings);
      }
      
      return true;
    } catch (e) {
      console.error("Restore Failed", e);
      return false;
    }
  }
}

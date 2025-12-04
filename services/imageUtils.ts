import { errorService } from './errorService';

/**
 * ImageUtils: Professional Image Processing Pipeline
 * Optimized for iPhone 16 Pro 48MP Assets.
 * V2: Uses Web Workers for non-blocking UI.
 */

export interface ProcessedImage {
  full: string;      // High-res WebP
  thumbnail: string; // Low-res WebP
  width: number;
  height: number;
}

export class ImageUtils {
  private static worker: Worker | null = null;
  private static pendingRequests = new Map<string, { resolve: Function, reject: Function }>();

  private static getWorker() {
    if (!this.worker) {
      try {
        // Use native ESM Worker instantiation with Vite's URL handling.
        // This avoids "binding name 'default' cannot be resolved" errors with ?worker imports.
        // WRAP IN TRY/CATCH: 'new Worker' can throw SecurityError or ScriptError if CORS is strict on CDNs.
        const workerUrl = new URL('../workers/image.worker.ts', import.meta.url);
        this.worker = new Worker(workerUrl, { type: 'module' });

        this.worker.onmessage = (e) => {
          const { fileId, success, data, error } = e.data;
          const request = this.pendingRequests.get(fileId);
          if (request) {
            if (success) request.resolve(data);
            else request.reject(new Error(error || "Unknown worker error"));
            this.pendingRequests.delete(fileId);
          }
        };
        
        this.worker.onerror = (e) => {
            console.error("Worker Error", e);
            this.worker?.terminate();
            this.worker = null;
            
            // Do not report generic script errors from workers to the UI service as CRITICAL
            // Just fallback to main thread.
            
            this.pendingRequests.forEach((req) => {
                req.reject(new Error("Worker crashed during processing"));
            });
            this.pendingRequests.clear();
        };
      } catch (e) {
        console.warn("Worker init failed (likely CORS), falling back to main thread", e);
        // Do not report to ErrorService here to avoid loop/noise
        this.worker = null;
      }
    }
    return this.worker;
  }

  /**
   * Processes a raw file into optimized assets using a background thread.
   */
  public static async processImage(file: File): Promise<ProcessedImage> {
    // Fallback for environments without Worker support (rare)
    if (typeof Worker === 'undefined') {
       return this.processMainThread(file);
    }

    // Initial check to see if we can get a worker
    const worker = this.getWorker();
    
    // If worker failed to initialize (returned null), fall back immediately
    if (!worker) {
        return this.processMainThread(file);
    }

    const fileId = Math.random().toString(36).substring(7);
    
    try {
        return await new Promise((resolve, reject) => {
          // 30s Timeout safeguard
          const timeoutId = setTimeout(() => {
              if (this.pendingRequests.has(fileId)) {
                  this.pendingRequests.delete(fileId);
                  reject(new Error("Image processing timed out (30s)"));
              }
          }, 30000);

          this.pendingRequests.set(fileId, { 
              resolve: (data: ProcessedImage) => {
                  clearTimeout(timeoutId);
                  resolve(data);
              }, 
              reject: (err: Error) => {
                  clearTimeout(timeoutId);
                  reject(err);
              } 
          });
          
          worker.postMessage({ fileId, file });
        });
    } catch (e) {
        console.warn("Worker processing failed, falling back to main thread", e);
        return this.processMainThread(file);
    }
  }

  /**
   * Main Thread Fallback (Legacy Logic)
   */
  private static async processMainThread(file: File): Promise<ProcessedImage> {
    try {
      const bitmap = await createImageBitmap(file);
      const MAX_DIMENSION = 1600;
      const THUMBNAIL_SIZE = 150;
      
      let { width, height } = { width: bitmap.width, height: bitmap.height };
      if (width > height && width > MAX_DIMENSION) {
         height *= MAX_DIMENSION / width;
         width = MAX_DIMENSION;
      } else if (height > MAX_DIMENSION) {
         width *= MAX_DIMENSION / height;
         height = MAX_DIMENSION;
      }
      width = Math.round(width);
      height = Math.round(height);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error("Canvas Context Failed");

      ctx.drawImage(bitmap, 0, 0, width, height);
      const full = canvas.toDataURL('image/webp', 0.7);

      // Thumbnail
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = THUMBNAIL_SIZE;
      thumbCanvas.height = THUMBNAIL_SIZE;
      const thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
      if (!thumbCtx) throw new Error("Canvas Context Failed");

      const minDim = Math.min(bitmap.width, bitmap.height);
      const sx = (bitmap.width - minDim) / 2;
      const sy = (bitmap.height - minDim) / 2;
      thumbCtx.drawImage(bitmap, sx, sy, minDim, minDim, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
      const thumbnail = thumbCanvas.toDataURL('image/webp', 0.5);

      bitmap.close();
      return { full, thumbnail, width, height };
    } catch (e) {
      errorService.captureError(e as Error, { severity: 'HIGH', metadata: { context: 'ImageProcessingFallback' } });
      throw e;
    }
  }

  /**
   * Legacy method kept for compatibility.
   */
  public static async compressImage(file: File): Promise<string> {
    const result = await this.processImage(file);
    return result.full;
  }

  /**
   * Legacy thumbnail method.
   */
  public static async createThumbnail(base64Image: string): Promise<string> {
    // Quick main-thread crop for existing base64 strings
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return reject();
        
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 150, 150);
        resolve(canvas.toDataURL('image/webp', 0.5));
      };
      img.onerror = reject;
      img.src = base64Image;
    });
  }
}
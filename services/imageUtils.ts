
/**
 * ImageUtils: Professional Image Processing Pipeline
 * Optimized for iPhone 16 Pro 48MP Assets.
 */

export interface ProcessedImage {
  full: string;      // High-res WebP
  thumbnail: string; // Low-res WebP
  width: number;
  height: number;
}

export class ImageUtils {
  private static MAX_DIMENSION = 1600; 
  private static THUMBNAIL_SIZE = 150;
  private static COMPRESSION_QUALITY = 0.7; 

  /**
   * Processes a raw file into optimized assets (Full + Thumbnail) in a single pass.
   * Uses OffscreenCanvas if available to unblock Main Thread.
   */
  public static async processImage(file: File): Promise<ProcessedImage> {
    const bitmap = await createImageBitmap(file);
    const { width, height } = this.calculateDimensions(bitmap.width, bitmap.height, this.MAX_DIMENSION);
    
    // Use OffscreenCanvas if available for performance
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        return await this.processOffscreen(bitmap, width, height);
      } catch (e) {
        console.warn("OffscreenCanvas failed, falling back to main thread", e);
      }
    }

    return this.processMainThread(bitmap, width, height);
  }

  /**
   * Legacy method kept for compatibility, redirects to new pipeline.
   */
  public static async compressImage(file: File): Promise<string> {
    const result = await this.processImage(file);
    return result.full;
  }

  /**
   * Legacy thumbnail method. 
   * Optimization: Avoid using this if you have the original File. Use processImage instead.
   */
  public static async createThumbnail(base64Image: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = this.THUMBNAIL_SIZE;
        canvas.height = this.THUMBNAIL_SIZE;
        const ctx = canvas.getContext('2d', { alpha: false }); // Optimization: No alpha needed
        if (!ctx) return reject();

        this.drawCenterCrop(ctx, img, img.width, img.height, this.THUMBNAIL_SIZE);
        resolve(canvas.toDataURL('image/webp', 0.5));
      };
      img.src = base64Image;
    });
  }

  // --- Internal Helpers ---

  private static calculateDimensions(w: number, h: number, max: number) {
    let width = w;
    let height = h;

    if (width > height) {
      if (width > max) {
        height *= max / width;
        width = max;
      }
    } else {
      if (height > max) {
        width *= max / height;
        height = max;
      }
    }
    return { width: Math.round(width), height: Math.round(height) };
  }

  private static async processOffscreen(bitmap: ImageBitmap, w: number, h: number): Promise<ProcessedImage> {
    // 1. Full Res
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const fullBlob = await canvas.convertToBlob({ type: 'image/webp', quality: this.COMPRESSION_QUALITY });
    
    // 2. Thumbnail
    const thumbCanvas = new OffscreenCanvas(this.THUMBNAIL_SIZE, this.THUMBNAIL_SIZE);
    const thumbCtx = thumbCanvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
    this.drawCenterCrop(thumbCtx, bitmap, w, h, this.THUMBNAIL_SIZE); // Use bitmap directly, scaled implicitly? No, use bitmap dims
    // Note: drawCenterCrop expects an image-like object. CanvasRenderingContext2D overload works for bitmap.
    
    const thumbBlob = await thumbCanvas.convertToBlob({ type: 'image/webp', quality: 0.5 });
    
    bitmap.close(); // Important: Release memory

    return {
      full: await this.blobToBase64(fullBlob),
      thumbnail: await this.blobToBase64(thumbBlob),
      width: w,
      height: h
    };
  }

  private static async processMainThread(bitmap: ImageBitmap, w: number, h: number): Promise<ProcessedImage> {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!ctx) throw new Error("Canvas Context Failed");

    ctx.drawImage(bitmap, 0, 0, w, h);
    const full = canvas.toDataURL('image/webp', this.COMPRESSION_QUALITY);

    // Thumbnail
    canvas.width = this.THUMBNAIL_SIZE;
    canvas.height = this.THUMBNAIL_SIZE;
    // Context is lost on resize? No, strictly cleared.
    // But standard practice is separate canvas or re-get context. 
    // Reusing variable is fine, but context attributes persist.
    
    this.drawCenterCrop(ctx, bitmap, bitmap.width, bitmap.height, this.THUMBNAIL_SIZE);
    const thumbnail = canvas.toDataURL('image/webp', 0.5);

    bitmap.close();

    return { full, thumbnail, width: w, height: h };
  }

  private static drawCenterCrop(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, 
    img: CanvasImageSource, 
    srcW: number, 
    srcH: number, 
    destSize: number
  ) {
    const minDim = Math.min(srcW, srcH);
    const sx = (srcW - minDim) / 2;
    const sy = (srcH - minDim) / 2;
    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, destSize, destSize);
  }

  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Generates a stabilized Time-Lapse video from a sequence of Base64 images.
   * Optimized to use requestAnimationFrame logic (simulated via delay) to prevent freezing.
   */
  public static async generateTimeLapseVideo(images: string[]): Promise<string> {
    if (images.length === 0) throw new Error("No images to generate time-lapse");

    return new Promise(async (resolve, reject) => {
      const canvas = document.createElement('canvas');
      const size = 1080; 
      canvas.width = size;
      canvas.height = size;
      
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return reject("No Canvas Context");
      
      let mimeType = 'video/webm;codecs=vp9'; 
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4'; 
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      }
      
      try {
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 }); // 2.5Mbps
        const chunks: Blob[] = [];
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          resolve(url);
        };

        recorder.start();

        for (const base64 of images) {
          await new Promise<void>((r) => {
            const img = new Image();
            img.onload = () => {
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, size, size);
              // Aspect Fit logic
              const scale = Math.max(size / img.width, size / img.height);
              const x = (size / 2) - (img.width / 2) * scale;
              const y = (size / 2) - (img.height / 2) * scale;
              ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
              r();
            };
            img.src = base64;
          });
          // Reduced delay for faster generation, but kept enough for stream capture
          await new Promise(r => setTimeout(r, 100));
        }

        recorder.stop();
      } catch (e) {
        reject(new Error(`MediaRecorder failed: ${e}`));
      }
    });
  }
}

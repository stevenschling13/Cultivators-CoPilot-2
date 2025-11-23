
/**
 * ImageUtils: Professional Image Processing Pipeline
 * Optimized for iPhone 16 Pro 48MP Assets.
 */

export class ImageUtils {
  private static MAX_DIMENSION = 1600; 
  private static COMPRESSION_QUALITY = 0.7; 

  /**
   * Compresses a high-res image file into an optimized WebP string.
   * Uses modern createImageBitmap for non-blocking decoding.
   */
  public static async compressImage(file: File): Promise<string> {
    // Adaptive Quality
    let quality = this.COMPRESSION_QUALITY;
    if (file.size > 5 * 1024 * 1024) {
      quality = 0.6;
    }

    const bitmap = await createImageBitmap(file);
    
    const canvas = document.createElement('canvas');
    let { width, height } = bitmap;

    // Calculate Aspect Ratio
    if (width > height) {
      if (width > this.MAX_DIMENSION) {
        height *= this.MAX_DIMENSION / width;
        width = this.MAX_DIMENSION;
      }
    } else {
      if (height > this.MAX_DIMENSION) {
        width *= this.MAX_DIMENSION / height;
        height = this.MAX_DIMENSION;
      }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    bitmap.close();
    return canvas.toDataURL('image/webp', quality);
  }

  /**
   * Creates a low-res thumbnail for list views
   */
  public static async createThumbnail(base64Image: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 150; 
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject();

        // Center crop strategy
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/webp', 0.5));
      };
      img.src = base64Image;
    });
  }

  /**
   * Generates a stabilized Time-Lapse video from a sequence of Base64 images.
   */
  public static async generateTimeLapseVideo(images: string[]): Promise<string> {
    if (images.length === 0) throw new Error("No images to generate time-lapse");

    return new Promise(async (resolve, reject) => {
      const canvas = document.createElement('canvas');
      const size = 1080; 
      canvas.width = size;
      canvas.height = size;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("No Canvas Context");
      
      // iOS Safari requires strict MIME type handling
      let mimeType = 'video/webm;codecs=vp9'; 
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4'; 
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      }
      
      try {
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType });
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
              const scale = Math.max(size / img.width, size / img.height);
              const x = (size / 2) - (img.width / 2) * scale;
              const y = (size / 2) - (img.height / 2) * scale;
              ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
              r();
            };
            img.src = base64;
          });
          await new Promise(r => setTimeout(r, 200));
        }

        recorder.stop();
      } catch (e) {
        reject(new Error(`MediaRecorder failed: ${e}`));
      }
    });
  }
}

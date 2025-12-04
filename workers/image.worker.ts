/// <reference lib="webworker" />

export {};

const MAX_DIMENSION = 1600;
const THUMBNAIL_SIZE = 150;
const QUALITY = 0.7;

// Declare the worker context
const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent) => {
  const { fileId, file } = e.data;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = calculateDimensions(bitmap.width, bitmap.height, MAX_DIMENSION);

    // 1. Create Full Res Blob
    const fullBlob = await processBitmap(bitmap, width, height, QUALITY);
    
    // 2. Create Thumbnail Blob
    const thumbBlob = await processCenterCrop(bitmap, THUMBNAIL_SIZE);

    // 3. Convert to Base64 (needed for current app architecture, though Blobs are preferred long-term)
    const fullBase64 = await blobToBase64(fullBlob);
    const thumbBase64 = await blobToBase64(thumbBlob);

    bitmap.close();

    ctx.postMessage({
      fileId,
      success: true,
      data: {
        full: fullBase64,
        thumbnail: thumbBase64,
        width,
        height
      }
    });

  } catch (err) {
    ctx.postMessage({
      fileId,
      success: false,
      error: (err as Error).message
    });
  }
};

function calculateDimensions(w: number, h: number, max: number) {
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

async function processBitmap(bitmap: ImageBitmap, w: number, h: number, q: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(w, h);
  const context = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
  context.drawImage(bitmap, 0, 0, w, h);
  return await canvas.convertToBlob({ type: 'image/webp', quality: q });
}

async function processCenterCrop(bitmap: ImageBitmap, size: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
  
  const minDim = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - minDim) / 2;
  const sy = (bitmap.height - minDim) / 2;
  
  context.drawImage(bitmap, sx, sy, minDim, minDim, 0, 0, size, size);
  return await canvas.convertToBlob({ type: 'image/webp', quality: 0.5 });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        resolve('');
      }
    };
    reader.readAsDataURL(blob);
  });
}

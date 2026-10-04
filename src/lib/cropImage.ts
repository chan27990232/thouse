import type { Area } from 'react-easy-crop';

type DrawableImage = HTMLImageElement | ImageBitmap;

async function loadImage(src: string): Promise<DrawableImage> {
  const response = await fetch(src);
  const blob = await response.blob();

  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      // Fallback for browsers that reject imageOrientation.
    }
    try {
      return await createImageBitmap(blob);
    } catch {
      // Continue to HTMLImageElement fallback.
    }
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('IMAGE_LOAD_FAILED')));
    image.crossOrigin = 'anonymous';
    image.src = src;
  });
}

/**
 * 依 react-easy-crop 的 pixelCrop 產出正方形 JPEG Blob。
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  maxSize = 512,
  quality = 0.92,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const outputSize = Math.min(maxSize, Math.round(Math.max(pixelCrop.width, pixelCrop.height)));
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('CANVAS_UNAVAILABLE');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  if ('close' in image && typeof image.close === 'function') {
    image.close();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('CROP_FAILED'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

export function blobToJpegFile(blob: Blob, filename: string): File {
  try {
    return new File([blob], filename, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    const fallback = blob as File;
    Object.defineProperty(fallback, 'name', { value: filename, configurable: true });
    return fallback;
  }
}

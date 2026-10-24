/* Decode originals off the UI thread; only a small thumbnail returns to the composer. */
'use strict';

self.onmessage = async ({ data }) => {
  let bitmap;
  try {
    bitmap = await createImageBitmap(data.file, { resizeWidth: 128, resizeQuality: 'low' });
    const scale = Math.min(1, 128 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    bitmap = null;
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({ blob: null });
  } finally {
    bitmap?.close();
  }
};

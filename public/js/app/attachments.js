(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const config = root.config || {};

  const VIDEO_POSTER_MIME = config.VIDEO_POSTER_MIME || 'image/jpeg';
  const VIDEO_POSTER_MAX_DIMENSION = Number(config.VIDEO_POSTER_MAX_DIMENSION || 960);
  const VIDEO_POSTER_QUALITY = Number(config.VIDEO_POSTER_QUALITY || 0.82);
  const VIDEO_POSTER_CAPTURE_TIMEOUT_MS = Number(config.VIDEO_POSTER_CAPTURE_TIMEOUT_MS || 8000);
  const VIDEO_POSTER_CAPTURE_SEEKS = Array.from(config.VIDEO_POSTER_CAPTURE_SEEKS || [0, 0.05, 0.12, 0.25]);

  function getStoredAttachmentUrl(storedName, { preview = false } = {}) {
    const name = String(storedName || '').trim();
    if (!name) return '';
    const encoded = encodeURIComponent(name);
    return preview ? `/uploads/${encoded}/preview` : `/uploads/${encoded}`;
  }

  function getStoredAttachmentPosterUrl(storedName) {
    const name = String(storedName || '').trim();
    return name ? `/uploads/${encodeURIComponent(name)}/poster` : '';
  }

  function resolveAttachmentUrl(source, { preview = false } = {}) {
    if (!source) return '';
    if (typeof source === 'string') {
      return getStoredAttachmentUrl(source, { preview });
    }
    const localUrl = String(source.client_file_url || source.clientFileUrl || '').trim();
    if (localUrl) return localUrl;
    return getStoredAttachmentUrl(source.file_stored || source.stored_name || source.storedName || '', { preview });
  }

  function getAttachmentPreviewUrl(source) {
    return resolveAttachmentUrl(source, { preview: true });
  }

  function getAttachmentDownloadUrl(source) {
    return resolveAttachmentUrl(source, { preview: false });
  }

  function getAttachmentPosterUrl(source) {
    if (!source) return '';
    if (typeof source === 'string') {
      return getStoredAttachmentPosterUrl(source);
    }
    const localPosterUrl = String(source.client_poster_url || source.clientPosterUrl || '').trim();
    if (localPosterUrl) return localPosterUrl;
    const hasPoster = Boolean(
      source.file_poster_available
      || source.filePosterAvailable
      || source.poster_available
      || source.posterAvailable
    );
    if (!hasPoster) return '';
    const storedName = source.file_stored || source.stored_name || source.storedName || '';
    return getStoredAttachmentPosterUrl(storedName);
  }

  function isVideoAttachmentMessage(source) {
    return String(source?.file_type || source?.fileType || '').trim().toLowerCase() === 'video';
  }

  function createTimeoutError(message = 'Timed out') {
    const error = new Error(message);
    error.name = 'TimeoutError';
    return error;
  }

  function waitForMediaEvent(target, eventNames = [], {
    ready = null,
    timeoutMs = VIDEO_POSTER_CAPTURE_TIMEOUT_MS,
  } = {}) {
    return new Promise((resolve, reject) => {
      if (typeof ready === 'function' && ready()) {
        resolve();
        return;
      }

      const names = [...new Set((Array.isArray(eventNames) ? eventNames : [eventNames]).filter(Boolean))];
      const cleanup = () => {
        clearTimeout(timerId);
        names.forEach((name) => target.removeEventListener(name, onReady));
        target.removeEventListener('error', onError);
      };
      const finish = (callback) => {
        cleanup();
        callback();
      };
      const onReady = () => {
        if (typeof ready === 'function' && !ready()) return;
        finish(resolve);
      };
      const onError = () => {
        finish(() => reject(target.error || new Error('Media load failed')));
      };
      const timerId = setTimeout(() => {
        finish(() => reject(createTimeoutError('Media load timed out')));
      }, timeoutMs);

      names.forEach((name) => target.addEventListener(name, onReady));
      target.addEventListener('error', onError);
    });
  }

  async function waitForVideoFrame(video) {
    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) return;
    await waitForMediaEvent(video, ['loadeddata', 'canplay', 'seeked'], {
      ready: () => video.readyState >= 2 && video.videoWidth && video.videoHeight,
    });
  }

  async function seekVideoFrame(video, time) {
    const duration = Number(video.duration || 0);
    const safeTime = duration > 0
      ? Math.min(Math.max(0, Number(time || 0)), Math.max(0, duration - 0.05))
      : Math.max(0, Number(time || 0));
    const epsilon = safeTime > 0 ? 0.02 : 0.001;
    if (Math.abs(Number(video.currentTime || 0) - safeTime) <= epsilon) {
      await waitForVideoFrame(video);
      return;
    }

    await new Promise((resolve, reject) => {
      const onSeeked = () => cleanup(resolve);
      const onError = () => cleanup(() => reject(video.error || new Error('Video seek failed')));
      const cleanup = (callback) => {
        clearTimeout(timerId);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        callback();
      };
      const timerId = setTimeout(() => cleanup(resolve), 650);
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      try {
        video.currentTime = safeTime;
      } catch (error) {
        cleanup(() => reject(error));
      }
    });
    await waitForVideoFrame(video);
  }

  async function drawVideoPosterBlob(video) {
    const width = Number(video.videoWidth || 0);
    const height = Number(video.videoHeight || 0);
    if (!width || !height) return null;

    const scale = Math.min(1, VIDEO_POSTER_MAX_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (typeof canvas.toBlob === 'function') {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob && blob.size ? blob : null), VIDEO_POSTER_MIME, VIDEO_POSTER_QUALITY);
      });
    }

    const dataUrl = canvas.toDataURL(VIDEO_POSTER_MIME, VIDEO_POSTER_QUALITY);
    if (!dataUrl) return null;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return blob && blob.size ? blob : null;
  }

  async function createAttachmentPosterBlob(source) {
    const isBlob = typeof Blob !== 'undefined' && source instanceof Blob;
    const sourceUrl = isBlob
      ? URL.createObjectURL(source)
      : String(source || '').trim();
    if (!sourceUrl) return null;

    const shouldRevokeUrl = isBlob;
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

    try {
      video.src = sourceUrl;
      video.load?.();
      await waitForMediaEvent(video, ['loadedmetadata', 'loadeddata', 'canplay'], {
        ready: () => video.readyState >= 1 && video.videoWidth && video.videoHeight,
      });

      const duration = Number(video.duration || 0);
      const seekTargets = [...new Set(VIDEO_POSTER_CAPTURE_SEEKS
        .map((time) => {
          if (duration > 0) return Math.min(Math.max(0, Number(time || 0)), Math.max(0, duration - 0.05));
          return Math.max(0, Number(time || 0));
        })
        .filter((time) => Number.isFinite(time) && time >= 0))];

      if (!seekTargets.length) seekTargets.push(0);
      for (const seekTarget of seekTargets) {
        try {
          await seekVideoFrame(video, seekTarget);
          const posterBlob = await drawVideoPosterBlob(video);
          if (posterBlob) return posterBlob;
        } catch (error) {}
      }
    } catch (error) {
      return null;
    } finally {
      try {
        video.pause?.();
        video.removeAttribute('src');
        video.load?.();
      } catch (error) {}
      if (shouldRevokeUrl) {
        try { URL.revokeObjectURL(sourceUrl); } catch (error) {}
      }
    }

    return null;
  }

  root.attachments = Object.freeze({
    getStoredAttachmentUrl,
    getStoredAttachmentPosterUrl,
    resolveAttachmentUrl,
    getAttachmentPreviewUrl,
    getAttachmentDownloadUrl,
    getAttachmentPosterUrl,
    isVideoAttachmentMessage,
    createTimeoutError,
    waitForMediaEvent,
    waitForVideoFrame,
    seekVideoFrame,
    drawVideoPosterBlob,
    createAttachmentPosterBlob,
  });
})();

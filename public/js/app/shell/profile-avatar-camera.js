(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const shellRoot = root.shell = root.shell || {};

  function createProfileAvatarCameraController(options = {}) {
    const win = options.window || window;
    const doc = options.document || document;
    const nav = options.navigator || win.navigator;
    const $ = options.$ || ((selector) => doc.querySelector(selector));
    const openModal = options.openModal || (() => null);
    const closeModal = options.closeModal || (() => false);
    const registerModal = options.registerModal || (() => null);
    const setInlineStatus = options.setInlineStatus || (() => {});
    const setProfileStatus = options.setProfileStatus || (() => {});
    const uploadProfileAvatar = options.uploadProfileAvatar || (async () => false);

    let stream = null;

    function setCameraStatus(message, type = '') {
      setInlineStatus('profileCameraStatus', message, type);
    }

    function stopStream() {
      const currentStream = stream;
      stream = null;
      if (currentStream && typeof currentStream.getTracks === 'function') {
        currentStream.getTracks().forEach((track) => {
          try { track.stop?.(); } catch {}
        });
      }
      const video = $('#profileCameraVideo');
      if (!video) return;
      try {
        if (video.readyState > 0) video.pause?.();
      } catch {}
      try { video.srcObject = null; } catch {}
      video.removeAttribute('src');
    }

    function closeCamera() {
      stopStream();
      closeModal('profileCameraModal');
    }

    function errorMessage(error) {
      const name = String(error?.name || '');
      return name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Camera permission denied'
        : 'Camera unavailable';
    }

    function fileFromBlob(blob) {
      const FileCtor = typeof win.File === 'function' ? win.File : null;
      try {
        if (FileCtor) return new FileCtor([blob], 'avatar-camera.jpg', { type: 'image/jpeg', lastModified: Date.now() });
      } catch {}
      try {
        Object.defineProperty(blob, 'name', { configurable: true, value: 'avatar-camera.jpg' });
        Object.defineProperty(blob, 'lastModified', { configurable: true, value: Date.now() });
      } catch {}
      return blob;
    }

    function canvasToBlob(canvas) {
      return new Promise((resolve, reject) => {
        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Camera unavailable'));
          }, 'image/jpeg', 0.92);
          return;
        }
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          const base64 = String(dataUrl).split(',')[1] || '';
          const binary = win.atob(base64);
          const bytes = new (win.Uint8Array || Uint8Array)(binary.length);
          for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
          }
          resolve(new (win.Blob || Blob)([bytes], { type: 'image/jpeg' }));
        } catch (error) {
          reject(error);
        }
      });
    }

    async function openCamera() {
      const fallbackInput = $('#profileAvatarCameraInput');
      if (!nav.mediaDevices?.getUserMedia) {
        fallbackInput?.click();
        return;
      }

      stopStream();
      setCameraStatus('');
      openModal('profileCameraModal', { opener: $('#profileAvatarPickIcon') });
      const captureBtn = $('#profileCameraCaptureBtn');
      if (captureBtn) captureBtn.disabled = true;

      try {
        stream = await nav.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        const video = $('#profileCameraVideo');
        if (video) {
          video.srcObject = stream;
          if (typeof video.play === 'function') {
            await Promise.resolve(video.play()).catch(() => {});
          }
        }
        if (captureBtn) captureBtn.disabled = false;
      } catch (error) {
        stopStream();
        closeModal('profileCameraModal', { immediate: true });
        setProfileStatus(errorMessage(error), 'error');
      }
    }

    async function capture() {
      const video = $('#profileCameraVideo');
      const captureBtn = $('#profileCameraCaptureBtn');
      if (!stream || !video) {
        setCameraStatus('Camera unavailable', 'error');
        return;
      }

      setCameraStatus('');
      if (captureBtn) captureBtn.disabled = true;
      try {
        const width = Math.max(1, Math.round(video.videoWidth || video.clientWidth || 640));
        const height = Math.max(1, Math.round(video.videoHeight || video.clientHeight || width));
        const canvas = doc.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Camera unavailable');
        context.drawImage(video, 0, 0, width, height);
        const uploaded = await uploadProfileAvatar(fileFromBlob(await canvasToBlob(canvas)));
        if (uploaded) closeCamera();
        else {
          setCameraStatus('Upload failed', 'error');
          if (captureBtn) captureBtn.disabled = false;
        }
      } catch (error) {
        setCameraStatus(error.message || 'Camera unavailable', 'error');
        if (captureBtn) captureBtn.disabled = false;
      }
    }

    async function handleFileInputChange(event) {
      const input = event?.currentTarget || event?.target;
      const file = input?.files?.[0];
      try {
        await uploadProfileAvatar(file);
      } finally {
        if (input) input.value = '';
      }
    }

    function bindEvents() {
      registerModal('profileCameraModal', { onAfterClose: stopStream });
      $('#profileAvatarPickBtn')?.addEventListener('click', () => $('#profileAvatarInput')?.click());
      $('#profileAvatarPickIcon')?.addEventListener('click', () => {
        openCamera().catch((error) => {
          stopStream();
          setProfileStatus(errorMessage(error), 'error');
        });
      });
      ['#profileAvatarInput', '#profileAvatarCameraInput'].forEach((selector) => {
        $(selector)?.addEventListener('change', handleFileInputChange);
      });
      $('#profileCameraCancelBtn')?.addEventListener('click', closeCamera);
      $('#profileCameraCaptureBtn')?.addEventListener('click', () => {
        capture().catch((error) => setCameraStatus(error.message || 'Camera unavailable', 'error'));
      });
    }

    return { bindEvents, capture, closeCamera, openCamera, stopStream };
  }

  shellRoot.profileAvatarCamera = { createProfileAvatarCameraController };
})();

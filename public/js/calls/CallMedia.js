(function () {
  'use strict';

  async function enumerateDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      return await navigator.mediaDevices.enumerateDevices();
    } catch {
      return [];
    }
  }

  function deviceConstraint(deviceId) {
    const id = String(deviceId || '');
    return id ? { deviceId: { exact: id } } : true;
  }

  async function getPreviewStream(options = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error('Media devices are not supported');
      error.code = 'media_unsupported';
      throw error;
    }
    const audioEnabled = options.audioEnabled !== false;
    const videoEnabled = options.videoEnabled !== false;
    if (!audioEnabled && !videoEnabled) return null;
    const constraints = {
      audio: audioEnabled ? deviceConstraint(options.audioDeviceId) : false,
      video: videoEnabled ? deviceConstraint(options.videoDeviceId) : false,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  function stopStream(stream) {
    try {
      stream?.getTracks?.().forEach((track) => track.stop?.());
    } catch {}
  }

  function attachPreview(video, stream) {
    if (!video) return;
    video.srcObject = stream || null;
    video.muted = true;
    video.playsInline = true;
  }

  function isScreenShareSupported() {
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    return Boolean(navigator.mediaDevices?.getDisplayMedia && !coarse);
  }

  window.BananzaCallMedia = {
    attachPreview,
    enumerateDevices,
    getPreviewStream,
    isScreenShareSupported,
    stopStream,
  };
})();

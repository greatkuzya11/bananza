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

  function streamTracks(stream) {
    try {
      return Array.from(stream?.getTracks?.() || []);
    } catch {
      return [];
    }
  }

  function streamFromTracks(tracks = []) {
    const cleanTracks = tracks.filter(Boolean);
    if (!cleanTracks.length) return null;
    if (typeof MediaStream === 'function') return new MediaStream(cleanTracks);
    return {
      getTracks: () => [...cleanTracks],
      getAudioTracks: () => cleanTracks.filter((track) => track?.kind === 'audio'),
      getVideoTracks: () => cleanTracks.filter((track) => track?.kind === 'video'),
    };
  }

  async function getPreviewMedia(options = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error('Media devices are not supported');
      error.code = 'media_unsupported';
      throw error;
    }
    const audioEnabled = options.audioEnabled !== false;
    const videoEnabled = options.videoEnabled !== false;
    const result = {
      stream: null,
      audio: false,
      video: false,
      requestedAudio: audioEnabled,
      requestedVideo: videoEnabled,
      errors: {},
    };
    if (!audioEnabled && !videoEnabled) return result;

    const requestKind = async (kind, deviceId) => navigator.mediaDevices.getUserMedia({
      audio: kind === 'audio' ? deviceConstraint(deviceId) : false,
      video: kind === 'video' ? deviceConstraint(deviceId) : false,
    });

    const tracks = [];
    if (audioEnabled) {
      try {
        const audioStream = await requestKind('audio', options.audioDeviceId);
        const audioTracks = streamTracks(audioStream).filter((track) => track?.kind === 'audio');
        tracks.push(...audioTracks);
        result.audio = audioTracks.length > 0;
      } catch (error) {
        result.errors.audio = error;
      }
    }
    if (videoEnabled) {
      try {
        const videoStream = await requestKind('video', options.videoDeviceId);
        const videoTracks = streamTracks(videoStream).filter((track) => track?.kind === 'video');
        tracks.push(...videoTracks);
        result.video = videoTracks.length > 0;
      } catch (error) {
        result.errors.video = error;
      }
    }

    result.stream = streamFromTracks(tracks);
    if (!result.stream) {
      const error = result.errors.audio || result.errors.video || new Error('Camera or microphone unavailable');
      throw error;
    }
    return result;
  }

  async function getPreviewStream(options = {}) {
    const media = await getPreviewMedia(options);
    return media.stream;
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
    getPreviewMedia,
    getPreviewStream,
    isScreenShareSupported,
    stopStream,
  };
})();

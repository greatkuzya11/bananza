(function () {
  'use strict';

  const DEVICE_PREFS_KEY = 'bananza.call.devicePrefs.v1';

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage?.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage?.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function loadDevicePrefs() {
    const prefs = readJson(DEVICE_PREFS_KEY, {});
    return {
      audioinput: String(prefs.audioinput || ''),
      videoinput: String(prefs.videoinput || ''),
      audiooutput: String(prefs.audiooutput || ''),
    };
  }

  function saveDevicePrefs(patch = {}) {
    const next = { ...loadDevicePrefs(), ...patch };
    writeJson(DEVICE_PREFS_KEY, next);
    return next;
  }

  function defaultSettings() {
    return {
      calls_enabled: false,
      livekit_ready: false,
      allow_private_calls: true,
      allow_group_calls: true,
      ring_timeout_ms: 60000,
      screen_share_enabled: true,
      ringtone_enabled: true,
      call_messages_enabled: true,
      max_call_participants: 20,
    };
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.round(Number(ms || 0) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  window.BananzaCallStore = {
    defaultSettings,
    formatDuration,
    loadDevicePrefs,
    saveDevicePrefs,
  };
})();

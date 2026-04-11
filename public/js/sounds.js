(function () {
  'use strict';

  const TYPE_FLAGS = {
    send: 'play_send',
    incoming: 'play_incoming',
    notification: 'play_notifications',
    reaction: 'play_reactions',
    invite: 'play_invites',
    voice_start: 'play_voice',
    voice_stop: 'play_voice',
  };
  const DEFAULT_SETTINGS = {
    sounds_enabled: true,
    volume: 55,
    play_send: true,
    play_incoming: true,
    play_notifications: true,
    play_reactions: true,
    play_invites: true,
    play_voice: true,
  };
  const THROTTLE_MS = {
    send: 80,
    incoming: 140,
    notification: 420,
    reaction: 180,
    invite: 500,
    voice_start: 80,
    voice_stop: 80,
  };

  let settings = { ...DEFAULT_SETTINGS };
  let audioContext = null;
  let unlocked = false;
  const lastPlayedAt = new Map();

  function clampVolume(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_SETTINGS.volume;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  function normalizeSettings(next = {}) {
    return {
      sounds_enabled: next.sounds_enabled ?? DEFAULT_SETTINGS.sounds_enabled,
      volume: clampVolume(next.volume),
      play_send: next.play_send ?? DEFAULT_SETTINGS.play_send,
      play_incoming: next.play_incoming ?? DEFAULT_SETTINGS.play_incoming,
      play_notifications: next.play_notifications ?? DEFAULT_SETTINGS.play_notifications,
      play_reactions: next.play_reactions ?? DEFAULT_SETTINGS.play_reactions,
      play_invites: next.play_invites ?? DEFAULT_SETTINGS.play_invites,
      play_voice: next.play_voice ?? DEFAULT_SETTINGS.play_voice,
    };
  }

  function ensureContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return audioContext;
  }

  function unlock() {
    const ctx = ensureContext();
    if (!ctx) return;
    unlocked = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function canPlay(type, options = {}) {
    if (!options.preview && !settings.sounds_enabled) return false;
    if (!options.preview && TYPE_FLAGS[type] && !settings[TYPE_FLAGS[type]]) return false;
    if (clampVolume(settings.volume) <= 0) return false;
    if (document.hidden && !options.allowHidden) return false;
    const now = performance.now();
    const throttleMs = options.preview ? 0 : (THROTTLE_MS[type] || 160);
    const prev = lastPlayedAt.get(type) || 0;
    if (throttleMs && now - prev < throttleMs) return false;
    lastPlayedAt.set(type, now);
    return true;
  }

  function masterGain(multiplier = 1) {
    return Math.max(0, Math.min(1, settings.volume / 100)) * 0.24 * multiplier;
  }

  function tone(ctx, at, freq, duration, gainValue, options = {}) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = options.filter ? ctx.createBiquadFilter() : null;
    const attack = options.attack ?? 0.006;
    const release = options.release ?? Math.min(duration * 0.65, 0.12);
    const end = at + duration;

    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (options.toFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.toFreq), end);
    }

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, masterGain(gainValue)), at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(at + attack + 0.001, end - release));
    gain.gain.linearRampToValueAtTime(0, end);

    if (filter) {
      filter.type = options.filter.type || 'lowpass';
      filter.frequency.setValueAtTime(options.filter.frequency || 2400, at);
      filter.Q.setValueAtTime(options.filter.q || 0.7, at);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(end + 0.02);
  }

  function noiseTick(ctx, at, duration, gainValue, options = {}) {
    const sampleRate = ctx.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    source.buffer = buffer;
    filter.type = options.filterType || 'bandpass';
    filter.frequency.setValueAtTime(options.frequency || 900, at);
    filter.Q.setValueAtTime(options.q || 4, at);
    gain.gain.setValueAtTime(masterGain(gainValue), at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(at);
    source.stop(at + duration + 0.02);
  }

  function playPattern(type, options = {}) {
    if (!canPlay(type, options)) return false;
    const ctx = ensureContext();
    if (!ctx) return false;
    const now = ctx.currentTime + 0.01;

    if (type === 'send') {
      noiseTick(ctx, now, 0.055, 0.55, { frequency: 720, q: 6 });
      tone(ctx, now + 0.012, 420, 0.07, 0.24, { type: 'triangle', filter: { frequency: 1200 } });
    } else if (type === 'incoming') {
      tone(ctx, now, 660, 0.085, 0.36, { type: 'sine' });
      tone(ctx, now + 0.07, 880, 0.09, 0.3, { type: 'sine' });
    } else if (type === 'notification') {
      tone(ctx, now, 740, 0.11, 0.32, { type: 'sine' });
      tone(ctx, now + 0.075, 988, 0.11, 0.28, { type: 'sine' });
      tone(ctx, now + 0.15, 1318, 0.13, 0.22, { type: 'sine' });
    } else if (type === 'reaction') {
      tone(ctx, now, 520, 0.11, 0.34, { type: 'triangle', toFreq: 920, attack: 0.003, release: 0.08 });
      noiseTick(ctx, now + 0.055, 0.04, 0.25, { frequency: 1400, q: 5 });
    } else if (type === 'invite') {
      tone(ctx, now, 392, 0.18, 0.24, { type: 'sine' });
      tone(ctx, now + 0.045, 494, 0.18, 0.22, { type: 'sine' });
      tone(ctx, now + 0.09, 659, 0.2, 0.22, { type: 'sine' });
    } else if (type === 'voice_start') {
      tone(ctx, now, 880, 0.055, 0.22, { type: 'square', filter: { frequency: 1800 } });
    } else if (type === 'voice_stop') {
      tone(ctx, now, 660, 0.045, 0.18, { type: 'square', filter: { frequency: 1600 } });
      tone(ctx, now + 0.045, 440, 0.055, 0.16, { type: 'square', filter: { frequency: 1200 } });
    } else {
      return false;
    }
    return true;
  }

  function configure(nextSettings = {}) {
    settings = normalizeSettings({ ...settings, ...nextSettings });
  }

  function preview(type) {
    unlock();
    return playPattern(type, { preview: true });
  }

  function installUnlockListeners() {
    ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
      window.addEventListener(eventName, unlock, { once: true, passive: true });
    });
  }

  window.BananzaSounds = {
    configure,
    play: playPattern,
    preview,
    unlock,
    getSettings: () => ({ ...settings, unlocked }),
  };

  installUnlockListeners();
})();

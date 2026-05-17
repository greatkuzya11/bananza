const VIDEO_NOTE_SETTINGS_KEY = 'video_note_settings';

const DEFAULT_VIDEO_NOTE_SETTINGS = {
  video_notes_enabled: true,
  video_note_default_shape_id: 'banana-fat',
  video_note_transcription_mode: 'manual',
  video_note_transcription_provider: 'voice',
  video_note_max_duration_ms: 30000,
};

const VIDEO_NOTE_SETTINGS_OPTIONS = {
  shapes: [
    { value: 'banana-fat', label: 'Banana' },
    { value: 'circle', label: 'Circle' },
  ],
  transcription_modes: [
    { value: 'manual', label: 'Manual' },
    { value: 'auto', label: 'Automatic' },
  ],
  providers: [
    { value: 'voice', label: 'Use voice provider' },
    { value: 'vosk', label: 'Vosk (local/free)' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'grok', label: 'Grok' },
  ],
};

const VIDEO_NOTE_SETTING_KEYS = Object.keys(DEFAULT_VIDEO_NOTE_SETTINGS);
const SHAPE_IDS = new Set(VIDEO_NOTE_SETTINGS_OPTIONS.shapes.map((item) => item.value));
const TRANSCRIPTION_MODES = new Set(VIDEO_NOTE_SETTINGS_OPTIONS.transcription_modes.map((item) => item.value));
const PROVIDERS = new Set(VIDEO_NOTE_SETTINGS_OPTIONS.providers.map((item) => item.value));

function pickKnownSettings(raw = {}) {
  const picked = {};
  for (const key of VIDEO_NOTE_SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      picked[key] = raw[key];
    }
  }
  return picked;
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return fallback;
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeVideoNoteSettings(raw = {}) {
  const next = { ...DEFAULT_VIDEO_NOTE_SETTINGS, ...pickKnownSettings(raw) };
  next.video_notes_enabled = normalizeBoolean(
    next.video_notes_enabled,
    DEFAULT_VIDEO_NOTE_SETTINGS.video_notes_enabled
  );

  next.video_note_default_shape_id = String(
    next.video_note_default_shape_id || DEFAULT_VIDEO_NOTE_SETTINGS.video_note_default_shape_id
  ).trim();
  if (!SHAPE_IDS.has(next.video_note_default_shape_id)) {
    next.video_note_default_shape_id = DEFAULT_VIDEO_NOTE_SETTINGS.video_note_default_shape_id;
  }

  next.video_note_transcription_mode = String(
    next.video_note_transcription_mode || DEFAULT_VIDEO_NOTE_SETTINGS.video_note_transcription_mode
  ).trim();
  if (!TRANSCRIPTION_MODES.has(next.video_note_transcription_mode)) {
    next.video_note_transcription_mode = DEFAULT_VIDEO_NOTE_SETTINGS.video_note_transcription_mode;
  }

  next.video_note_transcription_provider = String(
    next.video_note_transcription_provider || DEFAULT_VIDEO_NOTE_SETTINGS.video_note_transcription_provider
  ).trim();
  if (!PROVIDERS.has(next.video_note_transcription_provider)) {
    next.video_note_transcription_provider = DEFAULT_VIDEO_NOTE_SETTINGS.video_note_transcription_provider;
  }

  next.video_note_max_duration_ms = clampNumber(
    next.video_note_max_duration_ms,
    DEFAULT_VIDEO_NOTE_SETTINGS.video_note_max_duration_ms,
    5_000,
    120_000
  );

  return next;
}

function readStoredSettings(db) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key=?').get(VIDEO_NOTE_SETTINGS_KEY);
  if (!row) return { ...DEFAULT_VIDEO_NOTE_SETTINGS };
  try {
    return normalizeVideoNoteSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_VIDEO_NOTE_SETTINGS };
  }
}

function writeStoredSettings(db, settings) {
  const payload = JSON.stringify(normalizeVideoNoteSettings(settings));
  db.prepare(`
    INSERT INTO app_settings(key, value, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value=excluded.value,
      updated_at=datetime('now')
  `).run(VIDEO_NOTE_SETTINGS_KEY, payload);
}

function getVideoNoteSettings(db) {
  return normalizeVideoNoteSettings(readStoredSettings(db));
}

function setVideoNoteSettings(db, incoming = {}) {
  const current = getVideoNoteSettings(db);
  const next = normalizeVideoNoteSettings({
    ...current,
    ...pickKnownSettings(incoming),
  });
  writeStoredSettings(db, next);
  return next;
}

function getAdminVideoNoteSettings(db) {
  return getVideoNoteSettings(db);
}

function getPublicVideoNoteSettings(db) {
  const settings = getVideoNoteSettings(db);
  return {
    video_notes_enabled: settings.video_notes_enabled,
    video_note_default_shape_id: settings.video_note_default_shape_id,
    video_note_transcription_mode: settings.video_note_transcription_mode,
    video_note_transcription_provider: settings.video_note_transcription_provider,
    video_note_max_duration_ms: settings.video_note_max_duration_ms,
  };
}

function resolveVideoNoteTranscriptionSettings(voiceSettings = {}, videoNoteSettings = {}) {
  const videoSettings = normalizeVideoNoteSettings(videoNoteSettings);
  if (videoSettings.video_note_transcription_provider === 'voice') {
    return { ...voiceSettings };
  }
  return {
    ...voiceSettings,
    active_provider: videoSettings.video_note_transcription_provider,
  };
}

module.exports = {
  DEFAULT_VIDEO_NOTE_SETTINGS,
  VIDEO_NOTE_SETTINGS_OPTIONS,
  getVideoNoteSettings,
  getAdminVideoNoteSettings,
  getPublicVideoNoteSettings,
  setVideoNoteSettings,
  normalizeVideoNoteSettings,
  resolveVideoNoteTranscriptionSettings,
};

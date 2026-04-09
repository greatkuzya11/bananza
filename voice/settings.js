const { encryptText, decryptText, maskSecret } = require('./crypto');

const VOICE_SETTINGS_KEY = 'voice_settings';

const VOICE_SETTINGS_OPTIONS = {
  providers: [
    { value: 'vosk', label: 'Vosk (local/free)' },
    { value: 'openai', label: 'OpenAI' },
  ],
  models: {
    vosk: [
      { value: 'vosk-model-small-ru-0.22', label: 'vosk-model-small-ru-0.22' },
      { value: 'vosk-model-ru-0.42', label: 'vosk-model-ru-0.42' },
      { value: 'vosk-model-ru-0.10', label: 'vosk-model-ru-0.10' },
    ],
    openai: [
      { value: 'gpt-4o-mini-transcribe', label: 'gpt-4o-mini-transcribe' },
      { value: 'gpt-4o-transcribe', label: 'gpt-4o-transcribe' },
    ],
  },
};

const DEFAULT_VOICE_SETTINGS = {
  voice_notes_enabled: false,
  auto_transcribe_on_send: false,
  active_provider: 'vosk',
  fallback_to_openai: false,
  min_record_ms: 500,
  max_record_ms: 120000,
  transcription_timeout_ms: 60000,
  queue_concurrency: 1,
  openai_model: 'gpt-4o-mini-transcribe',
  openai_language: 'ru',
  openai_key_encrypted: '',
  openai_key_masked: '',
  vosk_helper_url: 'http://127.0.0.1:2700',
  vosk_model: 'vosk-model-small-ru-0.22',
  vosk_model_path: '',
  last_model_test_status: '',
  last_model_test_at: '',
  last_model_test_provider: '',
  last_model_test_model: '',
  last_model_test_latency_ms: null,
  last_model_test_excerpt: '',
  last_model_test_error: '',
};

const VOICE_SETTING_KEYS = Object.keys(DEFAULT_VOICE_SETTINGS);

function pickKnownSettings(raw = {}) {
  const picked = {};
  for (const key of VOICE_SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      picked[key] = raw[key];
    }
  }
  return picked;
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return fallback;
}

function normalizeSettings(raw = {}) {
  const next = { ...DEFAULT_VOICE_SETTINGS, ...pickKnownSettings(raw) };
  next.voice_notes_enabled = normalizeBoolean(next.voice_notes_enabled, DEFAULT_VOICE_SETTINGS.voice_notes_enabled);
  next.auto_transcribe_on_send = normalizeBoolean(next.auto_transcribe_on_send, DEFAULT_VOICE_SETTINGS.auto_transcribe_on_send);
  next.fallback_to_openai = normalizeBoolean(next.fallback_to_openai, DEFAULT_VOICE_SETTINGS.fallback_to_openai);
  next.min_record_ms = clampNumber(next.min_record_ms, DEFAULT_VOICE_SETTINGS.min_record_ms, 300, 10_000);
  next.max_record_ms = clampNumber(next.max_record_ms, DEFAULT_VOICE_SETTINGS.max_record_ms, 5_000, 600_000);
  next.transcription_timeout_ms = clampNumber(
    next.transcription_timeout_ms,
    DEFAULT_VOICE_SETTINGS.transcription_timeout_ms,
    5_000,
    300_000
  );
  next.queue_concurrency = clampNumber(next.queue_concurrency, DEFAULT_VOICE_SETTINGS.queue_concurrency, 1, 4);
  next.openai_model = String(next.openai_model || DEFAULT_VOICE_SETTINGS.openai_model).trim() || DEFAULT_VOICE_SETTINGS.openai_model;
  next.openai_language = String(next.openai_language || DEFAULT_VOICE_SETTINGS.openai_language).trim() || DEFAULT_VOICE_SETTINGS.openai_language;
  next.vosk_helper_url = String(next.vosk_helper_url || DEFAULT_VOICE_SETTINGS.vosk_helper_url).trim() || DEFAULT_VOICE_SETTINGS.vosk_helper_url;
  next.vosk_model = String(next.vosk_model || DEFAULT_VOICE_SETTINGS.vosk_model).trim() || DEFAULT_VOICE_SETTINGS.vosk_model;
  next.vosk_model_path = String(next.vosk_model_path || '').trim();
  if (!['vosk', 'openai'].includes(next.active_provider)) {
    next.active_provider = DEFAULT_VOICE_SETTINGS.active_provider;
  }
  next.openai_key_encrypted = String(next.openai_key_encrypted || '');
  next.openai_key_masked = String(next.openai_key_masked || '');
  next.last_model_test_status = String(next.last_model_test_status || '');
  next.last_model_test_at = String(next.last_model_test_at || '');
  next.last_model_test_provider = String(next.last_model_test_provider || '');
  next.last_model_test_model = String(next.last_model_test_model || '');
  next.last_model_test_latency_ms = next.last_model_test_latency_ms == null
    ? null
    : clampNumber(next.last_model_test_latency_ms, null, 0, 3_600_000);
  next.last_model_test_excerpt = String(next.last_model_test_excerpt || '');
  next.last_model_test_error = String(next.last_model_test_error || '');
  return next;
}

function readStoredSettings(db) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key=?').get(VOICE_SETTINGS_KEY);
  if (!row) return { ...DEFAULT_VOICE_SETTINGS };
  try {
    return normalizeSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

function writeStoredSettings(db, settings) {
  const payload = JSON.stringify(normalizeSettings(settings));
  db.prepare(`
    INSERT INTO app_settings(key, value, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value=excluded.value,
      updated_at=datetime('now')
  `).run(VOICE_SETTINGS_KEY, payload);
}

function getVoiceSettings(db) {
  return normalizeSettings(readStoredSettings(db));
}

function getOpenAIKey(db, secret) {
  const settings = getVoiceSettings(db);
  if (!settings.openai_key_encrypted) return '';
  try {
    return decryptText(settings.openai_key_encrypted, secret);
  } catch {
    return '';
  }
}

function setVoiceSettings(db, incoming, secret) {
  const current = getVoiceSettings(db);
  const next = normalizeSettings({
    ...current,
    ...pickKnownSettings(incoming),
  });

  if (Object.prototype.hasOwnProperty.call(incoming, 'openai_api_key')) {
    const plainKey = String(incoming.openai_api_key || '').trim();
    if (plainKey) {
      next.openai_key_encrypted = encryptText(plainKey, secret);
      next.openai_key_masked = maskSecret(plainKey);
    }
  }

  writeStoredSettings(db, next);
  return sanitizeAdminSettings(next);
}

function deleteOpenAIKey(db) {
  const current = getVoiceSettings(db);
  current.openai_key_encrypted = '';
  current.openai_key_masked = '';
  writeStoredSettings(db, current);
  return sanitizeAdminSettings(current);
}

function updateLastModelTest(db, patch) {
  const current = getVoiceSettings(db);
  const next = normalizeSettings({ ...current, ...patch });
  writeStoredSettings(db, next);
  return sanitizeAdminSettings(next);
}

function sanitizeAdminSettings(settings) {
  const normalized = normalizeSettings(settings);
  const {
    openai_key_encrypted,
    ...safeSettings
  } = normalized;
  return {
    ...safeSettings,
    has_openai_key: Boolean(normalized.openai_key_encrypted),
    masked_openai_key: normalized.openai_key_masked || '',
  };
}

function getAdminVoiceSettings(db) {
  return sanitizeAdminSettings(getVoiceSettings(db));
}

function getPublicVoiceSettings(db) {
  const settings = getVoiceSettings(db);
  return {
    voice_notes_enabled: settings.voice_notes_enabled,
    auto_transcribe_on_send: settings.auto_transcribe_on_send,
  };
}

function buildDraftSettings(db, incoming, secret) {
  const current = getVoiceSettings(db);
  const merged = normalizeSettings({
    ...current,
    ...pickKnownSettings(incoming),
  });

  if (Object.prototype.hasOwnProperty.call(incoming, 'openai_api_key')) {
    const plainKey = String(incoming.openai_api_key || '').trim();
    if (plainKey) {
      merged.openai_key_encrypted = encryptText(plainKey, secret);
      merged.openai_key_masked = maskSecret(plainKey);
    }
  }

  return merged;
}

module.exports = {
  DEFAULT_VOICE_SETTINGS,
  VOICE_SETTINGS_OPTIONS,
  getVoiceSettings,
  getAdminVoiceSettings,
  getPublicVoiceSettings,
  getOpenAIKey,
  setVoiceSettings,
  deleteOpenAIKey,
  updateLastModelTest,
  buildDraftSettings,
};

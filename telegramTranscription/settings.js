const { encryptText, decryptText, maskSecret } = require('../voice/crypto');
const { DEFAULT_VOICE_SETTINGS, VOICE_SETTINGS_OPTIONS } = require('../voice/settings');

const SETTINGS_KEY = 'telegram_transcription_settings';
const PROVIDERS = new Set(['vosk', 'whisper', 'openai', 'grok']);

const DEFAULT_SETTINGS = {
  enabled: false,
  bot_token_encrypted: '',
  bot_token_masked: '',
  bot_id: '',
  bot_name: '',
  bot_username: '',
  allowed_user_ids: [],
  active_provider: 'whisper',
  fallback_to_openai: false,
  context_bot_enabled: false,
  context_bot_id: null,
  image_generation_enabled: false,
  image_bot_id: null,
  transcription_timeout_ms: 120000,
  max_file_size_bytes: 20 * 1024 * 1024,
  vosk_model: DEFAULT_VOICE_SETTINGS.vosk_model,
  vosk_model_path: '',
  whisper_model: DEFAULT_VOICE_SETTINGS.whisper_model,
  whisper_language: DEFAULT_VOICE_SETTINGS.whisper_language,
  openai_model: DEFAULT_VOICE_SETTINGS.openai_model,
  openai_language: DEFAULT_VOICE_SETTINGS.openai_language,
  grok_language: DEFAULT_VOICE_SETTINGS.grok_language,
};

const KNOWN_KEYS = Object.keys(DEFAULT_SETTINGS);

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeNullableId(value) {
  const parsed = Number(value || 0);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeAllowedUserIds(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || '').split(/[\s,;]+/);
  return [...new Set(values.map((item) => String(item || '').trim())
    .filter((item) => /^\d{1,20}$/.test(item) && item !== '0'))]
    .sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      return a.localeCompare(b);
    });
}

function pickKnown(raw = {}) {
  const result = {};
  for (const key of KNOWN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) result[key] = raw[key];
  }
  return result;
}

function normalizeSettings(raw = {}) {
  const next = { ...DEFAULT_SETTINGS, ...pickKnown(raw) };
  next.enabled = normalizeBoolean(next.enabled);
  next.fallback_to_openai = normalizeBoolean(next.fallback_to_openai);
  next.context_bot_enabled = normalizeBoolean(next.context_bot_enabled);
  next.context_bot_id = normalizeNullableId(next.context_bot_id);
  next.image_generation_enabled = normalizeBoolean(next.image_generation_enabled);
  next.image_bot_id = normalizeNullableId(next.image_bot_id);
  next.allowed_user_ids = normalizeAllowedUserIds(next.allowed_user_ids);
  next.active_provider = PROVIDERS.has(String(next.active_provider))
    ? String(next.active_provider)
    : DEFAULT_SETTINGS.active_provider;
  next.transcription_timeout_ms = clampInteger(
    next.transcription_timeout_ms,
    DEFAULT_SETTINGS.transcription_timeout_ms,
    5000,
    300000
  );
  next.max_file_size_bytes = clampInteger(
    next.max_file_size_bytes,
    DEFAULT_SETTINGS.max_file_size_bytes,
    1024 * 1024,
    20 * 1024 * 1024
  );
  next.vosk_model = String(next.vosk_model || DEFAULT_SETTINGS.vosk_model).trim() || DEFAULT_SETTINGS.vosk_model;
  next.vosk_model_path = String(next.vosk_model_path || '').trim();
  next.whisper_model = String(next.whisper_model || DEFAULT_SETTINGS.whisper_model).trim();
  if (!VOICE_SETTINGS_OPTIONS.models.whisper.some((item) => item.value === next.whisper_model)) {
    next.whisper_model = DEFAULT_SETTINGS.whisper_model;
  }
  next.whisper_language = String(next.whisper_language || 'ru').trim() || 'ru';
  next.openai_model = String(next.openai_model || DEFAULT_SETTINGS.openai_model).trim() || DEFAULT_SETTINGS.openai_model;
  next.openai_language = String(next.openai_language || 'ru').trim() || 'ru';
  next.grok_language = String(next.grok_language || 'ru').trim() || 'ru';
  next.bot_token_encrypted = String(next.bot_token_encrypted || '');
  next.bot_token_masked = String(next.bot_token_masked || '');
  next.bot_id = String(next.bot_id || '');
  next.bot_name = String(next.bot_name || '').trim().slice(0, 128);
  next.bot_username = String(next.bot_username || '').trim().replace(/^@/, '').slice(0, 64);
  return next;
}

function readSettings(db) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key=?').get(SETTINGS_KEY);
  if (!row) return { ...DEFAULT_SETTINGS, allowed_user_ids: [] };
  try {
    return normalizeSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_SETTINGS, allowed_user_ids: [] };
  }
}

function writeSettings(db, settings) {
  const normalized = normalizeSettings(settings);
  db.prepare(`
    INSERT INTO app_settings(key, value, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
  `).run(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

function buildDraftSettings(db, incoming = {}, secret) {
  const current = readSettings(db);
  const draft = normalizeSettings({ ...current, ...pickKnown(incoming) });
  if (Object.prototype.hasOwnProperty.call(incoming, 'bot_token')) {
    const token = String(incoming.bot_token || '').trim();
    if (token) {
      draft.bot_token_encrypted = encryptText(token, secret);
      draft.bot_token_masked = maskSecret(token);
    }
  }
  return draft;
}

function setSettings(db, incoming = {}, secret) {
  return writeSettings(db, buildDraftSettings(db, incoming, secret));
}

function getBotToken(db, secret) {
  const settings = readSettings(db);
  if (!settings.bot_token_encrypted) return '';
  try {
    return decryptText(settings.bot_token_encrypted, secret);
  } catch {
    return '';
  }
}

function clearBotToken(db) {
  const current = readSettings(db);
  return writeSettings(db, {
    ...current,
    enabled: false,
    image_generation_enabled: false,
    bot_token_encrypted: '',
    bot_token_masked: '',
    bot_id: '',
    bot_name: '',
    bot_username: '',
  });
}

function sanitizeSettings(settings) {
  const normalized = normalizeSettings(settings);
  const { bot_token_encrypted, bot_token_masked, ...safe } = normalized;
  return {
    ...safe,
    has_bot_token: Boolean(bot_token_encrypted),
    masked_bot_token: bot_token_masked || '',
  };
}

function buildProviderSettings(telegramSettings, voiceSettings) {
  const telegram = normalizeSettings(telegramSettings);
  return {
    ...voiceSettings,
    active_provider: telegram.active_provider,
    fallback_to_openai: telegram.fallback_to_openai,
    transcription_timeout_ms: telegram.transcription_timeout_ms,
    vosk_model: telegram.vosk_model,
    vosk_model_path: telegram.vosk_model_path,
    whisper_model: telegram.whisper_model,
    whisper_language: telegram.whisper_language,
    openai_model: telegram.openai_model,
    openai_language: telegram.openai_language,
    grok_language: telegram.grok_language,
    context_bot_enabled: telegram.context_bot_enabled,
    context_bot_id: telegram.context_bot_id,
  };
}

function providerReadiness(settings, voiceSettings, { hasOpenAIKey, hasGrokKey, hasFfmpeg = true } = {}) {
  const localAudioReady = Boolean(hasFfmpeg);
  return {
    vosk: localAudioReady && Boolean(String(voiceSettings?.vosk_helper_url || '').trim()),
    whisper: localAudioReady && Boolean(String(voiceSettings?.whisper_helper_url || '').trim()),
    openai: Boolean(hasOpenAIKey),
    grok: Boolean(hasGrokKey),
    fallback_openai: !settings.fallback_to_openai || Boolean(hasOpenAIKey),
    ffmpeg: localAudioReady,
  };
}

module.exports = {
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  normalizeAllowedUserIds,
  normalizeSettings,
  readSettings,
  writeSettings,
  buildDraftSettings,
  setSettings,
  getBotToken,
  clearBotToken,
  sanitizeSettings,
  buildProviderSettings,
  providerReadiness,
};

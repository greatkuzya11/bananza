const { encryptText, decryptText, maskSecret } = require('../voice/crypto');
const { DEFAULT_VOICE_SETTINGS, VOICE_SETTINGS_OPTIONS } = require('../voice/settings');

const PROVIDERS = new Set(['vosk', 'whisper', 'openai', 'grok']);
const DEFAULT_BOT_SETTINGS = {
  id: null,
  name: '',
  bot_token_encrypted: '',
  bot_token_masked: '',
  telegram_api_bot_id: '',
  telegram_bot_name: '',
  telegram_bot_username: '',
  allowed_user_ids: [],
  transcription_enabled: false,
  image_generation_enabled: false,
  universal_enabled: false,
  generate_image_from_transcription: false,
  active_provider: 'whisper',
  fallback_to_openai: false,
  context_bot_enabled: false,
  context_bot_id: null,
  image_bot_id: null,
  universal_bot_id: null,
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

// Kept as a job-profile compatibility alias.
const DEFAULT_SETTINGS = { ...DEFAULT_BOT_SETTINGS, enabled: false };

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
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
  const values = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
  return [...new Set(values.map((item) => String(item || '').trim())
    .filter((item) => /^\d{1,20}$/.test(item) && item !== '0'))]
    .sort((a, b) => a.length !== b.length ? a.length - b.length : a.localeCompare(b));
}

function parseAllowedUserIds(value) {
  if (Array.isArray(value)) return normalizeAllowedUserIds(value);
  try {
    return normalizeAllowedUserIds(JSON.parse(String(value || '[]')));
  } catch {
    return normalizeAllowedUserIds(value);
  }
}

function normalizeBot(raw = {}) {
  const next = { ...DEFAULT_BOT_SETTINGS, ...raw };
  next.id = normalizeNullableId(next.id);
  next.name = String(next.name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  next.bot_token_encrypted = String(next.bot_token_encrypted || '');
  next.bot_token_masked = String(next.bot_token_masked || '');
  next.telegram_api_bot_id = String(next.telegram_api_bot_id || next.bot_id || '').trim();
  next.telegram_bot_name = String(next.telegram_bot_name || next.bot_name || '').trim().slice(0, 128);
  next.telegram_bot_username = String(next.telegram_bot_username || next.bot_username || '')
    .trim().replace(/^@/, '').slice(0, 64);
  next.allowed_user_ids = normalizeAllowedUserIds(next.allowed_user_ids);
  next.transcription_enabled = normalizeBoolean(
    Object.prototype.hasOwnProperty.call(raw, 'transcription_enabled') ? raw.transcription_enabled : raw.enabled,
    false
  );
  next.image_generation_enabled = normalizeBoolean(next.image_generation_enabled);
  next.universal_enabled = normalizeBoolean(next.universal_enabled);
  next.generate_image_from_transcription = normalizeBoolean(next.generate_image_from_transcription)
    && next.transcription_enabled
    && next.image_generation_enabled;
  next.active_provider = PROVIDERS.has(String(next.active_provider))
    ? String(next.active_provider) : DEFAULT_BOT_SETTINGS.active_provider;
  next.fallback_to_openai = normalizeBoolean(next.fallback_to_openai);
  next.context_bot_enabled = normalizeBoolean(next.context_bot_enabled);
  next.context_bot_id = normalizeNullableId(next.context_bot_id);
  next.image_bot_id = normalizeNullableId(next.image_bot_id);
  next.universal_bot_id = normalizeNullableId(next.universal_bot_id);
  next.transcription_timeout_ms = clampInteger(
    next.transcription_timeout_ms, DEFAULT_BOT_SETTINGS.transcription_timeout_ms, 5000, 300000
  );
  next.max_file_size_bytes = clampInteger(
    next.max_file_size_bytes, DEFAULT_BOT_SETTINGS.max_file_size_bytes, 1024 * 1024, 20 * 1024 * 1024
  );
  next.vosk_model = String(next.vosk_model || DEFAULT_BOT_SETTINGS.vosk_model).trim() || DEFAULT_BOT_SETTINGS.vosk_model;
  next.vosk_model_path = String(next.vosk_model_path || '').trim();
  next.whisper_model = String(next.whisper_model || DEFAULT_BOT_SETTINGS.whisper_model).trim();
  if (!VOICE_SETTINGS_OPTIONS.models.whisper.some((item) => item.value === next.whisper_model)) {
    next.whisper_model = DEFAULT_BOT_SETTINGS.whisper_model;
  }
  next.whisper_language = String(next.whisper_language || 'ru').trim() || 'ru';
  next.openai_model = String(next.openai_model || DEFAULT_BOT_SETTINGS.openai_model).trim() || DEFAULT_BOT_SETTINGS.openai_model;
  next.openai_language = String(next.openai_language || 'ru').trim() || 'ru';
  next.grok_language = String(next.grok_language || 'ru').trim() || 'ru';
  return next;
}

function rowToBot(row) {
  if (!row) return null;
  return normalizeBot({
    ...row,
    allowed_user_ids: parseAllowedUserIds(row.allowed_user_ids_json),
  });
}

function listBots(db) {
  return db.prepare('SELECT * FROM telegram_bots ORDER BY id ASC').all().map(rowToBot);
}

function readBot(db, id) {
  return rowToBot(db.prepare('SELECT * FROM telegram_bots WHERE id=?').get(Number(id || 0)));
}

function firstBot(db) {
  return rowToBot(db.prepare('SELECT * FROM telegram_bots ORDER BY id ASC LIMIT 1').get());
}

function buildDraftBot(current = {}, incoming = {}, secret) {
  const draft = normalizeBot({ ...current, ...incoming });
  if (Object.prototype.hasOwnProperty.call(incoming, 'bot_token')) {
    const token = String(incoming.bot_token || '').trim();
    if (token) {
      draft.bot_token_encrypted = encryptText(token, secret);
      draft.bot_token_masked = maskSecret(token);
    }
  }
  return draft;
}

const BOT_COLUMNS = [
  'name', 'bot_token_encrypted', 'bot_token_masked', 'telegram_api_bot_id',
  'telegram_bot_name', 'telegram_bot_username', 'allowed_user_ids_json',
  'transcription_enabled', 'image_generation_enabled', 'universal_enabled', 'generate_image_from_transcription', 'active_provider',
  'fallback_to_openai', 'context_bot_enabled', 'context_bot_id', 'image_bot_id', 'universal_bot_id',
  'transcription_timeout_ms', 'max_file_size_bytes', 'vosk_model', 'vosk_model_path',
  'whisper_model', 'whisper_language', 'openai_model', 'openai_language', 'grok_language',
];

function botSqlValues(bot) {
  const normalized = normalizeBot(bot);
  return [
    normalized.name,
    normalized.bot_token_encrypted,
    normalized.bot_token_masked,
    normalized.telegram_api_bot_id || null,
    normalized.telegram_bot_name,
    normalized.telegram_bot_username,
    JSON.stringify(normalized.allowed_user_ids),
    normalized.transcription_enabled ? 1 : 0,
    normalized.image_generation_enabled ? 1 : 0,
    normalized.universal_enabled ? 1 : 0,
    normalized.generate_image_from_transcription ? 1 : 0,
    normalized.active_provider,
    normalized.fallback_to_openai ? 1 : 0,
    normalized.context_bot_enabled ? 1 : 0,
    normalized.context_bot_id,
    normalized.image_bot_id,
    normalized.universal_bot_id,
    normalized.transcription_timeout_ms,
    normalized.max_file_size_bytes,
    normalized.vosk_model,
    normalized.vosk_model_path,
    normalized.whisper_model,
    normalized.whisper_language,
    normalized.openai_model,
    normalized.openai_language,
    normalized.grok_language,
  ];
}

function createBot(db, incoming, secret) {
  const draft = buildDraftBot({}, incoming, secret);
  const placeholders = BOT_COLUMNS.map(() => '?').join(',');
  const result = db.prepare(`INSERT INTO telegram_bots(${BOT_COLUMNS.join(',')}) VALUES(${placeholders})`)
    .run(...botSqlValues(draft));
  db.prepare('INSERT INTO telegram_bot_state(telegram_bot_id) VALUES(?)').run(result.lastInsertRowid);
  return readBot(db, result.lastInsertRowid);
}

function updateBot(db, id, incoming, secret) {
  const current = readBot(db, id);
  if (!current) return null;
  const draft = buildDraftBot(current, incoming, secret);
  const assignments = BOT_COLUMNS.map((column) => `${column}=?`).join(',');
  db.prepare(`UPDATE telegram_bots SET ${assignments}, updated_at=datetime('now') WHERE id=?`)
    .run(...botSqlValues(draft), Number(id));
  db.prepare('INSERT OR IGNORE INTO telegram_bot_state(telegram_bot_id) VALUES(?)').run(Number(id));
  return readBot(db, id);
}

function deleteBot(db, id) {
  return db.prepare('DELETE FROM telegram_bots WHERE id=?').run(Number(id || 0)).changes > 0;
}

function getBotToken(db, id, secret) {
  // Backward-compatible two-argument form: getBotToken(db, secret).
  if (secret === undefined) {
    secret = id;
    id = firstBot(db)?.id;
  }
  const bot = readBot(db, id);
  if (!bot?.bot_token_encrypted) return '';
  try {
    return decryptText(bot.bot_token_encrypted, secret);
  } catch {
    return '';
  }
}

function clearBotToken(db, id) {
  const bot = readBot(db, id);
  if (!bot) return null;
  return updateBot(db, id, {
    transcription_enabled: false,
    image_generation_enabled: false,
    universal_enabled: false,
    generate_image_from_transcription: false,
    bot_token_encrypted: '',
    bot_token_masked: '',
    telegram_api_bot_id: '',
    telegram_bot_name: '',
    telegram_bot_username: '',
  });
}

function sanitizeBot(bot) {
  const normalized = normalizeBot(bot || {});
  const { bot_token_encrypted, bot_token_masked, ...safe } = normalized;
  return {
    ...safe,
    has_bot_token: Boolean(bot_token_encrypted),
    masked_bot_token: bot_token_masked || '',
  };
}

function buildProviderSettings(telegramSettings, voiceSettings) {
  const telegram = normalizeBot(telegramSettings);
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
  DEFAULT_BOT_SETTINGS,
  DEFAULT_SETTINGS,
  normalizeAllowedUserIds,
  normalizeBot,
  listBots,
  readBot,
  firstBot,
  buildDraftBot,
  createBot,
  updateBot,
  deleteBot,
  getBotToken,
  clearBotToken,
  sanitizeBot,
  buildProviderSettings,
  providerReadiness,
};

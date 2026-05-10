const { encryptText, decryptText, maskSecret } = require('../voice/crypto');

const CALL_SETTINGS_KEY = 'call_settings';
const CALL_LIVEKIT_CONFIG_KEY = 'call_livekit_config';

const DEFAULT_CALL_SETTINGS = {
  calls_enabled: false,
  ring_timeout_ms: 60000,
  allow_private_calls: true,
  allow_group_calls: true,
  screen_share_enabled: true,
  ringtone_enabled: true,
  call_messages_enabled: true,
  call_debug_enabled: false,
  call_ai_notes_enabled: false,
  call_recording_path: process.env.CALL_RECORDING_PATH || '/opt/livekit-egress/recordings',
  call_recording_mode: 'mixed_participant',
  call_transcription_mode: 'manual',
  call_transcription_provider: 'voice',
  call_transcription_strategy: 'hybrid',
  call_transcription_max_chunk_mb: 24,
  call_transcription_chunk_minutes: 12,
  max_call_participants: 20,
};

const CALL_SETTING_KEYS = Object.keys(DEFAULT_CALL_SETTINGS);

const DEFAULT_LIVEKIT_SETTINGS = {
  ws_url: '',
  api_key_encrypted: '',
  api_key_masked: '',
  api_secret_encrypted: '',
  api_secret_masked: '',
};

function pickKnownSettings(raw = {}) {
  const picked = {};
  for (const key of CALL_SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) picked[key] = raw[key];
  }
  return picked;
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeCallSettings(raw = {}) {
  const next = { ...DEFAULT_CALL_SETTINGS, ...pickKnownSettings(raw) };
  next.calls_enabled = normalizeBoolean(next.calls_enabled, DEFAULT_CALL_SETTINGS.calls_enabled);
  next.allow_private_calls = normalizeBoolean(next.allow_private_calls, DEFAULT_CALL_SETTINGS.allow_private_calls);
  next.allow_group_calls = normalizeBoolean(next.allow_group_calls, DEFAULT_CALL_SETTINGS.allow_group_calls);
  next.screen_share_enabled = normalizeBoolean(next.screen_share_enabled, DEFAULT_CALL_SETTINGS.screen_share_enabled);
  next.ringtone_enabled = normalizeBoolean(next.ringtone_enabled, DEFAULT_CALL_SETTINGS.ringtone_enabled);
  next.call_messages_enabled = normalizeBoolean(next.call_messages_enabled, DEFAULT_CALL_SETTINGS.call_messages_enabled);
  next.call_debug_enabled = normalizeBoolean(next.call_debug_enabled, DEFAULT_CALL_SETTINGS.call_debug_enabled);
  next.call_ai_notes_enabled = normalizeBoolean(next.call_ai_notes_enabled, DEFAULT_CALL_SETTINGS.call_ai_notes_enabled);
  next.call_recording_path = String(next.call_recording_path || DEFAULT_CALL_SETTINGS.call_recording_path).trim() || DEFAULT_CALL_SETTINGS.call_recording_path;
  next.call_recording_mode = String(next.call_recording_mode || DEFAULT_CALL_SETTINGS.call_recording_mode).trim();
  if (!['participant', 'mixed', 'mixed_participant'].includes(next.call_recording_mode)) {
    next.call_recording_mode = DEFAULT_CALL_SETTINGS.call_recording_mode;
  }
  next.call_transcription_mode = String(next.call_transcription_mode || DEFAULT_CALL_SETTINGS.call_transcription_mode).trim();
  if (!['manual', 'auto'].includes(next.call_transcription_mode)) {
    next.call_transcription_mode = DEFAULT_CALL_SETTINGS.call_transcription_mode;
  }
  next.call_transcription_provider = String(next.call_transcription_provider || DEFAULT_CALL_SETTINGS.call_transcription_provider).trim();
  if (!['voice', 'vosk', 'openai', 'grok'].includes(next.call_transcription_provider)) {
    next.call_transcription_provider = DEFAULT_CALL_SETTINGS.call_transcription_provider;
  }
  next.call_transcription_strategy = String(next.call_transcription_strategy || DEFAULT_CALL_SETTINGS.call_transcription_strategy).trim();
  if (!['per_user', 'mixed', 'hybrid', 'openai_diarization'].includes(next.call_transcription_strategy)) {
    next.call_transcription_strategy = DEFAULT_CALL_SETTINGS.call_transcription_strategy;
  }
  if (next.call_transcription_strategy === 'openai_diarization') {
    next.call_transcription_provider = 'openai';
  }
  next.call_transcription_max_chunk_mb = clampNumber(
    next.call_transcription_max_chunk_mb,
    DEFAULT_CALL_SETTINGS.call_transcription_max_chunk_mb,
    1,
    100
  );
  next.call_transcription_chunk_minutes = clampNumber(
    next.call_transcription_chunk_minutes,
    DEFAULT_CALL_SETTINGS.call_transcription_chunk_minutes,
    1,
    60
  );
  next.ring_timeout_ms = clampNumber(
    next.ring_timeout_ms,
    DEFAULT_CALL_SETTINGS.ring_timeout_ms,
    10000,
    300000
  );
  next.max_call_participants = clampNumber(
    next.max_call_participants,
    DEFAULT_CALL_SETTINGS.max_call_participants,
    2,
    100
  );
  return next;
}

function readStoredSettings(db) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key=?').get(CALL_SETTINGS_KEY);
  if (!row) return { ...DEFAULT_CALL_SETTINGS };
  try {
    return normalizeCallSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_CALL_SETTINGS };
  }
}

function writeStoredSettings(db, settings) {
  const payload = JSON.stringify(normalizeCallSettings(settings));
  db.prepare(`
    INSERT INTO app_settings(key, value, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value=excluded.value,
      updated_at=datetime('now')
  `).run(CALL_SETTINGS_KEY, payload);
}

function getCallSettings(db) {
  return normalizeCallSettings(readStoredSettings(db));
}

function setCallSettings(db, incoming = {}) {
  const current = getCallSettings(db);
  const next = normalizeCallSettings({ ...current, ...pickKnownSettings(incoming) });
  writeStoredSettings(db, next);
  return next;
}

function normalizeLiveKitSettings(raw = {}) {
  return {
    ws_url: String(raw.ws_url || '').trim(),
    api_key_encrypted: String(raw.api_key_encrypted || ''),
    api_key_masked: String(raw.api_key_masked || ''),
    api_secret_encrypted: String(raw.api_secret_encrypted || ''),
    api_secret_masked: String(raw.api_secret_masked || ''),
  };
}

function readStoredLiveKitSettings(db) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key=?').get(CALL_LIVEKIT_CONFIG_KEY);
  if (!row) return { ...DEFAULT_LIVEKIT_SETTINGS };
  try {
    return normalizeLiveKitSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_LIVEKIT_SETTINGS };
  }
}

function writeStoredLiveKitSettings(db, settings) {
  const payload = JSON.stringify(normalizeLiveKitSettings(settings));
  db.prepare(`
    INSERT INTO app_settings(key, value, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value=excluded.value,
      updated_at=datetime('now')
  `).run(CALL_LIVEKIT_CONFIG_KEY, payload);
}

function decryptStoredSecret(value, secret) {
  if (!value) return '';
  try {
    return decryptText(value, secret);
  } catch {
    return '';
  }
}

function getEnvLiveKitConfig(env = process.env) {
  const wsUrl = String(env.LIVEKIT_WS_URL || env.LIVEKIT_URL || '').trim();
  const apiKey = String(env.LIVEKIT_API_KEY || '').trim();
  const apiSecret = String(env.LIVEKIT_API_SECRET || '').trim();
  return {
    wsUrl,
    apiKey,
    apiSecret,
    wsUrlPresent: Boolean(wsUrl),
    ready: Boolean(wsUrl && apiKey && apiSecret),
  };
}

function getStoredLiveKitConfig(db, secret = '', env = process.env) {
  const stored = readStoredLiveKitSettings(db);
  const envConfig = getEnvLiveKitConfig(env);
  const storedApiKey = decryptStoredSecret(stored.api_key_encrypted, secret);
  const storedApiSecret = decryptStoredSecret(stored.api_secret_encrypted, secret);
  const wsUrl = stored.ws_url || envConfig.wsUrl;
  const apiKey = storedApiKey || envConfig.apiKey;
  const apiSecret = storedApiSecret || envConfig.apiSecret;
  const wsUrlSource = stored.ws_url ? 'admin' : (envConfig.wsUrl ? 'env' : '');
  const apiKeySource = storedApiKey ? 'admin' : (envConfig.apiKey ? 'env' : '');
  const apiSecretSource = storedApiSecret ? 'admin' : (envConfig.apiSecret ? 'env' : '');
  const sourceSet = new Set([wsUrlSource, apiKeySource, apiSecretSource].filter(Boolean));
  const source = sourceSet.size === 1 ? [...sourceSet][0] : (sourceSet.size > 1 ? 'mixed' : '');

  return {
    wsUrl,
    apiKey,
    apiSecret,
    wsUrlPresent: Boolean(wsUrl),
    ready: Boolean(wsUrl && apiKey && apiSecret),
    source,
    wsUrlSource,
    apiKeySource,
    apiSecretSource,
  };
}

function getLiveKitConfig(source = process.env, secret = '', env = process.env) {
  if (source && typeof source.prepare === 'function') {
    return getStoredLiveKitConfig(source, secret, env);
  }
  return getEnvLiveKitConfig(source);
}

function setLiveKitConfig(db, incoming = {}, secret = '') {
  const current = readStoredLiveKitSettings(db);

  if (Object.prototype.hasOwnProperty.call(incoming, 'livekit_ws_url')) {
    current.ws_url = String(incoming.livekit_ws_url || '').trim();
  }
  if (incoming.clear_livekit_ws_url) current.ws_url = '';

  if (Object.prototype.hasOwnProperty.call(incoming, 'livekit_api_key')) {
    const plainKey = String(incoming.livekit_api_key || '').trim();
    if (plainKey) {
      current.api_key_encrypted = encryptText(plainKey, secret);
      current.api_key_masked = maskSecret(plainKey);
    }
  }
  if (incoming.clear_livekit_api_key) {
    current.api_key_encrypted = '';
    current.api_key_masked = '';
  }

  if (Object.prototype.hasOwnProperty.call(incoming, 'livekit_api_secret')) {
    const plainSecret = String(incoming.livekit_api_secret || '').trim();
    if (plainSecret) {
      current.api_secret_encrypted = encryptText(plainSecret, secret);
      current.api_secret_masked = maskSecret(plainSecret);
    }
  }
  if (incoming.clear_livekit_api_secret) {
    current.api_secret_encrypted = '';
    current.api_secret_masked = '';
  }

  writeStoredLiveKitSettings(db, current);
  return getAdminLiveKitConfig(db, secret);
}

function sanitizeUrl(value) {
  return String(value || '').trim().replace(/\/\/.*@/, '//');
}

function getAdminLiveKitConfig(db, secret = '', env = process.env) {
  const stored = readStoredLiveKitSettings(db);
  const envConfig = getEnvLiveKitConfig(env);
  const resolved = getStoredLiveKitConfig(db, secret, env);
  const hasStoredApiKey = Boolean(stored.api_key_encrypted);
  const hasStoredApiSecret = Boolean(stored.api_secret_encrypted);

  return {
    ws_url: stored.ws_url || '',
    effective_ws_url: sanitizeUrl(resolved.wsUrl),
    env_ws_url_present: envConfig.wsUrlPresent,
    source: resolved.source,
    ws_url_source: resolved.wsUrlSource,
    api_key_source: resolved.apiKeySource,
    api_secret_source: resolved.apiSecretSource,
    has_api_key: Boolean(hasStoredApiKey || envConfig.apiKey),
    has_api_secret: Boolean(hasStoredApiSecret || envConfig.apiSecret),
    api_key_saved: hasStoredApiKey,
    api_secret_saved: hasStoredApiSecret,
    masked_api_key: stored.api_key_masked || (envConfig.apiKey ? maskSecret(envConfig.apiKey) : ''),
    masked_api_secret: stored.api_secret_masked || (envConfig.apiSecret ? maskSecret(envConfig.apiSecret) : ''),
  };
}

function liveKitHttpUrl(wsUrl) {
  const value = String(wsUrl || '').trim();
  if (!value) return '';
  if (/^wss:\/\//i.test(value)) return value.replace(/^wss:\/\//i, 'https://');
  if (/^ws:\/\//i.test(value)) return value.replace(/^ws:\/\//i, 'http://');
  return value;
}

function getPublicCallSettings(db, secretOrEnv = '', env = process.env) {
  let secret = secretOrEnv;
  let effectiveEnv = env;
  if (secretOrEnv && typeof secretOrEnv === 'object') {
    secret = '';
    effectiveEnv = secretOrEnv;
  }
  const settings = getCallSettings(db);
  const livekit = getLiveKitConfig(db, secret, effectiveEnv);
  return {
    calls_enabled: Boolean(settings.calls_enabled && livekit.ready),
    calls_admin_enabled: settings.calls_enabled,
    livekit_ready: livekit.ready,
    allow_private_calls: settings.allow_private_calls,
    allow_group_calls: settings.allow_group_calls,
    ring_timeout_ms: settings.ring_timeout_ms,
    screen_share_enabled: Boolean(settings.screen_share_enabled),
    ringtone_enabled: Boolean(settings.ringtone_enabled),
    call_messages_enabled: Boolean(settings.call_messages_enabled),
    call_debug_enabled: Boolean(settings.call_debug_enabled),
    call_ai_notes_enabled: Boolean(settings.call_ai_notes_enabled && livekit.ready),
    max_call_participants: settings.max_call_participants,
  };
}

module.exports = {
  CALL_SETTINGS_KEY,
  CALL_LIVEKIT_CONFIG_KEY,
  DEFAULT_CALL_SETTINGS,
  DEFAULT_LIVEKIT_SETTINGS,
  getCallSettings,
  setCallSettings,
  normalizeCallSettings,
  getLiveKitConfig,
  getAdminLiveKitConfig,
  setLiveKitConfig,
  getPublicCallSettings,
  liveKitHttpUrl,
};

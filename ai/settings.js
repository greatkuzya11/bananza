const { encryptText, decryptText, maskSecret } = require('../voice/crypto');

const GLOBAL_SETTINGS_KEY = 'global';

const DEFAULT_AI_SETTINGS = {
  enabled: false,
  default_response_model: 'gpt-4o-mini',
  default_summary_model: 'gpt-4o-mini',
  default_embedding_model: 'text-embedding-3-small',
  chunk_size: 50,
  retrieval_top_k: 6,
  openai_key_encrypted: '',
  openai_key_masked: '',
};

function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return !!value;
  if (value === '0' || value === '1' || value === 'true' || value === 'false') {
    return value === '1' || value === 'true';
  }
  return fallback;
}

function intValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function cleanModel(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeSettings(raw = {}) {
  const next = { ...DEFAULT_AI_SETTINGS, ...raw };
  next.enabled = boolValue(next.enabled, DEFAULT_AI_SETTINGS.enabled);
  next.default_response_model = cleanModel(next.default_response_model, DEFAULT_AI_SETTINGS.default_response_model);
  next.default_summary_model = cleanModel(next.default_summary_model, DEFAULT_AI_SETTINGS.default_summary_model);
  next.default_embedding_model = cleanModel(next.default_embedding_model, DEFAULT_AI_SETTINGS.default_embedding_model);
  next.chunk_size = intValue(next.chunk_size, DEFAULT_AI_SETTINGS.chunk_size, 20, 100);
  next.retrieval_top_k = intValue(next.retrieval_top_k, DEFAULT_AI_SETTINGS.retrieval_top_k, 1, 12);
  next.openai_key_encrypted = String(next.openai_key_encrypted || '');
  next.openai_key_masked = String(next.openai_key_masked || '');
  return next;
}

function readSettings(db) {
  const row = db.prepare('SELECT value FROM ai_bot_settings WHERE key=?').get(GLOBAL_SETTINGS_KEY);
  if (!row?.value) return { ...DEFAULT_AI_SETTINGS };
  try {
    return normalizeSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

function writeSettings(db, settings) {
  const payload = JSON.stringify(normalizeSettings(settings));
  db.prepare(`
    INSERT INTO ai_bot_settings(key, value, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value=excluded.value,
      updated_at=datetime('now')
  `).run(GLOBAL_SETTINGS_KEY, payload);
}

function getAiSettings(db) {
  return normalizeSettings(readSettings(db));
}

function getOpenAIKey(db, secret) {
  const settings = getAiSettings(db);
  if (!settings.openai_key_encrypted) return '';
  try {
    return decryptText(settings.openai_key_encrypted, secret);
  } catch {
    return '';
  }
}

function saveAiSettings(db, incoming = {}, secret) {
  const current = getAiSettings(db);
  const next = normalizeSettings({
    ...current,
    enabled: Object.prototype.hasOwnProperty.call(incoming, 'enabled') ? incoming.enabled : current.enabled,
    default_response_model: incoming.default_response_model ?? current.default_response_model,
    default_summary_model: incoming.default_summary_model ?? current.default_summary_model,
    default_embedding_model: incoming.default_embedding_model ?? current.default_embedding_model,
    chunk_size: incoming.chunk_size ?? current.chunk_size,
    retrieval_top_k: incoming.retrieval_top_k ?? current.retrieval_top_k,
  });

  if (Object.prototype.hasOwnProperty.call(incoming, 'openai_api_key')) {
    const key = String(incoming.openai_api_key || '').trim();
    if (key) {
      next.openai_key_encrypted = encryptText(key, secret);
      next.openai_key_masked = maskSecret(key);
    }
  }

  writeSettings(db, next);
  return sanitizeSettings(next);
}

function deleteOpenAIKey(db) {
  const current = getAiSettings(db);
  current.openai_key_encrypted = '';
  current.openai_key_masked = '';
  writeSettings(db, current);
  return sanitizeSettings(current);
}

function sanitizeSettings(settings) {
  const normalized = normalizeSettings(settings);
  const { openai_key_encrypted, ...safe } = normalized;
  return {
    ...safe,
    has_openai_key: Boolean(openai_key_encrypted),
    masked_openai_key: normalized.openai_key_masked || '',
  };
}

module.exports = {
  DEFAULT_AI_SETTINGS,
  getAiSettings,
  getOpenAIKey,
  saveAiSettings,
  deleteOpenAIKey,
  sanitizeSettings,
};

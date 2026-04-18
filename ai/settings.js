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
  yandex_enabled: false,
  yandex_folder_id: '',
  yandex_base_url: 'https://llm.api.cloud.yandex.net/foundationModels/v1',
  yandex_default_response_model: 'yandexgpt/latest',
  yandex_default_summary_model: 'yandexgpt-lite/latest',
  yandex_default_embedding_doc_model: 'text-search-doc/latest',
  yandex_default_embedding_query_model: 'text-search-query/latest',
  yandex_temperature: 0.3,
  yandex_summary_temperature: 0.2,
  yandex_max_tokens: 1000,
  yandex_reasoning_mode: 'DISABLED',
  yandex_data_logging_enabled: false,
  yandex_key_encrypted: '',
  yandex_key_masked: '',
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

function floatValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function cleanModel(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function cleanText(value, fallback = '', limit = 500) {
  const text = String(value || '').trim().slice(0, limit);
  return text || fallback;
}

function cleanBaseUrl(value, fallback) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return fallback;
  try {
    const url = new URL(text);
    if (!/^https?:$/.test(url.protocol)) return fallback;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

function cleanReasoningMode(value) {
  const mode = String(value || '').trim().toUpperCase();
  return mode === 'ENABLED_HIDDEN' ? 'ENABLED_HIDDEN' : 'DISABLED';
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
  next.yandex_enabled = boolValue(next.yandex_enabled, DEFAULT_AI_SETTINGS.yandex_enabled);
  next.yandex_folder_id = cleanText(next.yandex_folder_id, DEFAULT_AI_SETTINGS.yandex_folder_id, 120);
  next.yandex_base_url = cleanBaseUrl(next.yandex_base_url, DEFAULT_AI_SETTINGS.yandex_base_url);
  next.yandex_default_response_model = cleanModel(next.yandex_default_response_model, DEFAULT_AI_SETTINGS.yandex_default_response_model);
  next.yandex_default_summary_model = cleanModel(next.yandex_default_summary_model, DEFAULT_AI_SETTINGS.yandex_default_summary_model);
  next.yandex_default_embedding_doc_model = cleanModel(next.yandex_default_embedding_doc_model, DEFAULT_AI_SETTINGS.yandex_default_embedding_doc_model);
  next.yandex_default_embedding_query_model = cleanModel(next.yandex_default_embedding_query_model, DEFAULT_AI_SETTINGS.yandex_default_embedding_query_model);
  next.yandex_temperature = floatValue(next.yandex_temperature, DEFAULT_AI_SETTINGS.yandex_temperature, 0, 1);
  next.yandex_summary_temperature = floatValue(next.yandex_summary_temperature, DEFAULT_AI_SETTINGS.yandex_summary_temperature, 0, 1);
  next.yandex_max_tokens = intValue(next.yandex_max_tokens, DEFAULT_AI_SETTINGS.yandex_max_tokens, 1, 8000);
  next.yandex_reasoning_mode = cleanReasoningMode(next.yandex_reasoning_mode);
  next.yandex_data_logging_enabled = boolValue(next.yandex_data_logging_enabled, DEFAULT_AI_SETTINGS.yandex_data_logging_enabled);
  next.yandex_key_encrypted = String(next.yandex_key_encrypted || '');
  next.yandex_key_masked = String(next.yandex_key_masked || '');
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

function getYandexKey(db, secret) {
  const settings = getAiSettings(db);
  if (!settings.yandex_key_encrypted) return '';
  try {
    return decryptText(settings.yandex_key_encrypted, secret);
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
    yandex_enabled: Object.prototype.hasOwnProperty.call(incoming, 'yandex_enabled') ? incoming.yandex_enabled : current.yandex_enabled,
    yandex_folder_id: incoming.yandex_folder_id ?? current.yandex_folder_id,
    yandex_base_url: incoming.yandex_base_url ?? current.yandex_base_url,
    yandex_default_response_model: incoming.yandex_default_response_model ?? current.yandex_default_response_model,
    yandex_default_summary_model: incoming.yandex_default_summary_model ?? current.yandex_default_summary_model,
    yandex_default_embedding_doc_model: incoming.yandex_default_embedding_doc_model ?? current.yandex_default_embedding_doc_model,
    yandex_default_embedding_query_model: incoming.yandex_default_embedding_query_model ?? current.yandex_default_embedding_query_model,
    yandex_temperature: incoming.yandex_temperature ?? current.yandex_temperature,
    yandex_summary_temperature: incoming.yandex_summary_temperature ?? current.yandex_summary_temperature,
    yandex_max_tokens: incoming.yandex_max_tokens ?? current.yandex_max_tokens,
    yandex_reasoning_mode: incoming.yandex_reasoning_mode ?? current.yandex_reasoning_mode,
    yandex_data_logging_enabled: Object.prototype.hasOwnProperty.call(incoming, 'yandex_data_logging_enabled') ? incoming.yandex_data_logging_enabled : current.yandex_data_logging_enabled,
  });

  if (Object.prototype.hasOwnProperty.call(incoming, 'openai_api_key')) {
    const key = String(incoming.openai_api_key || '').trim();
    if (key) {
      next.openai_key_encrypted = encryptText(key, secret);
      next.openai_key_masked = maskSecret(key);
    }
  }

  if (Object.prototype.hasOwnProperty.call(incoming, 'yandex_api_key')) {
    const key = String(incoming.yandex_api_key || '').trim();
    if (key) {
      next.yandex_key_encrypted = encryptText(key, secret);
      next.yandex_key_masked = maskSecret(key);
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

function deleteYandexKey(db) {
  const current = getAiSettings(db);
  current.yandex_key_encrypted = '';
  current.yandex_key_masked = '';
  writeSettings(db, current);
  return sanitizeSettings(current);
}

function sanitizeSettings(settings) {
  const normalized = normalizeSettings(settings);
  const { openai_key_encrypted, yandex_key_encrypted, ...safe } = normalized;
  return {
    ...safe,
    has_openai_key: Boolean(openai_key_encrypted),
    masked_openai_key: normalized.openai_key_masked || '',
    has_yandex_key: Boolean(yandex_key_encrypted),
    masked_yandex_key: normalized.yandex_key_masked || '',
  };
}

module.exports = {
  DEFAULT_AI_SETTINGS,
  getAiSettings,
  getOpenAIKey,
  getYandexKey,
  saveAiSettings,
  deleteOpenAIKey,
  deleteYandexKey,
  sanitizeSettings,
};

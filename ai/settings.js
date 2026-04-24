const { encryptText, decryptText, maskSecret } = require('../voice/crypto');

const GLOBAL_SETTINGS_KEY = 'global';

const DEFAULT_AI_SETTINGS = {
  enabled: false,
  default_response_model: 'gpt-5.4',
  default_summary_model: 'gpt-5.4',
  default_embedding_model: 'text-embedding-3-small',
  openai_default_image_model: 'gpt-image-2',
  openai_default_image_size: '1024x1024',
  openai_default_image_quality: 'auto',
  openai_default_image_background: 'auto',
  openai_default_image_output_format: 'png',
  openai_default_document_format: 'md',
  chunk_size: 50,
  retrieval_top_k: 6,
  openai_key_encrypted: '',
  openai_key_masked: '',
  grok_enabled: false,
  grok_base_url: 'https://api.x.ai/v1',
  grok_default_response_model: 'grok-4.20-reasoning',
  grok_default_summary_model: 'grok-4.20-reasoning',
  grok_default_embedding_model: 'text-embedding',
  grok_default_image_model: 'grok-imagine-image',
  grok_default_image_aspect_ratio: '1:1',
  grok_default_image_resolution: '1k',
  grok_temperature: 0.3,
  grok_max_tokens: 1000,
  grok_key_encrypted: '',
  grok_key_masked: '',
  deepseek_enabled: false,
  deepseek_base_url: 'https://api.deepseek.com',
  deepseek_default_response_model: 'deepseek-chat',
  deepseek_default_summary_model: 'deepseek-chat',
  deepseek_temperature: 0.3,
  deepseek_max_tokens: 1000,
  deepseek_key_encrypted: '',
  deepseek_key_masked: '',
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

function cleanOpenAiImageSize(value, fallback) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'auto' || text === '1024x1024' || text === '1024x1536' || text === '1536x1024') {
    return text;
  }
  return fallback;
}

function cleanOpenAiImageQuality(value, fallback) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'auto' || text === 'low' || text === 'medium' || text === 'high') return text;
  return fallback;
}

function cleanOpenAiImageBackground(value, fallback) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'auto' || text === 'transparent' || text === 'opaque') return text;
  return fallback;
}

function cleanOpenAiImageOutputFormat(value, fallback) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'png' || text === 'webp' || text === 'jpeg') return text;
  return fallback;
}

function cleanDocumentFormat(value, fallback = 'md') {
  const text = String(value || '').trim().toLowerCase();
  return text === 'txt' ? 'txt' : fallback;
}

function cleanAspectRatio(value, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (/^(?:auto|1:1|16:9|9:16|4:3|3:4|3:2|2:3|2:1|1:2|19\.5:9|9:19\.5|20:9|9:20)$/i.test(text)) {
    return text;
  }
  return fallback;
}

function cleanImageResolution(value, fallback) {
  const text = String(value || '').trim().toLowerCase();
  if (text === '1k' || text === '2k') return text;
  return fallback;
}

function normalizeSettings(raw = {}) {
  const next = { ...DEFAULT_AI_SETTINGS, ...raw };
  next.enabled = boolValue(next.enabled, DEFAULT_AI_SETTINGS.enabled);
  next.default_response_model = cleanModel(next.default_response_model, DEFAULT_AI_SETTINGS.default_response_model);
  next.default_summary_model = cleanModel(next.default_summary_model, DEFAULT_AI_SETTINGS.default_summary_model);
  next.default_embedding_model = cleanModel(next.default_embedding_model, DEFAULT_AI_SETTINGS.default_embedding_model);
  next.openai_default_image_model = cleanModel(next.openai_default_image_model, DEFAULT_AI_SETTINGS.openai_default_image_model);
  next.openai_default_image_size = cleanOpenAiImageSize(next.openai_default_image_size, DEFAULT_AI_SETTINGS.openai_default_image_size);
  next.openai_default_image_quality = cleanOpenAiImageQuality(next.openai_default_image_quality, DEFAULT_AI_SETTINGS.openai_default_image_quality);
  next.openai_default_image_background = cleanOpenAiImageBackground(next.openai_default_image_background, DEFAULT_AI_SETTINGS.openai_default_image_background);
  next.openai_default_image_output_format = cleanOpenAiImageOutputFormat(next.openai_default_image_output_format, DEFAULT_AI_SETTINGS.openai_default_image_output_format);
  next.openai_default_document_format = cleanDocumentFormat(next.openai_default_document_format, DEFAULT_AI_SETTINGS.openai_default_document_format);
  next.chunk_size = intValue(next.chunk_size, DEFAULT_AI_SETTINGS.chunk_size, 20, 100);
  next.retrieval_top_k = intValue(next.retrieval_top_k, DEFAULT_AI_SETTINGS.retrieval_top_k, 1, 12);
  next.openai_key_encrypted = String(next.openai_key_encrypted || '');
  next.openai_key_masked = String(next.openai_key_masked || '');
  next.grok_enabled = boolValue(next.grok_enabled, DEFAULT_AI_SETTINGS.grok_enabled);
  next.grok_base_url = cleanBaseUrl(next.grok_base_url, DEFAULT_AI_SETTINGS.grok_base_url);
  next.grok_default_response_model = cleanModel(next.grok_default_response_model, DEFAULT_AI_SETTINGS.grok_default_response_model);
  next.grok_default_summary_model = cleanModel(next.grok_default_summary_model, DEFAULT_AI_SETTINGS.grok_default_summary_model);
  next.grok_default_embedding_model = cleanModel(next.grok_default_embedding_model, DEFAULT_AI_SETTINGS.grok_default_embedding_model);
  next.grok_default_image_model = cleanModel(next.grok_default_image_model, DEFAULT_AI_SETTINGS.grok_default_image_model);
  next.grok_default_image_aspect_ratio = cleanAspectRatio(next.grok_default_image_aspect_ratio, DEFAULT_AI_SETTINGS.grok_default_image_aspect_ratio);
  next.grok_default_image_resolution = cleanImageResolution(next.grok_default_image_resolution, DEFAULT_AI_SETTINGS.grok_default_image_resolution);
  next.grok_temperature = floatValue(next.grok_temperature, DEFAULT_AI_SETTINGS.grok_temperature, 0, 1);
  next.grok_max_tokens = intValue(next.grok_max_tokens, DEFAULT_AI_SETTINGS.grok_max_tokens, 1, 8000);
  next.grok_key_encrypted = String(next.grok_key_encrypted || '');
  next.grok_key_masked = String(next.grok_key_masked || '');
  next.deepseek_enabled = boolValue(next.deepseek_enabled, DEFAULT_AI_SETTINGS.deepseek_enabled);
  next.deepseek_base_url = cleanBaseUrl(next.deepseek_base_url, DEFAULT_AI_SETTINGS.deepseek_base_url);
  next.deepseek_default_response_model = cleanModel(next.deepseek_default_response_model, DEFAULT_AI_SETTINGS.deepseek_default_response_model);
  next.deepseek_default_summary_model = cleanModel(next.deepseek_default_summary_model, DEFAULT_AI_SETTINGS.deepseek_default_summary_model);
  next.deepseek_temperature = floatValue(next.deepseek_temperature, DEFAULT_AI_SETTINGS.deepseek_temperature, 0, 1);
  next.deepseek_max_tokens = intValue(next.deepseek_max_tokens, DEFAULT_AI_SETTINGS.deepseek_max_tokens, 1, 8000);
  next.deepseek_key_encrypted = String(next.deepseek_key_encrypted || '');
  next.deepseek_key_masked = String(next.deepseek_key_masked || '');
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

function getGrokKey(db, secret) {
  const settings = getAiSettings(db);
  if (!settings.grok_key_encrypted) return '';
  try {
    return decryptText(settings.grok_key_encrypted, secret);
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

function getDeepSeekKey(db, secret) {
  const settings = getAiSettings(db);
  if (!settings.deepseek_key_encrypted) return '';
  try {
    return decryptText(settings.deepseek_key_encrypted, secret);
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
    openai_default_image_model: incoming.openai_default_image_model ?? current.openai_default_image_model,
    openai_default_image_size: incoming.openai_default_image_size ?? current.openai_default_image_size,
    openai_default_image_quality: incoming.openai_default_image_quality ?? current.openai_default_image_quality,
    openai_default_image_background: incoming.openai_default_image_background ?? current.openai_default_image_background,
    openai_default_image_output_format: incoming.openai_default_image_output_format ?? current.openai_default_image_output_format,
    openai_default_document_format: incoming.openai_default_document_format ?? current.openai_default_document_format,
    chunk_size: incoming.chunk_size ?? current.chunk_size,
    retrieval_top_k: incoming.retrieval_top_k ?? current.retrieval_top_k,
    grok_enabled: Object.prototype.hasOwnProperty.call(incoming, 'grok_enabled') ? incoming.grok_enabled : current.grok_enabled,
    grok_base_url: incoming.grok_base_url ?? current.grok_base_url,
    grok_default_response_model: incoming.grok_default_response_model ?? current.grok_default_response_model,
    grok_default_summary_model: incoming.grok_default_summary_model ?? current.grok_default_summary_model,
    grok_default_embedding_model: incoming.grok_default_embedding_model ?? current.grok_default_embedding_model,
    grok_default_image_model: incoming.grok_default_image_model ?? current.grok_default_image_model,
    grok_default_image_aspect_ratio: incoming.grok_default_image_aspect_ratio ?? current.grok_default_image_aspect_ratio,
    grok_default_image_resolution: incoming.grok_default_image_resolution ?? current.grok_default_image_resolution,
    grok_temperature: incoming.grok_temperature ?? current.grok_temperature,
    grok_max_tokens: incoming.grok_max_tokens ?? current.grok_max_tokens,
    deepseek_enabled: Object.prototype.hasOwnProperty.call(incoming, 'deepseek_enabled') ? incoming.deepseek_enabled : current.deepseek_enabled,
    deepseek_base_url: incoming.deepseek_base_url ?? current.deepseek_base_url,
    deepseek_default_response_model: incoming.deepseek_default_response_model ?? current.deepseek_default_response_model,
    deepseek_default_summary_model: incoming.deepseek_default_summary_model ?? current.deepseek_default_summary_model,
    deepseek_temperature: incoming.deepseek_temperature ?? current.deepseek_temperature,
    deepseek_max_tokens: incoming.deepseek_max_tokens ?? current.deepseek_max_tokens,
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

  if (Object.prototype.hasOwnProperty.call(incoming, 'grok_api_key')) {
    const key = String(incoming.grok_api_key || '').trim();
    if (key) {
      next.grok_key_encrypted = encryptText(key, secret);
      next.grok_key_masked = maskSecret(key);
    }
  }

  if (Object.prototype.hasOwnProperty.call(incoming, 'deepseek_api_key')) {
    const key = String(incoming.deepseek_api_key || '').trim();
    if (key) {
      next.deepseek_key_encrypted = encryptText(key, secret);
      next.deepseek_key_masked = maskSecret(key);
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

function deleteGrokKey(db) {
  const current = getAiSettings(db);
  current.grok_key_encrypted = '';
  current.grok_key_masked = '';
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

function deleteDeepSeekKey(db) {
  const current = getAiSettings(db);
  current.deepseek_key_encrypted = '';
  current.deepseek_key_masked = '';
  writeSettings(db, current);
  return sanitizeSettings(current);
}

function sanitizeSettings(settings) {
  const normalized = normalizeSettings(settings);
  const {
    openai_key_encrypted,
    grok_key_encrypted,
    deepseek_key_encrypted,
    yandex_key_encrypted,
    ...safe
  } = normalized;
  return {
    ...safe,
    has_openai_key: Boolean(openai_key_encrypted),
    masked_openai_key: normalized.openai_key_masked || '',
    has_grok_key: Boolean(grok_key_encrypted),
    masked_grok_key: normalized.grok_key_masked || '',
    has_deepseek_key: Boolean(deepseek_key_encrypted),
    masked_deepseek_key: normalized.deepseek_key_masked || '',
    has_yandex_key: Boolean(yandex_key_encrypted),
    masked_yandex_key: normalized.yandex_key_masked || '',
  };
}

module.exports = {
  DEFAULT_AI_SETTINGS,
  getAiSettings,
  getOpenAIKey,
  getGrokKey,
  getDeepSeekKey,
  getYandexKey,
  saveAiSettings,
  deleteOpenAIKey,
  deleteGrokKey,
  deleteDeepSeekKey,
  deleteYandexKey,
  sanitizeSettings,
};

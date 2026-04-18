const DEFAULT_BASE_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1';
const DEFAULT_MODEL_LIST_URL = 'https://ai.api.cloud.yandex.net/v1/models';

function cleanBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
}

function cleanModelListUrl(value) {
  return String(value || DEFAULT_MODEL_LIST_URL).trim().replace(/\/+$/, '') || DEFAULT_MODEL_LIST_URL;
}

function cleanKey(value) {
  return String(value || '').trim();
}

function authHeader(apiKey) {
  const key = cleanKey(apiKey);
  if (!key) throw new Error('Yandex API key is not configured for AI bots');
  if (/^(Api-Key|Bearer)\s+/i.test(key)) return key;
  return `Api-Key ${key}`;
}

function requestHeaders({ apiKey, dataLoggingEnabled = false }) {
  return {
    'Content-Type': 'application/json',
    Authorization: authHeader(apiKey),
    'x-data-logging-enabled': dataLoggingEnabled ? 'true' : 'false',
  };
}

function modelListHeaders({ apiKey, folderId }) {
  const headers = {
    Accept: 'application/json',
    Authorization: authHeader(apiKey),
  };
  const project = String(folderId || '').trim();
  if (project) headers['OpenAI-Project'] = project;
  return headers;
}

function resolveModelUri(model, folderId, scheme = 'gpt') {
  const raw = String(model || '').trim();
  if (/^(gpt|emb):\/\//i.test(raw)) return raw.replace('<folder_ID>', String(folderId || '').trim());
  const folder = String(folderId || '').trim();
  if (!folder) throw new Error('Yandex folder ID is not configured');
  const path = raw.replace(/^\/+/, '') || (scheme === 'emb' ? 'text-search-doc/latest' : 'yandexgpt/latest');
  return `${scheme}://${folder}/${path}`;
}

function intValue(value, fallback, min, max) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function floatValue(value, fallback, min, max) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeReasoningMode(value) {
  const mode = String(value || '').trim().toUpperCase();
  return mode === 'ENABLED_HIDDEN' ? 'ENABLED_HIDDEN' : 'DISABLED';
}

function stringifyErrorValue(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (value instanceof Error) {
    const nested = stringifyErrorValue(value.message, '');
    return nested || fallback;
  }
  if (Array.isArray(value)) {
    const text = value
      .map((item) => stringifyErrorValue(item, ''))
      .filter(Boolean)
      .join('; ');
    return text || fallback;
  }
  if (typeof value === 'object') {
    const nested = stringifyErrorValue(
      value.message
      || value.error?.message
      || value.error
      || value.details?.[0]?.message
      || value.type
      || value.error?.type
      || value.code
      || value.description
      || value.reason,
      ''
    );
    if (nested) return nested;
    try {
      const text = JSON.stringify(value);
      return text === '{}' ? fallback : text;
    } catch {
      return fallback;
    }
  }
  return String(value).trim() || fallback;
}

function yandexErrorMessage(payload, fallback) {
  return stringifyErrorValue(payload, fallback);
}

async function postJson(url, body, { apiKey, dataLoggingEnabled, timeoutMs = 60000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders({ apiKey, dataLoggingEnabled }),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      throw new Error(yandexErrorMessage(payload, `Yandex API request failed with HTTP ${response.status}`));
    }
    return payload || {};
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Yandex API request timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, { apiKey, folderId, timeoutMs = 30000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: modelListHeaders({ apiKey, folderId }),
      signal: controller.signal,
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      throw new Error(yandexErrorMessage(payload, `Yandex API request failed with HTTP ${response.status}`));
    }
    return payload || {};
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Yandex API request timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function extractResponseText(response) {
  const root = response?.result || response || {};
  const alternatives = Array.isArray(root.alternatives) ? root.alternatives : [];
  const final = alternatives.find((item) => /FINAL$/i.test(String(item?.status || ''))) || alternatives[0];
  return String(final?.message?.text || '').trim();
}

function safeJsonParse(text, fallback) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return fallback;
  }
}

async function generateText({
  apiKey,
  folderId,
  baseUrl = DEFAULT_BASE_URL,
  model,
  system,
  user,
  messages,
  maxOutputTokens = 1000,
  temperature = 0.3,
  reasoningMode = 'DISABLED',
  dataLoggingEnabled = false,
  jsonObject = false,
}) {
  const modelUri = resolveModelUri(model, folderId, 'gpt');
  const requestMessages = Array.isArray(messages) && messages.length
    ? messages
    : [
        system ? { role: 'system', text: String(system) } : null,
        { role: 'user', text: String(user || '') },
      ].filter(Boolean);

  const body = {
    modelUri,
    completionOptions: {
      stream: false,
      temperature: floatValue(temperature, 0.3, 0, 1),
      maxTokens: String(intValue(maxOutputTokens, 1000, 1, 8000)),
      reasoningOptions: { mode: normalizeReasoningMode(reasoningMode) },
    },
    messages: requestMessages.map((message) => ({
      role: String(message.role || 'user'),
      text: String(message.text ?? message.content ?? ''),
    })).filter((message) => message.text),
  };
  if (jsonObject) body.jsonObject = true;

  const response = await postJson(`${cleanBaseUrl(baseUrl)}/completion`, body, {
    apiKey,
    dataLoggingEnabled,
  });
  return extractResponseText(response);
}

async function generateJson({
  apiKey,
  folderId,
  baseUrl,
  model,
  system,
  user,
  fallback = {},
  maxOutputTokens = 1400,
  temperature = 0.2,
  reasoningMode = 'DISABLED',
  dataLoggingEnabled = false,
}) {
  const text = await generateText({
    apiKey,
    folderId,
    baseUrl,
    model,
    system: `${system || ''}\n\nReturn only valid JSON. Do not wrap it in Markdown.`,
    user,
    fallback,
    maxOutputTokens,
    temperature,
    reasoningMode,
    dataLoggingEnabled,
    jsonObject: true,
  });
  return safeJsonParse(text, fallback);
}

async function createEmbedding({
  apiKey,
  folderId,
  baseUrl = DEFAULT_BASE_URL,
  model,
  input,
  dataLoggingEnabled = false,
}) {
  const text = String(input || '').trim();
  if (!text) throw new Error('Yandex embedding input is empty');
  const modelUri = resolveModelUri(model, folderId, 'emb');
  const response = await postJson(`${cleanBaseUrl(baseUrl)}/textEmbedding`, {
    modelUri,
    text: text.slice(0, 24000),
  }, {
    apiKey,
    dataLoggingEnabled,
  });
  const root = response?.result || response || {};
  return Array.isArray(root.embedding) ? root.embedding : [];
}

async function listModels({
  apiKey,
  folderId,
  modelListUrl = DEFAULT_MODEL_LIST_URL,
}) {
  const payload = await getJson(cleanModelListUrl(modelListUrl), { apiKey, folderId });
  const rows = Array.isArray(payload.data)
    ? payload.data
    : (Array.isArray(payload.models) ? payload.models : []);
  return [...new Set(rows.map((row) => String(row?.id || row?.modelUri || row || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

async function testConnection(options) {
  const text = await generateText({
    ...options,
    user: options.user || 'Say briefly that the Yandex AI connection works.',
    maxOutputTokens: Math.min(intValue(options.maxOutputTokens, 120, 1, 8000), 200),
  });
  return { text };
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL_LIST_URL,
  resolveModelUri,
  generateText,
  generateJson,
  createEmbedding,
  listModels,
  testConnection,
};

const DEFAULT_BASE_URL = 'https://api.deepseek.com';

function cleanBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
}

function cleanKey(value) {
  return String(value || '').trim();
}

function normalizeMaxOutputTokens(value, fallback = 900) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(1, Math.round(Number(fallback) || 900));
  return Math.max(1, Math.round(parsed));
}

function errorText(error, fallback = 'Unexpected error') {
  if (error == null) return fallback;
  if (typeof error === 'string') return error.trim() || fallback;
  if (error instanceof Error) return errorText(error.message, fallback);
  if (Array.isArray(error)) {
    const text = error.map((item) => errorText(item, '')).filter(Boolean).join('; ');
    return text || fallback;
  }
  if (typeof error === 'object') {
    const nested = errorText(
      error.message
      || error.error?.message
      || error.error
      || error.details?.[0]?.message
      || error.type
      || error.error?.type
      || error.code
      || error.description
      || error.reason,
      ''
    );
    if (nested) return nested;
    try {
      const text = JSON.stringify(error);
      return text === '{}' ? fallback : text;
    } catch {
      return fallback;
    }
  }
  return String(error).trim() || fallback;
}

async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    return { raw: text };
  }
}

function requestHeaders(apiKey, extras = {}) {
  const key = cleanKey(apiKey);
  if (!key) throw new Error('DeepSeek API key is not configured for AI bots');
  return {
    Authorization: `Bearer ${key}`,
    ...extras,
  };
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

function extractChatResult(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const message = choice?.message || {};
  const text = typeof message.content === 'string' ? message.content.trim() : '';
  const reasoningContent = typeof message.reasoning_content === 'string'
    ? message.reasoning_content.trim()
    : '';
  return {
    text,
    reasoningContent,
    model: String(payload?.model || choice?.model || '').trim(),
  };
}

async function postJson(url, body, { apiKey, timeoutMs = 60000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: requestHeaders(apiKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await parseJsonResponse(res);
    if (!res.ok) throw new Error(errorText(payload, `DeepSeek API request failed with HTTP ${res.status}`));
    return payload || {};
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('DeepSeek API request timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, { apiKey, timeoutMs = 30000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: requestHeaders(apiKey),
      signal: controller.signal,
    });
    const payload = await parseJsonResponse(res);
    if (!res.ok) throw new Error(errorText(payload, `DeepSeek API request failed with HTTP ${res.status}`));
    return payload || {};
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('DeepSeek API request timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function createChatCompletion({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  model,
  system,
  user,
  messages,
  maxOutputTokens = 900,
  temperature = 0.3,
}) {
  const isReasoner = /deepseek-reasoner/i.test(String(model || ''));
  const requestMessages = Array.isArray(messages) && messages.length
    ? messages
    : [
        system ? { role: 'system', content: String(system) } : null,
        { role: 'user', content: String(user || '') },
      ].filter(Boolean);

  const body = {
    model: String(model || '').trim() || 'deepseek-chat',
    messages: requestMessages.map((message) => ({
      role: String(message.role || 'user'),
      content: String(message.content ?? message.text ?? ''),
    })).filter((message) => message.content),
    max_tokens: normalizeMaxOutputTokens(maxOutputTokens),
    stream: false,
  };
  if (!isReasoner) body.temperature = Math.max(0, Math.min(1, Number(temperature) || 0.3));

  const payload = await postJson(`${cleanBaseUrl(baseUrl)}/chat/completions`, body, { apiKey });
  return extractChatResult(payload);
}

async function listModelIds({ apiKey, baseUrl = DEFAULT_BASE_URL }) {
  const payload = await getJson(`${cleanBaseUrl(baseUrl)}/models`, { apiKey });
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : (Array.isArray(payload?.models) ? payload.models : []);
  const ids = rows
    .map((row) => String(row?.id || row?.model || row || '').trim())
    .filter(Boolean);
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

async function generateText(options) {
  const result = await createChatCompletion(options);
  return result.text;
}

async function generateJson({
  apiKey,
  baseUrl,
  model,
  system,
  user,
  fallback = {},
  maxOutputTokens = 1400,
  temperature = 0.2,
}) {
  const text = await generateText({
    apiKey,
    baseUrl,
    model,
    system: `${system || ''}\n\nReturn only valid JSON. Do not wrap it in Markdown.`,
    user,
    maxOutputTokens,
    temperature,
  });
  return safeJsonParse(text, fallback);
}

async function testConnection(options) {
  const result = await createChatCompletion({
    ...options,
    user: options.user || 'Say briefly that the DeepSeek API connection works.',
    maxOutputTokens: Math.min(normalizeMaxOutputTokens(options.maxOutputTokens, 120), 200),
  });
  return {
    text: result.text,
    reasoningContent: result.reasoningContent,
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  cleanBaseUrl,
  listModelIds,
  generateText,
  generateJson,
  testConnection,
};

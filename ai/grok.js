const OpenAI = require('openai');

const DEFAULT_BASE_URL = 'https://api.x.ai/v1';
const GROK_MIN_OUTPUT_TOKENS = 16;

function cleanBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
}

function createClient(apiKey, baseUrl = DEFAULT_BASE_URL) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('Grok API key is not configured for AI bots');
  return new OpenAI({
    apiKey: key,
    baseURL: cleanBaseUrl(baseUrl),
  });
}

function normalizeMaxOutputTokens(value, fallback = 900) {
  if (value == null || value === '') return Math.max(GROK_MIN_OUTPUT_TOKENS, Math.round(Number(fallback) || 900));
  const parsed = Number(value);
  const safeFallback = Math.max(GROK_MIN_OUTPUT_TOKENS, Math.round(Number(fallback) || 900));
  if (!Number.isFinite(parsed)) return safeFallback;
  return Math.max(GROK_MIN_OUTPUT_TOKENS, Math.round(parsed));
}

function extractResponseText(response) {
  if (!response) return '';
  if (typeof response.output_text === 'string') return response.output_text.trim();

  const parts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
      if (content.type === 'text' && content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
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

async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    return { raw: text };
  }
}

function headers(apiKey, extras = {}) {
  return {
    Authorization: `Bearer ${String(apiKey || '').trim()}`,
    ...extras,
  };
}

async function createEmbedding({ apiKey, baseUrl = DEFAULT_BASE_URL, model, input }) {
  const client = createClient(apiKey, baseUrl);
  const text = String(input || '').trim();
  if (!text) throw new Error('Embedding input is empty');
  const response = await client.embeddings.create({
    model,
    input: text.slice(0, 24000),
  });
  return response.data?.[0]?.embedding || [];
}

async function listModelIds({ apiKey, baseUrl = DEFAULT_BASE_URL }) {
  const client = createClient(apiKey, baseUrl);
  const ids = [];
  for await (const model of client.models.list()) {
    if (model?.id) ids.push(String(model.id));
  }
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

async function listImageModelIds({ apiKey, baseUrl = DEFAULT_BASE_URL }) {
  const res = await fetch(`${cleanBaseUrl(baseUrl)}/image-generation-models`, {
    headers: headers(apiKey),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error?.message || data.error || data.raw || 'Could not load Grok image models');
  const rows = Array.isArray(data.models) ? data.models : (Array.isArray(data.data) ? data.data : []);
  const ids = [];
  for (const row of rows) {
    if (row?.id) ids.push(String(row.id));
    if (Array.isArray(row?.aliases)) {
      for (const alias of row.aliases) {
        if (alias) ids.push(String(alias));
      }
    }
  }
  return [...new Set(ids.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

async function generateText({ apiKey, baseUrl = DEFAULT_BASE_URL, model, system, user, maxOutputTokens = 900, temperature = 0.45 }) {
  const client = createClient(apiKey, baseUrl);
  const response = await client.responses.create({
    model,
    input: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    max_output_tokens: normalizeMaxOutputTokens(maxOutputTokens),
  });
  return extractResponseText(response);
}

async function generateJson({ apiKey, baseUrl = DEFAULT_BASE_URL, model, system, user, fallback = {}, maxOutputTokens = 1400 }) {
  const text = await generateText({
    apiKey,
    baseUrl,
    model,
    system: `${system}\n\nReturn only valid JSON. Do not wrap it in Markdown.`,
    user,
    maxOutputTokens,
    temperature: 0.2,
  });
  return safeJsonParse(text, fallback);
}

async function generateImage({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  model,
  prompt,
  n = 1,
  aspectRatio = '',
  resolution = '',
  responseFormat = 'b64_json',
}) {
  const body = {
    model,
    prompt: String(prompt || '').trim(),
    n: Math.max(1, Math.min(10, Math.round(Number(n) || 1))),
    response_format: responseFormat,
  };
  if (aspectRatio) body.aspect_ratio = String(aspectRatio).trim();
  if (resolution) body.resolution = String(resolution).trim();

  const res = await fetch(`${cleanBaseUrl(baseUrl)}/images/generations`, {
    method: 'POST',
    headers: headers(apiKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error?.message || data.error || data.raw || 'Grok image generation failed');

  const image = Array.isArray(data.data) ? data.data[0] : null;
  if (!image) throw new Error('Grok image generation returned no image');
  return {
    model: data.model || model,
    revisedPrompt: image.revised_prompt || data.revised_prompt || '',
    b64Json: image.b64_json || '',
    url: image.url || '',
  };
}

async function testConnection({ apiKey, baseUrl = DEFAULT_BASE_URL, model }) {
  const text = await generateText({
    apiKey,
    baseUrl,
    model,
    system: 'You are Grok, a helpful AI assistant.',
    user: 'Say briefly that the Grok API connection works.',
    maxOutputTokens: 120,
    temperature: 0.2,
  });
  return { text };
}

module.exports = {
  DEFAULT_BASE_URL,
  GROK_MIN_OUTPUT_TOKENS,
  cleanBaseUrl,
  createEmbedding,
  listModelIds,
  listImageModelIds,
  generateText,
  generateJson,
  generateImage,
  testConnection,
};

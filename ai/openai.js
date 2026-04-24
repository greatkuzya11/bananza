const OpenAI = require('openai');

const OPENAI_MIN_OUTPUT_TOKENS = 16;

function createClient(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('OpenAI API key is not configured for AI bots');
  return new OpenAI({ apiKey: key });
}

function normalizeMaxOutputTokens(value, fallback = 900) {
  if (value == null || value === '') return Math.max(OPENAI_MIN_OUTPUT_TOKENS, Math.round(Number(fallback) || 900));
  const parsed = Number(value);
  const safeFallback = Math.max(OPENAI_MIN_OUTPUT_TOKENS, Math.round(Number(fallback) || 900));
  if (!Number.isFinite(parsed)) return safeFallback;
  return Math.max(OPENAI_MIN_OUTPUT_TOKENS, Math.round(parsed));
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

function collectOutputTextEntries(response) {
  const entries = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' || content?.type === 'text') entries.push(content);
    }
  }
  return entries;
}

function collectContainerFileCitations(response) {
  const citations = [];
  for (const entry of collectOutputTextEntries(response)) {
    for (const annotation of entry?.annotations || []) {
      if (annotation?.type === 'container_file_citation') citations.push(annotation);
    }
  }
  return citations;
}

function collectImageGenerationCalls(response) {
  const calls = [];
  for (const item of response?.output || []) {
    if (item?.type === 'image_generation_call') calls.push(item);
    for (const content of item?.content || []) {
      if (content?.type === 'image_generation_call') calls.push(content);
    }
  }
  return calls;
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

async function createEmbedding({ apiKey, model, input }) {
  const client = createClient(apiKey);
  const text = String(input || '').trim();
  if (!text) throw new Error('Embedding input is empty');
  const response = await client.embeddings.create({
    model: model || 'text-embedding-3-small',
    input: text.slice(0, 24000),
  });
  return response.data?.[0]?.embedding || [];
}

async function listModelIds({ apiKey }) {
  const client = createClient(apiKey);
  const ids = [];
  for await (const model of client.models.list()) {
    if (model?.id) ids.push(String(model.id));
  }
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

async function createResponse({
  apiKey,
  model,
  input,
  instructions = '',
  tools = [],
  toolChoice = 'auto',
  include = [],
  maxOutputTokens = 900,
  temperature = null,
}) {
  const client = createClient(apiKey);
  const payload = {
    model,
    input,
    max_output_tokens: normalizeMaxOutputTokens(maxOutputTokens),
  };
  if (instructions) payload.instructions = String(instructions);
  if (Array.isArray(tools) && tools.length) payload.tools = tools;
  if (toolChoice) payload.tool_choice = toolChoice;
  if (Array.isArray(include) && include.length) payload.include = include;
  if (typeof temperature === 'number' && Number.isFinite(temperature)) payload.temperature = temperature;
  return client.responses.create(payload);
}

async function generateText({ apiKey, model, system, user, maxOutputTokens = 900, temperature = 0.45 }) {
  const response = await createResponse({
    model,
    apiKey,
    input: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    maxOutputTokens,
  });
  return extractResponseText(response);
}

async function generateJson({ apiKey, model, system, user, fallback = {}, maxOutputTokens = 1400 }) {
  const text = await generateText({
    apiKey,
    model,
    system: `${system}\n\nReturn only valid JSON. Do not wrap it in Markdown.`,
    user,
    maxOutputTokens,
    temperature: 0.2,
  });
  return safeJsonParse(text, fallback);
}

async function downloadContainerFile({ apiKey, containerId, fileId }) {
  const client = createClient(apiKey);
  const response = await client.containers.files.content.retrieve(fileId, { container_id: containerId });
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = String(response.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim() || 'application/octet-stream';
  return { buffer, mimeType };
}

module.exports = {
  OPENAI_MIN_OUTPUT_TOKENS,
  createEmbedding,
  listModelIds,
  createResponse,
  extractResponseText,
  collectOutputTextEntries,
  collectContainerFileCitations,
  collectImageGenerationCalls,
  generateText,
  generateJson,
  downloadContainerFile,
};

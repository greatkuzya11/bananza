const OpenAI = require('openai');

const OPENAI_MIN_OUTPUT_TOKENS = 16;
const OPENAI_MAX_OUTPUT_TOKENS = 128000;

function createClient(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('OpenAI API key is not configured for AI bots');
  return new OpenAI({ apiKey: key });
}

function normalizeMaxOutputTokens(value, fallback = 900) {
  const safeFallback = Math.max(OPENAI_MIN_OUTPUT_TOKENS, Math.round(Number(fallback) || 900));
  const cappedFallback = Math.min(OPENAI_MAX_OUTPUT_TOKENS, safeFallback);
  if (value == null || value === '') return cappedFallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return cappedFallback;
  return Math.min(OPENAI_MAX_OUTPUT_TOKENS, Math.max(OPENAI_MIN_OUTPUT_TOKENS, Math.round(parsed)));
}

function errorText(error) {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object') {
    return String(
      error.message
      || error.error?.message
      || error.error
      || error.code
      || ''
    );
  }
  return String(error);
}

function isUnsupportedParameterError(error, parameter) {
  const text = errorText(error).toLowerCase();
  const needle = String(parameter || '').toLowerCase();
  return text.includes('unsupported parameter') && text.includes(needle);
}

function isGptImageModel(model) {
  const value = String(model || '').trim().toLowerCase();
  return value.startsWith('gpt-image') || value.startsWith('chatgpt-image');
}

function normalizeImageResponseResult(response, fallbackModel = '') {
  const image = Array.isArray(response?.data) ? response.data[0] : null;
  if (!image) {
    return {
      model: response?.model || fallbackModel || '',
      revisedPrompt: response?.revised_prompt || '',
      b64Json: '',
      url: '',
    };
  }
  return {
    model: response?.model || fallbackModel || '',
    revisedPrompt: image.revised_prompt || response?.revised_prompt || '',
    b64Json: image.b64_json || '',
    url: image.url || '',
  };
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
  try {
    return await client.responses.create(payload);
  } catch (error) {
    if (Object.prototype.hasOwnProperty.call(payload, 'temperature') && isUnsupportedParameterError(error, 'temperature')) {
      const retryPayload = { ...payload };
      delete retryPayload.temperature;
      console.warn(`[openai] model ${model || '(default)'} rejected temperature; retrying without it.`);
      return client.responses.create(retryPayload);
    }
    throw error;
  }
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

async function generateImage({
  apiKey,
  model,
  prompt,
  n = 1,
  size = '1024x1024',
  quality = 'auto',
  background = 'auto',
  outputFormat = 'png',
  responseFormat = 'b64_json',
}) {
  const client = createClient(apiKey);
  const promptText = String(prompt || '').trim();
  if (!promptText) throw new Error('Image prompt is empty');
  const selectedModel = String(model || 'gpt-image-2').trim();
  const payload = {
    model: selectedModel,
    prompt: promptText,
    n: Math.max(1, Math.min(10, Math.round(Number(n) || 1))),
  };
  if (size) payload.size = String(size).trim();
  if (quality) payload.quality = String(quality).trim();
  if (background) payload.background = String(background).trim();
  if (outputFormat) payload.output_format = String(outputFormat).trim();
  if (!isGptImageModel(selectedModel) && responseFormat) {
    payload.response_format = String(responseFormat).trim();
  }
  const response = await client.images.generate(payload);
  const result = normalizeImageResponseResult(response, selectedModel);
  if (!result.b64Json && !result.url) throw new Error('OpenAI image generation returned no image');
  return result;
}

async function editImage({
  apiKey,
  model,
  prompt,
  imageBuffer,
  imageName = 'source.png',
  mimeType = 'image/png',
  n = 1,
  size = '1024x1024',
  quality = 'auto',
  background = 'auto',
  outputFormat = 'png',
  responseFormat = 'b64_json',
}) {
  const client = createClient(apiKey);
  const promptText = String(prompt || '').trim();
  if (!promptText) throw new Error('Image edit prompt is empty');
  if (!imageBuffer?.length) throw new Error('Image edit source is empty');
  const selectedModel = String(model || 'gpt-image-2').trim();
  const image = await OpenAI.toFile(
    imageBuffer,
    String(imageName || 'source.png').trim() || 'source.png',
    { type: String(mimeType || 'image/png').trim() || 'image/png' }
  );
  const payload = {
    model: selectedModel,
    image,
    prompt: promptText,
    n: Math.max(1, Math.min(10, Math.round(Number(n) || 1))),
  };
  if (size) payload.size = String(size).trim();
  if (quality) payload.quality = String(quality).trim();
  if (background) payload.background = String(background).trim();
  if (outputFormat) payload.output_format = String(outputFormat).trim();
  if (!isGptImageModel(selectedModel) && responseFormat) {
    payload.response_format = String(responseFormat).trim();
  }
  const response = await client.images.edit(payload);
  const result = normalizeImageResponseResult(response, selectedModel);
  if (!result.b64Json && !result.url) throw new Error('OpenAI image edit returned no image');
  return result;
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
  OPENAI_MAX_OUTPUT_TOKENS,
  createEmbedding,
  listModelIds,
  createResponse,
  extractResponseText,
  collectOutputTextEntries,
  collectContainerFileCitations,
  collectImageGenerationCalls,
  generateText,
  generateJson,
  generateImage,
  editImage,
  normalizeMaxOutputTokens,
  normalizeImageResponseResult,
  downloadContainerFile,
};

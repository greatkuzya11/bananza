const OpenAI = require('openai');

function createClient(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('OpenAI API key is not configured for AI bots');
  return new OpenAI({ apiKey: key });
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

async function generateText({ apiKey, model, system, user, maxOutputTokens = 900, temperature = 0.45 }) {
  const client = createClient(apiKey);
  const response = await client.responses.create({
    model,
    input: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    max_output_tokens: maxOutputTokens,
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

module.exports = {
  createEmbedding,
  listModelIds,
  generateText,
  generateJson,
};

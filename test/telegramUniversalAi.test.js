const test = require('node:test');
const assert = require('node:assert/strict');

const grok = require('../ai/grok');
const { buildOpenAIImageRequest } = require('../ai/telegramUniversal');

test('Telegram universal OpenAI requests force image generation for create and edit', () => {
  const generate = buildOpenAIImageRequest({
    hasSource: false, model: 'gpt-image-2', size: '1024x1536', quality: 'high',
    background: 'opaque', outputFormat: 'png',
  });
  const edit = buildOpenAIImageRequest({
    hasSource: true, model: 'gpt-image-2', size: '1024x1536', quality: 'high',
    background: 'opaque', outputFormat: 'webp',
  });

  assert.deepEqual(generate.toolChoice, { type: 'image_generation' });
  assert.equal(generate.tools.length, 1);
  assert.equal(generate.tools[0].type, 'image_generation');
  assert.equal(generate.tools[0].action, 'generate');
  assert.equal(generate.tools[0].model, 'gpt-image-2');
  assert.equal(edit.tools[0].action, 'edit');
  assert.equal(edit.tools[0].output_format, 'webp');
});

test('Telegram universal Grok generation and editing use their dedicated image endpoints', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify({
      model: 'grok-imagine-image',
      data: [{ b64_json: Buffer.from('image').toString('base64') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  await grok.generateImage({
    apiKey: 'grok-key', baseUrl: 'https://api.x.ai/v1', model: 'grok-imagine-image',
    prompt: 'generate banana', n: 1, responseFormat: 'b64_json',
  });
  await grok.generateImageEdit({
    apiKey: 'grok-key', baseUrl: 'https://api.x.ai/v1', model: 'grok-imagine-image',
    prompt: 'edit banana', imageUrl: 'data:image/png;base64,aW1hZ2U=', responseFormat: 'b64_json',
  });

  assert.match(calls[0].url, /\/images\/generations$/);
  assert.equal(calls[0].body.prompt, 'generate banana');
  assert.match(calls[1].url, /\/images\/edits$/);
  assert.equal(calls[1].body.prompt, 'edit banana');
  assert.equal(calls[1].body.image.type, 'image_url');
  assert.match(calls[1].body.image.url, /^data:image\/png;base64,/);
});

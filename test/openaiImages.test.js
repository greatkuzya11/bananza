const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OPENAI_MAX_OUTPUT_TOKENS,
  OPENAI_MIN_OUTPUT_TOKENS,
  normalizeImageResponseResult,
  normalizeMaxOutputTokens,
} = require('../ai/openai');

test('normalizeMaxOutputTokens allows current OpenAI upper limit and caps above it', () => {
  assert.equal(normalizeMaxOutputTokens(128000), OPENAI_MAX_OUTPUT_TOKENS);
  assert.equal(normalizeMaxOutputTokens(250000), OPENAI_MAX_OUTPUT_TOKENS);
  assert.equal(normalizeMaxOutputTokens(1), OPENAI_MIN_OUTPUT_TOKENS);
});

test('normalizeImageResponseResult extracts base64 image payloads', () => {
  const result = normalizeImageResponseResult({
    model: 'gpt-image-2',
    data: [{
      b64_json: 'abc123',
      revised_prompt: 'A clearer prompt',
    }],
  }, 'fallback-image-model');

  assert.deepEqual(result, {
    model: 'gpt-image-2',
    revisedPrompt: 'A clearer prompt',
    b64Json: 'abc123',
    url: '',
  });
});

test('normalizeImageResponseResult extracts URL image payloads', () => {
  const result = normalizeImageResponseResult({
    data: [{
      url: 'https://example.test/image.png',
    }],
  }, 'dall-e-3');

  assert.equal(result.model, 'dall-e-3');
  assert.equal(result.revisedPrompt, '');
  assert.equal(result.b64Json, '');
  assert.equal(result.url, 'https://example.test/image.png');
});

test('normalizeImageResponseResult tolerates empty image responses', () => {
  const result = normalizeImageResponseResult(null, 'gpt-image-2');

  assert.deepEqual(result, {
    model: 'gpt-image-2',
    revisedPrompt: '',
    b64Json: '',
    url: '',
  });
});

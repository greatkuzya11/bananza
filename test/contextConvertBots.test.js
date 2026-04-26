const test = require('node:test');
const assert = require('node:assert/strict');

const { __private } = require('../ai');

test('normalizeBotKind keeps convert for every provider and preserves provider-specific kinds', () => {
  assert.equal(__private.normalizeBotKind('convert', 'openai'), 'convert');
  assert.equal(__private.normalizeBotKind('convert', 'grok'), 'convert');
  assert.equal(__private.normalizeBotKind('convert', 'deepseek'), 'convert');
  assert.equal(__private.normalizeBotKind('convert', 'yandex'), 'convert');

  assert.equal(__private.normalizeBotKind('universal', 'openai'), 'universal');
  assert.equal(__private.normalizeBotKind('universal', 'grok'), 'universal');
  assert.equal(__private.normalizeBotKind('image', 'grok'), 'image');
  assert.equal(__private.normalizeBotKind('image', 'openai'), 'text');
});

test('isContextTransformBot only matches convert bots', () => {
  assert.equal(__private.isContextTransformBot({ kind: 'convert' }), true);
  assert.equal(__private.isContextTransformBot({ kind: 'text' }), false);
  assert.equal(__private.isContextTransformBot({ kind: 'universal' }), false);
  assert.equal(__private.isContextTransformBot(null), false);
});

test('serializeContextConvertBot returns member-facing convert bot payload without chat persona fields', () => {
  const transformPrompt = 'Rewrite the text so it sounds clearer, warmer, and more concise. '.repeat(5);
  const serialized = __private.serializeContextConvertBot({
    id: '42',
    name: 'Clarity Banana',
    provider: 'grok',
    kind: 'convert',
    response_model: 'grok-4-fast',
    transform_prompt: transformPrompt,
    mention: 'should-not-leak',
    style: 'should-not-leak',
  });

  assert.deepEqual(Object.keys(serialized).sort(), [
    'id',
    'kind',
    'name',
    'provider',
    'response_model',
    'transform_prompt',
    'transform_prompt_preview',
  ]);
  assert.equal(serialized.id, 42);
  assert.equal(serialized.kind, 'convert');
  assert.equal(serialized.provider, 'grok');
  assert.equal(serialized.transform_prompt, transformPrompt);
  assert.ok(serialized.transform_prompt_preview.length <= 162);
  assert.ok(serialized.transform_prompt_preview.length > 0);
  assert.ok(serialized.transform_prompt_preview.length < transformPrompt.length);
});

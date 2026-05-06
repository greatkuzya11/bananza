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
  assert.equal(__private.normalizeBotKind('chatshot', 'openai'), 'chatshot');
  assert.equal(__private.normalizeBotKind('chatshot', 'grok'), 'chatshot');
  assert.equal(__private.normalizeBotKind('chatshot', 'deepseek'), 'text');
});

test('isContextTransformBot only matches convert bots', () => {
  assert.equal(__private.isContextTransformBot({ kind: 'convert' }), true);
  assert.equal(__private.isContextTransformBot({ kind: 'text' }), false);
  assert.equal(__private.isContextTransformBot({ kind: 'universal' }), false);
  assert.equal(__private.isContextTransformBot(null), false);
});

test('chatshot bots are detected and excluded from normal chat selection', () => {
  assert.equal(__private.isChatShotBot({ kind: 'chatshot' }), true);
  assert.equal(__private.isChatShotBot({ kind: 'convert' }), false);
  assert.equal(__private.isChatShotBot(null), false);
  assert.equal(__private.isChatSelectableBotKind({ kind: 'chatshot' }), false);
  assert.equal(__private.isChatSelectableBotKind({ kind: 'convert' }), false);
  assert.equal(__private.isChatSelectableBotKind({ kind: 'text' }), true);
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

test('serializeChatShotBot returns member-facing image generation settings', () => {
  const serialized = __private.serializeChatShotBot({
    id: '77',
    name: 'Snapshot Banana',
    provider: 'openai',
    kind: 'chatshot',
    response_model: 'gpt-4o-mini',
    image_model: 'gpt-image-2',
    image_resolution: '1024x1024',
    image_quality: 'high',
    image_background: 'auto',
    image_output_format: 'png',
    image_aspect_ratio: '',
    chatshot_context_limit: 250,
  });

  assert.equal(serialized.id, 77);
  assert.equal(serialized.kind, 'chatshot');
  assert.equal(serialized.response_model, 'gpt-4o-mini');
  assert.equal(serialized.image_model, 'gpt-image-2');
  assert.equal(serialized.chatshot_context_limit, 100);
  assert.equal(Object.prototype.hasOwnProperty.call(serialized, 'mention'), false);
});

test('sanitizeChatShotPrompt softens risky image prompts into safe banana prompts', () => {
  const prompt = __private.sanitizeChatShotPrompt('A fight with a knife, blood, politics, and drugs in a dark alley.', 'photo');
  assert.match(prompt, /banana|strawberry jam|community festival/i);
  assert.doesNotMatch(prompt, /\bknife\b/i);
  assert.doesNotMatch(prompt, /\bblood\b/i);
  assert.match(prompt, /Realistic photo style/i);
});

test('normalizeChatShotPromptText keeps risky words when banana filter is off', () => {
  const prompt = __private.normalizeChatShotPromptText('A fight with a knife and blood in a dark alley.', 'comic');
  assert.match(prompt, /\bfight\b/i);
  assert.match(prompt, /\bknife\b/i);
  assert.match(prompt, /\bblood\b/i);
  assert.doesNotMatch(prompt, /banana|strawberry jam/i);
  assert.match(prompt, /Colorful comic style/i);
});

test('detectChatShotContextLanguage picks Russian Cyrillic for Russian chat text', () => {
  const context = [
    'Alice: \u041f\u0440\u0438\u0432\u0435\u0442, \u0434\u0435\u043b\u0430\u0435\u043c \u0447\u0430\u0442\u0448\u043e\u0442 \u043f\u0440\u043e \u043d\u0430\u0448 \u0432\u0435\u0447\u0435\u0440.',
    'Bob: \u0414\u0430, \u043d\u0443\u0436\u043d\u044b \u0440\u0435\u043f\u043b\u0438\u043a\u0438 \u043d\u0430 \u0440\u0443\u0441\u0441\u043a\u043e\u043c.',
  ].join('\n');
  assert.equal(__private.detectChatShotContextLanguage(context), 'Russian (Cyrillic)');
});

test('detectChatShotContextLanguage picks English Latin for English chat text', () => {
  const context = [
    'Alice: Let us make a poster for tonight.',
    'Bob: The speech bubbles should stay in English.',
  ].join('\n');
  assert.equal(__private.detectChatShotContextLanguage(context), 'English/Latin');
});

test('detectChatShotContextLanguage uses the dominant mixed chat language', () => {
  const mostlyRussian = [
    'Alice: \u041f\u0440\u0438\u0432\u0435\u0442, \u043d\u0443\u0436\u043d\u0430 \u0430\u0444\u0438\u0448\u0430 \u0441 \u0440\u0443\u0441\u0441\u043a\u0438\u043c\u0438 \u0440\u0435\u043f\u043b\u0438\u043a\u0430\u043c\u0438.',
    'Bob: ok',
  ].join('\n');
  const mostlyEnglish = [
    '\u0410\u043b\u0438\u0441\u0430: ok',
    'Bob: Make the visible signs and speech bubbles stay in English.',
  ].join('\n');
  assert.equal(__private.detectChatShotContextLanguage(mostlyRussian), 'Russian (Cyrillic)');
  assert.equal(__private.detectChatShotContextLanguage(mostlyEnglish), 'English/Latin');
});

test('buildChatShotPromptSystem enforces Russian Cyrillic visible text contract', () => {
  const system = __private.buildChatShotPromptSystem('comic', true, 'Russian (Cyrillic)');
  assert.match(system, /Russian \(Cyrillic\)/);
  assert.match(system, /natural Russian written in Cyrillic/i);
  assert.match(system, /Do not translate Russian chat text into English/i);
  assert.doesNotMatch(system, /no visible text|no speech bubbles/i);
});

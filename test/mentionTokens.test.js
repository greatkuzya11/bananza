const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractMentionTokens,
  hasMentionToken,
  normalizeMentionToken,
  removeMentionTokens,
} = require('../mentionTokens');

test('mention tokens match exact underscore and hyphen names', () => {
  assert.deepEqual(extractMentionTokens('@ai_2 ping @ai-2 then @ai, and @AI!'), ['ai_2', 'ai-2', 'ai']);

  assert.equal(hasMentionToken('@ai_2 ping', 'ai_2'), true);
  assert.equal(hasMentionToken('@ai_2 ping', 'ai'), false);
  assert.equal(hasMentionToken('@ai-2 ping', 'ai-2'), true);
  assert.equal(hasMentionToken('@ai-2 ping', 'ai'), false);
  assert.equal(hasMentionToken('@ai, ping', 'ai'), true);
  assert.equal(hasMentionToken('@AI! ping', 'ai'), true);
});

test('mention extraction ignores email and middle-of-word at signs', () => {
  assert.deepEqual(extractMentionTokens('mail me at user@ai.test and word@ai today'), []);
  assert.equal(hasMentionToken('mail me at user@ai.test', 'ai'), false);
  assert.equal(hasMentionToken('word@ai today', 'ai'), false);
});

test('mention token normalization accepts only token-shaped names', () => {
  assert.equal(normalizeMentionToken('@Ai_2'), 'ai_2');
  assert.equal(normalizeMentionToken('ai-2'), 'ai-2');
  assert.equal(normalizeMentionToken('AI Bot'), '');
});

test('removeMentionTokens removes only exact mention tokens', () => {
  assert.equal(removeMentionTokens('@ai_2 hello @ai', 'ai').replace(/\s+/g, ' ').trim(), '@ai_2 hello');
  assert.equal(removeMentionTokens('@ai-2 hello @ai', 'ai').replace(/\s+/g, ' ').trim(), '@ai-2 hello');
  assert.equal(removeMentionTokens('@AI, hello', 'ai').replace(/\s+/g, ' ').trim(), ', hello');
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REACTION_KEYS,
  REACTION_MEME_KEYS,
  normalizeReactionKey,
  resolveReactionEmoji,
} = require('../../ai/reactionKeys');

test('normalizeReactionKey resolves aliases in English and Russian', () => {
  assert.equal(REACTION_KEYS.has('like'), true);
  assert.equal(REACTION_MEME_KEYS.has('clown'), true);
  assert.equal(normalizeReactionKey('thumbs_up'), 'like');
  assert.equal(normalizeReactionKey('лайк'), 'like');
  assert.equal(normalizeReactionKey('сердце'), 'heart');
  assert.equal(normalizeReactionKey('подкол'), 'clown');
  assert.equal(normalizeReactionKey('trash'), 'poop');
  assert.equal(normalizeReactionKey('unknown'), '');
});

test('resolveReactionEmoji prefers canonical emoji mapping and keeps custom emoji', () => {
  assert.equal(resolveReactionEmoji({ reactionKey: 'fire' }), '🔥');
  assert.equal(resolveReactionEmoji({ reactionKey: 'custom', emoji: '🥳' }), '🥳');
  assert.equal(resolveReactionEmoji({ emoji: 'thumbsup' }), '👍');
  assert.equal(resolveReactionEmoji({ emoji: '💥' }), '💥');
});

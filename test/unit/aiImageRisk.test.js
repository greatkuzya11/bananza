const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analyzeAiImageRisk,
  isRiskyAiImagePrompt,
  normalizeRiskText,
} = require('../../public/js/ai-image-risk');

test('normalizeRiskText lowercases and compacts whitespace', () => {
  assert.equal(normalizeRiskText('  TEST   text  '), 'test text');
});

test('analyzeAiImageRisk detects risky prompt terms once per category-term pair', () => {
  const analysis = analyzeAiImageRisk('Generate blood and blood with penis in the scene');
  assert.equal(analysis.risky, true);
  assert.equal(analysis.matches.some((item) => item.category === 'gore' && item.term === 'blood'), true);
  assert.equal(analysis.matches.some((item) => item.category === 'genitals' && item.term === 'penis'), true);
});

test('isRiskyAiImagePrompt stays false for neutral prompts', () => {
  assert.equal(isRiskyAiImagePrompt('A calm banana on a beach at sunrise'), false);
});

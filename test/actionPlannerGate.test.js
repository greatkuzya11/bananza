const test = require('node:test');
const assert = require('node:assert/strict');

const {
  textLooksLikeCreatePollRequest,
  textLooksLikeVoteRequest,
  textLooksLikeReactRequest,
  textLooksLikeChatActionRequest,
  shouldAttemptBotActionPlan,
} = require('../ai/actionPlannerGate');

test('textLooksLikeChatActionRequest detects direct poll creation requests', () => {
  assert.equal(
    textLooksLikeChatActionRequest('\u0441\u0434\u0435\u043b\u0430\u0439 \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a\u0443 \u0442\u0438\u043f\u0430 \u043a\u0443\u0434\u0430 \u043f\u043e\u0439\u0434\u0435\u043c \u043f\u043e\u0441\u043b\u0435 \u0440\u0430\u0431\u043e\u0442\u044b \u0441 \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u0430\u043c\u0438 \u0432 \u0431\u0430\u0440 \u0438 \u0434\u043e\u043c\u043e\u0439'),
    true
  );
  assert.equal(
    textLooksLikeChatActionRequest('@grok \u0441\u043e\u0437\u0434\u0430\u0439 \u043e\u043f\u0440\u043e\u0441: \u043f\u0438\u0446\u0446\u0430 \u0438\u043b\u0438 \u0441\u0443\u0448\u0438'),
    true
  );
  assert.equal(
    textLooksLikeChatActionRequest('\u0437\u0430\u043f\u0438\u043b\u0438 \u043e\u043f\u0440\u043e\u0441 \u043f\u0440\u043e \u043e\u0444\u0438\u0441'),
    true
  );
  assert.equal(
    textLooksLikeChatActionRequest('@grok \u0434\u0430\u0432\u0430\u0439 \u0435\u0449\u0435 \u043e\u0434\u043d\u043e \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d\u0438\u0435 \u0441\u0434\u0435\u043b\u0430\u0435\u043c - \u043a\u0442\u043e \u0442\u0443\u0442 \u0441\u0430\u043c\u044b\u0439 \u043a\u0440\u0443\u0442\u043e\u0439? - \u0433\u0440\u043e\u043a \u0438 \u0430\u0434\u043c\u0438\u043d'),
    true
  );
  assert.equal(
    textLooksLikeChatActionRequest('@grok \u0434\u0430\u0432\u0430\u0439 \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d\u0438\u0435 \u0437\u0430\u043f\u0438\u043b\u0438\u043c - \u043a\u0442\u043e \u0442\u0443\u0442 \u0441\u0430\u043c\u044b\u0439 \u043a\u0440\u0443\u0442\u043e\u0439? - \u0433\u0440\u043e\u043a \u0438 \u0430\u0434\u043c\u0438\u043d'),
    true
  );
});

test('textLooksLikeCreatePollRequest ignores casual mentions of polls', () => {
  assert.equal(
    textLooksLikeCreatePollRequest('\u0434\u0430 \u043f\u043e\u0433\u043e\u0434\u0438, \u0442\u044b \u0436\u0435 \u0440\u0435\u0430\u043b\u044c\u043d\u043e \u043a\u043d\u043e\u043f\u043a\u043e\u0439 \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b'),
    false
  );
  assert.equal(
    textLooksLikeCreatePollRequest('\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d\u0438\u0435 \u0442\u044b \u0436\u0435 \u0443\u0436\u0435 \u0434\u0435\u043b\u0430\u043b'),
    false
  );
});

test('textLooksLikeVoteRequest requires a direct voting command', () => {
  assert.equal(
    textLooksLikeVoteRequest('\u0442\u044b \u0436\u0435 \u0440\u0435\u0430\u043b\u044c\u043d\u043e \u043a\u043d\u043e\u043f\u043a\u043e\u0439 \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b'),
    false
  );
  assert.equal(
    textLooksLikeVoteRequest('\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u0443\u0439 \u0437\u0430 \u043f\u0435\u0440\u0432\u044b\u0439 \u0432\u0430\u0440\u0438\u0430\u043d\u0442'),
    true
  );
  assert.equal(
    textLooksLikeVoteRequest('\u0434\u0430\u0432\u0430\u0439 \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u0443\u0435\u043c \u0437\u0430 \u043f\u0435\u0440\u0432\u044b\u0439'),
    true
  );
  assert.equal(
    textLooksLikeVoteRequest('\u043d\u0443 \u0438 \u0436\u043c\u0438 \u0437\u0430 \u0433\u0440\u043e\u043a\u0430'),
    true
  );
});

test('textLooksLikeReactRequest detects direct reaction commands', () => {
  assert.equal(
    textLooksLikeReactRequest('\u043b\u0430\u0439\u043a\u043d\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435'),
    true
  );
  assert.equal(
    textLooksLikeReactRequest('\u043f\u043e\u0441\u0442\u0430\u0432\u044c \u043a\u043b\u043e\u0443\u043d\u0430'),
    true
  );
  assert.equal(
    textLooksLikeReactRequest('\u0443\u0431\u0435\u0440\u0438 \u0440\u0435\u0430\u043a\u0446\u0438\u044e'),
    true
  );
  assert.equal(
    textLooksLikeReactRequest('\u0433\u043e\u0432\u043d\u043e \u043f\u043e\u0441\u0442\u0430\u0432\u044c \u043d\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435'),
    true
  );
});

test('textLooksLikeChatActionRequest ignores ordinary chat messages', () => {
  assert.equal(textLooksLikeChatActionRequest('\u043f\u0440\u0438\u0432\u0435\u0442, \u043a\u0430\u043a \u0434\u0435\u043b\u0430?'), false);
  assert.equal(textLooksLikeChatActionRequest('\u043f\u043e\u0441\u043b\u0435 \u0440\u0430\u0431\u043e\u0442\u044b \u043f\u043e\u0439\u0434\u0435\u043c \u0434\u043e\u043c\u043e\u0439?'), false);
  assert.equal(
    textLooksLikeChatActionRequest('\u0434\u0430 \u043f\u043e\u0433\u043e\u0434\u0438, \u0442\u044b \u0436\u0435 \u0440\u0435\u0430\u043b\u044c\u043d\u043e \u043a\u043d\u043e\u043f\u043a\u043e\u0439 \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b'),
    false
  );
});

test('shouldAttemptBotActionPlan runs for action-like requests even without action permissions', () => {
  assert.equal(
    shouldAttemptBotActionPlan({
      hasMessageActions: true,
      botSupportsChatActions: false,
      botKind: 'text',
      requestedMode: 'text',
      text: '\u0441\u0434\u0435\u043b\u0430\u0439 \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a\u0443 \u043a\u0443\u0434\u0430 \u043f\u043e\u0439\u0434\u0435\u043c \u043f\u043e\u0441\u043b\u0435 \u0440\u0430\u0431\u043e\u0442\u044b',
      replyingToPoll: false,
    }),
    true
  );
});

test('shouldAttemptBotActionPlan stays off for ordinary text', () => {
  assert.equal(
    shouldAttemptBotActionPlan({
      hasMessageActions: true,
      botSupportsChatActions: true,
      botKind: 'text',
      requestedMode: 'text',
      text: '\u043f\u0440\u043e\u0441\u0442\u043e \u0440\u0430\u0441\u0441\u043a\u0430\u0436\u0438 \u0430\u043d\u0435\u043a\u0434\u043e\u0442',
      replyingToPoll: false,
    }),
    false
  );
});

test('shouldAttemptBotActionPlan stays off when replying to a poll without a direct command', () => {
  assert.equal(
    shouldAttemptBotActionPlan({
      hasMessageActions: true,
      botSupportsChatActions: true,
      botKind: 'text',
      requestedMode: 'text',
      text: '\u0442\u044b \u0436\u0435 \u0440\u0435\u0430\u043b\u044c\u043d\u043e \u043a\u043d\u043e\u043f\u043a\u043e\u0439 \u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b',
      replyingToPoll: true,
    }),
    false
  );
});

test('shouldAttemptBotActionPlan runs for direct vote requests on poll replies', () => {
  assert.equal(
    shouldAttemptBotActionPlan({
      hasMessageActions: true,
      botSupportsChatActions: true,
      botKind: 'text',
      requestedMode: 'text',
      text: '\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u0443\u0439 \u0437\u0430 \u043f\u0435\u0440\u0432\u044b\u0439 \u0432\u0430\u0440\u0438\u0430\u043d\u0442',
      replyingToPoll: true,
    }),
    true
  );
});

test('shouldAttemptBotActionPlan skips universal image/document requests', () => {
  assert.equal(
    shouldAttemptBotActionPlan({
      hasMessageActions: true,
      botSupportsChatActions: true,
      botKind: 'universal',
      requestedMode: 'image',
      text: '\u0441\u0434\u0435\u043b\u0430\u0439 \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a\u0443',
      replyingToPoll: false,
    }),
    false
  );
  assert.equal(
    shouldAttemptBotActionPlan({
      hasMessageActions: true,
      botSupportsChatActions: true,
      botKind: 'universal',
      requestedMode: 'document',
      text: '\u0441\u043e\u0437\u0434\u0430\u0439 \u043e\u043f\u0440\u043e\u0441',
      replyingToPoll: false,
    }),
    false
  );
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  tryParseJsonObject,
  parseLooseActionPlanText,
  parseDirectCreatePollRequest,
  parseDirectVoteRequest,
  parseDirectReactionRequest,
} = require('../ai/actionPlanTextParser');

test('tryParseJsonObject extracts object from surrounding text', () => {
  const parsed = tryParseJsonObject('note\n{"reply_mode":"none","actions":[]}\nthanks', null);
  assert.deepEqual(parsed, { reply_mode: 'none', actions: [] });
});

test('parseLooseActionPlanText recovers create_poll function-style output', () => {
  const plan = parseLooseActionPlanText(`
    create_poll(
      question="\u042f \u0436\u0440\u0443 \u0433\u043e\u0432\u043d\u043e?",
      options=["\u0434\u0430", "\u043d\u0435\u0442"],
      allows_multiple=false,
      show_voters=false,
      close_preset="open-ended",
      pin_after_create=true
    )
  `);

  assert.ok(plan);
  assert.equal(plan.reply_mode, 'none');
  assert.equal(plan.actions.length, 1);
  assert.deepEqual(plan.actions[0], {
    type: 'create_poll',
    question: '\u042f \u0436\u0440\u0443 \u0433\u043e\u0432\u043d\u043e?',
    options: ['\u0434\u0430', '\u043d\u0435\u0442'],
    allows_multiple: false,
    show_voters: false,
    close_preset: null,
    pin_after_create: true,
  });
});

test('parseLooseActionPlanText recovers react and pin function-style output', () => {
  const plan = parseLooseActionPlanText(`
    react_message(target="source_message", reaction_key="fire", mode="replace")
    pin_message(target="reply_to")
  `);

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    { type: 'react_message', target: 'source_message', reaction_key: 'fire', emoji: '', mode: 'replace' },
    { type: 'pin_message', target: 'reply_to' },
  ]);
});

test('parseLooseActionPlanText recovers fake poll summary text', () => {
  const plan = parseLooseActionPlanText(`
    Poll #1097: \u043a\u0442\u043e \u043c\u0443\u0434\u0430\u043a? Poll metadata: status=open; deadline=open-ended; type=single choice; visibility=public voters; style=pulse; created_by=Grok AI; created_at=2026-04-24 23:42:00; total_voters=0; total_votes=0.
    Poll options/results: 1. \u041a\u043e\u043b\u044f - 0 votes (0% of total votes); voters: none 2. \u0433\u0430\u0432\u0440\u044e\u0448\u0430 - 0 votes (0% of total votes); voters: none
  `);

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'create_poll',
      question: '\u043a\u0442\u043e \u043c\u0443\u0434\u0430\u043a?',
      options: ['\u041a\u043e\u043b\u044f', '\u0433\u0430\u0432\u0440\u044e\u0448\u0430'],
      allows_multiple: false,
      show_voters: true,
      close_preset: null,
      pin_after_create: false,
    },
  ]);
});

test('parseLooseActionPlanText recovers natural language success text with quoted poll and options', () => {
  const plan = parseLooseActionPlanText('\u0413\u043e\u0442\u043e\u0432\u043e! \u0421\u043e\u0437\u0434\u0430\u043b \u043e\u043f\u0440\u043e\u0441 \u00ab\u043a\u0442\u043e \u043c\u0443\u0434\u0430\u043a?\u00bb \u0441 \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u0430\u043c\u0438 \u00ab\u041a\u043e\u043b\u044f\u00bb, \u00ab\u043f\u0435\u0442\u044f\u00bb \u0438 \u00ab\u0433\u0430\u0432\u0440\u044e\u0448\u0430\u00bb (\u043e\u0434\u0438\u043d \u0432\u044b\u0431\u043e\u0440, \u043f\u0443\u0431\u043b\u0438\u0447\u043d\u044b\u0435 \u0433\u043e\u043b\u043e\u0441\u0430, \u0431\u0435\u0437 \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u0430).');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'create_poll',
      question: '\u043a\u0442\u043e \u043c\u0443\u0434\u0430\u043a?',
      options: ['\u041a\u043e\u043b\u044f', '\u043f\u0435\u0442\u044f', '\u0433\u0430\u0432\u0440\u044e\u0448\u0430'],
      allows_multiple: false,
      show_voters: true,
      close_preset: null,
      pin_after_create: false,
    },
  ]);
});

test('parseLooseActionPlanText recovers natural language success text with quoted question and trailing options', () => {
  const plan = parseLooseActionPlanText('\u0425\u0430, \u0435\u0449\u0451 \u043e\u0434\u043d\u0443? \u0417\u0430\u043f\u0443\u0441\u0442\u0438\u043b \u043e\u043f\u0440\u043e\u0441 "\u043a\u0442\u043e \u0442\u0443\u0442 \u0441\u0430\u043c\u044b\u0439 \u043a\u0440\u0443\u0442\u043e\u0439?" \u2014 \u0433\u0440\u043e\u043a \u0438\u043b\u0438 \u0430\u0434\u043c\u0438\u043d. \u0413\u043e\u043b\u043e\u0441\u0438, \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0438\u043c, \u043a\u0442\u043e \u0432\u043f\u0435\u0440\u0435\u0434\u0438!');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'create_poll',
      question: '\u043a\u0442\u043e \u0442\u0443\u0442 \u0441\u0430\u043c\u044b\u0439 \u043a\u0440\u0443\u0442\u043e\u0439?',
      options: ['\u0433\u0440\u043e\u043a', '\u0430\u0434\u043c\u0438\u043d'],
      allows_multiple: false,
      show_voters: false,
      close_preset: null,
      pin_after_create: false,
    },
  ]);
});

test('parseLooseActionPlanText prefers vote action for natural language voting success text', () => {
  const plan = parseLooseActionPlanText('\u0413\u043e\u0442\u043e\u0432\u043e! \u041f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b \u0437\u0430 \u00ab\u041a\u043e\u043b\u044f\u00bb \u0432 \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d\u0438\u0438 \u00ab\u043a\u0442\u043e \u043c\u0443\u0434\u0430\u043a?\u00bb.');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'vote_poll',
      target: 'reply_to',
      option_texts: ['\u041a\u043e\u043b\u044f'],
    },
  ]);
});

test('parseDirectCreatePollRequest extracts question and options from direct user request', () => {
  const plan = parseDirectCreatePollRequest('\u0434\u0430\u0432\u0430\u0439 \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d\u0438\u0435 \u0441\u0434\u0435\u043b\u0430\u0435\u043c - \u043a\u0442\u043e \u043a\u0440\u0443\u0447\u0435? \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u044b - \u0433\u0440\u043e\u043a \u0438 \u0447\u0430\u0442\u0433\u043f\u0442');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'create_poll',
      question: '\u043a\u0442\u043e \u043a\u0440\u0443\u0447\u0435?',
      options: ['\u0433\u0440\u043e\u043a', '\u0447\u0430\u0442\u0433\u043f\u0442'],
      allows_multiple: false,
      show_voters: false,
      close_preset: null,
      pin_after_create: false,
    },
  ]);
});

test('parseDirectVoteRequest extracts explicit vote choice from user request', () => {
  const plan = parseDirectVoteRequest('\u043d\u0443 \u0438 \u0436\u043c\u0438 \u0437\u0430 \u0433\u0440\u043e\u043a\u0430');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'vote_poll',
      target: 'latest_open_poll',
      option_texts: ['\u0433\u0440\u043e\u043a'],
    },
  ]);
});

test('parseDirectReactionRequest extracts deterministic like intent from direct user request', () => {
  const plan = parseDirectReactionRequest('\u043b\u0430\u0439\u043a\u043d\u0438 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'react_message',
      target: 'reply_to',
      reaction_key: 'like',
      emoji: '',
      mode: 'replace',
    },
  ]);
});

test('parseDirectReactionRequest extracts meme reaction intent from direct user request', () => {
  const plan = parseDirectReactionRequest('\u043f\u043e\u0441\u0442\u0430\u0432\u044c \u043a\u043b\u043e\u0443\u043d\u0430');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'react_message',
      target: 'reply_to',
      reaction_key: 'clown',
      emoji: '',
      mode: 'replace',
    },
  ]);
});

test('parseDirectReactionRequest extracts reaction-first wording from direct user request', () => {
  const plan = parseDirectReactionRequest('\u0433\u043e\u0432\u043d\u043e \u043f\u043e\u0441\u0442\u0430\u0432\u044c \u043d\u0430 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'react_message',
      target: 'reply_to',
      reaction_key: 'poop',
      emoji: '',
      mode: 'replace',
    },
  ]);
});

test('parseDirectReactionRequest keeps explicit here-target on source message', () => {
  const plan = parseDirectReactionRequest('\u043b\u0430\u0439\u043a \u0441\u044e\u0434\u0430 \u043f\u043e\u0441\u0442\u0430\u0432\u044c');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'react_message',
      target: 'source_message',
      reaction_key: 'like',
      emoji: '',
      mode: 'replace',
    },
  ]);
});

test('parseDirectReactionRequest extracts remove intent from direct user request', () => {
  const plan = parseDirectReactionRequest('\u0443\u0431\u0435\u0440\u0438 \u0440\u0435\u0430\u043a\u0446\u0438\u044e');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'react_message',
      target: 'reply_to',
      reaction_key: null,
      emoji: '',
      mode: 'remove',
    },
  ]);
});

test('parseLooseActionPlanText recovers vote choice from unquoted generated text', () => {
  const plan = parseLooseActionPlanText('\u0422\u0430\u043a \u0447\u0442\u043e: \u0432\u044b\u0431\u043e\u0440 \u2014 \u0433\u0440\u043e\u043a. \u0415\u0441\u043b\u0438 \u0445\u043e\u0447\u0435\u0448\u044c \u0433\u043e\u043b\u043e\u0441 \u2014 \u0436\u043c\u0438 \u0437\u0430 \u0433\u0440\u043e\u043a\u0430 \u0441\u0430\u043c.');

  assert.ok(plan);
  assert.deepEqual(plan.actions, [
    {
      type: 'vote_poll',
      target: 'latest_open_poll',
      option_texts: ['\u0433\u0440\u043e\u043a'],
    },
  ]);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { DateTime } = require('luxon');

const { createAiInitiativeFeature, __private } = require('../ai/initiative');
const {
  fitSyntheticInstruction,
  jsonContentByteLength,
  SYNTHETIC_INSTRUCTION_MAX_BYTES,
} = require('../ai/providerInput');

function createInitiativeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      display_name TEXT,
      is_ai_bot INTEGER DEFAULT 0,
      timezone TEXT
    );
    CREATE TABLE chats (
      id INTEGER PRIMARY KEY,
      name TEXT,
      type TEXT,
      created_by INTEGER,
      is_notes INTEGER DEFAULT 0
    );
    CREATE TABLE chat_members (
      chat_id INTEGER,
      user_id INTEGER,
      PRIMARY KEY(chat_id, user_id)
    );
    CREATE TABLE ai_bots (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      name TEXT,
      mention TEXT,
      provider TEXT DEFAULT 'openai',
      kind TEXT DEFAULT 'text',
      enabled INTEGER DEFAULT 1
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      chat_id INTEGER,
      user_id INTEGER,
      text TEXT,
      is_deleted INTEGER DEFAULT 0,
      ai_generated INTEGER DEFAULT 0,
      ai_bot_id INTEGER,
      reply_to_id INTEGER,
      transcription_text TEXT,
      created_at TEXT
    );
    CREATE TABLE ai_bot_initiative_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      chat_id INTEGER NOT NULL,
      bot_id INTEGER NOT NULL,
      enabled INTEGER DEFAULT 0,
      schedule_type TEXT DEFAULT 'fixed',
      fixed_time TEXT DEFAULT '09:00',
      window_start TEXT DEFAULT '09:00',
      window_end TEXT DEFAULT '18:00',
      timezone TEXT DEFAULT 'UTC',
      idle_threshold_minutes INTEGER DEFAULT 1440,
      min_gap_minutes INTEGER DEFAULT 1440,
      same_context_limit_enabled INTEGER DEFAULT 1,
      same_context_max_runs INTEGER DEFAULT 1,
      same_context_run_count INTEGER DEFAULT 0,
      prompt_mode TEXT DEFAULT 'context_question',
      custom_prompt TEXT DEFAULT '',
      holiday_country TEXT DEFAULT '',
      news_source_id INTEGER DEFAULT NULL,
      news_max_age_hours INTEGER DEFAULT 24,
      news_item_count INTEGER DEFAULT 1,
      news_use_chat_context INTEGER DEFAULT 1,
      news_prompt TEXT DEFAULT '',
      next_run_at TEXT DEFAULT NULL,
      last_run_at TEXT DEFAULT NULL,
      last_message_id INTEGER DEFAULT NULL,
      last_attempt_at TEXT DEFAULT NULL,
      last_attempt_status TEXT DEFAULT '',
      last_attempt_reason TEXT DEFAULT '',
      last_attempt_stage TEXT DEFAULT '',
      last_attempt_detail TEXT DEFAULT '',
      last_attempt_tries INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE ai_bot_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_user_id INTEGER,
      chat_id INTEGER,
      bot_id INTEGER,
      source_message_id INTEGER,
      due_at TEXT,
      requester_timezone TEXT,
      reminder_text TEXT,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      sent_message_id INTEGER,
      error TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE ai_news_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'rss',
      url TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      cache_ttl_minutes INTEGER DEFAULT 30,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE ai_news_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      guid TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT DEFAULT '',
      url TEXT DEFAULT '',
      published_at TEXT DEFAULT NULL,
      fetched_at TEXT DEFAULT (datetime('now')),
      raw_json TEXT DEFAULT '{}',
      UNIQUE(source_id, guid)
    );
    CREATE TABLE ai_news_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      source_id INTEGER NOT NULL,
      item_guid TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      UNIQUE(rule_id, source_id, item_guid)
    );
  `);
  db.prepare('INSERT INTO users(id, username, display_name, is_ai_bot) VALUES(1,?,?,0)').run('alice', 'Alice');
  db.prepare('INSERT INTO users(id, username, display_name, is_ai_bot) VALUES(2,?,?,1)').run('bot', 'Bot');
  db.prepare('INSERT INTO chats(id, name, type, created_by) VALUES(1,?,?,1)').run('General', 'group');
  db.prepare('INSERT INTO chat_members(chat_id, user_id) VALUES(1,1),(1,2)').run();
  db.prepare('INSERT INTO ai_bots(id, user_id, name, mention, provider, kind, enabled) VALUES(1,2,?,?,?,?,1)').run('Bot', 'bot', 'openai', 'text');
  db.prepare('INSERT INTO messages(id, chat_id, user_id, text, created_at) VALUES(1,1,1,?,?)').run('latest human message', '2026-05-27 09:40:00');
  return db;
}

function fakeApp() {
  return {
    get() {},
    post() {},
    put() {},
    delete() {},
  };
}

function routeApp() {
  const routes = new Map();
  const register = (method) => (path, ...handlers) => {
    routes.set(`${method} ${path}`, handlers.at(-1));
  };
  return {
    routes,
    get: register('GET'),
    post: register('POST'),
    put: register('PUT'),
    delete: register('DELETE'),
  };
}

function invokeRoute(handler, { body = {}, params = {}, user = { id: 1 } } = {}) {
  let statusCode = 200;
  let payload;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };
  const result = handler({ body, params, user }, res);
  return Promise.resolve(result).then(() => ({ statusCode, payload }));
}

const rssXml = `
  <rss version="2.0">
    <channel>
      <item>
        <guid>news-1</guid>
        <title>First &amp; fresh</title>
        <description><![CDATA[<p>Short <b>summary</b></p>]]></description>
        <link>https://example.com/news-1</link>
        <pubDate>Wed, 27 May 2026 09:50:00 GMT</pubDate>
      </item>
      <item>
        <guid>news-2</guid>
        <title>Second item</title>
        <description>Another summary</description>
        <link>https://example.com/news-2</link>
        <pubDate>Wed, 27 May 2026 09:45:00 GMT</pubDate>
      </item>
    </channel>
  </rss>
`;

test('initiative reminder parser handles relative Russian reminders', () => {
  const now = DateTime.fromISO('2026-05-27T10:00:00Z');
  const parsed = __private.parseDateTimeRule(
    'напомни мне через 30 минут проверить духовку',
    'Europe/Kaliningrad',
    now
  );

  assert.equal(parsed.isReminder, true);
  assert.equal(parsed.dueAtUtc, '2026-05-27T10:30:00Z');
  assert.equal(parsed.reminderText, 'проверить духовку');
});

test('initiative reminder parser handles tomorrow with explicit time', () => {
  const now = DateTime.fromISO('2026-05-27T10:00:00Z');
  const parsed = __private.parseDateTimeRule(
    'напомни завтра в 14-00 оплатить счет',
    'Europe/Kaliningrad',
    now
  );

  assert.equal(parsed.isReminder, true);
  assert.equal(parsed.dueAtUtc, '2026-05-28T12:00:00Z');
  assert.equal(parsed.reminderText, 'оплатить счет');
});

test('initiative reminder parser rejects recurring reminders in v1', () => {
  const parsed = __private.parseDateTimeRule(
    'напоминай каждый понедельник в 10:00 сделать отчет',
    'Europe/Kaliningrad',
    DateTime.fromISO('2026-05-27T10:00:00Z')
  );

  assert.equal(parsed.isReminder, true);
  assert.equal(parsed.unsupported, true);
  assert.equal(parsed.reason, 'recurring_reminders_not_supported');
});

test('initiative reminder parser asks for missing time', () => {
  const parsed = __private.parseDateTimeRule(
    'напомни завтра вынести мусор',
    'Europe/Kaliningrad',
    DateTime.fromISO('2026-05-27T10:00:00Z')
  );

  assert.equal(parsed.isReminder, true);
  assert.equal(parsed.needsClarification, true);
  assert.equal(parsed.reason, 'missing_time');
});

test('initiative next run supports fixed local time and random window', () => {
  const fixed = __private.computeNextRunAt({
    schedule_type: 'fixed',
    fixed_time: '09:00',
    timezone: 'Europe/Kaliningrad',
  }, DateTime.fromISO('2026-05-27T05:00:00Z'));
  assert.equal(fixed, '2026-05-27T07:00:00Z');

  const nextDay = __private.computeNextRunAt({
    schedule_type: 'fixed',
    fixed_time: '09:00',
    timezone: 'Europe/Kaliningrad',
  }, DateTime.fromISO('2026-05-27T08:00:00Z'));
  assert.equal(nextDay, '2026-05-28T07:00:00Z');

  const random = __private.computeNextRunAt({
    schedule_type: 'random_window',
    window_start: '10:00',
    window_end: '12:00',
    timezone: 'Europe/Kaliningrad',
  }, DateTime.fromISO('2026-05-27T06:00:00Z'), () => 0);
  assert.equal(random, '2026-05-27T08:00:00Z');

  const randomAfterWindowAttempt = __private.computeNextRunAfterDueAttempt({
    schedule_type: 'random_window',
    window_start: '08:00',
    window_end: '11:00',
    timezone: 'Europe/Kaliningrad',
  }, DateTime.fromISO('2026-05-27T07:30:00Z'), () => 0);
  assert.equal(randomAfterWindowAttempt, '2026-05-28T06:00:00Z');
});

test('initiative normalizes bad timezone to UTC', () => {
  assert.equal(__private.cleanTimezone('Not/A_Zone'), 'UTC');
  assert.equal(__private.cleanTimezone('Europe/Kaliningrad'), 'Europe/Kaliningrad');
});

test('initiative skips stale proactive windows instead of catching up', () => {
  const now = DateTime.fromISO('2026-05-27T12:00:00Z');

  assert.equal(__private.isMissedRuleRun({ next_run_at: '2026-05-27T11:50:00Z' }, now, 5), true);
  assert.equal(__private.isMissedRuleRun({ next_run_at: '2026-05-27T11:56:00Z' }, now, 5), false);
  assert.equal(__private.isMissedRuleRun({ next_run_at: '2026-05-27T12:10:00Z' }, now, 5), false);
});

test('initiative min gap tolerates scheduler second-level jitter', () => {
  const now = DateTime.fromISO('2026-05-28T07:00:00Z');
  const lastRunAt = DateTime.fromISO('2026-05-27T07:00:30Z');

  assert.equal(__private.minGapElapsed(now, lastRunAt, 1440), true);
});

test('initiative normalizes same-context repeat limit settings', () => {
  const rule = __private.normalizeRuleInput({
    chat_id: 1,
    bot_id: 2,
    idle_threshold_minutes: 0,
    same_context_limit_enabled: false,
    same_context_max_runs: 99,
  }, {}, DateTime.fromISO('2026-05-27T12:00:00Z'));

  assert.equal(rule.idle_threshold_minutes, 0);
  assert.equal(rule.same_context_limit_enabled, false);
  assert.equal(rule.same_context_max_runs, 20);
  assert.equal(rule.same_context_run_count, 0);
});

test('initiative parses and normalizes RSS news items', () => {
  const items = __private.parseNewsFeedXml(rssXml, 'https://example.com/rss');

  assert.equal(items.length, 2);
  assert.equal(items[0].guid, 'news-1');
  assert.equal(items[0].title, 'First & fresh');
  assert.equal(items[0].summary, 'Short summary');
  assert.equal(items[0].url, 'https://example.com/news-1');
  assert.equal(items[0].published_at, '2026-05-27T09:50:00Z');
});

test('initiative fallback RSS parser works without optional XML dependency', () => {
  const items = __private.parseNewsFeedXmlFallback(rssXml, 'https://example.com/rss');

  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'First & fresh');
  assert.equal(items[0].summary, 'Short summary');
  assert.equal(items[0].published_at, '2026-05-27T09:50:00Z');
});

test('initiative normalizes legacy date_holiday rules to news_hook', () => {
  const rule = __private.normalizeRuleInput({
    chat_id: 1,
    bot_id: 2,
    prompt_mode: 'date_holiday',
    news_max_age_hours: 999,
  }, {}, DateTime.fromISO('2026-05-27T12:00:00Z'));

  assert.equal(rule.prompt_mode, 'news_hook');
  assert.equal(rule.news_max_age_hours, 336);
  assert.equal(__private.normalizeRuleInput({ chat_id: 1, bot_id: 2, prompt_mode: 'news_hook', news_item_count: 99 }).news_item_count, 10);
  assert.equal(__private.normalizeRuleInput({ name: `  ${'x'.repeat(300)}  ` }).name.length, 240);
  assert.equal(rule.news_use_chat_context, true);
});

test('initiative rule API generates, preserves, trims, and resets rule names', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare('INSERT INTO ai_news_sources(id, name, type, url, enabled, cache_ttl_minutes) VALUES(1,?,?,?,?,30)').run(
    'Test RSS',
    'rss',
    'https://example.com/rss',
    1
  );
  const app = routeApp();
  createAiInitiativeFeature({
    app,
    db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    aiBotFeature: { resolveChatBotRuntime() { return true; } },
  });

  const createHandler = app.routes.get('POST /api/admin/ai-bot-initiatives/rules');
  const updateHandler = app.routes.get('PUT /api/admin/ai-bot-initiatives/rules/:id(\\d+)');
  const generated = await invokeRoute(createHandler, {
    body: { chat_id: 1, bot_id: 1, prompt_mode: 'news_hook', news_source_id: 1, name: '   ' },
  });
  assert.equal(generated.statusCode, 200);
  assert.equal(generated.payload.rule.name, 'Test RSS — General — Bot');
  const generatedId = generated.payload.rule.id;

  db.prepare('UPDATE chats SET name=? WHERE id=1').run('Renamed chat');
  db.prepare('UPDATE ai_bots SET name=? WHERE id=1').run('Renamed bot');
  db.prepare('UPDATE ai_news_sources SET name=? WHERE id=1').run('Renamed RSS');
  db.prepare('UPDATE ai_bot_initiative_rules SET same_context_run_count=5, last_message_id=1 WHERE id=?').run(generatedId);
  const preserved = await invokeRoute(updateHandler, {
    params: { id: String(generatedId) },
    body: { enabled: true },
  });
  assert.equal(preserved.payload.rule.name, 'Test RSS — General — Bot');
  assert.deepEqual(db.prepare('SELECT same_context_run_count, last_message_id FROM ai_bot_initiative_rules WHERE id=?').get(generatedId), {
    same_context_run_count: 0,
    last_message_id: null,
  });

  const regenerated = await invokeRoute(updateHandler, {
    params: { id: String(generatedId) },
    body: { name: '' },
  });
  assert.equal(regenerated.payload.rule.name, 'Renamed RSS — Renamed chat — Renamed bot');

  const custom = await invokeRoute(createHandler, {
    body: { chat_id: 1, bot_id: 1, prompt_mode: 'idle_ping', name: '  Morning ping  ' },
  });
  assert.equal(custom.payload.rule.name, 'Morning ping');
  assert.equal(db.prepare('SELECT name FROM ai_bot_initiative_rules WHERE id=?').get(custom.payload.rule.id).name, 'Morning ping');
  db.prepare('UPDATE ai_bot_initiative_rules SET same_context_limit_enabled=0, same_context_run_count=4, last_message_id=1 WHERE id=?').run(custom.payload.rule.id);
  await invokeRoute(updateHandler, {
    params: { id: String(custom.payload.rule.id) },
    body: { same_context_limit_enabled: true },
  });
  assert.deepEqual(db.prepare('SELECT same_context_run_count, last_message_id FROM ai_bot_initiative_rules WHERE id=?').get(custom.payload.rule.id), {
    same_context_run_count: 0,
    last_message_id: null,
  });
});

test('initiative diagnostics append safe request sizes without provider input content', () => {
  const error = new Error('Failed to parse request body as JSON');
  error.requestBytes = 19_950;
  error.requestOriginalBytes = 41_200;
  error.requestInputTruncated = true;

  assert.equal(
    __private.errorDetail(error),
    'Failed to parse request body as JSON [request_bytes=19950, original_bytes=41200, trimmed=true]'
  );
});

test('initiative test endpoint returns structured provider diagnostics without changing rule state', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare(`
    INSERT INTO ai_bot_initiative_rules(id, chat_id, bot_id, prompt_mode, next_run_at)
    VALUES(1,1,1,'idle_ping','2026-05-28T09:00:00Z')
  `).run();
  const app = routeApp();
  createAiInitiativeFeature({
    app, db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn() {
        const error = new Error('provider busy');
        error.code = 'RATE_LIMITED';
        error.status = 429;
        error.stage = 'provider';
        throw error;
      },
    },
  });

  const response = await invokeRoute(app.routes.get('POST /api/admin/ai-bot-initiatives/rules/:id(\\d+)/test'), {
    params: { id: '1' },
  });

  assert.equal(response.statusCode, 429);
  assert.deepEqual(response.payload, {
    error: 'provider busy',
    code: 'RATE_LIMITED',
    stage: 'provider',
    retryable: true,
  });
  assert.equal(db.prepare('SELECT last_attempt_at FROM ai_bot_initiative_rules WHERE id=1').get().last_attempt_at, null);
});

test('initiative news hook sends a fresh news item and records history', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare('INSERT INTO ai_news_sources(id, name, type, url, enabled, cache_ttl_minutes) VALUES(1,?,?,?,?,30)').run(
    'Test RSS',
    'rss',
    'https://example.com/rss',
    1
  );
  db.prepare(`
    INSERT INTO ai_bot_initiative_rules(
      id, chat_id, bot_id, enabled, next_run_at, last_run_at, prompt_mode,
      idle_threshold_minutes, min_gap_minutes, same_context_limit_enabled,
      same_context_max_runs, news_source_id, news_max_age_hours, news_item_count,
      news_use_chat_context, news_prompt
    )
    VALUES(1,1,1,1,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    '2026-05-27T09:59:00Z',
    null,
    'news_hook',
    1,
    1,
    1,
    2,
    1,
    24,
    5,
    0,
    'Make it sharp.'
  );

  const calls = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(),
    db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    rng: () => 0,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async text() { return rssXml; },
    }),
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn(payload) {
        calls.push(payload);
        return { message: { id: 99, chat_id: payload.chatId, ai_generated: 1, ai_bot_id: payload.botId }, text: 'preview' };
      },
    },
  });

  await feature.runSchedulerTick();

  assert.equal(calls.length, 1);
  assert.match(calls[0].instruction, /News items provided: 2/);
  assert.match(calls[0].instruction, /News item 1 title: First & fresh/);
  assert.match(calls[0].instruction, /News item 2 title: Second item/);
  assert.match(calls[0].instruction, /Admin news instruction:\nMake it sharp\./);
  assert.equal(calls[0].includeChatContext, false);
  assert.equal(calls[0].recentContextMaxChars, 0);
  assert.doesNotMatch(calls[0].instruction, /Holiday|Nager/);
  assert.equal(db.prepare('SELECT COUNT(*) as count FROM ai_news_history').get().count, 2);
  assert.deepEqual(db.prepare(`
    SELECT same_context_run_count, last_message_id, last_attempt_status, last_attempt_tries
    FROM ai_bot_initiative_rules WHERE id=1
  `).get(), {
    same_context_run_count: 0,
    last_message_id: null,
    last_attempt_status: 'sent',
    last_attempt_tries: 1,
  });
});

test('news initiative fits all ten selected items into the provider instruction and records all ten', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare('INSERT INTO ai_news_sources(id, name, type, url, enabled, cache_ttl_minutes) VALUES(1,?,?,?,?,30)').run(
    'Large Test RSS', 'rss', 'https://example.com/rss', 1
  );
  const insertItem = db.prepare(`
    INSERT INTO ai_news_items(source_id, guid, title, summary, url, published_at, fetched_at, raw_json)
    VALUES(1,?,?,?,?,?,?,'{}')
  `);
  for (let index = 1; index <= 10; index += 1) {
    insertItem.run(
      `news-${index}`,
      `Story ${index} ${'title '.repeat(100)}`,
      `Summary ${index} ${'detail '.repeat(300)}`,
      `https://example.com/news-${index}/${'path/'.repeat(100)}`,
      `2026-05-27T09:${String(50 - index).padStart(2, '0')}:00Z`,
      '2026-05-27T09:59:00Z'
    );
  }
  db.prepare(`
    INSERT INTO ai_bot_initiative_rules(
      id, chat_id, bot_id, enabled, next_run_at, prompt_mode,
      idle_threshold_minutes, min_gap_minutes, news_source_id, news_max_age_hours,
      news_item_count, news_prompt
    ) VALUES(1,1,1,1,?,'news_hook',0,1,1,24,10,?)
  `).run('2026-05-27T10:00:00Z', `ADMIN-START ${'instruction '.repeat(1000)}`);

  const calls = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(), db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    rng: () => 0,
    fetchImpl: async () => { throw new Error('fresh cache should be used'); },
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn(payload) {
        calls.push(payload);
        return { message: { id: 300, chat_id: payload.chatId, ai_generated: 1, ai_bot_id: payload.botId } };
      },
    },
  });

  await feature.runSchedulerTick();

  assert.equal(calls.length, 1);
  const instruction = calls[0].instruction;
  assert.match(instruction, /News items provided: 10/);
  assert.match(instruction, /Cover every one of the 10 numbered news items/);
  assert.match(instruction, /Admin news instruction:\nADMIN-START/);
  assert.equal(calls[0].includeChatContext, true);
  assert.equal(calls[0].recentContextMaxChars, 3_000);
  for (let index = 1; index <= 10; index += 1) {
    assert.match(instruction, new RegExp(`News item ${index} title: Story ${index} `));
  }
  assert.ok(instruction.length > 6_000);
  assert.ok(jsonContentByteLength(instruction) <= SYNTHETIC_INSTRUCTION_MAX_BYTES);
  assert.equal(fitSyntheticInstruction(instruction), instruction);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ai_news_history WHERE rule_id=1').get().count, 10);
});

test('news initiatives keep running without human activity and never reuse RSS GUIDs', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare('INSERT INTO ai_news_sources(id, name, type, url, enabled, cache_ttl_minutes) VALUES(1,?,?,?,?,1)').run(
    'Test RSS', 'rss', 'https://example.com/rss', 1
  );
  db.prepare(`
    INSERT INTO ai_bot_initiative_rules(
      id, chat_id, bot_id, enabled, fixed_time, next_run_at, prompt_mode,
      idle_threshold_minutes, min_gap_minutes, same_context_limit_enabled,
      same_context_max_runs, same_context_run_count, last_message_id,
      news_source_id, news_max_age_hours, news_item_count
    ) VALUES(1,1,1,1,'09:00',?,'news_hook',1,1,1,1,20,1,1,24,5)
  `).run('2026-05-27T10:00:00Z');

  let now = DateTime.fromISO('2026-05-27T10:00:00Z');
  let feed = rssXml;
  const instructions = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(), db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => now,
    rng: () => 0,
    fetchImpl: async () => ({ ok: true, status: 200, async text() { return feed; } }),
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn(payload) {
        instructions.push(payload.instruction);
        return { message: { id: 200 + instructions.length, chat_id: payload.chatId } };
      },
    },
  });

  await feature.runSchedulerTick();
  assert.equal(instructions.length, 1);
  assert.match(instructions[0], /News items provided: 2/);

  now = DateTime.fromISO('2026-05-28T09:00:00Z');
  feed = rssXml.replace('</channel>', `
    <item><guid>news-3</guid><title>Third item</title><description>Fresh third summary</description>
      <link>https://example.com/news-3</link><pubDate>Thu, 28 May 2026 08:55:00 GMT</pubDate></item>
  </channel>`);
  await feature.runSchedulerTick();
  assert.equal(instructions.length, 2);
  assert.match(instructions[1], /News items provided: 1/);
  assert.match(instructions[1], /Third item/);
  assert.doesNotMatch(instructions[1], /First & fresh|Second item/);

  now = DateTime.fromISO('2026-05-28T09:01:00Z');
  db.prepare('UPDATE ai_bot_initiative_rules SET next_run_at=? WHERE id=1').run('2026-05-28T09:01:00Z');
  await feature.runSchedulerTick();
  assert.equal(instructions.length, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ai_news_history').get().count, 3);
  assert.deepEqual(db.prepare(`
    SELECT last_attempt_status, last_attempt_reason FROM ai_bot_initiative_rules WHERE id=1
  `).get(), { last_attempt_status: 'skipped', last_attempt_reason: 'no_new_news' });
});

test('initiative news hook skips disabled news sources without hallucinating', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare('INSERT INTO ai_news_sources(id, name, type, url, enabled, cache_ttl_minutes) VALUES(1,?,?,?,?,30)').run(
    'Disabled RSS',
    'rss',
    'https://example.com/rss',
    0
  );
  db.prepare(`
    INSERT INTO ai_bot_initiative_rules(
      id, chat_id, bot_id, enabled, next_run_at, prompt_mode,
      idle_threshold_minutes, min_gap_minutes, news_source_id, news_max_age_hours
    )
    VALUES(1,1,1,1,?,?,?,?,?,?)
  `).run(
    '2026-05-27T09:59:00Z',
    'news_hook',
    1,
    1,
    1,
    24
  );

  const calls = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(),
    db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    fetchImpl: async () => { throw new Error('should not fetch disabled source'); },
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn(payload) {
        calls.push(payload);
        return { message: { id: 100 } };
      },
    },
  });

  await feature.runSchedulerTick();

  assert.equal(calls.length, 0);
  assert.equal(db.prepare('SELECT COUNT(*) as count FROM ai_news_history').get().count, 0);
  assert.deepEqual(db.prepare(`
    SELECT last_attempt_status, last_attempt_reason, last_attempt_stage, last_attempt_tries
    FROM ai_bot_initiative_rules WHERE id=1
  `).get(), {
    last_attempt_status: 'skipped',
    last_attempt_reason: 'news_source_unavailable',
    last_attempt_stage: 'gate',
    last_attempt_tries: 0,
  });
});

test('initiative retries an empty AI response and stores diagnostics without posting a chat notice', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare(`
    INSERT INTO ai_bot_initiative_rules(
      id, chat_id, bot_id, enabled, next_run_at, prompt_mode,
      idle_threshold_minutes, min_gap_minutes
    )
    VALUES(1,1,1,1,?,?,?,?)
  `).run('2026-05-27T09:59:00Z', 'idle_ping', 0, 1);

  let calls = 0;
  const delays = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(),
    db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    rng: () => 0.5,
    sleepImpl: async (delayMs) => { delays.push(delayMs); },
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn() { calls += 1; return null; },
    },
  });

  await feature.runSchedulerTick();

  assert.equal(calls, 3);
  assert.deepEqual(delays, [5000, 30000]);
  assert.equal(db.prepare('SELECT last_run_at FROM ai_bot_initiative_rules WHERE id=1').get().last_run_at, null);
  assert.deepEqual(db.prepare(`
    SELECT last_attempt_status, last_attempt_reason, last_attempt_stage, last_attempt_tries
    FROM ai_bot_initiative_rules WHERE id=1
  `).get(), {
    last_attempt_status: 'failed',
    last_attempt_reason: 'empty_provider_response',
    last_attempt_stage: 'provider',
    last_attempt_tries: 3,
  });
});

test('initiative retries transient provider failures and publishes once after recovery', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare(`
    INSERT INTO ai_bot_initiative_rules(
      id, chat_id, bot_id, enabled, next_run_at, prompt_mode, idle_threshold_minutes, min_gap_minutes
    ) VALUES(1,1,1,1,?,'idle_ping',0,1)
  `).run('2026-05-27T10:00:00Z');

  let calls = 0;
  const delays = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(), db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    rng: () => 0.5,
    sleepImpl: async (delayMs) => { delays.push(delayMs); },
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn(payload) {
        calls += 1;
        if (calls < 3) {
          const error = new Error('rate limited');
          error.status = 429;
          error.stage = 'provider';
          throw error;
        }
        return { message: { id: 301, chat_id: payload.chatId } };
      },
    },
  });

  await feature.runSchedulerTick();

  assert.equal(calls, 3);
  assert.deepEqual(delays, [5000, 30000]);
  assert.deepEqual(db.prepare(`
    SELECT last_attempt_status, last_attempt_reason, last_attempt_tries
    FROM ai_bot_initiative_rules WHERE id=1
  `).get(), { last_attempt_status: 'sent', last_attempt_reason: 'sent', last_attempt_tries: 3 });
});

test('initiative does not retry a non-transient provider failure', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare(`
    INSERT INTO ai_bot_initiative_rules(
      id, chat_id, bot_id, enabled, next_run_at, prompt_mode, idle_threshold_minutes, min_gap_minutes
    ) VALUES(1,1,1,1,?,'idle_ping',0,1)
  `).run('2026-05-27T10:00:00Z');

  let calls = 0;
  const delays = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(), db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    sleepImpl: async (delayMs) => { delays.push(delayMs); },
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn() {
        calls += 1;
        const error = new Error('invalid API key: sk-secret123456');
        error.status = 401;
        error.stage = 'provider';
        throw error;
      },
    },
  });

  await feature.runSchedulerTick();

  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
  assert.deepEqual(db.prepare(`
    SELECT last_attempt_status, last_attempt_reason, last_attempt_tries, last_attempt_detail
    FROM ai_bot_initiative_rules WHERE id=1
  `).get(), {
    last_attempt_status: 'failed',
    last_attempt_reason: 'provider_failed',
    last_attempt_tries: 1,
    last_attempt_detail: 'invalid API key: [redacted]',
  });
});

test('initiative scheduler runs independent due rules without waiting for a slow rule', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare('INSERT INTO users(id, username, display_name, is_ai_bot) VALUES(3,?,?,1)').run('deepseek', 'DeepSeek');
  db.prepare('INSERT INTO chat_members(chat_id, user_id) VALUES(1,3)').run();
  db.prepare('INSERT INTO ai_bots(id, user_id, name, mention, provider, kind, enabled) VALUES(2,3,?,?,?,?,1)').run('DeepSeek', 'deepseek', 'deepseek', 'text');
  for (const [id, botId, prompt] of [[1, 1, 'slow rule'], [2, 2, 'fast rule']]) {
    db.prepare(`
      INSERT INTO ai_bot_initiative_rules(
        id, chat_id, bot_id, enabled, next_run_at, prompt_mode, custom_prompt,
        idle_threshold_minutes, min_gap_minutes
      )
      VALUES(?,?,?,?,?,?,?,?,?)
    `).run(id, 1, botId, 1, '2026-05-27T09:59:00Z', 'custom', prompt, 0, 1);
  }

  let releaseSlowRule;
  const slowRuleFinished = new Promise((resolve) => { releaseSlowRule = resolve; });
  let fastRuleStarted;
  const fastRuleStartedPromise = new Promise((resolve) => { fastRuleStarted = resolve; });
  const calls = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(),
    db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    runRulesInBackground: true,
    maxConcurrentRuleRuns: 2,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn(payload) {
        calls.push(payload);
        if (payload.instruction.includes('slow rule')) {
          await slowRuleFinished;
          return { message: { id: 111, chat_id: payload.chatId, ai_generated: 1, ai_bot_id: payload.botId } };
        }
        fastRuleStarted();
        return { message: { id: 112, chat_id: payload.chatId, ai_generated: 1, ai_bot_id: payload.botId } };
      },
    },
  });

  await feature.runSchedulerTick();
  await fastRuleStartedPromise;
  await feature.runSchedulerTick();
  assert.equal(calls.length, 2);

  releaseSlowRule();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ai_bot_initiative_rules WHERE last_run_at IS NOT NULL').get().count, 2);
});

test('initiative scheduler serializes one provider without marking queued rules as missed', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  for (const [id, prompt] of [[1, 'slow rule'], [2, 'queued rule']]) {
    db.prepare(`
      INSERT INTO ai_bot_initiative_rules(
        id, chat_id, bot_id, enabled, next_run_at, prompt_mode, custom_prompt,
        idle_threshold_minutes, min_gap_minutes
      ) VALUES(?,?,?,?,?,?,?,?,?)
    `).run(id, 1, 1, 1, '2026-05-27T10:00:00Z', 'custom', prompt, 0, 1);
  }

  let now = DateTime.fromISO('2026-05-27T10:00:00Z');
  let releaseSlow;
  const slowFinished = new Promise((resolve) => { releaseSlow = resolve; });
  let slowStarted;
  const slowStartedPromise = new Promise((resolve) => { slowStarted = resolve; });
  const calls = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(), db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    runRulesInBackground: true,
    maxConcurrentRuleRuns: 3,
    nowProvider: () => now,
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn(payload) {
        calls.push(payload.instruction);
        if (payload.instruction.includes('slow rule')) {
          slowStarted();
          await slowFinished;
        }
        return { message: { id: 400 + calls.length, chat_id: payload.chatId } };
      },
    },
  });

  await feature.runSchedulerTick();
  await slowStartedPromise;
  assert.equal(calls.length, 1);
  now = DateTime.fromISO('2026-05-27T10:10:00Z');
  releaseSlow();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(calls.length, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM ai_bot_initiative_rules WHERE last_attempt_status='sent'").get().count, 2);
});

test('initiative idle threshold 0 ignores recent chat activity', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare('UPDATE messages SET created_at=? WHERE id=1').run('2026-05-27 09:59:30');
  db.prepare(`
    INSERT INTO ai_bot_initiative_rules(
      id, chat_id, bot_id, enabled, next_run_at, prompt_mode,
      idle_threshold_minutes, min_gap_minutes
    )
    VALUES(1,1,1,1,?,?,?,?)
  `).run(
    '2026-05-27T10:00:00Z',
    'context_question',
    0,
    1
  );

  const calls = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(),
    db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn(payload) {
        calls.push(payload);
        return { message: { id: 101, chat_id: payload.chatId, ai_generated: 1, ai_bot_id: payload.botId }, text: 'preview' };
      },
    },
  });

  await feature.runSchedulerTick();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].includeChatContext, true);
  assert.equal(calls[0].recentContextMaxChars, 6_000);
});

test('initiative idle threshold 0 can run without previous human messages', async (t) => {
  const db = createInitiativeDb();
  t.after(() => db.close());
  db.prepare('DELETE FROM messages').run();
  db.prepare(`
    INSERT INTO ai_bot_initiative_rules(
      id, chat_id, bot_id, enabled, next_run_at, prompt_mode,
      idle_threshold_minutes, min_gap_minutes
    )
    VALUES(1,1,1,1,?,?,?,?)
  `).run(
    '2026-05-27T10:00:00Z',
    'idle_ping',
    0,
    1
  );

  const calls = [];
  const feature = createAiInitiativeFeature({
    app: fakeApp(),
    db,
    auth: (_req, _res, next) => next?.(),
    adminOnly: (_req, _res, next) => next?.(),
    startScheduler: false,
    nowProvider: () => DateTime.fromISO('2026-05-27T10:00:00Z'),
    aiBotFeature: {
      resolveChatBotRuntime() { return true; },
      async runSyntheticBotTurn(payload) {
        calls.push(payload);
        return { message: { id: 102, chat_id: payload.chatId, ai_generated: 1, ai_bot_id: payload.botId }, text: 'preview' };
      },
    },
  });

  await feature.runSchedulerTick();

  assert.equal(calls.length, 1);
  assert.equal(db.prepare('SELECT last_message_id FROM ai_bot_initiative_rules WHERE id=1').get().last_message_id, null);
});

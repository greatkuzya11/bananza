const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { initAiSchema, __private } = require('../ai/schema');

test('AI schema adds and backfills names on a legacy initiative rules table', (t) => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    CREATE TABLE chats (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE messages (id INTEGER PRIMARY KEY);
    CREATE TABLE ai_bots (
      id INTEGER PRIMARY KEY,
      name TEXT,
      provider TEXT DEFAULT 'openai',
      enabled INTEGER DEFAULT 1
    );
    CREATE TABLE ai_bot_initiative_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      prompt_mode TEXT DEFAULT 'context_question' CHECK(prompt_mode IN ('context_question','news_hook','idle_ping','custom')),
      custom_prompt TEXT DEFAULT '',
      holiday_country TEXT DEFAULT '',
      next_run_at TEXT,
      last_run_at TEXT,
      last_message_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT INTO chats(id, name) VALUES(1, 'Legacy chat');
    INSERT INTO ai_bots(id, name, provider, enabled) VALUES(2, 'Legacy bot', 'openai', 1);
    INSERT INTO ai_bot_initiative_rules(id, chat_id, bot_id, prompt_mode, updated_at)
    VALUES(3, 1, 2, 'news_hook', '2026-01-01 00:00:00');
  `);

  initAiSchema(db);

  const ruleColumns = new Set(db.prepare("PRAGMA table_info(ai_bot_initiative_rules)").all().map((column) => column.name));
  assert.ok(ruleColumns.has('name'));
  for (const column of [
    'last_attempt_at',
    'last_attempt_status',
    'last_attempt_reason',
    'last_attempt_stage',
    'last_attempt_detail',
    'last_attempt_tries',
  ]) assert.ok(ruleColumns.has(column), `Expected migrated initiative column ${column}`);
  assert.deepEqual(db.prepare(`
    SELECT name, prompt_mode, fixed_time, updated_at
    FROM ai_bot_initiative_rules
    WHERE id=3
  `).get(), {
    name: 'Lenta.ru top7 — Legacy chat — Legacy bot',
    prompt_mode: 'news_hook',
    fixed_time: '09:00',
    updated_at: '2026-01-01 00:00:00',
  });
});

test('initiative rule name backfill is idempotent and preserves rule state', (t) => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE chats (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE ai_bots (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE ai_news_sources (
      id INTEGER PRIMARY KEY,
      name TEXT,
      enabled INTEGER DEFAULT 1
    );
    CREATE TABLE ai_bot_initiative_rules (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      chat_id INTEGER NOT NULL,
      bot_id INTEGER NOT NULL,
      enabled INTEGER DEFAULT 0,
      prompt_mode TEXT DEFAULT 'context_question',
      news_source_id INTEGER,
      fixed_time TEXT DEFAULT '09:00',
      updated_at TEXT
    );

    INSERT INTO chats(id, name) VALUES(1, 'General');
    INSERT INTO ai_bots(id, name) VALUES(2, 'Bananza AI');
    INSERT INTO ai_news_sources(id, name, enabled) VALUES(3, 'Meduza', 1);
    INSERT INTO ai_bot_initiative_rules(
      id, name, chat_id, bot_id, enabled, prompt_mode, news_source_id, fixed_time, updated_at
    ) VALUES
      (10, '', 1, 2, 1, 'news_hook', 3, '08:30', '2026-08-01 10:00:00'),
      (11, '', 1, 2, 0, 'idle_ping', 3, '11:45', '2026-08-02 10:00:00'),
      (12, 'Manual name', 1, 2, 1, 'news_hook', 3, '15:00', '2026-08-03 10:00:00'),
      (13, '', 1, 2, 1, 'news_hook', NULL, '16:15', '2026-08-04 10:00:00');
  `);

  assert.equal(__private.backfillInitiativeRuleNames(db), 3);
  assert.deepEqual(db.prepare(`
    SELECT id, name, enabled, fixed_time, updated_at
    FROM ai_bot_initiative_rules
    ORDER BY id
  `).all(), [
    { id: 10, name: 'Meduza — General — Bananza AI', enabled: 1, fixed_time: '08:30', updated_at: '2026-08-01 10:00:00' },
    { id: 11, name: 'General — Bananza AI', enabled: 0, fixed_time: '11:45', updated_at: '2026-08-02 10:00:00' },
    { id: 12, name: 'Manual name', enabled: 1, fixed_time: '15:00', updated_at: '2026-08-03 10:00:00' },
    { id: 13, name: 'Meduza — General — Bananza AI', enabled: 1, fixed_time: '16:15', updated_at: '2026-08-04 10:00:00' },
  ]);
  assert.equal(__private.backfillInitiativeRuleNames(db), 0);
});

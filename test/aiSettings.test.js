const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { getAiSettings, saveAiSettings } = require('../ai/settings');

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE ai_bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
  `);
  return db;
}

test('getAiSettings derives provider interactive flags from enabled providers when fields are absent', (t) => {
  const db = createDb();
  t.after(() => db.close());

  db.prepare(`
    INSERT INTO ai_bot_settings(key, value, updated_at)
    VALUES(?, ?, datetime('now'))
  `).run('global', JSON.stringify({
    enabled: true,
    grok_enabled: false,
    deepseek_enabled: true,
    yandex_enabled: true,
  }));

  const settings = getAiSettings(db);

  assert.equal(settings.openai_interactive_enabled, true);
  assert.equal(settings.grok_interactive_enabled, false);
  assert.equal(settings.deepseek_interactive_enabled, true);
  assert.equal(settings.yandex_interactive_enabled, true);
  assert.equal(settings.deepseek_request_timeout_ms, 600000);
});

test('saveAiSettings persists explicit provider interactive flags', (t) => {
  const db = createDb();
  t.after(() => db.close());

  const saved = saveAiSettings(db, {
    enabled: true,
    openai_interactive_enabled: false,
    grok_enabled: true,
    grok_interactive_enabled: true,
    deepseek_enabled: true,
    deepseek_interactive_enabled: false,
    deepseek_request_timeout_ms: 900000,
    yandex_enabled: true,
    yandex_interactive_enabled: true,
  }, 'test-secret');

  assert.equal(saved.openai_interactive_enabled, false);
  assert.equal(saved.grok_interactive_enabled, true);
  assert.equal(saved.deepseek_interactive_enabled, false);
  assert.equal(saved.deepseek_request_timeout_ms, 900000);
  assert.equal(saved.yandex_interactive_enabled, true);

  const reread = getAiSettings(db);
  assert.equal(reread.openai_interactive_enabled, false);
  assert.equal(reread.grok_interactive_enabled, true);
  assert.equal(reread.deepseek_interactive_enabled, false);
  assert.equal(reread.deepseek_request_timeout_ms, 900000);
  assert.equal(reread.yandex_interactive_enabled, true);
});

test('saveAiSettings clamps DeepSeek request timeout between 30 and 1800 seconds', (t) => {
  const db = createDb();
  t.after(() => db.close());

  const tooLow = saveAiSettings(db, {
    deepseek_request_timeout_ms: 1000,
  }, 'test-secret');
  assert.equal(tooLow.deepseek_request_timeout_ms, 30000);

  const tooHigh = saveAiSettings(db, {
    deepseek_request_timeout_ms: 3600000,
  }, 'test-secret');
  assert.equal(tooHigh.deepseek_request_timeout_ms, 1800000);
});

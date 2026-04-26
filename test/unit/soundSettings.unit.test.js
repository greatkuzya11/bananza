const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const {
  DEFAULT_SOUND_SETTINGS,
  createSoundSettingsFeature,
  normalizeSoundSettings,
} = require('../../soundSettings');

test('normalizeSoundSettings applies defaults and clamps volume', () => {
  assert.deepEqual(normalizeSoundSettings(null), DEFAULT_SOUND_SETTINGS);
  assert.equal(normalizeSoundSettings({ volume: 140 }).volume, 100);
  assert.equal(normalizeSoundSettings({ volume: -5 }).volume, 0);
  assert.equal(normalizeSoundSettings({ play_pins: null }).play_pins, true);
  assert.equal(normalizeSoundSettings({ play_mentions: null }).play_mentions, true);
});

test('createSoundSettingsFeature persists normalized settings', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE user_sound_settings (
      user_id INTEGER PRIMARY KEY,
      sounds_enabled INTEGER DEFAULT 1,
      volume INTEGER DEFAULT 55,
      play_send INTEGER DEFAULT 1,
      play_incoming INTEGER DEFAULT 1,
      play_notifications INTEGER DEFAULT 1,
      play_reactions INTEGER DEFAULT 1,
      play_pins INTEGER DEFAULT 1,
      play_invites INTEGER DEFAULT 1,
      play_voice INTEGER DEFAULT 1,
      play_mentions INTEGER DEFAULT 1,
      updated_at TEXT
    );
  `);

  const app = {
    get() {},
    put() {},
  };
  const feature = createSoundSettingsFeature({ app, db, auth: (_req, _res, next) => next() });
  const saved = feature.saveSettings(7, {
    sounds_enabled: false,
    volume: 999,
    play_reactions: false,
    play_mentions: false,
  });

  assert.equal(saved.sounds_enabled, false);
  assert.equal(saved.volume, 100);
  assert.equal(saved.play_reactions, false);
  assert.equal(saved.play_mentions, false);
  assert.equal(feature.getSettings(7).volume, 100);

  db.close();
});

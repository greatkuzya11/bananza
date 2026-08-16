const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const {
  DEFAULT_VIDEO_NOTE_SETTINGS,
  getPublicVideoNoteSettings,
  getVideoNoteSettings,
  normalizeVideoNoteSettings,
  resolveVideoNoteTranscriptionSettings,
  setVideoNoteSettings,
} = require('../../videoNotes/settings');

function createSettingsDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

test('video note settings normalize defaults and clamp admin input', () => {
  assert.deepEqual(normalizeVideoNoteSettings({}), DEFAULT_VIDEO_NOTE_SETTINGS);

  const normalized = normalizeVideoNoteSettings({
    video_notes_enabled: '0',
    video_note_default_shape_id: 'bad-shape',
    video_note_transcription_mode: 'nonsense',
    video_note_transcription_provider: 'bad-provider',
    video_note_max_duration_ms: 999999,
  });

  assert.equal(normalized.video_notes_enabled, false);
  assert.equal(normalized.video_note_default_shape_id, 'banana-fat');
  assert.equal(normalized.video_note_transcription_mode, 'manual');
  assert.equal(normalized.video_note_transcription_provider, 'voice');
  assert.equal(normalized.video_note_max_duration_ms, 120000);
});

test('video note settings persist and expose only public fields', () => {
  const db = createSettingsDb();
  const saved = setVideoNoteSettings(db, {
    video_notes_enabled: true,
    video_note_default_shape_id: 'circle',
    video_note_transcription_mode: 'auto',
    video_note_transcription_provider: 'openai',
    video_note_max_duration_ms: 45000,
  });

  assert.equal(saved.video_note_default_shape_id, 'circle');
  assert.deepEqual(getVideoNoteSettings(db), saved);
  assert.deepEqual(getPublicVideoNoteSettings(db), saved);
  db.close();
});

test('video note provider resolution inherits voice settings or overrides active provider', () => {
  const voiceSettings = {
    active_provider: 'vosk',
    openai_model: 'gpt-4o-mini-transcribe',
    fallback_to_openai: true,
  };

  assert.deepEqual(
    resolveVideoNoteTranscriptionSettings(voiceSettings, { video_note_transcription_provider: 'voice' }),
    voiceSettings
  );

  assert.deepEqual(
    resolveVideoNoteTranscriptionSettings(voiceSettings, { video_note_transcription_provider: 'grok' }),
    {
      ...voiceSettings,
      active_provider: 'grok',
    }
  );

  assert.equal(
    normalizeVideoNoteSettings({ video_note_transcription_provider: 'whisper' }).video_note_transcription_provider,
    'whisper'
  );
});

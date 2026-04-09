function initVoiceSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS voice_messages (
      message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      sample_rate INTEGER NOT NULL DEFAULT 16000,
      transcription_status TEXT NOT NULL DEFAULT 'idle',
      transcription_text TEXT DEFAULT NULL,
      transcription_provider TEXT DEFAULT NULL,
      transcription_model TEXT DEFAULT NULL,
      transcription_error TEXT DEFAULT NULL,
      transcribed_at TEXT DEFAULT NULL,
      requested_by INTEGER DEFAULT NULL REFERENCES users(id),
      auto_requested INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_voice_messages_status ON voice_messages(transcription_status);
  `);

  try {
    db.prepare('SELECT transcription_model FROM voice_messages LIMIT 1').get();
  } catch {
    db.exec("ALTER TABLE voice_messages ADD COLUMN transcription_model TEXT DEFAULT NULL");
  }

  try {
    db.prepare('SELECT requested_by FROM voice_messages LIMIT 1').get();
  } catch {
    db.exec('ALTER TABLE voice_messages ADD COLUMN requested_by INTEGER DEFAULT NULL REFERENCES users(id)');
  }

  try {
    db.prepare('SELECT auto_requested FROM voice_messages LIMIT 1').get();
  } catch {
    db.exec('ALTER TABLE voice_messages ADD COLUMN auto_requested INTEGER NOT NULL DEFAULT 0');
  }
}

module.exports = { initVoiceSchema };

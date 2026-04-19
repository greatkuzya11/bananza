function initVideoNoteSchema(db) {
  try {
    db.prepare('SELECT note_kind FROM voice_messages LIMIT 1').get();
  } catch {
    db.exec("ALTER TABLE voice_messages ADD COLUMN note_kind TEXT NOT NULL DEFAULT 'voice' CHECK(note_kind IN ('voice','video_note'))");
  }

  try {
    db.prepare('SELECT transcription_file_id FROM voice_messages LIMIT 1').get();
  } catch {
    db.exec('ALTER TABLE voice_messages ADD COLUMN transcription_file_id INTEGER DEFAULT NULL REFERENCES files(id)');
  }

  try {
    db.prepare('SELECT shape_id FROM voice_messages LIMIT 1').get();
  } catch {
    db.exec('ALTER TABLE voice_messages ADD COLUMN shape_id TEXT DEFAULT NULL');
  }

  try {
    db.prepare('SELECT shape_snapshot FROM voice_messages LIMIT 1').get();
  } catch {
    db.exec('ALTER TABLE voice_messages ADD COLUMN shape_snapshot TEXT DEFAULT NULL');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_voice_messages_note_kind
    ON voice_messages(note_kind);

    CREATE INDEX IF NOT EXISTS idx_voice_messages_transcription_file_id
    ON voice_messages(transcription_file_id);
  `);
}

module.exports = { initVideoNoteSchema };

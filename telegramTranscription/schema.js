function initTelegramTranscriptionSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_transcription_state (
      id INTEGER PRIMARY KEY CHECK(id=1),
      next_update_id INTEGER NOT NULL DEFAULT 0,
      last_poll_at TEXT DEFAULT NULL,
      last_update_at TEXT DEFAULT NULL,
      last_error TEXT DEFAULT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO telegram_transcription_state(id, next_update_id)
    VALUES(1, 0);

    CREATE TABLE IF NOT EXISTS telegram_transcription_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      update_id INTEGER NOT NULL UNIQUE,
      telegram_chat_id TEXT NOT NULL,
      telegram_user_id TEXT NOT NULL,
      telegram_message_id INTEGER NOT NULL,
      language_code TEXT DEFAULT NULL,
      file_id TEXT NOT NULL,
      file_unique_id TEXT DEFAULT NULL,
      file_name TEXT DEFAULT NULL,
      mime_type TEXT DEFAULT NULL,
      file_size INTEGER DEFAULT NULL,
      duration_seconds INTEGER DEFAULT NULL,
      profile_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued'
        CHECK(status IN ('queued','processing','delivering','completed','error')),
      status_message_id INTEGER DEFAULT NULL,
      transcript_text TEXT DEFAULT NULL,
      transcription_provider TEXT DEFAULT NULL,
      transcription_model TEXT DEFAULT NULL,
      error TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT DEFAULT NULL,
      UNIQUE(telegram_chat_id, telegram_message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_telegram_transcription_jobs_status
      ON telegram_transcription_jobs(status, id);
    CREATE INDEX IF NOT EXISTS idx_telegram_transcription_jobs_user_status
      ON telegram_transcription_jobs(telegram_user_id, status);

    CREATE TABLE IF NOT EXISTS telegram_image_generation_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      update_id INTEGER NOT NULL UNIQUE,
      telegram_chat_id TEXT NOT NULL,
      telegram_user_id TEXT NOT NULL,
      telegram_message_id INTEGER NOT NULL,
      language_code TEXT DEFAULT NULL,
      prompt_text TEXT DEFAULT NULL,
      image_bot_id INTEGER NOT NULL,
      image_bot_name TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'queued'
        CHECK(status IN ('queued','processing','delivering','completed','error')),
      status_message_id INTEGER DEFAULT NULL,
      image_data BLOB DEFAULT NULL,
      image_mime_type TEXT DEFAULT NULL,
      image_file_name TEXT DEFAULT NULL,
      generation_provider TEXT DEFAULT NULL,
      generation_model TEXT DEFAULT NULL,
      error TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT DEFAULT NULL,
      UNIQUE(telegram_chat_id, telegram_message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_telegram_image_generation_jobs_status
      ON telegram_image_generation_jobs(status, id);
    CREATE INDEX IF NOT EXISTS idx_telegram_image_generation_jobs_user_status
      ON telegram_image_generation_jobs(telegram_user_id, status);
  `);
}

module.exports = { initTelegramTranscriptionSchema };

const LEGACY_SETTINGS_KEY = 'telegram_transcription_settings';

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function columnExists(db, table, column) {
  if (!tableExists(db, table)) return false;
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function countRows(db, table) {
  if (!tableExists(db, table)) return 0;
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count || 0);
}

function createBotsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
      bot_token_encrypted TEXT NOT NULL DEFAULT '',
      bot_token_masked TEXT NOT NULL DEFAULT '',
      telegram_api_bot_id TEXT DEFAULT NULL UNIQUE,
      telegram_bot_name TEXT NOT NULL DEFAULT '',
      telegram_bot_username TEXT NOT NULL DEFAULT '',
      allowed_user_ids_json TEXT NOT NULL DEFAULT '[]',
      transcription_enabled INTEGER NOT NULL DEFAULT 0,
      image_generation_enabled INTEGER NOT NULL DEFAULT 0,
      generate_image_from_transcription INTEGER NOT NULL DEFAULT 0,
      active_provider TEXT NOT NULL DEFAULT 'whisper',
      fallback_to_openai INTEGER NOT NULL DEFAULT 0,
      context_bot_enabled INTEGER NOT NULL DEFAULT 0,
      context_bot_id INTEGER DEFAULT NULL,
      image_bot_id INTEGER DEFAULT NULL,
      transcription_timeout_ms INTEGER NOT NULL DEFAULT 120000,
      max_file_size_bytes INTEGER NOT NULL DEFAULT 20971520,
      vosk_model TEXT NOT NULL DEFAULT 'vosk-model-small-ru-0.22',
      vosk_model_path TEXT NOT NULL DEFAULT '',
      whisper_model TEXT NOT NULL DEFAULT 'base',
      whisper_language TEXT NOT NULL DEFAULT 'ru',
      openai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini-transcribe',
      openai_language TEXT NOT NULL DEFAULT 'ru',
      grok_language TEXT NOT NULL DEFAULT 'ru',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function createStateTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_bot_state (
      telegram_bot_id INTEGER PRIMARY KEY REFERENCES telegram_bots(id) ON DELETE CASCADE,
      next_update_id INTEGER NOT NULL DEFAULT 0,
      last_poll_at TEXT DEFAULT NULL,
      last_update_at TEXT DEFAULT NULL,
      last_error TEXT DEFAULT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function createTranscriptionJobsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_transcription_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_bot_id INTEGER NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
      update_id INTEGER NOT NULL,
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
      UNIQUE(telegram_bot_id, update_id),
      UNIQUE(telegram_bot_id, telegram_chat_id, telegram_message_id)
    );
  `);
}

function createImageJobsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_image_generation_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_bot_id INTEGER NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
      update_id INTEGER NOT NULL,
      telegram_chat_id TEXT NOT NULL,
      telegram_user_id TEXT NOT NULL,
      telegram_message_id INTEGER NOT NULL,
      language_code TEXT DEFAULT NULL,
      prompt_text TEXT DEFAULT NULL,
      image_bot_id INTEGER NOT NULL,
      image_bot_name TEXT DEFAULT NULL,
      image_bot_profile_json TEXT NOT NULL DEFAULT '{}',
      source_transcription_job_id INTEGER UNIQUE REFERENCES telegram_transcription_jobs(id) ON DELETE CASCADE,
      context_warning INTEGER NOT NULL DEFAULT 0,
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
      UNIQUE(telegram_bot_id, update_id),
      UNIQUE(telegram_bot_id, telegram_chat_id, telegram_message_id)
    );
  `);
}

function createIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telegram_transcription_jobs_bot_status
      ON telegram_transcription_jobs(telegram_bot_id, status, id);
    CREATE INDEX IF NOT EXISTS idx_telegram_transcription_jobs_bot_user_status
      ON telegram_transcription_jobs(telegram_bot_id, telegram_user_id, status);
    CREATE INDEX IF NOT EXISTS idx_telegram_image_generation_jobs_bot_status
      ON telegram_image_generation_jobs(telegram_bot_id, status, id);
    CREATE INDEX IF NOT EXISTS idx_telegram_image_generation_jobs_bot_user_status
      ON telegram_image_generation_jobs(telegram_bot_id, telegram_user_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_image_generation_jobs_source_transcription
      ON telegram_image_generation_jobs(source_transcription_job_id)
      WHERE source_transcription_job_id IS NOT NULL;
  `);
}

function parseLegacySettings(row) {
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return {};
  }
}

function legacyName(settings = {}) {
  const telegramName = String(settings.bot_name || '').trim();
  const username = String(settings.bot_username || '').trim().replace(/^@/, '');
  return (telegramName || (username ? `@${username}` : '') || 'Telegram bot 1').slice(0, 120);
}

function insertLegacyBot(db, settings = {}) {
  const result = db.prepare(`
    INSERT INTO telegram_bots(
      name, bot_token_encrypted, bot_token_masked, telegram_api_bot_id,
      telegram_bot_name, telegram_bot_username, allowed_user_ids_json,
      transcription_enabled, image_generation_enabled, generate_image_from_transcription, active_provider,
      fallback_to_openai, context_bot_enabled, context_bot_id, image_bot_id,
      transcription_timeout_ms, max_file_size_bytes, vosk_model, vosk_model_path,
      whisper_model, whisper_language, openai_model, openai_language, grok_language
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    legacyName(settings),
    String(settings.bot_token_encrypted || ''),
    String(settings.bot_token_masked || ''),
    String(settings.bot_id || '').trim() || null,
    String(settings.bot_name || '').trim(),
    String(settings.bot_username || '').trim().replace(/^@/, ''),
    JSON.stringify(Array.isArray(settings.allowed_user_ids) ? settings.allowed_user_ids : []),
    settings.enabled ? 1 : 0,
    settings.image_generation_enabled ? 1 : 0,
    settings.generate_image_from_transcription && settings.enabled && settings.image_generation_enabled ? 1 : 0,
    String(settings.active_provider || 'whisper'),
    settings.fallback_to_openai ? 1 : 0,
    settings.context_bot_enabled ? 1 : 0,
    Number(settings.context_bot_id || 0) || null,
    Number(settings.image_bot_id || 0) || null,
    Number(settings.transcription_timeout_ms || 120000),
    Number(settings.max_file_size_bytes || 20 * 1024 * 1024),
    String(settings.vosk_model || 'vosk-model-small-ru-0.22'),
    String(settings.vosk_model_path || ''),
    String(settings.whisper_model || 'base'),
    String(settings.whisper_language || 'ru'),
    String(settings.openai_model || 'gpt-4o-mini-transcribe'),
    String(settings.openai_language || 'ru'),
    String(settings.grok_language || 'ru')
  );
  return Number(result.lastInsertRowid);
}

function migrateState(db, legacyBotId) {
  if (tableExists(db, 'telegram_transcription_state')) {
    const row = db.prepare('SELECT * FROM telegram_transcription_state WHERE id=1').get();
    if (legacyBotId) {
      db.prepare(`
        INSERT OR REPLACE INTO telegram_bot_state(
          telegram_bot_id, next_update_id, last_poll_at, last_update_at, last_error, updated_at
        ) VALUES(?,?,?,?,?,COALESCE(?,datetime('now')))
      `).run(
        legacyBotId,
        Number(row?.next_update_id || 0),
        row?.last_poll_at || null,
        row?.last_update_at || null,
        row?.last_error || null,
        row?.updated_at || null
      );
    }
    db.exec('DROP TABLE telegram_transcription_state;');
  }
}

function rebuildTranscriptionJobs(db, legacyBotId) {
  if (!tableExists(db, 'telegram_transcription_jobs') || columnExists(db, 'telegram_transcription_jobs', 'telegram_bot_id')) return;
  db.exec('ALTER TABLE telegram_transcription_jobs RENAME TO telegram_transcription_jobs_legacy;');
  createTranscriptionJobsTable(db);
  if (legacyBotId) {
    db.prepare(`
      INSERT INTO telegram_transcription_jobs(
        id, telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
        language_code, file_id, file_unique_id, file_name, mime_type, file_size, duration_seconds,
        profile_json, status, status_message_id, transcript_text, transcription_provider,
        transcription_model, error, created_at, updated_at, completed_at
      )
      SELECT id, ?, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
        language_code, file_id, file_unique_id, file_name, mime_type, file_size, duration_seconds,
        profile_json, status, status_message_id, transcript_text, transcription_provider,
        transcription_model, error, created_at, updated_at, completed_at
      FROM telegram_transcription_jobs_legacy
    `).run(legacyBotId);
  }
  db.exec('DROP TABLE telegram_transcription_jobs_legacy;');
}

function rebuildImageJobs(db, legacyBotId) {
  if (!tableExists(db, 'telegram_image_generation_jobs') || columnExists(db, 'telegram_image_generation_jobs', 'telegram_bot_id')) return;
  db.exec('ALTER TABLE telegram_image_generation_jobs RENAME TO telegram_image_generation_jobs_legacy;');
  createImageJobsTable(db);
  if (legacyBotId) {
    db.prepare(`
      INSERT INTO telegram_image_generation_jobs(
        id, telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
        language_code, prompt_text, image_bot_id, image_bot_name, status, status_message_id,
        image_data, image_mime_type, image_file_name, generation_provider, generation_model,
        error, created_at, updated_at, completed_at
      )
      SELECT id, ?, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
        language_code, prompt_text, image_bot_id, image_bot_name, status, status_message_id,
        image_data, image_mime_type, image_file_name, generation_provider, generation_model,
        error, created_at, updated_at, completed_at
      FROM telegram_image_generation_jobs_legacy
    `).run(legacyBotId);
  }
  db.exec('DROP TABLE telegram_image_generation_jobs_legacy;');
}

function initTelegramTranscriptionSchema(db) {
  const migrate = db.transaction(() => {
    const legacyRow = tableExists(db, 'app_settings')
      ? db.prepare('SELECT value FROM app_settings WHERE key=?').get(LEGACY_SETTINGS_KEY)
      : null;
    const legacySettings = parseLegacySettings(legacyRow);
    const legacyJobs = countRows(db, 'telegram_transcription_jobs') + countRows(db, 'telegram_image_generation_jobs');

    createBotsTable(db);
    createStateTable(db);

    let legacyBotId = null;
    const existingBot = db.prepare('SELECT id FROM telegram_bots ORDER BY id ASC LIMIT 1').get();
    if (existingBot) legacyBotId = Number(existingBot.id);
    else if (legacyRow || legacyJobs > 0) legacyBotId = insertLegacyBot(db, legacySettings || {});

    migrateState(db, legacyBotId);
    rebuildTranscriptionJobs(db, legacyBotId);
    // Image jobs may now reference transcription jobs, including during a legacy image-only migration.
    createTranscriptionJobsTable(db);
    rebuildImageJobs(db, legacyBotId);
    createTranscriptionJobsTable(db);
    createImageJobsTable(db);
    if (!columnExists(db, 'telegram_image_generation_jobs', 'image_bot_profile_json')) {
      db.exec("ALTER TABLE telegram_image_generation_jobs ADD COLUMN image_bot_profile_json TEXT NOT NULL DEFAULT '{}';");
    }
    if (!columnExists(db, 'telegram_bots', 'generate_image_from_transcription')) {
      db.exec('ALTER TABLE telegram_bots ADD COLUMN generate_image_from_transcription INTEGER NOT NULL DEFAULT 0;');
    }
    if (!columnExists(db, 'telegram_image_generation_jobs', 'source_transcription_job_id')) {
      db.exec('ALTER TABLE telegram_image_generation_jobs ADD COLUMN source_transcription_job_id INTEGER DEFAULT NULL REFERENCES telegram_transcription_jobs(id) ON DELETE CASCADE;');
    }
    if (!columnExists(db, 'telegram_image_generation_jobs', 'context_warning')) {
      db.exec('ALTER TABLE telegram_image_generation_jobs ADD COLUMN context_warning INTEGER NOT NULL DEFAULT 0;');
    }
    createIndexes(db);

    if (legacyBotId) {
      db.prepare('INSERT OR IGNORE INTO telegram_bot_state(telegram_bot_id) VALUES(?)').run(legacyBotId);
    }
    if (legacyRow) db.prepare('DELETE FROM app_settings WHERE key=?').run(LEGACY_SETTINGS_KEY);
  });
  migrate();
}

module.exports = { initTelegramTranscriptionSchema };

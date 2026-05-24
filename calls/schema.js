const CALL_SESSION_STATUSES = "'active','ended','missed','declined','failed'";

function tableSql(db, tableName) {
  return db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(tableName)?.sql || '';
}

function hasColumn(db, tableName, columnName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all()
    .some((column) => column.name === columnName);
}

function addColumnIfMissing(db, tableName, columnName, columnSql) {
  if (!hasColumn(db, tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
  }
}

function createCallSessionsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS call_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      livekit_room_name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN (${CALL_SESSION_STATUSES})),
      started_by INTEGER NOT NULL REFERENCES users(id),
      ended_by INTEGER DEFAULT NULL REFERENCES users(id),
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT DEFAULT NULL,
      ended_reason TEXT DEFAULT NULL,
      duration_ms INTEGER DEFAULT NULL,
      message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
      ring_expires_at TEXT DEFAULT NULL,
      media_kind TEXT NOT NULL DEFAULT 'video' CHECK(media_kind IN ('video','voice')),
      room_mode TEXT NOT NULL DEFAULT 'ringing' CHECK(room_mode IN ('ringing','room')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function migrateCallSessionsStatus(db) {
  const sql = tableSql(db, 'call_sessions');
  if (!sql || sql.includes("'missed'")) return;

  const foreignKeys = Number(db.pragma('foreign_keys', { simple: true }) || 0);
  const legacyAlter = Number(db.pragma('legacy_alter_table', { simple: true }) || 0);
  db.pragma('foreign_keys = OFF');
  db.pragma('legacy_alter_table = ON');
  try {
    db.exec(`
      DROP TABLE IF EXISTS call_sessions_legacy_status;
      ALTER TABLE call_sessions RENAME TO call_sessions_legacy_status;
    `);
    createCallSessionsTable(db);
    db.exec(`
      INSERT INTO call_sessions (
        id,
        chat_id,
        livekit_room_name,
        status,
        started_by,
        ended_by,
        started_at,
        ended_at,
        ring_expires_at,
        media_kind,
        room_mode,
        created_at,
        updated_at
      )
      SELECT
        id,
        chat_id,
        livekit_room_name,
        CASE
          WHEN status IN (${CALL_SESSION_STATUSES}) THEN status
          ELSE 'ended'
        END,
        started_by,
        ended_by,
        started_at,
        ended_at,
        ring_expires_at,
        'video',
        'ringing',
        created_at,
        updated_at
      FROM call_sessions_legacy_status;
      DROP TABLE call_sessions_legacy_status;
    `);
  } finally {
    db.pragma(`legacy_alter_table = ${legacyAlter ? 'ON' : 'OFF'}`);
    db.pragma(`foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`);
  }
}

function initCallSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  createCallSessionsTable(db);
  migrateCallSessionsStatus(db);
  addColumnIfMissing(db, 'call_sessions', 'ended_reason', 'ended_reason TEXT DEFAULT NULL');
  addColumnIfMissing(db, 'call_sessions', 'duration_ms', 'duration_ms INTEGER DEFAULT NULL');
  addColumnIfMissing(db, 'call_sessions', 'message_id', 'message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL');
  addColumnIfMissing(db, 'call_sessions', 'media_kind', "media_kind TEXT NOT NULL DEFAULT 'video' CHECK(media_kind IN ('video','voice'))");
  addColumnIfMissing(db, 'call_sessions', 'room_mode', "room_mode TEXT NOT NULL DEFAULT 'ringing' CHECK(room_mode IN ('ringing','room'))");

  db.exec(`

    CREATE TABLE IF NOT EXISTS call_participants (
      call_id INTEGER NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT 'invited' CHECK(state IN ('invited','joined','declined','left','missed')),
      joined_at TEXT DEFAULT NULL,
      left_at TEXT DEFAULT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (call_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS call_messages (
      message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
      call_id INTEGER NOT NULL UNIQUE REFERENCES call_sessions(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended','missed','declined','failed')),
      started_by INTEGER DEFAULT NULL REFERENCES users(id),
      ended_by INTEGER DEFAULT NULL REFERENCES users(id),
      started_at TEXT DEFAULT NULL,
      ended_at TEXT DEFAULT NULL,
      ended_reason TEXT DEFAULT NULL,
      duration_ms INTEGER DEFAULT NULL,
      media_kind TEXT NOT NULL DEFAULT 'video' CHECK(media_kind IN ('video','voice')),
      room_mode TEXT NOT NULL DEFAULT 'ringing' CHECK(room_mode IN ('ringing','room')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_ai_notes (
      call_id INTEGER PRIMARY KEY REFERENCES call_sessions(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','recording','processing','completed','error','canceled')),
      requested_by INTEGER DEFAULT NULL REFERENCES users(id),
      started_at TEXT DEFAULT NULL,
      ended_at TEXT DEFAULT NULL,
      transcript_status TEXT NOT NULL DEFAULT 'idle' CHECK(transcript_status IN ('idle','recording','processing','completed','error','canceled')),
      transcript_text TEXT DEFAULT '',
      transcript_error TEXT DEFAULT '',
      timing_approximate INTEGER DEFAULT 1,
      summary_status TEXT NOT NULL DEFAULT 'idle' CHECK(summary_status IN ('idle','processing','completed','error')),
      short_summary TEXT DEFAULT '',
      decisions_json TEXT DEFAULT '[]',
      action_items_json TEXT DEFAULT '[]',
      open_questions_json TEXT DEFAULT '[]',
      suggested_polls_json TEXT DEFAULT '[]',
      summary_model TEXT DEFAULT '',
      summary_error TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id INTEGER NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope TEXT NOT NULL DEFAULT 'participant' CHECK(scope IN ('participant','mixed')),
      livekit_identity TEXT NOT NULL DEFAULT '',
      track_id TEXT NOT NULL DEFAULT '',
      egress_id TEXT NOT NULL DEFAULT '',
      file_path TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'recording' CHECK(status IN ('recording','processing','completed','error','canceled')),
      started_at TEXT DEFAULT NULL,
      ended_at TEXT DEFAULT NULL,
      duration_ms INTEGER DEFAULT NULL,
      size_bytes INTEGER DEFAULT NULL,
      transcription_text TEXT DEFAULT '',
      transcription_provider TEXT DEFAULT '',
      transcription_model TEXT DEFAULT '',
      transcription_error TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_transcript_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id INTEGER NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
      recording_id INTEGER DEFAULT NULL REFERENCES call_recordings(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      speaker_name TEXT NOT NULL DEFAULT '',
      start_ms INTEGER NOT NULL DEFAULT 0,
      end_ms INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL DEFAULT '',
      timing_approximate INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_transcript_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id INTEGER NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
      message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
      requested_by INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
      provider TEXT NOT NULL DEFAULT 'voice',
      resolved_provider TEXT NOT NULL DEFAULT '',
      strategy TEXT NOT NULL DEFAULT 'per_user' CHECK(strategy IN ('per_user','mixed','hybrid','openai_diarization')),
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','error','canceled')),
      error TEXT DEFAULT '',
      transcript_text TEXT DEFAULT '',
      timing_approximate INTEGER DEFAULT 1,
      model TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT DEFAULT NULL,
      completed_at TEXT DEFAULT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_transcript_run_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES call_transcript_runs(id) ON DELETE CASCADE,
      call_id INTEGER NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
      recording_id INTEGER DEFAULT NULL REFERENCES call_recordings(id) ON DELETE SET NULL,
      user_id INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
      speaker_name TEXT NOT NULL DEFAULT '',
      speaker_label TEXT NOT NULL DEFAULT '',
      start_ms INTEGER NOT NULL DEFAULT 0,
      end_ms INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL DEFAULT '',
      timing_approximate INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_artifact_settings (
      artifact_key TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      bot_id INTEGER DEFAULT NULL,
      output_type TEXT NOT NULL DEFAULT 'text' CHECK(output_type IN ('text','json','image')),
      include_transcript INTEGER NOT NULL DEFAULT 1,
      include_call_meta INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_artifact_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id INTEGER NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
      transcript_run_id INTEGER NOT NULL REFERENCES call_transcript_runs(id) ON DELETE CASCADE,
      message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
      requested_by INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','partial','error','canceled')),
      error TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS call_artifact_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES call_artifact_batches(id) ON DELETE CASCADE,
      call_id INTEGER NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
      transcript_run_id INTEGER NOT NULL REFERENCES call_transcript_runs(id) ON DELETE CASCADE,
      artifact_key TEXT NOT NULL,
      bot_id INTEGER DEFAULT NULL,
      output_type TEXT NOT NULL DEFAULT 'text' CHECK(output_type IN ('text','json','image')),
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','error','canceled','skipped')),
      result_text TEXT DEFAULT '',
      result_json TEXT DEFAULT '',
      file_id INTEGER DEFAULT NULL,
      provider TEXT DEFAULT '',
      model TEXT DEFAULT '',
      error TEXT DEFAULT '',
      started_at TEXT DEFAULT NULL,
      completed_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_call_sessions_active_chat
      ON call_sessions(chat_id)
      WHERE status='active';
    CREATE INDEX IF NOT EXISTS idx_call_sessions_chat_status
      ON call_sessions(chat_id, status);
    CREATE INDEX IF NOT EXISTS idx_call_sessions_message
      ON call_sessions(message_id);
    CREATE INDEX IF NOT EXISTS idx_call_participants_user
      ON call_participants(user_id, state);
    CREATE INDEX IF NOT EXISTS idx_call_messages_call
      ON call_messages(call_id);
    CREATE INDEX IF NOT EXISTS idx_call_recordings_call
      ON call_recordings(call_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_call_recordings_active_track
      ON call_recordings(call_id, track_id)
      WHERE status IN ('recording','processing');
    CREATE INDEX IF NOT EXISTS idx_call_recordings_egress
      ON call_recordings(egress_id);
    CREATE INDEX IF NOT EXISTS idx_call_transcript_segments_call
      ON call_transcript_segments(call_id, start_ms, user_id);
    CREATE INDEX IF NOT EXISTS idx_call_transcript_runs_call
      ON call_transcript_runs(call_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_call_transcript_runs_message
      ON call_transcript_runs(message_id);
    CREATE INDEX IF NOT EXISTS idx_call_transcript_run_segments_run
      ON call_transcript_run_segments(run_id, start_ms, id);
    CREATE INDEX IF NOT EXISTS idx_call_artifact_batches_call
      ON call_artifact_batches(call_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_call_artifact_batches_message
      ON call_artifact_batches(message_id);
    CREATE INDEX IF NOT EXISTS idx_call_artifact_runs_batch
      ON call_artifact_runs(batch_id, artifact_key);
  `);

  addColumnIfMissing(db, 'call_messages', 'media_kind', "media_kind TEXT NOT NULL DEFAULT 'video' CHECK(media_kind IN ('video','voice'))");
  addColumnIfMissing(db, 'call_messages', 'room_mode', "room_mode TEXT NOT NULL DEFAULT 'ringing' CHECK(room_mode IN ('ringing','room'))");

  addColumnIfMissing(db, 'call_recordings', 'scope', "scope TEXT NOT NULL DEFAULT 'participant'");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_call_recordings_call_scope
      ON call_recordings(call_id, scope, status);
  `);
}

module.exports = { initCallSchema };

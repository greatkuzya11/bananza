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
  `);
}

module.exports = { initCallSchema };

function initCallSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      livekit_room_name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')),
      started_by INTEGER NOT NULL REFERENCES users(id),
      ended_by INTEGER DEFAULT NULL REFERENCES users(id),
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT DEFAULT NULL,
      ring_expires_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_participants (
      call_id INTEGER NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT 'invited' CHECK(state IN ('invited','joined','declined','left','missed')),
      joined_at TEXT DEFAULT NULL,
      left_at TEXT DEFAULT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (call_id, user_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_call_sessions_active_chat
      ON call_sessions(chat_id)
      WHERE status='active';
    CREATE INDEX IF NOT EXISTS idx_call_sessions_chat_status
      ON call_sessions(chat_id, status);
    CREATE INDEX IF NOT EXISTS idx_call_participants_user
      ON call_participants(user_id, state);
  `);
}

module.exports = { initCallSchema };

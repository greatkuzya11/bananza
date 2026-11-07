'use strict';

function initIosPushSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ios_push_devices (
      device_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bundle_id TEXT NOT NULL,
      environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),
      push_token TEXT,
      voip_token TEXT,
      language TEXT NOT NULL DEFAULT 'ru',
      session_expires_at INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_error TEXT,
      UNIQUE(environment, bundle_id, push_token),
      UNIQUE(environment, bundle_id, voip_token)
    );
    CREATE INDEX IF NOT EXISTS idx_ios_push_devices_user ON ios_push_devices(user_id);
  `);
}

module.exports = { initIosPushSchema };

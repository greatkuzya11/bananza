const Database = require('better-sqlite3');
const path = require('path');
const { initVoiceSchema } = require('./voice/schema');

const db = new Database(path.join(__dirname, 'bananza.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    avatar_color TEXT NOT NULL,
    avatar_url TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('general','group','private')),
    created_by INTEGER REFERENCES users(id),
    avatar_url TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (chat_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT,
    file_id INTEGER REFERENCES files(id),
    is_deleted INTEGER DEFAULT 0,
    edited_at TEXT DEFAULT NULL,
    edited_by INTEGER DEFAULT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('image','audio','video','document')),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS link_previews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    image TEXT,
    hostname TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, id);
  CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_link_previews_msg ON link_previews(message_id);
`);

// Seed general chat
const generalChat = db.prepare("SELECT id FROM chats WHERE type = 'general'").get();
if (!generalChat) {
  db.prepare("INSERT INTO chats (name, type) VALUES ('General', 'general')").run();
}

// Migrations: add avatar_url columns if missing
try {
  db.prepare("SELECT avatar_url FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT avatar_url FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN avatar_url TEXT DEFAULT NULL");
}
// Migration: chat background columns
try {
  db.prepare("SELECT background_url FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN background_url TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT background_style FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN background_style TEXT DEFAULT 'cover'");
}
// Migration: reply_to_id on messages
try {
  db.prepare("SELECT reply_to_id FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER DEFAULT NULL REFERENCES messages(id)");
}
// Migration: edited marker on messages
try {
  db.prepare("SELECT edited_at FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN edited_at TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT edited_by FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN edited_by INTEGER DEFAULT NULL REFERENCES users(id)");
}
// Migration: last_read_id on chat_members
try {
  db.prepare("SELECT last_read_id FROM chat_members LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chat_members ADD COLUMN last_read_id INTEGER DEFAULT 0");
}
// Migration: reactions table
try {
  db.prepare("SELECT 1 FROM reactions LIMIT 1").get();
  // Migrate PK if old schema (message_id, user_id) — drop and recreate
  const cols = db.prepare("PRAGMA table_info(reactions)").all().map(c => c.name);
  if (!cols.includes('emoji') || db.prepare("SELECT sql FROM sqlite_master WHERE name='reactions'").get().sql.includes('PRIMARY KEY (message_id, user_id)')) {
    db.exec(`DROP TABLE IF EXISTS reactions;
      CREATE TABLE reactions (
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (message_id, user_id, emoji)
      );
      CREATE INDEX IF NOT EXISTS idx_reactions_msg ON reactions(message_id);`);
  }
} catch {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reactions (
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (message_id, user_id, emoji)
    );
    CREATE INDEX IF NOT EXISTS idx_reactions_msg ON reactions(message_id);
  `);
}

initVoiceSchema(db);

module.exports = db;

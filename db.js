const Database = require('better-sqlite3');
const path = require('path');
const { initVoiceSchema } = require('./voice/schema');
const { initAiSchema } = require('./ai/schema');
const { initVideoNoteSchema } = require('./videoNotes/schema');
const { initCallSchema } = require('./calls/schema');

const db = new Database(path.join(__dirname, 'bananza.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function documentAssetsTableSql({ ifNotExists = true } = {}) {
  return `
  CREATE TABLE ${ifNotExists ? 'IF NOT EXISTS ' : ''}document_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    kind TEXT NOT NULL DEFAULT 'image' CHECK(kind IN ('image')),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chat_id, file_id)
  );`;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    is_ai_bot INTEGER DEFAULT 0,
    avatar_color TEXT NOT NULL,
    avatar_url TEXT DEFAULT NULL,
    profile_status_key TEXT DEFAULT '',
    profile_status_text TEXT DEFAULT '',
    ui_theme TEXT DEFAULT 'bananza',
    ui_poll_style TEXT DEFAULT 'pulse',
    ui_visual_mode TEXT DEFAULT 'classic',
    ui_modal_animation TEXT DEFAULT 'soft',
    ui_modal_animation_speed INTEGER DEFAULT 8,
    ui_mobile_font_size INTEGER DEFAULT 5,
    ui_language TEXT DEFAULT 'ru',
    ui_show_chat_folder_strip_in_all_chats INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('general','group','private')),
    created_by INTEGER REFERENCES users(id),
    avatar_url TEXT DEFAULT NULL,
    is_notes INTEGER DEFAULT 0,
    is_document INTEGER DEFAULT 0,
    allow_unpin_any_pin INTEGER DEFAULT 0,
    context_transform_enabled INTEGER DEFAULT 0,
    chatshot_enabled INTEGER DEFAULT 0,
    chatshot_bot_id INTEGER DEFAULT NULL,
    chatshot_style TEXT DEFAULT 'comic',
    chatshot_banana_filter_enabled INTEGER DEFAULT 1,
    invite_token TEXT DEFAULT NULL,
    invite_token_created_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT DEFAULT (datetime('now')),
    notify_enabled INTEGER DEFAULT 1,
    sounds_enabled INTEGER DEFAULT 1,
    last_read_id INTEGER DEFAULT 0,
    chat_list_pin_order INTEGER DEFAULT NULL,
    hidden_at TEXT DEFAULT NULL,
    hidden_after_message_id INTEGER DEFAULT NULL,
    PRIMARY KEY (chat_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS documents (
    chat_id INTEGER PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    ydoc_state BLOB DEFAULT NULL,
    invite_token TEXT DEFAULT NULL,
    invite_token_created_at TEXT DEFAULT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT,
    file_id INTEGER REFERENCES files(id),
    forwarded_from_message_id INTEGER DEFAULT NULL REFERENCES messages(id),
    forwarded_from_user_id INTEGER DEFAULT NULL REFERENCES users(id),
    forwarded_from_display_name TEXT DEFAULT NULL,
    saved_from_message_id INTEGER DEFAULT NULL REFERENCES messages(id),
    saved_from_chat_id INTEGER DEFAULT NULL REFERENCES chats(id),
    saved_from_user_id INTEGER DEFAULT NULL REFERENCES users(id),
    saved_from_display_name TEXT DEFAULT NULL,
    saved_from_created_at TEXT DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,
    edited_at TEXT DEFAULT NULL,
    edited_by INTEGER DEFAULT NULL REFERENCES users(id),
    ai_generated INTEGER DEFAULT 0,
    ai_bot_id INTEGER DEFAULT NULL,
    client_id TEXT DEFAULT NULL,
    ai_image_risk_confirmed INTEGER DEFAULT 0,
    ai_notice_type TEXT DEFAULT NULL,
    ai_response_mode_hint TEXT DEFAULT NULL,
    ai_document_format_hint TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_context_transform_originals (
    message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_transform_at TEXT DEFAULT (datetime('now')),
    transform_count INTEGER DEFAULT 1,
    restored_at TEXT DEFAULT NULL,
    restored_by INTEGER REFERENCES users(id) ON DELETE SET NULL
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

  ${documentAssetsTableSql()}

  CREATE TABLE IF NOT EXISTS link_previews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    image TEXT,
    hostname TEXT
  );

  CREATE TABLE IF NOT EXISTS map_provider_settings (
    id INTEGER PRIMARY KEY CHECK(id=1),
    enabled INTEGER DEFAULT 0,
    provider TEXT DEFAULT 'osm',
    tile_url_template TEXT NOT NULL DEFAULT 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tile_attribution TEXT NOT NULL DEFAULT '\u00A9 OpenStreetMap contributors',
    search_url TEXT NOT NULL DEFAULT 'https://nominatim.openstreetmap.org/search',
    reverse_url TEXT NOT NULL DEFAULT 'https://nominatim.openstreetmap.org/reverse',
    max_zoom INTEGER DEFAULT 19,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_locations (
    message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    zoom INTEGER DEFAULT 16,
    title TEXT DEFAULT NULL,
    address TEXT DEFAULT NULL,
    provider TEXT DEFAULT 'osm',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_weather_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled INTEGER DEFAULT 0,
    location_name TEXT DEFAULT NULL,
    country TEXT DEFAULT NULL,
    admin1 TEXT DEFAULT NULL,
    latitude REAL DEFAULT NULL,
    longitude REAL DEFAULT NULL,
    timezone TEXT DEFAULT NULL,
    refresh_minutes INTEGER DEFAULT 30,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_notification_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    push_enabled INTEGER DEFAULT 0,
    notify_messages INTEGER DEFAULT 1,
    notify_chat_invites INTEGER DEFAULT 1,
    notify_calls INTEGER DEFAULT 1,
    notify_reactions INTEGER DEFAULT 1,
    notify_pins INTEGER DEFAULT 1,
    notify_mentions INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_sound_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    sounds_enabled INTEGER DEFAULT 1,
    volume INTEGER DEFAULT 55,
    play_send INTEGER DEFAULT 1,
    play_incoming INTEGER DEFAULT 1,
    play_notifications INTEGER DEFAULT 1,
    play_reactions INTEGER DEFAULT 1,
    play_pins INTEGER DEFAULT 1,
    play_invites INTEGER DEFAULT 1,
    play_voice INTEGER DEFAULT 1,
    play_mentions INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_recent_emojis (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    last_used_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (user_id, emoji)
  );

  CREATE TABLE IF NOT EXISTS message_mentions (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (message_id, mentioned_user_id)
  );

  CREATE TABLE IF NOT EXISTS message_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chat_id, message_id)
  );

  CREATE TABLE IF NOT EXISTS message_pin_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK(action IN ('pinned','unpinned')),
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_name TEXT DEFAULT NULL,
    message_author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    message_author_name TEXT DEFAULT NULL,
    message_preview TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK(event_type IN (
      'chat_created',
      'member_added',
      'member_left',
      'member_removed',
      'chat_renamed',
      'chat_avatar_updated',
      'chat_avatar_removed',
      'chat_background_updated',
      'chat_background_removed',
      'chat_background_style_updated',
      'chat_history_cleared'
    )),
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_name TEXT DEFAULT NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_user_name TEXT DEFAULT NULL,
    target_is_ai_bot INTEGER DEFAULT 0,
    metadata_json TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_error TEXT DEFAULT NULL,
    disabled_at TEXT DEFAULT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, id);
  CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_invite_token ON documents(invite_token) WHERE invite_token IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
  CREATE INDEX IF NOT EXISTS idx_link_previews_msg ON link_previews(message_id);
  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(mentioned_user_id, chat_id);
  CREATE INDEX IF NOT EXISTS idx_message_mentions_chat ON message_mentions(chat_id, message_id);
  CREATE INDEX IF NOT EXISTS idx_message_pins_chat ON message_pins(chat_id, id);
  CREATE INDEX IF NOT EXISTS idx_message_pins_message ON message_pins(message_id);
  CREATE INDEX IF NOT EXISTS idx_message_pin_events_chat ON message_pin_events(chat_id, id);
  CREATE INDEX IF NOT EXISTS idx_message_pin_events_message ON message_pin_events(message_id, id);
  CREATE INDEX IF NOT EXISTS idx_chat_system_events_chat_created ON chat_system_events(chat_id, created_at, id);
  CREATE INDEX IF NOT EXISTS idx_chat_system_events_target ON chat_system_events(target_user_id, chat_id);
  CREATE INDEX IF NOT EXISTS idx_message_context_transform_originals_active ON message_context_transform_originals(message_id, restored_at);
  CREATE INDEX IF NOT EXISTS idx_user_recent_emojis_user_time ON user_recent_emojis(user_id, last_used_at DESC);
`);

function selectExistingColumn(columns, column, fallbackSql = 'NULL') {
  return columns.has(column) ? column : `${fallbackSql} AS ${column}`;
}

function ensureDocumentAssetsSchema() {
  const rows = db.prepare("PRAGMA table_info(document_assets)").all();
  const columns = new Set(rows.map((row) => row.name));
  const requiredColumns = ['id', 'chat_id', 'file_id', 'created_by', 'kind', 'created_at'];
  const hasCurrentShape = requiredColumns.every((column) => columns.has(column));

  if (!hasCurrentShape) {
    const legacyRows = columns.has('chat_id')
      ? db.prepare(`
          SELECT
            ${selectExistingColumn(columns, 'id')},
            ${selectExistingColumn(columns, 'chat_id')},
            ${selectExistingColumn(columns, 'file_id')},
            ${selectExistingColumn(columns, 'stored_name')},
            ${selectExistingColumn(columns, 'original_name')},
            ${selectExistingColumn(columns, 'mime_type')},
            ${selectExistingColumn(columns, 'size', '0')},
            ${selectExistingColumn(columns, 'created_by')},
            ${selectExistingColumn(columns, 'uploaded_by')},
            ${selectExistingColumn(columns, 'created_at')}
          FROM document_assets
        `).all()
      : [];

    db.transaction(() => {
      db.exec(`
        DROP INDEX IF EXISTS idx_document_assets_chat;
        DROP INDEX IF EXISTS idx_document_assets_file;
        ALTER TABLE document_assets RENAME TO document_assets_legacy_migration;
        ${documentAssetsTableSql({ ifNotExists: false })}
      `);

      const userExistsStmt = db.prepare("SELECT id FROM users WHERE id=?");
      const fallbackUserStmt = db.prepare(`
        SELECT COALESCE(
          (SELECT created_by FROM chats WHERE id=? AND created_by IS NOT NULL),
          (SELECT user_id FROM chat_members WHERE chat_id=? ORDER BY joined_at, user_id LIMIT 1),
          (SELECT id FROM users ORDER BY is_admin DESC, id LIMIT 1)
        ) AS id
      `);
      const existingFileStmt = db.prepare("SELECT id FROM files WHERE stored_name=? ORDER BY id LIMIT 1");
      const fileExistsStmt = db.prepare("SELECT id FROM files WHERE id=?");
      const insertFileStmt = db.prepare(`
        INSERT INTO files(original_name, stored_name, mime_type, size, type, uploaded_by, created_at)
        VALUES(?,?,?,?, 'image', ?, COALESCE(?, datetime('now')))
      `);
      const insertAssetWithIdStmt = db.prepare(`
        INSERT OR IGNORE INTO document_assets(id, chat_id, file_id, created_by, kind, created_at)
        VALUES(?,?,?,?, 'image', COALESCE(?, datetime('now')))
      `);
      const insertAssetStmt = db.prepare(`
        INSERT OR IGNORE INTO document_assets(chat_id, file_id, created_by, kind, created_at)
        VALUES(?,?,?, 'image', COALESCE(?, datetime('now')))
      `);

      const validUserId = (value) => {
        const id = Number(value || 0);
        if (!id) return null;
        return userExistsStmt.get(id) ? id : null;
      };
      const fallbackUserId = (chatId) => {
        const row = fallbackUserStmt.get(chatId, chatId);
        return validUserId(row?.id);
      };
      const resolveCreatedBy = (row, chatId) => (
        validUserId(row.created_by)
        || validUserId(row.uploaded_by)
        || fallbackUserId(chatId)
      );

      for (const row of legacyRows) {
        const chatId = Number(row.chat_id || 0);
        if (!chatId) continue;

        let fileId = Number(row.file_id || 0);
        if (fileId && !fileExistsStmt.get(fileId)) {
          fileId = 0;
        }

        const storedName = String(row.stored_name || '').trim();
        if (!fileId && storedName) {
          const existingFile = existingFileStmt.get(storedName);
          if (existingFile?.id) {
            fileId = Number(existingFile.id);
          } else {
            const uploaderId = resolveCreatedBy(row, chatId);
            if (!uploaderId) continue;
            const originalName = String(row.original_name || storedName).trim() || storedName;
            const mimeType = String(row.mime_type || 'image/png').trim() || 'image/png';
            const size = Math.max(0, Number(row.size || 0));
            const inserted = insertFileStmt.run(
              originalName,
              storedName,
              mimeType,
              size,
              uploaderId,
              row.created_at || null,
            );
            fileId = Number(inserted.lastInsertRowid || 0);
          }
        }

        if (!fileId) continue;
        const createdBy = resolveCreatedBy(row, chatId);
        const assetId = Number(row.id || 0);
        if (assetId) {
          insertAssetWithIdStmt.run(assetId, chatId, fileId, createdBy, row.created_at || null);
        } else {
          insertAssetStmt.run(chatId, fileId, createdBy, row.created_at || null);
        }
      }

      db.exec("DROP TABLE IF EXISTS document_assets_legacy_migration");
    })();
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_document_assets_chat ON document_assets(chat_id, id);
    CREATE INDEX IF NOT EXISTS idx_document_assets_file ON document_assets(file_id);
  `);
}

ensureDocumentAssetsSchema();

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
  db.prepare("SELECT profile_status_key FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN profile_status_key TEXT DEFAULT ''");
}
try {
  db.prepare("SELECT profile_status_text FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN profile_status_text TEXT DEFAULT ''");
}
db.prepare("UPDATE users SET profile_status_key='' WHERE profile_status_key IS NULL OR TRIM(profile_status_key) NOT IN ('available','busy','dnd','away','working','resting','custom')").run();
db.prepare("UPDATE users SET profile_status_text='' WHERE profile_status_key<>'custom' OR profile_status_text IS NULL").run();
try {
  db.prepare("SELECT ui_theme FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN ui_theme TEXT DEFAULT 'bananza'");
}
try {
  db.prepare("SELECT ui_poll_style FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN ui_poll_style TEXT DEFAULT 'pulse'");
}
try {
  db.prepare("SELECT ui_visual_mode FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN ui_visual_mode TEXT DEFAULT 'classic'");
}
db.prepare("UPDATE users SET ui_visual_mode='classic' WHERE ui_visual_mode IS NULL OR TRIM(ui_visual_mode)='' OR ui_visual_mode NOT IN ('classic','rich')").run();
try {
  db.prepare("SELECT ui_modal_animation FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN ui_modal_animation TEXT DEFAULT 'soft'");
}
try {
  db.prepare("SELECT ui_modal_animation_speed FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN ui_modal_animation_speed INTEGER DEFAULT 8");
}
try {
  db.prepare("SELECT ui_mobile_font_size FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN ui_mobile_font_size INTEGER DEFAULT 5");
}
try {
  db.prepare("SELECT ui_language FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN ui_language TEXT DEFAULT 'ru'");
}
try {
  db.prepare("SELECT ui_show_chat_folder_strip_in_all_chats FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN ui_show_chat_folder_strip_in_all_chats INTEGER DEFAULT 0");
}
db.prepare("UPDATE users SET ui_poll_style='pulse' WHERE ui_poll_style IS NULL OR TRIM(ui_poll_style)=''").run();
db.prepare("UPDATE users SET ui_modal_animation_speed=8 WHERE ui_modal_animation_speed IS NULL").run();
db.prepare("UPDATE users SET ui_mobile_font_size=5 WHERE ui_mobile_font_size IS NULL OR ui_mobile_font_size < 1 OR ui_mobile_font_size > 10").run();
db.prepare("UPDATE users SET ui_language='ru' WHERE ui_language IS NULL OR TRIM(ui_language)='' OR lower(ui_language) NOT IN ('ru','en')").run();
db.prepare("UPDATE users SET ui_language=lower(ui_language) WHERE lower(ui_language) IN ('ru','en') AND ui_language<>lower(ui_language)").run();
db.prepare("UPDATE users SET ui_show_chat_folder_strip_in_all_chats=0 WHERE ui_show_chat_folder_strip_in_all_chats IS NULL").run();
try {
  db.prepare("SELECT is_ai_bot FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN is_ai_bot INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT can_add_bots_to_chats FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN can_add_bots_to_chats INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT last_activity FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN last_activity TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT avatar_url FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN avatar_url TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT allow_unpin_any_pin FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN allow_unpin_any_pin INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT is_notes FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN is_notes INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT is_document FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN is_document INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT context_transform_enabled FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN context_transform_enabled INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT chatshot_enabled FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN chatshot_enabled INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT chatshot_bot_id FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN chatshot_bot_id INTEGER DEFAULT NULL");
}
try {
  db.prepare("SELECT chatshot_style FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN chatshot_style TEXT DEFAULT 'comic'");
}
try {
  db.prepare("SELECT chatshot_banana_filter_enabled FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN chatshot_banana_filter_enabled INTEGER DEFAULT 1");
}
try {
  db.prepare("SELECT invite_token FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN invite_token TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT invite_token_created_at FROM chats LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chats ADD COLUMN invite_token_created_at TEXT DEFAULT NULL");
}
db.prepare("UPDATE chats SET is_notes=0 WHERE is_notes IS NULL").run();
db.prepare("UPDATE chats SET is_document=0 WHERE is_document IS NULL").run();
db.prepare("UPDATE chats SET context_transform_enabled=0 WHERE context_transform_enabled IS NULL").run();
db.prepare("UPDATE chats SET chatshot_enabled=0 WHERE chatshot_enabled IS NULL").run();
db.prepare("UPDATE chats SET chatshot_style='comic' WHERE chatshot_style IS NULL OR chatshot_style NOT IN ('comic','illustration','photo')").run();
db.prepare("UPDATE chats SET chatshot_banana_filter_enabled=1 WHERE chatshot_banana_filter_enabled IS NULL").run();
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_notes_owner ON chats(created_by) WHERE is_notes=1");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_invite_token ON chats(invite_token) WHERE invite_token IS NOT NULL");
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
// Migration: forwarded metadata on messages
try {
  db.prepare("SELECT forwarded_from_message_id FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN forwarded_from_message_id INTEGER DEFAULT NULL REFERENCES messages(id)");
}
try {
  db.prepare("SELECT forwarded_from_user_id FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN forwarded_from_user_id INTEGER DEFAULT NULL REFERENCES users(id)");
}
try {
  db.prepare("SELECT forwarded_from_display_name FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN forwarded_from_display_name TEXT DEFAULT NULL");
}
// Migration: saved-to-notes metadata
try {
  db.prepare("SELECT saved_from_message_id FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN saved_from_message_id INTEGER DEFAULT NULL REFERENCES messages(id)");
}
try {
  db.prepare("SELECT saved_from_chat_id FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN saved_from_chat_id INTEGER DEFAULT NULL REFERENCES chats(id)");
}
try {
  db.prepare("SELECT saved_from_user_id FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN saved_from_user_id INTEGER DEFAULT NULL REFERENCES users(id)");
}
try {
  db.prepare("SELECT saved_from_display_name FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN saved_from_display_name TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT saved_from_created_at FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN saved_from_created_at TEXT DEFAULT NULL");
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
try {
  db.prepare("SELECT ai_generated FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN ai_generated INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT ai_bot_id FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN ai_bot_id INTEGER DEFAULT NULL");
}
try {
  db.prepare("SELECT client_id FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN client_id TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT ai_image_risk_confirmed FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN ai_image_risk_confirmed INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT ai_notice_type FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN ai_notice_type TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT ai_response_mode_hint FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN ai_response_mode_hint TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT ai_document_format_hint FROM messages LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE messages ADD COLUMN ai_document_format_hint TEXT DEFAULT NULL");
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_id ON messages(user_id, chat_id, client_id) WHERE client_id IS NOT NULL");
// Migration: last_read_id on chat_members
try {
  db.prepare("SELECT last_read_id FROM chat_members LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chat_members ADD COLUMN last_read_id INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT notify_enabled FROM chat_members LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chat_members ADD COLUMN notify_enabled INTEGER DEFAULT 1");
}
try {
  db.prepare("SELECT sounds_enabled FROM chat_members LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chat_members ADD COLUMN sounds_enabled INTEGER DEFAULT 1");
}
try {
  db.prepare("SELECT chat_list_pin_order FROM chat_members LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chat_members ADD COLUMN chat_list_pin_order INTEGER DEFAULT NULL");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_members_user_pin_order ON chat_members(user_id, chat_list_pin_order)");
try {
  db.prepare("SELECT hidden_at FROM chat_members LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chat_members ADD COLUMN hidden_at TEXT DEFAULT NULL");
}
try {
  db.prepare("SELECT hidden_after_message_id FROM chat_members LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE chat_members ADD COLUMN hidden_after_message_id INTEGER DEFAULT NULL");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_members_user_hidden ON chat_members(user_id, hidden_after_message_id)");
try {
  db.prepare("SELECT notify_mentions FROM user_notification_settings LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE user_notification_settings ADD COLUMN notify_mentions INTEGER DEFAULT 1");
}
try {
  db.prepare("SELECT notify_calls FROM user_notification_settings LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE user_notification_settings ADD COLUMN notify_calls INTEGER DEFAULT 1");
}
try {
  db.prepare("SELECT notify_pins FROM user_notification_settings LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE user_notification_settings ADD COLUMN notify_pins INTEGER DEFAULT 1");
}
try {
  db.prepare("SELECT play_mentions FROM user_sound_settings LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE user_sound_settings ADD COLUMN play_mentions INTEGER DEFAULT 1");
}
try {
  db.prepare("SELECT play_pins FROM user_sound_settings LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE user_sound_settings ADD COLUMN play_pins INTEGER DEFAULT 1");
}
db.exec(`
  CREATE TABLE IF NOT EXISTS message_mentions (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (message_id, mentioned_user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(mentioned_user_id, chat_id);
  CREATE INDEX IF NOT EXISTS idx_message_mentions_chat ON message_mentions(chat_id, message_id);
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS message_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chat_id, message_id)
  );
  CREATE INDEX IF NOT EXISTS idx_message_pins_chat ON message_pins(chat_id, id);
  CREATE INDEX IF NOT EXISTS idx_message_pins_message ON message_pins(message_id);
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS message_pin_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK(action IN ('pinned','unpinned')),
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_name TEXT DEFAULT NULL,
    message_author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    message_author_name TEXT DEFAULT NULL,
    message_preview TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_message_pin_events_chat ON message_pin_events(chat_id, id);
  CREATE INDEX IF NOT EXISTS idx_message_pin_events_message ON message_pin_events(message_id, id);
`);
db.prepare(`
  INSERT INTO message_pin_events(
    chat_id,
    message_id,
    action,
    actor_id,
    actor_name,
    message_author_id,
    message_author_name,
    message_preview,
    created_at
  )
  SELECT
    p.chat_id,
    p.message_id,
    'pinned',
    p.pinned_by,
    pu.display_name,
    m.user_id,
    mu.display_name,
    SUBSTR(COALESCE(NULLIF(m.text, ''), f.original_name, 'Attachment'), 1, 500),
    p.created_at
  FROM message_pins p
  JOIN messages m ON m.id=p.message_id
  JOIN users pu ON pu.id=p.pinned_by
  JOIN users mu ON mu.id=m.user_id
  LEFT JOIN files f ON f.id=m.file_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM message_pin_events e
    WHERE e.action='pinned'
      AND e.message_id=p.message_id
      AND e.created_at=p.created_at
  )
`).run();
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK(event_type IN (
      'chat_created',
      'member_added',
      'member_left',
      'member_removed',
      'chat_renamed',
      'chat_avatar_updated',
      'chat_avatar_removed',
      'chat_background_updated',
      'chat_background_removed',
      'chat_background_style_updated',
      'chat_history_cleared'
    )),
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_name TEXT DEFAULT NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_user_name TEXT DEFAULT NULL,
    target_is_ai_bot INTEGER DEFAULT 0,
    metadata_json TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_chat_system_events_chat_created ON chat_system_events(chat_id, created_at, id);
  CREATE INDEX IF NOT EXISTS idx_chat_system_events_target ON chat_system_events(target_user_id, chat_id);
`);
db.prepare(`
  UPDATE chat_system_events
  SET
    actor_id = (
      SELECT created.actor_id
      FROM chat_system_events created
      WHERE created.chat_id=chat_system_events.chat_id
        AND created.event_type='chat_created'
        AND created.created_at=chat_system_events.created_at
        AND TRIM(COALESCE(created.actor_name,''))!=''
      ORDER BY created.id ASC
      LIMIT 1
    ),
    actor_name = (
      SELECT created.actor_name
      FROM chat_system_events created
      WHERE created.chat_id=chat_system_events.chat_id
        AND created.event_type='chat_created'
        AND created.created_at=chat_system_events.created_at
        AND TRIM(COALESCE(created.actor_name,''))!=''
      ORDER BY created.id ASC
      LIMIT 1
    ),
    metadata_json = REPLACE(
      metadata_json,
      '"source":"chat_bot_setting"',
      CASE
        WHEN (SELECT type FROM chats WHERE id=chat_system_events.chat_id)='private'
          THEN '"source":"private_chat_create"'
        ELSE '"source":"group_chat_create"'
      END
    )
  WHERE event_type='member_added'
    AND target_is_ai_bot=1
    AND actor_id IS NULL
    AND TRIM(COALESCE(actor_name,''))=''
    AND INSTR(COALESCE(metadata_json,''), '"source":"chat_bot_setting"')>0
    AND EXISTS (
      SELECT 1
      FROM chat_system_events created
      WHERE created.chat_id=chat_system_events.chat_id
        AND created.event_type='chat_created'
        AND created.created_at=chat_system_events.created_at
        AND TRIM(COALESCE(created.actor_name,''))!=''
    )
`).run();
db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    style TEXT NOT NULL DEFAULT 'pulse',
    allows_multiple INTEGER NOT NULL DEFAULT 0,
    show_voters INTEGER NOT NULL DEFAULT 0,
    closes_at TEXT DEFAULT NULL,
    closed_at TEXT DEFAULT NULL,
    closed_by INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(message_id, position)
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (message_id, option_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_polls_closed_at ON polls(closed_at, closes_at);
  CREATE INDEX IF NOT EXISTS idx_poll_options_message ON poll_options(message_id, position);
  CREATE INDEX IF NOT EXISTS idx_poll_votes_message ON poll_votes(message_id);
  CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);
  CREATE INDEX IF NOT EXISTS idx_poll_votes_user_message ON poll_votes(user_id, message_id);
`);
try {
  db.prepare("SELECT style FROM polls LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE polls ADD COLUMN style TEXT NOT NULL DEFAULT 'pulse'");
}
db.prepare("UPDATE polls SET style='pulse' WHERE style IS NULL OR TRIM(style)='' OR style NOT IN ('pulse','stack','orbit')").run();
db.prepare(`
  INSERT OR IGNORE INTO map_provider_settings(
    id,
    enabled,
    provider,
    tile_url_template,
    tile_attribution,
    search_url,
    reverse_url,
    max_zoom
  ) VALUES(1,0,'osm','https://tile.openstreetmap.org/{z}/{x}/{y}.png','\u00A9 OpenStreetMap contributors','https://nominatim.openstreetmap.org/search','https://nominatim.openstreetmap.org/reverse',19)
`).run();
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
initVideoNoteSchema(db);
initCallSchema(db);
initAiSchema(db);

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('custom', 'bot_auto')),
    bot_id INTEGER DEFAULT NULL REFERENCES ai_bots(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_folder_memberships (
    folder_id INTEGER NOT NULL REFERENCES chat_folders(id) ON DELETE CASCADE,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (folder_id, chat_id)
  );

  CREATE TABLE IF NOT EXISTS chat_folder_pins (
    folder_id INTEGER NOT NULL REFERENCES chat_folders(id) ON DELETE CASCADE,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    pin_order INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (folder_id, chat_id)
  );

  CREATE INDEX IF NOT EXISTS idx_chat_folders_user_order ON chat_folders(user_id, sort_order, id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_folders_user_bot_auto ON chat_folders(user_id, bot_id) WHERE kind='bot_auto';
  CREATE INDEX IF NOT EXISTS idx_chat_folder_memberships_chat ON chat_folder_memberships(chat_id, folder_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_folder_pins_folder_order ON chat_folder_pins(folder_id, pin_order);
`);

module.exports = db;

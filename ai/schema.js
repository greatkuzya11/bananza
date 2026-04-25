function addColumnIfMissing(db, table, column, ddl) {
  try {
    db.prepare(`SELECT ${column} FROM ${table} LIMIT 1`).get();
  } catch {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function initAiSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      mention TEXT NOT NULL UNIQUE COLLATE NOCASE,
      style TEXT DEFAULT '',
      tone TEXT DEFAULT '',
      behavior_rules TEXT DEFAULT '',
      speech_patterns TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      provider TEXT DEFAULT 'openai',
      kind TEXT DEFAULT 'text',
      response_model TEXT DEFAULT 'gpt-4o-mini',
      summary_model TEXT DEFAULT 'gpt-4o-mini',
      embedding_model TEXT DEFAULT 'text-embedding-3-small',
      image_model TEXT DEFAULT '',
      image_aspect_ratio TEXT DEFAULT '',
      image_resolution TEXT DEFAULT '',
      allow_text INTEGER DEFAULT 1,
      allow_image_generate INTEGER DEFAULT 0,
      allow_image_edit INTEGER DEFAULT 0,
      allow_document INTEGER DEFAULT 0,
      allow_poll_create INTEGER DEFAULT 0,
      allow_poll_vote INTEGER DEFAULT 0,
      allow_react INTEGER DEFAULT 0,
      allow_pin INTEGER DEFAULT 0,
      image_quality TEXT DEFAULT '',
      image_background TEXT DEFAULT '',
      image_output_format TEXT DEFAULT '',
      document_default_format TEXT DEFAULT 'md',
      temperature REAL DEFAULT NULL,
      max_tokens INTEGER DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_chat_bots (
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      bot_id INTEGER NOT NULL REFERENCES ai_bots(id) ON DELETE CASCADE,
      enabled INTEGER DEFAULT 0,
      mode TEXT DEFAULT 'simple' CHECK(mode IN ('simple','hybrid')),
      hot_context_limit INTEGER DEFAULT 50,
      trigger_mode TEXT DEFAULT 'mention_reply',
      auto_react_on_mention INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (chat_id, bot_id)
    );

    CREATE TABLE IF NOT EXISTS message_embeddings (
      message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      source_text TEXT NOT NULL,
      is_stale INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memory_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      source_from_message_id INTEGER NOT NULL,
      source_to_message_id INTEGER NOT NULL,
      message_count INTEGER NOT NULL,
      summary_short TEXT DEFAULT '',
      summary_long TEXT DEFAULT '',
      structured_json TEXT DEFAULT '{}',
      embedding_model TEXT DEFAULT NULL,
      embedding_json TEXT DEFAULT NULL,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS room_summaries (
      chat_id INTEGER PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
      summary_short TEXT DEFAULT '',
      summary_long TEXT DEFAULT '',
      structured_json TEXT DEFAULT '{}',
      source_to_message_id INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memory_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      fact_text TEXT NOT NULL,
      subject TEXT DEFAULT '',
      object TEXT DEFAULT '',
      confidence REAL DEFAULT 0.5,
      source_message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
      content_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_memory_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      payload_json TEXT DEFAULT '{}',
      error TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS yandex_message_embeddings (
      message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      source_text TEXT NOT NULL,
      is_stale INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS yandex_memory_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      source_from_message_id INTEGER NOT NULL,
      source_to_message_id INTEGER NOT NULL,
      message_count INTEGER NOT NULL,
      summary_short TEXT DEFAULT '',
      summary_long TEXT DEFAULT '',
      structured_json TEXT DEFAULT '{}',
      embedding_model TEXT DEFAULT NULL,
      embedding_json TEXT DEFAULT NULL,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS yandex_room_summaries (
      chat_id INTEGER PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
      summary_short TEXT DEFAULT '',
      summary_long TEXT DEFAULT '',
      structured_json TEXT DEFAULT '{}',
      source_to_message_id INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS yandex_memory_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      fact_text TEXT NOT NULL,
      subject TEXT DEFAULT '',
      object TEXT DEFAULT '',
      confidence REAL DEFAULT 0.5,
      source_message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
      content_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS yandex_memory_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      payload_json TEXT DEFAULT '{}',
      error TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS grok_message_embeddings (
      message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      source_text TEXT NOT NULL,
      is_stale INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS grok_memory_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      source_from_message_id INTEGER NOT NULL,
      source_to_message_id INTEGER NOT NULL,
      message_count INTEGER NOT NULL,
      summary_short TEXT DEFAULT '',
      summary_long TEXT DEFAULT '',
      structured_json TEXT DEFAULT '{}',
      embedding_model TEXT DEFAULT NULL,
      embedding_json TEXT DEFAULT NULL,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS grok_room_summaries (
      chat_id INTEGER PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
      summary_short TEXT DEFAULT '',
      summary_long TEXT DEFAULT '',
      structured_json TEXT DEFAULT '{}',
      source_to_message_id INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS grok_memory_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      fact_text TEXT NOT NULL,
      subject TEXT DEFAULT '',
      object TEXT DEFAULT '',
      confidence REAL DEFAULT 0.5,
      source_message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
      content_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS grok_memory_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      payload_json TEXT DEFAULT '{}',
      error TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ai_chat_bots_chat ON ai_chat_bots(chat_id, enabled);
    CREATE INDEX IF NOT EXISTS idx_ai_bots_enabled ON ai_bots(enabled);
    CREATE INDEX IF NOT EXISTS idx_message_embeddings_chat ON message_embeddings(chat_id, is_stale);
    CREATE INDEX IF NOT EXISTS idx_memory_chunks_chat ON memory_chunks(chat_id, source_to_message_id);
    CREATE INDEX IF NOT EXISTS idx_memory_facts_chat ON memory_facts(chat_id, is_active, type);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_facts_dedupe ON memory_facts(chat_id, content_hash);
    CREATE INDEX IF NOT EXISTS idx_ai_memory_jobs_chat ON ai_memory_jobs(chat_id, status, type);
    CREATE INDEX IF NOT EXISTS idx_yandex_message_embeddings_chat ON yandex_message_embeddings(chat_id, is_stale);
    CREATE INDEX IF NOT EXISTS idx_yandex_memory_chunks_chat ON yandex_memory_chunks(chat_id, source_to_message_id);
    CREATE INDEX IF NOT EXISTS idx_yandex_memory_facts_chat ON yandex_memory_facts(chat_id, is_active, type);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_yandex_memory_facts_dedupe ON yandex_memory_facts(chat_id, content_hash);
    CREATE INDEX IF NOT EXISTS idx_yandex_memory_jobs_chat ON yandex_memory_jobs(chat_id, status, type);
    CREATE INDEX IF NOT EXISTS idx_grok_message_embeddings_chat ON grok_message_embeddings(chat_id, is_stale);
    CREATE INDEX IF NOT EXISTS idx_grok_memory_chunks_chat ON grok_memory_chunks(chat_id, source_to_message_id);
    CREATE INDEX IF NOT EXISTS idx_grok_memory_facts_chat ON grok_memory_facts(chat_id, is_active, type);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_grok_memory_facts_dedupe ON grok_memory_facts(chat_id, content_hash);
    CREATE INDEX IF NOT EXISTS idx_grok_memory_jobs_chat ON grok_memory_jobs(chat_id, status, type);
  `);

  addColumnIfMissing(db, 'ai_bots', 'provider', "provider TEXT DEFAULT 'openai'");
  addColumnIfMissing(db, 'ai_bots', 'kind', "kind TEXT DEFAULT 'text'");
  addColumnIfMissing(db, 'ai_bots', 'temperature', 'temperature REAL DEFAULT NULL');
  addColumnIfMissing(db, 'ai_bots', 'max_tokens', 'max_tokens INTEGER DEFAULT NULL');
  addColumnIfMissing(db, 'ai_bots', 'image_model', "image_model TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bots', 'image_aspect_ratio', "image_aspect_ratio TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bots', 'image_resolution', "image_resolution TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bots', 'allow_text', 'allow_text INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'ai_bots', 'allow_image_generate', 'allow_image_generate INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'ai_bots', 'allow_image_edit', 'allow_image_edit INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'ai_bots', 'allow_document', 'allow_document INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'ai_bots', 'allow_poll_create', 'allow_poll_create INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'ai_bots', 'allow_poll_vote', 'allow_poll_vote INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'ai_bots', 'allow_react', 'allow_react INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'ai_bots', 'allow_pin', 'allow_pin INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'ai_bots', 'image_quality', "image_quality TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bots', 'image_background', "image_background TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bots', 'image_output_format', "image_output_format TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bots', 'document_default_format', "document_default_format TEXT DEFAULT 'md'");
  addColumnIfMissing(db, 'ai_chat_bots', 'auto_react_on_mention', 'auto_react_on_mention INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'users', 'is_ai_bot', 'is_ai_bot INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'messages', 'ai_generated', 'ai_generated INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'messages', 'ai_bot_id', 'ai_bot_id INTEGER DEFAULT NULL');
  addColumnIfMissing(db, 'messages', 'ai_response_mode_hint', "ai_response_mode_hint TEXT DEFAULT NULL");
  addColumnIfMissing(db, 'messages', 'ai_document_format_hint', "ai_document_format_hint TEXT DEFAULT NULL");

  db.exec('CREATE INDEX IF NOT EXISTS idx_ai_bots_provider ON ai_bots(provider, enabled)');
}

module.exports = { initAiSchema };

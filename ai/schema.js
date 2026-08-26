const { buildInitiativeRuleName } = require('./initiativeRuleName');

function addColumnIfMissing(db, table, column, ddl) {
  try {
    db.prepare(`SELECT ${column} FROM ${table} LIMIT 1`).get();
  } catch {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function ensureInitiativeRulesPromptModeSupportsNews(db) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ai_bot_initiative_rules'").get();
  if (!row?.sql || row.sql.includes('news_hook')) return;

  const foreignKeys = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`
      CREATE TABLE ai_bot_initiative_rules_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT '',
        chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        bot_id INTEGER NOT NULL REFERENCES ai_bots(id) ON DELETE CASCADE,
        enabled INTEGER DEFAULT 0,
        schedule_type TEXT DEFAULT 'fixed' CHECK(schedule_type IN ('fixed','random_window')),
        fixed_time TEXT DEFAULT '09:00',
        window_start TEXT DEFAULT '09:00',
        window_end TEXT DEFAULT '18:00',
        timezone TEXT DEFAULT 'UTC',
        idle_threshold_minutes INTEGER DEFAULT 1440,
        min_gap_minutes INTEGER DEFAULT 1440,
        same_context_limit_enabled INTEGER DEFAULT 1,
        same_context_max_runs INTEGER DEFAULT 1,
        same_context_run_count INTEGER DEFAULT 0,
        prompt_mode TEXT DEFAULT 'context_question' CHECK(prompt_mode IN ('context_question','news_hook','date_holiday','idle_ping','custom')),
        custom_prompt TEXT DEFAULT '',
        holiday_country TEXT DEFAULT '',
        news_source_id INTEGER DEFAULT NULL REFERENCES ai_news_sources(id) ON DELETE SET NULL,
        news_max_age_hours INTEGER DEFAULT 24,
        news_item_count INTEGER DEFAULT 1,
        news_use_chat_context INTEGER DEFAULT 1,
        news_prompt TEXT DEFAULT '',
        next_run_at TEXT DEFAULT NULL,
        last_run_at TEXT DEFAULT NULL,
        last_message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      INSERT INTO ai_bot_initiative_rules_new(
        id, name, chat_id, bot_id, enabled, schedule_type, fixed_time, window_start, window_end, timezone,
        idle_threshold_minutes, min_gap_minutes, same_context_limit_enabled, same_context_max_runs,
        same_context_run_count, prompt_mode, custom_prompt, holiday_country, news_source_id,
        news_max_age_hours, news_item_count, news_use_chat_context, news_prompt, next_run_at, last_run_at,
        last_message_id, created_at, updated_at
      )
      SELECT
        id, name, chat_id, bot_id, enabled, schedule_type, fixed_time, window_start, window_end, timezone,
        idle_threshold_minutes, min_gap_minutes, same_context_limit_enabled, same_context_max_runs,
        same_context_run_count,
        CASE WHEN prompt_mode='date_holiday' THEN 'news_hook' ELSE COALESCE(prompt_mode, 'context_question') END,
        custom_prompt, holiday_country, news_source_id, news_max_age_hours, news_item_count,
        news_use_chat_context, news_prompt, next_run_at, last_run_at, last_message_id, created_at, updated_at
      FROM ai_bot_initiative_rules;

      DROP TABLE ai_bot_initiative_rules;
      ALTER TABLE ai_bot_initiative_rules_new RENAME TO ai_bot_initiative_rules;
    `);
  } finally {
    db.pragma(`foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`);
  }
}

function backfillInitiativeRuleNames(db) {
  const fallbackSource = db.prepare(`
    SELECT id, name
    FROM ai_news_sources
    ORDER BY CASE WHEN enabled=1 THEN 0 ELSE 1 END, name COLLATE NOCASE ASC, id ASC
    LIMIT 1
  `).get() || {};
  const rows = db.prepare(`
    SELECT
      r.id,
      r.chat_id,
      r.bot_id,
      r.prompt_mode,
      r.news_source_id,
      c.name AS chat_name,
      b.name AS bot_name,
      s.name AS source_name
    FROM ai_bot_initiative_rules r
    LEFT JOIN chats c ON c.id=r.chat_id
    LEFT JOIN ai_bots b ON b.id=r.bot_id
    LEFT JOIN ai_news_sources s ON s.id=r.news_source_id
    WHERE TRIM(COALESCE(r.name, ''))=''
    ORDER BY r.id ASC
  `).all();
  if (!rows.length) return 0;

  const updateName = db.prepare(`
    UPDATE ai_bot_initiative_rules
    SET name=?
    WHERE id=? AND TRIM(COALESCE(name, ''))=''
  `);
  return db.transaction((pendingRows) => {
    let changed = 0;
    for (const row of pendingRows) {
      const usesNews = row.prompt_mode === 'news_hook';
      const sourceId = Number(row.news_source_id || fallbackSource.id || 0) || null;
      const sourceName = row.source_name || (usesNews ? fallbackSource.name : '');
      const name = buildInitiativeRuleName({
        promptMode: row.prompt_mode,
        sourceName,
        sourceId,
        chatName: row.chat_name,
        chatId: row.chat_id,
        botName: row.bot_name,
        botId: row.bot_id,
      });
      changed += updateName.run(name, row.id).changes;
    }
    return changed;
  })(rows);
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
      transform_prompt TEXT DEFAULT '',
      available_in_all_chats INTEGER DEFAULT 0,
      chatshot_context_limit INTEGER DEFAULT 50,
      image_risk_filter_enabled INTEGER DEFAULT 1,
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

    CREATE TABLE IF NOT EXISTS bot_chat_add_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bot_id INTEGER NOT NULL REFERENCES ai_bots(id) ON DELETE CASCADE,
      bot_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      bot_name TEXT DEFAULT '',
      bot_mention TEXT DEFAULT '',
      bot_provider TEXT DEFAULT 'openai',
      bot_kind TEXT DEFAULT 'text',
      bot_model TEXT DEFAULT '',
      chat_name TEXT DEFAULT '',
      chat_type TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_bot_initiative_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      bot_id INTEGER NOT NULL REFERENCES ai_bots(id) ON DELETE CASCADE,
      enabled INTEGER DEFAULT 0,
      schedule_type TEXT DEFAULT 'fixed' CHECK(schedule_type IN ('fixed','random_window')),
      fixed_time TEXT DEFAULT '09:00',
      window_start TEXT DEFAULT '09:00',
      window_end TEXT DEFAULT '18:00',
      timezone TEXT DEFAULT 'UTC',
      idle_threshold_minutes INTEGER DEFAULT 1440,
      min_gap_minutes INTEGER DEFAULT 1440,
      same_context_limit_enabled INTEGER DEFAULT 1,
      same_context_max_runs INTEGER DEFAULT 1,
      same_context_run_count INTEGER DEFAULT 0,
      prompt_mode TEXT DEFAULT 'context_question' CHECK(prompt_mode IN ('context_question','news_hook','date_holiday','idle_ping','custom')),
      custom_prompt TEXT DEFAULT '',
      holiday_country TEXT DEFAULT '',
      news_source_id INTEGER DEFAULT NULL REFERENCES ai_news_sources(id) ON DELETE SET NULL,
      news_max_age_hours INTEGER DEFAULT 24,
      news_item_count INTEGER DEFAULT 1,
      news_use_chat_context INTEGER DEFAULT 1,
      news_prompt TEXT DEFAULT '',
      next_run_at TEXT DEFAULT NULL,
      last_run_at TEXT DEFAULT NULL,
      last_message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
      last_attempt_at TEXT DEFAULT NULL,
      last_attempt_status TEXT DEFAULT '',
      last_attempt_reason TEXT DEFAULT '',
      last_attempt_stage TEXT DEFAULT '',
      last_attempt_detail TEXT DEFAULT '',
      last_attempt_tries INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_bot_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      bot_id INTEGER NOT NULL REFERENCES ai_bots(id) ON DELETE CASCADE,
      source_message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
      due_at TEXT NOT NULL,
      requester_timezone TEXT DEFAULT 'UTC',
      reminder_text TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','canceled','error')),
      attempts INTEGER DEFAULT 0,
      sent_message_id INTEGER DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
      error TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_holiday_cache (
      source TEXT NOT NULL,
      country_code TEXT NOT NULL,
      year INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (source, country_code, year)
    );

    CREATE TABLE IF NOT EXISTS ai_news_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'rss' CHECK(type IN ('rss')),
      url TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      cache_ttl_minutes INTEGER DEFAULT 30,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_news_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES ai_news_sources(id) ON DELETE CASCADE,
      guid TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT DEFAULT '',
      url TEXT DEFAULT '',
      published_at TEXT DEFAULT NULL,
      fetched_at TEXT DEFAULT (datetime('now')),
      raw_json TEXT DEFAULT '{}',
      UNIQUE(source_id, guid)
    );

    CREATE TABLE IF NOT EXISTS ai_news_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL REFERENCES ai_bot_initiative_rules(id) ON DELETE CASCADE,
      source_id INTEGER NOT NULL REFERENCES ai_news_sources(id) ON DELETE CASCADE,
      item_guid TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      UNIQUE(rule_id, source_id, item_guid)
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
    CREATE INDEX IF NOT EXISTS idx_bot_chat_add_audit_actor_created ON bot_chat_add_audit(actor_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bot_chat_add_audit_chat_created ON bot_chat_add_audit(chat_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_initiative_rules_due ON ai_bot_initiative_rules(enabled, next_run_at);
    CREATE INDEX IF NOT EXISTS idx_ai_initiative_rules_chat ON ai_bot_initiative_rules(chat_id, bot_id);
    CREATE INDEX IF NOT EXISTS idx_ai_reminders_due ON ai_bot_reminders(status, due_at);
    CREATE INDEX IF NOT EXISTS idx_ai_reminders_user_chat ON ai_bot_reminders(requester_user_id, chat_id, status);
    CREATE INDEX IF NOT EXISTS idx_ai_news_sources_enabled ON ai_news_sources(enabled, type);
    CREATE INDEX IF NOT EXISTS idx_ai_news_items_source_published ON ai_news_items(source_id, published_at);
    CREATE INDEX IF NOT EXISTS idx_ai_news_history_rule ON ai_news_history(rule_id, sent_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_news_history_rule_source_guid ON ai_news_history(rule_id, source_id, item_guid);
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
  addColumnIfMissing(db, 'ai_bots', 'transform_prompt', "transform_prompt TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bots', 'available_in_all_chats', 'available_in_all_chats INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'ai_bots', 'chatshot_context_limit', 'chatshot_context_limit INTEGER DEFAULT 50');
  addColumnIfMissing(db, 'ai_bots', 'image_risk_filter_enabled', 'image_risk_filter_enabled INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'ai_bots', 'visible_to_users', 'visible_to_users INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'chats', 'chatshot_enabled', 'chatshot_enabled INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'chats', 'chatshot_bot_id', 'chatshot_bot_id INTEGER DEFAULT NULL');
  addColumnIfMissing(db, 'chats', 'chatshot_style', "chatshot_style TEXT DEFAULT 'comic'");
  addColumnIfMissing(db, 'chats', 'chatshot_banana_filter_enabled', 'chatshot_banana_filter_enabled INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'ai_chat_bots', 'auto_react_on_mention', 'auto_react_on_mention INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'users', 'is_ai_bot', 'is_ai_bot INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'users', 'timezone', "timezone TEXT DEFAULT NULL");
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'name', "name TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'same_context_limit_enabled', 'same_context_limit_enabled INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'same_context_max_runs', 'same_context_max_runs INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'same_context_run_count', 'same_context_run_count INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'news_source_id', 'news_source_id INTEGER DEFAULT NULL REFERENCES ai_news_sources(id) ON DELETE SET NULL');
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'news_max_age_hours', 'news_max_age_hours INTEGER DEFAULT 24');
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'news_item_count', 'news_item_count INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'news_use_chat_context', 'news_use_chat_context INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'news_prompt', "news_prompt TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'last_attempt_at', 'last_attempt_at TEXT DEFAULT NULL');
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'last_attempt_status', "last_attempt_status TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'last_attempt_reason', "last_attempt_reason TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'last_attempt_stage', "last_attempt_stage TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'last_attempt_detail', "last_attempt_detail TEXT DEFAULT ''");
  addColumnIfMissing(db, 'ai_bot_initiative_rules', 'last_attempt_tries', 'last_attempt_tries INTEGER DEFAULT 0');
  ensureInitiativeRulesPromptModeSupportsNews(db);
  addColumnIfMissing(db, 'messages', 'ai_generated', 'ai_generated INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'messages', 'ai_bot_id', 'ai_bot_id INTEGER DEFAULT NULL');
  addColumnIfMissing(db, 'messages', 'ai_notice_type', 'ai_notice_type TEXT DEFAULT NULL');
  addColumnIfMissing(db, 'messages', 'ai_response_mode_hint', "ai_response_mode_hint TEXT DEFAULT NULL");
  addColumnIfMissing(db, 'messages', 'ai_document_format_hint', "ai_document_format_hint TEXT DEFAULT NULL");

  db.exec('CREATE INDEX IF NOT EXISTS idx_ai_bots_provider ON ai_bots(provider, enabled)');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_initiative_rules_due ON ai_bot_initiative_rules(enabled, next_run_at);
    CREATE INDEX IF NOT EXISTS idx_ai_initiative_rules_chat ON ai_bot_initiative_rules(chat_id, bot_id);
    CREATE INDEX IF NOT EXISTS idx_ai_news_sources_enabled ON ai_news_sources(enabled, type);
    CREATE INDEX IF NOT EXISTS idx_ai_news_items_source_published ON ai_news_items(source_id, published_at);
    CREATE INDEX IF NOT EXISTS idx_ai_news_history_rule ON ai_news_history(rule_id, sent_at);
  `);
  db.prepare(`
    INSERT INTO ai_news_sources(name, type, url, enabled, cache_ttl_minutes)
    SELECT 'Lenta.ru top7', 'rss', 'https://lenta.ru/rss/top7', 1, 30
    WHERE NOT EXISTS (SELECT 1 FROM ai_news_sources)
  `).run();
  db.prepare("UPDATE ai_bot_initiative_rules SET prompt_mode='news_hook' WHERE prompt_mode='date_holiday'").run();
  backfillInitiativeRuleNames(db);
  db.prepare("UPDATE chats SET chatshot_enabled=0 WHERE chatshot_enabled IS NULL").run();
  db.prepare("UPDATE chats SET chatshot_style='comic' WHERE chatshot_style IS NULL OR chatshot_style NOT IN ('comic','illustration','photo')").run();
  db.prepare("UPDATE chats SET chatshot_banana_filter_enabled=1 WHERE chatshot_banana_filter_enabled IS NULL").run();
}

module.exports = {
  initAiSchema,
  __private: { backfillInitiativeRuleNames },
};

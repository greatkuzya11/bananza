const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { POLL_CLOSE_PRESETS, createPollService, toDbDate } = require('../polls');
const { createMessageActionsService, normalizeOptionText } = require('../messageActions');

function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return !!fallback;
}

function normalizePollPayload(input = {}) {
  const rawOptions = Array.isArray(input.options) ? input.options : [];
  const options = rawOptions.map(normalizeOptionText).filter(Boolean);
  if (options.length < 2 || options.length > 10) {
    const error = new Error('Poll must have 2-10 options');
    error.status = 400;
    throw error;
  }
  const keys = options.map((option) => option.toLowerCase());
  if (new Set(keys).size !== keys.length) {
    const error = new Error('Poll options must be unique');
    error.status = 400;
    throw error;
  }
  const closePreset = typeof input.close_preset === 'string' && input.close_preset.trim()
    ? input.close_preset.trim()
    : null;
  if (closePreset && !Object.prototype.hasOwnProperty.call(POLL_CLOSE_PRESETS, closePreset)) {
    const error = new Error('Unknown poll close preset');
    error.status = 400;
    throw error;
  }
  return {
    style: 'pulse',
    options,
    allows_multiple: boolValue(input.allows_multiple, false),
    show_voters: boolValue(input.show_voters, false),
    close_preset: closePreset,
    closes_at: closePreset ? toDbDate(Date.now() + POLL_CLOSE_PRESETS[closePreset]) : null,
  };
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_ai_bot INTEGER DEFAULT 0,
      avatar_color TEXT DEFAULT '#65aadd',
      avatar_url TEXT DEFAULT NULL
    );

    CREATE TABLE chats (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      is_notes INTEGER DEFAULT 0,
      allow_unpin_any_pin INTEGER DEFAULT 0
    );

    CREATE TABLE chat_members (
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (chat_id, user_id)
    );

    CREATE TABLE files (
      id INTEGER PRIMARY KEY,
      original_name TEXT,
      stored_name TEXT,
      mime_type TEXT,
      size INTEGER,
      type TEXT,
      uploaded_by INTEGER
    );

    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      text TEXT,
      file_id INTEGER REFERENCES files(id),
      reply_to_id INTEGER DEFAULT NULL REFERENCES messages(id),
      client_id TEXT DEFAULT NULL,
      ai_generated INTEGER DEFAULT 0,
      ai_bot_id INTEGER DEFAULT NULL,
      ai_image_risk_confirmed INTEGER DEFAULT 0,
      ai_response_mode_hint TEXT DEFAULT NULL,
      ai_document_format_hint TEXT DEFAULT NULL,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE polls (
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

    CREATE TABLE poll_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(message_id, position)
    );

    CREATE TABLE poll_votes (
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (message_id, option_id, user_id)
    );

    CREATE TABLE reactions (
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (message_id, user_id, emoji)
    );

    CREATE TABLE message_pins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      pinned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(chat_id, message_id)
    );

    CREATE TABLE message_pin_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_name TEXT DEFAULT NULL,
      message_author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      message_author_name TEXT DEFAULT NULL,
      message_preview TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function createHarness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  createSchema(db);

  db.exec(`
    INSERT INTO users(id, username, display_name, is_ai_bot) VALUES
      (1, 'alice', 'Alice', 0),
      (2, 'helper_bot', 'Helper Bot', 1),
      (3, 'bob', 'Bob', 0);

    INSERT INTO chats(id, name, type, created_by, is_notes, allow_unpin_any_pin) VALUES
      (1, 'General', 'group', 1, 0, 0),
      (2, 'Notes', 'group', 1, 1, 0);

    INSERT INTO chat_members(chat_id, user_id) VALUES
      (1, 1), (1, 2), (1, 3),
      (2, 1), (2, 2), (2, 3);
  `);

  const broadcasts = [];
  const pollUpdates = [];
  const notifications = [];
  const mentionWrites = [];

  const pollFeature = createPollService({
    db,
    sendToUser(userId, payload) {
      pollUpdates.push({ userId, payload });
    },
  });

  function hydrateMessageById(messageId, viewerUserId = null) {
    const row = db.prepare(`
      SELECT
        m.*,
        u.username,
        u.display_name
      FROM messages m
      JOIN users u ON u.id=m.user_id
      WHERE m.id=?
    `).get(messageId);
    if (!row) return null;
    return pollFeature.attachPollMetadata([row], viewerUserId || row.user_id, {
      ensureClosed: false,
      broadcastOnClose: false,
    })[0];
  }

  function getChatPinPayload(chatId) {
    const chat = db.prepare('SELECT allow_unpin_any_pin FROM chats WHERE id=?').get(chatId) || {};
    const pins = db.prepare(`
      SELECT message_id, pinned_by, created_at
      FROM message_pins
      WHERE chat_id=?
      ORDER BY id ASC
    `).all(chatId).map((row) => ({
      message_id: Number(row.message_id) || 0,
      pinned_by: Number(row.pinned_by) || 0,
      created_at: row.created_at || null,
    }));
    return {
      pins,
      allow_unpin_any_pin: Number(chat.allow_unpin_any_pin) !== 0,
    };
  }

  const service = createMessageActionsService({
    db,
    pollFeature,
    hydrateMessageById,
    saveMessageMentions(messageId, chatId, text) {
      mentionWrites.push({ messageId, chatId, text });
    },
    broadcastToChatAll(chatId, payload) {
      broadcasts.push({ chatId, payload });
      return payload;
    },
    notifyMessageCreated(message) {
      notifications.push({ type: 'message_created', messageId: Number(message?.id) || 0 });
    },
    notifyReaction(payload) {
      notifications.push({ type: 'reaction', payload });
    },
    notifyPinCreated(payload) {
      notifications.push({ type: 'pin', payload });
    },
    onMessagePublished(message) {
      notifications.push({ type: 'published', messageId: Number(message?.id) || 0 });
    },
    recordPinEvent({ chatId, messageId, action, actor, createdAt }) {
      const message = db.prepare(`
        SELECT m.user_id, u.display_name, m.text
        FROM messages m
        JOIN users u ON u.id=m.user_id
        WHERE m.id=?
      `).get(messageId);
      const result = db.prepare(`
        INSERT INTO message_pin_events(
          chat_id, message_id, action, actor_id, actor_name, message_author_id, message_author_name, message_preview, created_at
        ) VALUES(?,?,?,?,?,?,?,?,?)
      `).run(
        chatId,
        messageId,
        action,
        actor?.id || null,
        actor?.display_name || actor?.username || null,
        message?.user_id || null,
        message?.display_name || null,
        String(message?.text || '').slice(0, 120),
        createdAt || null
      );
      return db.prepare('SELECT * FROM message_pin_events WHERE id=?').get(result.lastInsertRowid);
    },
    broadcastPinsUpdated(chatId, meta = {}) {
      const payload = {
        ...getChatPinPayload(chatId),
        pin_event: meta.pinEvent || null,
      };
      broadcasts.push({
        chatId,
        payload: {
          type: 'pins_updated',
          chatId,
          ...payload,
          action: meta.action || null,
          actorId: meta.actorId || 0,
          messageId: meta.messageId || 0,
        },
      });
      return payload;
    },
    getChatPinPayload,
    isChatMember(chatId, userId) {
      return !!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, userId);
    },
    isNotesChatRow(chat) {
      return Number(chat?.is_notes) !== 0;
    },
    normalizePollPayload,
    isValidReactionEmoji(value) {
      return new Set(['🔥', '👍', '🤖']).has(String(value || '').trim());
    },
  });

  const insertMessageStmt = db.prepare(`
    INSERT INTO messages(
      chat_id, user_id, text, file_id, reply_to_id, client_id, ai_generated, ai_bot_id,
      ai_image_risk_confirmed, ai_response_mode_hint, ai_document_format_hint
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `);

  function insertMessage({ chatId = 1, userId = 1, text = 'hello', replyToId = null, aiGenerated = false, aiBotId = null } = {}) {
    const result = insertMessageStmt.run(
      chatId,
      userId,
      text,
      null,
      replyToId,
      null,
      aiGenerated ? 1 : 0,
      aiBotId,
      0,
      null,
      null
    );
    return hydrateMessageById(result.lastInsertRowid, userId);
  }

  const botActor = { id: 2, display_name: 'Helper Bot', username: 'helper_bot' };

  return {
    db,
    service,
    pollFeature,
    broadcasts,
    pollUpdates,
    notifications,
    mentionWrites,
    insertMessage,
    hydrateMessageById,
    botActor,
    close() {
      db.close();
    },
  };
}

test('createPollMessage creates a poll reply and pinMessage pins it', (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  const source = harness.insertMessage({ userId: 1, text: '@helper_bot make a poll' });
  const created = harness.service.createPollMessage({
    actor: harness.botActor,
    chatId: 1,
    text: 'Lunch today?',
    replyToId: source.id,
    poll: {
      options: ['Pizza', 'Sushi'],
      show_voters: false,
      close_preset: '24h',
    },
    aiGenerated: true,
    aiBotId: 99,
  });

  assert.equal(Number(created.message.reply_to_id), Number(source.id));
  assert.equal(Number(created.message.ai_generated), 1);
  assert.equal(Number(created.message.ai_bot_id), 99);
  assert.equal(created.poll.show_voters, false);
  assert.equal(created.poll.options.length, 2);
  assert.ok(created.poll.closes_at);
  assert.equal(harness.mentionWrites.length, 1);
  assert.equal(harness.broadcasts.filter((entry) => entry.payload.type === 'message').length, 1);

  const pinResult = harness.service.pinMessage({
    actor: harness.botActor,
    messageId: created.message.id,
  });

  assert.equal(pinResult.changed, true);
  assert.equal(pinResult.pins.length, 1);
  assert.equal(Number(pinResult.pins[0].message_id), Number(created.message.id));
  assert.equal(
    harness.broadcasts.filter((entry) => entry.payload.type === 'pins_updated').length,
    1
  );
});

test('createPollMessage rejects notes chat', (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  assert.throws(
    () => harness.service.createPollMessage({
      actor: harness.botActor,
      chatId: 2,
      text: 'This should fail',
      poll: { options: ['Yes', 'No'] },
    }),
    (error) => error?.code === 'notes_chat'
  );

  const totalMessages = harness.db.prepare('SELECT COUNT(*) as total FROM messages').get().total;
  assert.equal(Number(totalMessages), 0);
});

test('votePoll resolves option_texts and broadcasts viewer-specific poll_updated payloads', (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  const created = harness.service.createPollMessage({
    actor: harness.botActor,
    chatId: 1,
    text: 'Best fruit?',
    poll: { options: ['Banana', 'Apple'], show_voters: true },
  });

  const voteResult = harness.service.votePoll({
    actor: harness.botActor,
    messageId: created.message.id,
    optionTexts: ['Banana'],
  });

  assert.equal(voteResult.optionIds.length, 1);
  assert.equal(
    harness.db.prepare('SELECT COUNT(*) as total FROM poll_votes WHERE message_id=?').get(created.message.id).total,
    1
  );

  const updates = harness.pollUpdates.filter((entry) => Number(entry.payload.messageId) === Number(created.message.id));
  assert.equal(updates.length, 3);

  const botView = updates.find((entry) => entry.userId === 2);
  const aliceView = updates.find((entry) => entry.userId === 1);
  const botOption = botView.payload.poll.options.find((option) => option.text === 'Banana');
  const aliceOption = aliceView.payload.poll.options.find((option) => option.text === 'Banana');

  assert.equal(botOption.voted_by_me, true);
  assert.equal(aliceOption.voted_by_me, false);
});

test('votePoll rejects unknown option_texts without mutating votes', (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  const created = harness.service.createPollMessage({
    actor: harness.botActor,
    chatId: 1,
    text: 'Choose one',
    poll: { options: ['Red', 'Blue'] },
  });

  assert.throws(
    () => harness.service.votePoll({
      actor: harness.botActor,
      messageId: created.message.id,
      optionTexts: ['Green'],
    }),
    (error) => error?.code === 'bad_option_text'
  );

  const totalVotes = harness.db.prepare('SELECT COUNT(*) as total FROM poll_votes WHERE message_id=?').get(created.message.id).total;
  assert.equal(Number(totalVotes), 0);
});

test('toggleReaction validates emoji and ensure_present avoids duplicate bot auto-reactions', (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  const message = harness.insertMessage({ userId: 1, text: 'hello bot' });
  const first = harness.service.toggleReaction({
    actor: harness.botActor,
    messageId: message.id,
    emoji: '🔥',
    behavior: 'ensure_present',
    replaceExistingFromActor: false,
  });
  const second = harness.service.toggleReaction({
    actor: harness.botActor,
    messageId: message.id,
    emoji: '🔥',
    behavior: 'ensure_present',
    replaceExistingFromActor: false,
  });

  assert.equal(first.changed, true);
  assert.equal(first.reactionAdded, true);
  assert.equal(second.changed, false);
  assert.equal(second.reactionAdded, false);
  assert.equal(
    harness.db.prepare('SELECT COUNT(*) as total FROM reactions WHERE message_id=? AND user_id=?').get(message.id, 2).total,
    1
  );
  assert.equal(
    harness.broadcasts.filter((entry) => entry.payload.type === 'reaction').length,
    1
  );

  assert.throws(
    () => harness.service.toggleReaction({
      actor: harness.botActor,
      messageId: message.id,
      emoji: 'not-an-emoji',
    }),
    (error) => error?.code === 'invalid_emoji'
  );
});

test('toggleReaction replace semantics keep bot reactions idempotent and swap emoji', (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  const message = harness.insertMessage({ userId: 1, text: 'rate this' });
  const first = harness.service.toggleReaction({
    actor: harness.botActor,
    messageId: message.id,
    emoji: '👍',
    behavior: 'ensure_present',
    replaceExistingFromActor: true,
  });
  const second = harness.service.toggleReaction({
    actor: harness.botActor,
    messageId: message.id,
    emoji: '👍',
    behavior: 'ensure_present',
    replaceExistingFromActor: true,
  });
  const third = harness.service.toggleReaction({
    actor: harness.botActor,
    messageId: message.id,
    emoji: '🤖',
    behavior: 'ensure_present',
    replaceExistingFromActor: true,
  });

  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(third.changed, true);
  assert.deepEqual(
    harness.db.prepare('SELECT emoji FROM reactions WHERE message_id=? AND user_id=? ORDER BY emoji ASC').all(message.id, 2),
    [{ emoji: '🤖' }]
  );
});

test('toggleReaction remove semantics clear current bot reaction without toggle behavior', (t) => {
  const harness = createHarness();
  t.after(() => harness.close());

  const message = harness.insertMessage({ userId: 1, text: 'remove it' });
  harness.service.toggleReaction({
    actor: harness.botActor,
    messageId: message.id,
    emoji: '🔥',
    behavior: 'ensure_present',
    replaceExistingFromActor: true,
  });

  const removed = harness.service.toggleReaction({
    actor: harness.botActor,
    messageId: message.id,
    emoji: '',
    behavior: 'remove',
    removeAllFromActor: true,
  });

  assert.equal(removed.changed, true);
  assert.equal(
    harness.db.prepare('SELECT COUNT(*) as total FROM reactions WHERE message_id=? AND user_id=?').get(message.id, 2).total,
    0
  );
});

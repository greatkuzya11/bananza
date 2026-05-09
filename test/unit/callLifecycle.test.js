const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { initCallSchema } = require('../../calls/schema');
const { createCallFeature } = require('../../calls');

function createDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      display_name TEXT,
      is_ai_bot INTEGER DEFAULT 0,
      avatar_color TEXT DEFAULT '',
      avatar_url TEXT DEFAULT NULL
    );
    CREATE TABLE chats (
      id INTEGER PRIMARY KEY,
      name TEXT,
      type TEXT,
      is_notes INTEGER DEFAULT 0
    );
    CREATE TABLE chat_members (
      chat_id INTEGER,
      user_id INTEGER,
      PRIMARY KEY(chat_id, user_id)
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  initCallSchema(db);
  return db;
}

function createAppStub() {
  return {
    get() {},
    post() {},
    put() {},
  };
}

function createFeature(db) {
  return createCallFeature({
    app: createAppStub(),
    db,
    auth: (_req, _res, next) => next(),
    adminOnly: (_req, _res, next) => next(),
    rateLimit: null,
    sendToUser: () => {},
    broadcastToChatAll: () => {},
    clients: new Map(),
    notifyCallInvite: () => {},
    hydrateMessageById: (messageId) => db.prepare('SELECT * FROM messages WHERE id=?').get(messageId),
  });
}

function seedUsersAndChat(db, type = 'private') {
  db.exec(`
    INSERT INTO users(id, username, display_name, is_ai_bot) VALUES
      (1, 'alice', 'Alice', 0),
      (2, 'bob', 'Bob', 0);
    INSERT INTO chats(id, name, type, is_notes) VALUES (10, 'Call chat', '${type}', 0);
    INSERT INTO chat_members(chat_id, user_id) VALUES (10, 1), (10, 2);
  `);
}

function seedCall(db) {
  const messageId = Number(db.prepare(`
    INSERT INTO messages(chat_id, user_id, text)
    VALUES(10, 1, 'Video call')
  `).run().lastInsertRowid);
  const callId = Number(db.prepare(`
    INSERT INTO call_sessions(chat_id, livekit_room_name, status, started_by, message_id, ring_expires_at)
    VALUES(10, 'room-1', 'active', 1, ?, ?)
  `).run(messageId, new Date(Date.now() - 1000).toISOString()).lastInsertRowid);
  db.prepare(`
    INSERT INTO call_messages(message_id, call_id, status, started_by, started_at)
    VALUES(?, ?, 'active', 1, datetime('now'))
  `).run(messageId, callId);
  db.prepare(`
    INSERT INTO call_participants(call_id, user_id, state, joined_at)
    VALUES(?, 1, 'joined', datetime('now')), (?, 2, 'invited', NULL)
  `).run(callId, callId);
  return { callId, messageId };
}

test('ring timeout marks unanswered private calls as missed and updates call card metadata', () => {
  const db = createDb();
  const feature = createFeature(db);
  try {
    seedUsersAndChat(db, 'private');
    const { callId, messageId } = seedCall(db);

    assert.equal(feature._private.expireRingingCalls(), 1);

    const call = db.prepare('SELECT status, ended_reason, duration_ms FROM call_sessions WHERE id=?').get(callId);
    assert.equal(call.status, 'missed');
    assert.equal(call.ended_reason, 'missed');
    assert.equal(typeof call.duration_ms, 'number');
    assert.equal(db.prepare('SELECT state FROM call_participants WHERE call_id=? AND user_id=2').get(callId).state, 'missed');

    const card = db.prepare('SELECT status, duration_ms FROM call_messages WHERE message_id=?').get(messageId);
    assert.equal(card.status, 'missed');
    assert.equal(typeof card.duration_ms, 'number');
  } finally {
    feature.stopWorkers();
    db.close();
  }
});

test('ring timeout marks unanswered group participants missed without ending joined group call', () => {
  const db = createDb();
  const feature = createFeature(db);
  try {
    seedUsersAndChat(db, 'group');
    const { callId } = seedCall(db);

    assert.equal(feature._private.expireRingingCalls(), 1);

    assert.equal(db.prepare('SELECT status FROM call_sessions WHERE id=?').get(callId).status, 'active');
    assert.equal(db.prepare('SELECT ring_expires_at FROM call_sessions WHERE id=?').get(callId).ring_expires_at, null);
    assert.equal(db.prepare('SELECT state FROM call_participants WHERE call_id=? AND user_id=2').get(callId).state, 'missed');
  } finally {
    feature.stopWorkers();
    db.close();
  }
});

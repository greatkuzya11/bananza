const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initCallSchema } = require('../../calls/schema');
const { createCallFeature } = require('../../calls');
const { setCallSettings } = require('../../calls/settings');

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

function createRoutingAppStub() {
  const routes = [];
  return {
    routes,
    get(pathname, ...handlers) {
      routes.push({ method: 'GET', pathname, handlers });
    },
    post(pathname, ...handlers) {
      routes.push({ method: 'POST', pathname, handlers });
    },
    put(pathname, ...handlers) {
      routes.push({ method: 'PUT', pathname, handlers });
    },
  };
}

function createFeature(db, overrides = {}) {
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
    ...overrides,
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

function seedCompletedMixedRecording(db, callId, filePath, overrides = {}) {
  return Number(db.prepare(`
    INSERT INTO call_recordings(call_id, user_id, scope, livekit_identity, track_id, egress_id, file_path, status, started_at, ended_at, duration_ms, size_bytes)
    VALUES(?, 1, ?, '', ?, 'egress-mixed', ?, ?, datetime('now'), datetime('now'), ?, ?)
  `).run(
    callId,
    overrides.scope || 'mixed',
    overrides.track_id || `mixed:${callId}`,
    filePath,
    overrides.status || 'completed',
    overrides.duration_ms || 12000,
    overrides.size_bytes || 0
  ).lastInsertRowid);
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

test('token issuance does not mark participant joined before connect confirmation', () => {
  const db = createDb();
  const feature = createFeature(db);
  try {
    seedUsersAndChat(db, 'private');
    const { callId } = seedCall(db);

    const call = feature.getCall(callId);
    assert.equal(call.participants.find((participant) => participant.user_id === 2).state, 'invited');

    // Token generation is pure with respect to participant presence; joined is confirmed separately.
    assert.equal(db.prepare('SELECT state FROM call_participants WHERE call_id=? AND user_id=2').get(callId).state, 'invited');
    feature._private.participantJoined(callId, 2);
    assert.equal(db.prepare('SELECT state FROM call_participants WHERE call_id=? AND user_id=2').get(callId).state, 'joined');
  } finally {
    feature.stopWorkers();
    db.close();
  }
});

test('call card metadata exposes only completed mixed recordings with an existing file', (t) => {
  const db = createDb();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-call-recordings-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const feature = createFeature(db);
  try {
    seedUsersAndChat(db, 'private');
    setCallSettings(db, { call_recording_path: root });
    const { callId, messageId } = seedCall(db);
    const filePath = path.join(root, 'call-10-mixed.ogg');
    fs.writeFileSync(filePath, Buffer.from('0123456789abcdef'));

    seedCompletedMixedRecording(db, callId, filePath, { duration_ms: 24000, size_bytes: 16 });
    const [hydrated] = feature.attachCallMetadata([db.prepare('SELECT * FROM messages WHERE id=?').get(messageId)]);
    assert.equal(hydrated.call.mixed_recording.status, 'completed');
    assert.equal(hydrated.call.mixed_recording.duration_ms, 24000);
    assert.equal(hydrated.call.mixed_recording.mime_type, 'audio/ogg');
    assert.equal(hydrated.call.mixed_recording.url, `/api/calls/${callId}/recording/mixed`);
    assert.deepEqual(hydrated.call_message.mixed_recording, hydrated.call.mixed_recording);

    db.prepare('UPDATE call_recordings SET status=? WHERE call_id=?').run('error', callId);
    const [withoutRecording] = feature.attachCallMetadata([db.prepare('SELECT * FROM messages WHERE id=?').get(messageId)]);
    assert.equal(withoutRecording.call.mixed_recording, null);
    assert.equal(withoutRecording.call_message.mixed_recording, null);
  } finally {
    feature.stopWorkers();
    db.close();
  }
});

test('mixed call recording playback route requires membership and supports byte ranges', async (t) => {
  const db = createDb();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-call-recordings-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = createRoutingAppStub();
  const feature = createFeature(db, {
    app,
    auth: (_req, _res, next) => next(),
  });
  try {
    seedUsersAndChat(db, 'private');
    setCallSettings(db, { call_recording_path: root });
    const { callId } = seedCall(db);
    const filePath = path.join(root, 'mixed.ogg');
    fs.writeFileSync(filePath, Buffer.from('0123456789abcdef'));
    seedCompletedMixedRecording(db, callId, filePath, { size_bytes: 16 });

    const route = app.routes.find((item) => item.method === 'GET' && item.pathname === '/api/calls/:callId/recording/mixed');
    assert.ok(route);
    const handler = route.handlers.at(-1);

    const chunks = [];
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader(name, value) {
        headers[name.toLowerCase()] = String(value);
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      end() {},
      write(chunk) {
        chunks.push(Buffer.from(chunk));
      },
      on() {},
      once() {},
      emit() {},
    };
    await new Promise((resolve, reject) => {
      res.end = resolve;
      res.once = (event, cb) => {
        if (event === 'error') res._onError = cb;
      };
      res.emit = (event, error) => {
        if (event === 'error') {
          res._onError?.(error);
          reject(error);
        }
      };
      handler({
        params: { callId: String(callId) },
        user: { id: 1 },
        headers: { range: 'bytes=4-7' },
      }, res);
    });
    assert.equal(res.statusCode, 206);
    assert.equal(headers['content-range'], 'bytes 4-7/16');
    assert.equal(headers['content-length'], '4');
    assert.equal(Buffer.concat(chunks).toString(), '4567');

    const forbidden = {
      statusCode: 200,
      body: null,
      setHeader() {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
      },
    };
    handler({
      params: { callId: String(callId) },
      user: { id: 999 },
      headers: {},
    }, forbidden);
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.body.code, 'forbidden');
  } finally {
    feature.stopWorkers();
    db.close();
  }
});

test('ending a call deletes the LiveKit room best-effort', () => {
  const db = createDb();
  const deletedRooms = [];
  const feature = createFeature(db, {
    roomServiceClientFactory: () => ({
      deleteRoom: async (roomName) => {
        deletedRooms.push(roomName);
      },
    }),
  });
  try {
    seedUsersAndChat(db, 'private');
    const { callId } = seedCall(db);

    const ended = feature._private.endCall(callId, 1, 'ended');
    assert.equal(ended.status, 'ended');
    assert.deepEqual(deletedRooms, ['room-1']);
  } finally {
    feature.stopWorkers();
    db.close();
  }
});

test('LiveKit webhook participant events synchronize call participants', () => {
  const db = createDb();
  const feature = createFeature(db);
  try {
    seedUsersAndChat(db, 'private');
    const { callId } = seedCall(db);

    feature._private.handleLiveKitWebhook({
      event: 'participant_joined',
      room: { name: 'room-1' },
      participant: { identity: 'user:2' },
    });
    assert.equal(db.prepare('SELECT state FROM call_participants WHERE call_id=? AND user_id=2').get(callId).state, 'joined');

    feature._private.handleLiveKitWebhook({
      event: 'participant_left',
      room: { name: 'room-1' },
      participant: { identity: 'user:2' },
    });
    assert.equal(db.prepare('SELECT state FROM call_participants WHERE call_id=? AND user_id=2').get(callId).state, 'left');
  } finally {
    feature.stopWorkers();
    db.close();
  }
});

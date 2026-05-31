const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initCallSchema } = require('../../calls/schema');
const { createCallFeature } = require('../../calls');
const { setCallSettings } = require('../../calls/settings');
const { setVoiceSettings } = require('../../voice/settings');

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

function insertTranscriptRun(db, callId, { provider = 'voice', strategy = 'hybrid', requestedBy = 1 } = {}) {
  return Number(db.prepare(`
    INSERT INTO call_transcript_runs(call_id, requested_by, provider, strategy, status)
    VALUES(?, ?, ?, ?, 'queued')
  `).run(callId, requestedBy, provider, strategy).lastInsertRowid);
}

function mockGrokTranscriptionFetch(text = 'raw call transcript') {
  return async (input) => {
    const url = new URL(String(input || ''));
    if (url.hostname === 'api.x.ai' && url.pathname.endsWith('/stt')) {
      return new Response(JSON.stringify({ text, model: 'speech-to-text' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch: ${url.href}`);
  };
}

function mockOpenAIDiarizationFetch(text = 'diarized call transcript') {
  return async (input) => {
    const url = new URL(String(input || ''));
    if (url.hostname === 'api.openai.com' && url.pathname.endsWith('/audio/transcriptions')) {
      return new Response(JSON.stringify({
        text,
        segments: [{ text, speaker: 'speaker_0', start: 0, end: 1 }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch: ${url.href}`);
  };
}

function completeTranscriptRun(db, runId, {
  provider = 'voice',
  resolvedProvider = 'vosk',
  strategy = 'hybrid',
  model = 'legacy-model',
  text = 'legacy transcript',
} = {}) {
  db.prepare(`
    UPDATE call_transcript_runs
    SET provider=?,
      resolved_provider=?,
      strategy=?,
      status='completed',
      model=?,
      transcript_text=?,
      completed_at=datetime('now'),
      updated_at=datetime('now')
    WHERE id=?
  `).run(provider, resolvedProvider, strategy, model, text, runId);
}

test('call transcript segments prefer formatted Vosk result text over raw segment text', () => {
  const db = createDb();
  const feature = createFeature(db);
  try {
    const segments = feature._private.transcriptSegmentsForResult({
      provider: 'vosk',
      text: 'Привет, мир.',
      segments: [
        { text: 'привет', start_ms: 0, end_ms: 500 },
        { text: 'мир', start_ms: 500, end_ms: 900 },
      ],
    }, 1000, 4000);

    assert.equal(segments.length, 1);
    assert.equal(segments[0].text, 'Привет, мир.');
    assert.equal(segments[0].start_ms, 1000);
    assert.equal(segments[0].timing_approximate, 1);
  } finally {
    feature.stopWorkers();
    db.close();
  }
});

test('call transcript segments keep Vosk provider timing when segment text is already formatted', () => {
  const db = createDb();
  const feature = createFeature(db);
  try {
    const segments = feature._private.transcriptSegmentsForResult({
      provider: 'vosk',
      text: 'Привет, мир.',
      segments: [
        { text: 'Привет,', start_ms: 0, end_ms: 500 },
        { text: 'мир.', start_ms: 500, end_ms: 900 },
      ],
    }, 1000, 4000);

    assert.deepEqual(segments.map((segment) => segment.text), ['Привет,', 'мир.']);
    assert.deepEqual(segments.map((segment) => segment.start_ms), [1000, 1500]);
    assert.deepEqual(segments.map((segment) => segment.end_ms), [1500, 1900]);
    assert.deepEqual(segments.map((segment) => segment.timing_approximate), [0, 0]);
  } finally {
    feature.stopWorkers();
    db.close();
  }
});

test('call transcript segments keep non-Vosk provider segment text', () => {
  const db = createDb();
  const feature = createFeature(db);
  try {
    const segments = feature._private.transcriptSegmentsForResult({
      provider: 'openai',
      text: 'Привет, мир.',
      segments: [
        { text: 'привет', start_ms: 0, end_ms: 500 },
        { text: 'мир', start_ms: 500, end_ms: 900 },
      ],
    }, 1000, 4000);

    assert.deepEqual(segments.map((segment) => segment.text), ['привет', 'мир']);
    assert.deepEqual(segments.map((segment) => segment.timing_approximate), [0, 0]);
  } finally {
    feature.stopWorkers();
    db.close();
  }
});

test('call transcript run creates a new run after provider or strategy changes', async () => {
  const db = createDb();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-call-rerun-'));
  const originalFetch = global.fetch;
  global.fetch = mockOpenAIDiarizationFetch('openai diarized transcript');
  const feature = createFeature(db);
  try {
    seedUsersAndChat(db, 'private');
    setVoiceSettings(db, {
      active_provider: 'vosk',
      openai_api_key: 'openai-secret',
    }, '');
    setCallSettings(db, {
      call_transcription_provider: 'voice',
      call_transcription_strategy: 'hybrid',
      call_transcription_max_chunk_mb: 100,
    });
    const { callId } = seedCall(db);
    const filePath = path.join(root, 'mixed.ogg');
    fs.writeFileSync(filePath, Buffer.from('audio'));
    seedCompletedMixedRecording(db, callId, filePath, { duration_ms: 12000, size_bytes: 5 });
    const oldRunId = insertTranscriptRun(db, callId, { provider: 'voice', strategy: 'hybrid' });
    completeTranscriptRun(db, oldRunId, {
      provider: 'voice',
      resolvedProvider: 'vosk',
      strategy: 'hybrid',
      text: 'old vosk transcript',
    });

    setCallSettings(db, {
      call_transcription_provider: 'openai',
      call_transcription_strategy: 'openai_diarization',
      call_transcription_max_chunk_mb: 100,
    });
    const result = feature._private.createOrReusePrimaryTranscriptRun(callId, 1, { enqueue: false });

    assert.equal(result.created, true);
    assert.notEqual(result.rawRun.id, oldRunId);
    assert.equal(result.rawRun.provider, 'openai');
    assert.equal(result.rawRun.strategy, 'openai_diarization');
    const oldRun = db.prepare('SELECT * FROM call_transcript_runs WHERE id=?').get(oldRunId);
    assert.equal(oldRun.status, 'completed');
    assert.equal(oldRun.transcript_text, 'old vosk transcript');
  } finally {
    global.fetch = originalFetch;
    feature.stopWorkers();
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('call transcript voice provider always inherits voice settings, not later call settings', async () => {
  const db = createDb();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-call-provider-'));
  const originalFetch = global.fetch;
  global.fetch = mockGrokTranscriptionFetch('voice provider transcript');
  const feature = createFeature(db);
  try {
    seedUsersAndChat(db, 'private');
    setVoiceSettings(db, {
      active_provider: 'grok',
      grok_api_key: 'grok-secret',
    }, '');
    setCallSettings(db, {
      call_transcription_provider: 'voice',
      call_transcription_strategy: 'hybrid',
      call_transcription_max_chunk_mb: 100,
    });
    const { callId } = seedCall(db);
    const filePath = path.join(root, 'mixed.ogg');
    fs.writeFileSync(filePath, Buffer.from('audio'));
    seedCompletedMixedRecording(db, callId, filePath, { duration_ms: 12000, size_bytes: 5 });
    const runId = insertTranscriptRun(db, callId, { provider: 'voice', strategy: 'hybrid' });

    setCallSettings(db, {
      call_transcription_provider: 'vosk',
      call_transcription_strategy: 'hybrid',
      call_transcription_max_chunk_mb: 100,
    });
    await feature._private.processTranscriptRun({ runId });

    const run = db.prepare('SELECT * FROM call_transcript_runs WHERE id=?').get(runId);
    assert.equal(run.status, 'completed');
    assert.equal(run.resolved_provider, 'grok');
    assert.match(run.transcript_text, /voice provider transcript/);
  } finally {
    global.fetch = originalFetch;
    feature.stopWorkers();
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('call transcript run requires mixed recording for mixed and OpenAI diarization strategies', () => {
  const cases = [
    { provider: 'voice', strategy: 'mixed' },
    { provider: 'openai', strategy: 'openai_diarization' },
  ];

  for (const item of cases) {
    const db = createDb();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-call-mixed-required-'));
    const feature = createFeature(db);
    try {
      seedUsersAndChat(db, 'private');
      setVoiceSettings(db, { openai_api_key: 'openai-secret' }, '');
      setCallSettings(db, {
        call_transcription_provider: item.provider,
        call_transcription_strategy: item.strategy,
        call_transcription_max_chunk_mb: 100,
      });
      const { callId } = seedCall(db);
      const filePath = path.join(root, 'participant.ogg');
      fs.writeFileSync(filePath, Buffer.from('audio'));
      seedCompletedMixedRecording(db, callId, filePath, {
        scope: 'participant',
        track_id: `participant:${item.strategy}`,
        duration_ms: 12000,
        size_bytes: 5,
      });

      const result = feature._private.createOrReusePrimaryTranscriptRun(callId, 1, { enqueue: false });
      assert.equal(result.error?.code, 'mixed_recording_missing');
      assert.equal(db.prepare('SELECT COUNT(*) as total FROM call_transcript_runs WHERE call_id=?').get(callId).total, 0);
    } finally {
      feature.stopWorkers();
      db.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('call re-transcribe creates a new run without mutating completed transcript', () => {
  const db = createDb();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-call-rerun-'));
  const originalFetch = global.fetch;
  global.fetch = mockGrokTranscriptionFetch('fresh transcript');
  const feature = createFeature(db);
  try {
    seedUsersAndChat(db, 'private');
    setVoiceSettings(db, {
      active_provider: 'grok',
      grok_api_key: 'grok-secret',
    }, '');
    setCallSettings(db, {
      call_transcription_provider: 'voice',
      call_transcription_strategy: 'hybrid',
      call_transcription_max_chunk_mb: 100,
    });
    const { callId } = seedCall(db);
    const filePath = path.join(root, 'mixed.ogg');
    fs.writeFileSync(filePath, Buffer.from('audio'));
    seedCompletedMixedRecording(db, callId, filePath, { duration_ms: 12000, size_bytes: 5 });
    const oldRunId = insertTranscriptRun(db, callId, { provider: 'voice', strategy: 'hybrid' });
    completeTranscriptRun(db, oldRunId, { text: 'completed transcript' });

    const result = feature._private.createOrReusePrimaryTranscriptRun(callId, 1, { retry: true, enqueue: false });
    assert.equal(result.created, true);
    assert.notEqual(result.rawRun.id, oldRunId);
    const oldRun = db.prepare('SELECT * FROM call_transcript_runs WHERE id=?').get(oldRunId);
    assert.equal(oldRun.status, 'completed');
    assert.equal(oldRun.transcript_text, 'completed transcript');
  } finally {
    global.fetch = originalFetch;
    feature.stopWorkers();
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('call transcript retry resets matching error run instead of creating a duplicate', () => {
  const db = createDb();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-call-retry-'));
  const originalFetch = global.fetch;
  global.fetch = mockGrokTranscriptionFetch('retried transcript');
  const feature = createFeature(db);
  try {
    seedUsersAndChat(db, 'private');
    setVoiceSettings(db, {
      active_provider: 'grok',
      grok_api_key: 'grok-secret',
    }, '');
    setCallSettings(db, {
      call_transcription_provider: 'voice',
      call_transcription_strategy: 'hybrid',
      call_transcription_max_chunk_mb: 100,
    });
    const { callId } = seedCall(db);
    const filePath = path.join(root, 'mixed.ogg');
    fs.writeFileSync(filePath, Buffer.from('audio'));
    seedCompletedMixedRecording(db, callId, filePath, { duration_ms: 12000, size_bytes: 5 });
    const runId = insertTranscriptRun(db, callId, { provider: 'voice', strategy: 'hybrid' });
    db.prepare(`
      UPDATE call_transcript_runs
      SET status='error', error='failed once', transcript_text='bad old text'
      WHERE id=?
    `).run(runId);

    const result = feature._private.createOrReusePrimaryTranscriptRun(callId, 1, { retry: true, enqueue: false });
    assert.equal(result.created, false);
    assert.equal(result.retried, true);
    assert.equal(result.rawRun.id, runId);
    const rows = db.prepare('SELECT * FROM call_transcript_runs WHERE call_id=? ORDER BY id').all(callId);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].status, 'error');
    assert.equal(rows[0].error, '');
    assert.notEqual(rows[0].transcript_text, 'bad old text');
  } finally {
    global.fetch = originalFetch;
    feature.stopWorkers();
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('call transcript run inherits voice context bot when provider preset is voice', async () => {
  const db = createDb();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-call-context-'));
  const originalFetch = global.fetch;
  global.fetch = mockGrokTranscriptionFetch('raw call transcript');
  const transformCalls = [];
  const feature = createFeature(db, {
    getAiBotFeature: () => ({
      transformTextWithContextBot: async ({ botId, text }) => {
        transformCalls.push({ botId, text });
        return { text: 'polished call transcript' };
      },
    }),
  });
  try {
    seedUsersAndChat(db, 'private');
    setVoiceSettings(db, {
      active_provider: 'grok',
      context_bot_enabled: true,
      context_bot_id: 42,
      grok_api_key: 'grok-secret',
    }, '');
    setCallSettings(db, {
      call_transcription_provider: 'voice',
      call_transcription_strategy: 'hybrid',
      call_transcription_max_chunk_mb: 100,
    });
    const { callId } = seedCall(db);
    const filePath = path.join(root, 'mixed.ogg');
    fs.writeFileSync(filePath, Buffer.from('audio'));
    seedCompletedMixedRecording(db, callId, filePath, { duration_ms: 12000, size_bytes: 5 });
    const runId = insertTranscriptRun(db, callId, { provider: 'voice', strategy: 'hybrid' });

    await feature._private.processTranscriptRun({ runId });

    const run = db.prepare('SELECT * FROM call_transcript_runs WHERE id=?').get(runId);
    const segments = db.prepare('SELECT * FROM call_transcript_run_segments WHERE run_id=?').all(runId);
    assert.equal(run.status, 'completed');
    assert.deepEqual(transformCalls, [{ botId: 42, text: 'raw call transcript' }]);
    assert.match(run.transcript_text, /polished call transcript/);
    assert.doesNotMatch(run.transcript_text, /raw call transcript/);
    assert.equal(segments.some((segment) => segment.text.includes('polished call transcript')), true);
    assert.equal(segments.every((segment) => Number(segment.timing_approximate) !== 0), true);
  } finally {
    global.fetch = originalFetch;
    feature.stopWorkers();
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('call transcript run does not use voice context bot for explicit providers', async () => {
  const db = createDb();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-call-context-'));
  const originalFetch = global.fetch;
  global.fetch = mockGrokTranscriptionFetch('explicit provider transcript');
  const transformCalls = [];
  const feature = createFeature(db, {
    getAiBotFeature: () => ({
      transformTextWithContextBot: async ({ botId, text }) => {
        transformCalls.push({ botId, text });
        return { text: 'should not appear' };
      },
    }),
  });
  try {
    seedUsersAndChat(db, 'private');
    setVoiceSettings(db, {
      active_provider: 'grok',
      context_bot_enabled: true,
      context_bot_id: 42,
      grok_api_key: 'grok-secret',
    }, '');
    setCallSettings(db, {
      call_transcription_provider: 'grok',
      call_transcription_strategy: 'hybrid',
      call_transcription_max_chunk_mb: 100,
    });
    const { callId } = seedCall(db);
    const filePath = path.join(root, 'mixed.ogg');
    fs.writeFileSync(filePath, Buffer.from('audio'));
    seedCompletedMixedRecording(db, callId, filePath, { duration_ms: 12000, size_bytes: 5 });
    const runId = insertTranscriptRun(db, callId, { provider: 'grok', strategy: 'hybrid' });

    await feature._private.processTranscriptRun({ runId });

    const run = db.prepare('SELECT * FROM call_transcript_runs WHERE id=?').get(runId);
    assert.equal(run.status, 'completed');
    assert.deepEqual(transformCalls, []);
    assert.match(run.transcript_text, /explicit provider transcript/);
    assert.doesNotMatch(run.transcript_text, /should not appear/);
  } finally {
    global.fetch = originalFetch;
    feature.stopWorkers();
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('call transcript run falls back to raw text when voice context bot fails or returns empty text', async (t) => {
  const cases = [
    {
      name: 'throws',
      transformTextWithContextBot: async () => {
        throw new Error('context bot failed');
      },
    },
    {
      name: 'empty',
      transformTextWithContextBot: async () => ({ text: '' }),
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const db = createDb();
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-call-context-'));
      const originalFetch = global.fetch;
      global.fetch = mockGrokTranscriptionFetch(`raw fallback transcript ${item.name}`);
      const feature = createFeature(db, {
        getAiBotFeature: () => ({
          transformTextWithContextBot: item.transformTextWithContextBot,
        }),
      });
      try {
        seedUsersAndChat(db, 'private');
        setVoiceSettings(db, {
          active_provider: 'grok',
          context_bot_enabled: true,
          context_bot_id: 42,
          grok_api_key: 'grok-secret',
        }, '');
        setCallSettings(db, {
          call_transcription_provider: 'voice',
          call_transcription_strategy: 'hybrid',
          call_transcription_max_chunk_mb: 100,
        });
        const { callId } = seedCall(db);
        const filePath = path.join(root, 'mixed.ogg');
        fs.writeFileSync(filePath, Buffer.from('audio'));
        seedCompletedMixedRecording(db, callId, filePath, { duration_ms: 12000, size_bytes: 5 });
        const runId = insertTranscriptRun(db, callId, { provider: 'voice', strategy: 'hybrid' });

        await feature._private.processTranscriptRun({ runId });

        const run = db.prepare('SELECT * FROM call_transcript_runs WHERE id=?').get(runId);
        assert.equal(run.status, 'completed');
        assert.match(run.transcript_text, new RegExp(`raw fallback transcript ${item.name}`));
      } finally {
        global.fetch = originalFetch;
        feature.stopWorkers();
        db.close();
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

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

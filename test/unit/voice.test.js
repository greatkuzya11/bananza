const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { attachVoiceMetadata } = require('../../voice/messageMeta');
const { AsyncJobQueue } = require('../../voice/queue');
const { transcribeAudio, testProviderModel } = require('../../voice/providers');
const {
  buildDraftSettings,
  DEFAULT_VOICE_SETTINGS,
  getAdminVoiceSettings,
  getGrokKey,
  getOpenAIKey,
  getPublicVoiceSettings,
  setVoiceSettings,
} = require('../../voice/settings');

function createVoiceDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
    CREATE TABLE voice_messages (
      message_id INTEGER PRIMARY KEY,
      duration_ms INTEGER,
      sample_rate INTEGER,
      transcription_status TEXT,
      transcription_text TEXT,
      transcription_provider TEXT,
      transcription_model TEXT,
      transcription_error TEXT,
      auto_requested INTEGER,
      note_kind TEXT,
      transcription_file_id INTEGER,
      shape_id TEXT,
      shape_snapshot TEXT
    );
  `);
  return db;
}

test('voice settings encrypt keys and expose admin/public views safely', () => {
  const db = createVoiceDb();
  const secret = 'voice-secret';
  const saved = setVoiceSettings(db, {
    voice_notes_enabled: true,
    auto_transcribe_on_send: true,
    active_provider: 'grok',
    openai_api_key: 'sk-openai-secret',
    grok_api_key: 'grok-secret-key',
  }, secret);

  assert.equal(saved.voice_notes_enabled, true);
  assert.equal(saved.has_openai_key, true);
  assert.equal(saved.has_grok_key, true);
  assert.equal(getOpenAIKey(db, secret), 'sk-openai-secret');
  assert.equal(getGrokKey(db, secret), 'grok-secret-key');
  assert.equal(getAdminVoiceSettings(db).masked_openai_key.length > 0, true);
  assert.deepEqual(getPublicVoiceSettings(db), {
    voice_notes_enabled: true,
    auto_transcribe_on_send: true,
    voice_note_ui_mode: DEFAULT_VOICE_SETTINGS.voice_note_ui_mode,
  });

  const draft = buildDraftSettings(db, { queue_concurrency: 10 }, secret);
  assert.equal(draft.queue_concurrency, 4);

  db.close();
});

test('attachVoiceMetadata decorates messages with voice and video note fields', () => {
  const db = createVoiceDb();
  db.prepare(`
    INSERT INTO voice_messages (
      message_id, duration_ms, sample_rate, transcription_status, transcription_text,
      transcription_provider, transcription_model, transcription_error, auto_requested,
      note_kind, transcription_file_id, shape_id, shape_snapshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    5,
    1400,
    16000,
    'completed',
    'Transcript',
    'openai',
    'gpt-4o-mini-transcribe',
    null,
    1,
    'video_note',
    88,
    'circle',
    JSON.stringify({
      id: 'circle',
      label: 'Circle',
      viewBox: '0 0 320 220',
      path: 'M0 0 L10 10 Z',
    })
  );

  const [message] = attachVoiceMetadata(db, [{ id: 5, text: null }]);
  assert.equal(message.is_voice_note, true);
  assert.equal(message.transcription_text, 'Transcript');
  assert.equal(message.is_video_note, true);
  assert.equal(message.video_note_shape_id, 'circle');

  db.close();
});

test('AsyncJobQueue deduplicates keys and honors concurrency getter', async () => {
  const events = [];
  const queue = new AsyncJobQueue({
    getConcurrency: () => 1,
    async handler(payload) {
      events.push(`start:${payload}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push(`end:${payload}`);
    },
  });

  assert.equal(queue.enqueue('a', 'first'), true);
  assert.equal(queue.enqueue('a', 'duplicate'), false);
  assert.equal(queue.enqueue('b', 'second'), true);

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(events, ['start:first', 'end:first', 'start:second', 'end:second']);
});

test('voice providers use fallback to OpenAI when primary provider fails', async (t) => {
  const tempFile = path.join(os.tmpdir(), `bananza-voice-${Date.now()}.wav`);
  fs.writeFileSync(tempFile, 'voice');
  t.after(() => {
    fs.rmSync(tempFile, { force: true });
  });

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/transcribe')) {
      throw new Error('Vosk helper is unavailable');
    }
    if (href.includes('api.openai.com')) {
      return new Response(JSON.stringify({ text: 'Fallback transcript' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch ${href}`);
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const result = await transcribeAudio({
    filePath: tempFile,
    settings: {
      active_provider: 'vosk',
      fallback_to_openai: true,
      vosk_helper_url: 'http://127.0.0.1:2700',
      vosk_model: 'vosk-model-small-ru-0.22',
      openai_model: 'gpt-4o-mini-transcribe',
      openai_language: 'ru',
      transcription_timeout_ms: 5000,
    },
    apiKey: 'sk-openai',
    grokApiKey: '',
  });

  assert.equal(result.provider, 'openai');
  assert.equal(result.text, 'Fallback transcript');
});

test('testProviderModel returns Grok transcription payload', async (t) => {
  const tempFile = path.join(os.tmpdir(), `bananza-grok-${Date.now()}.wav`);
  fs.writeFileSync(tempFile, 'voice');
  t.after(() => {
    fs.rmSync(tempFile, { force: true });
  });

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const href = String(url);
    if (href.includes('api.x.ai')) {
      return new Response(JSON.stringify({ text: 'Grok transcript', model: 'speech-to-text' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch ${href}`);
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const result = await testProviderModel({
    filePath: tempFile,
    settings: {
      active_provider: 'grok',
      grok_language: 'ru',
      transcription_timeout_ms: 5000,
    },
    apiKey: '',
    grokApiKey: 'grok-key',
  });

  assert.equal(result.provider, 'grok');
  assert.equal(result.text, 'Grok transcript');
});

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
    context_bot_enabled: true,
    context_bot_id: '42',
    openai_api_key: 'sk-openai-secret',
    grok_api_key: 'grok-secret-key',
  }, secret);

  assert.equal(saved.voice_notes_enabled, true);
  assert.equal(saved.context_bot_enabled, true);
  assert.equal(saved.context_bot_id, 42);
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
  const draftWithoutBot = buildDraftSettings(db, { context_bot_enabled: 'false', context_bot_id: 'bad' }, secret);
  assert.equal(draftWithoutBot.context_bot_enabled, false);
  assert.equal(draftWithoutBot.context_bot_id, null);
  const whisperDraft = buildDraftSettings(db, {
    active_provider: 'whisper',
    whisper_model: 'ggml-base-q5_1.bin',
    whisper_models_dir: '/opt/bananza/voice/models',
    whisper_language: 'ru',
  }, secret);
  assert.equal(whisperDraft.active_provider, 'whisper');
  assert.equal(whisperDraft.whisper_model, 'ggml-base-q5_1.bin');
  assert.equal(whisperDraft.whisper_models_dir, '/opt/bananza/voice/models');

  const invalidWhisperDraft = buildDraftSettings(db, { whisper_model: '../../large.bin' }, secret);
  assert.equal(invalidWhisperDraft.whisper_model, DEFAULT_VOICE_SETTINGS.whisper_model);

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

test('Vosk provider uploads audio bytes for remote helpers', async (t) => {
  const tempFile = path.join(os.tmpdir(), `bananza-remote-vosk-${Date.now()}.wav`);
  fs.writeFileSync(tempFile, 'voice');
  t.after(() => {
    fs.rmSync(tempFile, { force: true });
  });

  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const href = String(url);
    assert.equal(href, 'http://vosk.example.test:2700/transcribe-file');
    assert.equal(options.method, 'POST');
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get('model_name'), 'vosk-model-small-ru-0.22');
    assert.equal(options.body.get('model_path'), '');
    assert.equal(options.body.get('language_hint'), 'ru');
    assert.ok(options.body.get('file') instanceof Blob);
    return new Response(JSON.stringify({
      text: 'Remote transcript',
      model: 'vosk-model-small-ru-0.22',
      segments: [{ text: 'Remote transcript', start: 0, end: 1 }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const result = await transcribeAudio({
    filePath: tempFile,
    settings: {
      active_provider: 'vosk',
      fallback_to_openai: false,
      vosk_helper_url: 'http://vosk.example.test:2700',
      vosk_model: 'vosk-model-small-ru-0.22',
      vosk_model_path: '',
      openai_language: 'ru',
      transcription_timeout_ms: 5000,
    },
    apiKey: '',
    grokApiKey: '',
  });

  assert.equal(result.provider, 'vosk');
  assert.equal(result.text, 'Remote transcript');
});

test('Whisper provider loads the selected local model and returns timed segments', async (t) => {
  const tempFile = path.join(os.tmpdir(), `bananza-whisper-${Date.now()}.wav`);
  fs.writeFileSync(tempFile, 'voice');
  t.after(() => {
    fs.rmSync(tempFile, { force: true });
  });

  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const href = String(url);
    requests.push(href);
    assert.equal(options.method, 'POST');
    assert.ok(options.body instanceof FormData);
    if (href.endsWith('/load')) {
      assert.equal(options.body.get('model'), '/opt/bananza/voice/models/ggml-base.bin');
      return new Response('Load was successful!', { status: 200 });
    }
    if (href.endsWith('/inference')) {
      assert.equal(options.body.get('language'), 'ru');
      assert.equal(options.body.get('translate'), 'false');
      assert.equal(options.body.get('response_format'), 'verbose_json');
      assert.ok(options.body.get('file') instanceof Blob);
      return new Response(JSON.stringify({
        text: ' Whisper trans\ncript\n continues. ',
        segments: [{ text: 'Whisper transcript', start: 0.25, end: 1.5 }],
      }), {
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
      active_provider: 'whisper',
      fallback_to_openai: false,
      whisper_helper_url: 'http://whisper.example.test:2701',
      whisper_model: 'ggml-base.bin',
      whisper_models_dir: '/opt/bananza/voice/models',
      whisper_language: 'ru',
      transcription_timeout_ms: 5000,
    },
    apiKey: '',
    grokApiKey: '',
  });

  assert.deepEqual(requests, [
    'http://whisper.example.test:2701/load',
    'http://whisper.example.test:2701/inference',
  ]);
  assert.equal(result.provider, 'whisper');
  assert.equal(result.model, 'ggml-base.bin');
  assert.equal(result.text, 'Whisper transcript continues.');
  assert.deepEqual(result.segments, [{
    text: 'Whisper transcript',
    start_ms: 250,
    end_ms: 1500,
  }]);
});

test('Whisper provider rejects a model-load error returned with HTTP 200', async (t) => {
  const tempFile = path.join(os.tmpdir(), `bananza-whisper-load-error-${Date.now()}.wav`);
  fs.writeFileSync(tempFile, 'voice');
  t.after(() => {
    fs.rmSync(tempFile, { force: true });
  });

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.match(String(url), /\/load$/);
    return new Response(JSON.stringify({ error: 'model not found!' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  await assert.rejects(() => transcribeAudio({
    filePath: tempFile,
    settings: {
      active_provider: 'whisper',
      fallback_to_openai: false,
      whisper_helper_url: 'http://whisper.example.test:2701',
      whisper_model: 'ggml-tiny.bin',
      whisper_models_dir: '/missing',
      whisper_language: 'ru',
      transcription_timeout_ms: 5000,
    },
    apiKey: '',
    grokApiKey: '',
  }), /model not found/i);
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

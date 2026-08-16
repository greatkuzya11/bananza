const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { initTelegramTranscriptionSchema } = require('../../telegramTranscription/schema');
const {
  DEFAULT_SETTINGS,
  normalizeAllowedUserIds,
  setSettings,
  getBotToken,
  sanitizeSettings,
  buildProviderSettings,
  providerReadiness,
} = require('../../telegramTranscription/settings');
const { extractTelegramAudio, splitUnicodeText } = require('../../telegramTranscription/helpers');
const { createTelegramClient } = require('../../telegramTranscription/client');
const { createTelegramTranscriptionFeature, safeErrorMessage } = require('../../telegramTranscription');

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  initTelegramTranscriptionSchema(db);
  return db;
}

function fakeApp() {
  const routes = new Map();
  return {
    routes,
    get(route, ...handlers) { routes.set(`GET ${route}`, handlers.at(-1)); },
    put(route, ...handlers) { routes.set(`PUT ${route}`, handlers.at(-1)); },
    post(route, ...handlers) { routes.set(`POST ${route}`, handlers.at(-1)); },
    delete(route, ...handlers) { routes.set(`DELETE ${route}`, handlers.at(-1)); },
  };
}

test('Telegram settings encrypt token, normalize allowlist, and keep provider profile independent', () => {
  const db = createDb();
  const saved = setSettings(db, {
    enabled: true,
    bot_token: '123456:telegram-secret',
    allowed_user_ids: '900\n100, 900;bad',
    active_provider: 'openai',
    openai_model: 'gpt-4o-transcribe',
    openai_language: 'en',
    context_bot_enabled: true,
    context_bot_id: '42',
    max_file_size_bytes: 100 * 1024 * 1024,
  }, 'server-secret');

  assert.deepEqual(saved.allowed_user_ids, ['100', '900']);
  assert.equal(getBotToken(db, 'server-secret'), '123456:telegram-secret');
  assert.equal(sanitizeSettings(saved).has_bot_token, true);
  assert.equal(Object.hasOwn(sanitizeSettings(saved), 'bot_token_encrypted'), false);
  assert.equal(saved.max_file_size_bytes, 20 * 1024 * 1024);

  const provider = buildProviderSettings(saved, {
    active_provider: 'whisper',
    openai_model: 'voice-model',
    openai_language: 'ru',
    openai_key_encrypted: 'shared',
    whisper_helper_url: 'http://127.0.0.1:2701',
  });
  assert.equal(provider.active_provider, 'openai');
  assert.equal(provider.openai_model, 'gpt-4o-transcribe');
  assert.equal(provider.openai_language, 'en');
  assert.equal(provider.openai_key_encrypted, 'shared');
  const unavailableLocal = providerReadiness(saved, {
    whisper_helper_url: 'http://127.0.0.1:2701',
    vosk_helper_url: 'http://127.0.0.1:2700',
  }, { hasFfmpeg: false, hasOpenAIKey: true, hasGrokKey: false });
  assert.equal(unavailableLocal.whisper, false);
  assert.equal(unavailableLocal.vosk, false);
  assert.equal(unavailableLocal.ffmpeg, false);
  assert.equal(unavailableLocal.openai, true);
  db.close();
});

test('Telegram allowlist and media helpers accept intended audio only', () => {
  assert.deepEqual(normalizeAllowedUserIds(['2', 1, '2', '-1', 'hello']), ['1', '2']);
  const voice = extractTelegramAudio({ message_id: 7, voice: { file_id: 'voice-id', file_size: 123, duration: 4 } });
  assert.equal(voice.extension, '.ogg');
  assert.equal(voice.mime_type, 'audio/ogg');

  const audioDocument = extractTelegramAudio({
    message_id: 8,
    document: { file_id: 'doc-id', file_name: 'recording.M4A', mime_type: 'application/octet-stream' },
  });
  assert.equal(audioDocument.extension, '.m4a');
  assert.equal(extractTelegramAudio({ document: { file_id: 'pdf', file_name: 'x.pdf', mime_type: 'application/pdf' } }), null);
  assert.equal(extractTelegramAudio({ video_note: { file_id: 'video' } }), null);
});

test('Telegram text splitter preserves Unicode and stays within limits', () => {
  const source = `${'Привет 👋 '.repeat(700)}\n${'second '.repeat(700)}`.trim();
  const chunks = splitUnicodeText(source, 4000);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => Array.from(chunk).length <= 4000));
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').trim(), source.replace(/\s+/g, ' ').trim());
  assert.ok(chunks.every((chunk) => !chunk.includes('\uFFFD')));
});

test('Telegram client enforces actual streamed download size', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-telegram-client-test-'));
  const destination = path.join(tempDir, 'audio.ogg');
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const token = 'secret-token';
  const client = createTelegramClient(token, {
    fetchImpl: async (url) => {
      assert.ok(String(url).includes(token));
      return new Response(new Uint8Array(12), { status: 200 });
    },
  });

  await assert.rejects(() => client.downloadFile('voice/file.ogg', destination, 10), /configured limit/);
  assert.equal(fs.existsSync(destination), false);
  assert.doesNotMatch(safeErrorMessage(new Error(`failed https://api.telegram.org/bot${token}/getMe`)), new RegExp(token));
});

test('Telegram update is persisted with cursor before worker execution and duplicate is ignored', async () => {
  const db = createDb();
  setSettings(db, {
    ...DEFAULT_SETTINGS,
    allowed_user_ids: ['777'],
    active_provider: 'whisper',
  }, 'server-secret');
  const app = fakeApp();
  const feature = createTelegramTranscriptionFeature({
    app,
    db,
    auth: (_req, _res, next) => next(),
    adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret',
    getAiBotFeature: () => null,
  });
  feature.stop();

  const sent = [];
  const client = {
    async sendMessage(chatId, text, replyTo) {
      sent.push({ chatId, text, replyTo });
      return { message_id: 99 };
    },
  };
  const update = {
    update_id: 55,
    message: {
      message_id: 9,
      chat: { id: 777, type: 'private' },
      from: { id: 777, language_code: 'ru' },
      voice: { file_id: 'voice-file', file_unique_id: 'unique', file_size: 1024, duration: 2 },
    },
  };
  await feature.handleUpdate(update, client);
  await feature.handleUpdate(update, client);

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM telegram_transcription_jobs').get().count, 1);
  assert.equal(db.prepare('SELECT next_update_id FROM telegram_transcription_state WHERE id=1').get().next_update_id, 56);
  const job = db.prepare('SELECT * FROM telegram_transcription_jobs').get();
  assert.equal(job.status, 'queued');
  assert.equal(job.telegram_user_id, '777');
  assert.equal(sent.length, 0);
  db.close();
});

test('Telegram /start returns numeric ID before allowlist authorization', async () => {
  const db = createDb();
  const app = fakeApp();
  const feature = createTelegramTranscriptionFeature({
    app,
    db,
    auth: (_req, _res, next) => next(),
    adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret',
  });
  feature.stop();
  const sent = [];
  await feature.handleUpdate({
    update_id: 80,
    message: {
      message_id: 3,
      text: '/start',
      chat: { id: 555, type: 'private' },
      from: { id: 555, language_code: 'en' },
    },
  }, {
    async sendMessage(chatId, text, replyTo) {
      sent.push({ chatId, text, replyTo });
      return { message_id: 4 };
    },
  });
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /555/);
  assert.equal(db.prepare('SELECT next_update_id FROM telegram_transcription_state WHERE id=1').get().next_update_id, 81);
  db.close();
});

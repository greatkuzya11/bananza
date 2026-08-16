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
    image_generation_enabled: true,
    image_bot_id: '77',
    max_file_size_bytes: 100 * 1024 * 1024,
  }, 'server-secret');

  assert.deepEqual(saved.allowed_user_ids, ['100', '900']);
  assert.equal(getBotToken(db, 'server-secret'), '123456:telegram-secret');
  assert.equal(sanitizeSettings(saved).has_bot_token, true);
  assert.equal(Object.hasOwn(sanitizeSettings(saved), 'bot_token_encrypted'), false);
  assert.equal(saved.max_file_size_bytes, 20 * 1024 * 1024);
  assert.equal(saved.image_generation_enabled, true);
  assert.equal(saved.image_bot_id, 77);

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

test('Telegram client uploads generated images with multipart form data', async () => {
  const requests = [];
  const client = createTelegramClient('secret-token', {
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 15 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  await client.sendPhoto('777', Buffer.from('image-bytes'), {
    fileName: 'result.png',
    mimeType: 'image/png',
    replyToMessageId: 9,
  });
  assert.match(requests[0].url, /\/sendPhoto$/);
  assert.ok(requests[0].options.body instanceof FormData);
  assert.equal(requests[0].options.body.get('chat_id'), '777');
  assert.deepEqual(JSON.parse(requests[0].options.body.get('reply_parameters')), { message_id: 9 });
  assert.equal(requests[0].options.body.get('photo').name, 'result.png');
});

test('Telegram update is persisted with cursor before worker execution and duplicate is ignored', async () => {
  const db = createDb();
  setSettings(db, {
    ...DEFAULT_SETTINGS,
    enabled: true,
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

test('Telegram text prompt is persisted once for the selected image bot before worker execution', async () => {
  const db = createDb();
  setSettings(db, {
    ...DEFAULT_SETTINGS,
    image_generation_enabled: true,
    image_bot_id: 91,
    allowed_user_ids: ['777'],
  }, 'server-secret');
  const app = fakeApp();
  const feature = createTelegramTranscriptionFeature({
    app,
    db,
    auth: (_req, _res, next) => next(),
    adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret',
    getAiBotFeature: () => ({
      listTelegramImageBots: () => [{
        id: 91,
        name: 'Painter',
        provider: 'openai',
        image_model: 'gpt-image-2',
        enabled: true,
        provider_enabled: true,
        allow_image_generate: true,
      }],
    }),
  });
  feature.stop();
  const update = {
    update_id: 90,
    message: {
      message_id: 12,
      text: 'Нарисуй банан на синем фоне',
      chat: { id: 777, type: 'private' },
      from: { id: 777, language_code: 'ru' },
    },
  };
  const client = { async sendMessage() { return { message_id: 13 }; } };
  await feature.handleUpdate(update, client);
  await feature.handleUpdate(update, client);

  const rows = db.prepare('SELECT * FROM telegram_image_generation_jobs').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].prompt_text, 'Нарисуй банан на синем фоне');
  assert.equal(rows[0].image_bot_id, 91);
  assert.equal(rows[0].status, 'queued');
  assert.equal(db.prepare('SELECT next_update_id FROM telegram_transcription_state WHERE id=1').get().next_update_id, 91);
  db.close();
});

test('Telegram image worker persists delivery bytes, sends photo, and clears transient payloads', async () => {
  const db = createDb();
  setSettings(db, {
    ...DEFAULT_SETTINGS,
    bot_token: '123456:image-worker-token',
    image_generation_enabled: true,
    image_bot_id: 91,
    allowed_user_ids: ['777'],
  }, 'server-secret');
  const telegramCalls = [];
  let generationCalls = 0;
  const imageBot = {
    id: 91,
    name: 'Painter',
    provider: 'openai',
    image_model: 'gpt-image-2',
    enabled: true,
    provider_enabled: true,
    allow_image_generate: true,
  };
  const feature = createTelegramTranscriptionFeature({
    app: fakeApp(),
    db,
    auth: (_req, _res, next) => next(),
    adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret',
    getAiBotFeature: () => ({
      listTelegramImageBots: () => [imageBot],
      async generateTelegramImage() {
        generationCalls += 1;
        return {
          buffer: Buffer.from('generated-png'),
          mimeType: 'image/png',
          filename: 'generated.png',
          provider: 'openai',
          model: 'gpt-image-2',
        };
      },
    }),
    fetchImpl: async (url, options) => {
      telegramCalls.push({ url: String(url), options });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 200 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  feature.stop();
  await feature.handleUpdate({
    update_id: 101,
    message: {
      message_id: 22,
      text: 'banana poster',
      chat: { id: 777, type: 'private' },
      from: { id: 777, language_code: 'en' },
    },
  }, { async sendMessage() { return { message_id: 23 }; } });

  const queued = db.prepare('SELECT * FROM telegram_image_generation_jobs WHERE update_id=101').get();
  await feature.processImageJob(queued);

  const completed = db.prepare('SELECT * FROM telegram_image_generation_jobs WHERE update_id=101').get();
  assert.equal(generationCalls, 1);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.prompt_text, null);
  assert.equal(completed.image_data, null);
  assert.equal(completed.generation_provider, 'openai');
  assert.equal(completed.generation_model, 'gpt-image-2');
  assert.ok(telegramCalls.some((call) => /\/sendMessage$/.test(call.url)));
  assert.ok(telegramCalls.some((call) => /\/sendPhoto$/.test(call.url)));
  assert.ok(telegramCalls.some((call) => /\/deleteMessage$/.test(call.url)));
  db.close();
});

test('Telegram image delivery resumes from persisted bytes without regenerating and falls back to document', async () => {
  const db = createDb();
  setSettings(db, {
    ...DEFAULT_SETTINGS,
    bot_token: '123456:restart-token',
    image_generation_enabled: true,
    image_bot_id: 91,
    allowed_user_ids: ['777'],
  }, 'server-secret');
  db.prepare(`
    INSERT INTO telegram_image_generation_jobs(
      update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
      language_code, prompt_text, image_bot_id, image_bot_name, status,
      status_message_id, image_data, image_mime_type, image_file_name
    ) VALUES(202, '777', '777', 33, 'en', 'persisted prompt', 91, 'Painter',
      'delivering', 34, ?, 'image/webp', 'persisted.webp')
  `).run(Buffer.from('persisted-image'));
  let generationCalls = 0;
  const telegramCalls = [];
  const feature = createTelegramTranscriptionFeature({
    app: fakeApp(),
    db,
    auth: (_req, _res, next) => next(),
    adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret',
    getAiBotFeature: () => ({
      listTelegramImageBots: () => [],
      async generateTelegramImage() { generationCalls += 1; },
    }),
    fetchImpl: async (url, options) => {
      telegramCalls.push({ url: String(url), options });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 203 } }), { status: 200 });
    },
  });
  feature.stop();

  const recovered = db.prepare('SELECT * FROM telegram_image_generation_jobs WHERE update_id=202').get();
  assert.equal(recovered.status, 'queued');
  await feature.processImageJob(recovered);

  const completed = db.prepare('SELECT * FROM telegram_image_generation_jobs WHERE update_id=202').get();
  assert.equal(generationCalls, 0);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.prompt_text, null);
  assert.equal(completed.image_data, null);
  assert.ok(telegramCalls.some((call) => /\/sendDocument$/.test(call.url)));
  assert.ok(telegramCalls.every((call) => !/\/sendPhoto$/.test(call.url)));
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

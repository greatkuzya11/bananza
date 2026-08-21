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
  createBot,
  listBots,
  readBot,
  getBotToken,
  sanitizeBot,
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

function setSettings(db, incoming, secret) {
  return createBot(db, {
    ...incoming,
    name: incoming.name || 'Test Telegram bot',
    transcription_enabled: incoming.enabled ?? incoming.transcription_enabled ?? false,
  }, secret);
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
  assert.equal(sanitizeBot(saved).has_bot_token, true);
  assert.equal(Object.hasOwn(sanitizeBot(saved), 'bot_token_encrypted'), false);
  assert.equal(saved.max_file_size_bytes, 20 * 1024 * 1024);
  assert.equal(saved.image_generation_enabled, true);
  assert.equal(saved.image_bot_id, 77);
  assert.equal(saved.generate_image_from_transcription, false);

  const chained = setSettings(db, {
    enabled: true,
    image_generation_enabled: true,
    generate_image_from_transcription: true,
  }, 'server-secret');
  assert.equal(chained.generate_image_from_transcription, true);
  const disabledPrerequisite = setSettings(db, {
    enabled: true,
    image_generation_enabled: false,
    generate_image_from_transcription: true,
  }, 'server-secret');
  assert.equal(disabledPrerequisite.generate_image_from_transcription, false);

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
    caption: 'Transcript text',
  });
  assert.match(requests[0].url, /\/sendPhoto$/);
  assert.ok(requests[0].options.body instanceof FormData);
  assert.equal(requests[0].options.body.get('chat_id'), '777');
  assert.deepEqual(JSON.parse(requests[0].options.body.get('reply_parameters')), { message_id: 9 });
  assert.equal(requests[0].options.body.get('photo').name, 'result.png');
  assert.equal(requests[0].options.body.get('caption'), 'Transcript text');
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
      from: { id: 777, username: 'voice_user', first_name: 'Voice', last_name: 'User', language_code: 'ru' },
      voice: { file_id: 'voice-file', file_unique_id: 'unique', file_size: 1024, duration: 2 },
    },
  };
  await feature.handleUpdate(update, client);
  await feature.handleUpdate(update, client);

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM telegram_transcription_jobs').get().count, 1);
  const job = db.prepare('SELECT * FROM telegram_transcription_jobs').get();
  assert.equal(db.prepare('SELECT next_update_id FROM telegram_bot_state WHERE telegram_bot_id=?').get(job.telegram_bot_id).next_update_id, 56);
  assert.equal(job.status, 'queued');
  assert.equal(job.telegram_user_id, '777');
  assert.equal(job.telegram_user_username, 'voice_user');
  assert.equal(job.telegram_user_display_name, 'Voice User');
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
      from: { id: 777, username: 'prompt_user', first_name: 'Prompt', last_name: 'User', language_code: 'ru' },
    },
  };
  const client = { async sendMessage() { return { message_id: 13 }; } };
  await feature.handleUpdate(update, client);
  await feature.handleUpdate(update, client);

  const rows = db.prepare('SELECT * FROM telegram_image_generation_jobs').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].prompt_text, 'Нарисуй банан на синем фоне');
  assert.equal(rows[0].telegram_user_username, 'prompt_user');
  assert.equal(rows[0].telegram_user_display_name, 'Prompt User');
  assert.equal(rows[0].image_bot_id, 91);
  assert.equal(JSON.parse(rows[0].image_bot_profile_json).image_model, 'gpt-image-2');
  assert.equal(rows[0].status, 'queued');
  assert.equal(db.prepare('SELECT next_update_id FROM telegram_bot_state WHERE telegram_bot_id=?').get(rows[0].telegram_bot_id).next_update_id, 91);
  db.close();
});

test('Telegram image worker stores the completed image, sends photo, and clears only transient payloads', async (t) => {
  const db = createDb();
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-telegram-history-'));
  t.after(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));
  setSettings(db, {
    ...DEFAULT_SETTINGS,
    bot_token: '123456:image-worker-token',
    image_generation_enabled: true,
    image_bot_id: 91,
    allowed_user_ids: ['777'],
  }, 'server-secret');
  const telegramCalls = [];
  let generationCalls = 0;
  let generationArgs = null;
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
    uploadsDir,
    getAiBotFeature: () => ({
      listTelegramImageBots: () => [imageBot],
      async generateTelegramImage(args) {
        generationCalls += 1;
        generationArgs = args;
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
  assert.equal(generationArgs.botSnapshot.image_model, 'gpt-image-2');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.prompt_text, 'banana poster');
  assert.equal(completed.image_data, null);
  assert.match(completed.stored_image_path, new RegExp(`^telegram/${completed.telegram_bot_id}/[a-f0-9-]+\\.png$`));
  assert.equal(fs.existsSync(path.join(uploadsDir, completed.stored_image_path)), true);
  assert.equal(completed.generation_provider, 'openai');
  assert.equal(completed.generation_model, 'gpt-image-2');
  assert.ok(telegramCalls.some((call) => /\/sendMessage$/.test(call.url)));
  assert.ok(telegramCalls.some((call) => /\/sendPhoto$/.test(call.url)));
  assert.ok(telegramCalls.some((call) => /\/deleteMessage$/.test(call.url)));
  db.close();
});

test('Telegram transcription hands off to image generation and sends transcript as photo caption', async (t) => {
  const db = createDb();
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-telegram-history-'));
  t.after(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));
  const bot = setSettings(db, {
    ...DEFAULT_SETTINGS,
    bot_token: '123456:combined-worker-token',
    enabled: true,
    image_generation_enabled: true,
    generate_image_from_transcription: true,
    image_bot_id: 91,
    allowed_user_ids: ['777'],
  }, 'server-secret');
  const imageBot = { id: 91, name: 'Painter', provider: 'openai', image_model: 'gpt-image-2' };
  const transcript = 'A banana in a blue room '.repeat(70).trim();
  db.prepare(`
    INSERT INTO telegram_transcription_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
      file_id, profile_json, status, transcript_text, transcription_provider, transcription_model
    ) VALUES(?, 303, '777', '777', 44, 'audio-file', ?, 'queued', ?, 'openai', 'gpt-4o-mini-transcribe')
  `).run(bot.id, JSON.stringify({
    generate_image_from_transcription: true,
    image_bot_id: imageBot.id,
    image_bot_name: imageBot.name,
    image_bot_profile: imageBot,
  }), transcript);
  const telegramCalls = [];
  const feature = createTelegramTranscriptionFeature({
    app: fakeApp(), db,
    auth: (_req, _res, next) => next(), adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret',
    uploadsDir,
    getAiBotFeature: () => ({
      async generateTelegramImage(args) {
        assert.equal(args.prompt, transcript);
        assert.equal(args.botSnapshot.image_model, 'gpt-image-2');
        assert.equal(args.allowLongPrompt, true);
        return { buffer: Buffer.from('combined-image'), mimeType: 'image/png', filename: 'combined.png' };
      },
    }),
    fetchImpl: async (url, options) => {
      telegramCalls.push({ url: String(url), options });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 304 } }), { status: 200 });
    },
  });
  feature.stop();

  await feature.processJob(db.prepare('SELECT * FROM telegram_transcription_jobs').get());
  const imageJob = db.prepare('SELECT * FROM telegram_image_generation_jobs').get();
  assert.equal(imageJob.source_transcription_job_id, 1);
  assert.equal(imageJob.prompt_text, transcript);
  assert.equal(db.prepare('SELECT status FROM telegram_transcription_jobs WHERE id=1').get().status, 'completed');

  await feature.processImageJob(imageJob);
  const photo = telegramCalls.find((call) => /\/sendPhoto$/.test(call.url));
  assert.ok(photo);
  assert.ok(Array.from(photo.options.body.get('caption')).length <= 1024);
  const sentText = telegramCalls.filter((call) => /\/sendMessage$/.test(call.url))
    .map((call) => JSON.parse(call.options.body).text);
  const deliveredTranscript = [photo.options.body.get('caption'), ...sentText.slice(1)].join(' ')
    .replace(/\s+/g, ' ').trim();
  assert.equal(deliveredTranscript, transcript.replace(/\s+/g, ' ').trim());
  const completed = db.prepare('SELECT * FROM telegram_image_generation_jobs').get();
  assert.equal(completed.status, 'completed');
  assert.equal(completed.prompt_text, transcript);
  assert.equal(completed.image_data, null);
  assert.equal(db.prepare('SELECT transcript_text FROM telegram_transcription_jobs WHERE id=1').get().transcript_text, transcript);
  assert.equal(fs.existsSync(path.join(uploadsDir, completed.stored_image_path)), true);
  db.close();
});

test('Telegram image failure returns the linked transcript and image error', async () => {
  const db = createDb();
  const bot = setSettings(db, { bot_token: '123456:combined-failure-token' }, 'server-secret');
  db.prepare(`
    INSERT INTO telegram_transcription_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id, file_id, status
    ) VALUES(?, 401, '777', '777', 45, 'audio-file', 'completed')
  `).run(bot.id);
  db.prepare(`
    INSERT INTO telegram_image_generation_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
      prompt_text, image_bot_id, source_transcription_job_id, status
    ) VALUES(?, 401, '777', '777', 45, 'Recovered transcript', 91, 1, 'processing')
  `).run(bot.id);
  const telegramCalls = [];
  const feature = createTelegramTranscriptionFeature({
    app: fakeApp(), db,
    auth: (_req, _res, next) => next(), adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret',
    fetchImpl: async (url, options) => {
      telegramCalls.push({ url: String(url), options });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 402 } }), { status: 200 });
    },
  });
  feature.stop();
  await feature.failImageJob(db.prepare('SELECT * FROM telegram_image_generation_jobs').get(), new Error('provider unavailable'));

  const messages = telegramCalls.filter((call) => /\/sendMessage$/.test(call.url))
    .map((call) => JSON.parse(call.options.body).text);
  assert.deepEqual(messages, ['Recovered transcript', 'Could not create or send the image. Try again.']);
  assert.equal(db.prepare('SELECT prompt_text FROM telegram_image_generation_jobs').get().prompt_text, 'Recovered transcript');
  db.close();
});

test('Telegram image delivery resumes from stored image without regenerating and falls back to document', async (t) => {
  const db = createDb();
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-telegram-history-'));
  t.after(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));
  setSettings(db, {
    ...DEFAULT_SETTINGS,
    bot_token: '123456:restart-token',
    image_generation_enabled: true,
    image_bot_id: 91,
    allowed_user_ids: ['777'],
  }, 'server-secret');
  const botId = db.prepare('SELECT id FROM telegram_bots LIMIT 1').get().id;
  const storedImagePath = path.posix.join('telegram', String(botId), 'persisted.webp');
  const storedImageFile = path.join(uploadsDir, ...storedImagePath.split('/'));
  fs.mkdirSync(path.dirname(storedImageFile), { recursive: true });
  fs.writeFileSync(storedImageFile, 'persisted-image');
  db.prepare(`
    INSERT INTO telegram_image_generation_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
      language_code, prompt_text, image_bot_id, image_bot_name, status,
      status_message_id, image_mime_type, image_file_name, stored_image_path
    ) VALUES((SELECT id FROM telegram_bots LIMIT 1), 202, '777', '777', 33, 'en', 'persisted prompt', 91, 'Painter',
      'delivering', 34, 'image/webp', 'persisted.webp', ?)
  `).run(storedImagePath);
  let generationCalls = 0;
  const telegramCalls = [];
  const feature = createTelegramTranscriptionFeature({
    app: fakeApp(),
    db,
    auth: (_req, _res, next) => next(),
    adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret',
    uploadsDir,
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
  assert.equal(completed.prompt_text, 'persisted prompt');
  assert.equal(completed.image_data, null);
  assert.equal(completed.stored_image_path, storedImagePath);
  assert.equal(fs.existsSync(storedImageFile), true);
  assert.ok(telegramCalls.some((call) => /\/sendDocument$/.test(call.url)));
  assert.ok(telegramCalls.every((call) => !/\/sendPhoto$/.test(call.url)));
  db.close();
});

test('Telegram /start returns numeric ID before allowlist authorization', async () => {
  const db = createDb();
  setSettings(db, { name: 'Start bot' }, 'server-secret');
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
  assert.equal(db.prepare('SELECT next_update_id FROM telegram_bot_state LIMIT 1').get().next_update_id, 81);
  db.close();
});

test('legacy singleton settings, cursor, and jobs migrate once into the first Telegram bot', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE app_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT);
    CREATE TABLE telegram_transcription_state(
      id INTEGER PRIMARY KEY, next_update_id INTEGER, last_poll_at TEXT, last_update_at TEXT,
      last_error TEXT, updated_at TEXT
    );
    INSERT INTO telegram_transcription_state VALUES(1, 73, NULL, NULL, NULL, datetime('now'));
    CREATE TABLE telegram_image_generation_jobs(
      id INTEGER PRIMARY KEY AUTOINCREMENT, update_id INTEGER NOT NULL UNIQUE,
      telegram_chat_id TEXT NOT NULL, telegram_user_id TEXT NOT NULL, telegram_message_id INTEGER NOT NULL,
      language_code TEXT, prompt_text TEXT, image_bot_id INTEGER NOT NULL, image_bot_name TEXT,
      status TEXT NOT NULL, status_message_id INTEGER, image_data BLOB, image_mime_type TEXT,
      image_file_name TEXT, generation_provider TEXT, generation_model TEXT, error TEXT,
      created_at TEXT, updated_at TEXT, completed_at TEXT,
      UNIQUE(telegram_chat_id, telegram_message_id)
    );
    INSERT INTO telegram_image_generation_jobs(
      update_id, telegram_chat_id, telegram_user_id, telegram_message_id, prompt_text,
      image_bot_id, status, created_at, updated_at
    ) VALUES(72, '777', '777', 4, 'legacy banana', 9, 'queued', datetime('now'), datetime('now'));
  `);
  db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?)').run(
    'telegram_transcription_settings',
    JSON.stringify({
      bot_name: 'Legacy Telegram', bot_username: 'legacy_bot', bot_id: '991',
      bot_token_encrypted: 'legacy-ciphertext', bot_token_masked: '123...oken',
      allowed_user_ids: ['777'], enabled: true, image_generation_enabled: true, image_bot_id: 9,
    })
  );

  initTelegramTranscriptionSchema(db);
  initTelegramTranscriptionSchema(db);

  const bots = listBots(db);
  assert.equal(bots.length, 1);
  assert.equal(bots[0].name, 'Legacy Telegram');
  assert.equal(bots[0].telegram_bot_username, 'legacy_bot');
  assert.equal(bots[0].transcription_enabled, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM app_settings WHERE key=?').get('telegram_transcription_settings').count, 0);
  const job = db.prepare('SELECT * FROM telegram_image_generation_jobs').get();
  assert.equal(job.telegram_bot_id, bots[0].id);
  assert.equal(job.telegram_user_username, '');
  assert.equal(job.telegram_user_display_name, '');
  assert.equal(job.stored_image_path, null);
  assert.equal(db.prepare('SELECT next_update_id FROM telegram_bot_state WHERE telegram_bot_id=?').get(bots[0].id).next_update_id, 73);
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
  db.close();
});

test('two Telegram bots accept the same update and message IDs with isolated cursors and allowlists', async () => {
  const db = createDb();
  const first = setSettings(db, { name: 'First', enabled: true, allowed_user_ids: ['777'] }, 'server-secret');
  const second = setSettings(db, { name: 'Second', enabled: true, allowed_user_ids: ['888'] }, 'server-secret');
  const feature = createTelegramTranscriptionFeature({
    app: fakeApp(), db, auth: (_req, _res, next) => next(), adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret', getAiBotFeature: () => null,
  });
  feature.stop();
  const updateFor = (userId) => ({
    update_id: 11,
    message: {
      message_id: 5,
      chat: { id: 500, type: 'private' },
      from: { id: userId, language_code: 'en' },
      voice: { file_id: `voice-${userId}`, file_size: 100, duration: 1 },
    },
  });
  const client = { async sendMessage() { return { message_id: 6 }; } };
  await feature.handleUpdate(updateFor(777), client, first.id);
  await feature.handleUpdate(updateFor(888), client, second.id);

  const jobs = db.prepare('SELECT telegram_bot_id, update_id FROM telegram_transcription_jobs ORDER BY telegram_bot_id').all();
  assert.deepEqual(jobs, [
    { telegram_bot_id: first.id, update_id: 11 },
    { telegram_bot_id: second.id, update_id: 11 },
  ]);
  assert.equal(db.prepare('SELECT next_update_id FROM telegram_bot_state WHERE telegram_bot_id=?').get(first.id).next_update_id, 12);
  assert.equal(db.prepare('SELECT next_update_id FROM telegram_bot_state WHERE telegram_bot_id=?').get(second.id).next_update_id, 12);
  db.close();
});

test('Telegram bot admin API sanitizes tokens and guards deletion per owning bot only', async (t) => {
  const db = createDb();
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-telegram-bot-delete-'));
  t.after(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));
  db.pragma('foreign_keys = ON');
  const first = setSettings(db, {
    name: 'Busy bot', bot_token: '111111:first-secret', enabled: false,
  }, 'server-secret');
  const second = setSettings(db, {
    name: 'Idle bot', bot_token: '222222:second-secret', enabled: false,
  }, 'server-secret');
  db.prepare(`
    INSERT INTO telegram_transcription_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id, file_id
    ) VALUES(?, 1, '1', '1', 1, 'voice')
  `).run(first.id);
  const storedImagePath = path.posix.join('telegram', String(second.id), 'delete-me.png');
  const storedImageFile = path.join(uploadsDir, ...storedImagePath.split('/'));
  fs.mkdirSync(path.dirname(storedImageFile), { recursive: true });
  fs.writeFileSync(storedImageFile, 'image');
  db.prepare(`
    INSERT INTO telegram_image_generation_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
      prompt_text, image_bot_id, status, stored_image_path
    ) VALUES(?, 8, '8', '8', 8, 'delete history', 9, 'completed', ?)
  `).run(second.id, storedImagePath);
  const app = fakeApp();
  const feature = createTelegramTranscriptionFeature({
    app, db, auth: (_req, _res, next) => next(), adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret', uploadsDir, getAiBotFeature: () => null,
  });
  feature.stop();
  function response() {
    return {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
  }

  const getResponse = response();
  app.routes.get('GET /api/admin/telegram-bots')({}, getResponse);
  assert.equal(getResponse.body.bots.length, 2);
  assert.equal(getResponse.body.bots[0].has_bot_token, true);
  assert.equal(Object.hasOwn(getResponse.body.bots[0], 'bot_token_encrypted'), false);
  assert.doesNotMatch(JSON.stringify(getResponse.body), /first-secret|second-secret/);

  const deleteRoute = app.routes.get('DELETE /api/admin/telegram-bots/:id(\\d+)');
  const idleDelete = response();
  await deleteRoute({ params: { id: String(second.id) } }, idleDelete);
  assert.equal(idleDelete.statusCode, 200);
  assert.equal(readBot(db, second.id), null);
  assert.equal(fs.existsSync(storedImageFile), false);

  const busyDelete = response();
  await deleteRoute({ params: { id: String(first.id) } }, busyDelete);
  assert.equal(busyDelete.statusCode, 409);
  assert.ok(readBot(db, first.id));
  db.close();
});

test('Telegram bot history groups combined jobs, filters users, and clears only terminal jobs and files', async (t) => {
  const db = createDb();
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-telegram-history-api-'));
  t.after(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));
  const bot = setSettings(db, { name: 'History bot', enabled: false }, 'server-secret');
  const imagePath = path.join(uploadsDir, 'telegram', String(bot.id), 'history.png');
  fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  fs.writeFileSync(imagePath, 'history-image');
  db.prepare(`
    INSERT INTO telegram_transcription_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
      telegram_user_username, telegram_user_display_name, file_id, status, transcript_text
    ) VALUES(?, 701, '1', '100', 1, 'alice', 'Alice Example', 'voice', 'completed', 'combined transcript')
  `).run(bot.id);
  db.prepare(`
    INSERT INTO telegram_image_generation_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
      telegram_user_username, telegram_user_display_name, prompt_text, image_bot_id,
      source_transcription_job_id, status, stored_image_path, image_mime_type
    ) VALUES(?, 702, '1', '100', 1, 'alice', 'Alice Example', 'combined prompt', 9, 1,
      'completed', ?, 'image/png')
  `).run(bot.id, path.posix.join('telegram', String(bot.id), 'history.png'));
  db.prepare(`
    INSERT INTO telegram_image_generation_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
      telegram_user_username, telegram_user_display_name, prompt_text, image_bot_id, status
    ) VALUES(?, 703, '2', '200', 2, 'bob', 'Bob Example', 'active prompt', 9, 'processing')
  `).run(bot.id);
  const app = fakeApp();
  const feature = createTelegramTranscriptionFeature({
    app, db, uploadsDir, auth: (_req, _res, next) => next(), adminOnly: (_req, _res, next) => next(),
    secret: 'server-secret', getAiBotFeature: () => null,
  });
  feature.stop();
  const response = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const historyRoute = app.routes.get('GET /api/admin/telegram-bots/:id(\\d+)/history');
  const history = response();
  historyRoute({ params: { id: String(bot.id) }, query: { user_id: '100', limit: '1', page: '1' } }, history);
  assert.equal(history.statusCode, 200);
  assert.equal(history.body.total, 1);
  assert.equal(history.body.items[0].kind, 'combined');
  assert.equal(history.body.items[0].transcript_text, 'combined transcript');
  assert.equal(history.body.items[0].prompt_text, 'combined prompt');
  assert.equal(history.body.items[0].has_image, true);
  assert.equal(Object.hasOwn(history.body.items[0], 'stored_image_path'), false);
  assert.deepEqual(history.body.users, [{
    telegram_user_id: '100', telegram_user_username: 'alice', telegram_user_display_name: 'Alice Example', count: 1,
  }, {
    telegram_user_id: '200', telegram_user_username: 'bob', telegram_user_display_name: 'Bob Example', count: 1,
  }]);

  const clearRoute = app.routes.get('DELETE /api/admin/telegram-bots/:id(\\d+)/history');
  const cleared = response();
  await clearRoute({ params: { id: String(bot.id) } }, cleared);
  assert.deepEqual(cleared.body.cleared, { images: 1, transcriptions: 1, files: 1 });
  assert.equal(fs.existsSync(imagePath), false);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM telegram_image_generation_jobs WHERE status IN (\'queued\', \'processing\')').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM telegram_transcription_jobs').get().count, 0);
  db.close();
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { initTelegramTranscriptionSchema } = require('../../telegramTranscription/schema');
const { createBot, updateBot, readBot } = require('../../telegramTranscription/settings');
const { createConversationMemory } = require('../../telegramTranscription/memory');
const { createTelegramTranscriptionFeature } = require('../../telegramTranscription');

function harness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-memory-test-'));
  const db = new Database(path.join(root, 'test.db'));
  db.pragma('foreign_keys=ON');
  db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY, value TEXT)');
  initTelegramTranscriptionSchema(db);
  const bot = createBot(db, {
    name: 'Memory bot', bot_token: '123456:test', allowed_user_ids: ['777', '888'],
    universal_enabled: true, universal_bot_id: 92, memory_enabled: true,
  }, 'secret');
  t.after(() => { if (db.open) db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { db, bot, root };
}

test('Telegram memory is bounded, isolated, idempotent, and invalidated when disabled or cleared', (t) => {
  const { db, bot } = harness(t);
  const memory = createConversationMemory(db);
  const job = { telegram_bot_id: bot.id, telegram_chat_id: '777', telegram_user_id: '777', update_id: 1, prompt_text: 'hello' };
  const image = { buffer: Buffer.from('pixels'), mimeType: 'image/png', filename: 'source.png' };
  for (let i = 1; i <= 30; i++) memory.save({ ...job, update_id: i }, 0, image, { text: `reply ${i}` });
  assert.equal(memory.history({ ...job, update_id: 31 }, 50).length, 50);
  assert.equal(memory.history({ ...job, update_id: 31 }, 50)[0].update_id, 6);
  const imageId = memory.history({ ...job, update_id: 31 }, 50)[0].id;
  assert.deepEqual(memory.loadImage({ ...job, update_id: 31 }, imageId).buffer, image.buffer);
  assert.equal(memory.loadImage({ ...job, telegram_user_id: '888', update_id: 31 }, imageId), null);
  memory.save({ ...job, update_id: 30 }, 0, image, { text: 'duplicate' });
  assert.equal(memory.history({ ...job, update_id: 31 }, 50).length, 50);
  assert.deepEqual(memory.history({ ...job, telegram_user_id: '888', update_id: 31 }, 50), []);
  assert.deepEqual(memory.history({ ...job, telegram_chat_id: '888', update_id: 31 }, 50), []);
  assert.deepEqual(memory.history({ ...job, telegram_bot_id: 999, update_id: 31 }, 50), []);
  updateBot(db, bot.id, { memory_message_limit: 4 }, 'secret');
  assert.equal(memory.history({ ...job, update_id: 31 }, 50).length, 4);
  updateBot(db, bot.id, { memory_enabled: false }, 'secret');
  memory.save({ ...job, update_id: 31 }, 0, image, { text: 'in-flight result' });
  assert.deepEqual(memory.history({ ...job, update_id: 32 }, 50), []);
  updateBot(db, bot.id, { memory_enabled: true }, 'secret');
  memory.save({ ...job, update_id: 31 }, 0, image, { text: 'stale result after re-enable' });
  assert.deepEqual(memory.history({ ...job, update_id: 32 }, 50), []);
  const revision = readBot(db, bot.id).memory_revision;
  memory.save({ ...job, update_id: 32 }, revision, image, { text: 'new session' });
  assert.equal(memory.history({ ...job, update_id: 33 }, 50).length, 2);
  db.prepare('DELETE FROM telegram_bots WHERE id=?').run(bot.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM telegram_conversation_messages').get().n, 0);
});

test('Telegram conversation queues text and captionless photos, remembers replies and images across restart, and resumes delivery', async (t) => {
  const { db, bot, root } = harness(t);
  const universalBot = {
    id: 92, name: 'Universal', kind: 'universal', provider: 'openai', enabled: true,
    provider_enabled: true, allow_image_generate: true, allow_image_edit: true,
  };
  const sourceBytes = Buffer.from('source pixels');
  const calls = [];
  const routes = new Map();
  const app = Object.fromEntries(['get', 'put', 'post', 'delete'].map((method) => [method,
    (route, ...handlers) => routes.set(`${method} ${route}`, handlers.at(-1)),
  ]));
  const args = {
    app, db, secret: 'secret', uploadsDir: path.join(root, 'uploads'),
    auth: (_req, _res, next) => next(), adminOnly: (_req, _res, next) => next(),
    getAiBotFeature: () => ({
      listTelegramUniversalBots: () => [universalBot],
      getTelegramUniversalBotSnapshot: () => universalBot,
      runTelegramConversation: async (request) => {
        calls.push(request);
        if (request.prompt === 'edit it') return { buffer: Buffer.from('edited pixels'), mimeType: 'image/png', filename: 'edited.png' };
        return { text: request.prompt ? `Answer: ${request.prompt}` : 'Image remembered.' };
      },
    }),
    fetchImpl: async (url) => {
      if (String(url).includes('/file/bot')) return new Response(sourceBytes);
      return new Response(JSON.stringify({ ok: true, result: String(url).endsWith('/getFile')
        ? { file_path: 'photos/source.png' } : { message_id: 999 } }));
    },
  };
  let feature = createTelegramTranscriptionFeature(args);
  feature.stop();
  const accept = async (id, content, user = 777) => {
    await feature.handleUpdate({ update_id: id, message: {
      message_id: id, chat: { id: user, type: 'private' }, from: { id: user, language_code: 'en' }, ...content,
    } }, { sendMessage: async () => ({ message_id: 888 }) }, bot.id);
    return db.prepare('SELECT * FROM telegram_image_generation_jobs WHERE update_id=?').get(id);
  };
  const first = await accept(1, { text: 'My name is Sam' });
  await accept(1, { text: 'My name is Sam' });
  const second = await accept(2, { text: 'What is my name?' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM telegram_image_generation_jobs').get().n, 2);
  assert.equal(first.operation_kind, 'conversation');
  await feature.processImageJob(first);
  await feature.processImageJob(second);
  assert.equal(calls[0].history.length, 0);
  assert.deepEqual(calls[1].history.map((row) => row.text), ['My name is Sam', 'Answer: My name is Sam']);
  const photo = await accept(3, { photo: [{ file_id: 'source', file_size: sourceBytes.length }] });
  await feature.processImageJob(photo);
  assert.deepEqual(calls[2].sourceImage.buffer, sourceBytes);
  // Recreate the feature (including its persisted queued/delivering recovery).
  feature = createTelegramTranscriptionFeature(args);
  feature.stop();
  const edit = await accept(4, { text: 'edit it' });
  await feature.processImageJob(edit);
  const originalImageId = calls[3].history.find((row) => row.has_image)?.id;
  assert.deepEqual(calls[3].loadImage(originalImageId).buffer, sourceBytes);
  const next = await accept(5, { text: 'Describe the result' });
  await feature.processImageJob(next);
  assert.deepEqual(calls[4].loadImage(calls[4].history.filter((row) => row.has_image).at(-1).id).buffer, Buffer.from('edited pixels'));
  const otherUser = await accept(6, { text: 'hello' }, 888);
  await feature.processImageJob(otherUser);
  assert.equal(calls[5].history.length, 0);
  // A persisted answer must be delivered without another provider call.
  await feature.processImageJob(db.prepare('SELECT * FROM telegram_image_generation_jobs WHERE id=?').get(next.id));
  assert.equal(calls.length, 6);
  assert.equal(db.prepare('SELECT status FROM telegram_image_generation_jobs WHERE id=?').get(next.id).status, 'completed');
  const historyRoute = routes.get('get /api/admin/telegram-bots/:id(\\d+)/history');
  let history;
  historyRoute({ params: { id: bot.id }, query: {} }, { json: (data) => { history = data; } });
  assert.ok(history.items.some((row) => row.kind === 'conversation' && row.response_text === 'Answer: Describe the result'));
  await routes.get('delete /api/admin/telegram-bots/:id(\\d+)/history')({ params: { id: bot.id } }, { json: () => {} });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM telegram_conversation_messages').get().n, 0);
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
});

test('Telegram memory migration defaults existing bots to off and preserves existing rows on repeat', (t) => {
  const { db } = harness(t);
  const legacy = createBot(db, { name: 'Legacy' }, 'secret');
  assert.equal(legacy.memory_enabled, false);
  assert.equal(legacy.memory_message_limit, 50);
  initTelegramTranscriptionSchema(db);
  initTelegramTranscriptionSchema(db);
  assert.equal(readBot(db, legacy.id).memory_enabled, false);
  assert.equal(updateBot(db, legacy.id, { memory_message_limit: 'invalid' }, 'secret').memory_message_limit, 50);
  assert.equal(updateBot(db, legacy.id, { memory_message_limit: -1 }, 'secret').memory_message_limit, 2);
  assert.equal(updateBot(db, legacy.id, { memory_message_limit: 9999 }, 'secret').memory_message_limit, 200);
});

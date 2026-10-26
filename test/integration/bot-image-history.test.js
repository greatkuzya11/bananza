const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VZ0AAAAASUVORK5CYII=', 'base64');

test('admin image history covers eligible bots, all users, access flags, filtering and pages', async (t) => {
  const sandbox = await createSandbox({ name: 'bot-image-history' });
  let db;
  t.after(async () => { if (db?.open) db.close(); await sandbox.stop(); });
  const { admin, bob, carol, groupChat, privateChat } = await createBasicChatScenario(sandbox.baseUrl);
  const { data: foreignChat } = await bob.request('/api/chats/private', { method: 'POST', json: { targetUserId: carol.user.id } });
  const bots = [];
  for (const [route, kind] of [
    ['/api/admin/local-image-bots', 'image'],
    ['/api/admin/openai-image-bots', 'image'],
    ['/api/admin/grok-ai-bots', 'image'],
    ['/api/admin/openai-universal-bots', 'universal'],
    ['/api/admin/grok-universal-bots', 'universal'],
    ['/api/admin/openai-chatshot-bots', 'chatshot'],
    ['/api/admin/grok-chatshot-bots', 'chatshot'],
  ]) {
    const mention = 'historybot' + bots.length;
    const result = await admin.request(route, { method: 'POST', json: { name: mention, mention, kind, enabled: true } });
    bots.push(result.data.bot);
  }
  const upload = await admin.uploadPngFile();
  db = new Database(path.join(sandbox.appDir, 'bananza.db'));
  const insert = db.prepare('INSERT INTO messages(chat_id,user_id,text,file_id,reply_to_id,ai_generated,ai_bot_id,is_deleted) VALUES(?,?,?,?,?,?,?,?)');
  const prompt = Number(insert.run(privateChat.id, admin.user.id, 'Make the cup green <script>alert(1)</script>', null, null, 0, null, 0).lastInsertRowid);
  const foreignPrompt = Number(insert.run(foreignChat.id, bob.user.id, 'Blue cup', null, null, 0, null, 0).lastInsertRowid);
  const groupPrompt = Number(insert.run(groupChat.id, bob.user.id, 'Red cup', null, null, 0, null, 0).lastInsertRowid);
  function image(bot, chatId, { deleted = 0, generated = 1, userId = bot.user_id, replyId = prompt, fileId = upload.id } = {}) {
    return Number(insert.run(chatId, userId, null, fileId, replyId, generated, bot.id, deleted).lastInsertRowid);
  }
  const first = image(bots[0], privateChat.id);
  const edited = image(bots[0], privateChat.id);
  image(bots[0], privateChat.id, { deleted: 1 });
  image(bots[0], privateChat.id, { generated: 0, userId: admin.user.id });
  image(bots[0], privateChat.id, { userId: bob.user.id });
  const forwarded = image(bots[0], privateChat.id);
  db.prepare('UPDATE messages SET forwarded_from_message_id=? WHERE id=?').run(first, forwarded);
  const documentFile = Number(db.prepare("INSERT INTO files(original_name,stored_name,type,mime_type,size,uploaded_by) VALUES('x.txt','history.txt','document','text/plain',1,?)").run(admin.user.id).lastInsertRowid);
  image(bots[0], privateChat.id, { fileId: documentFile });
  const shared = image(bots[0], groupChat.id, { replyId: groupPrompt });
  const foreign = image(bots[0], foreignChat.id, { replyId: foreignPrompt });
  const endpoint = '/api/ai-bots/' + bots[0].id + '/images';
  const history = (await admin.request(endpoint, { searchParams: { limit: 2 } })).data;
  assert.deepEqual(history.images.map((item) => item.id), [foreign, shared]);
  assert.equal(history.total, 4);
  assert.equal(history.total_pages, 2);
  assert.equal(history.page, 1);
  assert.equal(history.images[0].chat_id, null);
  assert.equal(history.images[0].can_open_chat, false);
  assert.equal(history.images[0].prompt, 'Blue cup');
  assert.equal(history.images[0].requested_by.id, bob.user.id);
  assert.equal(history.images[1].chat_id, groupChat.id);
  assert.equal(history.images[1].can_open_chat, true);
  assert.equal(history.images[1].requested_by.id, bob.user.id);
  const page2 = (await admin.request(endpoint, { searchParams: { limit: 2, page: 2 } })).data;
  assert.deepEqual(page2.images.map((item) => item.id), [edited, first]);
  assert.match(page2.images[0].prompt, /Make the cup green/);
  assert.equal(page2.images[0].requested_by.id, admin.user.id);
  assert.ok(page2.images[0].file_url.startsWith('/uploads/'));
  const filtered = (await admin.request(endpoint, { searchParams: { user_id: admin.user.id, limit: 1 } })).data;
  assert.equal(filtered.total, 2);
  assert.deepEqual(filtered.images.map((item) => item.id), [edited]);
  assert.deepEqual(filtered.users, history.users);
  assert.equal(filtered.users.length, 2);
  const empty = (await admin.request(endpoint, { searchParams: { user_id: carol.user.id } })).data;
  assert.equal(empty.total, 0);
  assert.equal(empty.total_pages, 1);
  assert.deepEqual(empty.images, []);
  assert.equal((await admin.request(endpoint, { searchParams: { limit: 2, page: 999 } })).data.page, 2);
  await bob.request(endpoint, { expectedStatus: 403 });
  await carol.request(endpoint, { expectedStatus: 403 });
  for (const bot of bots.slice(1)) {
    const botEndpoint = '/api/ai-bots/' + bot.id + '/images';
    assert.equal((await admin.request(botEndpoint)).data.total, 0);
    image(bot, foreignChat.id, { replyId: foreignPrompt });
    const result = (await admin.request(botEndpoint)).data;
    assert.equal(result.images.length, 1);
    assert.equal(result.bot.kind, bot.kind);
    assert.equal(result.bot.provider, bot.provider);
    assert.equal(result.images[0].requested_by.id, bob.user.id);
    assert.equal(result.images[0].can_open_chat, false);
  }
  for (const [route, kind] of [
    ['/api/admin/ai-bots', 'text'],
    ['/api/admin/grok-ai-bots', 'text'],
    ['/api/admin/deepseek-ai-bots', 'text'],
    ['/api/admin/qwen-ai-bots', 'text'],
    ['/api/admin/yandex-ai-bots', 'text'],
    ['/api/admin/openai-convert-bots', 'convert'],
  ]) {
    const mention = 'excluded' + route.split('/').pop().replace(/-/g, '');
    const created = await admin.request(route, { method: 'POST', json: { name: mention, mention, kind } });
    await admin.request('/api/ai-bots/' + created.data.bot.id + '/images', { expectedStatus: 404 });
  }
  // Historical voice/video-note requests keep their prompt in voice_messages, not messages.text.
  db.prepare("INSERT INTO voice_messages(message_id,transcription_status,transcription_text) VALUES(?,'completed',?)")
    .run(foreignPrompt, 'Draw a blue cup from this voice request <b>literally</b>');
  for (const text of [null, '', '   ']) {
    db.prepare('UPDATE messages SET text=? WHERE id=?').run(text, foreignPrompt);
    const voiceHistory = (await admin.request(endpoint, { searchParams: { user_id: bob.user.id, limit: 1 } })).data;
    assert.equal(voiceHistory.total, 2);
    assert.equal(voiceHistory.images[0].id, foreign);
    assert.equal(voiceHistory.images[0].prompt, 'Draw a blue cup from this voice request <b>literally</b>');
    assert.equal(voiceHistory.images[0].requested_by.id, bob.user.id);
    assert.equal(voiceHistory.images[0].can_open_chat, false);
    assert.equal(voiceHistory.images[0].chat_id, null);
  }
  db.prepare('UPDATE messages SET text=? WHERE id=?').run('Explicit caption', foreignPrompt);
  assert.equal((await admin.request(endpoint)).data.images[0].prompt, 'Explicit caption');
  db.prepare("INSERT INTO voice_messages(message_id,transcription_status,transcription_text) VALUES(?,'completed',?)")
    .run(prompt, 'Transcript of a subsequently deleted source');
  // Membership controls only navigation, never the admin history selection.
  db.prepare('DELETE FROM chat_members WHERE chat_id=? AND user_id=?').run(privateChat.id, admin.user.id);
  const remaining = (await admin.request(endpoint)).data;
  assert.equal(remaining.total, 4);
  assert.equal(remaining.images.find((item) => item.id === first).chat_id, null);
  db.prepare('UPDATE messages SET is_deleted=1 WHERE id=?').run(prompt);
  const missingSource = (await admin.request(endpoint)).data.images.find((item) => item.id === first);
  assert.equal(missingSource.prompt, '');
  assert.equal(missingSource.requested_by, null);
  for (const query of [{ page: 'bad' }, { page: -1 }, { page: 1.5 }, { limit: 1.5 }, { limit: 0 }, { user_id: 0 }, { user_id: 'bad' }, { before: 10 }]) {
    await admin.request(endpoint, { searchParams: query, expectedStatus: 400 });
  }
  const defaults = (await admin.request(endpoint)).data;
  assert.equal(defaults.limit, 25);
  await admin.request('/api/ai-bots/999999/images', { expectedStatus: 404 });
  assert.equal((await fetch(sandbox.baseUrl + endpoint)).status, 401);
});

test('Qwen image bot avatars use the normal upload/delete flow and admin permissions', async (t) => {
  const sandbox = await createSandbox({ name: 'local-image-avatar' });
  t.after(() => sandbox.stop());
  const { admin, bob } = await createBasicChatScenario(sandbox.baseUrl);
  const created = await admin.request('/api/admin/local-image-bots', { method: 'POST', json: { name: 'Avatar bot', mention: 'avatarbot' } });
  const endpoint = `/api/admin/local-image-bots/${created.data.bot.id}/avatar`;
  const form = new FormData();
  form.append('avatar', new Blob([PNG], { type: 'image/png' }), 'avatar.png');
  const saved = await admin.request(endpoint, { method: 'POST', formData: form });
  assert.match(saved.data.bot.avatar_url, /^\/uploads\/avatars\//);
  const image = await fetch(`${sandbox.baseUrl}${saved.data.bot.avatar_url}`);
  assert.equal(image.status, 200);
  const state = await admin.request('/api/admin/local-image-bots');
  assert.equal(state.data.bots[0].avatar_url, saved.data.bot.avatar_url);
  await bob.request(endpoint, { method: 'DELETE', expectedStatus: 403 });
  const invalid = new FormData();
  invalid.append('avatar', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'avatar.svg');
  await admin.request(endpoint, { method: 'POST', formData: invalid, expectedStatus: 400 });
  const removed = await admin.request(endpoint, { method: 'DELETE' });
  assert.equal(removed.data.bot.avatar_url, null);
  const oldFile = await fetch(`${sandbox.baseUrl}${saved.data.bot.avatar_url}`);
  assert.equal(oldFile.status, 404);
});

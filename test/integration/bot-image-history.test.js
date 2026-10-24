const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VZ0AAAAASUVORK5CYII=', 'base64');

test('image history covers all providers, paginates and respects chat membership and deletion', async (t) => {
  const sandbox = await createSandbox({ name: 'bot-image-history' });
  let db;
  t.after(async () => { if (db?.open) db.close(); await sandbox.stop(); });
  const { admin, bob, carol, groupChat, privateChat } = await createBasicChatScenario(sandbox.baseUrl);
  const bots = [];
  for (const [route, mention] of [
    ['/api/admin/local-image-bots', 'localimages'],
    ['/api/admin/openai-image-bots', 'openaiimages'],
    ['/api/admin/grok-ai-bots', 'grokimages'],
  ]) {
    const result = await admin.request(route, { method: 'POST', json: { name: mention, mention, kind: 'image', enabled: true } });
    bots.push(result.data.bot);
  }
  const upload = await admin.uploadPngFile();
  db = new Database(path.join(sandbox.appDir, 'bananza.db'));
  const insert = db.prepare(`INSERT INTO messages(chat_id,user_id,text,file_id,reply_to_id,ai_generated,ai_bot_id,is_deleted) VALUES(?,?,?,?,?,?,?,?)`);
  const prompt = Number(insert.run(privateChat.id, admin.user.id, 'Make the cup green <script>alert(1)</script>', null, null, 0, null, 0).lastInsertRowid);
  function image(bot, chatId, { deleted = 0, generated = 1, userId = bot.user_id } = {}) {
    return Number(insert.run(chatId, userId, null, upload.id, chatId === privateChat.id ? prompt : null, generated, bot.id, deleted).lastInsertRowid);
  }
  const first = image(bots[0], privateChat.id);
  const edited = image(bots[0], privateChat.id);
  image(bots[0], privateChat.id, { deleted: 1 });
  image(bots[0], privateChat.id, { generated: 0, userId: admin.user.id });
  image(bots[0], privateChat.id, { userId: bob.user.id }); // forwarded/generated metadata does not change authorship
  const shared = image(bots[0], groupChat.id);
  image(bots[1], privateChat.id);
  image(bots[2], privateChat.id);
  const endpoint = `/api/ai-bots/${bots[0].id}/images`;
  const history = await admin.request(endpoint, { searchParams: { limit: 1 } });
  assert.deepEqual(history.data.images.map((item) => item.id), [shared]);
  assert.equal(history.data.next_before, shared);
  assert.equal(history.data.images[0].requested_by, null);
  const page2 = await admin.request(endpoint, { searchParams: { limit: 1, before: shared } });
  assert.equal(page2.data.images[0].id, edited);
  assert.match(page2.data.images[0].prompt, /Make the cup green/);
  assert.equal(page2.data.images[0].requested_by.id, admin.user.id);
  assert.equal(page2.data.images[0].requested_by.username, admin.user.username);
  assert.equal(page2.data.images[0].requested_by.display_name, admin.user.display_name);
  assert.ok(page2.data.images[0].file_url.startsWith('/uploads/'));
  const page3 = await admin.request(endpoint, { searchParams: { before: edited } });
  assert.deepEqual(page3.data.images.map((item) => item.id), [first]);
  assert.equal(page3.data.next_before, null);
  const bobHistory = await bob.request(endpoint);
  assert.equal(bobHistory.data.images.length, 3);
  const carolHistory = await carol.request(endpoint);
  assert.deepEqual(carolHistory.data.images.map((item) => item.id), [shared]);
  for (const bot of bots.slice(1)) {
    const result = await bob.request(`/api/ai-bots/${bot.id}/images`);
    assert.equal(result.data.images.length, 1);
    assert.equal(result.data.bot.provider, bot.provider);
    assert.equal(result.data.images[0].requested_by.id, admin.user.id);
    await carol.request(`/api/ai-bots/${bot.id}/images`, { expectedStatus: 404 });
  }
  // Removing access removes images from history, even if the requester is an admin.
  db.prepare('DELETE FROM chat_members WHERE chat_id=? AND user_id=?').run(privateChat.id, admin.user.id);
  const remaining = await admin.request(endpoint);
  assert.deepEqual(remaining.data.images.map((item) => item.id), [shared]);
  for (const query of [{ before: 'bad' }, { before: -1 }, { limit: 1.5 }, { limit: 0 }]) {
    await admin.request(endpoint, { searchParams: query, expectedStatus: 400 });
  }
  await admin.request('/api/ai-bots/999999/images', { expectedStatus: 404 });
  const anonymous = await fetch(`${sandbox.baseUrl}${endpoint}`);
  assert.equal(anonymous.status, 401);
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

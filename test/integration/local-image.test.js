const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario, waitFor } = require('../support/scenario');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VZ0AAAAASUVORK5CYII=';

test('local image provider creates a bot, generates a chat attachment and respects settings and permissions', async (t) => {
  let count = 0;
  let submitted;
  const imageServer = http.createServer(async (req, res) => {
    let raw = '';
    for await (const part of req) raw += part;
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/sdcpp/v1/capabilities') return res.end(JSON.stringify({ supported_modes: ['img_gen'], model: { name: 'Qwen Image test' } }));
    if (req.url === '/sdcpp/v1/img_gen') { count += 1; submitted = JSON.parse(raw); return res.end(JSON.stringify({ id: 'fixture-job' })); }
    res.end(JSON.stringify({ status: 'completed', result: { images: [{ b64_json: PNG }] } }));
  });
  await new Promise((resolve) => imageServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { imageServer.closeAllConnections(); imageServer.close(resolve); }));
  const sandbox = await createSandbox({ name: 'local-image' });
  t.after(() => sandbox.stop());
  const { admin, bob } = await createBasicChatScenario(sandbox.baseUrl);
  const url = `http://127.0.0.1:${imageServer.address().port}`;
  const denied = await bob.request('/api/admin/local-image-bots', { expectedStatus: 403 });
  assert.equal(denied.status, 403);
  await admin.request('/api/admin/local-image-bots/settings', { method: 'PUT', json: {
    local_image_enabled: true, local_image_base_url: url, local_image_default_size: '512x512',
  } });
  const connection = await admin.request('/api/admin/local-image-bots/test-connection', { method: 'POST', json: {} });
  assert.equal(connection.data.result.model, 'Qwen Image test');
  const created = await admin.request('/api/admin/local-image-bots', { method: 'POST', json: {
    name: 'Local Image', mention: 'localimage', enabled: true, visible_to_users: true,
    allow_text: true, allow_image_edit: true, image_resolution: '512x512',
  } });
  const bot = created.data.bot;
  assert.equal(bot.provider, 'local-image');
  assert.equal(bot.kind, 'image');
  assert.equal(bot.allow_text, false);
  assert.equal(bot.allow_image_edit, true);
  assert.equal(bot.image_model, 'Qwen-Image-2.1-Turbo-Q8_0.gguf');
  assert.equal(bot.image_seed, -1);
  const opened = await admin.request('/api/chats/private', { method: 'POST', json: { targetUserId: bot.user_id } });
  const chatId = opened.data.id;
  await admin.request(`/api/chats/${chatId}/messages`, { method: 'POST', json: { text: 'A yellow banana' } });
  const reply = await waitFor(async () => {
    const list = await admin.request(`/api/chats/${chatId}/messages`, { searchParams: { meta: 1 } });
    const image = list.data.messages.find((message) => message.ai_generated && message.file_type === 'image');
    assert.ok(image);
    return image;
  });
  assert.equal(reply.ai_bot_provider, 'local-image');
  assert.equal(submitted.width, 512);
  assert.equal(submitted.seed, -1);
  assert.equal(count, 1);
  assert.ok(reply.file_stored);
  const bytes = await fetch(`${sandbox.baseUrl}/uploads/${reply.file_stored}`, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert.equal(bytes.status, 200);
  assert.equal(Buffer.from(await bytes.arrayBuffer()).toString('base64'), PNG);
  async function waitForImage(sourceId) {
    return waitFor(async () => {
      const list = await admin.request(`/api/chats/${chatId}/messages`, { searchParams: { meta: 1 } });
      const image = list.data.messages.find((message) => message.ai_generated && message.reply_to_id === sourceId);
      assert.equal(image?.file_type, 'image');
      return image;
    });
  }
  const fixed = await admin.request(`/api/admin/local-image-bots/${bot.id}`, { method: 'PUT', json: { image_seed: 42 } });
  assert.equal(fixed.data.bot.image_seed, 42);
  for (const image_seed of [-2, 1.5, 4294967296, 'invalid', true]) {
    await admin.request(`/api/admin/local-image-bots/${bot.id}`, { method: 'PUT', json: { image_seed }, expectedStatus: 400 });
  }
  const upload = await admin.uploadPngFile();
  const attached = await admin.request(`/api/chats/${chatId}/messages`, { method: 'POST', json: { text: 'Make this green', fileId: upload.id } });
  await waitForImage(attached.data.id);
  assert.equal(count, 2);
  assert.match(submitted.ref_images[0], /^data:image\/png;base64,/);
  assert.equal(submitted.seed, 42);
  const attachedReference = submitted.ref_images[0];
  const response = await admin.request(`/api/chats/${chatId}/messages`, { method: 'POST', json: { text: 'Make the banana red', replyToId: reply.id } });
  await waitForImage(response.data.id);
  assert.equal(count, 3);
  assert.deepEqual(submitted.ref_images, [`data:image/png;base64,${PNG}`]);
  assert.notEqual(submitted.ref_images[0], attachedReference);

  // The endpoint must not let a reference escape its source chat.
  const otherChat = await admin.request('/api/chats/private', { method: 'POST', json: { targetUserId: bot.user_id } });
  const foreignReply = await admin.request(`/api/chats/${otherChat.data.id}/messages`, { method: 'POST', json: { text: 'A cup', replyToId: reply.id } });
  assert.equal(foreignReply.data.reply_to_id, null);
  await waitFor(async () => { assert.equal(count, 4); });
  assert.equal(submitted.ref_images, undefined);

  // Turning off editing must persist and must never fall back to generating a replacement.
  const disabledEdit = await admin.request(`/api/admin/local-image-bots/${bot.id}`, { method: 'PUT', json: { allow_image_edit: false } });
  assert.equal(disabledEdit.data.bot.allow_image_edit, false);
  assert.equal(disabledEdit.data.bot.image_seed, 42);
  const refused = await admin.request(`/api/chats/${chatId}/messages`, { method: 'POST', json: { text: 'Edit disabled', replyToId: reply.id } });
  await waitFor(async () => {
    const list = await admin.request(`/api/chats/${chatId}/messages`, { searchParams: { meta: 1 } });
    assert.ok(list.data.messages.some((message) => message.ai_generated && message.reply_to_id === refused.data.id && /editing is disabled/.test(message.text)));
  });
  assert.equal(count, 4);
  await admin.request(`/api/admin/local-image-bots/${bot.id}`, { method: 'PUT', json: { name: 'Renamed Image', enabled: false } });
  const state = await admin.request('/api/admin/local-image-bots');
  assert.equal(state.data.bots[0].name, 'Renamed Image');
  assert.equal(state.data.bots[0].enabled, false);
  assert.equal(state.data.bots[0].image_seed, 42);
  await admin.request(`/api/admin/local-image-bots/${bot.id}/test`, { method: 'POST', json: { prompt: 'not generated' }, expectedStatus: 400 });
  assert.equal(count, 4);
  await admin.request(`/api/admin/local-image-bots/${bot.id}`, { method: 'PUT', json: { enabled: true, image_seed: 0 } });
  await admin.request(`/api/admin/local-image-bots/${bot.id}/test`, { method: 'POST', json: { prompt: 'zero seed test' } });
  assert.equal(submitted.seed, 0);
  assert.equal(count, 5);
  const fixedCreate = await admin.request('/api/admin/local-image-bots', { method: 'POST', json: {
    name: 'Fixed Image', mention: 'fixedimage', image_seed: 4294967295,
  } });
  assert.equal(fixedCreate.data.bot.image_seed, 4294967295);
  await admin.request(`/api/admin/local-image-bots/${bot.id}`, { method: 'PUT', json: { image_seed: -1 } });
  const randomState = await admin.request('/api/admin/local-image-bots');
  assert.equal(randomState.data.bots.find((item) => item.id === bot.id).image_seed, -1);
});

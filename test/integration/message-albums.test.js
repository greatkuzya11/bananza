const test = require('node:test');
const assert = require('node:assert/strict');
const { before, after } = test;
const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');
let sandbox;
let scenario;
before(async () => {
  sandbox = await createSandbox({ name: 'message-albums' });
  scenario = await createBasicChatScenario(sandbox.baseUrl);
});
after(async () => { await sandbox?.stop(); });

test('media edits are author-only, atomic and refresh reply thumbnails in history and realtime', async () => {
  const { admin, bob, groupChat } = scenario;
  const { waitForSocketMessage } = require('../support/api');
  const first = await admin.uploadTextFile('edit-first.txt', 'first');
  const second = await admin.uploadTextFile('edit-second.txt', 'second');
  const replacement = await admin.uploadTextFile('edit-new.txt', 'replacement');
  const foreign = await bob.uploadTextFile('foreign.txt', 'foreign');
  const original = (await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST', json: { fileIds: [first.id, second.id], text: 'Before' },
  })).data;
  const reply = (await bob.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST', json: { text: 'Comment about files', replyToId: original.id },
  })).data;
  assert.deepEqual(reply.reply_attachments.map(file => file.file_id), [first.id, second.id]);
  await bob.request(`/api/messages/${original.id}`, { method: 'PATCH', json: { text: 'Forbidden', fileIds: [] }, expectedStatus: 403 });
  const bobMessage = (await bob.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST', json: { fileIds: [foreign.id] },
  })).data;
  await admin.request(`/api/messages/${bobMessage.id}`, { method: 'PATCH', json: { text: 'Admin cannot edit this' }, expectedStatus: 403 });
  for (const fileIds of [[], [foreign.id], [second.id, second.id], [999999]]) {
    await admin.request(`/api/messages/${original.id}`, { method: 'PATCH', json: { text: '', fileIds }, expectedStatus: 400 });
  }
  let history = (await admin.request(`/api/chats/${groupChat.id}/messages`)).data.messages;
  assert.deepEqual(history.find(msg => msg.id === original.id).attachments.map(file => file.file_id), [first.id, second.id]);
  assert.equal(history.find(msg => msg.id === original.id).text, 'Before');
  const copied = (await admin.request(`/api/messages/${original.id}/save-to-notes`, { method: 'POST', json: {} })).data;
  const socket = await bob.openWebSocket();
  try {
    const event = waitForSocketMessage(socket, payload => payload.type === 'message_updated' && payload.message?.id === original.id);
    const updated = (await admin.request(`/api/messages/${original.id}`, {
      method: 'PATCH', json: { text: '', fileIds: [second.id, replacement.id] },
    })).data;
    assert.deepEqual(updated.attachments.map(file => file.file_id), [second.id, replacement.id]);
    assert.equal(updated.file_id, second.id);
    assert.deepEqual((await event).message.attachments.map(file => file.file_id), [second.id, replacement.id]);
    history = (await bob.request(`/api/chats/${groupChat.id}/messages`)).data.messages;
    assert.deepEqual(history.find(msg => msg.id === reply.id).reply_attachments.map(file => file.file_id), [second.id, replacement.id]);
    await admin.request(`/uploads/${original.attachments[0].file_stored}`, { expectedStatus: 404 });
    for (const file of copied.attachments) await admin.request(`/uploads/${file.file_stored}`);
    const cleared = (await admin.request(`/api/messages/${original.id}`, {
      method: 'PATCH', json: { text: 'Caption remains', fileIds: [] },
    })).data;
    assert.deepEqual(cleared.attachments, []);
    assert.equal(cleared.file_id, null);
    history = (await bob.request(`/api/chats/${groupChat.id}/messages`)).data.messages;
    assert.deepEqual(history.find(msg => msg.id === reply.id).reply_attachments, []);
  } finally { socket.close(); }
});

test('attachment albums preserve order, validation, realtime, copying and all media pages', async () => {
  const { admin, bob, groupChat, privateChat } = scenario;
  const { waitForSocketMessage } = require('../support/api');
  const socket = await bob.openWebSocket();
  try {
    const document = await admin.uploadTextFile('album-second-document.txt', 'album document');
    const images = [];
    for (let i = 0; i < 5; i++) {
      const form = new FormData();
      form.append('file', new Blob(['image fixture'], { type: 'image/png' }), `album-${i}.png`);
      images.push((await admin.request('/api/upload', { method: 'POST', formData: form })).data);
    }
    const ids = [document.id, ...images.map(file => file.id)];
    const clientId = `album-${Date.now()}`;
    const event = waitForSocketMessage(socket, payload => payload.type === 'message' && payload.message?.client_id === clientId);
    const { data: album } = await admin.request(`/api/chats/${groupChat.id}/messages`, {
      method: 'POST', json: { fileIds: ids, client_id: clientId, text: 'Album caption' },
    });
    assert.deepEqual(album.attachments.map(file => file.file_id), ids);
    assert.equal(album.file_id, document.id);
    assert.deepEqual((await event).message.attachments.map(file => file.file_id), ids);
    const retry = await admin.request(`/api/chats/${groupChat.id}/messages`, {
      method: 'POST', json: { fileIds: ids, client_id: clientId },
    });
    assert.equal(retry.data.id, album.id);
    const page = await bob.request(`/api/chats/${groupChat.id}/media?limit=1`);
    assert.equal(page.data.media[0].id, album.id);
    assert.equal(page.data.media[0].attachments.length, 6);
    const search = await bob.request('/api/messages/search', { searchParams: { chatId: groupChat.id, q: 'album-second-document' } });
    assert.ok(search.data.some(row => row.id === album.id && row.attachments.length === 6));
    for (const json of [ { fileIds: [document.id, document.id] }, { fileIds: ids, fileId: document.id },
      { fileIds: Array.from({ length: 11 }, (_, i) => i + 1) }, { fileIds: ['1'] }, { fileIds: [999999] } ]) {
      await admin.request(`/api/chats/${groupChat.id}/messages`, { method: 'POST', json, expectedStatus: 400 });
    }
    await bob.request(`/api/chats/${groupChat.id}/messages`, { method: 'POST', json: { fileIds: ids }, expectedStatus: 400 });
    const forwarded = (await admin.request(`/api/messages/${album.id}/forward`, {
      method: 'POST', json: { targetChatId: privateChat.id },
    })).data;
    const saved = (await admin.request(`/api/messages/${album.id}/save-to-notes`, { method: 'POST', json: {} })).data;
    for (const copy of [forwarded, saved]) {
      assert.deepEqual(copy.attachments.map(file => file.file_name), album.attachments.map(file => file.file_name));
      assert.ok(copy.attachments.every(file => !ids.includes(file.file_id)));
    }
    await admin.request(`/api/messages/${album.id}`, { method: 'DELETE' });
    for (const file of album.attachments) await admin.request(`/uploads/${file.file_stored}`, { expectedStatus: 404 });
    for (const copy of [forwarded, saved]) {
      for (const file of copy.attachments) await admin.request(`/uploads/${file.file_stored}`);
    }
  } finally { socket.close(); }
});

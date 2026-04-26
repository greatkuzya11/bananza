const test = require('node:test');
const assert = require('node:assert/strict');
const { before, after } = require('node:test');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');

let sandbox;
let scenario;

before(async () => {
  sandbox = await createSandbox({ name: 'chat-api' });
  scenario = await createBasicChatScenario(sandbox.baseUrl);
});

after(async () => {
  await sandbox?.stop?.();
});

test('auth and chat membership endpoints return expected data', async () => {
  const { admin, bob, groupChat, privateChat } = scenario;

  const me = await admin.request('/api/auth/me');
  assert.equal(me.data.user.id, admin.user.id);

  const users = await bob.request('/api/users');
  assert.ok(users.data.some((user) => user.id === admin.user.id));

  const chatList = await bob.request('/api/chats');
  assert.ok(chatList.data.some((chat) => chat.id === groupChat.id));
  assert.ok(chatList.data.some((chat) => chat.id === privateChat.id));

  const members = await bob.request(`/api/chats/${groupChat.id}/members`);
  assert.equal(members.data.length, 3);

  const mentionTargets = await bob.request(`/api/chats/${groupChat.id}/mention-targets`);
  assert.ok(mentionTargets.data.targets.some((target) => target.user_id === admin.user.id));
});

test('chat preferences, sidebar pinning and hide/unhide work through public routes', async () => {
  const { admin, bob, groupChat, privateChat } = scenario;

  const prefsBefore = await bob.request(`/api/chats/${groupChat.id}/preferences`);
  assert.equal(prefsBefore.data.preferences.notify_enabled, true);

  const prefsAfter = await bob.request(`/api/chats/${groupChat.id}/preferences`, {
    method: 'PUT',
    json: {
      notify_enabled: false,
      sounds_enabled: false,
    },
  });
  assert.equal(prefsAfter.data.preferences.notify_enabled, false);
  assert.equal(prefsAfter.data.preferences.sounds_enabled, false);

  const pinOne = await admin.request(`/api/chats/${groupChat.id}/sidebar-pin`, {
    method: 'PUT',
    json: { pinned: true },
  });
  const pinTwo = await admin.request(`/api/chats/${privateChat.id}/sidebar-pin`, {
    method: 'PUT',
    json: { pinned: true },
  });
  assert.equal(pinOne.data.sidebar_pin.is_pinned, true);
  assert.equal(pinTwo.data.sidebar_pin.is_pinned, true);

  const moved = await admin.request(`/api/chats/${privateChat.id}/sidebar-pin/move`, {
    method: 'POST',
    json: { direction: 'up' },
  });
  assert.equal(typeof moved.data.moved, 'boolean');

  await bob.request(`/api/chats/${privateChat.id}/hide`, {
    method: 'POST',
    json: {},
  });
  const hiddenChats = await bob.request('/api/chats/hidden');
  assert.ok(hiddenChats.data.chats.some((chat) => chat.id === privateChat.id));

  await bob.request(`/api/chats/${privateChat.id}/unhide`, {
    method: 'POST',
    json: {},
  });
  const hiddenAfter = await bob.request('/api/chats/hidden');
  assert.equal(hiddenAfter.data.chats.some((chat) => chat.id === privateChat.id), false);
});

test('creator-only chat management routes enforce permissions and mutate state', async () => {
  const { admin, bob } = scenario;

  const { data: managedChat } = await admin.request('/api/chats', {
    method: 'POST',
    json: {
      name: `Managed ${Date.now()}`,
      type: 'group',
      memberIds: [bob.user.id],
    },
  });

  await bob.request(`/api/chats/${managedChat.id}/pin-settings`, {
    method: 'PUT',
    json: { allow_unpin_any_pin: true },
    expectedStatus: 403,
  });
  await bob.request(`/api/chats/${managedChat.id}/context-transform-settings`, {
    method: 'PUT',
    json: { context_transform_enabled: true },
    expectedStatus: 403,
  });

  const pinSettings = await admin.request(`/api/chats/${managedChat.id}/pin-settings`, {
    method: 'PUT',
    json: { allow_unpin_any_pin: true },
  });
  assert.equal(pinSettings.data.allow_unpin_any_pin, 1);

  const ctxSettings = await admin.request(`/api/chats/${managedChat.id}/context-transform-settings`, {
    method: 'PUT',
    json: { context_transform_enabled: true },
  });
  assert.equal(ctxSettings.data.context_transform_enabled, 1);

  await admin.request(`/api/chats/${managedChat.id}/messages`, {
    method: 'POST',
    json: { text: 'Message before history clear' },
  });

  await bob.request(`/api/chats/${managedChat.id}/history`, {
    method: 'DELETE',
    expectedStatus: 403,
  });
  const cleared = await admin.request(`/api/chats/${managedChat.id}/history`, {
    method: 'DELETE',
  });
  assert.equal(cleared.data.ok, true);

  const messagesAfterClear = await admin.request(`/api/chats/${managedChat.id}/messages`, {
    searchParams: { meta: 1 },
  });
  assert.equal(messagesAfterClear.data.messages.length, 0);

  const deleted = await admin.request(`/api/chats/${managedChat.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleted.data.ok, true);
});

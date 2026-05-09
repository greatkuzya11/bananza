const test = require('node:test');
const assert = require('node:assert/strict');
const { before, after } = require('node:test');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');
const { waitForSocketMessage } = require('../support/api');

let sandbox;
let scenario;

before(async () => {
  sandbox = await createSandbox({
    name: 'calls-api',
    env: {
      LIVEKIT_WS_URL: 'ws://127.0.0.1:7880',
      LIVEKIT_API_KEY: 'devkey',
      LIVEKIT_API_SECRET: 'devsecret',
    },
  });
  scenario = await createBasicChatScenario(sandbox.baseUrl);
});

after(async () => {
  await sandbox?.stop?.();
});

test('calls are disabled by default and exposed through public features', async () => {
  const { admin, groupChat } = scenario;

  const features = await admin.request('/api/features');
  assert.equal(features.data.calls_enabled, false);
  assert.equal(features.data.calls_admin_enabled, false);
  assert.equal(features.data.livekit_ready, true);

  const blockedStart = await admin.request(`/api/chats/${groupChat.id}/calls`, {
    method: 'POST',
    json: {},
    expectedStatus: 403,
  });
  assert.equal(blockedStart.data.code, 'calls_disabled');
});

test('admin can enable calls and users can run call lifecycle', async () => {
  const { admin, bob, groupChat } = scenario;
  const bobSocket = await bob.openWebSocket();

  try {
    await bob.request('/api/admin/call-settings', { expectedStatus: 403 });

    const settings = await admin.request('/api/admin/call-settings', {
      method: 'PUT',
      json: {
        calls_enabled: true,
        allow_private_calls: true,
        allow_group_calls: true,
        ring_timeout_ms: 30000,
        livekit_ws_url: 'ws://admin-livekit.local:7880',
        livekit_api_key: 'admin-livekit-key',
        livekit_api_secret: 'admin-livekit-secret',
      },
    });
    assert.equal(settings.data.settings.calls_enabled, true);
    assert.equal(settings.data.livekit_ready, true);
    assert.equal(settings.data.livekit_config.ws_url, 'ws://admin-livekit.local:7880');
    assert.equal(settings.data.livekit_config.masked_api_secret, 'adm...cret');
    assert.equal(JSON.stringify(settings.data).includes('admin-livekit-secret'), false);

    const features = await admin.request('/api/features');
    assert.equal(features.data.calls_enabled, true);

    const invitePromise = waitForSocketMessage(bobSocket, (msg) => msg.type === 'call_invite');
    const created = await admin.request(`/api/chats/${groupChat.id}/calls`, {
      method: 'POST',
      json: {},
      expectedStatus: 201,
    });
    assert.equal(created.data.call.status, 'active');
    assert.equal(created.data.call.chat_id, groupChat.id);
    assert.equal(created.data.call.livekit_room_name, `bananza-call-${created.data.call.id}`);
    assert.ok(created.data.call.message_id);

    const activeMessages = await admin.request(`/api/chats/${groupChat.id}/messages`, {
      searchParams: { meta: 1 },
    });
    const activeCard = activeMessages.data.messages.find((message) => Number(message.id) === Number(created.data.call.message_id));
    assert.ok(activeCard);
    assert.equal(activeCard.is_call_message, true);
    assert.equal(activeCard.call.status, 'active');
    assert.equal(activeCard.call.can_join, true);

    const invite = await invitePromise;
    assert.equal(invite.call.id, created.data.call.id);
    assert.equal(invite.call.chat_id, groupChat.id);

    const duplicate = await admin.request(`/api/chats/${groupChat.id}/calls`, {
      method: 'POST',
      json: {},
      expectedStatus: 409,
    });
    assert.equal(duplicate.data.code, 'call_already_active');

    const activeForBob = await bob.request('/api/calls/active');
    assert.equal(activeForBob.data.calls.some((call) => Number(call.id) === Number(created.data.call.id)), true);

    const tokenResponse = await bob.request(`/api/calls/${created.data.call.id}/token`, {
      method: 'POST',
      json: {},
    });
    assert.equal(tokenResponse.data.livekit.url, 'ws://admin-livekit.local:7880');
    assert.equal(typeof tokenResponse.data.livekit.token, 'string');
    assert.ok(tokenResponse.data.livekit.token.length > 20);
    assert.equal(
      tokenResponse.data.call.participants.some((participant) => (
        Number(participant.user_id) === Number(bob.user.id) && participant.state === 'joined'
      )),
      true
    );

    const ended = await admin.request(`/api/calls/${created.data.call.id}/end`, {
      method: 'POST',
      json: {},
    });
    assert.equal(ended.data.call.status, 'ended');
    assert.equal(ended.data.call.ended_reason, 'ended');
    assert.equal(typeof ended.data.call.duration_ms, 'number');

    const endedMessages = await admin.request(`/api/chats/${groupChat.id}/messages`, {
      searchParams: { meta: 1 },
    });
    const endedCard = endedMessages.data.messages.find((message) => Number(message.id) === Number(created.data.call.message_id));
    assert.ok(endedCard);
    assert.equal(endedCard.call.status, 'ended');
    assert.equal(endedCard.call.can_join, false);

    const activeAfterEnd = await bob.request(`/api/chats/${groupChat.id}/calls/active`);
    assert.equal(activeAfterEnd.data.call, null);
  } finally {
    bobSocket.close();
  }
});

test('disabling call settings ends active calls', async () => {
  const { admin, bob, privateChat } = scenario;
  await admin.request('/api/admin/call-settings', {
    method: 'PUT',
    json: {
      calls_enabled: true,
      allow_private_calls: true,
      allow_group_calls: true,
    },
  });

  const bobSocket = await bob.openWebSocket();
  try {
    const endedPromise = waitForSocketMessage(bobSocket, (msg) => msg.type === 'call_ended');
    const created = await admin.request(`/api/chats/${privateChat.id}/calls`, {
      method: 'POST',
      json: {},
      expectedStatus: 201,
    });
    assert.equal(created.data.call.status, 'active');

    const disabled = await admin.request('/api/admin/call-settings', {
      method: 'PUT',
      json: { calls_enabled: false },
    });
    assert.equal(disabled.data.settings.calls_enabled, false);
    assert.equal(disabled.data.ended_calls >= 1, true);

    const ended = await endedPromise;
    assert.equal(ended.call.id, created.data.call.id);
    assert.equal(ended.call.status, 'ended');
  } finally {
    bobSocket.close();
  }
});

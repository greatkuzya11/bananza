const test = require('node:test');
const assert = require('node:assert/strict');
const { before, after } = require('node:test');
const jwt = require('jsonwebtoken');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');
const { createSession, waitForSocketMessage } = require('../support/api');

let sandbox;
let scenario;

function tokenPublishSources(token) {
  const decoded = jwt.decode(token) || {};
  const sources = decoded.video?.canPublishSources || decoded.video?.can_publish_sources || [];
  const names = {
    1: 'camera',
    2: 'microphone',
    3: 'screen_share',
    4: 'screen_share_audio',
  };
  return Array.isArray(sources) ? sources.map((source) => names[source] || String(source).toLowerCase()) : [];
}

function waitForNoSocketMessage(socket, predicate, timeoutMs = 250) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      resolve();
    }, timeoutMs);

    function onMessage(raw) {
      try {
        const message = JSON.parse(String(raw));
        if (!predicate(message)) return;
        clearTimeout(timer);
        socket.off('message', onMessage);
        reject(new Error(`Unexpected WebSocket message: ${message.type}`));
      } catch {}
    }

    socket.on('message', onMessage);
  });
}

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
    assert.equal(created.data.call.media_kind, 'video');
    assert.equal(created.data.call.room_mode, 'ringing');
    assert.ok(created.data.call.message_id);

    const activeMessages = await admin.request(`/api/chats/${groupChat.id}/messages`, {
      searchParams: { meta: 1 },
    });
    const activeCard = activeMessages.data.messages.find((message) => Number(message.id) === Number(created.data.call.message_id));
    assert.ok(activeCard);
    assert.equal(activeCard.is_call_message, true);
    assert.equal(activeCard.call.status, 'active');
    assert.equal(activeCard.call.can_join, true);

    const forbiddenLink = await bob.request(`/api/calls/${created.data.call.id}/external-link`, {
      method: 'POST',
      json: {},
      expectedStatus: 403,
    });
    assert.equal(forbiddenLink.data.code, 'forbidden');

    const externalLink = await admin.request(`/api/calls/${created.data.call.id}/external-link`, {
      method: 'POST',
      json: {},
    });
    assert.match(externalLink.data.external_url, /\/call\/[A-Za-z0-9_-]+$/);
    const inviteToken = externalLink.data.external_url.split('/').pop();
    assert.ok(inviteToken);

    const publicGuest = createSession(sandbox.baseUrl);
    const publicStatus = await publicGuest.request(`/api/calls/external/${inviteToken}`);
    assert.equal(publicStatus.data.ended, false);
    assert.equal(publicStatus.data.call.id, created.data.call.id);
    assert.equal(publicStatus.data.call.status, 'active');
    assert.equal(Object.prototype.hasOwnProperty.call(publicStatus.data.call, 'chat_id'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(publicStatus.data.call, 'livekit_room_name'), false);

    const missingGuestName = await publicGuest.request(`/api/calls/external/${inviteToken}/token`, {
      method: 'POST',
      json: { display_name: '' },
      expectedStatus: 400,
    });
    assert.equal(missingGuestName.data.code, 'display_name_required');

    const guestToken = await publicGuest.request(`/api/calls/external/${inviteToken}/token`, {
      method: 'POST',
      json: { display_name: 'Guest User' },
      expectedStatus: 201,
    });
    assert.equal(guestToken.data.livekit.url, 'ws://admin-livekit.local:7880');
    const decodedGuestToken = jwt.decode(guestToken.data.livekit.token) || {};
    assert.match(decodedGuestToken.sub || '', new RegExp(`^guest:${created.data.call.id}:`));
    assert.equal(decodedGuestToken.name, 'Guest User');
    const guestSources = tokenPublishSources(guestToken.data.livekit.token);
    assert.equal(guestSources.some((source) => source.includes('camera')), true);
    assert.equal(guestSources.some((source) => source.includes('microphone')), true);
    assert.equal(guestSources.some((source) => source.includes('screen_share')), true);

    const guestUpdatePromise = waitForSocketMessage(bobSocket, (msg) => (
      msg.type === 'call_participant_updated'
      && Number(msg.call?.id || 0) === Number(created.data.call.id)
      && msg.participant?.guest_id === guestToken.data.guest.guest_id
      && msg.participant?.state === 'joined'
    ));
    const guestJoined = await publicGuest.request(`/api/calls/external/${inviteToken}/joined`, {
      method: 'POST',
      json: {
        guest_id: guestToken.data.guest.guest_id,
        session_token: guestToken.data.guest.session_token,
      },
    });
    assert.equal(guestJoined.data.call.participant_count, 1);
    assert.equal(
      guestJoined.data.call.participants.some((participant) => (
        participant.guest_id === guestToken.data.guest.guest_id
        && participant.display_name === 'Guest User'
        && participant.state === 'joined'
      )),
      true
    );
    await guestUpdatePromise;

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
    const videoSources = tokenPublishSources(tokenResponse.data.livekit.token);
    assert.equal(videoSources.some((source) => source.includes('camera')), true);
    assert.equal(videoSources.some((source) => source.includes('microphone')), true);
    assert.equal(
      tokenResponse.data.call.participants.some((participant) => (
        Number(participant.user_id) === Number(bob.user.id) && participant.state === 'invited'
      )),
      true
    );

    const joinedResponse = await bob.request(`/api/calls/${created.data.call.id}/joined`, {
      method: 'POST',
      json: {},
    });
    assert.equal(
      joinedResponse.data.call.participants.some((participant) => (
        Number(participant.user_id) === Number(bob.user.id) && participant.state === 'joined'
      )),
      true
    );
    assert.equal(joinedResponse.data.call.participant_count, 2);

    const guestLeft = await publicGuest.request(`/api/calls/external/${inviteToken}/leave`, {
      method: 'POST',
      json: {
        guest_id: guestToken.data.guest.guest_id,
        session_token: guestToken.data.guest.session_token,
      },
    });
    assert.equal(guestLeft.data.call.status, 'active');
    assert.equal(guestLeft.data.call.participant_count, 1);
    assert.equal(
      guestLeft.data.call.participants.some((participant) => (
        participant.guest_id === guestToken.data.guest.guest_id
        && participant.state === 'left'
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

    const publicEnded = await publicGuest.request(`/api/calls/external/${inviteToken}`);
    assert.equal(publicEnded.data.ended, true);
    assert.equal(publicEnded.data.call.status, 'ended');

    const guestTokenAfterEnd = await publicGuest.request(`/api/calls/external/${inviteToken}/token`, {
      method: 'POST',
      json: { display_name: 'Late Guest' },
      expectedStatus: 410,
    });
    assert.equal(guestTokenAfterEnd.data.code, 'call_not_active');
  } finally {
    bobSocket.close();
  }
});

test('single-member group video calls start as external invite rooms', async () => {
  const { admin } = scenario;
  await admin.request('/api/admin/call-settings', {
    method: 'PUT',
    json: {
      calls_enabled: true,
      allow_private_calls: true,
      allow_group_calls: true,
      screen_share_enabled: true,
      ring_timeout_ms: 30000,
    },
  });

  const soloGroup = await admin.request('/api/chats', {
    method: 'POST',
    json: {
      name: `Solo Call ${Date.now()}`,
      type: 'group',
      memberIds: [],
    },
  });

  let createdCallId = 0;
  try {
    const created = await admin.request(`/api/chats/${soloGroup.data.id}/calls`, {
      method: 'POST',
      json: { media_kind: 'video' },
      expectedStatus: 201,
    });
    createdCallId = Number(created.data.call.id || 0);
    assert.equal(created.data.call.status, 'active');
    assert.equal(created.data.call.chat_id, soloGroup.data.id);
    assert.equal(created.data.call.media_kind, 'video');
    assert.equal(created.data.call.room_mode, 'room');
    assert.equal(created.data.call.ring_expires_at, null);
    assert.equal(created.data.call.participants.length, 1);
    assert.equal(Number(created.data.call.participants[0].user_id), Number(admin.user.id));
    assert.equal(created.data.call.participants[0].state, 'invited');

    const activeMessages = await admin.request(`/api/chats/${soloGroup.data.id}/messages`, {
      searchParams: { meta: 1 },
    });
    const activeCard = activeMessages.data.messages.find((message) => Number(message.id) === Number(created.data.call.message_id));
    assert.ok(activeCard);
    assert.equal(activeCard.call.room_mode, 'room');
    assert.equal(activeCard.call_message.room_mode, 'room');

    const externalLink = await admin.request(`/api/calls/${createdCallId}/external-link`, {
      method: 'POST',
      json: {},
    });
    assert.match(externalLink.data.external_url, /\/call\/[A-Za-z0-9_-]+$/);
    const inviteToken = externalLink.data.external_url.split('/').pop();
    assert.ok(inviteToken);

    const publicGuest = createSession(sandbox.baseUrl);
    const publicStatus = await publicGuest.request(`/api/calls/external/${inviteToken}`);
    assert.equal(publicStatus.data.ended, false);
    assert.equal(publicStatus.data.call.id, createdCallId);
    assert.equal(publicStatus.data.call.media_kind, 'video');
    assert.equal(publicStatus.data.call.room_mode, 'room');
    assert.equal(publicStatus.data.call.status, 'active');

    const guestToken = await publicGuest.request(`/api/calls/external/${inviteToken}/token`, {
      method: 'POST',
      json: { display_name: 'External Guest' },
      expectedStatus: 201,
    });
    assert.equal(guestToken.data.livekit.url, 'ws://admin-livekit.local:7880');
    const decodedGuestToken = jwt.decode(guestToken.data.livekit.token) || {};
    assert.match(decodedGuestToken.sub || '', new RegExp(`^guest:${createdCallId}:`));
    assert.equal(decodedGuestToken.name, 'External Guest');
    const guestSources = tokenPublishSources(guestToken.data.livekit.token);
    assert.equal(guestSources.some((source) => source.includes('camera')), true);
    assert.equal(guestSources.some((source) => source.includes('microphone')), true);
  } finally {
    if (createdCallId) {
      await admin.request(`/api/calls/${createdCallId}/end`, {
        method: 'POST',
        json: {},
        expectedStatus: [200, 404],
      });
    }
  }
});

test('voice calls ring privately and group voice rooms are joinable without invites', async () => {
  const { admin, bob, groupChat, privateChat } = scenario;
  await admin.request('/api/admin/call-settings', {
    method: 'PUT',
    json: {
      calls_enabled: true,
      allow_private_calls: true,
      allow_group_calls: true,
      screen_share_enabled: true,
      ring_timeout_ms: 30000,
    },
  });

  const bobSocket = await bob.openWebSocket();
  try {
    const privateInvitePromise = waitForSocketMessage(bobSocket, (msg) => msg.type === 'call_invite');
    const privateVoice = await admin.request(`/api/chats/${privateChat.id}/calls`, {
      method: 'POST',
      json: { media_kind: 'voice' },
      expectedStatus: 201,
    });
    assert.equal(privateVoice.data.call.media_kind, 'voice');
    assert.equal(privateVoice.data.call.room_mode, 'ringing');
    assert.ok(privateVoice.data.call.ring_expires_at);

    const privateVoiceMessages = await admin.request(`/api/chats/${privateChat.id}/messages`, {
      searchParams: { meta: 1 },
    });
    const privateVoiceCard = privateVoiceMessages.data.messages.find((message) => Number(message.id) === Number(privateVoice.data.call.message_id));
    assert.ok(privateVoiceCard);
    assert.equal(privateVoiceCard.text, 'Voice call');
    assert.equal(privateVoiceCard.call.media_kind, 'voice');
    assert.equal(privateVoiceCard.call_message.media_kind, 'voice');

    const privateInvite = await privateInvitePromise;
    assert.equal(privateInvite.call.id, privateVoice.data.call.id);
    assert.equal(privateInvite.call.media_kind, 'voice');

    const privateToken = await bob.request(`/api/calls/${privateVoice.data.call.id}/token`, {
      method: 'POST',
      json: {},
    });
    assert.deepEqual(tokenPublishSources(privateToken.data.livekit.token), ['microphone']);

    await admin.request(`/api/calls/${privateVoice.data.call.id}/end`, {
      method: 'POST',
      json: {},
    });

    const groupVoice = await admin.request(`/api/chats/${groupChat.id}/calls`, {
      method: 'POST',
      json: { media_kind: 'voice' },
      expectedStatus: 201,
    });
    assert.equal(groupVoice.data.call.media_kind, 'voice');
    assert.equal(groupVoice.data.call.room_mode, 'room');
    assert.equal(groupVoice.data.call.ring_expires_at, null);

    const groupVoiceMessages = await admin.request(`/api/chats/${groupChat.id}/messages`, {
      searchParams: { meta: 1 },
    });
    const groupVoiceCard = groupVoiceMessages.data.messages.find((message) => Number(message.id) === Number(groupVoice.data.call.message_id));
    assert.ok(groupVoiceCard);
    assert.equal(groupVoiceCard.text, 'Voice room');
    assert.equal(groupVoiceCard.call.media_kind, 'voice');
    assert.equal(groupVoiceCard.call.room_mode, 'room');
    assert.equal(groupVoiceCard.call_message.media_kind, 'voice');
    assert.equal(groupVoiceCard.call_message.room_mode, 'room');

    await waitForNoSocketMessage(bobSocket, (msg) => msg.type === 'call_invite' && msg.call?.id === groupVoice.data.call.id);

    const activeForBob = await bob.request('/api/calls/active');
    assert.equal(activeForBob.data.calls.some((call) => Number(call.id) === Number(groupVoice.data.call.id)), true);

    const duplicate = await admin.request(`/api/chats/${groupChat.id}/calls`, {
      method: 'POST',
      json: { media_kind: 'video' },
      expectedStatus: 409,
    });
    assert.equal(duplicate.data.code, 'call_already_active');

    const joined = await bob.request(`/api/calls/${groupVoice.data.call.id}/joined`, {
      method: 'POST',
      json: {},
    });
    assert.equal(joined.data.call.participant_count, 1);

    const left = await bob.request(`/api/calls/${groupVoice.data.call.id}/leave`, {
      method: 'POST',
      json: {},
    });
    assert.equal(left.data.call.status, 'ended');
    assert.equal(left.data.call.ended_reason, 'empty');
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

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { before, after } = require('node:test');
const Database = require('better-sqlite3');

const { createSession, makeUser } = require('../support/api');
const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario, waitFor } = require('../support/scenario');

let sandbox;
let scenario;
const POSTER_JPEG_BYTES = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb000100ffd9', 'hex');

before(async () => {
  sandbox = await createSandbox({ name: 'chat-api' });
  scenario = await createBasicChatScenario(sandbox.baseUrl);
});

after(async () => {
  await sandbox?.stop?.();
});

async function createOpenAiBot(admin, {
  name,
  mention,
  visibleToUsers = true,
} = {}) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const botName = name || `Bot ${token}`.slice(0, 30);
  const botMention = mention || `bot_${token}`.slice(0, 24);
  const response = await admin.request('/api/admin/ai-bots', {
    method: 'POST',
    json: {
      name: botName,
      mention: botMention,
      enabled: true,
      visible_to_users: visibleToUsers,
      response_model: 'gpt-4o-mini',
      summary_model: 'gpt-4o-mini',
    },
  });
  return response.data.bot;
}

async function createOpenAiConvertBot(admin, {
  name,
  availableInAllChats = false,
  enabled = true,
} = {}) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const response = await admin.request('/api/admin/openai-convert-bots', {
    method: 'POST',
    json: {
      name: name || `Convert ${token}`.slice(0, 30),
      enabled,
      available_in_all_chats: availableInAllChats,
      response_model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 1000,
      transform_prompt: 'Rewrite the source text clearly and return only the rewritten text.',
    },
  });
  return response.data.bot;
}

async function createOpenAiChatShotBot(admin, {
  name,
  availableInAllChats = false,
  enabled = true,
} = {}) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const response = await admin.request('/api/admin/openai-chatshot-bots', {
    method: 'POST',
    json: {
      name: name || `ChatShot ${token}`.slice(0, 30),
      enabled,
      available_in_all_chats: availableInAllChats,
      response_model: 'gpt-4o-mini',
      image_model: 'gpt-image-2',
      image_resolution: '1024x1024',
      image_quality: 'auto',
      image_background: 'auto',
      image_output_format: 'png',
      temperature: 0.3,
      max_tokens: 900,
      chatshot_context_limit: 12,
    },
  });
  return response.data.bot;
}

async function enableOpenAiForTests(admin, overrides = {}) {
  const response = await admin.request('/api/admin/ai-bots/settings', {
    method: 'PUT',
    json: {
      enabled: true,
      openai_api_key: 'sk-ai-test',
      default_response_model: 'gpt-4o-mini',
      ...overrides,
    },
  });
  return response.data.settings;
}

function modelForProvider(provider) {
  if (provider === 'deepseek') return 'deepseek-chat';
  if (provider === 'qwen') return 'qwen';
  if (provider === 'yandex') return 'yandexgpt/latest';
  if (provider === 'grok') return 'grok-4.20-reasoning';
  return 'gpt-4o-mini';
}

function imageModelForProvider(provider) {
  return provider === 'grok' ? 'grok-imagine-image' : 'gpt-image-2';
}

function buildBotPayload({ provider = 'openai', kind = 'text', label = 'Bot' } = {}) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const mentionBase = `${provider}_${kind}_${token}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  return {
    name: `${label} ${token}`.slice(0, 50),
    mention: mentionBase.slice(0, 28),
    provider,
    kind,
    enabled: true,
    visible_to_users: true,
    available_in_all_chats: false,
    response_model: modelForProvider(provider),
    summary_model: modelForProvider(provider),
    image_model: imageModelForProvider(provider),
    image_aspect_ratio: '1:1',
    image_resolution: provider === 'grok' ? '1k' : '1024x1024',
    image_quality: 'auto',
    image_background: 'auto',
    image_output_format: 'png',
    allow_text: true,
    allow_image_generate: kind === 'image' || kind === 'universal' || kind === 'chatshot',
    allow_image_edit: kind === 'image' || kind === 'universal',
    allow_document: kind === 'universal',
    image_risk_filter_enabled: true,
    transform_prompt: 'Rewrite the source text clearly and return only the rewritten text.',
    chatshot_context_limit: 33,
    temperature: 0.3,
    max_tokens: 1000,
  };
}

async function createAdminBot(admin, { route, provider = 'openai', kind = 'text', label = 'Bot' }) {
  const response = await admin.request(route, {
    method: 'POST',
    json: buildBotPayload({ provider, kind, label }),
  });
  assert.ok(response.data?.bot?.id, `expected ${label} bot to be created`);
  return response.data.bot;
}

function responseHasBot(response, botId) {
  return Array.isArray(response.data?.bots)
    && response.data.bots.some((bot) => Number(bot.id) === Number(botId));
}

function responseHasFolderForBot(response, botId) {
  return Array.isArray(response.data?.folders)
    && response.data.folders.some((folder) => Number(folder.bot_id) === Number(botId));
}

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

test('profile status persists and is exposed through user payloads', async () => {
  const { admin, bob, groupChat, privateChat } = scenario;

  const standard = await bob.request('/api/profile', {
    method: 'PUT',
    json: { profileStatusKey: 'available', profileStatusText: 'ignored' },
  });
  assert.equal(standard.data.user.profile_status_key, 'available');
  assert.equal(standard.data.user.profile_status_text, '');

  await bob.request('/api/profile', {
    method: 'PUT',
    json: { profileStatusKey: 'unknown' },
    expectedStatus: 400,
  });
  await bob.request('/api/profile', {
    method: 'PUT',
    json: { profileStatusKey: 'custom', profileStatusText: '' },
    expectedStatus: 400,
  });
  await bob.request('/api/profile', {
    method: 'PUT',
    json: { profileStatusKey: 'custom', profileStatusText: 'x'.repeat(49) },
    expectedStatus: 400,
  });

  const custom = await bob.request('/api/profile', {
    method: 'PUT',
    json: { profileStatusKey: 'custom', profileStatusText: '  Focus   mode \n until 18:00  ' },
  });
  assert.equal(custom.data.user.profile_status_key, 'custom');
  assert.equal(custom.data.user.profile_status_text, 'Focus mode until 18:00');

  const me = await bob.request('/api/auth/me');
  assert.equal(me.data.user.profile_status_key, 'custom');
  assert.equal(me.data.user.profile_status_text, 'Focus mode until 18:00');

  const users = await admin.request('/api/users');
  const bobUser = users.data.find((user) => Number(user.id) === Number(bob.user.id));
  assert.equal(bobUser.profile_status_key, 'custom');
  assert.equal(bobUser.profile_status_text, 'Focus mode until 18:00');

  const members = await admin.request(`/api/chats/${groupChat.id}/members`);
  const bobMember = members.data.find((user) => Number(user.id) === Number(bob.user.id));
  assert.equal(bobMember.profile_status_key, 'custom');
  assert.equal(bobMember.profile_status_text, 'Focus mode until 18:00');

  const mentions = await admin.request(`/api/chats/${groupChat.id}/mention-targets`);
  const bobMention = mentions.data.targets.find((user) => Number(user.user_id) === Number(bob.user.id));
  assert.equal(bobMention.profile_status_key, 'custom');
  assert.equal(bobMention.profile_status_text, 'Focus mode until 18:00');

  const chatList = await admin.request('/api/chats');
  const privateEntry = chatList.data.find((chat) => Number(chat.id) === Number(privateChat.id));
  assert.equal(privateEntry.private_user.profile_status_key, 'custom');
  assert.equal(privateEntry.private_user.profile_status_text, 'Focus mode until 18:00');

  const sent = await bob.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: { text: 'profile status payload check' },
  });
  assert.equal(sent.data.profile_status_key, 'custom');
  assert.equal(sent.data.profile_status_text, 'Focus mode until 18:00');

  const cleared = await bob.request('/api/profile', {
    method: 'PUT',
    json: { profileStatusKey: '', profileStatusText: 'ignored' },
  });
  assert.equal(cleared.data.user.profile_status_key, '');
  assert.equal(cleared.data.user.profile_status_text, '');
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

  const uploadedVideo = await admin.uploadFile({
    filename: 'history-video.mp4',
    mimeType: 'video/mp4',
    body: 'history-video',
    poster: {
      filename: 'history-video.jpg',
      mimeType: 'image/jpeg',
      body: POSTER_JPEG_BYTES,
    },
  });

  await admin.request(`/api/chats/${managedChat.id}/messages`, {
    method: 'POST',
    json: { text: 'Message before history clear' },
  });
  const videoMessage = await admin.request(`/api/chats/${managedChat.id}/messages`, {
    method: 'POST',
    json: {
      text: 'Video before history clear',
      fileId: uploadedVideo.id,
    },
  });
  assert.equal(videoMessage.data.file_poster_available, true);
  const posterBeforeClear = await admin.request(`/uploads/${uploadedVideo.stored_name}/poster`);
  assert.equal(posterBeforeClear.headers['content-type'], 'image/jpeg');

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
  await admin.request(`/uploads/${uploadedVideo.stored_name}/poster`, {
    expectedStatus: 404,
  });

  const deleted = await admin.request(`/api/chats/${managedChat.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleted.data.ok, true);
});

test('chat system events are persisted for membership, bots, profile changes and history clear', async () => {
  const { admin, bob, carol } = scenario;
  const suffix = Date.now();
  const dave = createSession(sandbox.baseUrl);
  await dave.register(makeUser('sysdave'));

  const { data: chat } = await admin.request('/api/chats', {
    method: 'POST',
    json: {
      name: `System ${suffix}`,
      type: 'group',
      memberIds: [bob.user.id, carol.user.id],
    },
  });
  const chatId = Number(chat.id);

  const initial = await admin.request(`/api/chats/${chatId}/messages`, { searchParams: { meta: 1 } });
  assert.deepEqual(initial.data.messages, []);
  assert.ok(initial.data.system_events.some((event) => event.event_type === 'chat_created'));
  assert.ok(initial.data.system_events.some((event) => event.event_type === 'member_added' && Number(event.target_user_id) === Number(bob.user.id)));
  assert.ok(initial.data.system_events.some((event) => event.event_type === 'member_added' && Number(event.target_user_id) === Number(carol.user.id)));

  await admin.request(`/api/chats/${chatId}/members`, {
    method: 'POST',
    json: { userId: dave.user.id },
  });
  await dave.request(`/api/chats/${chatId}/members/me`, { method: 'DELETE' });
  await admin.request(`/api/chats/${chatId}/members`, {
    method: 'POST',
    json: { userId: dave.user.id },
  });
  await admin.request(`/api/chats/${chatId}/members/${dave.user.id}`, { method: 'DELETE' });

  const bot = await createOpenAiBot(admin, { visibleToUsers: true });
  await admin.request(`/api/chats/${chatId}/members`, {
    method: 'POST',
    json: { userId: Number(bot.user_id) },
  });
  await admin.request(`/api/chats/${chatId}/members/${bot.user_id}`, { method: 'DELETE' });

  await admin.request(`/api/chats/${chatId}`, {
    method: 'PUT',
    json: { name: `System renamed ${suffix}` },
  });

  const avatar = new FormData();
  avatar.append('avatar', new Blob([Buffer.from('avatar')], { type: 'image/png' }), 'avatar.png');
  await admin.request(`/api/chats/${chatId}/avatar`, { method: 'POST', formData: avatar });
  await admin.request(`/api/chats/${chatId}/avatar`, { method: 'DELETE' });

  const background = new FormData();
  background.append('background', new Blob([Buffer.from('background')], { type: 'image/png' }), 'background.png');
  background.append('style', 'cover');
  await admin.request(`/api/chats/${chatId}/background`, { method: 'POST', formData: background });
  await admin.request(`/api/chats/${chatId}/background-style`, {
    method: 'PUT',
    json: { style: 'tile' },
  });
  await admin.request(`/api/chats/${chatId}/background`, { method: 'DELETE' });

  const beforeClearEvents = await admin.request(`/api/chats/${chatId}/messages`, { searchParams: { meta: 1 } });
  const beforeClearTypes = beforeClearEvents.data.system_events.map((event) => event.event_type);
  [
    'member_added',
    'member_left',
    'member_removed',
    'chat_renamed',
    'chat_avatar_updated',
    'chat_avatar_removed',
    'chat_background_updated',
    'chat_background_style_updated',
    'chat_background_removed',
  ].forEach((type) => assert.ok(beforeClearTypes.includes(type), `missing ${type}`));
  assert.ok(beforeClearEvents.data.system_events.some((event) => event.event_type === 'member_added' && Number(event.target_user_id) === Number(bot.user_id) && Number(event.target_is_ai_bot) === 1));
  assert.ok(beforeClearEvents.data.system_events.some((event) => event.event_type === 'member_removed' && Number(event.target_user_id) === Number(bot.user_id) && Number(event.target_is_ai_bot) === 1));

  const beforeClearList = await bob.request('/api/chats');
  const beforeClearEntry = beforeClearList.data.find((item) => Number(item.id) === chatId);
  assert.equal(beforeClearEntry.unread_count, 0);
  assert.equal(Number(beforeClearEntry.last_message_id || 0), 0);

  await admin.request(`/api/chats/${chatId}/history`, { method: 'DELETE' });
  const afterClear = await admin.request(`/api/chats/${chatId}/messages`, { searchParams: { meta: 1 } });
  assert.deepEqual(afterClear.data.messages, []);
  assert.equal(afterClear.data.system_events.length, 1);
  assert.equal(afterClear.data.system_events[0].event_type, 'chat_history_cleared');

  const afterClearList = await bob.request('/api/chats');
  const afterClearEntry = afterClearList.data.find((item) => Number(item.id) === chatId);
  assert.equal(afterClearEntry.unread_count, 0);
  assert.equal(Number(afterClearEntry.last_message_id || 0), 0);

  const db = new Database(path.join(sandbox.appDir, 'bananza.db'));
  try {
    const rows = db.prepare('SELECT event_type, target_user_id, target_is_ai_bot FROM chat_system_events WHERE chat_id=? ORDER BY id').all(chatId);
    const eventTypes = rows.map((row) => row.event_type);
    assert.ok(eventTypes.includes('chat_history_cleared'));
    assert.equal(eventTypes.filter((type) => type === 'chat_history_cleared').length, 1);
  } finally {
    db.close();
  }

  const privateBotChat = await admin.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: Number(bot.user_id) },
  });
  const privateBotEvents = await admin.request(`/api/chats/${privateBotChat.data.id}/messages`);
  assert.ok(privateBotEvents.data.system_events.some((event) => event.event_type === 'chat_created'));
  assert.ok(privateBotEvents.data.system_events.some((event) => event.event_type === 'member_added' && Number(event.target_user_id) === Number(bot.user_id) && Number(event.target_is_ai_bot) === 1));
});

test('context convert all-chat availability respects chat-level gates and bot enabled state', async () => {
  const { admin, bob, carol } = scenario;
  const db = new Database(path.join(sandbox.appDir, 'bananza.db'));
  const suffix = Date.now();

  try {
    await enableOpenAiForTests(admin);

    const chatA = await admin.request('/api/chats', {
      method: 'POST',
      json: {
        name: `Convert Global A ${suffix}`,
        type: 'group',
        memberIds: [bob.user.id, carol.user.id],
      },
    });
    const chatB = await admin.request('/api/chats', {
      method: 'POST',
      json: {
        name: `Convert Global B ${suffix}`,
        type: 'group',
        memberIds: [bob.user.id, carol.user.id],
      },
    });
    const chatOff = await admin.request('/api/chats', {
      method: 'POST',
      json: {
        name: `Convert Global Off ${suffix}`,
        type: 'group',
        memberIds: [bob.user.id, carol.user.id],
      },
    });

    await admin.request(`/api/chats/${chatA.data.id}/context-transform-settings`, {
      method: 'PUT',
      json: { context_transform_enabled: true },
    });
    await admin.request(`/api/chats/${chatB.data.id}/context-transform-settings`, {
      method: 'PUT',
      json: { context_transform_enabled: true },
    });

    const bot = await createOpenAiConvertBot(admin, { availableInAllChats: true });
    assert.equal(bot.available_in_all_chats, true);

    const chatAAvailable = await bob.request(`/api/chats/${chatA.data.id}/context-convert-bots`);
    const chatBAvailable = await bob.request(`/api/chats/${chatB.data.id}/context-convert-bots`);
    const chatOffAvailable = await bob.request(`/api/chats/${chatOff.data.id}/context-convert-bots`);

    assert.equal(chatAAvailable.data.enabled, true);
    assert.equal(chatBAvailable.data.enabled, true);
    assert.equal(chatOffAvailable.data.enabled, false);
    assert.equal(responseHasBot(chatAAvailable, bot.id), true);
    assert.equal(responseHasBot(chatBAvailable, bot.id), true);
    assert.equal(responseHasBot(chatOffAvailable, bot.id), false);

    const explicitAssignments = db.prepare('SELECT COUNT(*) as count FROM ai_chat_bots WHERE bot_id=?').get(Number(bot.id));
    assert.equal(explicitAssignments.count, 0);

    await admin.request(`/api/admin/openai-convert-bots/${bot.id}`, {
      method: 'PUT',
      json: { enabled: true, available_in_all_chats: false },
    });

    const chatAAfterGlobalOff = await bob.request(`/api/chats/${chatA.data.id}/context-convert-bots`);
    const chatBAfterGlobalOff = await bob.request(`/api/chats/${chatB.data.id}/context-convert-bots`);
    assert.equal(responseHasBot(chatAAfterGlobalOff, bot.id), false);
    assert.equal(responseHasBot(chatBAfterGlobalOff, bot.id), false);

    await admin.request('/api/admin/openai-convert-bots/chat-settings', {
      method: 'PUT',
      json: {
        chatId: chatA.data.id,
        botId: bot.id,
        enabled: true,
      },
    });

    const chatAAfterAssignment = await bob.request(`/api/chats/${chatA.data.id}/context-convert-bots`);
    const chatBAfterAssignment = await bob.request(`/api/chats/${chatB.data.id}/context-convert-bots`);
    assert.equal(responseHasBot(chatAAfterAssignment, bot.id), true);
    assert.equal(responseHasBot(chatBAfterAssignment, bot.id), false);
    const foldersAfterConvertAssignment = await bob.request('/api/chat-folders');
    assert.equal(responseHasFolderForBot(foldersAfterConvertAssignment, bot.id), false);

    await admin.request(`/api/admin/openai-convert-bots/${bot.id}`, {
      method: 'PUT',
      json: { enabled: false, available_in_all_chats: true },
    });

    const chatAAfterDisable = await bob.request(`/api/chats/${chatA.data.id}/context-convert-bots`);
    const chatBAfterDisable = await bob.request(`/api/chats/${chatB.data.id}/context-convert-bots`);
    assert.equal(chatAAfterDisable.data.enabled, true);
    assert.equal(chatBAfterDisable.data.enabled, true);
    assert.equal(responseHasBot(chatAAfterDisable, bot.id), false);
    assert.equal(responseHasBot(chatBAfterDisable, bot.id), false);
  } finally {
    await admin.request('/api/admin/ai-bots/settings', {
      method: 'PUT',
      json: { enabled: false, openai_interactive_enabled: false },
    }).catch(() => {});
    db.close();
  }
});

test('AI bot chat settings persist through admin state reload for every bot type', async () => {
  const { admin, bob, carol } = scenario;
  const db = new Database(path.join(sandbox.appDir, 'bananza.db'));
  const suffix = Date.now();

  const cases = [
    {
      label: 'OpenAI text',
      provider: 'openai',
      kind: 'text',
      createRoute: '/api/admin/ai-bots',
      settingsRoute: '/api/admin/ai-bots/chat-settings',
      stateRoute: '/api/admin/ai-bots',
      save: { mode: 'hybrid', hot_context_limit: 77, auto_react_on_mention: true },
      expected: { mode: 'hybrid', hot_context_limit: 77, trigger_mode: 'mention_reply', auto_react_on_mention: 1 },
    },
    {
      label: 'OpenAI universal',
      provider: 'openai',
      kind: 'universal',
      createRoute: '/api/admin/openai-universal-bots',
      settingsRoute: '/api/admin/openai-universal-bots/chat-settings',
      stateRoute: '/api/admin/openai-universal-bots',
      save: { mode: 'hybrid', hot_context_limit: 78, auto_react_on_mention: true },
      expected: { mode: 'hybrid', hot_context_limit: 78, trigger_mode: 'mention_reply', auto_react_on_mention: 1 },
    },
    {
      label: 'OpenAI image',
      provider: 'openai',
      kind: 'image',
      createRoute: '/api/admin/openai-image-bots',
      settingsRoute: '/api/admin/openai-image-bots/chat-settings',
      stateRoute: '/api/admin/openai-image-bots',
      save: { mode: 'hybrid', hot_context_limit: 79, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 50, trigger_mode: 'mention_reply', auto_react_on_mention: 0 },
    },
    {
      label: 'OpenAI convert',
      provider: 'openai',
      kind: 'convert',
      createRoute: '/api/admin/openai-convert-bots',
      settingsRoute: '/api/admin/openai-convert-bots/chat-settings',
      stateRoute: '/api/admin/openai-convert-bots',
      save: { mode: 'hybrid', hot_context_limit: 80, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 50, trigger_mode: 'mention_reply', auto_react_on_mention: 0 },
    },
    {
      label: 'OpenAI ChatShot',
      provider: 'openai',
      kind: 'chatshot',
      createRoute: '/api/admin/openai-chatshot-bots',
      settingsRoute: '/api/admin/openai-chatshot-bots/chat-settings',
      stateRoute: '/api/admin/openai-chatshot-bots',
      save: { mode: 'hybrid', hot_context_limit: 81, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 33, trigger_mode: 'manual', auto_react_on_mention: 0 },
    },
    {
      label: 'DeepSeek text',
      provider: 'deepseek',
      kind: 'text',
      createRoute: '/api/admin/deepseek-ai-bots',
      settingsRoute: '/api/admin/deepseek-ai-bots/chat-settings',
      stateRoute: '/api/admin/deepseek-ai-bots',
      save: { mode: 'hybrid', hot_context_limit: 82, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 82, trigger_mode: 'mention_reply', auto_react_on_mention: 1 },
    },
    {
      label: 'DeepSeek convert',
      provider: 'deepseek',
      kind: 'convert',
      createRoute: '/api/admin/deepseek-convert-bots',
      settingsRoute: '/api/admin/deepseek-convert-bots/chat-settings',
      stateRoute: '/api/admin/deepseek-convert-bots',
      save: { mode: 'hybrid', hot_context_limit: 83, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 50, trigger_mode: 'mention_reply', auto_react_on_mention: 0 },
    },
    {
      label: 'Qwen text',
      provider: 'qwen',
      kind: 'text',
      createRoute: '/api/admin/qwen-ai-bots',
      settingsRoute: '/api/admin/qwen-ai-bots/chat-settings',
      stateRoute: '/api/admin/qwen-ai-bots',
      save: { mode: 'hybrid', hot_context_limit: 84, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 84, trigger_mode: 'mention_reply', auto_react_on_mention: 1 },
    },
    {
      label: 'Qwen convert',
      provider: 'qwen',
      kind: 'convert',
      createRoute: '/api/admin/qwen-convert-bots',
      settingsRoute: '/api/admin/qwen-convert-bots/chat-settings',
      stateRoute: '/api/admin/qwen-convert-bots',
      save: { mode: 'hybrid', hot_context_limit: 85, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 50, trigger_mode: 'mention_reply', auto_react_on_mention: 0 },
    },
    {
      label: 'Yandex text',
      provider: 'yandex',
      kind: 'text',
      createRoute: '/api/admin/yandex-ai-bots',
      settingsRoute: '/api/admin/yandex-ai-bots/chat-settings',
      stateRoute: '/api/admin/yandex-ai-bots',
      save: { mode: 'hybrid', hot_context_limit: 86, auto_react_on_mention: true },
      expected: { mode: 'hybrid', hot_context_limit: 86, trigger_mode: 'mention_reply', auto_react_on_mention: 1 },
    },
    {
      label: 'Yandex convert',
      provider: 'yandex',
      kind: 'convert',
      createRoute: '/api/admin/yandex-convert-bots',
      settingsRoute: '/api/admin/yandex-convert-bots/chat-settings',
      stateRoute: '/api/admin/yandex-convert-bots',
      save: { mode: 'hybrid', hot_context_limit: 87, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 50, trigger_mode: 'mention_reply', auto_react_on_mention: 0 },
    },
    {
      label: 'Grok text',
      provider: 'grok',
      kind: 'text',
      createRoute: '/api/admin/grok-ai-bots',
      settingsRoute: '/api/admin/grok-ai-bots/chat-settings',
      stateRoute: '/api/admin/grok-ai-bots',
      save: { mode: 'hybrid', hot_context_limit: 88, auto_react_on_mention: true },
      expected: { mode: 'hybrid', hot_context_limit: 88, trigger_mode: 'mention_reply', auto_react_on_mention: 1 },
    },
    {
      label: 'Grok image',
      provider: 'grok',
      kind: 'image',
      createRoute: '/api/admin/grok-ai-bots',
      settingsRoute: '/api/admin/grok-ai-bots/chat-settings',
      stateRoute: '/api/admin/grok-ai-bots',
      stateKey: 'imageChatSettings',
      save: { mode: 'hybrid', hot_context_limit: 89, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 89, trigger_mode: 'mention_reply', auto_react_on_mention: 0 },
    },
    {
      label: 'Grok universal',
      provider: 'grok',
      kind: 'universal',
      createRoute: '/api/admin/grok-universal-bots',
      settingsRoute: '/api/admin/grok-universal-bots/chat-settings',
      stateRoute: '/api/admin/grok-universal-bots',
      save: { mode: 'hybrid', hot_context_limit: 90, auto_react_on_mention: true },
      expected: { mode: 'hybrid', hot_context_limit: 90, trigger_mode: 'mention_reply', auto_react_on_mention: 1 },
    },
    {
      label: 'Grok convert',
      provider: 'grok',
      kind: 'convert',
      createRoute: '/api/admin/grok-convert-bots',
      settingsRoute: '/api/admin/grok-convert-bots/chat-settings',
      stateRoute: '/api/admin/grok-convert-bots',
      save: { mode: 'hybrid', hot_context_limit: 91, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 50, trigger_mode: 'mention_reply', auto_react_on_mention: 0 },
    },
    {
      label: 'Grok ChatShot',
      provider: 'grok',
      kind: 'chatshot',
      createRoute: '/api/admin/grok-chatshot-bots',
      settingsRoute: '/api/admin/grok-chatshot-bots/chat-settings',
      stateRoute: '/api/admin/grok-chatshot-bots',
      save: { mode: 'hybrid', hot_context_limit: 92, auto_react_on_mention: true },
      expected: { mode: 'simple', hot_context_limit: 33, trigger_mode: 'manual', auto_react_on_mention: 0 },
    },
  ];

  try {
    const chat = await admin.request('/api/chats', {
      method: 'POST',
      json: {
        name: `AI Bot Settings ${suffix}`,
        type: 'group',
        memberIds: [bob.user.id, carol.user.id],
      },
    });
    const chatId = Number(chat.data.id);

    for (const item of cases) {
      const bot = await createAdminBot(admin, {
        route: item.createRoute,
        provider: item.provider,
        kind: item.kind,
        label: item.label,
      });
      const saveResponse = await admin.request(item.settingsRoute, {
        method: 'PUT',
        json: {
          chatId,
          botId: Number(bot.id),
          enabled: true,
          ...item.save,
        },
      });
      assert.equal(saveResponse.data.ok, true, `${item.label} save should succeed`);

      const row = db.prepare(`
        SELECT enabled, mode, hot_context_limit, trigger_mode, auto_react_on_mention
        FROM ai_chat_bots
        WHERE chat_id=? AND bot_id=?
      `).get(chatId, Number(bot.id));
      assert.deepEqual(row, {
        enabled: 1,
        mode: item.expected.mode,
        hot_context_limit: item.expected.hot_context_limit,
        trigger_mode: item.expected.trigger_mode,
        auto_react_on_mention: item.expected.auto_react_on_mention,
      }, `${item.label} sqlite row should persist`);

      const reloaded = await admin.request(item.stateRoute);
      const stateKey = item.stateKey || 'chatSettings';
      const setting = (reloaded.data[stateKey] || []).find((entry) => (
        Number(entry.chat_id) === chatId && Number(entry.bot_id) === Number(bot.id)
      ));
      assert.ok(setting, `${item.label} setting should reload from ${stateKey}`);
      assert.equal(setting.enabled, true, `${item.label} enabled should reload`);
      assert.equal(setting.mode, item.expected.mode, `${item.label} mode should reload`);
      assert.equal(setting.hot_context_limit, item.expected.hot_context_limit, `${item.label} context limit should reload`);
      assert.equal(setting.trigger_mode, item.expected.trigger_mode, `${item.label} trigger should reload`);
      assert.equal(setting.auto_react_on_mention, item.expected.auto_react_on_mention !== 0, `${item.label} auto-react should reload`);
    }
  } finally {
    db.close();
  }
});

test('ChatShot can be enabled by a member and posts an image as chatShot without joining the chat', async () => {
  const { admin, bob, carol } = scenario;
  const db = new Database(path.join(sandbox.appDir, 'bananza.db'));

  try {
    await enableOpenAiForTests(admin, {
      openai_default_image_model: 'gpt-image-2',
      openai_default_image_size: '1024x1024',
    });

    const suffix = Date.now();
    const chat = await admin.request('/api/chats', {
      method: 'POST',
      json: {
        name: `ChatShot ${suffix}`,
        type: 'group',
        memberIds: [bob.user.id, carol.user.id],
      },
    });
    const chatId = chat.data.id;
    const bot = await createOpenAiChatShotBot(admin, { availableInAllChats: true });

    const initialState = await bob.request(`/api/chats/${chatId}/chatshot`);
    assert.equal(responseHasBot(initialState, bot.id), true);
    assert.equal(initialState.data.enabled, false);
    assert.equal(initialState.data.ready, false);
    assert.equal(initialState.data.banana_filter_enabled, true);

    const enabledState = await bob.request(`/api/chats/${chatId}/chatshot`, {
      method: 'PUT',
      json: {
        enabled: true,
        botId: bot.id,
        style: 'photo',
        bananaFilterEnabled: false,
      },
    });
    assert.equal(enabledState.data.enabled, true);
    assert.equal(enabledState.data.ready, false);
    assert.equal(enabledState.data.style, 'photo');
    assert.equal(enabledState.data.banana_filter_enabled, false);

    const savedState = await bob.request(`/api/chats/${chatId}/chatshot`);
    assert.equal(savedState.data.banana_filter_enabled, false);

    await admin.request(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      json: { text: 'Let us make a bright recap of this chat.' },
    });
    await bob.request(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      json: { text: 'Yes, make it playful and banana friendly.' },
    });

    const readyState = await bob.request(`/api/chats/${chatId}/chatshot`);
    assert.equal(readyState.data.ready, true);
    assert.equal(readyState.data.message_count >= 2, true);
    assert.equal(readyState.data.banana_filter_enabled, false);

    const safeState = await bob.request(`/api/chats/${chatId}/chatshot`, {
      method: 'PUT',
      json: {
        enabled: true,
        botId: bot.id,
        style: 'photo',
        bananaFilterEnabled: true,
      },
    });
    assert.equal(safeState.data.banana_filter_enabled, true);

    const generated = await bob.request(`/api/chats/${chatId}/chatshot`, {
      method: 'POST',
      json: {},
    });
    assert.equal(generated.data.ok, true);
    assert.equal(generated.data.message.display_name, 'chatShot');
    assert.equal(generated.data.message.ai_bot_kind, 'chatshot');
    assert.equal(generated.data.message.file_type, 'image');
    assert.equal(generated.data.message.file_mime, 'image/svg+xml');
    const foldersAfterChatShotMessage = await bob.request('/api/chat-folders');
    assert.equal(responseHasFolderForBot(foldersAfterChatShotMessage, bot.id), false);

    const botRow = db.prepare('SELECT user_id FROM ai_bots WHERE id=?').get(Number(bot.id));
    const membership = db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, botRow.user_id);
    assert.equal(Boolean(membership), false);
  } finally {
    await admin.request('/api/admin/ai-bots/settings', {
      method: 'PUT',
      json: { enabled: false, openai_interactive_enabled: false },
    }).catch(() => {});
    db.close();
  }
});

test('human private chats remain single-threaded while bot private chats always create new threads', async () => {
  const { admin, bob, privateChat } = scenario;

  const humanPrivateAgain = await admin.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: bob.user.id },
  });
  assert.equal(Number(humanPrivateAgain.data.id), Number(privateChat.id));

  const bot = await createOpenAiBot(admin, { visibleToUsers: true });
  await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
    method: 'PUT',
    json: { can_add_bots_to_chats: true },
  });

  const firstBotChat = await bob.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: Number(bot.user_id) },
  });
  const secondBotChat = await bob.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: Number(bot.user_id) },
  });

  assert.notEqual(Number(firstBotChat.data.id), Number(secondBotChat.data.id));
  assert.equal(firstBotChat.data.name, bot.name);
  assert.equal(secondBotChat.data.name, bot.name);

  const chatList = await bob.request('/api/chats');
  const botPrivateChats = chatList.data.filter((chat) => (
    chat.type === 'private'
    && Number(chat?.private_user?.id || 0) === Number(bot.user_id)
  ));
  assert.ok(botPrivateChats.some((chat) => Number(chat.id) === Number(firstBotChat.data.id)));
  assert.ok(botPrivateChats.some((chat) => Number(chat.id) === Number(secondBotChat.data.id)));
});

test('AI admin chat state labels private bot chats with title and participants', async () => {
  const { admin, bob } = scenario;
  const db = new Database(path.join(sandbox.appDir, 'bananza.db'));
  const title = `Bot Thread ${Date.now().toString(36)}`.slice(0, 50);

  try {
    const bot = await createOpenAiBot(admin, { visibleToUsers: true });
    await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
      method: 'PUT',
      json: { can_add_bots_to_chats: true },
    });

    const privateChat = await bob.request('/api/chats/private', {
      method: 'POST',
      json: { targetUserId: Number(bot.user_id) },
    });
    const chatId = Number(privateChat.data.id);
    db.prepare('UPDATE chats SET name=? WHERE id=?').run(title, chatId);

    const aiState = await admin.request('/api/admin/ai-bots');
    const chat = aiState.data.chats.find((item) => Number(item.id) === chatId);
    const bobName = bob.user.display_name || bob.user.username;

    assert.ok(chat);
    assert.equal(chat.chat_title, title);
    assert.equal(chat.name, `Private: ${bobName}`);
    assert.deepEqual(chat.participant_names, [bobName, bot.name]);
    assert.equal(chat.participant_label, `${bobName}, ${bot.name}`);
    assert.equal(chat.option_label, `${title} — ${bobName}, ${bot.name} (private)`);
  } finally {
    await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
      method: 'PUT',
      json: { can_add_bots_to_chats: false },
    }).catch(() => {});
    db.close();
  }
});

test('bot discovery, private chats, defaults and audit respect user and bot flags', async () => {
  const { admin, bob, groupChat } = scenario;
  const db = new Database(path.join(sandbox.appDir, 'bananza.db'));

  try {
    const bot = await createOpenAiBot(admin, { visibleToUsers: true });
    assert.ok(Number(bot.user_id) > 0);
    db.prepare('UPDATE users SET avatar_url=? WHERE id=?').run('/uploads/avatars/test-bot-avatar.png', Number(bot.user_id));
    await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
      method: 'PUT',
      json: { can_add_bots_to_chats: false },
    });

    const adminUsers = await admin.request('/api/users');
    const adminBotEntry = adminUsers.data.find((user) => user.id === Number(bot.user_id));
    assert.ok(adminBotEntry);
    assert.equal(adminBotEntry.is_ai_bot, 1);
    assert.equal(adminBotEntry.ai_bot_mention, bot.mention);
    assert.equal(adminBotEntry.ai_bot_model, 'gpt-4o-mini');

    const bobUsersBefore = await bob.request('/api/users');
    assert.equal(bobUsersBefore.data.some((user) => user.id === Number(bot.user_id)), false);

    const botAccessEnabled = await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
      method: 'PUT',
      json: { can_add_bots_to_chats: true },
    });
    assert.equal(botAccessEnabled.data.can_add_bots_to_chats, 1);

    const bobUsersAfter = await bob.request('/api/users');
    const bobBotEntry = bobUsersAfter.data.find((user) => user.id === Number(bot.user_id));
    assert.ok(bobBotEntry);
    assert.equal(bobBotEntry.ai_bot_provider, 'openai');
    assert.equal(bobBotEntry.ai_bot_kind, 'text');
    assert.equal(bobBotEntry.ai_bot_model, 'gpt-4o-mini');

    const privateChat = await bob.request('/api/chats/private', {
      method: 'POST',
      json: { targetUserId: Number(bot.user_id) },
    });
    const chatId = Number(privateChat.data.id);

    const chatBots = await bob.request(`/api/chats/${chatId}/bots`);
    assert.equal(chatBots.data.bots.length, 1);
    assert.equal(chatBots.data.bots[0].bot_id, Number(bot.id));
    assert.equal(chatBots.data.bots[0].user_id, Number(bot.user_id));
    assert.equal(chatBots.data.bots[0].mention, bot.mention);
    assert.equal(chatBots.data.bots[0].model, 'gpt-4o-mini');

    const privateMembers = await bob.request(`/api/chats/${chatId}/members`);
    const privateBotMember = privateMembers.data.find((user) => Number(user.id) === Number(bot.user_id));
    assert.ok(privateBotMember);
    assert.equal(privateBotMember.ai_bot_id, Number(bot.id));
    assert.equal(privateBotMember.ai_bot_provider, 'openai');
    assert.equal(privateBotMember.ai_bot_kind, 'text');
    assert.equal(privateBotMember.ai_bot_mention, bot.mention);
    assert.equal(privateBotMember.ai_bot_model, 'gpt-4o-mini');

    await admin.request(`/api/chats/${groupChat.id}/members`, {
      method: 'POST',
      json: { userId: Number(bot.user_id) },
    });
    const groupMembers = await admin.request(`/api/chats/${groupChat.id}/members`);
    const groupBotMember = groupMembers.data.find((user) => Number(user.id) === Number(bot.user_id));
    assert.ok(groupBotMember);
    assert.equal(groupBotMember.ai_bot_id, Number(bot.id));
    assert.equal(groupBotMember.ai_bot_provider, 'openai');
    assert.equal(groupBotMember.ai_bot_kind, 'text');
    assert.equal(groupBotMember.ai_bot_mention, bot.mention);
    assert.equal(groupBotMember.ai_bot_model, 'gpt-4o-mini');

    const botSettings = db.prepare(`
      SELECT enabled, mode, hot_context_limit, trigger_mode, auto_react_on_mention
      FROM ai_chat_bots
      WHERE chat_id=? AND bot_id=?
    `).get(chatId, Number(bot.id));
    assert.deepEqual(botSettings, {
      enabled: 1,
      mode: 'simple',
      hot_context_limit: 50,
      trigger_mode: 'mention_reply',
      auto_react_on_mention: 0,
    });

    const auditAfterCreate = await admin.request(`/api/admin/users/${bob.user.id}/bot-additions`);
    const matchingPrivateAudit = auditAfterCreate.data.additions.filter((entry) => (
      entry.chat_id === chatId
      && entry.bot_id === Number(bot.id)
      && entry.source === 'private_chat_create'
    ));
    assert.equal(matchingPrivateAudit.length, 1);
    assert.equal(matchingPrivateAudit[0].bot_model, 'gpt-4o-mini');
    assert.equal(matchingPrivateAudit[0].bot_avatar_url, '/uploads/avatars/test-bot-avatar.png');
    assert.ok(String(matchingPrivateAudit[0].bot_avatar_color || '').length > 0);

    const privateChatAgain = await bob.request('/api/chats/private', {
      method: 'POST',
      json: { targetUserId: Number(bot.user_id) },
    });
    const secondChatId = Number(privateChatAgain.data.id);
    assert.notEqual(secondChatId, chatId);
    assert.equal(privateChatAgain.data.name, bot.name);

    const secondChatSettings = db.prepare(`
      SELECT enabled, mode, hot_context_limit, trigger_mode, auto_react_on_mention
      FROM ai_chat_bots
      WHERE chat_id=? AND bot_id=?
    `).get(secondChatId, Number(bot.id));
    assert.deepEqual(secondChatSettings, botSettings);

    const auditAfterRepeat = await admin.request(`/api/admin/users/${bob.user.id}/bot-additions`);
    const repeatAuditRows = auditAfterRepeat.data.additions.filter((entry) => (
      entry.bot_id === Number(bot.id)
      && entry.source === 'private_chat_create'
    ));
    assert.equal(repeatAuditRows.length, 2);
    assert.ok(repeatAuditRows.some((entry) => entry.chat_id === chatId));
    assert.ok(repeatAuditRows.some((entry) => entry.chat_id === secondChatId));

    await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
      method: 'PUT',
      json: { can_add_bots_to_chats: false },
    });
    await admin.request(`/api/admin/ai-bots/${bot.id}`, {
      method: 'PUT',
      json: { visible_to_users: false },
    });

    const bobUsersHidden = await bob.request('/api/users');
    assert.equal(bobUsersHidden.data.some((user) => user.id === Number(bot.user_id)), false);

    const persistedChatBots = await bob.request(`/api/chats/${chatId}/bots`);
    assert.equal(persistedChatBots.data.bots.length, 1);
    assert.equal(persistedChatBots.data.bots[0].bot_id, Number(bot.id));

    const persistedSettings = db.prepare(`
      SELECT enabled, mode, hot_context_limit, trigger_mode, auto_react_on_mention
      FROM ai_chat_bots
      WHERE chat_id=? AND bot_id=?
    `).get(chatId, Number(bot.id));
    assert.deepEqual(persistedSettings, botSettings);

    const blockedGroupCreate = await bob.request('/api/chats', {
      method: 'POST',
      json: {
        name: `Blocked ${Date.now()}`,
        type: 'group',
        memberIds: [Number(bot.user_id)],
      },
      expectedStatus: 400,
    });
    assert.equal(blockedGroupCreate.data.error, 'Selected users are unavailable');
  } finally {
    db.close();
  }
});

test('bot private chats auto-title after the third user message with fallback when AI is unavailable', async () => {
  const { admin, bob } = scenario;
  const bot = await createOpenAiBot(admin, {
    visibleToUsers: true,
    name: `Fallback Bot ${Date.now()}`,
  });

  await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
    method: 'PUT',
    json: { can_add_bots_to_chats: true },
  });

  const created = await bob.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: Number(bot.user_id) },
  });
  const chatId = Number(created.data.id);
  const initialName = String(bot.name || '').trim();

  await bob.request(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    json: { text: 'summer trip budget ideas italy july' },
  });
  await bob.request(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    json: { text: 'need rough costs for flights' },
  });

  const afterTwoMessages = await bob.request('/api/chats');
  const chatAfterTwo = afterTwoMessages.data.find((chat) => Number(chat.id) === chatId);
  assert.ok(chatAfterTwo);
  assert.equal(chatAfterTwo.name, initialName);

  await bob.request(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    json: { text: 'also compare hotels and food' },
  });

  const renamedChat = await waitFor(async () => {
    const list = await bob.request('/api/chats');
    const chat = list.data.find((entry) => Number(entry.id) === chatId);
    assert.ok(chat);
    assert.notEqual(chat.name, initialName);
    return chat;
  });

  assert.equal(renamedChat.name, 'Summer trip budget ideas italy july');
  assert.equal(Number(renamedChat.private_user?.is_ai_bot || 0), 1);
  assert.equal(Number(renamedChat.private_user?.id || 0), Number(bot.user_id));
  assert.equal(renamedChat.private_user?.display_name, bot.name);
});

test('bot private chats can auto-title via provider output when AI is configured', async () => {
  const { admin, bob } = scenario;
  await enableOpenAiForTests(admin);

  const bot = await createOpenAiBot(admin, {
    visibleToUsers: true,
    name: `AI Title Bot ${Date.now()}`,
  });

  await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
    method: 'PUT',
    json: { can_add_bots_to_chats: true },
  });

  const created = await bob.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: Number(bot.user_id) },
  });
  const chatId = Number(created.data.id);

  await bob.request(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    json: { text: 'let us plan a launch checklist' },
  });
  await bob.request(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    json: { text: 'capture the tasks for this week' },
  });
  await bob.request(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    json: { text: 'and keep it short and clear' },
  });

  const renamedChat = await waitFor(async () => {
    const list = await bob.request('/api/chats');
    const chat = list.data.find((entry) => Number(entry.id) === chatId);
    assert.ok(chat);
    assert.equal(chat.name, 'Mock OpenAI response');
    return chat;
  });

  assert.equal(Number(renamedChat.private_user?.is_ai_bot || 0), 1);
  assert.equal(Number(renamedChat.private_user?.id || 0), Number(bot.user_id));
  assert.equal(renamedChat.private_user?.display_name, bot.name);
});

test('chat folder CRUD, multi-membership, ordering and folder-local pins work independently from All chats', async () => {
  const owner = createSession(sandbox.baseUrl);
  const peer = createSession(sandbox.baseUrl);
  await owner.register(makeUser('folderowner'));
  await peer.register(makeUser('folderpeer'));

  const { data: groupChat } = await owner.request('/api/chats', {
    method: 'POST',
    json: {
      name: `Folder Group ${Date.now()}`,
      type: 'group',
      memberIds: [peer.user.id],
    },
  });
  const { data: privateChat } = await owner.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: peer.user.id },
  });
  const { data: sideChat } = await owner.request('/api/chats', {
    method: 'POST',
    json: {
      name: `Folder Side ${Date.now()}`,
      type: 'group',
      memberIds: [peer.user.id],
    },
  });

  const created = await owner.request('/api/chat-folders', {
    method: 'POST',
    json: {
      name: 'Ops',
      chatIds: [groupChat.id, privateChat.id],
    },
  });
  const folderId = Number(created.data.folder.id);
  assert.equal(created.data.folder.kind, 'custom');
  assert.deepEqual(new Set(created.data.folder.chat_ids), new Set([groupChat.id, privateChat.id]));

  const secondary = await owner.request('/api/chat-folders', {
    method: 'POST',
    json: {
      name: 'Shared',
      chatIds: [privateChat.id],
    },
  });
  const secondaryFolderId = Number(secondary.data.folder.id);

  let folderList = await owner.request('/api/chat-folders');
  assert.equal(folderList.data.folders.length, 2);
  assert.deepEqual(
    folderList.data.folders.map((folder) => Number(folder.id)).slice(0, 2),
    [secondaryFolderId, folderId]
  );
  assert.ok(folderList.data.folders.find((folder) => Number(folder.id) === folderId).chat_ids.includes(privateChat.id));
  assert.ok(folderList.data.folders.find((folder) => Number(folder.id) === secondaryFolderId).chat_ids.includes(privateChat.id));

  await owner.request(`/api/chat-folders/${folderId}`, {
    method: 'PUT',
    json: { name: 'Ops renamed' },
  });
  await owner.request(`/api/chat-folders/${folderId}/chats`, {
    method: 'POST',
    json: { chatIds: [sideChat.id] },
  });
  await owner.request(`/api/chat-folders/${folderId}/chats/${privateChat.id}`, {
    method: 'DELETE',
  });

  await owner.request(`/api/chat-folders/${folderId}/chats/${groupChat.id}/pin`, {
    method: 'PUT',
    json: { pinned: true },
  });
  await owner.request(`/api/chat-folders/${folderId}/chats/${sideChat.id}/pin`, {
    method: 'PUT',
    json: { pinned: true },
  });
  await owner.request(`/api/chat-folders/${folderId}/chats/${sideChat.id}/pin/move`, {
    method: 'POST',
    json: { direction: 'up' },
  });

  await owner.request(`/api/chats/${privateChat.id}/sidebar-pin`, {
    method: 'PUT',
    json: { pinned: true },
  });

  folderList = await owner.request('/api/chat-folders');
  const updatedFolder = folderList.data.folders.find((folder) => Number(folder.id) === folderId);
  assert.ok(updatedFolder);
  assert.equal(updatedFolder.name, 'Ops renamed');
  assert.deepEqual(new Set(updatedFolder.chat_ids), new Set([groupChat.id, sideChat.id]));
  assert.deepEqual(updatedFolder.pins.map((pin) => Number(pin.chat_id)), [sideChat.id, groupChat.id]);
  assert.equal(updatedFolder.pins.some((pin) => Number(pin.chat_id) === Number(privateChat.id)), false);

  const chatList = await owner.request('/api/chats');
  const privateChatState = chatList.data.find((chat) => Number(chat.id) === Number(privateChat.id));
  const groupChatState = chatList.data.find((chat) => Number(chat.id) === Number(groupChat.id));
  assert.ok(Number(privateChatState.chat_list_pin_order || 0) > 0);
  assert.equal(groupChatState.chat_list_pin_order ?? null, null);

  await owner.request('/api/chat-folders/order', {
    method: 'PUT',
    json: { folderIds: [folderId, secondaryFolderId] },
  });
  folderList = await owner.request('/api/chat-folders');
  assert.deepEqual(
    folderList.data.folders.map((folder) => Number(folder.id)).slice(0, 2),
    [folderId, secondaryFolderId]
  );

  await owner.request(`/api/chat-folders/${secondaryFolderId}`, {
    method: 'DELETE',
  });
  folderList = await owner.request('/api/chat-folders');
  assert.equal(folderList.data.folders.some((folder) => Number(folder.id) === secondaryFolderId), false);
  assert.equal(folderList.data.folders.some((folder) => Number(folder.id) === folderId), true);
});

test('bot auto folders collect private chats and keep historical group links after bot removal', async () => {
  const { admin } = scenario;
  const owner = createSession(sandbox.baseUrl);
  const peer = createSession(sandbox.baseUrl);
  await owner.register(makeUser('botfolder'));
  await peer.register(makeUser('botpeer'));

  const bot = await createOpenAiBot(admin, {
    visibleToUsers: true,
    name: `Folder Bot ${Date.now()}`,
  });
  await admin.request(`/api/admin/users/${owner.user.id}/bot-access`, {
    method: 'PUT',
    json: { can_add_bots_to_chats: true },
  });

  const { data: groupChat } = await owner.request('/api/chats', {
    method: 'POST',
    json: {
      name: `Bot Folder Group ${Date.now()}`,
      type: 'group',
      memberIds: [peer.user.id],
    },
  });
  const { data: privateBotChat } = await owner.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: Number(bot.user_id) },
  });

  let folderList = await owner.request('/api/chat-folders');
  let botFolder = folderList.data.folders.find((folder) => Number(folder.bot_id) === Number(bot.id));
  assert.ok(botFolder);
  assert.equal(botFolder.kind, 'bot_auto');
  assert.equal(botFolder.name, `${bot.name} чаты`);
  assert.ok(botFolder.chat_ids.includes(privateBotChat.id));

  await owner.request(`/api/chats/${groupChat.id}/members`, {
    method: 'POST',
    json: { userId: Number(bot.user_id) },
  });
  folderList = await owner.request('/api/chat-folders');
  botFolder = folderList.data.folders.find((folder) => Number(folder.bot_id) === Number(bot.id));
  assert.ok(botFolder.chat_ids.includes(groupChat.id));

  await owner.request(`/api/chats/${groupChat.id}/members/${bot.user_id}`, {
    method: 'DELETE',
  });
  folderList = await owner.request('/api/chat-folders');
  botFolder = folderList.data.folders.find((folder) => Number(folder.bot_id) === Number(bot.id));
  assert.ok(botFolder.chat_ids.includes(groupChat.id));
  assert.ok(botFolder.chat_ids.includes(privateBotChat.id));
});

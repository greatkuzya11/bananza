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

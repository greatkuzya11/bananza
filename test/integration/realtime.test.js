const test = require('node:test');
const assert = require('node:assert/strict');
const { before, after } = require('node:test');

const { createSession, makeUser, waitForSocketMessage } = require('../support/api');
const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');

let sandbox;
let scenario;
let adminSocket;
let bobSocket;

before(async () => {
  sandbox = await createSandbox({ name: 'realtime' });
  scenario = await createBasicChatScenario(sandbox.baseUrl);
  adminSocket = await scenario.admin.openWebSocket();
  bobSocket = await scenario.bob.openWebSocket();
});

after(async () => {
  try { adminSocket?.close(); } catch {}
  try { bobSocket?.close(); } catch {}
  await sandbox?.stop?.();
});

test('typing, messages, reactions, poll updates, pins and read receipts fan out over websocket', async () => {
  const { admin, bob, groupChat } = scenario;

  bobSocket.send(JSON.stringify({ type: 'typing', chatId: groupChat.id }));
  const typing = await waitForSocketMessage(adminSocket, (message) => (
    message.type === 'typing'
    && message.chatId === groupChat.id
    && message.userId === bob.user.id
  ));
  assert.equal(typing.username, bob.user.username);

  const messageEventPromise = waitForSocketMessage(adminSocket, (message) => (
    message.type === 'message'
    && message.message?.chat_id === groupChat.id
  ));
  const created = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: { text: 'Realtime hello' },
  });
  const messageEvent = await messageEventPromise;
  assert.equal(messageEvent.message.id, created.data.id);

  const reactionEventPromise = waitForSocketMessage(adminSocket, (message) => (
    message.type === 'reaction'
    && message.messageId === created.data.id
  ));
  await bob.request(`/api/messages/${created.data.id}/reactions`, {
    method: 'POST',
    json: { emoji: '👍' },
  });
  const reactionEvent = await reactionEventPromise;
  assert.equal(reactionEvent.reactions.length, 1);

  const pinEventPromise = waitForSocketMessage(adminSocket, (message) => (
    message.type === 'pins_updated'
    && message.messageId === created.data.id
  ));
  await bob.request(`/api/messages/${created.data.id}/pin`, {
    method: 'POST',
    json: {},
  });
  const pinEvent = await pinEventPromise;
  assert.equal(pinEvent.action, 'pinned');

  const pollCreated = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: {
      text: 'Realtime poll',
      poll: {
        style: 'pulse',
        options: ['Yes', 'No'],
        show_voters: true,
      },
    },
  });
  const yesOption = pollCreated.data.poll.options.find((option) => option.text === 'Yes');
  const pollUpdatePromise = waitForSocketMessage(adminSocket, (message) => (
    message.type === 'poll_updated'
    && message.messageId === pollCreated.data.id
  ));
  await bob.request(`/api/messages/${pollCreated.data.id}/poll-vote`, {
    method: 'POST',
    json: { optionIds: [yesOption.id] },
  });
  const pollUpdate = await pollUpdatePromise;
  assert.equal(pollUpdate.poll.options.find((option) => option.text === 'Yes').vote_count, 1);

  const readEventPromise = waitForSocketMessage(adminSocket, (message) => (
    message.type === 'messages_read'
    && message.chatId === groupChat.id
    && message.userId === bob.user.id
  ));
  await bob.request(`/api/chats/${groupChat.id}/read`, {
    method: 'POST',
    json: { lastReadId: created.data.id },
  });
  const readEvent = await readEventPromise;
  assert.equal(readEvent.lastReadId, created.data.id);
});

test('chat folder mutations emit user-scoped chat_folders_updated websocket events', async () => {
  const owner = createSession(sandbox.baseUrl);
  const peer = createSession(sandbox.baseUrl);
  await owner.register(makeUser('wsfolder'));
  await peer.register(makeUser('wspeer'));

  const { data: privateChat } = await owner.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: peer.user.id },
  });

  const ownerSocket = await owner.openWebSocket();
  try {
    const createdEventPromise = waitForSocketMessage(ownerSocket, (message) => (
      message.type === 'chat_folders_updated'
      && message.reason === 'folder_created'
    ));

    const created = await owner.request('/api/chat-folders', {
      method: 'POST',
      json: {
        name: 'Realtime folders',
        chatIds: [privateChat.id],
      },
    });
    const createdEvent = await createdEventPromise;
    assert.equal(Number(createdEvent.folderId), Number(created.data.folder.id));

    const renameEventPromise = waitForSocketMessage(ownerSocket, (message) => (
      message.type === 'chat_folders_updated'
      && message.reason === 'folder_renamed'
    ));
    await owner.request(`/api/chat-folders/${created.data.folder.id}`, {
      method: 'PUT',
      json: { name: 'Realtime folders renamed' },
    });
    const renameEvent = await renameEventPromise;
    assert.equal(Number(renameEvent.folderId), Number(created.data.folder.id));
  } finally {
    ownerSocket.close();
  }
});

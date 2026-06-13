const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { before, after } = require('node:test');
const Database = require('better-sqlite3');
const WebSocket = require('ws');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');

const { createSession, makeUser } = require('../support/api');
const { createSandbox } = require('../support/runtimeSandbox');
const { waitFor } = require('../support/scenario');

let sandbox;
let admin;
let bob;
let carol;

before(async () => {
  sandbox = await createSandbox({ name: 'documents-api' });
  admin = createSession(sandbox.baseUrl);
  bob = createSession(sandbox.baseUrl);
  carol = createSession(sandbox.baseUrl);
  await admin.register(makeUser('docadmin'));
  await bob.register(makeUser('docbob'));
  await carol.register(makeUser('doccarol'));
});

after(async () => {
  await sandbox?.stop?.();
});

function waitForProviderConnected(provider) {
  return new Promise((resolve, reject) => {
    if (provider.wsconnected) return resolve();
    const timer = setTimeout(() => reject(new Error('Timed out waiting for document websocket')), 10_000);
    provider.on('status', (event) => {
      if (event.status !== 'connected') return;
      clearTimeout(timer);
      resolve();
    });
  });
}

test('documents can be created, invited, edited by guest, and are not message chats', async () => {
  const solo = await admin.request('/api/documents', {
    method: 'POST',
    json: { title: 'Solo Draft' },
  });
  assert.equal(solo.data.is_document, 1);
  assert.equal(solo.data.name, 'Solo Draft');
  const soloSession = await admin.request(`/api/documents/${solo.data.id}/session`);
  assert.equal(soloSession.data.document.title, 'Solo Draft');
  await bob.request(`/api/documents/${solo.data.id}/session`, { expectedStatus: 403 });

  const created = await admin.request('/api/documents', {
    method: 'POST',
    json: {
      title: 'Roadmap Doc',
      memberIds: [bob.user.id],
    },
  });
  const chatId = created.data.id;
  assert.equal(created.data.is_document, 1);
  assert.equal(created.data.type, 'group');
  assert.equal(created.data.name, 'Roadmap Doc');

  const adminChats = await admin.request('/api/chats');
  const adminDoc = adminChats.data.find((chat) => Number(chat.id) === Number(chatId));
  assert.ok(adminDoc, 'document appears in creator chat list');
  assert.equal(adminDoc.is_document, 1);
  assert.equal(adminDoc.unread_count, 0);

  const bobSession = await bob.request(`/api/documents/${chatId}/session`);
  assert.equal(bobSession.data.room, `doc:${chatId}`);
  assert.equal(bobSession.data.document.title, 'Roadmap Doc');

  await carol.request(`/api/documents/${chatId}/session`, { expectedStatus: 403 });
  await admin.request(`/api/chats/${chatId}/messages`, { expectedStatus: 400 });
  await admin.request(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    json: { text: 'not a chat message' },
    expectedStatus: 400,
  });

  const invite = await admin.request(`/api/documents/${chatId}/invite-link`);
  assert.match(invite.data.path, /^\/doc\//);
  const guestSession = await createSession(sandbox.baseUrl).request(`/api/document-invites/${invite.data.token}/session`);
  assert.equal(guestSession.data.room, `doc:${chatId}`);
  assert.equal(guestSession.data.guestToken, invite.data.token);

  await bob.request(`/api/documents/${chatId}/invite-link/rotate`, { method: 'POST', expectedStatus: 403 });
  const rotated = await admin.request(`/api/documents/${chatId}/invite-link/rotate`, { method: 'POST' });
  await createSession(sandbox.baseUrl).request(`/api/document-invites/${invite.data.token}/session`, { expectedStatus: 404 });
  const rotatedGuest = await createSession(sandbox.baseUrl).request(`/api/document-invites/${rotated.data.token}/session`);
  assert.equal(rotatedGuest.data.document.chatId, chatId);

  const room = `doc:${chatId}`;
  const wsBase = `${sandbox.baseUrl.replace(/^http/, 'ws')}/doc-ws`;
  const memberDoc = new Y.Doc();
  const guestDoc = new Y.Doc();
  const memberProvider = new WebsocketProvider(wsBase, room, memberDoc, {
    params: { token: admin.token },
    WebSocketPolyfill: WebSocket,
    disableBc: true,
  });
  const guestProvider = new WebsocketProvider(wsBase, room, guestDoc, {
    params: { guestToken: rotated.data.token },
    WebSocketPolyfill: WebSocket,
    disableBc: true,
  });
  try {
    await Promise.all([waitForProviderConnected(memberProvider), waitForProviderConnected(guestProvider)]);
    const memberTitle = memberDoc.getText('title');
    const guestTitle = guestDoc.getText('title');
    await waitFor(() => assert.equal(memberTitle.toString(), 'Roadmap Doc'), { timeoutMs: 10_000, intervalMs: 100 });
    await waitFor(() => assert.equal(guestTitle.toString(), 'Roadmap Doc'), { timeoutMs: 10_000, intervalMs: 100 });
    memberDoc.transact(() => {
      memberTitle.delete(0, memberTitle.length);
      memberTitle.insert(0, 'Live Roadmap');
    });
    await waitFor(() => assert.equal(guestTitle.toString(), 'Live Roadmap'), { timeoutMs: 10_000, intervalMs: 100 });
  } finally {
    memberProvider.destroy();
    guestProvider.destroy();
    memberDoc.destroy();
    guestDoc.destroy();
  }

  const dbPath = path.join(sandbox.appDir, 'bananza.db');
  await waitFor(() => {
    const db = new Database(dbPath, { readonly: true });
    try {
      const row = db.prepare('SELECT c.is_document, c.name, d.title, length(d.ydoc_state) as state_size FROM chats c JOIN documents d ON d.chat_id=c.id WHERE c.id=?').get(chatId);
      assert.equal(row.is_document, 1);
      assert.equal(row.name, 'Live Roadmap');
      assert.equal(row.title, 'Live Roadmap');
      assert.ok(Number(row.state_size || 0) > 0);
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      db.close();
    }
  }, { timeoutMs: 10_000, intervalMs: 250 });
});

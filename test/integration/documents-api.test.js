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

  const repeatedInvite = await admin.request(`/api/documents/${chatId}/invite-link`);
  assert.equal(repeatedInvite.data.token, invite.data.token);
  const legacyRotate = await bob.request(`/api/documents/${chatId}/invite-link/rotate`, { method: 'POST' });
  assert.equal(legacyRotate.data.token, invite.data.token);
  const sameGuest = await createSession(sandbox.baseUrl).request(`/api/document-invites/${invite.data.token}/session`);
  assert.equal(sameGuest.data.document.chatId, chatId);

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
    params: { guestToken: invite.data.token },
    WebSocketPolyfill: WebSocket,
    disableBc: true,
  });
  try {
    await Promise.all([waitForProviderConnected(memberProvider), waitForProviderConnected(guestProvider)]);
    const memberTitle = memberDoc.getText('title');
    const guestTitle = guestDoc.getText('title');
    const memberContent = memberDoc.getXmlFragment('prosemirror');
    const guestContent = guestDoc.getXmlFragment('prosemirror');
    await waitFor(() => assert.equal(memberTitle.toString(), 'Roadmap Doc'), { timeoutMs: 10_000, intervalMs: 100 });
    await waitFor(() => assert.equal(guestTitle.toString(), 'Roadmap Doc'), { timeoutMs: 10_000, intervalMs: 100 });
    memberDoc.transact(() => {
      memberTitle.delete(0, memberTitle.length);
      memberTitle.insert(0, 'Live Roadmap');
    });
    await waitFor(() => assert.equal(guestTitle.toString(), 'Live Roadmap'), { timeoutMs: 10_000, intervalMs: 100 });

    await carol.request(`/api/documents/${chatId}/title`, {
      method: 'PUT',
      json: { title: 'Carol cannot rename' },
      expectedStatus: 403,
    });
    const renamed = await bob.request(`/api/documents/${chatId}/title`, {
      method: 'PUT',
      json: { title: 'Settings Roadmap' },
    });
    assert.equal(renamed.data.chat.document_title, 'Settings Roadmap');
    await waitFor(() => assert.equal(memberTitle.toString(), 'Settings Roadmap'), { timeoutMs: 10_000, intervalMs: 100 });
    await waitFor(() => assert.equal(guestTitle.toString(), 'Settings Roadmap'), { timeoutMs: 10_000, intervalMs: 100 });

    memberDoc.transact(() => {
      memberContent.push([new Y.XmlElement('paragraph')]);
    });
    await waitFor(() => assert.equal(guestContent.length, 1), { timeoutMs: 10_000, intervalMs: 100 });
    await bob.request(`/api/documents/${chatId}/content`, { method: 'DELETE', expectedStatus: 403 });
    const beforeClearInviteToken = dbValue(path.join(sandbox.appDir, 'bananza.db'), 'SELECT invite_token FROM documents WHERE chat_id=?', chatId).invite_token;
    await admin.request(`/api/documents/${chatId}/content`, { method: 'DELETE' });
    await waitFor(() => assert.equal(memberContent.length, 0), { timeoutMs: 10_000, intervalMs: 100 });
    await waitFor(() => assert.equal(guestContent.length, 0), { timeoutMs: 10_000, intervalMs: 100 });
    const afterClear = dbValue(path.join(sandbox.appDir, 'bananza.db'), `
      SELECT c.name, d.title, d.invite_token, length(d.ydoc_state) as state_size
      FROM chats c JOIN documents d ON d.chat_id=c.id
      WHERE c.id=?
    `, chatId);
    assert.equal(afterClear.name, 'Settings Roadmap');
    assert.equal(afterClear.title, 'Settings Roadmap');
    assert.equal(afterClear.invite_token, beforeClearInviteToken);
    assert.ok(Number(afterClear.state_size || 0) > 0);
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
      assert.equal(row.name, 'Settings Roadmap');
      assert.equal(row.title, 'Settings Roadmap');
      assert.ok(Number(row.state_size || 0) > 0);
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      db.close();
    }
  }, { timeoutMs: 10_000, intervalMs: 250 });

  await admin.request(`/api/chats/${chatId}`, { method: 'DELETE' });
  await waitFor(() => {
    const db = new Database(dbPath, { readonly: true });
    try {
      assert.equal(db.prepare('SELECT COUNT(*) as count FROM documents WHERE chat_id=?').get(chatId).count, 0);
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      db.close();
    }
  }, { timeoutMs: 10_000, intervalMs: 250 });
});

function dbValue(dbPath, sql, ...params) {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.prepare(sql).get(...params);
  } finally {
    db.close();
  }
}

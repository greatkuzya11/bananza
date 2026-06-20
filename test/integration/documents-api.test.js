const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { before, after } = require('node:test');
const Database = require('better-sqlite3');
const WebSocket = require('ws');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');

const { createSession, makeUser, waitForSocketMessage } = require('../support/api');
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

async function enableOpenAiForTests(session, overrides = {}) {
  const response = await session.request('/api/admin/ai-bots/settings', {
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

async function createOpenAiChatShotBot(session, {
  name,
  availableInAllChats = false,
  enabled = true,
} = {}) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const response = await session.request('/api/admin/openai-chatshot-bots', {
    method: 'POST',
    json: {
      name: name || `Doc Shot ${token}`.slice(0, 30),
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

async function createOpenAiTextBot(session, {
  name,
  mention,
  visibleToUsers = true,
  enabled = true,
} = {}) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const response = await session.request('/api/admin/ai-bots', {
    method: 'POST',
    json: {
      name: name || `Doc Text Bot ${token}`.slice(0, 30),
      mention: mention || `doc_bot_${token}`.slice(0, 24),
      enabled,
      visible_to_users: visibleToUsers,
      response_model: 'gpt-4o-mini',
      summary_model: 'gpt-4o-mini',
    },
  });
  return response.data.bot;
}

function responseHasBot(response, botId) {
  return Array.isArray(response.data?.bots)
    && response.data.bots.some((bot) => Number(bot.id) === Number(botId));
}

function appendParagraph(fragment, text) {
  const paragraph = new Y.XmlElement('paragraph');
  const nodeText = new Y.XmlText();
  fragment.push([paragraph]);
  paragraph.push([nodeText]);
  nodeText.insert(0, String(text || ''));
}

function appendParagraphWithInlineImage(fragment, text, attrs = {}) {
  const paragraph = new Y.XmlElement('paragraph');
  const nodeText = new Y.XmlText();
  const image = new Y.XmlElement(attrs.nodeName || 'image_inline');
  fragment.push([paragraph]);
  paragraph.push([nodeText, image]);
  Object.entries({
    assetId: attrs.assetId || null,
    src: attrs.src || '',
    width: attrs.width || 420,
    height: null,
    align: null,
    x: 0,
    y: 0,
    zIndex: 1,
    caption: '',
    alt: attrs.alt || '',
  }).forEach(([key, value]) => {
    if (value !== null) image.setAttribute(key, value);
  });
  nodeText.insert(0, String(text || ''));
}

function countDocumentImages(type) {
  let count = 0;
  const visit = (node) => {
    if (!node || typeof node.toArray !== 'function') return;
    node.toArray().forEach((child) => {
      if (child instanceof Y.XmlElement && ['image', 'image_block', 'image_inline'].includes(child.nodeName)) {
        count += 1;
      }
      visit(child);
    });
  };
  visit(type);
  return count;
}

function tinyPngBuffer() {
  return Buffer.from(
    '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360606060000000040001F61738550000000049454E44AE426082',
    'hex'
  );
}

async function uploadDocumentImage(session, chatId, {
  filename = 'doc-image.png',
  mimeType = 'image/png',
  body = tinyPngBuffer(),
  expectedStatus = 200,
} = {}) {
  const form = new FormData();
  form.append('file', new Blob([body], { type: mimeType }), filename);
  return session.request(`/api/documents/${chatId}/images`, {
    method: 'POST',
    formData: form,
    expectedStatus,
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

test('documents reject AI bot members on create and later member add', async () => {
  const bot = await createOpenAiTextBot(admin, { visibleToUsers: true });
  assert.ok(Number(bot.user_id) > 0);

  await admin.request('/api/documents', {
    method: 'POST',
    json: {
      title: 'Bot Blocked Draft',
      memberIds: [Number(bot.user_id)],
    },
    expectedStatus: 400,
  });

  const created = await admin.request('/api/documents', {
    method: 'POST',
    json: {
      title: 'Human Only Draft',
      memberIds: [bob.user.id],
    },
  });
  const chatId = Number(created.data.id);

  try {
    await admin.request(`/api/chats/${chatId}/members`, {
      method: 'POST',
      json: { userId: Number(bot.user_id) },
      expectedStatus: 400,
    });

    const dbPath = path.join(sandbox.appDir, 'bananza.db');
    assert.equal(dbValue(dbPath, 'SELECT COUNT(*) as count FROM chat_members WHERE chat_id=? AND user_id=?', chatId, Number(bot.user_id)).count, 0);
    assert.equal(dbValue(dbPath, 'SELECT COUNT(*) as count FROM ai_chat_bots WHERE chat_id=? AND bot_id=?', chatId, Number(bot.id)).count, 0);

    await admin.request(`/api/chats/${chatId}/members`, {
      method: 'POST',
      json: { userId: carol.user.id },
    });
    const carolSession = await carol.request(`/api/documents/${chatId}/session`);
    assert.equal(carolSession.data.document.chatId, chatId);
  } finally {
    await admin.request(`/api/chats/${chatId}`, { method: 'DELETE' }).catch(() => {});
  }
});

test('document image assets upload for members and are removed with document cleanup', async () => {
  const created = await admin.request('/api/documents', {
    method: 'POST',
    json: {
      title: 'Image Asset Doc',
      memberIds: [bob.user.id],
    },
  });
  const chatId = created.data.id;
  const dbPath = path.join(sandbox.appDir, 'bananza.db');
  const uploadsDir = path.join(sandbox.appDir, 'uploads');

  try {
    await createSession(sandbox.baseUrl).request(`/api/documents/${chatId}/images`, {
      method: 'POST',
      formData: new FormData(),
      expectedStatus: 401,
    });
    await uploadDocumentImage(carol, chatId, { expectedStatus: 403 });

    const uploaded = await uploadDocumentImage(bob, chatId);
    assert.equal(uploaded.data.asset.type, 'image');
    assert.equal(uploaded.data.asset.mime_type, 'image/png');
    assert.match(uploaded.data.asset.src, /^\/uploads\/[^/]+\/preview$/);
    assert.equal(fs.existsSync(path.join(uploadsDir, uploaded.data.asset.stored_name)), true);

    const assetRow = dbValue(dbPath, `
      SELECT da.chat_id, da.file_id, da.kind, f.stored_name, f.type
      FROM document_assets da
      JOIN files f ON f.id=da.file_id
      WHERE da.id=?
    `, uploaded.data.asset.id);
    assert.equal(assetRow.chat_id, chatId);
    assert.equal(assetRow.file_id, uploaded.data.asset.fileId);
    assert.equal(assetRow.kind, 'image');
    assert.equal(assetRow.stored_name, uploaded.data.asset.stored_name);
    assert.equal(assetRow.type, 'image');

    const beforeBadUploadFiles = new Set(fs.readdirSync(uploadsDir));
    const beforeBadUploadFileCount = dbValue(dbPath, 'SELECT COUNT(*) as count FROM files').count;
    const badUpload = await uploadDocumentImage(bob, chatId, {
      filename: 'not-image.txt',
      mimeType: 'text/plain',
      body: 'not an image',
      expectedStatus: 400,
    });
    assert.equal(badUpload.data.error, 'Only images can be inserted');
    assert.equal(dbValue(dbPath, 'SELECT COUNT(*) as count FROM files').count, beforeBadUploadFileCount);
    assert.deepEqual(new Set(fs.readdirSync(uploadsDir)), beforeBadUploadFiles);

    await admin.request(`/api/documents/${chatId}/content`, { method: 'DELETE' });
    assert.equal(dbValue(dbPath, 'SELECT COUNT(*) as count FROM document_assets WHERE chat_id=?', chatId).count, 0);
    assert.equal(dbValue(dbPath, 'SELECT COUNT(*) as count FROM files WHERE id=?', uploaded.data.asset.fileId).count, 0);
    assert.equal(fs.existsSync(path.join(uploadsDir, uploaded.data.asset.stored_name)), false);

    const uploadedAgain = await uploadDocumentImage(admin, chatId, { filename: 'doc-delete.png' });
    assert.equal(fs.existsSync(path.join(uploadsDir, uploadedAgain.data.asset.stored_name)), true);
    await admin.request(`/api/chats/${chatId}`, { method: 'DELETE' });
    assert.equal(fs.existsSync(path.join(uploadsDir, uploadedAgain.data.asset.stored_name)), false);
    const db = new Database(dbPath, { readonly: true });
    try {
      assert.equal(db.prepare('SELECT COUNT(*) as count FROM documents WHERE chat_id=?').get(chatId).count, 0);
      assert.equal(db.prepare('SELECT COUNT(*) as count FROM document_assets WHERE chat_id=?').get(chatId).count, 0);
      assert.equal(db.prepare('SELECT COUNT(*) as count FROM files WHERE id=?').get(uploadedAgain.data.asset.fileId).count, 0);
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      db.close();
    }
  } finally {
    await admin.request(`/api/chats/${chatId}`, { method: 'DELETE' }).catch(() => {});
  }
});

test('document server plain text extraction preserves document image nodes', async () => {
  const created = await admin.request('/api/documents', {
    method: 'POST',
    json: {
      title: 'Inline Image Survival',
      memberIds: [bob.user.id],
    },
  });
  const chatId = created.data.id;
  const uploaded = await uploadDocumentImage(admin, chatId, { filename: 'inline-survival.png' });
  const asset = uploaded.data.asset;
  const room = `doc:${chatId}`;
  const wsBase = `${sandbox.baseUrl.replace(/^http/, 'ws')}/doc-ws`;
  const memberDoc = new Y.Doc();
  const memberProvider = new WebsocketProvider(wsBase, room, memberDoc, {
    params: { token: admin.token },
    WebSocketPolyfill: WebSocket,
    disableBc: true,
  });

  try {
    await waitForProviderConnected(memberProvider);
    const memberContent = memberDoc.getXmlFragment('prosemirror');
    memberDoc.transact(() => {
      memberContent.delete(0, memberContent.length);
      appendParagraphWithInlineImage(memberContent, 'Text before compatible image.', {
        nodeName: 'image',
        assetId: String(asset.id),
        src: asset.src,
        alt: asset.original_name,
      });
      appendParagraphWithInlineImage(memberContent, 'Text before inline image.', {
        assetId: String(asset.id),
        src: asset.src,
        alt: asset.original_name,
      });
    });
    await waitFor(() => assert.equal(countDocumentImages(memberContent), 2), { timeoutMs: 10_000, intervalMs: 100 });

    const state = await admin.request(`/api/chats/${chatId}/chatshot`);
    assert.equal(state.data.source, 'document');
    assert.ok(Number(state.data.document_text_length || 0) > 10);

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(countDocumentImages(memberContent), 2);
  } finally {
    memberProvider.destroy();
    memberDoc.destroy();
    await admin.request(`/api/chats/${chatId}`, { method: 'DELETE' }).catch(() => {});
  }
});

test('document ChatShot uses document text and saves images to member notes', async () => {
  await enableOpenAiForTests(admin, {
    openai_default_image_model: 'gpt-image-2',
    openai_default_image_size: '1024x1024',
  });

  const created = await admin.request('/api/documents', {
    method: 'POST',
    json: {
      title: 'Document Shot',
      memberIds: [bob.user.id],
    },
  });
  const chatId = created.data.id;
  const bot = await createOpenAiChatShotBot(admin, { availableInAllChats: true });

  try {
    const emptyState = await bob.request(`/api/chats/${chatId}/chatshot`);
    assert.equal(responseHasBot(emptyState, bot.id), true);
    assert.equal(emptyState.data.source, 'document');
    assert.equal(emptyState.data.enabled, false);
    assert.equal(emptyState.data.ready, false);
    assert.equal(emptyState.data.document_text_length, 0);

    await createSession(sandbox.baseUrl).request(`/api/documents/${chatId}/chatshot`, {
      method: 'POST',
      json: {},
      expectedStatus: 401,
    });
    await carol.request(`/api/documents/${chatId}/chatshot`, {
      method: 'POST',
      json: {},
      expectedStatus: 403,
    });
    await bob.request(`/api/documents/${chatId}/chatshot`, {
      method: 'POST',
      json: {},
      expectedStatus: 400,
    });

    const enabledState = await bob.request(`/api/chats/${chatId}/chatshot`, {
      method: 'PUT',
      json: {
        enabled: true,
        botId: bot.id,
        style: 'photo',
        bananaFilterEnabled: true,
      },
    });
    assert.equal(enabledState.data.enabled, true);
    assert.equal(enabledState.data.source, 'document');
    assert.equal(enabledState.data.ready, false);

    const room = `doc:${chatId}`;
    const wsBase = `${sandbox.baseUrl.replace(/^http/, 'ws')}/doc-ws`;
    const memberDoc = new Y.Doc();
    const memberProvider = new WebsocketProvider(wsBase, room, memberDoc, {
      params: { token: admin.token },
      WebSocketPolyfill: WebSocket,
      disableBc: true,
    });
    try {
      await waitForProviderConnected(memberProvider);
      const memberContent = memberDoc.getXmlFragment('prosemirror');
      memberDoc.transact(() => {
        memberContent.delete(0, memberContent.length);
        appendParagraph(memberContent, 'Document ChatShot should analyze this shared document text.');
        appendParagraph(memberContent, 'It must save one generated image into each registered member notes chat.');
      });

      await waitFor(async () => {
        const readyState = await bob.request(`/api/chats/${chatId}/chatshot`);
        assert.equal(readyState.data.ready, true);
        assert.equal(readyState.data.source, 'document');
        assert.ok(Number(readyState.data.document_text_length || 0) > 20);
      }, { timeoutMs: 10_000, intervalMs: 250 });
    } finally {
      memberProvider.destroy();
      memberDoc.destroy();
    }

    const bobSocket = await bob.openWebSocket();
    try {
      const startNoticePromise = waitForSocketMessage(bobSocket, (message) => (
        message.type === 'document_system_notice'
        && Number(message.chatId || 0) === Number(chatId)
        && message.kind === 'chatshot_generation_started'
      ));
      const generated = await bob.request(`/api/documents/${chatId}/chatshot`, {
        method: 'POST',
        json: {},
      });
      const startNotice = await startNoticePromise;
      assert.equal(startNotice.messageKey, 'ChatShot is being created. It will be saved to notes.');
      assert.equal(generated.data.ok, true);
      assert.equal(generated.data.chatId, chatId);
      assert.equal(generated.data.delivered, 2);
    } finally {
      try { bobSocket.close(); } catch {}
    }

    const dbPath = path.join(sandbox.appDir, 'bananza.db');
    await waitFor(() => {
      const db = new Database(dbPath, { readonly: true });
      try {
        assert.equal(db.prepare('SELECT COUNT(*) as count FROM messages WHERE chat_id=?').get(chatId).count, 0);
        const rows = db.prepare(`
          SELECT c.created_by as owner_id, m.text, m.ai_generated, f.mime_type, f.type as file_type, ab.kind as ai_bot_kind
          FROM messages m
          JOIN chats c ON c.id=m.chat_id
          JOIN files f ON f.id=m.file_id
          LEFT JOIN ai_bots ab ON ab.id=m.ai_bot_id
          WHERE c.is_notes=1
            AND c.created_by IN (?,?)
            AND m.text LIKE ?
          ORDER BY c.created_by
        `).all(admin.user.id, bob.user.id, '%Document Shot%');
        assert.equal(rows.length, 2);
        assert.deepEqual(rows.map((row) => Number(row.owner_id)).sort((a, b) => a - b), [admin.user.id, bob.user.id].sort((a, b) => a - b));
        rows.forEach((row) => {
          assert.equal(row.ai_generated, 1);
          assert.equal(row.file_type, 'image');
          assert.equal(row.mime_type, 'image/svg+xml');
          assert.equal(row.ai_bot_kind, 'chatshot');
          assert.match(row.text, /Document Shot/);
        });
        assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      } finally {
        db.close();
      }
    }, { timeoutMs: 10_000, intervalMs: 250 });
  } finally {
    await admin.request('/api/admin/ai-bots/settings', {
      method: 'PUT',
      json: { enabled: false, openai_interactive_enabled: false },
    }).catch(() => {});
    await admin.request(`/api/chats/${chatId}`, { method: 'DELETE' }).catch(() => {});
  }
});

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const Y = require('yjs');
const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils');

const DOCUMENT_INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const DEFAULT_DOCUMENT_TITLE = 'Untitled document';
const SAVE_DEBOUNCE_MS = 900;

function clampTitle(value) {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
  if (!title) return DEFAULT_DOCUMENT_TITLE;
  return title.slice(0, 80);
}

function boolDocument(value) {
  return Number(value || 0) === 1;
}

function createDocumentsFeature({
  app,
  server,
  db,
  auth,
  jwtSecret,
  sendToUser,
  broadcastToChatAll,
  publicChatPayload,
  publicChatPayloadForViewer,
  recordChatSystemEvent,
  pushFeature = null,
} = {}) {
  if (!app || !server || !db || typeof auth !== 'function') {
    throw new Error('Document feature requires app, server, db, and auth');
  }

  const saveTimers = new Map();

  const documentChatStmt = db.prepare(`
    SELECT c.*,
      d.title as document_title,
      d.updated_at as document_updated_at,
      d.updated_at as last_time,
      NULL as last_text,
      NULL as last_user,
      NULL as last_file_id,
      0 as last_message_id,
      NULL as first_unread_id
    FROM chats c
    JOIN documents d ON d.chat_id=c.id
    WHERE c.id=? AND COALESCE(c.is_document,0)=1
  `);
  const documentSessionStmt = db.prepare(`
    SELECT c.id, c.name, c.created_by, c.created_at,
      d.title, d.updated_at, d.created_at as document_created_at
    FROM chats c
    JOIN documents d ON d.chat_id=c.id
    WHERE c.id=? AND COALESCE(c.is_document,0)=1
  `);
  const documentByTokenStmt = db.prepare(`
    SELECT c.id, c.name, c.created_by, c.created_at,
      d.title, d.updated_at, d.created_at as document_created_at, d.invite_token
    FROM documents d
    JOIN chats c ON c.id=d.chat_id
    WHERE d.invite_token=? AND COALESCE(c.is_document,0)=1
  `);
  const documentStateStmt = db.prepare('SELECT title, ydoc_state FROM documents WHERE chat_id=?');
  const memberStmt = db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?');
  const memberIdsStmt = db.prepare('SELECT user_id FROM chat_members WHERE chat_id=?');

  function getDocumentChat(chatId) {
    return documentChatStmt.get(Number(chatId || 0)) || null;
  }

  function getDocumentSession(chatId) {
    return documentSessionStmt.get(Number(chatId || 0)) || null;
  }

  function isDocumentMember(chatId, userId) {
    return Boolean(memberStmt.get(Number(chatId || 0), Number(userId || 0)));
  }

  function getDocumentMemberIds(chatId) {
    return memberIdsStmt.all(Number(chatId || 0)).map((row) => Number(row.user_id || 0)).filter(Boolean);
  }

  function documentInvitePath(token) {
    return `/doc/${encodeURIComponent(String(token || ''))}`;
  }

  function documentInvitePayload(req, token) {
    const pathValue = documentInvitePath(token);
    const origin = `${req.protocol}://${req.get('host') || 'localhost'}`;
    return {
      path: pathValue,
      url: new URL(pathValue, origin).href,
      token,
    };
  }

  function generateDocumentInviteToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  function ensureDocumentInviteToken(chatId) {
    const id = Number(chatId || 0);
    if (!id) return null;
    const existing = db.prepare('SELECT invite_token FROM documents WHERE chat_id=?').get(id);
    if (existing?.invite_token) return existing.invite_token;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const token = generateDocumentInviteToken();
      try {
        db.prepare("UPDATE documents SET invite_token=?, invite_token_created_at=datetime('now') WHERE chat_id=?")
          .run(token, id);
        return token;
      } catch (error) {
        if (!String(error?.code || error?.message || '').includes('CONSTRAINT')) throw error;
      }
    }
    throw new Error('Could not create document invite link');
  }

  function rotateDocumentInviteToken(chatId) {
    const id = Number(chatId || 0);
    if (!id) return null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const token = generateDocumentInviteToken();
      try {
        db.prepare("UPDATE documents SET invite_token=?, invite_token_created_at=datetime('now') WHERE chat_id=?")
          .run(token, id);
        return token;
      } catch (error) {
        if (!String(error?.code || error?.message || '').includes('CONSTRAINT')) throw error;
      }
    }
    throw new Error('Could not refresh document invite link');
  }

  function documentSessionPayload(row, extra = {}) {
    if (!row) return null;
    const chatId = Number(row.id || row.chat_id || 0);
    return {
      document: {
        chatId,
        title: row.title || row.document_title || row.name || DEFAULT_DOCUMENT_TITLE,
        updated_at: row.updated_at || row.document_updated_at || null,
        created_at: row.document_created_at || row.created_at || null,
      },
      room: `doc:${chatId}`,
      wsBase: '/doc-ws',
      ...extra,
    };
  }

  function publicDocumentChat(chat, viewerUserId = null) {
    const payload = typeof publicChatPayloadForViewer === 'function' && viewerUserId
      ? publicChatPayloadForViewer(chat, viewerUserId)
      : (typeof publicChatPayload === 'function' ? publicChatPayload(chat) : { ...chat });
    if (!payload) return payload;
    payload.is_document = 1;
    payload.document_title = payload.document_title || payload.name || DEFAULT_DOCUMENT_TITLE;
    payload.last_time = payload.document_updated_at || payload.last_time || payload.created_at || null;
    payload.last_message_id = 0;
    payload.first_unread_id = null;
    payload.unread_count = 0;
    return payload;
  }

  function persistDocumentNow(docName, ydoc) {
    const match = /^doc:(\d+)$/.exec(String(docName || ''));
    if (!match) return false;
    const chatId = Number(match[1]);
    if (!chatId) return false;
    const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    const titleText = ydoc.getText('title');
    const title = clampTitle(titleText.toString());
    const current = documentStateStmt.get(chatId);
    if (!current) return false;
    db.prepare(`
      UPDATE documents
      SET ydoc_state=?, title=?, updated_at=datetime('now')
      WHERE chat_id=?
    `).run(state, title, chatId);
    db.prepare('UPDATE chats SET name=? WHERE id=? AND COALESCE(is_document,0)=1').run(title, chatId);
    const chat = getDocumentChat(chatId);
    const savedAt = chat?.document_updated_at || null;
    broadcastToChatAll?.(chatId, {
      type: 'document_saved',
      chatId,
      title,
      updated_at: savedAt,
    });
    if (chat) {
      broadcastToChatAll?.(chatId, {
        type: 'chat_updated',
        chat: publicDocumentChat(chat),
      });
    }
    return true;
  }

  function schedulePersist(docName, ydoc) {
    const name = String(docName || '');
    if (!name) return;
    clearTimeout(saveTimers.get(name));
    const timer = setTimeout(() => {
      saveTimers.delete(name);
      try {
        persistDocumentNow(name, ydoc);
      } catch (error) {
        console.warn('[documents] persist failed:', error?.message || error);
      }
    }, SAVE_DEBOUNCE_MS);
    saveTimers.set(name, timer);
  }

  setPersistence({
    provider: db,
    bindState: (docName, ydoc) => {
      const match = /^doc:(\d+)$/.exec(String(docName || ''));
      if (!match) return;
      const chatId = Number(match[1]);
      const row = documentStateStmt.get(chatId);
      if (!row) return;
      if (row.ydoc_state) {
        Y.applyUpdate(ydoc, new Uint8Array(row.ydoc_state));
      }
      const titleText = ydoc.getText('title');
      if (!titleText.toString()) {
        titleText.insert(0, clampTitle(row.title));
      }
      ydoc.on('update', () => schedulePersist(docName, ydoc));
    },
    writeState: async (docName, ydoc) => {
      clearTimeout(saveTimers.get(docName));
      saveTimers.delete(docName);
      persistDocumentNow(docName, ydoc);
    },
  });

  function requireDocumentMember(req, res, next) {
    const chatId = Number(req.params.chatId || 0);
    const chat = getDocumentSession(chatId);
    if (!chat) return res.status(404).json({ error: 'Document not found' });
    if (!isDocumentMember(chatId, req.user.id)) return res.status(403).json({ error: 'Not a member' });
    req.documentChat = chat;
    return next();
  }

  app.post('/api/documents', auth, (req, res) => {
    try {
      const title = clampTitle(req.body?.title);
      const rawMemberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
      const requestedIds = [...new Set(
        rawMemberIds
          .map((value) => Number(value || 0))
          .filter((value) => Number.isInteger(value) && value > 0 && value !== Number(req.user.id))
      )];
      const users = requestedIds.length
        ? db.prepare(`SELECT id, display_name, COALESCE(is_ai_bot,0) as is_ai_bot FROM users WHERE id IN (${requestedIds.map(() => '?').join(',')})`)
          .all(...requestedIds)
        : [];
      if (users.length !== requestedIds.length || users.some((row) => Number(row.is_ai_bot) !== 0)) {
        return res.status(400).json({ error: 'Selected users are unavailable' });
      }
      const created = db.transaction(() => {
        const inserted = db.prepare('INSERT INTO chats(name,type,created_by,is_document) VALUES(?,?,?,1)')
          .run(title, 'group', req.user.id);
        const chatId = Number(inserted.lastInsertRowid || 0);
        db.prepare('INSERT INTO documents(chat_id,title,invite_token,invite_token_created_at) VALUES(?,?,?,datetime(\'now\'))')
          .run(chatId, title, generateDocumentInviteToken());
        const addMember = db.prepare('INSERT OR IGNORE INTO chat_members(chat_id,user_id) VALUES(?,?)');
        addMember.run(chatId, req.user.id);
        users.forEach((user) => addMember.run(chatId, user.id));
        recordChatSystemEvent?.({
          chatId,
          eventType: 'chat_created',
          actor: req.user,
          metadata: { chat_name: title, source: 'document_create' },
          broadcast: false,
        });
        users.forEach((user) => {
          recordChatSystemEvent?.({
            chatId,
            eventType: 'member_added',
            actor: req.user,
            target: user,
            metadata: { source: 'document_create' },
            broadcast: false,
          });
        });
        return getDocumentChat(chatId);
      })();
      const memberIds = getDocumentMemberIds(created.id);
      memberIds.forEach((userId) => {
        sendToUser?.(userId, {
          type: 'chat_created',
          chat: publicDocumentChat(created, userId),
          actorId: req.user.id,
          actorName: req.user.display_name,
          is_invite: userId !== Number(req.user.id),
        });
        if (userId !== Number(req.user.id)) {
          pushFeature?.notifyChatInvite?.(userId, {
            chat: publicDocumentChat(created, userId),
            actorName: req.user.display_name,
          });
        }
      });
      return res.json(publicDocumentChat(created, req.user.id));
    } catch (error) {
      console.error('[documents] create failed:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/api/documents/:chatId/session', auth, requireDocumentMember, (req, res) => {
    res.json(documentSessionPayload(req.documentChat, {
      user: {
        id: req.user.id,
        name: req.user.display_name || req.user.username || `User ${req.user.id}`,
        color: req.user.avatar_color || '#65aadd',
      },
    }));
  });

  app.get('/api/documents/:chatId/invite-link', auth, requireDocumentMember, (req, res) => {
    try {
      const token = ensureDocumentInviteToken(req.documentChat.id);
      res.json(documentInvitePayload(req, token));
    } catch (error) {
      console.error('[documents] invite link failed:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/documents/:chatId/invite-link/rotate', auth, requireDocumentMember, (req, res) => {
    if (!req.user.is_admin && Number(req.documentChat.created_by || 0) !== Number(req.user.id || 0)) {
      return res.status(403).json({ error: 'Only the owner or admin can refresh this invite link' });
    }
    try {
      const token = rotateDocumentInviteToken(req.documentChat.id);
      res.json(documentInvitePayload(req, token));
    } catch (error) {
      console.error('[documents] invite rotate failed:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/api/document-invites/:token/session', (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!DOCUMENT_INVITE_TOKEN_RE.test(token)) return res.status(404).json({ error: 'Document invite is invalid' });
    const row = documentByTokenStmt.get(token);
    if (!row) return res.status(404).json({ error: 'Document invite is invalid' });
    res.json(documentSessionPayload(row, {
      guestToken: token,
      user: {
        id: `guest:${token.slice(0, 10)}`,
        name: 'Guest',
        color: '#8b93a7',
      },
    }));
  });

  function authenticateDocumentUpgrade(request, room) {
    const match = /^doc:(\d+)$/.exec(String(room || ''));
    if (!match) return { ok: false, status: 400, message: 'Invalid document room' };
    const chatId = Number(match[1]);
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const guestToken = url.searchParams.get('guestToken');
    if (token) {
      try {
        const payload = jwt.verify(token, jwtSecret);
        const user = db.prepare('SELECT id, is_blocked FROM users WHERE id=?').get(payload.id);
        if (!user || user.is_blocked) return { ok: false, status: 403, message: 'Blocked' };
        if (!isDocumentMember(chatId, user.id)) return { ok: false, status: 403, message: 'Not a member' };
        return { ok: true, chatId, userId: Number(user.id), kind: 'member' };
      } catch {
        return { ok: false, status: 401, message: 'Invalid token' };
      }
    }
    if (guestToken) {
      if (!DOCUMENT_INVITE_TOKEN_RE.test(String(guestToken))) return { ok: false, status: 401, message: 'Invalid guest token' };
      const row = documentByTokenStmt.get(guestToken);
      if (!row || Number(row.id) !== chatId) return { ok: false, status: 401, message: 'Invalid guest token' };
      return { ok: true, chatId, userId: null, kind: 'guest' };
    }
    return { ok: false, status: 401, message: 'Missing token' };
  }

  const documentWss = new WebSocketServer({ noServer: true });
  documentWss.on('connection', (ws, request) => {
    setupWSConnection(ws, request, { docName: request.documentRoom, gc: true });
  });

  server.on('upgrade', (request, socket, head) => {
    let pathname = '';
    try {
      pathname = new URL(request.url, 'http://localhost').pathname;
    } catch {
      return;
    }
    if (!pathname.startsWith('/doc-ws/')) return;
    const room = decodeURIComponent(pathname.slice('/doc-ws/'.length));
    const authResult = authenticateDocumentUpgrade(request, room);
    if (!authResult.ok) {
      socket.write(`HTTP/1.1 ${authResult.status || 401} Unauthorized\r\nConnection: close\r\n\r\n${authResult.message || 'Unauthorized'}`);
      socket.destroy();
      return;
    }
    request.documentRoom = room;
    request.documentAuth = authResult;
    documentWss.handleUpgrade(request, socket, head, (ws) => {
      documentWss.emit('connection', ws, request);
    });
  });

  return {
    documentInvitePath,
    getDocumentChat,
    getDocumentSession,
    isDocumentChat: (chat) => boolDocument(chat?.is_document),
  };
}

module.exports = {
  createDocumentsFeature,
};

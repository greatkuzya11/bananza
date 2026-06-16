const crypto = require('crypto');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { WebSocketServer } = require('ws');
const Y = require('yjs');
const { Schema } = require('prosemirror-model');
const { schema: basicSchema } = require('prosemirror-schema-basic');
const { addListNodes } = require('prosemirror-schema-list');
const { tableNodes } = require('prosemirror-tables');
const { yXmlFragmentToProseMirrorRootNode } = require('y-prosemirror');
const { setupWSConnection, setPersistence, docs: documentRooms } = require('y-websocket/bin/utils');
const { v4: uuidv4 } = require('uuid');
const { deleteVideoPoster } = require('./videoPosters');
const {
  GENERAL_UPLOAD_LIMIT_BYTES,
  GENERAL_UPLOAD_LIMIT_LABEL,
  classifyUpload,
  normalizeMimeType,
} = require('./uploadUtils');

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

function normalizeTextAlign(value) {
  const align = String(value || '').trim().toLowerCase();
  return ['left', 'center', 'right'].includes(align) ? align : null;
}

function textblockAttrs(dom) {
  return { align: normalizeTextAlign(dom?.style?.textAlign) };
}

function markStyleValue(value) {
  return String(value || '').replace(/[;"<>]/g, '').trim();
}

function documentImageAttrs(extra = {}) {
  return {
    assetId: { default: null },
    src: { default: '' },
    width: { default: 420 },
    height: { default: null },
    align: { default: null },
    x: { default: 0 },
    y: { default: 0 },
    zIndex: { default: 1 },
    caption: { default: '' },
    alt: { default: '' },
    ...extra,
  };
}

function createDocumentSchema() {
  const paragraphNode = {
    content: 'inline*',
    group: 'block',
    attrs: { align: { default: null } },
    parseDOM: [{ tag: 'p', getAttrs: textblockAttrs }],
    toDOM: () => ['p', 0],
  };
  const headingNode = {
    attrs: { level: { default: 1 }, align: { default: null } },
    content: 'inline*',
    group: 'block',
    defining: true,
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
      tag: `h${level}`,
      getAttrs: (dom) => ({ level, align: normalizeTextAlign(dom?.style?.textAlign) }),
    })),
    toDOM: (node) => [`h${node.attrs.level}`, 0],
  };
  const marks = basicSchema.spec.marks
    .addToEnd('underline', {
      parseDOM: [{ tag: 'u' }],
      toDOM: () => ['u', 0],
    })
    .addToEnd('text_color', {
      attrs: { color: {} },
      parseDOM: [{ style: 'color', getAttrs: (value) => ({ color: markStyleValue(value) }) }],
      toDOM: (mark) => ['span', { style: `color:${markStyleValue(mark.attrs.color)}` }, 0],
    })
    .addToEnd('highlight', {
      attrs: { color: {} },
      parseDOM: [{ style: 'background-color', getAttrs: (value) => ({ color: markStyleValue(value) }) }],
      toDOM: (mark) => ['span', { style: `background-color:${markStyleValue(mark.attrs.color)}` }, 0],
    })
    .addToEnd('font_size', {
      attrs: { size: {} },
      parseDOM: [{ style: 'font-size', getAttrs: (value) => ({ size: markStyleValue(value) }) }],
      toDOM: (mark) => ['span', { style: `font-size:${markStyleValue(mark.attrs.size)}` }, 0],
    })
    .addToEnd('font_family', {
      attrs: { family: {} },
      parseDOM: [{ style: 'font-family', getAttrs: (value) => ({ family: markStyleValue(value) }) }],
      toDOM: (mark) => ['span', { style: `font-family:${markStyleValue(mark.attrs.family)}` }, 0],
    });
  const baseNodes = basicSchema.spec.nodes
    .update('paragraph', paragraphNode)
    .update('heading', headingNode)
    .update('image', {
      inline: true,
      group: 'inline',
      atom: true,
      selectable: true,
      draggable: true,
      attrs: documentImageAttrs({ title: { default: null } }),
      parseDOM: [{ tag: 'img[src]' }],
      toDOM: (node) => ['img', {
        src: node.attrs.src || '',
        alt: node.attrs.alt || '',
        title: node.attrs.title || '',
      }],
    });
  const nodes = addListNodes(baseNodes, 'paragraph block*', 'block')
    .append({
      task_list: {
        group: 'block',
        content: 'task_item+',
        parseDOM: [{ tag: 'ul[data-task-list]' }],
        toDOM: () => ['ul', { 'data-task-list': 'true' }, 0],
      },
      task_item: {
        attrs: { checked: { default: false } },
        content: 'paragraph block*',
        defining: true,
        parseDOM: [{
          tag: 'li[data-task-item]',
          getAttrs: (dom) => ({ checked: dom.getAttribute('data-checked') === 'true' }),
        }],
        toDOM: (node) => ['li', { 'data-task-item': 'true', 'data-checked': node.attrs.checked ? 'true' : 'false' }, 0],
      },
      image_block: {
        group: 'block',
        atom: true,
        selectable: true,
        isolating: true,
        attrs: documentImageAttrs(),
        parseDOM: [{ tag: 'figure[data-document-image]' }],
        toDOM: () => ['div', { 'data-document-legacy-image': 'true', contenteditable: 'false' }],
      },
      image_inline: {
        inline: true,
        group: 'inline',
        atom: true,
        selectable: true,
        attrs: documentImageAttrs(),
        parseDOM: [{ tag: 'span[data-document-image]' }],
        toDOM: () => ['span', { 'data-document-legacy-image': 'inline', contenteditable: 'false' }],
      },
    })
    .append(tableNodes({
      tableGroup: 'block',
      cellContent: 'block+',
      cellAttributes: {
        background: {
          default: null,
          getFromDOM: (dom) => dom.style.backgroundColor || null,
          setDOMAttr: (value, attrs) => {
            if (!value) return;
            attrs.style = `${attrs.style || ''};background-color:${markStyleValue(value)}`;
          },
        },
      },
    }));
  return new Schema({ nodes, marks });
}

const documentSchema = createDocumentSchema();

function imageExtensionForMime(mimeType = '') {
  const mime = String(mimeType || '').toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/svg+xml') return '.svg';
  return '.png';
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
  aiBotFeature = null,
  uploadsDir = null,
  ensureNotesChatForUser = null,
  hydrateMessageById = null,
  notifyMessageCreated = null,
  onMessagePublished = null,
  uploadLimiter = null,
} = {}) {
  if (!app || !server || !db || typeof auth !== 'function') {
    throw new Error('Document feature requires app, server, db, and auth');
  }

  const saveTimers = new Map();
  const documentImageUpload = uploadsDir
    ? multer({
      storage: multer.diskStorage({
        destination: uploadsDir,
        filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname || '').toLowerCase()}`),
      }),
      limits: { fileSize: GENERAL_UPLOAD_LIMIT_BYTES, files: 1 },
    })
    : null;

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
  const documentHumanMembersStmt = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.ui_language, COALESCE(u.is_ai_bot,0) as is_ai_bot
    FROM chat_members cm
    JOIN users u ON u.id=cm.user_id
    WHERE cm.chat_id=? AND COALESCE(u.is_ai_bot,0)=0
    ORDER BY u.id ASC
  `);
  const insertFileStmt = db.prepare(`
    INSERT INTO files(original_name, stored_name, mime_type, size, type, uploaded_by)
    VALUES(?,?,?,?,?,?)
  `);
  const insertDocumentAssetStmt = db.prepare(`
    INSERT INTO document_assets(chat_id, file_id, created_by, kind)
    VALUES(?,?,?,'image')
  `);
  const documentAssetFilesStmt = db.prepare(`
    SELECT da.id, da.file_id, f.stored_name
    FROM document_assets da
    JOIN files f ON f.id=da.file_id
    WHERE da.chat_id=?
  `);
  const insertDocumentChatShotMessageStmt = db.prepare(`
    INSERT INTO messages(chat_id, user_id, text, file_id, ai_generated, ai_bot_id)
    VALUES(?,?,?,?,?,?)
  `);

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

  function documentAssetUrl(storedName) {
    return `/uploads/${encodeURIComponent(String(storedName || ''))}/preview`;
  }

  function cleanupUploadedDocumentFile(file) {
    if (file?.path) fs.unlink(file.path, () => {});
  }

  function cleanupDocumentAssets(chatId) {
    const id = Number(chatId || 0);
    if (!id || !uploadsDir) return [];
    const rows = documentAssetFilesStmt.all(id);
    const fileIds = rows.map((row) => Number(row.file_id || 0)).filter(Boolean);
    db.transaction(() => {
      db.prepare('DELETE FROM document_assets WHERE chat_id=?').run(id);
      const deleteFile = db.prepare('DELETE FROM files WHERE id=?');
      fileIds.forEach((fileId) => deleteFile.run(fileId));
    })();
    rows.forEach((row) => {
      const storedName = path.basename(String(row.stored_name || ''));
      if (!storedName) return;
      fs.unlink(path.join(uploadsDir, storedName), () => {});
      deleteVideoPoster(uploadsDir, storedName);
    });
    return rows;
  }

  function documentRoomName(chatId) {
    return `doc:${Number(chatId || 0)}`;
  }

  function loadDetachedDocument(chatId) {
    const row = documentStateStmt.get(Number(chatId || 0));
    if (!row) return null;
    const ydoc = new Y.Doc();
    if (row.ydoc_state) {
      Y.applyUpdate(ydoc, new Uint8Array(row.ydoc_state));
    }
    const titleText = ydoc.getText('title');
    if (!titleText.toString()) {
      titleText.insert(0, clampTitle(row.title));
    }
    return ydoc;
  }

  function getMutableDocument(chatId) {
    const roomName = documentRoomName(chatId);
    const active = documentRooms.get(roomName);
    if (active) return { roomName, ydoc: active, active: true };
    const ydoc = loadDetachedDocument(chatId);
    if (!ydoc) return null;
    return { roomName, ydoc, active: false };
  }

  function updateDocumentTitle(chatId, title) {
    const target = getMutableDocument(chatId);
    if (!target) return null;
    try {
      const yTitle = target.ydoc.getText('title');
      target.ydoc.transact(() => {
        yTitle.delete(0, yTitle.length);
        yTitle.insert(0, title);
      });
      clearTimeout(saveTimers.get(target.roomName));
      saveTimers.delete(target.roomName);
      persistDocumentNow(target.roomName, target.ydoc);
      return getDocumentChat(chatId);
    } finally {
      if (!target.active) target.ydoc.destroy();
    }
  }

  function clearDocumentContent(chatId) {
    const target = getMutableDocument(chatId);
    if (!target) return null;
    try {
      const yXml = target.ydoc.getXmlFragment('prosemirror');
      target.ydoc.transact(() => {
        if (yXml.length > 0) yXml.delete(0, yXml.length);
      });
      clearTimeout(saveTimers.get(target.roomName));
      saveTimers.delete(target.roomName);
      persistDocumentNow(target.roomName, target.ydoc);
      cleanupDocumentAssets(chatId);
      return getDocumentChat(chatId);
    } finally {
      if (!target.active) target.ydoc.destroy();
    }
  }

  function getDocumentPlainText(chatId) {
    const target = getMutableDocument(chatId);
    if (!target) return '';
    const readDoc = new Y.Doc();
    try {
      Y.applyUpdate(readDoc, Y.encodeStateAsUpdate(target.ydoc));
      const yXml = readDoc.getXmlFragment('prosemirror');
      if (!yXml || yXml.length <= 0) return '';
      const pmDoc = yXmlFragmentToProseMirrorRootNode(yXml, documentSchema);
      return String(pmDoc?.textBetween?.(0, pmDoc.content.size, '\n\n', '\n') || '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } catch (error) {
      console.warn('[documents] plain text extraction failed:', error?.message || error);
      return '';
    } finally {
      readDoc.destroy();
      if (!target.active) target.ydoc.destroy();
    }
  }

  function documentChatShotCaption(member, title, actorName) {
    const isEnglish = String(member?.ui_language || '').toLowerCase() === 'en';
    if (isEnglish) return `ChatShot for document "${title}"\nCreated by: ${actorName}`;
    return `ChatShot \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430 \u00ab${title}\u00bb\n\u0421\u043e\u0437\u0434\u0430\u043b: ${actorName}`;
  }

  async function publishDocumentChatShotToNotes({ chatId, title, actorName, result }) {
    if (!uploadsDir || typeof ensureNotesChatForUser !== 'function' || typeof hydrateMessageById !== 'function') {
      throw new Error('Document ChatShot delivery is not configured');
    }
    const image = result?.image || null;
    const bot = result?.bot || null;
    const buffer = image?.buffer || null;
    if (!buffer?.length) throw new Error('Generated image is empty');
    const botUserId = Number(bot?.user_id || 0);
    if (!botUserId) throw new Error('ChatShot bot user is unavailable');
    const members = documentHumanMembersStmt.all(Number(chatId || 0));
    const delivered = [];
    for (const member of members) {
      const notesChat = ensureNotesChatForUser(Number(member.id || 0));
      if (!notesChat?.id) continue;
      const ext = path.extname(String(image.originalName || '')).toLowerCase() || imageExtensionForMime(image.mimeType);
      const storedName = `document-chatshot-${crypto.randomUUID()}${ext || '.png'}`;
      await fs.promises.writeFile(path.join(uploadsDir, storedName), buffer);
      const fileRow = insertFileStmt.run(
        image.originalName || `document-chatshot${ext || '.png'}`,
        storedName,
        image.mimeType || 'image/png',
        buffer.length,
        'image',
        botUserId
      );
      const caption = documentChatShotCaption(member, title, actorName);
      const messageRow = insertDocumentChatShotMessageStmt.run(
        notesChat.id,
        botUserId,
        caption,
        fileRow.lastInsertRowid,
        1,
        Number(bot?.id || 0) || null
      );
      const message = hydrateMessageById(messageRow.lastInsertRowid, Number(member.id || 0));
      if (!message) continue;
      delivered.push(message);
      try { await Promise.resolve(onMessagePublished?.(message)); } catch (error) {}
      broadcastToChatAll?.(notesChat.id, { type: 'message', message });
      try { await Promise.resolve(notifyMessageCreated?.(message)); } catch (error) {}
    }
    return delivered;
  }

  function cleanupDocumentRoom(chatId) {
    const roomName = documentRoomName(chatId);
    clearTimeout(saveTimers.get(roomName));
    saveTimers.delete(roomName);
    cleanupDocumentAssets(chatId);
    const active = documentRooms.get(roomName);
    if (!active) return;
    Array.from(active.conns?.keys?.() || []).forEach((conn) => {
      try { conn.close(1000, 'Document deleted'); } catch (error) {}
    });
    documentRooms.delete(roomName);
    try { active.destroy?.(); } catch (error) {}
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

  function requireDocumentManager(req, res, next) {
    const chat = req.documentChat;
    if (!chat) return res.status(404).json({ error: 'Document not found' });
    if (!req.user?.is_admin && Number(chat.created_by || 0) !== Number(req.user?.id || 0)) {
      return res.status(403).json({ error: 'Only document creator or admin can manage this document' });
    }
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

  app.put('/api/documents/:chatId/title', auth, requireDocumentMember, (req, res) => {
    try {
      const title = clampTitle(req.body?.title);
      const chat = updateDocumentTitle(req.documentChat.id, title);
      if (!chat) return res.status(404).json({ error: 'Document not found' });
      return res.json({ ok: true, chat: publicDocumentChat(chat, req.user.id), document: { chatId: chat.id, title } });
    } catch (error) {
      console.error('[documents] title update failed:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  app.delete('/api/documents/:chatId/content', auth, requireDocumentMember, requireDocumentManager, (req, res) => {
    try {
      const chat = clearDocumentContent(req.documentChat.id);
      if (!chat) return res.status(404).json({ error: 'Document not found' });
      return res.json({ ok: true, chat: publicDocumentChat(chat, req.user.id) });
    } catch (error) {
      console.error('[documents] content clear failed:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  const documentImageMiddlewares = [
    auth,
    ...(typeof uploadLimiter === 'function' ? [uploadLimiter] : []),
    requireDocumentMember,
  ];

  app.post('/api/documents/:chatId/images', ...documentImageMiddlewares, (req, res) => {
    if (!documentImageUpload?.single) {
      return res.status(500).json({ error: 'Document image upload is not configured' });
    }
    documentImageUpload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `File too large (max ${GENERAL_UPLOAD_LIMIT_LABEL})` });
        }
        return res.status(400).json({ error: err.message || 'Image upload failed' });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file' });
      const originalName = Buffer.from(file.originalname || 'image', 'latin1').toString('utf8');
      const mimeType = normalizeMimeType(file.mimetype) || 'application/octet-stream';
      const fileType = classifyUpload({ mimeType, originalName });
      if (fileType !== 'image') {
        cleanupUploadedDocumentFile(file);
        return res.status(400).json({ error: 'Only images can be inserted' });
      }

      let fileId = null;
      try {
        const insertedFile = insertFileStmt.run(
          originalName,
          file.filename,
          mimeType,
          file.size,
          fileType,
          req.user.id
        );
        fileId = Number(insertedFile.lastInsertRowid || 0);
        const insertedAsset = insertDocumentAssetStmt.run(req.documentChat.id, fileId, req.user.id);
        return res.json({
          asset: {
            id: Number(insertedAsset.lastInsertRowid || 0),
            fileId,
            original_name: originalName,
            stored_name: file.filename,
            mime_type: mimeType,
            size: file.size,
            type: fileType,
            src: documentAssetUrl(file.filename),
          },
        });
      } catch (error) {
        if (fileId) {
          try { db.prepare('DELETE FROM files WHERE id=?').run(fileId); } catch (e) {}
        }
        cleanupUploadedDocumentFile(file);
        console.error('[documents] image upload failed:', error);
        return res.status(500).json({ error: 'Image upload failed' });
      }
    });
  });

  app.post('/api/documents/:chatId/chatshot', auth, requireDocumentMember, async (req, res) => {
    try {
      if (!aiBotFeature?.generateChatShotImageForContext) {
        return res.status(503).json({ error: 'ChatShot is unavailable' });
      }
      const chatId = Number(req.documentChat.id || 0);
      const contextText = getDocumentPlainText(chatId);
      if (!contextText) return res.status(400).json({ error: 'Document has no text for ChatShot' });
      const title = clampTitle(req.documentChat.title || req.documentChat.name || DEFAULT_DOCUMENT_TITLE);
      const actorName = req.user.display_name || req.user.username || `User ${req.user.id}`;
      broadcastToChatAll?.(chatId, {
        type: 'document_system_notice',
        chatId,
        kind: 'chatshot_generation_started',
        message: 'ChatShot is being created. It will be saved to notes.',
        messageKey: 'ChatShot is being created. It will be saved to notes.',
        actorName,
        title,
      });
      const result = await aiBotFeature.generateChatShotImageForContext({
        chatId,
        actorUserId: req.user.id,
        contextText,
      });
      const delivered = await publishDocumentChatShotToNotes({
        chatId,
        title,
        actorName,
        result,
      });
      broadcastToChatAll?.(chatId, {
        type: 'document_system_notice',
        chatId,
        kind: 'chatshot_saved_to_notes',
        message: 'ChatShot saved to notes',
        messageKey: 'ChatShot saved to notes',
        delivered: delivered.length,
        actorName,
        title,
      });
      return res.json({
        ok: true,
        chatId,
        delivered: delivered.length,
      });
    } catch (error) {
      console.error('[documents] chatshot failed:', error);
      return res.status(error.status || 400).json({ error: error?.message || 'ChatShot generation failed' });
    }
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
    try {
      const token = ensureDocumentInviteToken(req.documentChat.id);
      res.json(documentInvitePayload(req, token));
    } catch (error) {
      console.error('[documents] invite link failed:', error);
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
    cleanupDocumentRoom,
    getDocumentChat,
    getDocumentPlainText,
    getDocumentSession,
    isDocumentChat: (chat) => boolDocument(chat?.is_document),
  };
}

module.exports = {
  createDocumentsFeature,
};

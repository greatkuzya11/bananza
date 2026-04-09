const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const db = require('./db');
const { setupWebSocket, broadcastToChatAll, sendToUser, clients } = require('./websocket');
const { extractUrls, fetchPreview } = require('./linkPreview');
const { createVoiceFeature } = require('./voice');

// ── JWT Secret ──────────────────────────────────────────────────────────────
const SECRET_PATH = path.join(__dirname, '.secret');
let JWT_SECRET;
if (fs.existsSync(SECRET_PATH)) {
  JWT_SECRET = fs.readFileSync(SECRET_PATH, 'utf8').trim();
} else {
  JWT_SECRET = crypto.randomBytes(64).toString('hex');
  fs.writeFileSync(SECRET_PATH, JWT_SECRET, { mode: 0o600 });
}

// ── Express setup ───────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
setupWebSocket(server, JWT_SECRET);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use(express.static(path.join(__dirname, 'public')));

// ── Uploads ─────────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

const ALLOWED_MIME = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image',
  'application/pdf': 'document', 'text/plain': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/zip': 'document',
  'application/x-rar-compressed': 'document', 'application/vnd.rar': 'document',
  'application/x-msdownload': 'document', 'application/octet-stream': 'document',
  'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/ogg': 'audio',
  'audio/mp4': 'audio', 'audio/x-m4a': 'audio', 'audio/aac': 'audio',
  'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video',
};
const ALLOWED_EXT = new Set([
  '.jpg','.jpeg','.png','.webp','.gif',
  '.pdf','.txt','.doc','.docx','.xls','.xlsx','.zip','.rar','.exe',
  '.mp3','.wav','.ogg','.m4a',
  '.mp4','.webm','.mov',
]);
const MAX_FILE = 25 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname).toLowerCase()),
});
const upload = multer({
  storage, limits: { fileSize: MAX_FILE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME[file.mimetype] && ALLOWED_EXT.has(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

const AVATAR_MIME = { 'image/jpeg': true, 'image/png': true, 'image/webp': true };
const avatarStorage = multer.diskStorage({
  destination: AVATARS_DIR,
  filename: (_req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname).toLowerCase()),
});
const avatarUpload = multer({
  storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('Only JPG, PNG, WebP allowed'));
  },
});

// ── Rate limiters ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 60_000, max: 10, message: { error: 'Too many attempts' } });
const msgLimiter  = rateLimit({ windowMs: 60_000, max: 60, message: { error: 'Too many messages' } });
const upLimiter   = rateLimit({ windowMs: 60_000, max: 20, message: { error: 'Too many uploads' } });

// ── Auth middleware ─────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#e17076','#7bc862','#e5ca77','#65aadd','#a695e7','#ee7aae','#6ec9cb','#faa774'];

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET);
    const u = db.prepare('SELECT id,username,display_name,is_admin,is_blocked,avatar_color,avatar_url FROM users WHERE id=?').get(payload.id);
    if (!u || u.is_blocked) return res.status(403).json({ error: 'Blocked' });
    req.user = u;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function adminOnly(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  next();
}

const voiceFeature = createVoiceFeature({
  app,
  db,
  auth,
  adminOnly,
  msgLimiter,
  upLimiter,
  uploadsDir: UPLOADS_DIR,
  broadcastToChatAll,
  clients,
  secret: JWT_SECRET,
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string')
      return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3 || username.length > 20)
      return res.status(400).json({ error: 'Username: 3-20 characters' });
    if (!/^[a-zA-Z0-9_]+$/.test(username))
      return res.status(400).json({ error: 'Username: letters, numbers, underscores only' });
    if (password.length < 6 || password.length > 100)
      return res.status(400).json({ error: 'Password: 6-100 characters' });

    if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username.toLowerCase()))
      return res.status(409).json({ error: 'Username taken' });

    const hash = await bcrypt.hash(password, 10);
    const isAdmin = db.prepare('SELECT COUNT(*) as c FROM users').get().c === 0 ? 1 : 0;
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const name = (displayName && typeof displayName === 'string')
      ? displayName.trim().substring(0, 30) || username : username;

    const r = db.prepare('INSERT INTO users(username,password,display_name,is_admin,avatar_color) VALUES(?,?,?,?,?)')
      .run(username.toLowerCase(), hash, name, isAdmin, color);
    const userId = r.lastInsertRowid;

    const gen = db.prepare("SELECT id FROM chats WHERE type='general'").get();
    if (gen) db.prepare('INSERT OR IGNORE INTO chat_members(chat_id,user_id) VALUES(?,?)').run(gen.id, userId);

    const token = jwt.sign({ id: userId, username: username.toLowerCase() }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: userId, username: username.toLowerCase(), display_name: name, is_admin: isAdmin, avatar_color: color, avatar_url: null } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string')
      return res.status(400).json({ error: 'Username and password required' });

    const u = db.prepare('SELECT * FROM users WHERE username=?').get(username.toLowerCase());
    if (!u) return res.status(401).json({ error: 'Invalid credentials' });
    if (u.is_blocked) return res.status(403).json({ error: 'Account blocked' });

    if (!(await bcrypt.compare(password, u.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: u.id, username: u.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: u.id, username: u.username, display_name: u.display_name, is_admin: u.is_admin, avatar_color: u.avatar_color, avatar_url: u.avatar_url } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// ═══════════════════════════════════════════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/users', auth, (req, res) => {
  const users = db.prepare('SELECT id,username,display_name,avatar_color,avatar_url,is_blocked FROM users WHERE id!=?').all(req.user.id);
  const online = [...clients.keys()];
  res.json(users.map(u => ({ ...u, online: online.includes(u.id) })));
});

// ═══════════════════════════════════════════════════════════════════════════
// CHAT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/chats', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT m.text FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_text,
      (SELECT m.created_at FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_time,
      (SELECT u.display_name FROM messages m JOIN users u ON u.id=m.user_id WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_user,
      (SELECT m.file_id FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_file_id
    FROM chats c JOIN chat_members cm ON cm.chat_id=c.id
    WHERE cm.user_id=?
    ORDER BY last_time DESC NULLS LAST, c.created_at DESC
  `).all(req.user.id);

  for (const chat of rows) {
    if (chat.type === 'private') {
      const other = db.prepare(`
        SELECT u.id,u.display_name,u.avatar_color,u.avatar_url FROM users u
        JOIN chat_members cm ON cm.user_id=u.id WHERE cm.chat_id=? AND u.id!=?
      `).get(chat.id, req.user.id);
      if (other) { chat.name = other.display_name; chat.private_user = other; }
    }
    if (chat.type === 'group') {
      chat.avatar_url = chat.avatar_url || null;
    }
    // Unread count
    const membership = db.prepare('SELECT last_read_id FROM chat_members WHERE chat_id=? AND user_id=?').get(chat.id, req.user.id);
    const lastRead = membership ? membership.last_read_id : 0;
    const unread = db.prepare('SELECT COUNT(*) as c FROM messages WHERE chat_id=? AND id>? AND is_deleted=0 AND user_id!=?').get(chat.id, lastRead, req.user.id);
    chat.unread_count = unread ? unread.c : 0;
  }
  res.json(rows);
});

app.post('/api/chats', auth, (req, res) => {
  const { name, type, memberIds } = req.body;
  if (!name || typeof name !== 'string' || name.length > 50) return res.status(400).json({ error: 'Invalid name' });
  if (type !== 'group') return res.status(400).json({ error: 'Invalid type' });

  const r = db.prepare('INSERT INTO chats(name,type,created_by) VALUES(?,?,?)').run(name.trim(), 'group', req.user.id);
  const chatId = r.lastInsertRowid;
  db.prepare('INSERT INTO chat_members(chat_id,user_id) VALUES(?,?)').run(chatId, req.user.id);

  if (Array.isArray(memberIds)) {
    const stmt = db.prepare('INSERT OR IGNORE INTO chat_members(chat_id,user_id) VALUES(?,?)');
    for (const mid of memberIds) {
      if (typeof mid === 'number' && mid !== req.user.id) stmt.run(chatId, mid);
    }
  }

  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  const members = db.prepare('SELECT user_id FROM chat_members WHERE chat_id=?').all(chatId);
  members.forEach(({ user_id }) => sendToUser(user_id, { type: 'chat_created', chat }));
  res.json(chat);
});

app.post('/api/chats/private', auth, (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId || typeof targetUserId !== 'number') return res.status(400).json({ error: 'Target user required' });

  const target = db.prepare('SELECT id,display_name FROM users WHERE id=?').get(targetUserId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare(`
    SELECT c.id FROM chats c
    JOIN chat_members cm1 ON cm1.chat_id=c.id AND cm1.user_id=?
    JOIN chat_members cm2 ON cm2.chat_id=c.id AND cm2.user_id=?
    WHERE c.type='private'
  `).get(req.user.id, targetUserId);

  if (existing) {
    const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(existing.id);
    return res.json(chat);
  }

  const r = db.prepare("INSERT INTO chats(name,type,created_by) VALUES('Private','private',?)").run(req.user.id);
  const chatId = r.lastInsertRowid;
  db.prepare('INSERT INTO chat_members(chat_id,user_id) VALUES(?,?)').run(chatId, req.user.id);
  db.prepare('INSERT INTO chat_members(chat_id,user_id) VALUES(?,?)').run(chatId, targetUserId);

  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  sendToUser(targetUserId, { type: 'chat_created', chat: { ...chat, name: req.user.display_name } });
  res.json(chat);
});

app.get('/api/chats/:chatId/members', auth, (req, res) => {
  const chatId = +req.params.chatId;
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  res.json(db.prepare('SELECT u.id,u.username,u.display_name,u.avatar_color,u.avatar_url FROM users u JOIN chat_members cm ON cm.user_id=u.id WHERE cm.chat_id=?').all(chatId));
});

app.post('/api/chats/:chatId/members', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const { userId } = req.body;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (chat.type === 'private') return res.status(400).json({ error: 'Cannot add to private chat' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  db.prepare('INSERT OR IGNORE INTO chat_members(chat_id,user_id) VALUES(?,?)').run(chatId, userId);
  sendToUser(userId, { type: 'chat_created', chat });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/chats/:chatId/messages', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const before = req.query.before ? +req.query.before : null;
  const limit = Math.min(+req.query.limit || 50, 100);

  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const q = `
    SELECT m.*, u.username, u.display_name, u.avatar_color, u.avatar_url,
      f.original_name as file_name, f.stored_name as file_stored,
      f.mime_type as file_mime, f.size as file_size, f.type as file_type,
      rm.text as reply_text, ru.display_name as reply_display_name, rm.id as reply_msg_id
    FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN files f ON f.id=m.file_id
    LEFT JOIN messages rm ON rm.id=m.reply_to_id
    LEFT JOIN users ru ON ru.id=rm.user_id
    WHERE m.chat_id=? ${before ? 'AND m.id<?' : ''}
    ORDER BY m.id DESC LIMIT ?`;

  const msgs = before
    ? db.prepare(q).all(chatId, before, limit)
    : db.prepare(q).all(chatId, limit);

  const prevStmt = db.prepare('SELECT * FROM link_previews WHERE message_id=?');
  const reactStmt = db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id=?');

  // Get min last_read_id of OTHER members to determine read status for own messages
  const readInfo = db.prepare(
    'SELECT MIN(last_read_id) as min_read FROM chat_members WHERE chat_id=? AND user_id!=?'
  ).get(chatId, req.user.id);
  const minRead = readInfo ? readInfo.min_read || 0 : 0;

  const result = voiceFeature.attachVoiceMetadata(
    msgs.map(m => ({ ...m, previews: prevStmt.all(m.id), reactions: reactStmt.all(m.id), is_read: m.id <= minRead }))
  );
  res.json(result.reverse());
});

app.post('/api/chats/:chatId/messages', auth, msgLimiter, (req, res) => {
  const chatId = +req.params.chatId;
  const { text, fileId, replyToId } = req.body;

  if (!text && !fileId) return res.status(400).json({ error: 'Empty message' });
  if (text && (typeof text !== 'string' || text.length > 5000))
    return res.status(400).json({ error: 'Message too long' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  if (fileId && !db.prepare('SELECT 1 FROM files WHERE id=?').get(fileId))
    return res.status(400).json({ error: 'File not found' });

  // Validate reply
  let validReplyId = null;
  if (replyToId) {
    const replyMsg = db.prepare('SELECT id FROM messages WHERE id=? AND chat_id=?').get(replyToId, chatId);
    if (replyMsg) validReplyId = replyMsg.id;
  }

  const cleanText = text ? text.trim() : null;
  const r = db.prepare('INSERT INTO messages(chat_id,user_id,text,file_id,reply_to_id) VALUES(?,?,?,?,?)')
    .run(chatId, req.user.id, cleanText, fileId || null, validReplyId);

  const msg = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar_color, u.avatar_url,
      f.original_name as file_name, f.stored_name as file_stored,
      f.mime_type as file_mime, f.size as file_size, f.type as file_type,
      rm.text as reply_text, ru.display_name as reply_display_name, rm.id as reply_msg_id
    FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN files f ON f.id=m.file_id
    LEFT JOIN messages rm ON rm.id=m.reply_to_id
    LEFT JOIN users ru ON ru.id=rm.user_id
    WHERE m.id=?
  `).get(r.lastInsertRowid);
  msg.previews = [];
  msg.reactions = [];
  const hydratedMsg = voiceFeature.attachVoiceMetadata([msg])[0];

  broadcastToChatAll(chatId, { type: 'message', message: hydratedMsg });

  // Async link previews
  if (cleanText) {
    const urls = extractUrls(cleanText);
    if (urls.length > 0) {
      fetchPreview(urls[0]).then(preview => {
        if (!preview) return;
        db.prepare('INSERT INTO link_previews(message_id,url,title,description,image,hostname) VALUES(?,?,?,?,?,?)')
          .run(msg.id, preview.url, preview.title, preview.description, preview.image, preview.hostname);
        broadcastToChatAll(chatId, { type: 'link_preview', messageId: msg.id, preview });
      }).catch(() => {});
    }
  }

  res.json(hydratedMsg);
});

// ═══════════════════════════════════════════════════════════════════════════
// USER PROFILE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.put('/api/profile', auth, (req, res) => {
  const { displayName, avatarColor } = req.body;
  const updates = [];
  const params = [];

  if (displayName && typeof displayName === 'string') {
    const name = displayName.trim().substring(0, 30);
    if (name.length < 1) return res.status(400).json({ error: 'Name too short' });
    updates.push('display_name=?');
    params.push(name);
  }
  if (avatarColor && typeof avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(avatarColor)) {
    updates.push('avatar_color=?');
    params.push(avatarColor);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.user.id);

  db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...params);
  const user = db.prepare('SELECT id,username,display_name,is_admin,is_blocked,avatar_color,avatar_url FROM users WHERE id=?').get(req.user.id);
  res.json({ user });
});

app.post('/api/profile/avatar', auth, upLimiter, (req, res) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file' });

    // Remove old avatar file
    const old = db.prepare('SELECT avatar_url FROM users WHERE id=?').get(req.user.id);
    if (old && old.avatar_url) {
      const oldFile = path.join(AVATARS_DIR, path.basename(old.avatar_url));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    const avatarUrl = '/uploads/avatars/' + req.file.filename;
    db.prepare('UPDATE users SET avatar_url=? WHERE id=?').run(avatarUrl, req.user.id);
    const user = db.prepare('SELECT id,username,display_name,is_admin,is_blocked,avatar_color,avatar_url FROM users WHERE id=?').get(req.user.id);
    res.json({ user });
  });
});

app.delete('/api/profile/avatar', auth, (req, res) => {
  const old = db.prepare('SELECT avatar_url FROM users WHERE id=?').get(req.user.id);
  if (old && old.avatar_url) {
    const oldFile = path.join(AVATARS_DIR, path.basename(old.avatar_url));
    if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
  }
  db.prepare('UPDATE users SET avatar_url=NULL WHERE id=?').run(req.user.id);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP EDIT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.put('/api/chats/:chatId', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (chat.type === 'private') return res.status(400).json({ error: 'Cannot edit private chat' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.length > 50)
    return res.status(400).json({ error: 'Invalid name (1-50 chars)' });

  db.prepare('UPDATE chats SET name=? WHERE id=?').run(name.trim(), chatId);
  const updated = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  broadcastToChatAll(chatId, { type: 'chat_updated', chat: updated });
  res.json(updated);
});

app.post('/api/chats/:chatId/avatar', auth, upLimiter, (req, res) => {
  const chatId = +req.params.chatId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (chat.type === 'private') return res.status(400).json({ error: 'Cannot edit private chat' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file' });

    // Remove old
    if (chat.avatar_url) {
      const oldFile = path.join(AVATARS_DIR, path.basename(chat.avatar_url));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    const avatarUrl = '/uploads/avatars/' + req.file.filename;
    db.prepare('UPDATE chats SET avatar_url=? WHERE id=?').run(avatarUrl, chatId);
    const updated = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
    broadcastToChatAll(chatId, { type: 'chat_updated', chat: updated });
    res.json(updated);
  });
});

app.delete('/api/chats/:chatId/avatar', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  if (chat.avatar_url) {
    const oldFile = path.join(AVATARS_DIR, path.basename(chat.avatar_url));
    if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
  }
  db.prepare('UPDATE chats SET avatar_url=NULL WHERE id=?').run(chatId);
  const updated = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  broadcastToChatAll(chatId, { type: 'chat_updated', chat: updated });
  res.json(updated);
});

app.delete('/api/chats/:chatId/members/:userId', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const userId = +req.params.userId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (chat.type !== 'group') return res.status(400).json({ error: 'Cannot remove from this chat' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  // Only creator or admin can remove others; anyone can leave
  if (userId !== req.user.id && chat.created_by !== req.user.id && !req.user.is_admin)
    return res.status(403).json({ error: 'Only creator or admin can remove members' });

  db.prepare('DELETE FROM chat_members WHERE chat_id=? AND user_id=?').run(chatId, userId);
  sendToUser(userId, { type: 'chat_removed', chatId });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// FILE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/upload', auth, upLimiter, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 25 MB)' });
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file' });

    // Fix multer latin1 encoding for non-ASCII filenames
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const fileType = ALLOWED_MIME[req.file.mimetype] || 'document';
    const r = db.prepare('INSERT INTO files(original_name,stored_name,mime_type,size,type,uploaded_by) VALUES(?,?,?,?,?,?)')
      .run(originalName, req.file.filename, req.file.mimetype, req.file.size, fileType, req.user.id);

    res.json({
      id: r.lastInsertRowid, original_name: originalName,
      stored_name: req.file.filename, mime_type: req.file.mimetype,
      size: req.file.size, type: fileType,
    });
  });
});

app.get('/uploads/avatars/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(AVATARS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  const ext = path.extname(filename).toLowerCase();
  const mimes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  res.setHeader('Content-Type', mimes[ext] || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

app.get('/uploads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

  const file = db.prepare('SELECT * FROM files WHERE stored_name=?').get(filename);
  if (!file) return res.status(404).json({ error: 'Not found' });

  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
  res.sendFile(filePath);
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT id,username,display_name,is_admin,is_blocked,avatar_color,avatar_url,created_at FROM users').all());
});

app.post('/api/admin/users/:id/block', auth, adminOnly, (req, res) => {
  const uid = +req.params.id;
  if (uid === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });
  const u = db.prepare('SELECT is_blocked FROM users WHERE id=?').get(uid);
  if (!u) return res.status(404).json({ error: 'Not found' });

  const next = u.is_blocked ? 0 : 1;
  db.prepare('UPDATE users SET is_blocked=? WHERE id=?').run(next, uid);
  if (next) { const c = clients.get(uid); if (c) c.forEach(ws => ws.close(4003, 'Blocked')); }
  res.json({ is_blocked: next });
});

app.post('/api/admin/users/:id/reset-password', auth, adminOnly, async (req, res) => {
  const uid = +req.params.id;
  if (uid === req.user.id) return res.status(400).json({ error: 'Cannot reset your own password' });
  const u = db.prepare('SELECT id FROM users WHERE id=?').get(uid);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const hash = await bcrypt.hash('123456', 10);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, uid);
  res.json({ ok: true });
});

app.post('/api/profile/change-password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword || typeof oldPassword !== 'string' || typeof newPassword !== 'string')
    return res.status(400).json({ error: 'Both old and new passwords required' });
  if (newPassword.length < 6 || newPassword.length > 100)
    return res.status(400).json({ error: 'New password: 6-100 characters' });
  const u = db.prepare('SELECT password FROM users WHERE id=?').get(req.user.id);
  if (!(await bcrypt.compare(oldPassword, u.password)))
    return res.status(400).json({ error: 'Current password is incorrect' });
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/messages/:id', auth, (req, res) => {
  const mid = +req.params.id;
  const m = db.prepare('SELECT * FROM messages WHERE id=?').get(mid);
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (!req.user.is_admin && m.user_id !== req.user.id)
    return res.status(403).json({ error: 'Not allowed' });

  // Delete attached file from disk and DB
  if (m.file_id) {
    const file = db.prepare('SELECT stored_name FROM files WHERE id=?').get(m.file_id);
    if (file) {
      const filePath = path.join(UPLOADS_DIR, file.stored_name);
      fs.unlink(filePath, () => {});
    }
  }

  // Soft-delete message (keep record for reply_to_id foreign keys)
  db.prepare('UPDATE messages SET is_deleted=1, text=NULL, file_id=NULL WHERE id=?').run(mid);
  // Clean up related file and previews
  if (m.file_id) db.prepare('DELETE FROM files WHERE id=?').run(m.file_id);
  voiceFeature.deleteVoiceMetadata(mid);
  db.prepare('DELETE FROM link_previews WHERE message_id=?').run(mid);
  broadcastToChatAll(m.chat_id, { type: 'message_deleted', messageId: mid, chatId: m.chat_id });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH & READ
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/messages/search', auth, (req, res) => {
  const { q, chatId } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length < 2)
    return res.status(400).json({ error: 'Query too short (min 2 chars)' });

  const query = `%${q.trim()}%`;
  let msgs;

  if (chatId) {
    const cid = +chatId;
    if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(cid, req.user.id))
      return res.status(403).json({ error: 'Not a member' });
    msgs = db.prepare(`
      SELECT m.id, m.chat_id, m.text, m.created_at, u.display_name,
        c.name as chat_name, c.type as chat_type
      FROM messages m JOIN users u ON u.id=m.user_id JOIN chats c ON c.id=m.chat_id
      WHERE m.chat_id=? AND m.text LIKE ? AND m.is_deleted=0
      ORDER BY m.id DESC LIMIT 50
    `).all(cid, query);
  } else {
    // Search across all user's chats
    msgs = db.prepare(`
      SELECT m.id, m.chat_id, m.text, m.created_at, u.display_name,
        c.name as chat_name, c.type as chat_type
      FROM messages m JOIN users u ON u.id=m.user_id JOIN chats c ON c.id=m.chat_id
      JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=?
      WHERE m.text LIKE ? AND m.is_deleted=0
      ORDER BY m.id DESC LIMIT 50
    `).all(req.user.id, query);
  }

  res.json(msgs);
});

app.post('/api/chats/:chatId/read', auth, (req, res) => {
  const chatId = +req.params.chatId;
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const last = db.prepare('SELECT MAX(id) as mid FROM messages WHERE chat_id=? AND is_deleted=0').get(chatId);
  if (last && last.mid) {
    const changed = db.prepare('UPDATE chat_members SET last_read_id=? WHERE chat_id=? AND user_id=? AND last_read_id<?')
      .run(last.mid, chatId, req.user.id, last.mid);
    if (changed.changes > 0) {
      broadcastToChatAll(chatId, { type: 'messages_read', chatId, userId: req.user.id, lastReadId: last.mid });
    }
  }
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// REACTIONS
// ═══════════════════════════════════════════════════════════════════════════
const ALLOWED_REACTIONS = ['👍','👎','❤️','🔥','😂','😮','😢','💩','🎉','🤡'];

app.post('/api/messages/:id/reactions', auth, (req, res) => {
  const mid = +req.params.id;
  const { emoji } = req.body;
  if (!emoji || typeof emoji !== 'string' || emoji.length > 10 || !ALLOWED_REACTIONS.includes(emoji))
    return res.status(400).json({ error: 'Invalid emoji' });

  const msg = db.prepare('SELECT chat_id FROM messages WHERE id=? AND is_deleted=0').get(mid);
  if (!msg) return res.status(404).json({ error: 'Not found' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(msg.chat_id, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const existing = db.prepare('SELECT emoji FROM reactions WHERE message_id=? AND user_id=? AND emoji=?').get(mid, req.user.id, emoji);
  if (existing) {
    db.prepare('DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji=?').run(mid, req.user.id, emoji);
  } else {
    db.prepare('INSERT INTO reactions(message_id, user_id, emoji) VALUES(?,?,?)').run(mid, req.user.id, emoji);
  }

  const reactions = db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id=?').all(mid);
  broadcastToChatAll(msg.chat_id, { type: 'reaction', messageId: mid, reactions });
  res.json({ ok: true, reactions });
});

// ── SPA fallback ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/'))
    return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🍌 BananZa running on http://localhost:${PORT}`));

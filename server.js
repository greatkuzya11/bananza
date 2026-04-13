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
const { createWeatherFeature } = require('./weather');
const { createForwardingFeature } = require('./forwarding');
const { createPushFeature } = require('./push');
const { createSoundSettingsFeature } = require('./soundSettings');
const { createAiBotFeature } = require('./ai');

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
app.set('trust proxy', 1);
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

const BACKGROUNDS_DIR = path.join(UPLOADS_DIR, 'backgrounds');
if (!fs.existsSync(BACKGROUNDS_DIR)) fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });

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

// Background storage (separate from general uploads)
const backgroundStorage = multer.diskStorage({
  destination: BACKGROUNDS_DIR,
  filename: (_req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname).toLowerCase()),
});
const backgroundUpload = multer({
  storage: backgroundStorage, limits: { fileSize: 12 * 1024 * 1024 },
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
const UI_THEMES = new Set(['bananza', 'banan-hero', 'midnight-ocean', 'nord-aurora', 'rose-pine', 'dracula-neon', 'tokyo-night']);
const USER_PUBLIC_FIELDS = 'id,username,display_name,is_admin,is_blocked,avatar_color,avatar_url,ui_theme';

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    is_admin: u.is_admin,
    is_blocked: u.is_blocked,
    avatar_color: u.avatar_color,
    avatar_url: u.avatar_url,
    ui_theme: UI_THEMES.has(u.ui_theme) ? u.ui_theme : 'bananza',
  };
}

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET);
    const u = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id=?`).get(payload.id);
    if (!u || u.is_blocked) return res.status(403).json({ error: 'Blocked' });
    req.user = publicUser(u);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function adminOnly(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
  next();
}

const pushFeature = createPushFeature({
  app,
  db,
  auth,
  rateLimit,
});

let aiBotFeature = null;

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
  notifyMessageCreated: (message) => pushFeature.notifyMessageCreated(message),
  onMessageTextAvailable: (message) => aiBotFeature?.handleMessageCreated(message),
});

createWeatherFeature({
  app,
  db,
  auth,
  rateLimit,
});

createSoundSettingsFeature({
  app,
  db,
  auth,
});

createForwardingFeature({
  app,
  db,
  auth,
  msgLimiter,
  uploadsDir: UPLOADS_DIR,
  broadcastToChatAll,
  voiceFeature,
  hydrateMessageById: (messageId) => hydrateMessageById(messageId),
  extractUrls,
  fetchPreview,
  notifyMessageCreated: (message) => pushFeature.notifyMessageCreated(message),
  onMessageCreated: (message) => aiBotFeature?.handleMessageCreated(message),
  saveMessageMentions: (messageId, chatId, text) => saveMessageMentions(messageId, chatId, text),
});

aiBotFeature = createAiBotFeature({
  app,
  db,
  auth,
  adminOnly,
  secret: JWT_SECRET,
  broadcastToChatAll,
  hydrateMessageById: (messageId) => hydrateMessageById(messageId),
  extractUrls,
  fetchPreview,
  notifyMessageCreated: (message) => pushFeature.notifyMessageCreated(message),
});

const messageByIdStmt = db.prepare(`
  SELECT m.*, u.username, u.display_name, u.avatar_color, u.avatar_url,
    COALESCE(u.is_ai_bot, 0) as is_ai_bot, ab.mention as ai_bot_mention,
    f.original_name as file_name, f.stored_name as file_stored,
    f.mime_type as file_mime, f.size as file_size, f.type as file_type,
    COALESCE(NULLIF(rm.text, ''), NULLIF(rvm.transcription_text, ''), CASE WHEN rvm.message_id IS NOT NULL THEN 'Голосовое сообщение' END) as reply_text,
    CASE WHEN rvm.message_id IS NOT NULL THEN 1 ELSE 0 END as reply_is_voice_note,
    ru.display_name as reply_display_name, rm.id as reply_msg_id
  FROM messages m
  JOIN users u ON u.id=m.user_id
  LEFT JOIN ai_bots ab ON ab.user_id=u.id
  LEFT JOIN files f ON f.id=m.file_id
  LEFT JOIN messages rm ON rm.id=m.reply_to_id
  LEFT JOIN voice_messages rvm ON rvm.message_id=rm.id
  LEFT JOIN users ru ON ru.id=rm.user_id
  WHERE m.id=?
`);
const messagePreviewsStmt = db.prepare('SELECT * FROM link_previews WHERE message_id=?');
const messageReactionsStmt = db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id=?');
const messageMentionsStmt = db.prepare(`
  SELECT
    mm.mentioned_user_id as user_id,
    mm.token,
    u.username,
    u.display_name,
    u.avatar_color,
    u.avatar_url,
    COALESCE(u.is_ai_bot, 0) as is_ai_bot,
    ab.mention as bot_mention
  FROM message_mentions mm
  JOIN users u ON u.id=mm.mentioned_user_id
  LEFT JOIN ai_bots ab ON ab.user_id=u.id
  WHERE mm.message_id=?
  ORDER BY mm.created_at ASC, mm.mentioned_user_id ASC
`);
const mentionTargetsStmt = db.prepare(`
  SELECT
    u.id as user_id,
    u.username,
    u.display_name,
    u.avatar_color,
    u.avatar_url,
    COALESCE(u.is_ai_bot, 0) as is_ai_bot,
    ab.mention as bot_mention
  FROM chat_members cm
  JOIN users u ON u.id=cm.user_id
  LEFT JOIN ai_bots ab ON ab.user_id=u.id
  WHERE cm.chat_id=?
  ORDER BY COALESCE(u.is_ai_bot, 0) ASC, u.display_name COLLATE NOCASE ASC
`);
const deleteMentionsStmt = db.prepare('DELETE FROM message_mentions WHERE message_id=?');
const insertMentionStmt = db.prepare(`
  INSERT OR IGNORE INTO message_mentions(message_id, chat_id, mentioned_user_id, token)
  VALUES(?,?,?,?)
`);

function mentionPayload(row) {
  const isAiBot = Number(row.is_ai_bot) !== 0;
  const token = (isAiBot ? row.bot_mention : row.username) || row.token || '';
  return {
    user_id: row.user_id,
    display_name: row.display_name,
    username: row.username,
    mention: token,
    token: row.token || token,
    is_ai_bot: isAiBot,
    avatar_color: row.avatar_color,
    avatar_url: row.avatar_url,
  };
}

function getMentionTargets(chatId) {
  const seen = new Set();
  return mentionTargetsStmt.all(chatId)
    .map((row) => mentionPayload(row))
    .filter((row) => {
      const token = String(row.mention || row.token || '').trim();
      if (!token) return false;
      const key = token.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      row.token = token;
      row.mention = token;
      return true;
    });
}

function extractMentionTokens(text) {
  const source = String(text || '');
  const tokens = [];
  const re = /@([a-zA-Z0-9_][a-zA-Z0-9_-]{0,31})/g;
  let match;
  while ((match = re.exec(source))) {
    const prev = match.index > 0 ? source[match.index - 1] : '';
    if (prev && /[A-Za-z0-9_.-]/.test(prev)) continue;
    tokens.push(match[1].toLowerCase());
  }
  return [...new Set(tokens)];
}

function resolveMessageMentions(chatId, text) {
  const wanted = new Set(extractMentionTokens(text));
  if (wanted.size === 0) return [];
  const targets = getMentionTargets(chatId);
  const byToken = new Map();
  for (const target of targets) {
    const token = String(target.token || target.mention || '').toLowerCase();
    if (token && !byToken.has(token)) byToken.set(token, target);
  }
  return [...wanted].map(token => byToken.get(token)).filter(Boolean);
}

function saveMessageMentions(messageId, chatId, text) {
  deleteMentionsStmt.run(messageId);
  const mentions = resolveMessageMentions(chatId, text);
  const insert = db.transaction((rows) => {
    rows.forEach((mention) => {
      insertMentionStmt.run(messageId, chatId, mention.user_id, mention.token || mention.mention);
    });
  });
  insert(mentions);
  return mentions;
}

function attachMessageMentions(row) {
  row.mentions = messageMentionsStmt.all(row.id).map(mentionPayload);
  return row;
}

function hydrateMessageById(messageId) {
  const row = messageByIdStmt.get(messageId);
  if (!row) return null;
  row.previews = messagePreviewsStmt.all(row.id);
  row.reactions = messageReactionsStmt.all(row.id);
  attachMessageMentions(row);
  const readInfo = db.prepare(
    `SELECT MIN(cm.last_read_id) as min_read
     FROM chat_members cm
     JOIN users u ON u.id=cm.user_id
     WHERE cm.chat_id=? AND cm.user_id!=? AND COALESCE(u.is_ai_bot,0)=0`
  ).get(row.chat_id, row.user_id);
  const minRead = readInfo && readInfo.min_read != null ? readInfo.min_read : row.id;
  row.is_read = row.id <= minRead;
  return voiceFeature.attachVoiceMetadata([row])[0];
}

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
    res.json({ token, user: publicUser({ id: userId, username: username.toLowerCase(), display_name: name, is_admin: isAdmin, is_blocked: 0, avatar_color: color, avatar_url: null, ui_theme: 'bananza' }) });
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
    try { db.prepare("UPDATE users SET last_activity = datetime('now') WHERE id = ?").run(u.id); } catch (e) {}
    res.json({ token, user: publicUser(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// ═══════════════════════════════════════════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/users', auth, (req, res) => {
  const users = db.prepare('SELECT id,username,display_name,avatar_color,avatar_url,is_blocked FROM users WHERE id!=? AND COALESCE(is_ai_bot,0)=0').all(req.user.id);
  const online = [...clients.keys()];
  res.json(users.map(u => ({ ...u, online: online.includes(u.id) })));
});

// ═══════════════════════════════════════════════════════════════════════════
// CHAT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

function boolPreferenceValue(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return !!value;
  if (value === '0' || value === '1') return value === '1';
  return fallback;
}

function chatPreferencesPayload(row) {
  return {
    notify_enabled: row ? row.notify_enabled !== 0 : true,
    sounds_enabled: row ? row.sounds_enabled !== 0 : true,
  };
}

app.get('/api/chats', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      cm.notify_enabled,
      cm.sounds_enabled,
      (SELECT COALESCE(NULLIF(m.text, ''), NULLIF(vm.transcription_text, ''))
        FROM messages m
        LEFT JOIN voice_messages vm ON vm.message_id=m.id
        WHERE m.chat_id=c.id AND m.is_deleted=0
        ORDER BY m.id DESC LIMIT 1) as last_text,
      (SELECT m.created_at FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_time,
      (SELECT u.display_name FROM messages m JOIN users u ON u.id=m.user_id WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_user,
      (SELECT m.file_id FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_file_id,
      (SELECT MAX(m.id) FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0) as last_message_id,
      (SELECT MIN(m.id) FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 AND m.id>COALESCE(cm.last_read_id,0) AND m.user_id!=cm.user_id) as first_unread_id,
      cm.last_read_id
    FROM chats c JOIN chat_members cm ON cm.chat_id=c.id
    WHERE cm.user_id=?
    ORDER BY last_time DESC NULLS LAST, c.created_at DESC
  `).all(req.user.id);

  for (const chat of rows) {
    Object.assign(chat, chatPreferencesPayload(chat));
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
    const lastRead = chat.last_read_id || 0;
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
  members.forEach(({ user_id }) => {
    sendToUser(user_id, {
      type: 'chat_created',
      chat,
      actorId: req.user.id,
      actorName: req.user.display_name,
      is_invite: user_id !== req.user.id,
    });
    if (user_id !== req.user.id) {
      pushFeature.notifyChatInvite(user_id, {
        chat,
        actorName: req.user.display_name,
        body: `${req.user.display_name} добавил(а) вас в чат ${chat.name}`,
      });
    }
  });
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
  sendToUser(targetUserId, {
    type: 'chat_created',
    chat: { ...chat, name: req.user.display_name },
    actorId: req.user.id,
    actorName: req.user.display_name,
    is_invite: true,
  });
  pushFeature.notifyChatInvite(targetUserId, {
    chat: { ...chat, name: req.user.display_name },
    actorName: req.user.display_name,
    title: req.user.display_name,
    body: 'Новый личный чат',
  });
  res.json(chat);
});

app.get('/api/chats/:chatId/members', auth, (req, res) => {
  const chatId = +req.params.chatId;
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  res.json(db.prepare('SELECT u.id,u.username,u.display_name,u.avatar_color,u.avatar_url FROM users u JOIN chat_members cm ON cm.user_id=u.id WHERE cm.chat_id=?').all(chatId));
});

app.get('/api/chats/:chatId/mention-targets', auth, (req, res) => {
  const chatId = +req.params.chatId;
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  res.json({ targets: getMentionTargets(chatId) });
});

app.get('/api/chats/:chatId/preferences', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const row = db.prepare('SELECT notify_enabled,sounds_enabled FROM chat_members WHERE chat_id=? AND user_id=?')
    .get(chatId, req.user.id);
  if (!row) return res.status(403).json({ error: 'Not a member' });
  res.json({ preferences: chatPreferencesPayload(row) });
});

app.put('/api/chats/:chatId/preferences', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const row = db.prepare('SELECT notify_enabled,sounds_enabled FROM chat_members WHERE chat_id=? AND user_id=?')
    .get(chatId, req.user.id);
  if (!row) return res.status(403).json({ error: 'Not a member' });
  const next = {
    notify_enabled: boolPreferenceValue(req.body?.notify_enabled, row.notify_enabled !== 0),
    sounds_enabled: boolPreferenceValue(req.body?.sounds_enabled, row.sounds_enabled !== 0),
  };
  db.prepare('UPDATE chat_members SET notify_enabled=?, sounds_enabled=? WHERE chat_id=? AND user_id=?')
    .run(next.notify_enabled ? 1 : 0, next.sounds_enabled ? 1 : 0, chatId, req.user.id);
  res.json({ preferences: next });
});

app.post('/api/chats/:chatId/members', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const { userId } = req.body;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (chat.type === 'private') return res.status(400).json({ error: 'Cannot add to private chat' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  const user = db.prepare('SELECT id,is_ai_bot FROM users WHERE id=?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_ai_bot) return res.status(400).json({ error: 'AI bots are managed from the AI bot settings' });
  const added = db.prepare('INSERT OR IGNORE INTO chat_members(chat_id,user_id) VALUES(?,?)').run(chatId, userId);
  sendToUser(userId, {
    type: 'chat_created',
    chat,
    actorId: req.user.id,
    actorName: req.user.display_name,
    is_invite: added.changes > 0 && userId !== req.user.id,
  });
  if (added.changes > 0 && userId !== req.user.id) {
    pushFeature.notifyChatInvite(userId, {
      chat,
      actorName: req.user.display_name,
      body: `${req.user.display_name} добавил(а) вас в чат ${chat.name}`,
    });
  }
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/chats/:chatId/messages', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const before = req.query.before ? +req.query.before : null;
  const anchor = req.query.anchor ? +req.query.anchor : null;
  const limit = Math.min(+req.query.limit || 50, 100);
  const includeMeta = req.query.meta === '1';

  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const selectSql = `
    SELECT m.*, u.username, u.display_name, u.avatar_color, u.avatar_url,
      COALESCE(u.is_ai_bot, 0) as is_ai_bot, ab.mention as ai_bot_mention,
      f.original_name as file_name, f.stored_name as file_stored,
      f.mime_type as file_mime, f.size as file_size, f.type as file_type,
      COALESCE(NULLIF(rm.text, ''), NULLIF(rvm.transcription_text, ''), CASE WHEN rvm.message_id IS NOT NULL THEN 'Голосовое сообщение' END) as reply_text,
      CASE WHEN rvm.message_id IS NOT NULL THEN 1 ELSE 0 END as reply_is_voice_note,
      ru.display_name as reply_display_name, rm.id as reply_msg_id
    FROM messages m JOIN users u ON u.id=m.user_id
    LEFT JOIN ai_bots ab ON ab.user_id=u.id
    LEFT JOIN files f ON f.id=m.file_id
    LEFT JOIN messages rm ON rm.id=m.reply_to_id
    LEFT JOIN voice_messages rvm ON rvm.message_id=rm.id
    LEFT JOIN users ru ON ru.id=rm.user_id
  `;

  let msgs;
  if (anchor) {
    let anchorMsg = db.prepare(`${selectSql} WHERE m.chat_id=? AND m.id=? AND m.is_deleted=0`).get(chatId, anchor);
    if (!anchorMsg) {
      anchorMsg = db.prepare(`${selectSql} WHERE m.chat_id=? AND m.id<? AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1`)
        .get(chatId, anchor);
    }
    if (!anchorMsg) {
      anchorMsg = db.prepare(`${selectSql} WHERE m.chat_id=? AND m.id>? AND m.is_deleted=0 ORDER BY m.id ASC LIMIT 1`)
        .get(chatId, anchor);
    }
    if (anchorMsg) {
      const anchorId = anchorMsg.id;
      const olderLimit = Math.floor((limit - 1) / 2);
      const newerLimit = Math.max(0, limit - olderLimit - 1);
      const older = db.prepare(`${selectSql} WHERE m.chat_id=? AND m.id<? AND m.is_deleted=0 ORDER BY m.id DESC LIMIT ?`)
        .all(chatId, anchorId, olderLimit)
        .reverse();
      const newer = db.prepare(`${selectSql} WHERE m.chat_id=? AND m.id>? AND m.is_deleted=0 ORDER BY m.id ASC LIMIT ?`)
        .all(chatId, anchorId, newerLimit);
      msgs = [...older, anchorMsg, ...newer];
    }
  }

  if (!msgs) {
    const q = `${selectSql} WHERE m.chat_id=? ${before ? 'AND m.id<?' : ''} AND m.is_deleted=0 ORDER BY m.id DESC LIMIT ?`;
    msgs = before
      ? db.prepare(q).all(chatId, before, limit)
      : db.prepare(q).all(chatId, limit);
    msgs = msgs.reverse();
  }


  const prevStmt = db.prepare('SELECT * FROM link_previews WHERE message_id=?');
  const reactStmt = db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id=?');

  // Get min last_read_id of OTHER members to determine read status for own messages
  const readInfo = db.prepare(
    `SELECT MIN(cm.last_read_id) as min_read
     FROM chat_members cm
     JOIN users u ON u.id=cm.user_id
     WHERE cm.chat_id=? AND cm.user_id!=? AND COALESCE(u.is_ai_bot,0)=0`
  ).get(chatId, req.user.id);
  const minRead = readInfo && readInfo.min_read != null ? readInfo.min_read : Number.MAX_SAFE_INTEGER;

  const result = voiceFeature.attachVoiceMetadata(
    msgs.map(m => attachMessageMentions({ ...m, previews: prevStmt.all(m.id), reactions: reactStmt.all(m.id), is_read: m.id <= minRead }))
  );

  if (includeMeta) {
    const firstId = result.reduce((min, msg) => {
      const id = Number(msg.id) || 0;
      return id > 0 ? Math.min(min, id) : min;
    }, Number.MAX_SAFE_INTEGER);
    const hasMoreBefore = firstId !== Number.MAX_SAFE_INTEGER
      ? !!db.prepare('SELECT 1 FROM messages WHERE chat_id=? AND id<? AND is_deleted=0 LIMIT 1').get(chatId, firstId)
      : false;
    return res.json({ messages: result, has_more_before: hasMoreBefore });
  }

  res.json(result);
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
  try { db.prepare("UPDATE users SET last_activity = datetime('now') WHERE id = ?").run(req.user.id); } catch (e) {}
  if (cleanText) saveMessageMentions(r.lastInsertRowid, chatId, cleanText);

  const msg = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar_color, u.avatar_url,
      COALESCE(u.is_ai_bot, 0) as is_ai_bot, ab.mention as ai_bot_mention,
      f.original_name as file_name, f.stored_name as file_stored,
      f.mime_type as file_mime, f.size as file_size, f.type as file_type,
      COALESCE(NULLIF(rm.text, ''), NULLIF(rvm.transcription_text, ''), CASE WHEN rvm.message_id IS NOT NULL THEN 'Голосовое сообщение' END) as reply_text,
      CASE WHEN rvm.message_id IS NOT NULL THEN 1 ELSE 0 END as reply_is_voice_note,
      ru.display_name as reply_display_name, rm.id as reply_msg_id
    FROM messages m JOIN users u ON u.id=m.user_id
    LEFT JOIN ai_bots ab ON ab.user_id=u.id
    LEFT JOIN files f ON f.id=m.file_id
    LEFT JOIN messages rm ON rm.id=m.reply_to_id
    LEFT JOIN voice_messages rvm ON rvm.message_id=rm.id
    LEFT JOIN users ru ON ru.id=rm.user_id
    WHERE m.id=?
  `).get(r.lastInsertRowid);
  msg.previews = [];
  msg.reactions = [];
  attachMessageMentions(msg);
  const hydratedMsg = voiceFeature.attachVoiceMetadata([msg])[0];

  broadcastToChatAll(chatId, { type: 'message', message: hydratedMsg });
  pushFeature.notifyMessageCreated(hydratedMsg);
  aiBotFeature.handleMessageCreated(hydratedMsg).catch((error) => {
    console.warn('[ai-bot] message hook failed:', error.message);
  });

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

app.patch('/api/messages/:id', auth, msgLimiter, (req, res) => {
  const mid = +req.params.id;
  const { text } = req.body || {};
  if (typeof text !== 'string') return res.status(400).json({ error: 'Text is required' });
  if (text.length > 5000) return res.status(400).json({ error: 'Message too long' });

  const m = db.prepare(`
    SELECT m.*, vm.message_id as voice_message_id
    FROM messages m
    LEFT JOIN voice_messages vm ON vm.message_id=m.id
    WHERE m.id=? AND m.is_deleted=0
  `).get(mid);
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (!req.user.is_admin && m.user_id !== req.user.id)
    return res.status(403).json({ error: 'Not allowed' });
  if (!req.user.is_admin && !db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(m.chat_id, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const cleanText = text.trim();
  if (m.voice_message_id) {
    if (!cleanText) return res.status(400).json({ error: 'Voice text cannot be empty' });
    db.prepare(`
      UPDATE voice_messages
      SET transcription_status='completed',
          transcription_text=?,
          transcription_provider='manual',
          transcription_model=NULL,
          transcription_error=NULL,
          transcribed_at=datetime('now'),
          requested_by=?
      WHERE message_id=?
    `).run(cleanText, req.user.id, mid);
    db.prepare('UPDATE messages SET edited_at=datetime(\'now\'), edited_by=? WHERE id=?').run(req.user.id, mid);
  } else {
    if (!cleanText && !m.file_id) return res.status(400).json({ error: 'Message text cannot be empty' });
    db.prepare('UPDATE messages SET text=?, edited_at=datetime(\'now\'), edited_by=? WHERE id=?')
      .run(cleanText || null, req.user.id, mid);
    db.prepare('DELETE FROM link_previews WHERE message_id=?').run(mid);
    saveMessageMentions(mid, m.chat_id, cleanText);
  }

  const updated = hydrateMessageById(mid);
  broadcastToChatAll(m.chat_id, { type: 'message_updated', message: updated });
  aiBotFeature.handleMessageUpdated(updated).catch((error) => {
    console.warn('[ai-bot] update hook failed:', error.message);
  });

  if (!m.voice_message_id && cleanText) {
    const urls = extractUrls(cleanText);
    if (urls.length > 0) {
      fetchPreview(urls[0]).then(preview => {
        if (!preview) return;
        db.prepare('INSERT INTO link_previews(message_id,url,title,description,image,hostname) VALUES(?,?,?,?,?,?)')
          .run(mid, preview.url, preview.title, preview.description, preview.image, preview.hostname);
        broadcastToChatAll(m.chat_id, { type: 'link_preview', messageId: mid, preview });
      }).catch(() => {});
    }
  }

  res.json(updated);
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
  const user = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id=?`).get(req.user.id);
  res.json({ user: publicUser(user) });
});

app.patch('/api/user/theme', auth, (req, res) => {
  const theme = typeof req.body?.theme === 'string' ? req.body.theme : '';
  if (!UI_THEMES.has(theme)) return res.status(400).json({ error: 'Unknown theme' });
  db.prepare('UPDATE users SET ui_theme=? WHERE id=?').run(theme, req.user.id);
  const user = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id=?`).get(req.user.id);
  res.json({ user: publicUser(user) });
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
    const user = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id=?`).get(req.user.id);
    res.json({ user: publicUser(user) });
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
  db.prepare(`
    UPDATE ai_chat_bots
    SET enabled=0, updated_at=datetime('now')
    WHERE chat_id=? AND bot_id IN (SELECT id FROM ai_bots WHERE user_id=?)
  `).run(chatId, userId);
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

app.get('/uploads/backgrounds/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(BACKGROUNDS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  const ext = path.extname(filename).toLowerCase();
  const mimes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  res.setHeader('Content-Type', mimes[ext] || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

// Background upload (allowed for any chat member, including private chats)
app.post('/api/chats/:chatId/background', auth, upLimiter, (req, res) => {
  const chatId = +req.params.chatId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  backgroundUpload.single('background')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file' });

    // Remove old background file
    if (chat.background_url) {
      const oldFile = path.join(BACKGROUNDS_DIR, path.basename(chat.background_url));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    const style = (req.body && typeof req.body.style === 'string') ? req.body.style : 'cover';
    const bgUrl = '/uploads/backgrounds/' + req.file.filename;
    db.prepare('UPDATE chats SET background_url=?, background_style=? WHERE id=?').run(bgUrl, style, chatId);
    const updated = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
    broadcastToChatAll(chatId, { type: 'chat_updated', chat: updated });
    res.json(updated);
  });
});

app.delete('/api/chats/:chatId/background', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  if (chat.background_url) {
    const oldFile = path.join(BACKGROUNDS_DIR, path.basename(chat.background_url));
    if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
  }
  db.prepare('UPDATE chats SET background_url=NULL WHERE id=?').run(chatId);
  const updated = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  broadcastToChatAll(chatId, { type: 'chat_updated', chat: updated });
  res.json(updated);
});

app.put('/api/chats/:chatId/background-style', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const { style } = req.body || {};
  const allowed = new Set(['cover','contain','100%','tile','center']);
  if (!style || typeof style !== 'string' || !allowed.has(style)) return res.status(400).json({ error: 'Invalid style' });
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  db.prepare('UPDATE chats SET background_style=? WHERE id=?').run(style, chatId);
  const updated = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  broadcastToChatAll(chatId, { type: 'chat_updated', chat: updated });
  res.json(updated);
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
  res.json(db.prepare('SELECT id,username,display_name,is_admin,is_blocked,avatar_color,avatar_url,created_at,last_activity FROM users').all());
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
  deleteMentionsStmt.run(mid);
  // Clean up related file and previews
  if (m.file_id) db.prepare('DELETE FROM files WHERE id=?').run(m.file_id);
  voiceFeature.deleteVoiceMetadata(mid);
  db.prepare('DELETE FROM link_previews WHERE message_id=?').run(mid);
  broadcastToChatAll(m.chat_id, { type: 'message_deleted', messageId: mid, chatId: m.chat_id });
  aiBotFeature.handleMessageDeleted(mid);
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
    let nextReadId = last.mid;
    const requestedReadId = Number(req.body?.lastReadId || 0);
    if (Number.isFinite(requestedReadId) && requestedReadId > 0) {
      const bounded = db.prepare('SELECT MAX(id) as mid FROM messages WHERE chat_id=? AND is_deleted=0 AND id<=?')
        .get(chatId, Math.min(requestedReadId, last.mid));
      nextReadId = bounded?.mid || 0;
    }
    if (!nextReadId) return res.json({ ok: true });
    const changed = db.prepare('UPDATE chat_members SET last_read_id=? WHERE chat_id=? AND user_id=? AND last_read_id<?')
      .run(nextReadId, chatId, req.user.id, nextReadId);
    if (changed.changes > 0) {
      broadcastToChatAll(chatId, { type: 'messages_read', chatId, userId: req.user.id, lastReadId: nextReadId });
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

  const msg = db.prepare('SELECT chat_id,user_id FROM messages WHERE id=? AND is_deleted=0').get(mid);
  if (!msg) return res.status(404).json({ error: 'Not found' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(msg.chat_id, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const existing = db.prepare('SELECT emoji FROM reactions WHERE message_id=? AND user_id=? AND emoji=?').get(mid, req.user.id, emoji);
  let reactionAdded = false;
  if (existing) {
    db.prepare('DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji=?').run(mid, req.user.id, emoji);
  } else {
    db.prepare('INSERT INTO reactions(message_id, user_id, emoji) VALUES(?,?,?)').run(mid, req.user.id, emoji);
    reactionAdded = true;
  }

  const reactions = db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id=?').all(mid);
  broadcastToChatAll(msg.chat_id, {
    type: 'reaction',
    messageId: mid,
    reactions,
    actorId: req.user.id,
    actorName: req.user.display_name,
    emoji,
    action: reactionAdded ? 'added' : 'removed',
    chatId: msg.chat_id,
    targetUserId: msg.user_id,
  });
  if (reactionAdded) {
    pushFeature.notifyReaction({ messageId: mid, emoji, actor: req.user });
  }
  res.json({ ok: true, reactions });
});

// ── SPA fallback ────────────────────────────────────────────────────────────
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/'))
    return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🍌 BananZa running on http://localhost:${PORT}`));

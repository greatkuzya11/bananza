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
const { createMessageCopyService } = require('./messageCopy');
const { createPushFeature } = require('./push');
const { createSoundSettingsFeature } = require('./soundSettings');
const { createAiBotFeature } = require('./ai');
const { createPollService, POLL_CLOSE_PRESETS, toDbDate } = require('./polls');
const { createMessageActionsService } = require('./messageActions');
const { createVideoNoteFeature } = require('./videoNotes');
const { createVideoNoteStorage } = require('./videoNotes/storage');

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
const UI_VISUAL_MODES = new Set(['classic', 'rich']);
const POLL_STYLES = new Set(['pulse', 'stack', 'orbit']);
const UI_MODAL_ANIMATIONS = new Set(['soft', 'lift', 'zoom', 'slide', 'fade', 'none']);
const UI_MODAL_ANIMATION_SPEED_DEFAULT = 8;
const UI_MODAL_ANIMATION_SPEED_MIN = 1;
const UI_MODAL_ANIMATION_SPEED_MAX = 10;
const USER_PUBLIC_FIELDS = 'id,username,display_name,is_admin,is_blocked,avatar_color,avatar_url,ui_theme,ui_visual_mode,ui_modal_animation,ui_modal_animation_speed';
const USER_REALTIME_FIELDS = `${USER_PUBLIC_FIELDS},is_ai_bot`;
const POLL_MAX_OPTIONS = 10;
const POLL_MIN_OPTIONS = 2;

function normalizeModalAnimationSpeed(speed) {
  const next = Math.round(Number(speed));
  if (!Number.isFinite(next)) return UI_MODAL_ANIMATION_SPEED_DEFAULT;
  return Math.min(UI_MODAL_ANIMATION_SPEED_MAX, Math.max(UI_MODAL_ANIMATION_SPEED_MIN, next));
}

function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return !!fallback;
}

function normalizePollOptionText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizePollPayload(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const style = typeof input.style === 'string' && input.style.trim()
    ? input.style.trim()
    : 'pulse';
  if (!POLL_STYLES.has(style)) {
    const error = new Error('Unknown poll style');
    error.status = 400;
    throw error;
  }
  const rawOptions = Array.isArray(input.options) ? input.options : [];
  const options = rawOptions.map(normalizePollOptionText).filter(Boolean);
  if (options.length < POLL_MIN_OPTIONS || options.length > POLL_MAX_OPTIONS) {
    const error = new Error(`Poll must have ${POLL_MIN_OPTIONS}-${POLL_MAX_OPTIONS} options`);
    error.status = 400;
    throw error;
  }
  const normalizedKeys = options.map((option) => option.toLowerCase());
  if (new Set(normalizedKeys).size !== normalizedKeys.length) {
    const error = new Error('Poll options must be unique');
    error.status = 400;
    throw error;
  }
  const closePreset = typeof input.close_preset === 'string' && input.close_preset.trim()
    ? input.close_preset.trim()
    : null;
  if (closePreset && !Object.prototype.hasOwnProperty.call(POLL_CLOSE_PRESETS, closePreset)) {
    const error = new Error('Unknown poll close preset');
    error.status = 400;
    throw error;
  }
  const closesAt = closePreset ? toDbDate(Date.now() + POLL_CLOSE_PRESETS[closePreset]) : null;
  return {
    style,
    options,
    allows_multiple: boolValue(input.allows_multiple, false),
    show_voters: boolValue(input.show_voters, false),
    close_preset: closePreset,
    closes_at: closesAt,
  };
}

function normalizeAiResponseModeHint(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'auto' || mode === 'text' || mode === 'image' || mode === 'document') return mode;
  return null;
}

function normalizeAiDocumentFormatHint(value) {
  const format = String(value || '').trim().toLowerCase();
  if (format === 'md' || format === 'txt') return format;
  return null;
}

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
    ui_visual_mode: UI_VISUAL_MODES.has(u.ui_visual_mode) ? u.ui_visual_mode : 'classic',
    ui_modal_animation: UI_MODAL_ANIMATIONS.has(u.ui_modal_animation) ? u.ui_modal_animation : 'soft',
    ui_modal_animation_speed: normalizeModalAnimationSpeed(u.ui_modal_animation_speed),
  };
}

function realtimeUser(u) {
  return {
    ...publicUser(u),
    is_ai_bot: Number(u?.is_ai_bot) || 0,
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

const sharedUserIdsStmt = db.prepare(`
  SELECT DISTINCT cm2.user_id
  FROM chat_members cm1
  JOIN chat_members cm2 ON cm2.chat_id=cm1.chat_id
  WHERE cm1.user_id=?
`);

function notifyUserUpdated(userId) {
  const id = Number(userId);
  if (!id) return;
  const user = db.prepare(`SELECT ${USER_REALTIME_FIELDS} FROM users WHERE id=?`).get(id);
  if (!user) return;
  const payload = { type: 'user_updated', user: realtimeUser(user) };
  const targets = new Set(sharedUserIdsStmt.all(id).map((row) => Number(row.user_id) || 0).filter(Boolean));
  targets.add(id);
  for (const targetId of targets) sendToUser(targetId, payload);
}

const pushFeature = createPushFeature({
  app,
  db,
  auth,
  rateLimit,
});

const pollFeature = createPollService({
  db,
  sendToUser,
});
const messageActions = createMessageActionsService({
  db,
  pollFeature,
  hydrateMessageById: (messageId, viewerUserId) => hydrateMessageById(messageId, viewerUserId),
  saveMessageMentions: (messageId, chatId, text) => saveMessageMentions(messageId, chatId, text),
  broadcastToChatAll,
  notifyMessageCreated: (message) => pushFeature.notifyMessageCreated(message),
  notifyReaction: (payload) => pushFeature.notifyReaction(payload),
  notifyPinCreated: (payload) => pushFeature.notifyPinCreated(payload),
  onMessagePublished: (message) => handleChatListMessageCreated(message),
  recordPinEvent,
  broadcastPinsUpdated,
  getChatPinPayload,
  isChatMember,
  isNotesChatRow,
  normalizePollPayload,
  isValidReactionEmoji,
});

let aiBotFeature = null;
const videoNoteStorage = createVideoNoteStorage({
  db,
  uploadsDir: UPLOADS_DIR,
});

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
  onMessageCreated: (message) => handleChatListMessageCreated(message),
  onMessageTextAvailable: (message) => aiBotFeature?.handleMessageCreated(message),
});

const messageCopyService = createMessageCopyService({
  db,
  uploadsDir: UPLOADS_DIR,
  voiceFeature,
  videoNoteStorage,
  extractUrls,
  fetchPreview,
  broadcastToChatAll,
  saveMessageMentions: (messageId, chatId, text) => saveMessageMentions(messageId, chatId, text),
});

const videoNoteFeature = createVideoNoteFeature({
  app,
  db,
  auth,
  msgLimiter,
  upLimiter,
  uploadsDir: UPLOADS_DIR,
  hydrateMessageById: (messageId, viewerUserId) => hydrateMessageById(messageId, viewerUserId),
  broadcastToChatAll,
  notifyMessageCreated: (message) => pushFeature.notifyMessageCreated(message),
  onMessageCreated: (message) => handleUserMessageCreated(message),
  voiceFeature,
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
  onMessageCreated: (message, options) => handleUserMessageCreated(message, options),
  saveMessageMentions: (messageId, chatId, text) => saveMessageMentions(messageId, chatId, text),
  messageCopyService,
});

aiBotFeature = createAiBotFeature({
  app,
  db,
  auth,
  adminOnly,
  secret: JWT_SECRET,
  avatarUpload,
  upLimiter,
  avatarsDir: AVATARS_DIR,
  uploadsDir: UPLOADS_DIR,
  notifyUserUpdated,
  broadcastToChatAll,
  hydrateMessageById: (messageId) => hydrateMessageById(messageId),
  extractUrls,
  fetchPreview,
  notifyMessageCreated: (message) => pushFeature.notifyMessageCreated(message),
  onMessagePublished: (message) => handleChatListMessageCreated(message),
  messageActions,
});

const messageByIdStmt = db.prepare(`
  SELECT m.*, u.username, u.display_name, u.avatar_color, u.avatar_url,
    COALESCE(u.is_ai_bot, 0) as is_ai_bot, ab.mention as ai_bot_mention,
    ab.provider as ai_bot_provider, ab.kind as ai_bot_kind,
    f.original_name as file_name, f.stored_name as file_stored,
    f.mime_type as file_mime, f.size as file_size, f.type as file_type,
    COALESCE(NULLIF(rm.text, ''), NULLIF(rvm.transcription_text, ''), CASE WHEN rvm.message_id IS NOT NULL THEN 'Голосовое сообщение' END) as reply_text,
    CASE WHEN rvm.message_id IS NOT NULL THEN 1 ELSE 0 END as reply_is_voice_note,
    COALESCE(rvm.note_kind, 'voice') as reply_note_kind,
    CASE
      WHEN NULLIF(rm.text, '') IS NULL AND NULLIF(rvm.transcription_text, '') IS NULL AND rvm.message_id IS NOT NULL
      THEN 1
      ELSE 0
    END as reply_text_is_fallback,
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
    ab.id as bot_id,
    ab.mention as bot_mention,
    ab.provider as bot_provider,
    ab.kind as bot_kind,
    ab.allow_text as bot_allow_text,
    ab.allow_image_generate as bot_allow_image_generate,
    ab.allow_image_edit as bot_allow_image_edit,
    ab.allow_document as bot_allow_document,
    ab.allow_poll_create as bot_allow_poll_create,
    ab.allow_poll_vote as bot_allow_poll_vote,
    ab.allow_react as bot_allow_react,
    ab.allow_pin as bot_allow_pin,
    ab.document_default_format as bot_document_default_format
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
const chatMemberPreferencesStmt = db.prepare(`
  SELECT
    chat_id,
    user_id,
    notify_enabled,
    sounds_enabled,
    COALESCE(chat_list_pin_order, NULL) as chat_list_pin_order,
    hidden_at,
    hidden_after_message_id
  FROM chat_members
  WHERE chat_id=? AND user_id=?
`);
const chatPinSettingsStmt = db.prepare('SELECT id, created_by, allow_unpin_any_pin FROM chats WHERE id=?');
const chatContextTransformSettingsStmt = db.prepare('SELECT id, created_by, context_transform_enabled FROM chats WHERE id=?');
const editableMessageForUpdateStmt = db.prepare(`
  SELECT
    m.*,
    vm.message_id as voice_message_id,
    vm.note_kind as voice_note_kind,
    vm.transcription_text,
    p.message_id as poll_message_id,
    COALESCE(u.is_ai_bot, 0) as is_ai_author
  FROM messages m
  JOIN users u ON u.id=m.user_id
  LEFT JOIN voice_messages vm ON vm.message_id=m.id
  LEFT JOIN polls p ON p.message_id=m.id
  WHERE m.id=? AND m.is_deleted=0
`);
const messagePinExistsStmt = db.prepare('SELECT 1 FROM message_pins WHERE message_id=?');
const deleteLinkPreviewsByMessageStmt = db.prepare('DELETE FROM link_previews WHERE message_id=?');
const insertLinkPreviewStmt = db.prepare('INSERT INTO link_previews(message_id,url,title,description,image,hostname) VALUES(?,?,?,?,?,?)');
const chatPinsStmt = db.prepare(`
  SELECT
    p.id,
    p.chat_id,
    p.message_id,
    p.pinned_by,
    p.created_at,
    pu.display_name as pinned_by_name,
    m.user_id as message_user_id,
    m.text,
    u.display_name as message_author_name,
    f.original_name as file_name,
    f.type as file_type,
    vm.message_id as voice_message_id,
    vm.transcription_text,
    vm.note_kind as voice_note_kind
  FROM message_pins p
  JOIN messages m ON m.id=p.message_id
  JOIN users u ON u.id=m.user_id
  JOIN users pu ON pu.id=p.pinned_by
  LEFT JOIN files f ON f.id=m.file_id
  LEFT JOIN voice_messages vm ON vm.message_id=m.id
  WHERE p.chat_id=? AND m.is_deleted=0
  ORDER BY p.id DESC
`);
const pinEventMessageStmt = db.prepare(`
  SELECT
    m.id,
    m.chat_id,
    m.user_id as message_author_id,
    m.text,
    u.display_name as message_author_name,
    f.original_name as file_name,
    f.type as file_type,
    vm.message_id as voice_message_id,
    vm.transcription_text,
    vm.note_kind as voice_note_kind
  FROM messages m
  JOIN users u ON u.id=m.user_id
  LEFT JOIN files f ON f.id=m.file_id
  LEFT JOIN voice_messages vm ON vm.message_id=m.id
  WHERE m.id=?
`);
const insertPinEventStmt = db.prepare(`
  INSERT INTO message_pin_events(
    chat_id,
    message_id,
    action,
    actor_id,
    actor_name,
    message_author_id,
    message_author_name,
    message_preview,
    created_at
  ) VALUES(?,?,?,?,?,?,?,?,COALESCE(?, datetime('now')))
`);
const pinEventByIdStmt = db.prepare(`
  SELECT
    id,
    chat_id,
    message_id,
    action,
    actor_id,
    actor_name,
    message_author_id,
    message_author_name,
    message_preview,
    created_at
  FROM message_pin_events
  WHERE id=?
`);
const pinEventsFromStmt = db.prepare(`
  SELECT
    id,
    chat_id,
    message_id,
    action,
    actor_id,
    actor_name,
    message_author_id,
    message_author_name,
    message_preview,
    created_at
  FROM message_pin_events
  WHERE chat_id=? AND action='pinned' AND created_at>=?
  ORDER BY created_at ASC, id ASC
  LIMIT 200
`);
const pinEventsBetweenStmt = db.prepare(`
  SELECT
    id,
    chat_id,
    message_id,
    action,
    actor_id,
    actor_name,
    message_author_id,
    message_author_name,
    message_preview,
    created_at
  FROM message_pin_events
  WHERE chat_id=? AND action='pinned' AND created_at>=? AND created_at<=?
  ORDER BY created_at ASC, id ASC
  LIMIT 200
`);

function applyReplyTextFallback(row) {
  if (!row || Number(row.reply_text_is_fallback || 0) !== 1) return row;
  const noteKind = String(row.reply_note_kind || 'voice');
  row.reply_text = noteKind === 'video_note' ? 'Видео-заметка' : 'Голосовое сообщение';
  return row;
}

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
    bot_id: Number(row.bot_id) || 0,
    bot_provider: row.bot_provider || '',
    bot_kind: row.bot_kind || '',
    allow_text: isAiBot ? Number(row.bot_allow_text) !== 0 : false,
    allow_image_generate: isAiBot ? Number(row.bot_allow_image_generate) !== 0 : false,
    allow_image_edit: isAiBot ? Number(row.bot_allow_image_edit) !== 0 : false,
    allow_document: isAiBot ? Number(row.bot_allow_document) !== 0 : false,
    allow_poll_create: isAiBot ? Number(row.bot_allow_poll_create) !== 0 : false,
    allow_poll_vote: isAiBot ? Number(row.bot_allow_poll_vote) !== 0 : false,
    allow_react: isAiBot ? Number(row.bot_allow_react) !== 0 : false,
    allow_pin: isAiBot ? Number(row.bot_allow_pin) !== 0 : false,
    document_default_format: row.bot_document_default_format || '',
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

function hydrateMessageById(messageId, viewerUserId = null) {
  const row = applyReplyTextFallback(messageByIdStmt.get(messageId));
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
  const withVoice = voiceFeature.attachVoiceMetadata([row])[0];
  return pollFeature.attachPollMetadata([withVoice], viewerUserId, { ensureClosed: false, broadcastOnClose: false })[0];
}

function isChatMember(chatId, userId) {
  return !!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, userId);
}

function canManageContextTransform(chat, user) {
  if (!chat || !user) return false;
  if (user.is_admin) return true;
  if (!isChatMember(chat.id, user.id)) return false;
  return Number(chat.created_by || 0) === Number(user.id);
}

function scheduleEditedMessagePreview(messageRow, text) {
  const clean = String(text || '').trim();
  if (!clean) return;
  const urls = extractUrls(clean);
  if (!urls.length) return;
  fetchPreview(urls[0]).then((preview) => {
    if (!preview) return;
    insertLinkPreviewStmt.run(
      messageRow.id,
      preview.url,
      preview.title,
      preview.description,
      preview.image,
      preview.hostname
    );
    broadcastToChatAll(messageRow.chat_id, {
      type: 'link_preview',
      chatId: messageRow.chat_id,
      messageId: messageRow.id,
      preview,
    });
  }).catch(() => {});
}

function applyEditableMessageText(messageRow, { actorUserId, viewerUserId = null, text } = {}) {
  const messageId = Number(messageRow?.id || 0);
  if (!messageId) {
    const error = new Error('Message not found');
    error.status = 404;
    throw error;
  }
  const clean = typeof text === 'string' ? text.trim() : '';
  if (messageRow.voice_message_id) {
    if (!clean) {
      const error = new Error('Voice text cannot be empty');
      error.status = 400;
      throw error;
    }
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
    `).run(clean, actorUserId, messageId);
    db.prepare('UPDATE messages SET edited_at=datetime(\'now\'), edited_by=? WHERE id=?').run(actorUserId, messageId);
  } else {
    if (!clean && !messageRow.file_id) {
      const error = new Error('Message text cannot be empty');
      error.status = 400;
      throw error;
    }
    db.prepare('UPDATE messages SET text=?, edited_at=datetime(\'now\'), edited_by=? WHERE id=?')
      .run(clean || null, actorUserId, messageId);
  }

  deleteLinkPreviewsByMessageStmt.run(messageId);
  saveMessageMentions(messageId, messageRow.chat_id, clean);

  const updated = hydrateMessageById(messageId, viewerUserId);
  if (!updated) {
    const error = new Error('Message could not be loaded');
    error.status = 500;
    throw error;
  }

  broadcastToChatAll(messageRow.chat_id, { type: 'message_updated', message: updated });
  if (messagePinExistsStmt.get(messageId)) {
    broadcastPinsUpdated(messageRow.chat_id, { action: 'updated', actorId: actorUserId, messageId });
  }
  aiBotFeature.handleMessageUpdated(updated).catch((error) => {
    console.warn('[ai-bot] update hook failed:', error.message);
  });
  scheduleEditedMessagePreview(messageRow, clean);
  return updated;
}

function pinPreviewText(row) {
  const text = String(row?.text || row?.transcription_text || '').trim();
  if (text) return text.substring(0, 160);
  if (row?.voice_message_id) return row?.voice_note_kind === 'video_note' ? 'Видео-заметка' : 'Голосовое сообщение';
  if (row?.file_name) return String(row.file_name).substring(0, 160);
  return 'Attachment';
}

function pinEventPayload(row) {
  if (!row) return null;
  return {
    id: Number(row.id) || 0,
    chat_id: Number(row.chat_id) || 0,
    message_id: Number(row.message_id) || 0,
    action: row.action || 'pinned',
    actor_id: row.actor_id == null ? null : Number(row.actor_id),
    actor_name: row.actor_name || '',
    message_author_id: row.message_author_id == null ? null : Number(row.message_author_id),
    message_author_name: row.message_author_name || '',
    message_preview: row.message_preview || '',
    created_at: row.created_at,
  };
}

function recordPinEvent({ chatId, messageId, action, actor, createdAt = null } = {}) {
  const normalizedAction = action === 'unpinned' ? 'unpinned' : 'pinned';
  const message = pinEventMessageStmt.get(messageId) || {};
  const resolvedChatId = Number(chatId || message.chat_id || 0);
  if (!resolvedChatId || !messageId) return null;
  const info = insertPinEventStmt.run(
    resolvedChatId,
    messageId,
    normalizedAction,
    actor?.id || null,
    actor?.display_name || actor?.username || null,
    message.message_author_id || null,
    message.message_author_name || null,
    pinPreviewText(message).substring(0, 500),
    createdAt || null
  );
  return pinEventPayload(pinEventByIdStmt.get(info.lastInsertRowid));
}

function getPinEventsForWindow(chatId, messages = [], { openEnded = false } = {}) {
  const times = (Array.isArray(messages) ? messages : [])
    .map((msg) => msg?.created_at)
    .filter(Boolean)
    .sort();
  if (!times.length) return [];
  const from = times[0];
  const to = times[times.length - 1];
  const rows = openEnded
    ? pinEventsFromStmt.all(chatId, from)
    : pinEventsBetweenStmt.all(chatId, from, to);
  return rows.map(pinEventPayload).filter(Boolean);
}

function getChatPins(chatId) {
  return chatPinsStmt.all(chatId).map((row) => ({
    id: row.id,
    chat_id: row.chat_id,
    message_id: row.message_id,
    pinned_by: row.pinned_by,
    pinned_by_name: row.pinned_by_name,
    created_at: row.created_at,
    message_user_id: row.message_user_id,
    message_author_name: row.message_author_name,
    preview_text: pinPreviewText(row),
    file_name: row.file_name || null,
    file_type: row.file_type || null,
    is_voice_note: !!row.voice_message_id,
    is_video_note: row.voice_note_kind === 'video_note',
  }));
}

function getChatPinPayload(chatId) {
  const chat = chatPinSettingsStmt.get(chatId);
  return {
    pins: getChatPins(chatId),
    allow_unpin_any_pin: chat ? chat.allow_unpin_any_pin !== 0 : false,
  };
}

function broadcastPinsUpdated(chatId, { action = 'updated', actorId = null, messageId = null, pinEvent = null } = {}) {
  const payload = getChatPinPayload(chatId);
  broadcastToChatAll(chatId, {
    type: 'pins_updated',
    chatId,
    pins: payload.pins,
    allow_unpin_any_pin: payload.allow_unpin_any_pin,
    action,
    actorId,
    messageId,
    pin_event: pinEvent || null,
  });
  return { ...payload, pin_event: pinEvent || null };
}

function normalizeClientId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  if (!id || id.length > 128) return null;
  return id;
}

const NOTES_CHAT_NAME = 'Заметки';
const NOTES_CHAT_EMOJI = '📝';

function isNotesChatRow(chat) {
  return Number(chat?.is_notes) === 1;
}

function notesChatPayload(chat) {
  if (!chat) return null;
  return {
    ...chat,
    name: NOTES_CHAT_NAME,
    type: 'notes',
    avatar_url: null,
    avatar_emoji: NOTES_CHAT_EMOJI,
    private_user: null,
  };
}

function ensureNotesChatForUser(userId) {
  const ownerId = Number(userId);
  if (!Number.isInteger(ownerId) || ownerId <= 0) return null;

  let chat = db.prepare('SELECT * FROM chats WHERE is_notes=1 AND created_by=? ORDER BY id ASC LIMIT 1')
    .get(ownerId);
  if (!chat) {
    const inserted = db.prepare('INSERT INTO chats(name,type,created_by,is_notes) VALUES(?,?,?,1)')
      .run(NOTES_CHAT_NAME, 'private', ownerId);
    chat = db.prepare('SELECT * FROM chats WHERE id=?').get(inserted.lastInsertRowid);
  }

  db.prepare('INSERT OR IGNORE INTO chat_members(chat_id,user_id) VALUES(?,?)').run(chat.id, ownerId);
  db.prepare('DELETE FROM chat_members WHERE chat_id=? AND user_id<>?').run(chat.id, ownerId);
  return chat;
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
    ensureNotesChatForUser(userId);

    const token = jwt.sign({ id: userId, username: username.toLowerCase() }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: publicUser({ id: userId, username: username.toLowerCase(), display_name: name, is_admin: isAdmin, is_blocked: 0, avatar_color: color, avatar_url: null, ui_theme: 'bananza', ui_visual_mode: 'classic', ui_modal_animation: 'soft', ui_modal_animation_speed: UI_MODAL_ANIMATION_SPEED_DEFAULT }) });
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

    ensureNotesChatForUser(u.id);
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

function chatSidebarPinPayload(row) {
  const order = row?.chat_list_pin_order == null ? null : Number(row.chat_list_pin_order);
  const normalizedOrder = Number.isFinite(order) && order > 0 ? Math.floor(order) : null;
  return {
    is_pinned: normalizedOrder != null,
    chat_list_pin_order: normalizedOrder,
  };
}

function sendChatListUpdated(userId, data = {}) {
  const id = Number(userId || 0);
  if (!id) return;
  sendToUser(id, {
    type: 'chat_list_updated',
    ...data,
  });
}

function isGeneralChatRow(chat) {
  return String(chat?.type || '') === 'general';
}

function isGroupOrPrivateChatRow(chat) {
  const type = String(chat?.type || '');
  return type === 'group' || type === 'private';
}

function canManageDestructiveChat(chat, user) {
  if (!chat || !user) return false;
  if (isNotesChatRow(chat) || isGeneralChatRow(chat) || !isGroupOrPrivateChatRow(chat)) return false;
  return Boolean(user.is_admin || Number(chat.created_by || 0) === Number(user.id || 0));
}

function getChatLastAnyMessageId(chatId) {
  const row = db.prepare('SELECT COALESCE(MAX(id),0) as last_id FROM messages WHERE chat_id=?').get(chatId);
  return Number(row?.last_id || 0);
}

function revealHiddenChatForUser(chatId, userId, data = {}) {
  const cid = Number(chatId || 0);
  const uid = Number(userId || 0);
  if (!cid || !uid) return false;
  const result = db.prepare(`
    UPDATE chat_members
    SET hidden_at=NULL, hidden_after_message_id=NULL
    WHERE chat_id=? AND user_id=? AND hidden_after_message_id IS NOT NULL
  `).run(cid, uid);
  if (result.changes > 0) {
    sendChatListUpdated(uid, {
      chatId: cid,
      reason: data.reason || 'chat_revealed',
      messageId: data.messageId || null,
    });
    return true;
  }
  return false;
}

function revealHiddenChatForMembers(chatId, data = {}) {
  const cid = Number(chatId || 0);
  if (!cid) return 0;
  const hidden = db.prepare(`
    SELECT user_id
    FROM chat_members
    WHERE chat_id=? AND hidden_after_message_id IS NOT NULL
  `).all(cid);
  if (!hidden.length) return 0;
  db.prepare(`
    UPDATE chat_members
    SET hidden_at=NULL, hidden_after_message_id=NULL
    WHERE chat_id=? AND hidden_after_message_id IS NOT NULL
  `).run(cid);
  hidden.forEach(({ user_id }) => {
    sendChatListUpdated(user_id, {
      chatId: cid,
      reason: data.reason || 'new_message',
      messageId: data.messageId || null,
    });
  });
  return hidden.length;
}

function handleChatListMessageCreated(message) {
  const chatId = Number(message?.chat_id || message?.chatId || 0);
  const messageId = Number(message?.id || 0);
  if (!chatId || !messageId) return;
  revealHiddenChatForMembers(chatId, { reason: 'new_message', messageId });
}

function handleUserMessageCreated(message, options = {}) {
  handleChatListMessageCreated(message);
  return aiBotFeature?.handleMessageCreated(message, options);
}

function getChatMemberPreferences(chatId, userId) {
  return chatMemberPreferencesStmt.get(chatId, userId) || null;
}

const pinChatForUserTx = db.transaction((chatId, userId) => {
  const member = getChatMemberPreferences(chatId, userId);
  if (!member) return null;
  const currentOrder = member.chat_list_pin_order == null ? null : Number(member.chat_list_pin_order);
  if (Number.isFinite(currentOrder) && currentOrder > 0) {
    return { ...member, ...chatSidebarPinPayload(member) };
  }
  const maxRow = db.prepare('SELECT MAX(chat_list_pin_order) as max_order FROM chat_members WHERE user_id=?').get(userId);
  const nextOrder = Math.max(0, Number(maxRow?.max_order || 0)) + 1;
  db.prepare('UPDATE chat_members SET chat_list_pin_order=? WHERE chat_id=? AND user_id=?')
    .run(nextOrder, chatId, userId);
  return {
    ...member,
    chat_list_pin_order: nextOrder,
    is_pinned: true,
  };
});

const unpinChatForUserTx = db.transaction((chatId, userId) => {
  const member = getChatMemberPreferences(chatId, userId);
  if (!member) return null;
  const currentOrder = member.chat_list_pin_order == null ? null : Number(member.chat_list_pin_order);
  if (!Number.isFinite(currentOrder) || currentOrder <= 0) {
    return { ...member, ...chatSidebarPinPayload(member) };
  }
  db.prepare('UPDATE chat_members SET chat_list_pin_order=NULL WHERE chat_id=? AND user_id=?')
    .run(chatId, userId);
  db.prepare('UPDATE chat_members SET chat_list_pin_order=chat_list_pin_order-1 WHERE user_id=? AND chat_list_pin_order>?')
    .run(userId, currentOrder);
  return {
    ...member,
    chat_list_pin_order: null,
    is_pinned: false,
  };
});

const movePinnedChatForUserTx = db.transaction((chatId, userId, direction) => {
  const member = getChatMemberPreferences(chatId, userId);
  if (!member) return { error: 'not_member' };
  const currentOrder = member.chat_list_pin_order == null ? null : Number(member.chat_list_pin_order);
  if (!Number.isFinite(currentOrder) || currentOrder <= 0) return { error: 'not_pinned' };
  const isUp = direction === 'up';
  const adjacent = isUp
    ? db.prepare(`
        SELECT chat_id, chat_list_pin_order
        FROM chat_members
        WHERE user_id=? AND chat_list_pin_order IS NOT NULL AND chat_list_pin_order<?
        ORDER BY chat_list_pin_order DESC
        LIMIT 1
      `).get(userId, currentOrder)
    : db.prepare(`
        SELECT chat_id, chat_list_pin_order
        FROM chat_members
        WHERE user_id=? AND chat_list_pin_order IS NOT NULL AND chat_list_pin_order>?
        ORDER BY chat_list_pin_order ASC
        LIMIT 1
      `).get(userId, currentOrder);
  if (!adjacent) {
    return {
      moved: false,
      sidebar_pin: {
        ...member,
        ...chatSidebarPinPayload(member),
      },
    };
  }
  db.prepare('UPDATE chat_members SET chat_list_pin_order=? WHERE chat_id=? AND user_id=?')
    .run(Number(adjacent.chat_list_pin_order), chatId, userId);
  db.prepare('UPDATE chat_members SET chat_list_pin_order=? WHERE chat_id=? AND user_id=?')
    .run(currentOrder, adjacent.chat_id, userId);
  return {
    moved: true,
    sidebar_pin: {
      ...member,
      chat_list_pin_order: Number(adjacent.chat_list_pin_order),
      is_pinned: true,
    },
  };
});

function safeUploadPath(storedName, baseDir = UPLOADS_DIR) {
  const name = path.basename(String(storedName || ''));
  return name ? path.join(baseDir, name) : '';
}

function unlinkIfPresent(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
}

function chatAssetPathFromUrl(url, baseDir) {
  if (!url) return '';
  return safeUploadPath(path.basename(String(url)), baseDir);
}

function collectChatFileRows(chatId) {
  return db.prepare(`
    SELECT id, stored_name
    FROM files
    WHERE id IN (
      SELECT m.file_id
      FROM messages m
      WHERE m.chat_id=? AND m.file_id IS NOT NULL
      UNION
      SELECT vm.transcription_file_id
      FROM voice_messages vm
      JOIN messages m ON m.id=vm.message_id
      WHERE m.chat_id=? AND vm.transcription_file_id IS NOT NULL
    )
  `).all(chatId, chatId);
}

function deleteAiMemoryForChat(chatId) {
  [
    'message_embeddings',
    'memory_chunks',
    'room_summaries',
    'memory_facts',
    'ai_memory_jobs',
    'yandex_message_embeddings',
    'yandex_memory_chunks',
    'yandex_room_summaries',
    'yandex_memory_facts',
    'yandex_memory_jobs',
    'grok_message_embeddings',
    'grok_memory_chunks',
    'grok_room_summaries',
    'grok_memory_facts',
    'grok_memory_jobs',
  ].forEach((table) => {
    db.prepare(`DELETE FROM ${table} WHERE chat_id=?`).run(chatId);
  });
}

const deleteChatMessageDataTx = db.transaction((chatId, { deleteChat = false } = {}) => {
  if (deleteChat) {
    db.prepare('UPDATE messages SET saved_from_chat_id=NULL WHERE saved_from_chat_id=?').run(chatId);
  }
  db.prepare(`
    UPDATE messages
    SET reply_to_id=NULL
    WHERE reply_to_id IN (SELECT id FROM messages WHERE chat_id=?)
  `).run(chatId);
  db.prepare(`
    UPDATE messages
    SET forwarded_from_message_id=NULL
    WHERE forwarded_from_message_id IN (SELECT id FROM messages WHERE chat_id=?)
  `).run(chatId);
  db.prepare(`
    UPDATE messages
    SET saved_from_message_id=NULL
    WHERE saved_from_message_id IN (SELECT id FROM messages WHERE chat_id=?)
  `).run(chatId);

  db.prepare('DELETE FROM message_pin_events WHERE chat_id=?').run(chatId);
  db.prepare('DELETE FROM message_pins WHERE chat_id=?').run(chatId);
  db.prepare('DELETE FROM message_mentions WHERE chat_id=?').run(chatId);
  deleteAiMemoryForChat(chatId);
  db.prepare('DELETE FROM messages WHERE chat_id=?').run(chatId);
  db.prepare('UPDATE chat_members SET last_read_id=0 WHERE chat_id=?').run(chatId);
  if (deleteChat) db.prepare('DELETE FROM chats WHERE id=?').run(chatId);
});

function deleteChatMessageData(chatId, options = {}) {
  const cid = Number(chatId || 0);
  if (!cid) return { fileRows: [] };
  const fileRows = collectChatFileRows(cid);
  deleteChatMessageDataTx(cid, options);
  for (const file of fileRows) {
    db.prepare('DELETE FROM files WHERE id=?').run(file.id);
  }
  fileRows.forEach((file) => unlinkIfPresent(safeUploadPath(file.stored_name)));
  return { fileRows };
}

function decorateChatListRows(rows, viewerUserId) {
  const uid = Number(viewerUserId || 0);
  for (const chat of rows) {
    Object.assign(chat, chatPreferencesPayload(chat));
    Object.assign(chat, chatSidebarPinPayload(chat));
    if (isNotesChatRow(chat)) {
      Object.assign(chat, notesChatPayload(chat));
    } else if (chat.type === 'private') {
      const other = db.prepare(`
        SELECT u.id,u.username,u.display_name,u.avatar_color,u.avatar_url FROM users u
        JOIN chat_members cm ON cm.user_id=u.id WHERE cm.chat_id=? AND u.id!=?
      `).get(chat.id, uid);
      if (other) { chat.name = other.display_name; chat.private_user = other; }
    }
    if (chat.type === 'group') {
      chat.avatar_url = chat.avatar_url || null;
    }
    const lastRead = chat.last_read_id || 0;
    const unread = db.prepare('SELECT COUNT(*) as c FROM messages WHERE chat_id=? AND id>? AND is_deleted=0 AND user_id!=?').get(chat.id, lastRead, uid);
    chat.unread_count = unread ? unread.c : 0;
    if (!String(chat.last_text || '').trim() && Number(chat.last_voice_message_id || 0) > 0) {
      chat.last_text = chat.last_note_kind === 'video_note' ? 'Р’РёРґРµРѕ-Р·Р°РјРµС‚РєР°' : 'Р“РѕР»РѕСЃРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ';
    }
  }
  return rows;
}

app.get('/api/chats', auth, (req, res) => {
  ensureNotesChatForUser(req.user.id);
  const rows = db.prepare(`
    SELECT c.*,
      cm.notify_enabled,
      cm.sounds_enabled,
      cm.chat_list_pin_order,
      cm.hidden_at,
      cm.hidden_after_message_id,
      CASE WHEN cm.chat_list_pin_order IS NULL THEN 0 ELSE 1 END as is_pinned,
      (SELECT COALESCE(NULLIF(m.text, ''), NULLIF(vm.transcription_text, ''))
        FROM messages m
        LEFT JOIN voice_messages vm ON vm.message_id=m.id
        WHERE m.chat_id=c.id AND m.is_deleted=0
        ORDER BY m.id DESC LIMIT 1) as last_text,
      (SELECT vm.message_id
        FROM messages m
        LEFT JOIN voice_messages vm ON vm.message_id=m.id
        WHERE m.chat_id=c.id AND m.is_deleted=0
        ORDER BY m.id DESC LIMIT 1) as last_voice_message_id,
      (SELECT COALESCE(vm.note_kind, 'voice')
        FROM messages m
        LEFT JOIN voice_messages vm ON vm.message_id=m.id
        WHERE m.chat_id=c.id AND m.is_deleted=0
        ORDER BY m.id DESC LIMIT 1) as last_note_kind,
      (SELECT m.created_at FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_time,
      (SELECT u.display_name FROM messages m JOIN users u ON u.id=m.user_id WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_user,
      (SELECT m.file_id FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_file_id,
      (SELECT MAX(m.id) FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0) as last_message_id,
      (SELECT MIN(m.id) FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 AND m.id>COALESCE(cm.last_read_id,0) AND m.user_id!=cm.user_id) as first_unread_id,
      cm.last_read_id
    FROM chats c JOIN chat_members cm ON cm.chat_id=c.id
    WHERE cm.user_id=?
      AND (
        cm.hidden_after_message_id IS NULL
        OR (
          SELECT COALESCE(MAX(mh.id),0)
          FROM messages mh
          WHERE mh.chat_id=c.id
        ) > COALESCE(cm.hidden_after_message_id,0)
      )
    ORDER BY
      CASE WHEN cm.chat_list_pin_order IS NULL THEN 1 ELSE 0 END ASC,
      cm.chat_list_pin_order ASC,
      last_time DESC NULLS LAST,
      c.created_at DESC
  `).all(req.user.id);

  for (const chat of rows) {
    Object.assign(chat, chatPreferencesPayload(chat));
    Object.assign(chat, chatSidebarPinPayload(chat));
    if (isNotesChatRow(chat)) {
      Object.assign(chat, notesChatPayload(chat));
    } else if (chat.type === 'private') {
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
    if (!String(chat.last_text || '').trim() && Number(chat.last_voice_message_id || 0) > 0) {
      chat.last_text = chat.last_note_kind === 'video_note' ? 'Видео-заметка' : 'Голосовое сообщение';
    }
  }
  res.json(rows);
});

app.get('/api/chats/hidden', auth, (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  if (query.length > 80) return res.status(400).json({ error: 'Search query is too long' });
  const rows = db.prepare(`
    SELECT c.*,
      cm.notify_enabled,
      cm.sounds_enabled,
      cm.chat_list_pin_order,
      cm.hidden_at,
      cm.hidden_after_message_id,
      CASE WHEN cm.chat_list_pin_order IS NULL THEN 0 ELSE 1 END as is_pinned,
      (SELECT COALESCE(NULLIF(m.text, ''), NULLIF(vm.transcription_text, ''))
        FROM messages m
        LEFT JOIN voice_messages vm ON vm.message_id=m.id
        WHERE m.chat_id=c.id AND m.is_deleted=0
        ORDER BY m.id DESC LIMIT 1) as last_text,
      (SELECT vm.message_id
        FROM messages m
        LEFT JOIN voice_messages vm ON vm.message_id=m.id
        WHERE m.chat_id=c.id AND m.is_deleted=0
        ORDER BY m.id DESC LIMIT 1) as last_voice_message_id,
      (SELECT COALESCE(vm.note_kind, 'voice')
        FROM messages m
        LEFT JOIN voice_messages vm ON vm.message_id=m.id
        WHERE m.chat_id=c.id AND m.is_deleted=0
        ORDER BY m.id DESC LIMIT 1) as last_note_kind,
      (SELECT m.created_at FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_time,
      (SELECT u.display_name FROM messages m JOIN users u ON u.id=m.user_id WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_user,
      (SELECT m.file_id FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 ORDER BY m.id DESC LIMIT 1) as last_file_id,
      (SELECT MAX(m.id) FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0) as last_message_id,
      (SELECT MIN(m.id) FROM messages m WHERE m.chat_id=c.id AND m.is_deleted=0 AND m.id>COALESCE(cm.last_read_id,0) AND m.user_id!=cm.user_id) as first_unread_id,
      cm.last_read_id
    FROM chats c JOIN chat_members cm ON cm.chat_id=c.id
    WHERE cm.user_id=?
      AND cm.hidden_after_message_id IS NOT NULL
    ORDER BY
      last_time DESC NULLS LAST,
      c.created_at DESC
    LIMIT 50
  `).all(req.user.id);
  const decorated = decorateChatListRows(rows, req.user.id)
    .map((chat) => ({ ...chat, is_hidden: true }))
    .filter((chat) => {
      if (!query) return true;
      return [
        chat.name || '',
        chat.private_user?.display_name || '',
        chat.private_user?.username || '',
      ].join(' ').toLowerCase().includes(query);
    })
    .slice(0, 20);
  res.json({ chats: decorated });
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
    WHERE c.type='private' AND COALESCE(c.is_notes,0)=0
  `).get(req.user.id, targetUserId);

  if (existing) {
    revealHiddenChatForUser(existing.id, req.user.id, { reason: 'private_search' });
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
  res.json(db.prepare('SELECT u.id,u.username,u.display_name,u.avatar_color,u.avatar_url,u.is_ai_bot FROM users u JOIN chat_members cm ON cm.user_id=u.id WHERE cm.chat_id=?').all(chatId));
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
  sendChatListUpdated(req.user.id, { chatId, reason: 'preferences' });
  res.json({ preferences: next });
});

app.post('/api/chats/:chatId/hide', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (isNotesChatRow(chat) || isGeneralChatRow(chat) || !isGroupOrPrivateChatRow(chat)) {
    return res.status(400).json({ error: 'This chat cannot be hidden' });
  }
  const member = getChatMemberPreferences(chatId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });
  const hiddenAfterMessageId = getChatLastAnyMessageId(chatId);
  db.prepare(`
    UPDATE chat_members
    SET hidden_at=datetime('now'), hidden_after_message_id=?
    WHERE chat_id=? AND user_id=?
  `).run(hiddenAfterMessageId, chatId, req.user.id);
  sendChatListUpdated(req.user.id, { chatId, reason: 'chat_hidden' });
  res.json({ ok: true, chatId, hidden_after_message_id: hiddenAfterMessageId });
});

app.post('/api/chats/:chatId/unhide', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id)) {
    return res.status(403).json({ error: 'Not a member' });
  }
  revealHiddenChatForUser(chatId, req.user.id, { reason: 'chat_unhidden' });
  res.json({ ok: true, chatId });
});

app.delete('/api/chats/:chatId/history', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!canManageDestructiveChat(chat, req.user)) {
    return res.status(403).json({ error: 'Only chat creator or admin can clear history' });
  }
  deleteChatMessageData(chatId, { deleteChat: false });
  broadcastToChatAll(chatId, {
    type: 'chat_history_cleared',
    chatId,
    actorId: req.user.id,
  });
  const members = db.prepare('SELECT user_id FROM chat_members WHERE chat_id=?').all(chatId);
  members.forEach(({ user_id }) => sendChatListUpdated(user_id, { chatId, reason: 'history_cleared' }));
  res.json({ ok: true });
});

app.delete('/api/chats/:chatId', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!canManageDestructiveChat(chat, req.user)) {
    return res.status(403).json({ error: 'Only chat creator or admin can delete chat' });
  }
  const members = db.prepare('SELECT user_id FROM chat_members WHERE chat_id=?').all(chatId);
  const avatarPath = chatAssetPathFromUrl(chat.avatar_url, AVATARS_DIR);
  const backgroundPath = chatAssetPathFromUrl(chat.background_url, BACKGROUNDS_DIR);
  deleteChatMessageData(chatId, { deleteChat: true });
  unlinkIfPresent(avatarPath);
  unlinkIfPresent(backgroundPath);
  members.forEach(({ user_id }) => {
    sendToUser(user_id, { type: 'chat_removed', chatId, reason: 'deleted' });
  });
  res.json({ ok: true });
});

app.put('/api/chats/:chatId/sidebar-pin', auth, (req, res) => {
  const chatId = +req.params.chatId;
  if (!chatId) return res.status(400).json({ error: 'Invalid chat' });
  const member = getChatMemberPreferences(chatId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });
  const nextPinned = boolPreferenceValue(req.body?.pinned, member.chat_list_pin_order != null);
  const sidebarPin = nextPinned
    ? pinChatForUserTx(chatId, req.user.id)
    : unpinChatForUserTx(chatId, req.user.id);
  sendChatListUpdated(req.user.id, {
    chatId,
    reason: nextPinned ? 'sidebar_pin' : 'sidebar_unpin',
  });
  res.json({
    chatId,
    sidebar_pin: sidebarPin ? chatSidebarPinPayload(sidebarPin) : { is_pinned: nextPinned, chat_list_pin_order: null },
  });
});

app.post('/api/chats/:chatId/sidebar-pin/move', auth, (req, res) => {
  const chatId = +req.params.chatId;
  if (!chatId) return res.status(400).json({ error: 'Invalid chat' });
  const direction = String(req.body?.direction || '').trim().toLowerCase();
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'Direction must be up or down' });
  }
  const result = movePinnedChatForUserTx(chatId, req.user.id, direction);
  if (!result || result.error === 'not_member') return res.status(403).json({ error: 'Not a member' });
  if (result.error === 'not_pinned') return res.status(400).json({ error: 'Chat is not pinned' });
  sendChatListUpdated(req.user.id, {
    chatId,
    direction,
    reason: 'sidebar_pin_move',
  });
  res.json({
    chatId,
    moved: !!result.moved,
    sidebar_pin: result.sidebar_pin ? chatSidebarPinPayload(result.sidebar_pin) : { is_pinned: true, chat_list_pin_order: null },
  });
});

app.get('/api/chats/:chatId/pins', auth, (req, res) => {
  const chatId = +req.params.chatId;
  if (!chatId) return res.status(400).json({ error: 'Invalid chat' });
  if (!isChatMember(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  res.json(getChatPinPayload(chatId));
});

app.put('/api/chats/:chatId/pin-settings', auth, (req, res) => {
  const chatId = +req.params.chatId;
  if (!chatId) return res.status(400).json({ error: 'Invalid chat' });
  const chat = chatPinSettingsStmt.get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  if (!req.user.is_admin) {
    if (!isChatMember(chatId, req.user.id))
      return res.status(403).json({ error: 'Not a member' });
    if (Number(chat.created_by || 0) !== Number(req.user.id))
      return res.status(403).json({ error: 'Only chat creator or admin can change pin settings' });
  }

  const allowUnpinAnyPin = boolPreferenceValue(
    req.body?.allow_unpin_any_pin,
    chat.allow_unpin_any_pin !== 0
  );
  db.prepare('UPDATE chats SET allow_unpin_any_pin=? WHERE id=?')
    .run(allowUnpinAnyPin ? 1 : 0, chatId);

  const updated = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  broadcastToChatAll(chatId, { type: 'chat_updated', chat: updated });
  res.json(updated);
});

app.put('/api/chats/:chatId/context-transform-settings', auth, (req, res) => {
  const chatId = +req.params.chatId;
  if (!chatId) return res.status(400).json({ error: 'Invalid chat' });
  const chat = chatContextTransformSettingsStmt.get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!canManageContextTransform(chat, req.user)) {
    return res.status(403).json({ error: 'Only chat creator or admin can change context transform settings' });
  }

  const enabled = boolPreferenceValue(
    req.body?.context_transform_enabled,
    chat.context_transform_enabled !== 0
  );
  db.prepare('UPDATE chats SET context_transform_enabled=? WHERE id=?')
    .run(enabled ? 1 : 0, chatId);

  const updated = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  broadcastToChatAll(chatId, { type: 'chat_updated', chat: updated });
  res.json(updated);
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

app.delete('/api/chats/:chatId/members/me', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const chat = db.prepare('SELECT * FROM chats WHERE id=?').get(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (chat.type !== 'group' || isNotesChatRow(chat) || isGeneralChatRow(chat)) {
    return res.status(400).json({ error: 'Cannot leave this chat' });
  }
  if (Number(chat.created_by || 0) === Number(req.user.id)) {
    return res.status(403).json({ error: 'Chat creator cannot leave this chat' });
  }
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id)) {
    return res.status(403).json({ error: 'Not a member' });
  }

  db.prepare('DELETE FROM chat_members WHERE chat_id=? AND user_id=?').run(chatId, req.user.id);
  db.prepare(`
    UPDATE ai_chat_bots
    SET enabled=0, updated_at=datetime('now')
    WHERE chat_id=? AND bot_id IN (SELECT id FROM ai_bots WHERE user_id=?)
  `).run(chatId, req.user.id);
  sendToUser(req.user.id, { type: 'chat_removed', chatId, reason: 'left' });
  res.json({ ok: true });
});

app.get('/api/chats/:chatId/media', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const before = req.query.before ? +req.query.before : null;
  const after = req.query.after ? +req.query.after : null;
  const rawLimit = Number(req.query.limit || 3);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 3, 1), 20);

  if (!chatId) return res.status(400).json({ error: 'Invalid chat' });
  if (before && after) return res.status(400).json({ error: 'Use either before or after' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const mediaWhere = `
    FROM messages m
    JOIN files f ON f.id=m.file_id
    LEFT JOIN voice_messages vm ON vm.message_id=m.id
    WHERE m.chat_id=? AND m.is_deleted=0 AND f.type IN ('image','video')
      AND (vm.message_id IS NULL OR COALESCE(vm.note_kind, 'voice')!='video_note')
  `;
  let rows;
  if (after) {
    rows = db.prepare(`SELECT m.id ${mediaWhere} AND m.id>? ORDER BY m.id ASC LIMIT ?`)
      .all(chatId, after, limit);
  } else {
    rows = before
      ? db.prepare(`SELECT m.id ${mediaWhere} AND m.id<? ORDER BY m.id DESC LIMIT ?`).all(chatId, before, limit)
      : db.prepare(`SELECT m.id ${mediaWhere} ORDER BY m.id DESC LIMIT ?`).all(chatId, limit);
    rows = rows.reverse();
  }

  const media = rows
    .map(row => hydrateMessageById(row.id, req.user.id))
    .filter(row => row && (row.file_type === 'image' || row.file_type === 'video'));
  const firstId = media.reduce((min, msg) => {
    const id = Number(msg.id) || 0;
    return id > 0 ? Math.min(min, id) : min;
  }, Number.MAX_SAFE_INTEGER);
  const lastId = media.reduce((max, msg) => Math.max(max, Number(msg.id) || 0), 0);
  const hasMoreBefore = firstId !== Number.MAX_SAFE_INTEGER
    ? !!db.prepare(`SELECT 1 ${mediaWhere} AND m.id<? LIMIT 1`).get(chatId, firstId)
    : false;
  const hasMoreAfter = lastId
    ? !!db.prepare(`SELECT 1 ${mediaWhere} AND m.id>? LIMIT 1`).get(chatId, lastId)
    : false;

  res.json({ media, has_more_before: hasMoreBefore, has_more_after: hasMoreAfter });
});

app.get('/api/chats/:chatId/messages', auth, (req, res) => {
  const chatId = +req.params.chatId;
  const before = req.query.before ? +req.query.before : null;
  const after = req.query.after ? +req.query.after : null;
  const anchor = req.query.anchor ? +req.query.anchor : null;
  const limit = Math.min(+req.query.limit || 50, 100);
  const includeMeta = req.query.meta === '1';

  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });

  const selectSql = `
    SELECT m.*, u.username, u.display_name, u.avatar_color, u.avatar_url,
      COALESCE(u.is_ai_bot, 0) as is_ai_bot, ab.mention as ai_bot_mention,
      ab.provider as ai_bot_provider, ab.kind as ai_bot_kind,
      f.original_name as file_name, f.stored_name as file_stored,
      f.mime_type as file_mime, f.size as file_size, f.type as file_type,
      COALESCE(NULLIF(rm.text, ''), NULLIF(rvm.transcription_text, ''), CASE WHEN rvm.message_id IS NOT NULL THEN 'Голосовое сообщение' END) as reply_text,
      CASE WHEN rvm.message_id IS NOT NULL THEN 1 ELSE 0 END as reply_is_voice_note,
      COALESCE(rvm.note_kind, 'voice') as reply_note_kind,
      CASE
        WHEN NULLIF(rm.text, '') IS NULL AND NULLIF(rvm.transcription_text, '') IS NULL AND rvm.message_id IS NOT NULL
        THEN 1
        ELSE 0
      END as reply_text_is_fallback,
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
      anchorMsg = applyReplyTextFallback(anchorMsg);
      const anchorId = anchorMsg.id;
      const olderLimit = Math.floor((limit - 1) / 2);
      const newerLimit = Math.max(0, limit - olderLimit - 1);
      const older = db.prepare(`${selectSql} WHERE m.chat_id=? AND m.id<? AND m.is_deleted=0 ORDER BY m.id DESC LIMIT ?`)
        .all(chatId, anchorId, olderLimit)
        .map((row) => applyReplyTextFallback(row))
        .reverse();
      const newer = db.prepare(`${selectSql} WHERE m.chat_id=? AND m.id>? AND m.is_deleted=0 ORDER BY m.id ASC LIMIT ?`)
        .all(chatId, anchorId, newerLimit)
        .map((row) => applyReplyTextFallback(row));
      msgs = [...older, anchorMsg, ...newer];
    }
  }

  if (!msgs) {
    if (after) {
      msgs = db.prepare(`${selectSql} WHERE m.chat_id=? AND m.id>? AND m.is_deleted=0 ORDER BY m.id ASC LIMIT ?`)
        .all(chatId, after, limit)
        .map((row) => applyReplyTextFallback(row));
    } else {
      const q = `${selectSql} WHERE m.chat_id=? ${before ? 'AND m.id<?' : ''} AND m.is_deleted=0 ORDER BY m.id DESC LIMIT ?`;
      msgs = before
        ? db.prepare(q).all(chatId, before, limit)
        : db.prepare(q).all(chatId, limit);
      msgs = msgs.map((row) => applyReplyTextFallback(row));
      msgs = msgs.reverse();
    }
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

  const result = pollFeature.attachPollMetadata(
    voiceFeature.attachVoiceMetadata(
      msgs.map(m => attachMessageMentions({ ...m, previews: prevStmt.all(m.id), reactions: reactStmt.all(m.id), is_read: m.id <= minRead }))
    ),
    req.user.id,
    { ensureClosed: true, broadcastOnClose: true }
  );
  const pinEvents = getPinEventsForWindow(chatId, result, {
    openEnded: !before && !after && !anchor,
  });
  // Build per-member last-read map so clients can atomically reconcile local cache/UI.
  const members = db.prepare(`
    SELECT cm.user_id, COALESCE(cm.last_read_id,0) as last_read_id
    FROM chat_members cm
    JOIN users u ON u.id=cm.user_id
    WHERE cm.chat_id = ? AND COALESCE(u.is_ai_bot,0)=0
  `).all(chatId);
  const member_last_reads = {};
  members.forEach(m => { member_last_reads[Number(m.user_id) || 0] = Number(m.last_read_id) || 0; });

  if (includeMeta) {
    const firstId = result.reduce((min, msg) => {
      const id = Number(msg.id) || 0;
      return id > 0 ? Math.min(min, id) : min;
    }, Number.MAX_SAFE_INTEGER);
    const hasMoreBefore = firstId !== Number.MAX_SAFE_INTEGER
      ? !!db.prepare('SELECT 1 FROM messages WHERE chat_id=? AND id<? AND is_deleted=0 LIMIT 1').get(chatId, firstId)
      : false;
    const lastId = result.reduce((max, msg) => Math.max(max, Number(msg.id) || 0), 0);
    const hasMoreAfter = lastId
      ? !!db.prepare('SELECT 1 FROM messages WHERE chat_id=? AND id>? AND is_deleted=0 LIMIT 1').get(chatId, lastId)
      : false;
    return res.json({ messages: result, pin_events: pinEvents, has_more_before: hasMoreBefore, has_more_after: hasMoreAfter, member_last_reads });
  }

  return res.json({ messages: result, pin_events: pinEvents, member_last_reads });
});

app.post('/api/chats/:chatId/messages', auth, msgLimiter, (req, res) => {
  const chatId = +req.params.chatId;
  const {
    text,
    fileId,
    replyToId,
    client_id,
    poll: rawPoll,
    aiImageRiskAccepted,
    ai_response_mode_hint,
    ai_document_format_hint,
  } = req.body;
  const clientId = normalizeClientId(client_id);
  const riskAccepted = aiImageRiskAccepted === true || aiImageRiskAccepted === 1 || aiImageRiskAccepted === '1';
  const aiResponseModeHint = normalizeAiResponseModeHint(ai_response_mode_hint);
  const aiDocumentFormatHint = normalizeAiDocumentFormatHint(ai_document_format_hint);
  const chat = db.prepare('SELECT id,is_notes FROM chats WHERE id=?').get(chatId);

  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  if (clientId) {
    const existing = db.prepare('SELECT id FROM messages WHERE chat_id=? AND user_id=? AND client_id=?').get(chatId, req.user.id, clientId);
    if (existing) return res.json(hydrateMessageById(existing.id, req.user.id));
  }
  const cleanText = text ? text.trim() : null;
  if (text && (typeof text !== 'string' || text.length > 5000))
    return res.status(400).json({ error: 'Message too long' });
  if (fileId && !db.prepare('SELECT 1 FROM files WHERE id=?').get(fileId))
    return res.status(400).json({ error: 'File not found' });
  const hasPoll = rawPoll != null;
  if (!cleanText && !fileId && !hasPoll) return res.status(400).json({ error: 'Empty message' });
  if (hasPoll && fileId) return res.status(400).json({ error: 'Poll message cannot include files' });

  if (hasPoll) {
    try {
      const result = messageActions.createPollMessage({
        actor: req.user,
        chatId,
        text: cleanText,
        replyToId,
        clientId,
        poll: rawPoll,
      });
      try { db.prepare("UPDATE users SET last_activity = datetime('now') WHERE id = ?").run(req.user.id); } catch (e) {}
      aiBotFeature.handleMessageCreated(result.message, { skipBotTrigger: true }).catch((error) => {
        console.warn('[ai-bot] message hook failed:', error.message);
      });
      return res.json(result.message);
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Invalid poll payload' });
    }
  }

  // Validate reply
  let validReplyId = null;
  if (replyToId) {
    const replyMsg = db.prepare('SELECT id FROM messages WHERE id=? AND chat_id=?').get(replyToId, chatId);
    if (replyMsg) validReplyId = replyMsg.id;
  }

  const createMessageTx = db.transaction(() => {
    const inserted = db.prepare(`
      INSERT INTO messages(
        chat_id,
        user_id,
        text,
        file_id,
        reply_to_id,
        client_id,
        ai_image_risk_confirmed,
        ai_response_mode_hint,
        ai_document_format_hint
      ) VALUES(?,?,?,?,?,?,?,?,?)
    `).run(
      chatId,
      req.user.id,
      cleanText,
      fileId || null,
      validReplyId,
      clientId,
      riskAccepted ? 1 : 0,
      aiResponseModeHint,
      aiDocumentFormatHint
    );
    const messageId = Number(inserted.lastInsertRowid);
    return messageId;
  });
  const messageId = createMessageTx();
  try { db.prepare("UPDATE users SET last_activity = datetime('now') WHERE id = ?").run(req.user.id); } catch (e) {}
  if (cleanText) saveMessageMentions(messageId, chatId, cleanText);

  const msg = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar_color, u.avatar_url,
      COALESCE(u.is_ai_bot, 0) as is_ai_bot, ab.mention as ai_bot_mention,
      ab.provider as ai_bot_provider, ab.kind as ai_bot_kind,
      f.original_name as file_name, f.stored_name as file_stored,
      f.mime_type as file_mime, f.size as file_size, f.type as file_type,
      COALESCE(NULLIF(rm.text, ''), NULLIF(rvm.transcription_text, ''), CASE WHEN rvm.message_id IS NOT NULL THEN 'Голосовое сообщение' END) as reply_text,
      CASE WHEN rvm.message_id IS NOT NULL THEN 1 ELSE 0 END as reply_is_voice_note,
      COALESCE(rvm.note_kind, 'voice') as reply_note_kind,
      CASE
        WHEN NULLIF(rm.text, '') IS NULL AND NULLIF(rvm.transcription_text, '') IS NULL AND rvm.message_id IS NOT NULL
        THEN 1
        ELSE 0
      END as reply_text_is_fallback,
      ru.display_name as reply_display_name, rm.id as reply_msg_id
    FROM messages m JOIN users u ON u.id=m.user_id
    LEFT JOIN ai_bots ab ON ab.user_id=u.id
    LEFT JOIN files f ON f.id=m.file_id
    LEFT JOIN messages rm ON rm.id=m.reply_to_id
    LEFT JOIN voice_messages rvm ON rvm.message_id=rm.id
    LEFT JOIN users ru ON ru.id=rm.user_id
    WHERE m.id=?
  `).get(messageId);
  applyReplyTextFallback(msg);
  msg.previews = [];
  msg.reactions = [];
  attachMessageMentions(msg);
  const hydratedMsg = pollFeature.attachPollMetadata(
    voiceFeature.attachVoiceMetadata([msg]),
    req.user.id,
    { ensureClosed: false, broadcastOnClose: false }
  )[0];
  // Echo client_id back to clients so optimistic messages can be matched
  if (clientId) hydratedMsg.client_id = clientId;

  handleChatListMessageCreated(hydratedMsg);
  broadcastToChatAll(chatId, { type: 'message', message: hydratedMsg });
  pushFeature.notifyMessageCreated(hydratedMsg);
  aiBotFeature.handleMessageCreated(hydratedMsg, { skipBotTrigger: Boolean(hydratedMsg.poll) }).catch((error) => {
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
        broadcastToChatAll(chatId, { type: 'link_preview', chatId, messageId: msg.id, preview });
      }).catch(() => {});
    }
  }

  res.json(hydratedMsg);
});

app.post('/api/messages/:id/save-to-notes', auth, msgLimiter, (req, res) => {
  const sourceMessageId = Number(req.params.id);
  if (!Number.isInteger(sourceMessageId) || sourceMessageId <= 0) {
    return res.status(400).json({ error: 'Invalid source message id' });
  }

  const source = messageCopyService.getSourceMessage(sourceMessageId);
  if (!source) return res.status(404).json({ error: 'Message not found' });
  if (Number(source.is_poll_message) !== 0) {
    return res.status(400).json({ error: 'Poll messages cannot be saved to notes' });
  }
  if (!isChatMember(source.chat_id, req.user.id)) {
    return res.status(403).json({ error: 'Not a member of source chat' });
  }

  const sourceChat = db.prepare('SELECT id,is_notes FROM chats WHERE id=?').get(source.chat_id);
  if (isNotesChatRow(sourceChat)) {
    return res.status(400).json({ error: 'Message is already in notes' });
  }
  if (!source.text && !source.file_id && !source.voice_message_id) {
    return res.status(400).json({ error: 'Nothing to save' });
  }
  if (source.voice_message_id && !source.file_id) {
    return res.status(409).json({ error: 'Voice source file is missing' });
  }

  const notesChat = ensureNotesChatForUser(req.user.id);
  if (!notesChat) return res.status(500).json({ error: 'Notes chat could not be created' });

  const sourcePreviews = messageCopyService.getSourcePreviews(source.id);
  const voiceSettings = voiceFeature.getPublicSettings ? voiceFeature.getPublicSettings() : {};
  const isPlainVoiceNote = String(source.voice_note_kind || 'voice') === 'voice';
  const shouldAutoTranscribe = Boolean(
    source.voice_message_id &&
    isPlainVoiceNote &&
    voiceSettings.voice_notes_enabled &&
    voiceSettings.auto_transcribe_on_send &&
    source.voice_transcription_status !== 'completed'
  );
  const forwardedFrom = source.forwarded_from_message_id
    ? {
        messageId: source.forwarded_from_message_id,
        userId: source.forwarded_from_user_id,
        displayName: source.forwarded_from_display_name,
      }
    : null;
  const savedFrom = {
    messageId: source.id,
    chatId: source.chat_id,
    userId: source.user_id,
    displayName: (source.display_name || '').trim() || 'Unknown',
    createdAt: source.created_at,
  };

  let savedMessageId = null;
  try {
    savedMessageId = messageCopyService.copyMessageToChat({
      source,
      sourcePreviews,
      targetChatId: notesChat.id,
      actorUserId: req.user.id,
      forwardedFrom,
      savedFrom,
      shouldAutoTranscribe,
    }).messageId;
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Save to notes failed' });
  }

  const message = hydrateMessageById(savedMessageId, req.user.id);
  if (!message) return res.status(500).json({ error: 'Saved note could not be loaded' });

  broadcastToChatAll(notesChat.id, { type: 'message', message });

  if (shouldAutoTranscribe && typeof voiceFeature.scheduleTranscription === 'function') {
    voiceFeature.scheduleTranscription({
      messageId: savedMessageId,
      chatId: notesChat.id,
      requestedBy: req.user.id,
      autoRequested: true,
    });
  }

  if (sourcePreviews.length === 0 && source.text) {
    messageCopyService.schedulePreviewFetch(savedMessageId, notesChat.id, source.text);
  }

  return res.json(message);
});

app.get('/api/messages/:id/jump-target', auth, (req, res) => {
  const messageId = Number(req.params.id);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return res.status(400).json({ error: 'Invalid message id' });
  }

  const message = db.prepare('SELECT id,chat_id,is_deleted FROM messages WHERE id=?').get(messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (message.is_deleted) return res.status(410).json({ error: 'Original message deleted' });
  if (!isChatMember(message.chat_id, req.user.id)) {
    return res.status(403).json({ error: 'Original message unavailable' });
  }

  return res.json({ chatId: message.chat_id, messageId: message.id });
});

app.post('/api/messages/:id/poll-vote', auth, msgLimiter, (req, res) => {
  const messageId = Number(req.params.id);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return res.status(400).json({ error: 'Invalid message id' });
  }

  try {
    const result = messageActions.votePoll({
      actor: req.user,
      messageId,
      optionIds: req.body?.optionIds || [],
    });
    return res.json({ ok: true, poll: result.poll });
  } catch (error) {
    if (error.code === 'not_found') return res.status(404).json({ error: error.message });
    if (error.code === 'closed') {
      const poll = pollFeature.getPollPayload(messageId, req.user.id, { ensureClosed: false });
      return res.status(409).json({ error: error.message, poll });
    }
    if (error.status === 403) return res.status(403).json({ error: error.message });
    return res.status(400).json({ error: error.message || 'Could not update poll vote' });
  }
});

app.post('/api/messages/:id/poll-close', auth, msgLimiter, (req, res) => {
  const messageId = Number(req.params.id);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return res.status(400).json({ error: 'Invalid message id' });
  }

  const state = pollFeature.pollStateForMessage(messageId);
  if (!state) return res.status(404).json({ error: 'Poll not found' });
  const canClose = req.user.is_admin ||
    Number(state.created_by) === Number(req.user.id) ||
    Number(state.chat_created_by) === Number(req.user.id);
  if (!canClose) return res.status(403).json({ error: 'Not allowed to close this poll' });

  try {
    const result = pollFeature.closePoll(messageId, req.user.id);
    pollFeature.broadcastPollUpdated(result.chatId, messageId);
    const poll = pollFeature.getPollPayload(messageId, req.user.id, { ensureClosed: false });
    return res.json({ ok: true, poll });
  } catch (error) {
    return res.status(error.code === 'not_found' ? 404 : 400).json({ error: error.message || 'Could not close poll' });
  }
});

app.get('/api/messages/:id/poll-voters', auth, (req, res) => {
  const messageId = Number(req.params.id);
  const optionId = Number(req.query?.optionId);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return res.status(400).json({ error: 'Invalid message id' });
  }
  if (!Number.isInteger(optionId) || optionId <= 0) {
    return res.status(400).json({ error: 'Invalid poll option' });
  }

  const state = pollFeature.pollStateForMessage(messageId);
  if (!state) return res.status(404).json({ error: 'Poll not found' });
  if (!req.user.is_admin && !isChatMember(state.chat_id, req.user.id)) {
    return res.status(403).json({ error: 'Not a member of chat' });
  }

  const poll = pollFeature.getPollPayload(messageId, req.user.id, { ensureClosed: true, broadcastOnClose: true });
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  if (!poll.show_voters) return res.status(403).json({ error: 'This poll hides voters' });
  const option = (poll.options || []).find((item) => Number(item.id) === optionId);
  if (!option) return res.status(404).json({ error: 'Poll option not found' });

  return res.json({
    option,
    voters: pollFeature.getVoters(messageId, optionId),
  });
});

app.post('/api/messages/:id/pin', auth, msgLimiter, (req, res) => {
  const mid = +req.params.id;
  try {
    const payload = messageActions.pinMessage({ actor: req.user, messageId: mid });
    res.json(payload);
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ error: error.message });
    if (error.status === 404) return res.status(404).json({ error: error.message });
    res.status(error.status || 400).json({ error: error.message || 'Could not pin message' });
  }
});

app.delete('/api/messages/:id/pin', auth, (req, res) => {
  const mid = +req.params.id;
  if (!mid) return res.status(400).json({ error: 'Invalid message' });

  const pin = db.prepare(`
    SELECT p.*, c.allow_unpin_any_pin, c.created_by
    FROM message_pins p
    JOIN chats c ON c.id=p.chat_id
    WHERE p.message_id=?
  `).get(mid);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });

  const member = isChatMember(pin.chat_id, req.user.id);
  if (!req.user.is_admin && !member)
    return res.status(403).json({ error: 'Not a member' });

  const canUnpin = req.user.is_admin ||
    Number(pin.pinned_by) === Number(req.user.id) ||
    (member && pin.allow_unpin_any_pin !== 0);
  if (!canUnpin) return res.status(403).json({ error: 'Not allowed to unpin this message' });

  db.prepare('DELETE FROM message_pins WHERE id=?').run(pin.id);
  const pinEvent = recordPinEvent({
    chatId: pin.chat_id,
    messageId: mid,
    action: 'unpinned',
    actor: req.user,
  });
  const payload = broadcastPinsUpdated(pin.chat_id, { action: 'unpinned', actorId: req.user.id, messageId: mid, pinEvent });
  res.json({ ok: true, ...payload });
});

app.patch('/api/messages/:id', auth, msgLimiter, (req, res) => {
  const mid = +req.params.id;
  const { text } = req.body || {};
  if (typeof text !== 'string') return res.status(400).json({ error: 'Text is required' });
  if (text.length > 5000) return res.status(400).json({ error: 'Message too long' });

  const m = editableMessageForUpdateStmt.get(mid);
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (!req.user.is_admin && m.user_id !== req.user.id)
    return res.status(403).json({ error: 'Not allowed' });
  if (!req.user.is_admin && !db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(m.chat_id, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  if (m.poll_message_id) return res.status(400).json({ error: 'Poll messages cannot be edited' });

  try {
    const updated = applyEditableMessageText(m, {
      actorUserId: req.user.id,
      viewerUserId: req.user.id,
      text,
    });
    res.json(updated);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || 'Could not edit message' });
  }
});

app.post('/api/messages/:id/context-convert', auth, msgLimiter, async (req, res) => {
  const mid = +req.params.id;
  const m = editableMessageForUpdateStmt.get(mid);
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (!req.user.is_admin && m.user_id !== req.user.id)
    return res.status(403).json({ error: 'Not allowed' });
  if (!req.user.is_admin && !db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(m.chat_id, req.user.id))
    return res.status(403).json({ error: 'Not a member' });
  if (m.poll_message_id) return res.status(400).json({ error: 'Poll messages cannot be transformed' });
  if (m.ai_generated || Number(m.is_ai_author || 0) === 1) {
    return res.status(400).json({ error: 'AI messages cannot be transformed' });
  }

  const sourceText = m.voice_message_id
    ? String(m.transcription_text || '').trim()
    : String(m.text || '').trim();
  if (!sourceText) {
    return res.status(400).json({ error: 'Message has no editable text to transform' });
  }

  try {
    const result = await aiBotFeature.transformText({
      chatId: m.chat_id,
      botId: req.body?.botId,
      text: sourceText,
    });
    const updated = applyEditableMessageText(m, {
      actorUserId: req.user.id,
      viewerUserId: req.user.id,
      text: result.text,
    });
    res.json({
      ok: true,
      message: updated,
      bot: result?.bot
        ? {
            id: Number(result.bot.id || 0),
            name: result.bot.name || '',
            provider: result.bot.provider || 'openai',
          }
        : null,
    });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || 'Context transform failed' });
  }
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
  notifyUserUpdated(req.user.id);
  res.json({ user: publicUser(user) });
});

app.patch('/api/user/theme', auth, (req, res) => {
  const theme = typeof req.body?.theme === 'string' ? req.body.theme : '';
  if (!UI_THEMES.has(theme)) return res.status(400).json({ error: 'Unknown theme' });
  db.prepare('UPDATE users SET ui_theme=? WHERE id=?').run(theme, req.user.id);
  const user = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id=?`).get(req.user.id);
  res.json({ user: publicUser(user) });
});

app.patch('/api/user/visual-mode', auth, (req, res) => {
  const mode = typeof req.body?.mode === 'string' ? req.body.mode : '';
  if (!UI_VISUAL_MODES.has(mode)) return res.status(400).json({ error: 'Unknown visual mode' });
  db.prepare('UPDATE users SET ui_visual_mode=? WHERE id=?').run(mode, req.user.id);
  const user = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id=?`).get(req.user.id);
  notifyUserUpdated(req.user.id);
  res.json({ user: publicUser(user) });
});

app.patch('/api/user/modal-animation', auth, (req, res) => {
  const hasStyle = Object.prototype.hasOwnProperty.call(req.body || {}, 'style');
  const hasSpeed = Object.prototype.hasOwnProperty.call(req.body || {}, 'speed');
  if (!hasStyle && !hasSpeed) return res.status(400).json({ error: 'No modal animation changes provided' });

  const updates = [];
  const params = [];

  if (hasStyle) {
    const style = typeof req.body?.style === 'string' ? req.body.style : '';
    if (!UI_MODAL_ANIMATIONS.has(style)) return res.status(400).json({ error: 'Unknown modal animation style' });
    updates.push('ui_modal_animation=?');
    params.push(style);
  }

  if (hasSpeed) {
    const rawSpeed = req.body?.speed;
    const speed = Math.round(Number(rawSpeed));
    if (!Number.isFinite(speed) || speed < UI_MODAL_ANIMATION_SPEED_MIN || speed > UI_MODAL_ANIMATION_SPEED_MAX) {
      return res.status(400).json({ error: 'Unknown modal animation speed' });
    }
    updates.push('ui_modal_animation_speed=?');
    params.push(speed);
  }

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id=?`).run(...params, req.user.id);
  const user = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id=?`).get(req.user.id);
  notifyUserUpdated(req.user.id);
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
    notifyUserUpdated(req.user.id);
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
  notifyUserUpdated(req.user.id);
  const user = db.prepare(`SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id=?`).get(req.user.id);
  res.json({ ok: true, user: publicUser(user) });
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
  if (userId === req.user.id && Number(chat.created_by || 0) === Number(req.user.id)) {
    return res.status(403).json({ error: 'Chat creator cannot leave this chat' });
  }
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
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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

  const wasPinned = db.prepare('SELECT 1 FROM message_pins WHERE message_id=?').get(mid);
  let pinEvent = null;
  if (wasPinned) {
    pinEvent = recordPinEvent({
      chatId: m.chat_id,
      messageId: mid,
      action: 'unpinned',
      actor: req.user,
    });
  }

  // Soft-delete message (keep record for reply_to_id foreign keys)
  db.prepare('UPDATE messages SET is_deleted=1, text=NULL, file_id=NULL WHERE id=?').run(mid);
  deleteMentionsStmt.run(mid);
  const removedPins = db.prepare('DELETE FROM message_pins WHERE message_id=?').run(mid);
  // Clean up related file and previews
  if (m.file_id) db.prepare('DELETE FROM files WHERE id=?').run(m.file_id);
  videoNoteStorage.deleteMessageAssets(mid);
  voiceFeature.deleteVoiceMetadata(mid);
  db.prepare('DELETE FROM link_previews WHERE message_id=?').run(mid);
  pollFeature.deletePollData(mid);
  broadcastToChatAll(m.chat_id, { type: 'message_deleted', messageId: mid, chatId: m.chat_id });
  if (removedPins.changes > 0) {
    broadcastPinsUpdated(m.chat_id, { action: 'unpinned', actorId: req.user.id, messageId: mid, pinEvent });
  }
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
let reactionEmojiPattern = null;
const reactionGraphemeSegmenter = (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function')
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

function getReactionEmojiPattern() {
  if (reactionEmojiPattern !== null) return reactionEmojiPattern;
  try {
    reactionEmojiPattern = new RegExp(
      '^(?:' +
        '(?:\\p{Regional_Indicator}{2})|' +
        '(?:[0-9#*]\\uFE0F?\\u20E3)|' +
        '(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\p{Emoji_Modifier})?(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\p{Emoji_Modifier})?)*)' +
      ')$',
      'u'
    );
  } catch {
    reactionEmojiPattern = false;
  }
  return reactionEmojiPattern;
}

function splitReactionGraphemes(value) {
  if (reactionGraphemeSegmenter) {
    return Array.from(reactionGraphemeSegmenter.segment(value), part => part.segment);
  }
  return Array.from(value);
}

function isValidReactionEmoji(value) {
  const emoji = String(value || '').trim();
  if (!emoji || emoji.length > 32) return false;
  const graphemes = splitReactionGraphemes(emoji);
  if (graphemes.length !== 1) return false;
  const pattern = getReactionEmojiPattern();
  if (pattern) return pattern.test(graphemes[0]);
  return /^(?:[\u00A9\u00AE]|[\u203C-\u3299]\uFE0F?|[\uD800-\uDBFF][\uDC00-\uDFFF])$/.test(graphemes[0]);
}

app.post('/api/messages/:id/reactions', auth, (req, res) => {
  const mid = +req.params.id;
  const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji.trim() : '';
  try {
    const result = messageActions.toggleReaction({ actor: req.user, messageId: mid, emoji });
    res.json({ ok: true, reactions: result.reactions });
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ error: error.message });
    if (error.status === 404) return res.status(404).json({ error: error.message });
    res.status(error.status || 400).json({ error: error.message || 'Could not update reaction' });
  }
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

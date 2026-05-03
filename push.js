const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const { normalizeSoundSettings } = require('./soundSettings');

const VAPID_PATH = path.join(__dirname, '.vapid.json');
const DEFAULT_SETTINGS = {
  push_enabled: false,
  notify_messages: true,
  notify_chat_invites: true,
  notify_reactions: true,
  notify_pins: true,
  notify_mentions: true,
};
const TYPE_FLAGS = {
  messages: 'notify_messages',
  chat_invites: 'notify_chat_invites',
  reactions: 'notify_reactions',
  pins: 'notify_pins',
  mentions: 'notify_mentions',
};
const SOUND_TYPE_FLAGS = {
  messages: 'play_notifications',
  chat_invites: 'play_invites',
  reactions: 'play_reactions',
  pins: 'play_pins',
  mentions: 'play_mentions',
};
const MAX_BODY_LENGTH = 120;
const PUSH_LANGUAGES = new Set(['ru', 'en']);
const PUSH_TEXT = {
  ru: {
    voiceMessage: 'Голосовое сообщение',
    photo: 'Фото',
    video: 'Видео',
    audio: 'Аудио',
    file: 'Файл',
    attachment: 'Вложение',
    newMessage: 'Новое сообщение',
    pinnedMessage: 'Закрепленное сообщение',
    newChat: 'Новый чат',
    you: 'Вас',
    user: 'Пользователь',
    someone: 'Кто-то',
    mentioned: '{name} упомянул(а) вас: {preview}',
    addedToChat: '{name} добавили в чат {chat}',
    newReaction: 'Новая реакция',
    reacted: '{name} поставил(а) {emoji} на ваше сообщение',
    pinnedPrivate: 'Закрепил(а) сообщение: {preview}',
    pinnedInChat: '{name} закрепил(а) сообщение: {preview}',
    testWorks: 'Тестовое уведомление работает',
  },
  en: {
    voiceMessage: 'Voice message',
    photo: 'Photo',
    video: 'Video',
    audio: 'Audio',
    file: 'File',
    attachment: 'Attachment',
    newMessage: 'New message',
    pinnedMessage: 'Pinned message',
    newChat: 'New chat',
    you: 'You',
    user: 'User',
    someone: 'Someone',
    mentioned: '{name} mentioned you: {preview}',
    addedToChat: '{name} added you to chat {chat}',
    newReaction: 'New reaction',
    reacted: '{name} reacted {emoji} to your message',
    pinnedPrivate: 'Pinned a message: {preview}',
    pinnedInChat: '{name} pinned a message: {preview}',
    testWorks: 'Test notification works',
  },
};

function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return !!value;
  if (value === '0' || value === '1') return value === '1';
  return fallback;
}

function truncate(text, limit = MAX_BODY_LENGTH) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= limit) return value;
  return value.slice(0, Math.max(0, limit - 1)).trimEnd() + '…';
}

function normalizePushLanguage(language) {
  const next = String(language || '').trim().toLowerCase();
  return PUSH_LANGUAGES.has(next) ? next : 'ru';
}

function pushText(language, key, params = {}) {
  const lang = normalizePushLanguage(language);
  let text = PUSH_TEXT[lang]?.[key] || PUSH_TEXT.ru[key] || key;
  Object.entries(params || {}).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value ?? ''));
  });
  return text;
}

function messagePreviewForLanguage(message, language) {
  const text = message?.text || message?.transcription_text || '';
  if (String(text).trim()) return truncate(text);
  if (message?.is_voice_note) return pushText(language, 'voiceMessage');
  if (message?.file_type === 'image') return pushText(language, 'photo');
  if (message?.file_type === 'video') return pushText(language, 'video');
  if (message?.file_type === 'audio') return pushText(language, 'audio');
  if (message?.file_type === 'document' || message?.file_id) return pushText(language, 'file');
  return pushText(language, 'newMessage');
}

function pinPreviewForLanguage(message, language) {
  const text = String(message?.text || message?.transcription_text || '').trim();
  if (text) return truncate(text, 160);
  if (message?.is_voice_note || message?.voice_message_id) return pushText(language, 'voiceMessage');
  if (message?.file_name) return truncate(message.file_name, 160);
  if (message?.file_type || message?.file_id) return pushText(language, 'attachment');
  return pushText(language, 'pinnedMessage');
}

function readVapidConfig() {
  const envPublic = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPrivate = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const envSubject = String(process.env.VAPID_SUBJECT || 'mailto:admin@localhost').trim();
  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateKey: envPrivate, subject: envSubject };
  }

  try {
    if (fs.existsSync(VAPID_PATH)) {
      const saved = JSON.parse(fs.readFileSync(VAPID_PATH, 'utf8'));
      if (saved.publicKey && saved.privateKey) {
        return {
          publicKey: saved.publicKey,
          privateKey: saved.privateKey,
          subject: saved.subject || envSubject,
        };
      }
    }
  } catch (error) {
    console.warn('[push] Failed to read saved VAPID keys:', error.message);
  }

  try {
    const keys = webpush.generateVAPIDKeys();
    const config = { ...keys, subject: envSubject };
    fs.writeFileSync(VAPID_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
    return config;
  } catch (error) {
    console.warn('[push] Failed to generate VAPID keys:', error.message);
    return null;
  }
}

function normalizeSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    push_enabled: !!row.push_enabled,
    notify_messages: !!row.notify_messages,
    notify_chat_invites: !!row.notify_chat_invites,
    notify_reactions: !!row.notify_reactions,
    notify_pins: row.notify_pins == null ? true : !!row.notify_pins,
    notify_mentions: row.notify_mentions == null ? true : !!row.notify_mentions,
  };
}

function validateSubscription(input) {
  if (!input || typeof input !== 'object') return null;
  const endpoint = String(input.endpoint || '').trim();
  const keys = input.keys || {};
  const p256dh = String(keys.p256dh || '').trim();
  const auth = String(keys.auth || '').trim();
  if (!endpoint || !/^https?:\/\//i.test(endpoint) || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

function subscriptionFromRow(row) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

function createPushFeature({ app, db, auth, rateLimit }) {
  const vapidConfig = readVapidConfig();
  const isConfigured = Boolean(vapidConfig?.publicKey && vapidConfig?.privateKey);
  if (isConfigured) {
    webpush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);
  }

  const pushLimiter = rateLimit
    ? rateLimit({ windowMs: 60_000, max: 90, message: { error: 'Too many push requests' } })
    : (_req, _res, next) => next();

  const settingsStmt = db.prepare('SELECT * FROM user_notification_settings WHERE user_id=?');
  const soundSettingsStmt = db.prepare('SELECT * FROM user_sound_settings WHERE user_id=?');
  const userLanguageStmt = db.prepare('SELECT ui_language FROM users WHERE id=?');
  const activeSubscriptionsStmt = db.prepare(`
    SELECT * FROM push_subscriptions
    WHERE user_id=? AND disabled_at IS NULL
    ORDER BY updated_at DESC
  `);
  const chatStmt = db.prepare('SELECT id, name, type FROM chats WHERE id=?');
  const chatMembersExceptStmt = db.prepare(`
    SELECT cm.user_id
    FROM chat_members cm
    JOIN users u ON u.id=cm.user_id
    WHERE cm.chat_id=? AND cm.user_id!=? AND COALESCE(u.is_ai_bot,0)=0
  `);
  const chatNotificationStmt = db.prepare(`
    SELECT notify_enabled FROM chat_members
    WHERE chat_id=? AND user_id=?
  `);
  const reactionMessageStmt = db.prepare(`
    SELECT m.id, m.chat_id, m.user_id, m.text, f.type as file_type,
      vm.message_id as voice_message_id, vm.transcription_text
    FROM messages m
    LEFT JOIN files f ON f.id=m.file_id
    LEFT JOIN voice_messages vm ON vm.message_id=m.id
    WHERE m.id=? AND m.is_deleted=0
  `);
  const pinMessageStmt = db.prepare(`
    SELECT m.id, m.chat_id, m.user_id, m.text, f.type as file_type,
      f.original_name as file_name, vm.message_id as voice_message_id, vm.transcription_text
    FROM messages m
    LEFT JOIN files f ON f.id=m.file_id
    LEFT JOIN voice_messages vm ON vm.message_id=m.id
    WHERE m.id=? AND m.is_deleted=0
  `);
  const messageMentionsStmt = db.prepare(`
    SELECT mentioned_user_id
    FROM message_mentions
    WHERE message_id=?
  `);

  function getSettings(userId) {
    return normalizeSettings(settingsStmt.get(userId));
  }

  function getUserLanguage(userId) {
    return normalizePushLanguage(userLanguageStmt.get(userId)?.ui_language);
  }

  function saveSettings(userId, input = {}) {
    const current = getSettings(userId);
    const next = {
      push_enabled: boolValue(input.push_enabled, current.push_enabled),
      notify_messages: boolValue(input.notify_messages, current.notify_messages),
      notify_chat_invites: boolValue(input.notify_chat_invites, current.notify_chat_invites),
      notify_reactions: boolValue(input.notify_reactions, current.notify_reactions),
      notify_pins: boolValue(input.notify_pins, current.notify_pins),
      notify_mentions: boolValue(input.notify_mentions, current.notify_mentions),
    };
    db.prepare(`
      INSERT INTO user_notification_settings (
        user_id, push_enabled, notify_messages, notify_chat_invites, notify_reactions, notify_pins, notify_mentions, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        push_enabled=excluded.push_enabled,
        notify_messages=excluded.notify_messages,
        notify_chat_invites=excluded.notify_chat_invites,
        notify_reactions=excluded.notify_reactions,
        notify_pins=excluded.notify_pins,
        notify_mentions=excluded.notify_mentions,
        updated_at=datetime('now')
    `).run(
      userId,
      next.push_enabled ? 1 : 0,
      next.notify_messages ? 1 : 0,
      next.notify_chat_invites ? 1 : 0,
      next.notify_reactions ? 1 : 0,
      next.notify_pins ? 1 : 0,
      next.notify_mentions ? 1 : 0
    );
    return getSettings(userId);
  }

  function saveSubscription(userId, subscription, userAgent) {
    db.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at, last_error, disabled_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL, NULL)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id=excluded.user_id,
        p256dh=excluded.p256dh,
        auth=excluded.auth,
        user_agent=excluded.user_agent,
        updated_at=datetime('now'),
        last_error=NULL,
        disabled_at=NULL
    `).run(userId, subscription.endpoint, subscription.p256dh, subscription.auth, userAgent || null);
  }

  function disableEndpoint(endpoint, reason = 'disabled') {
    db.prepare(`
      UPDATE push_subscriptions
      SET disabled_at=datetime('now'), last_error=?, updated_at=datetime('now')
      WHERE endpoint=?
    `).run(reason, endpoint);
  }

  function isChatNotificationEnabled(userId, chatId) {
    if (!chatId) return true;
    const row = chatNotificationStmt.get(chatId, userId);
    return row ? row.notify_enabled !== 0 : false;
  }

  function getSubscriptionsForType(userId, type, { ignoreSettings = false, chatId = null } = {}) {
    if (!isConfigured) return [];
    if (!ignoreSettings) {
      const settings = getSettings(userId);
      const flag = TYPE_FLAGS[type];
      if (!settings.push_enabled || (flag && !settings[flag])) return [];
      if ((type === 'messages' || type === 'reactions' || type === 'pins') && !isChatNotificationEnabled(userId, chatId)) return [];
    }
    return activeSubscriptionsStmt.all(userId);
  }

  function shouldUseSilentPush(userId, type = '') {
    const settings = normalizeSoundSettings(soundSettingsStmt.get(userId));
    const flag = SOUND_TYPE_FLAGS[type];
    if (!settings.sounds_enabled) return true;
    return flag ? settings[flag] === false : false;
  }

  async function sendToSubscription(row, payload) {
    try {
      await webpush.sendNotification(subscriptionFromRow(row), JSON.stringify(payload), {
        TTL: 60 * 60,
        urgency: payload.urgency || 'normal',
      });
      db.prepare('UPDATE push_subscriptions SET last_error=NULL, updated_at=datetime(\'now\') WHERE id=?').run(row.id);
      return { ok: true };
    } catch (error) {
      const statusCode = error.statusCode || error.status;
      const message = error.body || error.message || `HTTP ${statusCode || 'unknown'}`;
      if (statusCode === 404 || statusCode === 410) {
        disableEndpoint(row.endpoint, message);
      } else {
        db.prepare('UPDATE push_subscriptions SET last_error=?, updated_at=datetime(\'now\') WHERE id=?')
          .run(truncate(message, 300), row.id);
      }
      return { ok: false, error: message };
    }
  }

  async function sendUserNotification(userId, type, payload, options = {}) {
    const subscriptions = getSubscriptionsForType(userId, type, options);
    if (subscriptions.length === 0) return { sent: 0, failed: 0, skipped: true };
    const userPayload = {
      ...payload,
      silent: payload.silent ?? shouldUseSilentPush(userId, type),
    };
    const results = await Promise.all(subscriptions.map(row => sendToSubscription(row, userPayload)));
    return {
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      skipped: false,
    };
  }

  function queueUserNotification(userId, type, payload, options = {}) {
    setImmediate(() => {
      sendUserNotification(userId, type, payload, options).catch((error) => {
        console.warn('[push] send failed:', error.message);
      });
    });
  }

  function messagePreview(message, language) {
    return messagePreviewForLanguage(message, language);
  }

  function pinPreview(message, language) {
    return pinPreviewForLanguage(message, language);
  }

  function notifyMessageCreated(message) {
    if (!message?.chat_id || !message?.user_id) return;
    const chat = chatStmt.get(message.chat_id);
    if (!chat) return;
    const members = chatMembersExceptStmt.all(message.chat_id, message.user_id);
    if (members.length === 0) return;

    const mentionedIds = new Set(
      message.forwarded_from_message_id
        ? []
        : ((Array.isArray(message.mentions) ? message.mentions : messageMentionsStmt.all(message.id))
          .map(row => Number(row.user_id ?? row.mentioned_user_id))
          .filter(id => Number.isInteger(id) && id !== Number(message.user_id)))
    );
    for (const { user_id: userId } of members) {
      const isPrivate = chat.type === 'private';
      const language = getUserLanguage(userId);
      const preview = messagePreview(message, language);
      const senderName = message.display_name || pushText(language, 'user');
      if (mentionedIds.has(Number(userId))) {
        queueUserNotification(userId, 'mentions', {
          type: 'mention',
          chatId: message.chat_id,
          messageId: message.id,
          title: isPrivate ? (message.display_name || 'BananZa') : (chat.name || 'BananZa'),
          body: pushText(language, 'mentioned', { name: senderName, preview }),
          url: `/?chatId=${message.chat_id}`,
          tag: `mention:${message.id}:${userId}`,
          urgency: 'high',
        }, { chatId: message.chat_id });
        continue;
      }
      queueUserNotification(userId, 'messages', {
        type: 'message',
        chatId: message.chat_id,
        messageId: message.id,
        title: isPrivate ? (message.display_name || 'BananZa') : (chat.name || 'BananZa'),
        body: isPrivate ? preview : `${senderName}: ${preview}`,
        url: `/?chatId=${message.chat_id}`,
        tag: `chat:${message.chat_id}`,
      }, { chatId: message.chat_id });
    }
  }

  function notifyChatInvite(userId, { chat, actorName, title, body } = {}) {
    if (!userId || !chat?.id) return;
    const language = getUserLanguage(userId);
    const resolvedActorName = actorName || pushText(language, 'you');
    queueUserNotification(userId, 'chat_invites', {
      type: 'chat_invite',
      chatId: chat.id,
      title: title || pushText(language, 'newChat'),
      body: body || pushText(language, 'addedToChat', { name: resolvedActorName, chat: chat.name || '' }).trim(),
      url: `/?chatId=${chat.id}`,
      tag: `chat-invite:${chat.id}`,
    });
  }

  function notifyReaction({ messageId, emoji, actor }) {
    const message = reactionMessageStmt.get(messageId);
    if (!message || !actor?.id || message.user_id === actor.id) return;
    const language = getUserLanguage(message.user_id);
    const actorName = actor.display_name || actor.username || pushText(language, 'someone');
    queueUserNotification(message.user_id, 'reactions', {
      type: 'reaction',
      chatId: message.chat_id,
      messageId,
      title: pushText(language, 'newReaction'),
      body: pushText(language, 'reacted', { name: actorName, emoji }),
      url: `/?chatId=${message.chat_id}`,
      tag: `reaction:${messageId}:${actor.id}:${emoji}`,
    }, { chatId: message.chat_id });
  }

  function notifyPinCreated({ chatId, messageId, actor } = {}) {
    const actorId = Number(actor?.id || 0);
    const resolvedMessageId = Number(messageId || 0);
    if (!actorId || !resolvedMessageId) return;
    const message = pinMessageStmt.get(resolvedMessageId);
    if (!message) return;
    const resolvedChatId = Number(chatId || message.chat_id || 0);
    if (!resolvedChatId || Number(message.chat_id) !== resolvedChatId) return;
    const chat = chatStmt.get(message.chat_id);
    if (!chat) return;
    const members = chatMembersExceptStmt.all(message.chat_id, actorId);
    if (members.length === 0) return;

    const isPrivate = chat.type === 'private';

    for (const { user_id: userId } of members) {
      const language = getUserLanguage(userId);
      const actorName = actor.display_name || actor.username || pushText(language, 'user');
      const preview = pinPreview(message, language);
      const title = isPrivate ? actorName : (chat.name || 'BananZa');
      const body = isPrivate
        ? pushText(language, 'pinnedPrivate', { preview })
        : pushText(language, 'pinnedInChat', { name: actorName, preview });
      queueUserNotification(userId, 'pins', {
        type: 'pin',
        chatId: message.chat_id,
        messageId: resolvedMessageId,
        title,
        body,
        url: currentChatUrl(message.chat_id),
        tag: `pin:${resolvedMessageId}:${actorId}`,
        urgency: 'high',
      }, { chatId: message.chat_id });
    }
  }

  app.get('/api/notification-settings', auth, (req, res) => {
    const activeCount = activeSubscriptionsStmt.all(req.user.id).length;
    res.json({
      settings: getSettings(req.user.id),
      push_server_ready: isConfigured,
      active_subscriptions: activeCount,
    });
  });

  app.put('/api/notification-settings', auth, (req, res) => {
    res.json({ settings: saveSettings(req.user.id, req.body || {}) });
  });

  app.get('/api/push/vapid-public-key', auth, (_req, res) => {
    if (!isConfigured) return res.status(503).json({ error: 'Push server keys are not configured' });
    res.json({ publicKey: vapidConfig.publicKey });
  });

  app.post('/api/push/subscribe', auth, pushLimiter, (req, res) => {
    if (!isConfigured) return res.status(503).json({ error: 'Push server keys are not configured' });
    const subscription = validateSubscription(req.body?.subscription || req.body);
    if (!subscription) return res.status(400).json({ error: 'Invalid push subscription' });
    saveSubscription(req.user.id, subscription, req.headers['user-agent']);
    const settings = saveSettings(req.user.id, { ...getSettings(req.user.id), push_enabled: true });
    res.json({ ok: true, settings, active_subscriptions: activeSubscriptionsStmt.all(req.user.id).length });
  });

  app.delete('/api/push/subscribe', auth, (req, res) => {
    const endpoint = String(req.body?.endpoint || '').trim();
    if (!endpoint) return res.status(400).json({ error: 'Endpoint is required' });
    db.prepare(`
      UPDATE push_subscriptions
      SET disabled_at=datetime('now'), last_error='unsubscribed', updated_at=datetime('now')
      WHERE user_id=? AND endpoint=?
    `).run(req.user.id, endpoint);
    res.json({ ok: true, active_subscriptions: activeSubscriptionsStmt.all(req.user.id).length });
  });

  app.post('/api/push/test', auth, pushLimiter, async (req, res) => {
    if (!isConfigured) return res.status(503).json({ error: 'Push server keys are not configured' });
    const language = getUserLanguage(req.user.id);
    const result = await sendUserNotification(req.user.id, 'test', {
      type: 'test',
      title: 'BananZa',
      body: pushText(language, 'testWorks'),
      url: currentChatUrl(req.body?.chatId),
      chatId: Number(req.body?.chatId) || null,
      tag: `push-test:${req.user.id}:${Date.now()}`,
      forceShow: true,
      urgency: 'high',
    }, { ignoreSettings: true });
    if (result.sent === 0 && result.failed === 0) {
      return res.status(409).json({ error: 'No active push subscription for this account' });
    }
    res.json({ ok: result.sent > 0, ...result });
  });

  function currentChatUrl(chatId) {
    const id = Number(chatId);
    return Number.isInteger(id) && id > 0 ? `/?chatId=${id}` : '/';
  }

  return {
    getSettings,
    notifyMessageCreated,
    notifyChatInvite,
    notifyReaction,
    notifyPinCreated,
    sendUserNotification,
  };
}

module.exports = {
  createPushFeature,
  normalizePushLanguage,
  pushText,
  messagePreviewForLanguage,
  pinPreviewForLanguage,
};

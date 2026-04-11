const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const VAPID_PATH = path.join(__dirname, '.vapid.json');
const DEFAULT_SETTINGS = {
  push_enabled: false,
  notify_messages: true,
  notify_chat_invites: true,
  notify_reactions: true,
};
const TYPE_FLAGS = {
  messages: 'notify_messages',
  chat_invites: 'notify_chat_invites',
  reactions: 'notify_reactions',
};
const MAX_BODY_LENGTH = 120;

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
  const soundSettingsStmt = db.prepare('SELECT sounds_enabled FROM user_sound_settings WHERE user_id=?');
  const activeSubscriptionsStmt = db.prepare(`
    SELECT * FROM push_subscriptions
    WHERE user_id=? AND disabled_at IS NULL
    ORDER BY updated_at DESC
  `);
  const chatStmt = db.prepare('SELECT id, name, type FROM chats WHERE id=?');
  const chatMembersExceptStmt = db.prepare(`
    SELECT user_id FROM chat_members
    WHERE chat_id=? AND user_id!=?
  `);
  const reactionMessageStmt = db.prepare(`
    SELECT m.id, m.chat_id, m.user_id, m.text, f.type as file_type,
      vm.message_id as voice_message_id, vm.transcription_text
    FROM messages m
    LEFT JOIN files f ON f.id=m.file_id
    LEFT JOIN voice_messages vm ON vm.message_id=m.id
    WHERE m.id=? AND m.is_deleted=0
  `);

  function getSettings(userId) {
    return normalizeSettings(settingsStmt.get(userId));
  }

  function saveSettings(userId, input = {}) {
    const current = getSettings(userId);
    const next = {
      push_enabled: boolValue(input.push_enabled, current.push_enabled),
      notify_messages: boolValue(input.notify_messages, current.notify_messages),
      notify_chat_invites: boolValue(input.notify_chat_invites, current.notify_chat_invites),
      notify_reactions: boolValue(input.notify_reactions, current.notify_reactions),
    };
    db.prepare(`
      INSERT INTO user_notification_settings (
        user_id, push_enabled, notify_messages, notify_chat_invites, notify_reactions, updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        push_enabled=excluded.push_enabled,
        notify_messages=excluded.notify_messages,
        notify_chat_invites=excluded.notify_chat_invites,
        notify_reactions=excluded.notify_reactions,
        updated_at=datetime('now')
    `).run(
      userId,
      next.push_enabled ? 1 : 0,
      next.notify_messages ? 1 : 0,
      next.notify_chat_invites ? 1 : 0,
      next.notify_reactions ? 1 : 0
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

  function getSubscriptionsForType(userId, type, { ignoreSettings = false } = {}) {
    if (!isConfigured) return [];
    if (!ignoreSettings) {
      const settings = getSettings(userId);
      const flag = TYPE_FLAGS[type];
      if (!settings.push_enabled || (flag && !settings[flag])) return [];
    }
    return activeSubscriptionsStmt.all(userId);
  }

  function shouldUseSilentPush(userId) {
    const row = soundSettingsStmt.get(userId);
    return row ? !row.sounds_enabled : false;
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
      silent: payload.silent ?? shouldUseSilentPush(userId),
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

  function messagePreview(message) {
    const text = message?.text || message?.transcription_text || '';
    if (String(text).trim()) return truncate(text);
    if (message?.is_voice_note) return 'Голосовое сообщение';
    if (message?.file_type === 'image') return 'Фото';
    if (message?.file_type === 'video') return 'Видео';
    if (message?.file_type === 'audio') return 'Аудио';
    if (message?.file_type === 'document' || message?.file_id) return 'Файл';
    return 'Новое сообщение';
  }

  function notifyMessageCreated(message) {
    if (!message?.chat_id || !message?.user_id) return;
    const chat = chatStmt.get(message.chat_id);
    if (!chat) return;
    const members = chatMembersExceptStmt.all(message.chat_id, message.user_id);
    if (members.length === 0) return;

    const preview = messagePreview(message);
    for (const { user_id: userId } of members) {
      const isPrivate = chat.type === 'private';
      queueUserNotification(userId, 'messages', {
        type: 'message',
        chatId: message.chat_id,
        messageId: message.id,
        title: isPrivate ? (message.display_name || 'BananZa') : (chat.name || 'BananZa'),
        body: isPrivate ? preview : `${message.display_name || 'User'}: ${preview}`,
        url: `/?chatId=${message.chat_id}`,
        tag: `chat:${message.chat_id}`,
      });
    }
  }

  function notifyChatInvite(userId, { chat, actorName, title, body } = {}) {
    if (!userId || !chat?.id) return;
    queueUserNotification(userId, 'chat_invites', {
      type: 'chat_invite',
      chatId: chat.id,
      title: title || 'Новый чат',
      body: body || `${actorName || 'Вас'} добавили в чат ${chat.name || ''}`.trim(),
      url: `/?chatId=${chat.id}`,
      tag: `chat-invite:${chat.id}`,
    });
  }

  function notifyReaction({ messageId, emoji, actor }) {
    const message = reactionMessageStmt.get(messageId);
    if (!message || !actor?.id || message.user_id === actor.id) return;
    queueUserNotification(message.user_id, 'reactions', {
      type: 'reaction',
      chatId: message.chat_id,
      messageId,
      title: 'Новая реакция',
      body: `${actor.display_name || actor.username || 'Кто-то'} поставил ${emoji} на ваше сообщение`,
      url: `/?chatId=${message.chat_id}`,
      tag: `reaction:${messageId}:${actor.id}:${emoji}`,
    });
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
    const result = await sendUserNotification(req.user.id, 'test', {
      type: 'test',
      title: 'BananZa',
      body: 'Тестовое уведомление работает',
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
    sendUserNotification,
  };
}

module.exports = { createPushFeature };

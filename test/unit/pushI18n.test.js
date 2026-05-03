const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const webpush = require('web-push');

const generatedKeys = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = generatedKeys.publicKey;
process.env.VAPID_PRIVATE_KEY = generatedKeys.privateKey;
process.env.VAPID_SUBJECT = 'mailto:test@example.com';

const {
  createPushFeature,
  messagePreviewForLanguage,
  normalizePushLanguage,
  pushText,
} = require('../../push');

function createAppStub() {
  return {
    get() {},
    put() {},
    post() {},
    delete() {},
  };
}

function createPushDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      is_ai_bot INTEGER DEFAULT 0,
      ui_language TEXT DEFAULT 'ru'
    );
    CREATE TABLE user_notification_settings (
      user_id INTEGER PRIMARY KEY,
      push_enabled INTEGER DEFAULT 0,
      notify_messages INTEGER DEFAULT 1,
      notify_chat_invites INTEGER DEFAULT 1,
      notify_reactions INTEGER DEFAULT 1,
      notify_pins INTEGER DEFAULT 1,
      notify_mentions INTEGER DEFAULT 1,
      updated_at TEXT
    );
    CREATE TABLE user_sound_settings (
      user_id INTEGER PRIMARY KEY,
      sounds_enabled INTEGER DEFAULT 1,
      volume INTEGER DEFAULT 55,
      play_send INTEGER DEFAULT 1,
      play_incoming INTEGER DEFAULT 1,
      play_notifications INTEGER DEFAULT 1,
      play_reactions INTEGER DEFAULT 1,
      play_pins INTEGER DEFAULT 1,
      play_invites INTEGER DEFAULT 1,
      play_voice INTEGER DEFAULT 1,
      play_mentions INTEGER DEFAULT 1,
      updated_at TEXT
    );
    CREATE TABLE push_subscriptions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TEXT,
      updated_at TEXT,
      last_error TEXT,
      disabled_at TEXT
    );
    CREATE TABLE chats (
      id INTEGER PRIMARY KEY,
      name TEXT,
      type TEXT
    );
    CREATE TABLE chat_members (
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      notify_enabled INTEGER DEFAULT 1
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT,
      file_id INTEGER,
      is_deleted INTEGER DEFAULT 0
    );
    CREATE TABLE files (
      id INTEGER PRIMARY KEY,
      type TEXT,
      original_name TEXT
    );
    CREATE TABLE voice_messages (
      message_id INTEGER PRIMARY KEY,
      transcription_text TEXT
    );
    CREATE TABLE message_mentions (
      message_id INTEGER NOT NULL,
      mentioned_user_id INTEGER NOT NULL
    );
  `);
  return db;
}

test('push text helpers localize fallback previews', () => {
  assert.equal(normalizePushLanguage('EN'), 'en');
  assert.equal(normalizePushLanguage('de'), 'ru');
  assert.equal(pushText('ru', 'newMessage'), '\u041d\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435');
  assert.equal(pushText('en', 'newMessage'), 'New message');
  assert.equal(messagePreviewForLanguage({ file_type: 'image' }, 'ru'), '\u0424\u043e\u0442\u043e');
  assert.equal(messagePreviewForLanguage({ file_type: 'image' }, 'en'), 'Photo');
  assert.equal(messagePreviewForLanguage({ text: 'User text' }, 'ru'), 'User text');
});

test('message push payload is localized per recipient and keeps routing ids', async () => {
  const db = createPushDb();
  const captured = [];
  const originalSendNotification = webpush.sendNotification;
  webpush.sendNotification = async (subscription, payload) => {
    captured.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
  };

  try {
    db.exec(`
      INSERT INTO users (id, ui_language) VALUES (1, 'ru'), (2, 'ru'), (3, 'en');
      INSERT INTO chats (id, name, type) VALUES (10, 'Team', 'group');
      INSERT INTO chat_members (chat_id, user_id, notify_enabled)
      VALUES (10, 1, 1), (10, 2, 1), (10, 3, 1);
      INSERT INTO user_notification_settings (
        user_id, push_enabled, notify_messages, notify_chat_invites,
        notify_reactions, notify_pins, notify_mentions
      ) VALUES (2, 1, 1, 1, 1, 1, 1), (3, 1, 1, 1, 1, 1, 1);
      INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, updated_at)
      VALUES
        (1, 2, 'https://push.example/ru', 'key-ru', 'auth-ru', datetime('now'), datetime('now')),
        (2, 3, 'https://push.example/en', 'key-en', 'auth-en', datetime('now'), datetime('now'));
    `);

    const pushFeature = createPushFeature({
      app: createAppStub(),
      db,
      auth: (_req, _res, next) => next(),
      rateLimit: null,
    });

    pushFeature.notifyMessageCreated({
      id: 50,
      chat_id: 10,
      user_id: 1,
      text: '',
      file_type: 'image',
      display_name: 'Alice',
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(captured.length, 2);
    const byEndpoint = Object.fromEntries(captured.map(item => [item.endpoint, item.payload]));
    assert.equal(byEndpoint['https://push.example/ru'].body, 'Alice: \u0424\u043e\u0442\u043e');
    assert.equal(byEndpoint['https://push.example/en'].body, 'Alice: Photo');

    for (const payload of Object.values(byEndpoint)) {
      assert.equal(payload.type, 'message');
      assert.equal(payload.chatId, 10);
      assert.equal(payload.messageId, 50);
      assert.equal(payload.title, 'Team');
      assert.equal(payload.url, '/?chatId=10');
    }
  } finally {
    webpush.sendNotification = originalSendNotification;
    db.close();
  }
});

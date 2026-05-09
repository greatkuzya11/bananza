const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { initCallSchema } = require('../../calls/schema');
const {
  DEFAULT_CALL_SETTINGS,
  getCallSettings,
  setCallSettings,
  normalizeCallSettings,
  getLiveKitConfig,
  getAdminLiveKitConfig,
  setLiveKitConfig,
  getPublicCallSettings,
  liveKitHttpUrl,
} = require('../../calls/settings');

function createDb() {
  const db = new Database(':memory:');
  initCallSchema(db);
  return db;
}

test('call settings default to disabled and normalize incoming values', () => {
  assert.deepEqual(normalizeCallSettings({}), DEFAULT_CALL_SETTINGS);
  assert.deepEqual(normalizeCallSettings({
    calls_enabled: 'true',
    allow_private_calls: '0',
    allow_group_calls: 1,
    ring_timeout_ms: 999999,
    screen_share_enabled: 'false',
    ringtone_enabled: '1',
    call_messages_enabled: 0,
    max_call_participants: 999,
    ignored: true,
  }), {
    calls_enabled: true,
    allow_private_calls: false,
    allow_group_calls: true,
    ring_timeout_ms: 300000,
    screen_share_enabled: false,
    ringtone_enabled: true,
    call_messages_enabled: false,
    max_call_participants: 100,
  });
});

test('call settings persist through app_settings', () => {
  const db = createDb();
  try {
    assert.equal(getCallSettings(db).calls_enabled, false);
    const saved = setCallSettings(db, {
      calls_enabled: true,
      ring_timeout_ms: 45000,
      allow_group_calls: false,
    });
    assert.equal(saved.calls_enabled, true);
    assert.equal(saved.ring_timeout_ms, 45000);
    assert.equal(saved.allow_group_calls, false);
    assert.deepEqual(getCallSettings(db), saved);
  } finally {
    db.close();
  }
});

test('public settings require both admin enablement and LiveKit config', () => {
  const db = createDb();
  try {
    setCallSettings(db, { calls_enabled: true });
    assert.equal(getPublicCallSettings(db, {}).calls_enabled, false);
    assert.equal(getPublicCallSettings(db, {
      LIVEKIT_WS_URL: 'ws://localhost:7880',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'secret',
    }).calls_enabled, true);
  } finally {
    db.close();
  }
});

test('LiveKit config can be stored encrypted in app_settings', () => {
  const db = createDb();
  const secret = 'test-secret';
  try {
    setCallSettings(db, { calls_enabled: true });
    const adminConfig = setLiveKitConfig(db, {
      livekit_ws_url: 'wss://admin.livekit.example',
      livekit_api_key: 'admin-key',
      livekit_api_secret: 'admin-secret',
    }, secret);

    assert.equal(adminConfig.ws_url, 'wss://admin.livekit.example');
    assert.equal(adminConfig.masked_api_key, 'adm...-key');
    assert.equal(adminConfig.masked_api_secret, 'adm...cret');

    const stored = db.prepare('SELECT value FROM app_settings WHERE key=?').get('call_livekit_config');
    assert.ok(stored);
    assert.equal(stored.value.includes('admin-secret'), false);
    assert.equal(stored.value.includes('admin-key'), false);

    const resolved = getLiveKitConfig(db, secret, {});
    assert.equal(resolved.ready, true);
    assert.equal(resolved.wsUrl, 'wss://admin.livekit.example');
    assert.equal(resolved.apiKey, 'admin-key');
    assert.equal(resolved.apiSecret, 'admin-secret');
    assert.equal(getPublicCallSettings(db, secret, {}).calls_enabled, true);
  } finally {
    db.close();
  }
});

test('admin LiveKit config falls back to env without exposing raw secrets', () => {
  const db = createDb();
  try {
    const adminConfig = getAdminLiveKitConfig(db, '', {
      LIVEKIT_WS_URL: 'wss://env.livekit.example',
      LIVEKIT_API_KEY: 'env-key',
      LIVEKIT_API_SECRET: 'env-secret',
    });
    assert.equal(adminConfig.ws_url, '');
    assert.equal(adminConfig.effective_ws_url, 'wss://env.livekit.example');
    assert.equal(adminConfig.source, 'env');
    assert.equal(adminConfig.has_api_key, true);
    assert.equal(adminConfig.has_api_secret, true);
    assert.equal(adminConfig.masked_api_key, 'env-key'.replace('env-key', '*******'));
    assert.equal(adminConfig.masked_api_secret, 'env...cret');
  } finally {
    db.close();
  }
});

test('LiveKit config helpers normalize ws/http URLs', () => {
  assert.deepEqual(getLiveKitConfig({
    LIVEKIT_WS_URL: 'wss://livekit.example',
    LIVEKIT_API_KEY: 'key',
    LIVEKIT_API_SECRET: 'secret',
  }), {
    wsUrl: 'wss://livekit.example',
    apiKey: 'key',
    apiSecret: 'secret',
    wsUrlPresent: true,
    ready: true,
  });
  assert.equal(liveKitHttpUrl('wss://livekit.example'), 'https://livekit.example');
  assert.equal(liveKitHttpUrl('ws://localhost:7880'), 'http://localhost:7880');
});

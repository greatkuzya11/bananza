const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const express = require('express');
const { initIosPushSchema } = require('../../iosPushSchema');
const { createIosPushFeature, validateDevice } = require('../../iosPush');
const { readApnsConfig, providerToken, makeApnsRequest, createApnsTransport } = require('../../apns');

const device = { deviceId: '0191699a-1111-4444-8888-123456789abc', bundleId: 'app.bananza.ios',
  environment: 'production', pushToken: 'a'.repeat(64), voipToken: 'b'.repeat(64), language: 'en' };
function row() { return { device_id: device.deviceId, user_id: 1, bundle_id: device.bundleId,
  environment: device.environment, push_token: device.pushToken, voip_token: device.voipToken }; }

test('APNs configuration validates P-256 and produces a verifiable ES256 JWT', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const config = readApnsConfig({ APNS_TEAM_ID: 'TEAM', APNS_KEY_ID: 'KEY', APNS_BUNDLE_ID: device.bundleId,
    APNS_PRIVATE_KEY_BASE64: Buffer.from(pem).toString('base64') });
  const jwt = providerToken(config, 1770000000000);
  const [header, payload, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), { iss: 'TEAM', iat: 1770000000 });
  assert.equal(crypto.verify('sha256', Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
  assert.equal(readApnsConfig({}), null);
  assert.equal(readApnsConfig({ APNS_TEAM_ID: 'T', APNS_KEY_ID: 'K', APNS_BUNDLE_ID: 'B', APNS_PRIVATE_KEY_BASE64: 'invalid' }), null);
});

test('device registration rejects wrong bundles, malformed tokens and environments', () => {
  assert.ok(validateDevice(device, device.bundleId));
  for (const patch of [{ bundleId: 'other.app' }, { environment: 'dev' }, { pushToken: 'secret' },
    { deviceId: '../../bad' }, { pushToken: '', voipToken: '' }, { voipToken: '../foo' }]) {
    assert.equal(validateDevice({ ...device, ...patch }, device.bundleId), null);
  }
});

test('ordinary pushes cannot use the VoIP topic and preserve routing and silent settings', () => {
  const request = makeApnsRequest(row(), { type: 'mention', chatId: 7, messageId: 19, tag: 'x'.repeat(300), title: 'Title', body: 'Body', silent: true });
  assert.equal(request.headers['apns-push-type'], 'alert');
  assert.equal(request.headers['apns-topic'], device.bundleId);
  assert.equal(request.token, device.pushToken);
  const payload = JSON.parse(request.body);
  assert.equal(payload.chatId, 7); assert.equal(payload.messageId, 19); assert.equal(payload.accountId, 1);
  assert.equal(payload.deviceId, device.deviceId);
  assert.equal(payload.aps.sound, undefined);
  assert.equal(request.headers['apns-collapse-id'].length, 64);
  assert.equal(makeApnsRequest({ ...row(), push_token: null }, { type: 'message' }), null);
});

test('call invites use short-lived VoIP pushes and stable call UUIDs', () => {
  const payload = { type: 'call_invite', callId: 42, chatId: 7, mediaKind: 'voice' };
  const request = makeApnsRequest(row(), payload);
  assert.equal(request.headers['apns-topic'], `${device.bundleId}.voip`);
  assert.equal(request.headers['apns-expiration'], '0');
  assert.equal(request.token, device.voipToken);
  const body = JSON.parse(request.body);
  assert.equal(body.deviceId, device.deviceId);
  assert.equal(body.video, false);
  assert.equal(body.callUUID, JSON.parse(makeApnsRequest(row(), payload).body).callUUID);
  assert.notEqual(body.callUUID, JSON.parse(makeApnsRequest({ ...row(), device_id: 'other-registration' }, payload).body).callUUID);
  assert.notEqual(body.callUUID, JSON.parse(makeApnsRequest(row(), { ...payload, callId: 43 }).body).callUUID);
  assert.equal(makeApnsRequest(row(), { type: 'call_invite', callId: 0 }), null);
  assert.equal(makeApnsRequest({ ...row(), voip_token: null }, payload), null);
});

test('APNs disables bad tokens without exposing keys, and separates sandbox', async () => {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const transport = createApnsTransport({ teamId: 'T', keyId: 'K', bundleId: device.bundleId,
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) }, async request => {
    assert.equal(request.host, 'https://api.sandbox.push.apple.com');
    return { ok: false, status: 410, reason: 'Unregistered' };
  });
  const result = await transport.send({ ...row(), environment: 'sandbox' }, { type: 'message' });
  assert.equal(result.invalid, true); assert.equal(result.tokenColumn, 'push_token');
  assert.equal((await transport.send({ ...row(), bundle_id: 'wrong' }, { type: 'message' })).skipped, true);
});

test('iOS API derives ownership from auth, rebinds tokens and scopes deletion', async () => {
  const db = new Database(':memory:'); db.pragma('foreign_keys=ON');
  db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,is_blocked INTEGER DEFAULT 0); INSERT INTO users(id) VALUES(1),(2)');
  initIosPushSchema(db); initIosPushSchema(db);
  const app = express(); app.use(express.json());
  const deliveries = [];
  const feature = createIosPushFeature({ app, db,
    auth: (req, res, next) => {
      if (!['1','2'].includes(req.headers.authorization)) return res.sendStatus(401);
      req.user = { id: Number(req.headers.authorization) };
      req.authExpiresAt = Math.floor(Date.now() / 1000) + 3600; next();
    },
    transport: { ready: true, bundleId: device.bundleId, send: async entry => { deliveries.push(entry.user_id); return { ok: true }; } },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/push/ios/devices`;
  const request = (user, body, method = 'POST') => fetch(url, { method, headers: { authorization: String(user), 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await request(0, device)).status, 401);
    assert.equal((await request(1, { ...device, userId: 2 })).status, 200);
    await feature.send(1, { type: 'message' }); assert.deepEqual(deliveries, [1]);
    assert.equal((await request(2, { deviceId: device.deviceId }, 'DELETE')).status, 200);
    assert.equal(feature.count(1), 1);
    assert.equal((await request(2, { ...device, deviceId: '0191699a-2222-4444-8888-123456789abc' })).status, 200);
    assert.equal(feature.count(1), 0); assert.equal(feature.count(2), 1);
    db.prepare('UPDATE users SET is_blocked=1 WHERE id=2').run();
    assert.deepEqual(await feature.send(2, { type: 'message' }), []);
    db.prepare('UPDATE users SET is_blocked=0 WHERE id=2').run();
    db.prepare('UPDATE ios_push_devices SET session_expires_at=0').run();
    assert.deepEqual(await feature.send(2, { type: 'message' }), []);
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close(); }
});

test('invalid APNs token removal preserves the other transport token', async () => {
  const db = new Database(':memory:'); db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,is_blocked INTEGER DEFAULT 0); INSERT INTO users(id) VALUES(1)'); initIosPushSchema(db);
  db.prepare(`INSERT INTO ios_push_devices(device_id,user_id,bundle_id,environment,push_token,voip_token,session_expires_at) VALUES(?,1,?,?,?,?,?)`)
    .run(device.deviceId, device.bundleId, 'production', device.pushToken, device.voipToken, Math.floor(Date.now() / 1000) + 3600);
  const feature = createIosPushFeature({ app: { post() {}, delete() {} }, db, auth() {},
    transport: { ready: true, bundleId: device.bundleId, send: async () => ({ ok: false, invalid: true, tokenColumn: 'push_token', token: device.pushToken, reason: 'Unregistered' }) } });
  await feature.send(1, { type: 'message' });
  const saved = db.prepare('SELECT * FROM ios_push_devices').get();
  assert.equal(saved.push_token, null); assert.equal(saved.voip_token, device.voipToken); db.close();
});

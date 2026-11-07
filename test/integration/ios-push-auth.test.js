const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createSandbox } = require('../support/runtimeSandbox');
const { createSession, makeUser } = require('../support/api');

test('iOS registrations use real JWT ownership and expiry and can only be revoked by their owner', async () => {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const sandbox = await createSandbox({ name: 'ios-push-auth', env: {
    APNS_TEAM_ID: 'TESTTEAM01', APNS_KEY_ID: 'TESTKEY001', APNS_BUNDLE_ID: 'app.bananza.ios',
    APNS_PRIVATE_KEY_BASE64: Buffer.from(privateKey.export({ format: 'pem', type: 'pkcs8' })).toString('base64'),
  } });
  let db;
  try {
    const alice = createSession(sandbox.baseUrl), bob = createSession(sandbox.baseUrl);
    await alice.register(makeUser('iosalice')); await bob.register(makeUser('iosbob'));
    db = new Database(path.join(sandbox.appDir, 'bananza.db'));
    const device = { deviceId: crypto.randomUUID(), bundleId: 'app.bananza.ios', environment: 'production',
      pushToken: 'a'.repeat(64), voipToken: 'b'.repeat(64), language: 'en', userId: bob.user.id };
    const route = '/api/push/ios/devices';
    await createSession(sandbox.baseUrl).request(route, { method: 'POST', json: device, expectedStatus: 401 });
    await alice.request(route, { method: 'POST', json: device });
    const row = () => db.prepare('SELECT * FROM ios_push_devices WHERE device_id=?').get(device.deviceId);
    assert.equal(row().user_id, alice.user.id, 'caller-supplied owner must be ignored');
    assert.equal(row().session_expires_at, JSON.parse(Buffer.from(alice.token.split('.')[1], 'base64url')).exp);
    await bob.request(route, { method: 'DELETE', json: { deviceId: device.deviceId } });
    assert.ok(row(), 'another user must not revoke the registration');
    await alice.request(route, { method: 'POST', json: { ...device, bundleId: 'other.app' }, expectedStatus: 400 });
    await alice.request(route, { method: 'DELETE', json: { deviceId: device.deviceId } });
    assert.equal(row(), undefined);
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
  } finally { db?.close(); await sandbox.stop(); }
});

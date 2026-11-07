'use strict';

const { createApnsTransport } = require('./apns');

function validateDevice(input, bundleId) {
  if (!input || typeof input !== 'object') return null;
  if (!/^[a-f0-9-]{36}$/i.test(input.deviceId || '') || input.bundleId !== bundleId) return null;
  if (!['sandbox', 'production'].includes(input.environment)) return null;
  const token = value => typeof value === 'string' && /^[a-f0-9]{64,200}$/i.test(value) ? value.toLowerCase() : null;
  const pushToken = token(input.pushToken), voipToken = token(input.voipToken);
  if ((input.pushToken && !pushToken) || (input.voipToken && !voipToken) || (!pushToken && !voipToken)) return null;
  return { deviceId: input.deviceId.toLowerCase(), bundleId, environment: input.environment, pushToken, voipToken,
    language: input.language === 'en' ? 'en' : 'ru' };
}

function createIosPushFeature({ app, db, auth, rateLimit, transport = createApnsTransport() }) {
  const limiter = rateLimit ? rateLimit({ windowMs: 60000, max: 90 }) : (_req, _res, next) => next();
  const active = db.prepare('SELECT * FROM ios_push_devices WHERE user_id=? AND session_expires_at>?');
  const remove = db.prepare('DELETE FROM ios_push_devices WHERE user_id=? AND device_id=?');
  const save = db.transaction((userId, device, expiresAt) => {
    // APNs tokens identify an installation. Rebinding must stop delivery to the previous account.
    db.prepare(`DELETE FROM ios_push_devices WHERE environment=? AND bundle_id=? AND
      (device_id=? OR (push_token IS NOT NULL AND push_token=?) OR (voip_token IS NOT NULL AND voip_token=?))`)
      .run(device.environment, device.bundleId, device.deviceId, device.pushToken, device.voipToken);
    db.prepare(`INSERT INTO ios_push_devices
      (device_id,user_id,bundle_id,environment,push_token,voip_token,language,session_expires_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(device.deviceId, userId, device.bundleId, device.environment,
      device.pushToken, device.voipToken, device.language, expiresAt);
  });

  app.post('/api/push/ios/devices', auth, limiter, (req, res) => {
    if (!transport.ready) return res.status(503).json({ error: 'APNs is not configured', code: 'apns_unavailable' });
    const device = validateDevice(req.body, transport.bundleId);
    if (!device) return res.status(400).json({ error: 'Invalid iOS push device', code: 'invalid_device' });
    if (!Number.isFinite(req.authExpiresAt) || req.authExpiresAt <= Date.now() / 1000) return res.status(401).json({ error: 'Session expired' });
    save(req.user.id, device, req.authExpiresAt);
    res.json({ ok: true });
  });
  app.delete('/api/push/ios/devices', auth, limiter, (req, res) => {
    const id = String(req.body?.deviceId || '').toLowerCase();
    if (!/^[a-f0-9-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid device ID' });
    remove.run(req.user.id, id);
    res.json({ ok: true });
  });

  async function send(userId, payload) {
    if (!transport.ready) return [];
    const rows = active.all(userId, Math.floor(Date.now() / 1000));
    const results = [];
    // Bounded concurrency, no unbounded HTTP/2 connections for accounts with many devices.
    for (let offset = 0; offset < rows.length; offset += 4) {
      results.push(...await Promise.all(rows.slice(offset, offset + 4).map(async device => {
        let result;
        try { result = await transport.send(device, payload); }
        catch { result = { ok: false, reason: 'TransportError' }; }
        if (result.invalid && ['push_token', 'voip_token'].includes(result.tokenColumn)) {
          db.prepare(`UPDATE ios_push_devices SET ${result.tokenColumn}=NULL,last_error=?
            WHERE device_id=? AND user_id=? AND ${result.tokenColumn}=?`)
            .run(result.reason || 'Unregistered', device.device_id, userId, result.token);
        } else if (!result.skipped) {
          db.prepare('UPDATE ios_push_devices SET last_error=? WHERE device_id=? AND user_id=? AND updated_at=?')
            .run(result.ok ? null : (result.reason || 'DeliveryError'), device.device_id, userId, device.updated_at);
        }
        return result;
      })));
    }
    return results.filter(result => !result.skipped);
  }
  return { send, ready: transport.ready, count: userId => active.all(userId, Math.floor(Date.now() / 1000)).length };
}

module.exports = { createIosPushFeature, validateDevice };

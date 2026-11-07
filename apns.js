'use strict';

const http2 = require('node:http2');
const crypto = require('node:crypto');

function readApnsConfig(env = process.env) {
  const config = {
    teamId: String(env.APNS_TEAM_ID || '').trim(),
    keyId: String(env.APNS_KEY_ID || '').trim(),
    bundleId: String(env.APNS_BUNDLE_ID || '').trim(),
    privateKey: Buffer.from(env.APNS_PRIVATE_KEY_BASE64 || '', 'base64').toString('utf8'),
  };
  if (!config.teamId || !config.keyId || !config.bundleId || !config.privateKey) return null;
  try {
    const key = crypto.createPrivateKey(config.privateKey);
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') return null;
  } catch { return null; }
  return config;
}

function providerToken(config, now = Date.now()) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${encode({ alg: 'ES256', kid: config.keyId })}.${encode({ iss: config.teamId, iat: Math.floor(now / 1000) })}`;
  const signature = crypto.sign('sha256', Buffer.from(input), { key: config.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${input}.${signature.toString('base64url')}`;
}

function makeApnsRequest(device, payload) {
  const voip = payload.type === 'call_invite';
  const token = voip ? device.voip_token : device.push_token;
  if (!token) return null;
  const data = {
    type: payload.type, chatId: payload.chatId || null, messageId: payload.messageId || null,
    callId: payload.callId || null, tag: payload.tag || '', forceShow: !!payload.forceShow,
    // Scope pushes to the signed-in account even during an offline account switch.
    accountId: device.user_id,
  };
  let aps;
  if (voip) {
    if (!Number.isSafeInteger(payload.callId) || payload.callId <= 0) return null;
    // Stable across duplicate deliveries to this device; no unrelated VoIP notifications.
    const bytes = crypto.createHash('sha256').update(`${device.bundle_id}:${device.user_id}:${payload.callId}`).digest().subarray(0, 16);
    bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
    const hex = bytes.toString('hex');
    data.callUUID = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    data.title = String(payload.title || 'BananZa').slice(0, 160);
    data.video = payload.mediaKind !== 'voice';
    aps = { 'content-available': 1 };
  } else {
    aps = { alert: { title: String(payload.title || 'BananZa').slice(0, 160), body: String(payload.body || '').slice(0, 240) }, 'thread-id': `chat:${payload.chatId || 0}` };
    if (!payload.silent) aps.sound = 'default';
  }
  return {
    token, tokenColumn: voip ? 'voip_token' : 'push_token',
    host: device.environment === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com',
    headers: {
      ':method': 'POST', ':path': `/3/device/${token}`,
      'apns-topic': `${device.bundle_id}${voip ? '.voip' : ''}`,
      'apns-push-type': voip ? 'voip' : 'alert', 'apns-priority': '10',
      'apns-expiration': voip ? '0' : String(Math.floor(Date.now() / 1000) + 3600),
      ...(!voip && payload.tag ? { 'apns-collapse-id': crypto.createHash('sha256').update(payload.tag).digest('hex') } : {}),
    },
    body: JSON.stringify({ aps, ...data }),
  };
}

function postApns(request, jwt, connect = http2.connect) {
  return new Promise(resolve => {
    let session, stream, timer, finished = false;
    const finish = result => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      stream?.close(); session?.destroy(); resolve(result);
    };
    try {
      session = connect(request.host);
      session.on('error', () => finish({ ok: false, status: 0, reason: 'TransportError' }));
      timer = setTimeout(() => finish({ ok: false, status: 0, reason: 'Timeout' }), 10000);
      stream = session.request({ ...request.headers, authorization: `bearer ${jwt}` });
      let status = 0, body = '';
      stream.on('response', headers => { status = Number(headers[':status']); });
      stream.on('data', chunk => { if (body.length < 4096) body += chunk.toString(); });
      stream.on('error', () => finish({ ok: false, status: 0, reason: 'TransportError' }));
      stream.on('end', () => {
        let reason = '';
        try { reason = JSON.parse(body).reason || ''; } catch {}
        finish({ ok: status === 200, status, reason: String(reason).slice(0, 100) });
      });
      stream.end(request.body);
    } catch { finish({ ok: false, status: 0, reason: 'TransportError' }); }
  });
}

function createApnsTransport(config = readApnsConfig(), post = postApns) {
  let cachedJwt = '', issuedAt = 0;
  return {
    ready: !!config, bundleId: config?.bundleId,
    async send(device, payload) {
      if (!config || device.bundle_id !== config.bundleId) return { ok: false, skipped: true };
      const request = makeApnsRequest(device, payload);
      if (!request) return { ok: false, skipped: true };
      if (!cachedJwt || Date.now() - issuedAt > 50 * 60 * 1000) {
        cachedJwt = providerToken(config); issuedAt = Date.now();
      }
      let result = await post(request, cachedJwt);
      if (result.status === 429 || result.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = await post(request, cachedJwt);
      }
      return { ...result, token: request.token, tokenColumn: request.tokenColumn,
        invalid: result.status === 410 || ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(result.reason) };
    },
  };
}

module.exports = { readApnsConfig, providerToken, makeApnsRequest, postApns, createApnsTransport };

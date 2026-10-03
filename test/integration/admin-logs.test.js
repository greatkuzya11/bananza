const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const { FileLogger, httpLogging } = require('../../logging');
const { registerAdminLogs } = require('../../adminLogs');
const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario, waitFor } = require('../support/scenario');

async function streamEvents(url, token) {
  const controller = new AbortController();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
  const events = [];
  const done = (async () => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        let index;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const event = /^event: (.+)$/m.exec(frame)?.[1];
          const data = /^data: (.+)$/m.exec(frame)?.[1];
          if (data) events.push({ event, data: JSON.parse(data) });
        }
      }
    } catch (error) { if (!controller.signal.aborted) throw error; }
  })();
  return { response, events, done, close: async () => { controller.abort(); await done; } };
}

test('SSE snapshot/live rotation, download, HTTP status levels and changing access', { timeout: 15000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-logs-api-'));
  const logger = new FileLogger({ directory, maxBytes: 3000 });
  const app = express();
  let isAdmin = true;
  const secret = 'test-only-secret';
  const token = jwt.sign({ id: 1 }, secret);
  const allowed = (req) => { jwt.verify(req.headers.authorization.slice(7), secret); return isAdmin; };
  app.use(httpLogging(logger));
  registerAdminLogs({ app, logger, heartbeatMs: 25, canReadLogs: allowed,
    auth: (req, res, next) => {
      try { jwt.verify(req.headers.authorization.slice(7), secret); req.user = { id: 1 }; next(); }
      catch { res.status(401).end(); }
    }, adminOnly: (_req, res, next) => isAdmin ? next() : res.status(403).end(),
  });
  app.get('/ok/:id', (_req, res) => res.sendStatus(200));
  app.get('/failure', (_req, res) => res.sendStatus(500));
  app.get('/hang', (_req, res) => { res.flushHeaders(); });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const streams = [];
  t.after(async () => {
    await Promise.allSettled(streams.map((stream) => stream.close()));
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    logger.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  logger.write('info', 'test', 'snapshot-marker');
  logger.flushSync();
  const stream = await streamEvents(base + '/api/admin/logs/stream', token);
  streams.push(stream);
  assert.equal(stream.response.headers.get('x-accel-buffering'), 'no');
  await waitFor(() => assert.ok(stream.events.some((e) => e.data.message === 'snapshot-marker')));
  for (let i = 0; i < 100; i++) logger.write('info', 'test', `live-${i}`);
  logger.flushSync();
  await waitFor(() => assert.ok(stream.events.some((e) => e.data.message === 'live-99')));
  const entries = stream.events.filter((e) => e.event === 'entry').map((e) => e.data);
  assert.equal(entries.filter((e) => e.source === 'test').length, 101);
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length);
  await fetch(base + '/ok/123?password=query-secret');
  await fetch(base + '/failure');
  await fetch(base + '/join/invite-secret');
  const hanging = http.get(base + '/hang');
  await once(hanging, 'response');
  hanging.destroy();
  await waitFor(() => assert.ok(stream.events.some((e) => e.data.fields?.aborted)));
  const requests = stream.events.filter((e) => e.data.source === 'http').map((e) => e.data);
  assert.ok(requests.some((e) => e.fields?.path === '/ok/:id' && e.level === 'info'));
  assert.ok(requests.some((e) => e.fields?.status === 500 && e.level === 'error'));
  assert.ok(requests.some((e) => e.fields?.status === 404 && e.level === 'warn'));
  assert.equal(requests.filter((e) => e.fields?.path === '/hang').length, 1);
  assert.doesNotMatch(JSON.stringify(requests), /query-secret|invite-secret/);
  const download = await fetch(base + '/api/admin/logs/download', { headers: { Authorization: `Bearer ${token}` } });
  const downloaded = await download.text();
  assert.equal(Number(download.headers.get('content-length')), Buffer.byteLength(downloaded));
  assert.ok(downloaded.trim().split('\n').every((row) => JSON.parse(row).id));
  isAdmin = false;
  await waitFor(() => assert.ok(stream.events.some((e) => e.event === 'denied')));
  await stream.done;
  await waitFor(() => assert.equal(logger.listenerCount('entry'), 0));
  assert.equal((await fetch(base + '/api/admin/logs/download', { headers: { Authorization: `Bearer ${token}` } })).status, 403);
  isAdmin = true;
  const expiring = jwt.sign({ id: 1, exp: Math.floor(Date.now() / 1000) + 1 }, secret);
  const second = await streamEvents(base + '/api/admin/logs/stream', expiring);
  streams.push(second);
  await waitFor(() => assert.ok(second.events.some((e) => e.event === 'denied')));
  await second.done;
});

test('application admin endpoints write actual requests and deny unauthenticated/non-admin users', { timeout: 30000 }, async (t) => {
  const sandbox = await createSandbox({ name: 'admin-logs' });
  let stream;
  t.after(async () => { try { await stream?.close(); } finally { await sandbox.stop(); } });
  const { admin, bob } = await createBasicChatScenario(sandbox.baseUrl);
  for (const endpoint of ['stream', 'download']) {
    assert.equal((await fetch(`${sandbox.baseUrl}/api/admin/logs/${endpoint}`)).status, 401);
    await bob.request(`/api/admin/logs/${endpoint}`, { expectedStatus: 403 });
  }
  stream = await streamEvents(sandbox.baseUrl + '/api/admin/logs/stream', admin.token);
  const started = Date.now();
  await admin.request('/api/admin/users');
  await waitFor(() => assert.ok(stream.events.some((e) => e.data.fields?.path === '/api/admin/users')), { timeoutMs: 1000, intervalMs: 20 });
  assert.ok(Date.now() - started < 1000);
  const raw = fs.readFileSync(path.join(sandbox.appDir, 'logs', 'bananza.log'), 'utf8');
  assert.match(raw, /\/api\/admin\/users/);
  assert.ok(!raw.includes(admin.token));
  assert.doesNotMatch(raw, /bananza_test_password/);
  await stream.close();
});

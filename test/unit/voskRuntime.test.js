const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const {
  ensureLocalVoskHelper,
  localVoskHelperConfig,
  stopManagedVoskHelper,
} = require('../../voice/voskRuntime');

function reserveFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

test('localVoskHelperConfig accepts only direct loopback HTTP URLs', () => {
  assert.deepEqual(localVoskHelperConfig('http://127.0.0.1:2700/'), {
    helperUrl: 'http://127.0.0.1:2700',
    hostname: '127.0.0.1',
    port: 2700,
  });
  assert.equal(localVoskHelperConfig('https://127.0.0.1:2700'), null);
  assert.equal(localVoskHelperConfig('http://vosk.example.test:2700'), null);
  assert.equal(localVoskHelperConfig('http://127.0.0.1:2700/prefix'), null);
});

test('ensureLocalVoskHelper starts and reuses a managed helper process', { timeout: 10_000 }, async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-vosk-runtime-'));
  const helperPath = path.join(tempDir, 'fake-helper.js');
  fs.writeFileSync(helperPath, `
    const http = require('node:http');
    const args = process.argv.slice(2);
    const host = args[args.indexOf('--host') + 1];
    const port = Number(args[args.indexOf('--port') + 1]);
    http.createServer((req, res) => {
      if (req.url === '/health') {
        const body = JSON.stringify({ ok: true });
        res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
        res.end(body);
        return;
      }
      res.writeHead(404).end();
    }).listen(port, host);
  `);
  t.after(async () => {
    await stopManagedVoskHelper();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const port = await reserveFreePort();
  const helperUrl = `http://127.0.0.1:${port}`;
  const options = {
    helperPath,
    modelsDir: tempDir,
    candidates: [{ command: process.execPath, prefixArgs: [] }],
    timeoutMs: 5000,
  };
  const first = await ensureLocalVoskHelper(helperUrl, options);
  const second = await ensureLocalVoskHelper(helperUrl, options);
  const health = await fetch(`${helperUrl}/health`).then((response) => response.json());

  assert.deepEqual(first, { managed: true, started: true });
  assert.deepEqual(second, { managed: true, started: false });
  assert.equal(health.ok, true);
});

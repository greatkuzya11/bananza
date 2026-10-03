const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PassThrough } = require('node:stream');
const { FileLogger, installLogging, captureHelperStream, redactText, RECORD_LIMIT } = require('../../logging');

function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-logs-'));
  const logger = new FileLogger({ directory, diagnostic: () => {}, ...options });
  t.after(() => { logger.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return logger;
}

test('JSONL preserves Unicode, multiline errors and fields, bounds records, redacts secrets', (t) => {
  const logger = fixture(t);
  const circular = { password: 'password-value', api_key: 'key-value', nested: { Authorization: 'Bearer secret-value' } };
  circular.self = circular;
  logger.write('error', 'voice', 'Привет 🍌\nsecond line Bearer example-bearer', { error: new Error('failure'), ...circular });
  logger.write('info', 'server', '\n🍌'.repeat(40000));
  logger.flushSync();
  const raw = fs.readFileSync(logger.file, 'utf8');
  assert.doesNotMatch(raw, /password-value|key-value|secret-value|example-bearer/);
  const entries = logger.snapshot();
  assert.equal(entries.length, 2);
  assert.match(entries[0].message, /Привет 🍌\nsecond line/);
  assert.match(entries[0].fields.error.stack, /Error: failure/);
  assert.equal(entries[0].fields.self.self, '[Circular]');
  assert.equal(entries[1].truncated, true);
  for (const line of raw.trimEnd().split('\n')) assert.ok(Buffer.byteLength(line + '\n') <= RECORD_LIMIT);
  const text = redactText('https://user:pass@host/join/invite-value?token=query-value https://api.telegram.org/bot123:telegram-value/send sk-abcdefghijklmnop password="with spaces"');
  assert.doesNotMatch(text, /user:pass|invite-value|query-value|telegram-value|abcdefghijklmnop|with spaces/);
  assert.doesNotMatch(redactText('Authorization: Basic basic-secret\nCookie: first=cookie-one; second=cookie-two'), /basic-secret|cookie-one|cookie-two/);
});

test('tail reads only the last 500 complete records and bounds oversized source names', (t) => {
  const logger = fixture(t);
  for (let i = 0; i < 650; i++) logger.write('info', 'test', `entry-${i}`);
  logger.flushSync();
  const records = logger.snapshot();
  assert.equal(records.length, 500);
  assert.equal(records[0].message, 'entry-150');
  assert.equal(records.at(-1).message, 'entry-649');
  logger.write('info', 'x'.repeat(50000), 'bounded-source');
  logger.flushSync();
  assert.equal(logger.snapshot().at(-1).source.length, 80);
});

test('rotation keeps five archives, a stable open download and restart appends', (t) => {
  const logger = fixture(t, { maxBytes: 350 });
  logger.write('info', 'test', 'first');
  logger.flushSync();
  const download = logger.openDownload();
  for (let i = 0; i < 20; i++) { logger.write('info', 'test', 'message-' + i); logger.flushSync(); }
  const buffer = Buffer.alloc(download.size);
  fs.readSync(download.fd, buffer, 0, buffer.length, 0);
  fs.closeSync(download.fd);
  assert.match(buffer.toString(), /first/);
  assert.equal(fs.readdirSync(logger.directory).length, 6);
  assert.match(logger.snapshot().at(-1).message, /message-19/);
  logger.close();
  const reopened = new FileLogger({ directory: logger.directory });
  reopened.write('info', 'test', 'after-restart');
  reopened.flushSync();
  assert.equal(reopened.snapshot().at(-1).message, 'after-restart');
  reopened.close();
});

test('recovery removes an incomplete crash record', (t) => {
  const logger = fixture(t);
  logger.write('info', 'test', 'complete');
  logger.close();
  fs.appendFileSync(logger.file, '{"incomplete":');
  const reopened = new FileLogger({ directory: logger.directory });
  reopened.write('info', 'test', 'recovered');
  reopened.flushSync();
  assert.deepEqual(reopened.snapshot().map((entry) => entry.message), ['complete', 'recovered']);
  reopened.close();
});

test('disk failures retain a bounded queue, announce dropped entries and retry', async (t) => {
  let failing = true;
  const io = Object.create(fs);
  io.writeSync = (...args) => { if (failing) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); return fs.writeSync(...args); };
  const logger = fixture(t, { io, queueLimit: 2048, retryMs: 20 });
  logger.write('info', 'test', 'retry-me');
  logger.flushSync();
  assert.equal(logger.status().error, 'ENOSPC');
  for (let i = 0; i < 100; i++) logger.write('info', 'test', 'x'.repeat(100));
  assert.ok(logger.queuedBytes <= 2048);
  assert.ok(logger.status().dropped > 0);
  failing = false;
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(logger.status().writing, true);
  const records = logger.snapshot();
  assert.ok(records.some((entry) => entry.message === 'retry-me'));
  assert.ok(records.some((entry) => entry.fields?.count === logger.dropped));
});

test('failed partial writes are rolled back before retry', (t) => {
  let writes = 0;
  const io = Object.create(fs);
  io.writeSync = (fd, buffer, offset, length, position) => {
    writes++;
    if (writes === 1) return fs.writeSync(fd, buffer, offset, 10, position);
    if (writes === 2) throw Object.assign(new Error('full'), { code: 'ENOSPC' });
    return fs.writeSync(fd, buffer, offset, length, position);
  };
  const logger = fixture(t, { io });
  logger.write('info', 'test', 'once-only');
  logger.flushSync();
  logger.flushSync();
  assert.equal(logger.snapshot().length, 1);
  assert.equal(logger.snapshot()[0].message, 'once-only');
});

test('console interception keeps terminal output, warnings and helper UTF-8 chunks', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-console-'));
  const original = console.info;
  let terminalCalls = 0;
  console.info = () => terminalCalls++;
  const logger = installLogging({ directory });
  t.after(() => { logger.uninstall(); console.info = original; fs.rmSync(directory, { recursive: true, force: true }); });
  console.info('[ai-bot] hello', { token: 'console-secret' });
  console.error(new Error('console-stack'));
  process.emit('warning', new Error('node-warning'));
  const stream = new PassThrough();
  captureHelperStream(stream, 'vosk', 'info');
  const buffer = Buffer.from('Привет 🍌\ntrailing');
  stream.write(buffer.subarray(0, 3));
  stream.end(buffer.subarray(3));
  await new Promise((resolve) => setImmediate(resolve));
  logger.flushSync();
  const records = logger.snapshot();
  assert.equal(terminalCalls, 1);
  assert.ok(records.some((entry) => entry.source === 'ai-bot'));
  assert.ok(records.some((entry) => entry.message.includes('console-stack')));
  assert.ok(records.some((entry) => entry.source === 'node'));
  assert.ok(records.some((entry) => entry.source === 'vosk' && entry.message === 'Привет 🍌'));
  assert.ok(records.some((entry) => entry.message === 'trailing'));
  assert.doesNotMatch(fs.readFileSync(logger.file, 'utf8'), /console-secret/);
});

test('fatal exceptions and unhandled rejections are recorded without suppressing exit', (t) => {
  const logger = fixture(t);
  logger.close();
  for (const trigger of ['throw new Error("fatal-marker")', 'Promise.reject(new Error("rejection-marker"))']) {
    const code = `require(${JSON.stringify(require.resolve('../../logging'))}).installLogging({directory:${JSON.stringify(logger.directory)}}); ${trigger};`;
    const child = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
    assert.notEqual(child.status, 0);
  }
  const content = fs.readFileSync(logger.file, 'utf8');
  assert.match(content, /fatal-marker/);
  assert.match(content, /rejection-marker/);
});

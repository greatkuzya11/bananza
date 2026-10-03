const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registerAdminLogs, CLIENT_BUFFER_LIMIT } = require('../../adminLogs');

function fixture(t) {
  const logger = new EventEmitter();
  logger.snapshot = () => [{ id: 'old', time: 'now', message: 'persisted' }];
  logger.status = () => ({ writing: true, dropped: 0 });
  const routes = new Map();
  registerAdminLogs({
    app: { get: (url, ...handlers) => routes.set(url, handlers.at(-1)) },
    auth: () => {}, adminOnly: () => {}, canReadLogs: () => true, logger,
  });
  const res = new EventEmitter();
  res.set = () => {};
  res.flushHeaders = () => {};
  res.packets = [];
  res.writableLength = 0;
  res.write = (packet) => { res.packets.push(packet); return true; };
  res.destroy = () => { res.destroyed = true; res.emit('close'); };
  res.end = () => { res.writableEnded = true; res.emit('close'); };
  t.after(() => res.destroy());
  return { res, logger, start: () => routes.get('/api/admin/logs/stream')({}, res) };
}

test('slow log subscribers are disconnected and release all listeners', async (t) => {
  const { res, logger, start } = fixture(t);
  await start();
  assert.equal(logger.listenerCount('entry'), 1);
  res.writableLength = CLIENT_BUFFER_LIMIT;
  logger.emit('entry', { id: 'next', message: 'new record' });
  assert.equal(res.destroyed, true);
  assert.equal(logger.listenerCount('entry'), 0);
  assert.equal(logger.listenerCount('status'), 0);
});

test('initial snapshot waits for drain while buffering committed live records in order', async (t) => {
  const { res, logger, start } = fixture(t);
  const write = res.write;
  res.write = (packet) => { write(packet); return !packet.includes('persisted'); };
  const ready = start();
  logger.emit('entry', { id: 'next', message: 'new record' });
  assert.ok(!res.packets.join('').includes('new record'));
  res.emit('drain');
  await ready;
  const output = res.packets.join('');
  assert.ok(output.indexOf('persisted') < output.indexOf('new record'));
  logger.emit('status', { writing: false, error: 'ENOSPC', dropped: 3 });
  assert.match(res.packets.at(-1), /ENOSPC/);
});

test('disconnect during initial backpressure cancels the pending read', async (t) => {
  const { res, logger, start } = fixture(t);
  res.write = () => false;
  const ready = start();
  res.destroy();
  await ready;
  assert.equal(logger.listenerCount('entry'), 0);
});

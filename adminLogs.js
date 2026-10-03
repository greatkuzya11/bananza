const fs = require('node:fs');
const { once } = require('node:events');

const CLIENT_BUFFER_LIMIT = 1024 * 1024;

function registerAdminLogs({ app, auth, adminOnly, logger, canReadLogs, heartbeatMs = 15000 }) {
  app.get('/api/admin/logs/stream', auth, adminOnly, async (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    const abort = new AbortController();
    let initializing = true;
    let pending = [];
    let pendingBytes = 0;
    let heartbeat;
    const cleanup = () => {
      abort.abort();
      clearInterval(heartbeat);
      logger.off('entry', onEntry);
      logger.off('status', onStatus);
      pending = [];
    };
    const send = (event, data) => {
      if (res.destroyed || res.writableEnded) return false;
      const packet = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      if (res.writableLength + Buffer.byteLength(packet) > CLIENT_BUFFER_LIMIT) {
        res.destroy();
        return false;
      }
      return res.write(packet);
    };
    const onEntry = (entry) => {
      if (initializing) {
        pendingBytes += Buffer.byteLength(JSON.stringify(entry));
        if (pendingBytes > CLIENT_BUFFER_LIMIT) { res.destroy(); return; }
        pending.push(entry);
      } else send('entry', entry);
    };
    const onStatus = (status) => send('status', status);
    res.once('close', cleanup);
    logger.on('entry', onEntry);
    logger.on('status', onStatus);
    heartbeat = setInterval(() => {
      let allowed = false;
      try { allowed = canReadLogs(req); } catch {}
      if (!allowed) {
        send('denied', {});
        cleanup();
        res.end();
        return;
      }
      send('status', logger.status());
    }, heartbeatMs);
    heartbeat.unref?.();
    try {
      // snapshot() and subscribing are synchronous, so a committed entry cannot
      // fall between the initial file snapshot and the live subscription.
      const entries = logger.snapshot(500);
      send('reset', {});
      send('status', logger.status());
      for (const entry of entries) {
        if (abort.signal.aborted) return;
        if (!send('entry', entry)) {
          if (res.destroyed) return;
          await once(res, 'drain', { signal: abort.signal });
        }
      }
      initializing = false;
      for (const entry of pending) send('entry', entry);
      pending = [];
    } catch (error) {
      if (!abort.signal.aborted) {
        send('status', { ...logger.status(), writing: false, error: 'READ_FAILED' });
        res.end();
      }
    }
  });

  app.get('/api/admin/logs/download', auth, adminOnly, (req, res) => {
    let snapshot;
    try { snapshot = logger.openDownload(); }
    catch { return res.status(503).json({ error: 'Log file is unavailable' }); }
    res.set({
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bananza.log"',
      'Content-Length': String(snapshot.size),
      'Cache-Control': 'no-store',
    });
    if (!snapshot.size) {
      fs.closeSync(snapshot.fd);
      return res.end();
    }
    // An open descriptor remains attached to this file across rename/rotation.
    const stream = fs.createReadStream(logger.file, { fd: snapshot.fd, autoClose: true, start: 0, end: snapshot.size - 1 });
    stream.on('error', () => res.destroy());
    res.once('close', () => stream.destroy());
    stream.pipe(res);
  });
}

module.exports = { registerAdminLogs, CLIENT_BUFFER_LIMIT };

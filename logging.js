const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { StringDecoder } = require('node:string_decoder');

const RECORD_LIMIT = 32 * 1024;
const QUEUE_LIMIT = 4 * 1024 * 1024;
const SECRET_KEY = /password|passwd|secret|token|authorization|cookie|api[_-]?key|private[_-]?key/i;

function redactText(value) {
  return String(value)
    .replace(/(\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*:\s*)[^\r\n]*/gi, '$1[REDACTED]')
    .replace(/\bBearer\s+[^\s"'<>]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/\b(?:sk|gsk)[-_][A-Za-z0-9_-]{12,}/g, '[REDACTED]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/(\/bot)\d+:[A-Za-z0-9_-]+/gi, '$1[REDACTED]')
    .replace(/(\/(?:join|chat-invites|document-invites|call-invites)\/)[^/?#\s"']+/gi, '$1[REDACTED]')
    .replace(/([?&](?:[^=&\s]*(?:token|secret|password|key|signature)[^=&\s]*)=)[^&#\s"']*/gi, '$1[REDACTED]')
    .replace(/((?:["']|\b)[\w-]{0,64}(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|authorization|cookie)[\w-]{0,64}["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, '$1[REDACTED]');
}

function sanitize(value, seen = new WeakSet(), depth = 0) {
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'bigint') return String(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  if (depth > 8) return '[Truncated]';
  seen.add(value);
  if (value instanceof Error) return {
    name: redactText(value.name), message: redactText(value.message), stack: redactText(value.stack || ''),
    ...(value.cause ? { cause: sanitize(value.cause, seen, depth + 1) } : {}),
  };
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  const result = Array.isArray(value) ? [] : {};
  for (const key of Object.keys(value).slice(0, 100)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    result[key] = SECRET_KEY.test(key) ? '[REDACTED]'
      : descriptor?.get ? '[Getter]' : sanitize(descriptor?.value, seen, depth + 1);
  }
  return result;
}

function tailEntries(fd, size, count, io = fs) {
  if (!size) return [];
  const chunks = [];
  let offset = size;
  let lines = 0;
  // Bounded even if a damaged file contains no newlines.
  const lower = Math.max(0, size - (count + 1) * RECORD_LIMIT);
  while (offset > lower && lines <= count) {
    const length = Math.min(64 * 1024, offset - lower);
    offset -= length;
    const chunk = Buffer.alloc(length);
    const bytes = io.readSync(fd, chunk, 0, length, offset);
    const part = chunk.subarray(0, bytes);
    for (const byte of part) if (byte === 10) lines++;
    chunks.unshift(part);
  }
  const rows = Buffer.concat(chunks).toString('utf8').split('\n');
  if (offset > 0) rows.shift();
  rows.pop(); // Only complete records.
  return rows.slice(-count).flatMap((line) => {
    try { const entry = JSON.parse(line); return entry?.id && entry?.time ? [entry] : []; }
    catch { return []; }
  });
}

class FileLogger extends EventEmitter {
  constructor({ directory = path.join(__dirname, 'logs'), maxBytes = 50 * 1024 * 1024,
    archives = 5, queueLimit = QUEUE_LIMIT, retryMs = 5000, io = fs,
    diagnostic = (text) => process.stderr.write(text + '\n') } = {}) {
    super();
    Object.assign(this, { directory, maxBytes, archives, queueLimit, retryMs, io, diagnostic });
    this.queueLimit = Math.max(1024, this.queueLimit);
    this.file = path.join(directory, 'bananza.log');
    this.bootId = crypto.randomUUID();
    this.sequence = 0;
    this.queue = [];
    this.queuedBytes = 0;
    this.dropped = 0;
    this.pendingDropped = 0;
    this.fd = null;
    this.size = 0;
    this.errorCode = null;
    this.closed = false;
    try { this.open(); } catch (error) { this.fail(error); }
  }

  status() { return { writing: this.fd !== null && !this.errorCode, error: this.errorCode, dropped: this.dropped }; }

  open() {
    this.io.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    // Windows append-only handles cannot be truncated after a partial write.
    try { this.fd = this.io.openSync(this.file, 'r+'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.fd = this.io.openSync(this.file, 'wx+', 0o600);
    }
    this.size = this.io.fstatSync(this.fd).size;
    if (this.size) {
      const buffer = Buffer.alloc(Math.min(this.size, RECORD_LIMIT));
      this.io.readSync(this.fd, buffer, 0, buffer.length, this.size - buffer.length);
      if (buffer[buffer.length - 1] !== 10) {
        const last = buffer.lastIndexOf(10);
        this.size = last < 0 ? Math.max(0, this.size - buffer.length) : this.size - buffer.length + last + 1;
        this.io.ftruncateSync(this.fd, this.size);
      }
    }
    this.errorCode = null;
  }

  makeRecord(level, source, message, fields) {
    const entry = { id: `${this.bootId}:${++this.sequence}`, time: new Date().toISOString(),
      level: ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info',
      source: redactText(source).slice(0, 80), message: redactText(message) };
    if (fields !== undefined) entry.fields = sanitize(fields);
    let line = JSON.stringify(entry) + '\n';
    if (Buffer.byteLength(line) > RECORD_LIMIT) {
      entry.truncated = true;
      delete entry.fields;
      // Binary search uses serialized bytes, including escaped control characters.
      const original = entry.message;
      let low = 0;
      let high = Math.min(original.length, RECORD_LIMIT);
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        entry.message = original.slice(0, middle) + ' [Truncated]';
        if (Buffer.byteLength(JSON.stringify(entry) + '\n') <= RECORD_LIMIT) low = middle;
        else high = middle - 1;
      }
      entry.message = original.slice(0, low) + ' [Truncated]';
      line = JSON.stringify(entry) + '\n';
    }
    return { entry, buffer: Buffer.from(line) };
  }

  write(level, source, message, fields) {
    if (this.closed) return;
    let record;
    try { record = this.makeRecord(level, source, message, fields); }
    catch { record = this.makeRecord('warn', 'logging', 'Could not serialize log entry'); }
    if (this.queuedBytes + record.buffer.length > this.queueLimit) {
      this.dropped++;
      this.pendingDropped++;
      if (this.pendingDropped === 1) {
        this.diagnostic('[logging] Log queue full; records are being dropped');
        this.emit('status', this.status());
      }
      return;
    }
    this.queue.push(record);
    this.queuedBytes += record.buffer.length;
    this.schedule();
  }

  schedule() {
    if (this.scheduled || this.retryTimer || this.closed) return;
    this.scheduled = setImmediate(() => {
      this.scheduled = null;
      this.flushSync(128);
      if (this.queue.length) this.schedule();
    });
  }

  rotate() {
    this.io.closeSync(this.fd);
    this.fd = null;
    const remove = (file) => { try { this.io.unlinkSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; } };
    // On Windows deleting an open download may reserve its old name until the
    // reader closes. Move it to a unique name before removing that directory entry.
    const retired = `${this.file}.retired-${crypto.randomUUID()}`;
    try { this.io.renameSync(`${this.file}.${this.archives}`, retired); remove(retired); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (let i = this.archives - 1; i >= 1; i--) {
      try { this.io.renameSync(`${this.file}.${i}`, `${this.file}.${i + 1}`); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    this.io.renameSync(this.file, `${this.file}.1`);
    this.open();
  }

  fail(error) {
    if (this.fd !== null) { try { this.io.closeSync(this.fd); } catch {} this.fd = null; }
    const code = String(error?.code || 'WRITE_FAILED');
    if (code !== this.errorCode) this.diagnostic(`[logging] File logging unavailable (${code}); retrying in ${this.retryMs}ms`);
    this.errorCode = code;
    this.emit('status', this.status());
    if (!this.retryTimer && !this.closed) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.flushSync();
      }, this.retryMs);
      this.retryTimer.unref?.();
    }
  }

  flushSync(limit = Infinity) {
    if (this.closed) return;
    try {
      if (this.fd === null) {
        this.open();
        this.emit('status', this.status());
      }
      let processed = 0;
      while (this.queue.length && processed++ < limit) {
        const record = this.queue[0];
        if (this.size && this.size + record.buffer.length > this.maxBytes) this.rotate();
        let offset = 0;
        try {
          while (offset < record.buffer.length) {
            const bytes = this.io.writeSync(this.fd, record.buffer, offset, record.buffer.length - offset, this.size + offset);
            if (!bytes) throw new Error('Zero-byte log write');
            offset += bytes;
          }
        } catch (error) {
          try { this.io.ftruncateSync(this.fd, this.size); } catch {}
          throw error;
        }
        this.size += record.buffer.length;
        this.queue.shift();
        this.queuedBytes -= record.buffer.length;
        this.emit('entry', record.entry);
      }
      if (this.pendingDropped && this.queuedBytes < this.queueLimit / 2) {
        const count = this.pendingDropped;
        this.pendingDropped = 0;
        this.write('warn', 'logging', 'Log records dropped because the queue was full', { count });
        if (limit === Infinity) this.flushSync();
      }
    } catch (error) { this.fail(error); }
    if (this.queue.length && !this.retryTimer) this.schedule();
  }

  snapshot(count = 500) {
    if (this.fd === null) return [];
    return tailEntries(this.fd, this.size, count, this.io);
  }

  openDownload() {
    const fd = this.io.openSync(this.file, 'r');
    try { return { fd, size: this.io.fstatSync(fd).size }; }
    catch (error) { this.io.closeSync(fd); throw error; }
  }

  close() {
    this.flushSync();
    this.closed = true;
    clearImmediate(this.scheduled);
    clearTimeout(this.retryTimer);
    if (this.fd !== null) this.io.closeSync(this.fd);
    this.fd = null;
  }
}

let installed = null;
function installLogging(options = {}) {
  if (installed) return installed;
  const original = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map((key) => [key, console[key]]));
  const logger = new FileLogger({ ...options, diagnostic: (text) => original.error.call(console, text) });
  installed = logger;
  for (const key of Object.keys(original)) {
    console[key] = (...args) => {
      try {
        const safe = args.map((arg) => typeof arg === 'object' && arg !== null ? sanitize(arg) : redactText(String(arg)));
        const message = util.formatWithOptions({ depth: 6, maxArrayLength: 100, maxStringLength: RECORD_LIMIT }, ...safe);
        const source = /^\[([\w-]+)\]/.exec(message)?.[1] || 'server';
        logger.write(key === 'log' ? 'info' : key, source, message);
      } catch { logger.write('warn', 'logging', 'Could not format console entry'); }
      original[key].apply(console, args);
    };
  }
  const warning = (error) => logger.write('warn', 'node', error.stack || error.message);
  // Monitoring preserves Node's default crash/unhandled-rejection behavior.
  const fatal = (error, origin) => { logger.write('error', 'node', error.stack || String(error), { origin }); logger.flushSync(); };
  const exit = () => logger.close();
  process.on('warning', warning);
  process.on('uncaughtExceptionMonitor', fatal);
  process.on('exit', exit);
  logger.uninstall = () => {
    for (const key of Object.keys(original)) console[key] = original[key];
    process.off('warning', warning);
    process.off('uncaughtExceptionMonitor', fatal);
    process.off('exit', exit);
    logger.close();
    installed = null;
  };
  return logger;
}

function captureHelperStream(stream, source, level) {
  if (!stream) return;
  const decoder = new StringDecoder('utf8');
  let pending = '';
  const consume = (text) => {
    pending += text;
    let newline;
    while ((newline = pending.indexOf('\n')) >= 0) {
      installed?.write(level, source, pending.slice(0, newline).replace(/\r$/, ''));
      pending = pending.slice(newline + 1);
    }
    if (pending.length > RECORD_LIMIT) {
      installed?.write(level, source, pending);
      pending = '';
    }
  };
  stream.on('data', (chunk) => consume(decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))));
  stream.once('end', () => { consume(decoder.end()); if (pending) installed?.write(level, source, pending); pending = ''; });
}

function httpLogging(logger) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    let recorded = false;
    const finish = () => {
      if (recorded) return;
      recorded = true;
      const aborted = !res.writableFinished;
      const status = aborted ? 499 : res.statusCode;
      let pathname = String(req.originalUrl || req.url || '').split(/[?#]/)[0];
      try { pathname = decodeURIComponent(pathname); } catch {}
      if (typeof req.route?.path === 'string') pathname = req.baseUrl + req.route.path;
      logger.write(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', 'http',
        `${req.method} ${redactText(pathname)} ${status}`, {
          method: req.method, path: redactText(pathname), status,
          duration_ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
          user_id: req.user?.id || null, aborted,
        });
    };
    res.once('finish', finish);
    res.once('close', finish);
    next();
  };
}

module.exports = { FileLogger, installLogging, captureHelperStream, httpLogging, redactText, sanitize, RECORD_LIMIT, QUEUE_LIMIT };

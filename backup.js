const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const multer = require('multer');
const tar = require('tar');
const tarStream = require('tar-stream');
const { pipeline } = require('stream/promises');
const packageJson = require('./package.json');

const BACKUP_FORMAT_VERSION = 1;
const RESTORE_CONFIRM_TEXT = 'RESTORE';
const RESTORE_SESSION_TTL_MS = 30 * 60 * 1000;
const DEFAULT_RESTORE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
const RECOVERY_ADMIN_COLOR = '#65aadd';
const PENDING_RESTORE_DIRNAME = 'restore-pending';
const PENDING_RESTORE_MANIFEST = 'restore-pending.json';
const DEFAULT_EXCLUDED = [
  '.env',
  '.env.local',
  'node_modules/',
  '.git/',
  'bananza.db-wal',
  'bananza.db-shm',
];
const RESTORE_ALLOWED_TOP_LEVEL = new Set([
  'bananza.db',
  'uploads',
  '.secret',
  '.vapid.json',
  'backup-manifest.json',
]);
const RESTORE_FORBIDDEN_TOP_LEVEL = new Set([
  '.env',
  '.env.local',
  '.git',
  'node_modules',
  'bananza.db-wal',
  'bananza.db-shm',
]);
const RESTORE_REQUIRED_TABLES = ['users', 'chats', 'chat_members', 'messages', 'files'];
const RESTORE_REQUIRED_USER_COLUMNS = [
  'username',
  'password',
  'display_name',
  'is_admin',
  'is_blocked',
  'avatar_color',
];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function backupTimestamp(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hour = pad2(date.getUTCHours());
  const minute = pad2(date.getUTCMinutes());
  const second = pad2(date.getUTCSeconds());
  return `${year}-${month}-${day}-${hour}${minute}${second}`;
}

async function exists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleepSync(ms) {
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
}

function createRestoreError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseRestoreLimitBytes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RESTORE_LIMIT_BYTES;
  return Math.floor(parsed);
}

function createRestoreId() {
  return crypto.randomBytes(16).toString('hex');
}

function normalizeRestoreId(value) {
  const restoreId = String(value || '').trim();
  return /^[a-f0-9]{32}$/i.test(restoreId) ? restoreId.toLowerCase() : '';
}

function normalizeArchiveEntryPath(entryPath) {
  const raw = String(entryPath || '').replace(/\0/g, '');
  if (!raw) return '';
  if (path.win32.isAbsolute(raw) || path.posix.isAbsolute(raw.replace(/\\/g, '/'))) {
    throw createRestoreError('Invalid archive path');
  }
  let normalized = raw.replace(/\\/g, '/').replace(/^\.\/+/, '');
  normalized = normalized.replace(/\/+/g, '/');
  if (!normalized || normalized === '.') return '';
  if (normalized.split('/').includes('..')) {
    throw createRestoreError('Invalid archive path');
  }
  return normalized.replace(/\/+$/, '');
}

function validateArchiveEntryPath(entryPath, entryType = 'File') {
  const normalized = normalizeArchiveEntryPath(entryPath);
  if (!normalized) return normalized;

  const type = String(entryType || 'File');
  if (type === 'SymbolicLink' || type === 'Link') {
    throw createRestoreError('Archive links are not allowed');
  }
  if (!['File', 'OldFile', 'ContiguousFile', 'Directory'].includes(type)) {
    throw createRestoreError('Unsupported archive entry type');
  }

  const topLevel = normalized.split('/')[0];
  if (RESTORE_FORBIDDEN_TOP_LEVEL.has(topLevel)) {
    throw createRestoreError('Archive contains excluded files');
  }
  if (!RESTORE_ALLOWED_TOP_LEVEL.has(topLevel)) {
    throw createRestoreError('Archive contains unexpected files');
  }
  if (normalized !== topLevel && topLevel !== 'uploads') {
    throw createRestoreError('Archive contains unexpected nested files');
  }
  return normalized;
}

async function copyIfExists(sourcePath, targetPath) {
  if (!(await exists(sourcePath))) return false;
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.copyFile(sourcePath, targetPath);
  return true;
}

async function rmWithBusyRetry(targetPath, {
  recursive = false,
  force = true,
  retries = 20,
  delayMs = 100,
} = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await fsp.rm(targetPath, { recursive, force });
      return;
    } catch (error) {
      const busy = error?.code === 'EBUSY' || error?.code === 'EPERM' || error?.code === 'ENOTEMPTY';
      if (!busy || attempt >= retries) throw error;
      await sleep(delayMs * (attempt + 1));
    }
  }
}

async function copyFileWithBusyRetry(sourcePath, targetPath, {
  retries = 20,
  delayMs = 100,
} = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await fsp.copyFile(sourcePath, targetPath);
      return;
    } catch (error) {
      const busy = error?.code === 'EBUSY' || error?.code === 'EPERM';
      if (!busy || attempt >= retries) throw error;
      await sleep(delayMs * (attempt + 1));
    }
  }
}

function rmSyncWithBusyRetry(targetPath, {
  recursive = false,
  force = true,
  retries = 20,
  delayMs = 100,
} = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive, force });
      return;
    } catch (error) {
      const busy = error?.code === 'EBUSY' || error?.code === 'EPERM' || error?.code === 'ENOTEMPTY';
      if (!busy || attempt >= retries) throw error;
      sleepSync(delayMs * (attempt + 1));
    }
  }
}

function copyFileSyncWithBusyRetry(sourcePath, targetPath, {
  retries = 20,
  delayMs = 100,
} = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      fs.copyFileSync(sourcePath, targetPath);
      return;
    } catch (error) {
      const busy = error?.code === 'EBUSY' || error?.code === 'EPERM';
      if (!busy || attempt >= retries) throw error;
      sleepSync(delayMs * (attempt + 1));
    }
  }
}

function copyDirectorySyncSkippingSymlinks(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    return;
  }
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true,
    errorOnExist: false,
    verbatimSymlinks: false,
    filter: (sourcePath) => {
      try {
        return !fs.lstatSync(sourcePath).isSymbolicLink();
      } catch {
        return false;
      }
    },
  });
}

function pendingRestoreRoot(rootDir = __dirname) {
  return path.join(rootDir, PENDING_RESTORE_DIRNAME);
}

async function collectDirectoryStats(dirPath) {
  const totals = { files: 0, bytes: 0 };
  if (!(await exists(dirPath))) return totals;

  async function walk(currentPath) {
    const entries = await fsp.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const stats = await fsp.stat(absolutePath);
      totals.files += 1;
      totals.bytes += stats.size;
    }
  }

  await walk(dirPath);
  return totals;
}

function buildBackupManifest({
  createdAt = new Date(),
  included = {},
  excluded = DEFAULT_EXCLUDED,
  uploads = { files: 0, bytes: 0 },
  mode = 'file',
  app = packageJson,
} = {}) {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const archiveMode = mode === 'stream' ? 'stream' : 'file';
  return {
    format_version: BACKUP_FORMAT_VERSION,
    created_at: created.toISOString(),
    archive: {
      mode: archiveMode,
    },
    app: {
      name: app.name || 'bananza',
      version: app.version || '0.0.0',
    },
    included: {
      database: included.database || 'bananza.db',
      uploads: included.uploads || 'uploads/',
      secrets: Array.isArray(included.secrets) ? included.secrets : [],
      manifest: 'backup-manifest.json',
    },
    excluded: [...excluded],
    uploads,
    notes: [
      '.env is not included. Keep deployment environment variables separately.',
      'This archive contains chat history, uploaded files, and server secrets.',
    ],
  };
}

async function copyUploads(sourceDir, targetDir) {
  if (!(await exists(sourceDir))) {
    await fsp.mkdir(targetDir, { recursive: true });
    return;
  }
  await fsp.cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
    errorOnExist: false,
    verbatimSymlinks: false,
    filter: async (sourcePath) => {
      const stats = await fsp.lstat(sourcePath);
      return !stats.isSymbolicLink();
    },
  });
}

function createBackupStreamAbortError() {
  const error = new Error('Backup stream aborted');
  error.code = 'BACKUP_STREAM_ABORTED';
  return error;
}

function assertBackupStreamNotAborted(signal) {
  if (!signal?.aborted) return;
  throw signal.reason || createBackupStreamAbortError();
}

function normalizeBackupArchivePath(entryPath) {
  const raw = String(entryPath || '').replace(/\0/g, '').replace(/\\/g, '/');
  if (!raw || path.posix.isAbsolute(raw) || path.win32.isAbsolute(raw)) {
    throw new Error('Unsafe backup archive path');
  }
  const normalized = raw.replace(/^\.\/+/, '').replace(/\/+/g, '/').replace(/\/+$/, '');
  if (!normalized || normalized.split('/').includes('..')) {
    throw new Error('Unsafe backup archive path');
  }
  return normalized;
}

function backupUploadArchivePath(uploadsDir, absolutePath) {
  const relative = path.relative(uploadsDir, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Unsafe upload backup path');
  }
  return normalizeBackupArchivePath(path.posix.join('uploads', relative.replace(/\\/g, '/')));
}

function entryMode(stats, fallback = 0o600) {
  const mode = Number(stats?.mode) & 0o777;
  return mode || fallback;
}

async function collectSecretEntries(rootDir) {
  const secrets = [];
  for (const name of ['.secret', '.vapid.json']) {
    const sourcePath = path.join(rootDir, name);
    try {
      const stats = await fsp.lstat(sourcePath);
      if (stats.isFile()) secrets.push(name);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return secrets;
}

function addTarDirectoryEntry(pack, name, { signal } = {}) {
  assertBackupStreamNotAborted(signal);
  const entryName = normalizeBackupArchivePath(name);
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.('abort', onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => done(signal.reason || createBackupStreamAbortError());
    signal?.addEventListener?.('abort', onAbort, { once: true });
    try {
      pack.entry({
        name: entryName,
        type: 'directory',
        size: 0,
        mode: 0o755,
        mtime: new Date(0),
      }, Buffer.alloc(0), done);
    } catch (error) {
      done(error);
    }
  });
}

function addTarBufferEntry(pack, name, buffer, { signal, mode = 0o600 } = {}) {
  assertBackupStreamNotAborted(signal);
  const entryName = normalizeBackupArchivePath(name);
  const content = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer || ''));
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.('abort', onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => done(signal.reason || createBackupStreamAbortError());
    signal?.addEventListener?.('abort', onAbort, { once: true });
    try {
      pack.entry({
        name: entryName,
        size: content.length,
        mode,
        mtime: new Date(0),
      }, content, done);
    } catch (error) {
      done(error);
    }
  });
}

async function addTarFileEntry(pack, sourcePath, name, { signal, stats = null, mode = null } = {}) {
  assertBackupStreamNotAborted(signal);
  const fileStats = stats || await fsp.lstat(sourcePath);
  if (fileStats.isSymbolicLink() || !fileStats.isFile()) return false;
  const entryName = normalizeBackupArchivePath(name);
  await new Promise((resolve, reject) => {
    let settled = false;
    const readStream = fs.createReadStream(sourcePath);
    let entryStream = null;
    const done = (error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener?.('abort', onAbort);
      readStream.removeListener('error', done);
      entryStream?.removeListener?.('error', done);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => {
      const error = signal.reason || createBackupStreamAbortError();
      readStream.destroy(error);
      entryStream?.destroy?.(error);
      done(error);
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });
    readStream.once('error', done);
    try {
      entryStream = pack.entry({
        name: entryName,
        size: fileStats.size,
        mode: mode || entryMode(fileStats),
        mtime: new Date(0),
      }, done);
      if (!entryStream || typeof entryStream.write !== 'function') {
        done(new Error('Could not create tar entry stream'));
        return;
      }
      entryStream.once?.('error', done);
      readStream.pipe(entryStream);
    } catch (error) {
      done(error);
    }
  });
  return true;
}

async function* walkUploadArchiveFiles(uploadsDir, signal) {
  if (!(await exists(uploadsDir))) return;

  async function* walk(currentPath) {
    assertBackupStreamNotAborted(signal);
    const entries = await fsp.readdir(currentPath, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      assertBackupStreamNotAborted(signal);
      const absolutePath = path.join(currentPath, entry.name);
      let stats = null;
      try {
        stats = await fsp.lstat(absolutePath);
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      if (stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) {
        yield* walk(absolutePath);
        continue;
      }
      if (!stats.isFile()) continue;
      yield {
        absolutePath,
        archivePath: backupUploadArchivePath(uploadsDir, absolutePath),
        stats,
      };
    }
  }

  yield* walk(uploadsDir);
}

async function validateBackupArchiveEntries(archivePath) {
  const entries = [];
  await tar.list({
    file: archivePath,
    onentry: (entry) => {
      const normalized = validateArchiveEntryPath(entry.path, entry.type);
      if (normalized) {
        entries.push({
          path: normalized,
          type: entry.type,
          size: Number(entry.size) || 0,
        });
      }
    },
  });

  const paths = new Set(entries.map((entry) => entry.path));
  if (!paths.has('bananza.db')) {
    throw createRestoreError('Backup archive is missing bananza.db');
  }
  if (!paths.has('backup-manifest.json')) {
    throw createRestoreError('Backup archive is missing backup-manifest.json');
  }
  return entries;
}

async function extractBackupArchive(archivePath, extractDir) {
  const entries = await validateBackupArchiveEntries(archivePath);
  await fsp.mkdir(extractDir, { recursive: true });
  await tar.extract({
    file: archivePath,
    cwd: extractDir,
    preservePaths: false,
    unlink: true,
    filter: (entryPath, entry) => {
      validateArchiveEntryPath(entryPath, entry?.type || 'File');
      return true;
    },
  });
  return entries;
}

async function readBackupManifest(extractDir) {
  const manifestPath = path.join(extractDir, 'backup-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  } catch {
    throw createRestoreError('Backup manifest is invalid');
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw createRestoreError('Backup manifest is invalid');
  }
  if (Number(manifest.format_version) !== BACKUP_FORMAT_VERSION) {
    throw createRestoreError('Unsupported backup format version');
  }
  if (manifest.included?.database !== 'bananza.db') {
    throw createRestoreError('Backup manifest database entry is invalid');
  }
  return manifest;
}

function inspectRestoreDatabase(dbPath) {
  const restoreDb = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const integrity = restoreDb.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      throw createRestoreError('Backup database failed integrity check');
    }

    const placeholders = RESTORE_REQUIRED_TABLES.map(() => '?').join(',');
    const rows = restoreDb.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`
    ).all(...RESTORE_REQUIRED_TABLES);
    const tables = new Set(rows.map((row) => row.name));
    for (const table of RESTORE_REQUIRED_TABLES) {
      if (!tables.has(table)) {
        throw createRestoreError(`Backup database is missing table: ${table}`);
      }
    }

    const userColumns = new Set(restoreDb.pragma('table_info(users)').map((column) => column.name));
    for (const column of RESTORE_REQUIRED_USER_COLUMNS) {
      if (!userColumns.has(column)) {
        throw createRestoreError(`Backup database is missing users.${column}`);
      }
    }

    return {
      users: restoreDb.prepare('SELECT COUNT(*) AS count FROM users').get().count,
      admins: restoreDb.prepare('SELECT COUNT(*) AS count FROM users WHERE is_admin=1').get().count,
      chats: restoreDb.prepare('SELECT COUNT(*) AS count FROM chats').get().count,
      messages: restoreDb.prepare('SELECT COUNT(*) AS count FROM messages').get().count,
      files: restoreDb.prepare('SELECT COUNT(*) AS count FROM files').get().count,
    };
  } finally {
    restoreDb.close();
  }
}

async function createRestorePreview({
  archivePath,
  tempDir = os.tmpdir(),
  restoreId = createRestoreId(),
} = {}) {
  if (!archivePath) throw new TypeError('createRestorePreview requires archivePath');

  const sessionRoot = await fsp.mkdtemp(path.join(tempDir, 'bananza-restore-'));
  const extractDir = path.join(sessionRoot, 'workspace');
  try {
    await extractBackupArchive(archivePath, extractDir);
    const manifest = await readBackupManifest(extractDir);
    const database = inspectRestoreDatabase(path.join(extractDir, 'bananza.db'));
    const uploadsPath = path.join(extractDir, 'uploads');
    const hasUploads = await exists(uploadsPath);
    const uploads = await collectDirectoryStats(uploadsPath);
    const includes = {
      database: true,
      uploads: hasUploads,
      secret: await exists(path.join(extractDir, '.secret')),
      vapid: await exists(path.join(extractDir, '.vapid.json')),
    };
    const warnings = [];
    if (!includes.uploads) warnings.push('Backup archive does not include uploads/. An empty uploads folder will be restored.');
    if (!includes.secret) warnings.push('Backup archive does not include .secret. Current JWT secret will be kept.');
    if (!includes.vapid) warnings.push('Backup archive does not include .vapid.json. Current push keys will be kept.');
    if (!Array.isArray(manifest.excluded) || !manifest.excluded.includes('.env')) {
      warnings.push('.env is not included by restore. Keep deployment environment variables separately.');
    }

    return {
      restoreId,
      sessionRoot,
      extractDir,
      createdAt: Date.now(),
      preview: {
        restore_id: restoreId,
        manifest,
        database,
        uploads,
        includes,
        warnings,
      },
    };
  } catch (error) {
    await fsp.rm(sessionRoot, { recursive: true, force: true });
    throw error;
  }
}

function normalizeRecoveryAdmin(input = {}) {
  const username = String(input.username || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (username.length < 3 || username.length > 20) {
    throw createRestoreError('Username: 3-20 characters');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw createRestoreError('Username: letters, numbers, underscores only');
  }
  if (password.length < 6 || password.length > 100) {
    throw createRestoreError('Password: 6-100 characters');
  }
  return {
    username,
    password,
    displayName: username,
  };
}

async function patchRecoveryAdmin({ dbPath, recoveryAdmin } = {}) {
  if (!dbPath) throw new TypeError('patchRecoveryAdmin requires dbPath');
  const normalized = normalizeRecoveryAdmin(recoveryAdmin);
  const passwordHash = await bcrypt.hash(normalized.password, 10);
  const restoreDb = new Database(dbPath, { fileMustExist: true });
  try {
    restoreDb.pragma('foreign_keys = ON');
    const userColumns = new Set(restoreDb.pragma('table_info(users)').map((column) => column.name));
    const existing = restoreDb
      .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
      .get(normalized.username);

    if (existing) {
      const updates = [
        'username = ?',
        'password = ?',
        'display_name = ?',
        'is_admin = 1',
        'is_blocked = 0',
      ];
      const values = [normalized.username, passwordHash, normalized.displayName];
      if (userColumns.has('is_ai_bot')) updates.push('is_ai_bot = 0');
      restoreDb.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values, existing.id);
      return {
        username: normalized.username,
        user_id: existing.id,
        created: false,
      };
    }

    const columns = ['username', 'password', 'display_name', 'is_admin', 'is_blocked', 'avatar_color'];
    const values = [normalized.username, passwordHash, normalized.displayName, 1, 0, RECOVERY_ADMIN_COLOR];
    if (userColumns.has('is_ai_bot')) {
      columns.push('is_ai_bot');
      values.push(0);
    }
    if (userColumns.has('ui_language')) {
      columns.push('ui_language');
      values.push('ru');
    }

    const placeholders = columns.map(() => '?').join(',');
    const result = restoreDb
      .prepare(`INSERT INTO users(${columns.join(',')}) VALUES(${placeholders})`)
      .run(...values);
    return {
      username: normalized.username,
      user_id: Number(result.lastInsertRowid),
      created: true,
    };
  } finally {
    restoreDb.close();
  }
}

async function createRestoreRollback({
  db,
  rootDir = __dirname,
  uploadsDir = path.join(rootDir, 'uploads'),
  now = new Date(),
} = {}) {
  if (!db || typeof db.backup !== 'function') {
    throw new TypeError('createRestoreRollback requires a better-sqlite3 database');
  }
  const rollbackDir = path.join(
    rootDir,
    'restore-rollbacks',
    `restore-${backupTimestamp(now)}-${crypto.randomBytes(4).toString('hex')}`
  );
  await fsp.mkdir(rollbackDir, { recursive: true });
  await db.backup(path.join(rollbackDir, 'bananza.db'));
  await copyUploads(uploadsDir, path.join(rollbackDir, 'uploads'));
  await copyIfExists(path.join(rootDir, '.secret'), path.join(rollbackDir, '.secret'));
  await copyIfExists(path.join(rootDir, '.vapid.json'), path.join(rollbackDir, '.vapid.json'));
  await fsp.writeFile(
    path.join(rollbackDir, 'restore-rollback-manifest.json'),
    `${JSON.stringify({
      created_at: now.toISOString(),
      reason: 'automatic pre-restore rollback',
      included: ['bananza.db', 'uploads/', '.secret', '.vapid.json'],
    }, null, 2)}\n`,
    'utf8'
  );
  return rollbackDir;
}

async function replaceRuntimeFiles({
  extractDir,
  rootDir = __dirname,
  uploadsDir = path.join(rootDir, 'uploads'),
} = {}) {
  if (!extractDir) throw new TypeError('replaceRuntimeFiles requires extractDir');
  const stagedDbPath = path.join(extractDir, 'bananza.db');
  const runtimeDbPath = path.join(rootDir, 'bananza.db');
  await rmWithBusyRetry(`${runtimeDbPath}-wal`);
  await rmWithBusyRetry(`${runtimeDbPath}-shm`);
  await copyFileWithBusyRetry(stagedDbPath, runtimeDbPath);
  await rmWithBusyRetry(`${runtimeDbPath}-wal`);
  await rmWithBusyRetry(`${runtimeDbPath}-shm`);

  await rmWithBusyRetry(uploadsDir, { recursive: true });
  await copyUploads(path.join(extractDir, 'uploads'), uploadsDir);

  if (await exists(path.join(extractDir, '.secret'))) {
    await fsp.copyFile(path.join(extractDir, '.secret'), path.join(rootDir, '.secret'));
  }
  if (await exists(path.join(extractDir, '.vapid.json'))) {
    await fsp.copyFile(path.join(extractDir, '.vapid.json'), path.join(rootDir, '.vapid.json'));
  }
}

async function stagePendingRestore({
  session,
  rootDir = __dirname,
  rollbackDir = '',
  recovery = null,
  now = new Date(),
} = {}) {
  if (!session?.extractDir) throw createRestoreError('Restore session expired or not found', 404);
  const pendingRoot = pendingRestoreRoot(rootDir);
  const manifestPath = path.join(pendingRoot, PENDING_RESTORE_MANIFEST);
  if (await exists(manifestPath)) {
    throw createRestoreError('A pending backup restore already exists. Restart the server or remove restore-pending manually.', 409);
  }

  const workspaceDir = path.join(pendingRoot, 'workspace');
  await fsp.rm(pendingRoot, { recursive: true, force: true });
  await fsp.mkdir(workspaceDir, { recursive: true });
  await copyUploads(session.extractDir, workspaceDir);
  await fsp.writeFile(
    manifestPath,
    `${JSON.stringify({
      created_at: now.toISOString(),
      rollback_dir: rollbackDir,
      recovery_admin: recovery ? {
        username: recovery.username,
        user_id: recovery.user_id,
        created: recovery.created,
      } : null,
      workspace: 'workspace',
      note: 'Applied on next startup before SQLite is opened.',
    }, null, 2)}\n`,
    'utf8'
  );
  return pendingRoot;
}

function applyPendingRestoreOnStartup({
  rootDir = __dirname,
  uploadsDir = path.join(rootDir, 'uploads'),
} = {}) {
  const pendingRoot = pendingRestoreRoot(rootDir);
  const manifestPath = path.join(pendingRoot, PENDING_RESTORE_MANIFEST);
  if (!fs.existsSync(manifestPath)) return null;

  const workspaceDir = path.join(pendingRoot, 'workspace');
  const stagedDbPath = path.join(workspaceDir, 'bananza.db');
  const runtimeDbPath = path.join(rootDir, 'bananza.db');
  if (!fs.existsSync(stagedDbPath)) {
    throw new Error('Pending backup restore is missing bananza.db');
  }

  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    manifest = {};
  }

  console.warn('[backup] applying pending restore before SQLite startup');
  rmSyncWithBusyRetry(`${runtimeDbPath}-wal`);
  rmSyncWithBusyRetry(`${runtimeDbPath}-shm`);
  copyFileSyncWithBusyRetry(stagedDbPath, runtimeDbPath);
  rmSyncWithBusyRetry(`${runtimeDbPath}-wal`);
  rmSyncWithBusyRetry(`${runtimeDbPath}-shm`);

  rmSyncWithBusyRetry(uploadsDir, { recursive: true });
  copyDirectorySyncSkippingSymlinks(path.join(workspaceDir, 'uploads'), uploadsDir);

  if (fs.existsSync(path.join(workspaceDir, '.secret'))) {
    copyFileSyncWithBusyRetry(path.join(workspaceDir, '.secret'), path.join(rootDir, '.secret'));
  }
  if (fs.existsSync(path.join(workspaceDir, '.vapid.json'))) {
    copyFileSyncWithBusyRetry(path.join(workspaceDir, '.vapid.json'), path.join(rootDir, '.vapid.json'));
  }

  rmSyncWithBusyRetry(pendingRoot, { recursive: true });
  console.warn('[backup] pending restore applied');
  return {
    ok: true,
    manifest,
  };
}

async function applyRestoreSession({
  db,
  session,
  rootDir = __dirname,
  uploadsDir = path.join(rootDir, 'uploads'),
  recoveryAdmin,
  now = new Date(),
  closeDatabase = true,
  deferRuntimeReplace = false,
} = {}) {
  if (!db) throw new TypeError('applyRestoreSession requires db');
  if (!session?.extractDir) throw createRestoreError('Restore session expired or not found', 404);

  const recovery = await patchRecoveryAdmin({
    dbPath: path.join(session.extractDir, 'bananza.db'),
    recoveryAdmin,
  });
  const rollbackDir = await createRestoreRollback({ db, rootDir, uploadsDir, now });

  if (deferRuntimeReplace) {
    const pending_restore_dir = await stagePendingRestore({
      session,
      rootDir,
      rollbackDir,
      recovery,
      now,
    });
    return {
      ok: true,
      restart_required: true,
      login_required: true,
      pending_restart: true,
      pending_restore_dir,
      recovery_admin: {
        username: recovery.username,
        user_id: recovery.user_id,
        created: recovery.created,
      },
      rollback_dir: rollbackDir,
    };
  }

  if (closeDatabase && typeof db.close === 'function' && db.open !== false) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (error) {
      console.warn('[backup] restore WAL checkpoint failed:', error.message);
    }
    db.close();
    await sleep(250);
  }

  await replaceRuntimeFiles({
    extractDir: session.extractDir,
    rootDir,
    uploadsDir,
  });

  return {
    ok: true,
    restart_required: true,
    login_required: true,
    recovery_admin: {
      username: recovery.username,
      user_id: recovery.user_id,
      created: recovery.created,
    },
    rollback_dir: rollbackDir,
  };
}

async function createBackupArchive({
  db,
  rootDir = __dirname,
  uploadsDir = path.join(rootDir, 'uploads'),
  tempDir = os.tmpdir(),
  now = new Date(),
} = {}) {
  if (!db || typeof db.backup !== 'function') {
    throw new TypeError('A better-sqlite3 database with backup() is required');
  }

  const filename = `bananza-backup-${backupTimestamp(now)}.tar.gz`;
  const tempRoot = await fsp.mkdtemp(path.join(tempDir, 'bananza-backup-'));
  const workspaceDir = path.join(tempRoot, 'workspace');
  const archivePath = path.join(tempRoot, filename);
  const cleanup = async () => {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  };

  try {
    await fsp.mkdir(workspaceDir, { recursive: true });
    await db.backup(path.join(workspaceDir, 'bananza.db'));
    await copyUploads(uploadsDir, path.join(workspaceDir, 'uploads'));

    const secrets = [];
    if (await copyIfExists(path.join(rootDir, '.secret'), path.join(workspaceDir, '.secret'))) {
      secrets.push('.secret');
    }
    if (await copyIfExists(path.join(rootDir, '.vapid.json'), path.join(workspaceDir, '.vapid.json'))) {
      secrets.push('.vapid.json');
    }

    const uploads = await collectDirectoryStats(path.join(workspaceDir, 'uploads'));
    const manifest = buildBackupManifest({
      createdAt: now,
      included: { secrets },
      uploads,
    });
    await fsp.writeFile(
      path.join(workspaceDir, 'backup-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8'
    );

    const entries = ['bananza.db', 'uploads', 'backup-manifest.json', ...secrets];
    await tar.create({
      cwd: workspaceDir,
      file: archivePath,
      gzip: true,
      portable: true,
      noMtime: true,
      filter: (entryPath, stat) => {
        const normalized = String(entryPath || '').replace(/\\/g, '/');
        if (DEFAULT_EXCLUDED.includes(normalized)) return false;
        if (normalized.startsWith('node_modules/') || normalized.startsWith('.git/')) return false;
        return !stat?.isSymbolicLink?.();
      },
    }, entries);

    return {
      archivePath,
      filename,
      manifest,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function createStreamingBackupArchive({
  db,
  rootDir = __dirname,
  uploadsDir = path.join(rootDir, 'uploads'),
  tempDir = os.tmpdir(),
  now = new Date(),
} = {}) {
  if (!db || typeof db.backup !== 'function') {
    throw new TypeError('A better-sqlite3 database with backup() is required');
  }

  const filename = `bananza-backup-${backupTimestamp(now)}.tar.gz`;
  const tempRoot = await fsp.mkdtemp(path.join(tempDir, 'bananza-backup-stream-'));
  const workspaceDir = path.join(tempRoot, 'workspace');
  const dbCopyPath = path.join(workspaceDir, 'bananza.db');
  const cleanup = async () => {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  };

  try {
    await fsp.mkdir(workspaceDir, { recursive: true });
    await db.backup(dbCopyPath);

    const secrets = await collectSecretEntries(rootDir);
    const uploads = await collectDirectoryStats(uploadsDir);
    const manifest = buildBackupManifest({
      createdAt: now,
      included: { secrets },
      uploads,
      mode: 'stream',
    });

    const pack = tarStream.pack();
    const gzip = zlib.createGzip();
    const stream = pack.pipe(gzip);
    const abortController = new AbortController();
    let started = false;
    let finalized = false;

    const abort = () => {
      if (!abortController.signal.aborted) {
        abortController.abort(createBackupStreamAbortError());
      }
      pack.destroy(abortController.signal.reason || createBackupStreamAbortError());
      gzip.destroy(abortController.signal.reason || createBackupStreamAbortError());
    };

    const start = async () => {
      if (started) return;
      started = true;
      try {
        const signal = abortController.signal;
        await addTarFileEntry(pack, dbCopyPath, 'bananza.db', { signal, mode: 0o600 });
        await addTarDirectoryEntry(pack, 'uploads', { signal });
        for await (const uploadFile of walkUploadArchiveFiles(uploadsDir, signal)) {
          await addTarFileEntry(pack, uploadFile.absolutePath, uploadFile.archivePath, {
            signal,
            stats: uploadFile.stats,
          });
        }
        await addTarBufferEntry(
          pack,
          'backup-manifest.json',
          `${JSON.stringify(manifest, null, 2)}\n`,
          { signal, mode: 0o600 }
        );
        for (const secret of secrets) {
          await addTarFileEntry(pack, path.join(rootDir, secret), secret, { signal, mode: 0o600 });
        }
        finalized = true;
        pack.finalize();
      } catch (error) {
        if (!finalized) pack.destroy(error);
        throw error;
      }
    };

    return {
      filename,
      manifest,
      stream,
      start,
      abort,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

function createBackupFeature({
  app,
  db,
  auth,
  adminOnly,
  uploadsDir,
  rootDir = __dirname,
  server = null,
  clients = null,
  tempDir = os.tmpdir(),
  restoreLimitBytes = parseRestoreLimitBytes(process.env.BANANZA_RESTORE_LIMIT_BYTES),
  exitProcess = (code) => process.exit(code),
} = {}) {
  if (!app || !db || !auth || !adminOnly) {
    throw new TypeError('createBackupFeature requires app, db, auth, and adminOnly');
  }

  const restoreSessions = new Map();
  const restoreUploadDir = path.join(tempDir, 'bananza-restore-uploads');
  fs.mkdirSync(restoreUploadDir, { recursive: true });
  const restoreUpload = multer({
    dest: restoreUploadDir,
    limits: {
      fileSize: restoreLimitBytes,
      files: 1,
    },
  });
  let restoreApplying = false;

  async function cleanupRestoreSession(restoreId) {
    const id = normalizeRestoreId(restoreId);
    if (!id) return;
    const session = restoreSessions.get(id);
    if (!session) return;
    restoreSessions.delete(id);
    await fsp.rm(session.sessionRoot, { recursive: true, force: true });
  }

  async function cleanupExpiredRestoreSessions() {
    const now = Date.now();
    const expired = [...restoreSessions.entries()]
      .filter(([, session]) => now - Number(session.createdAt || 0) > RESTORE_SESSION_TTL_MS)
      .map(([restoreId]) => restoreId);
    for (const restoreId of expired) {
      await cleanupRestoreSession(restoreId);
    }
  }

  function closeRestoreWebSockets() {
    if (!clients || typeof clients.forEach !== 'function') return;
    clients.forEach((connections) => {
      connections?.forEach?.((socket) => {
        try {
          socket.close(1012, 'Backup restore');
        } catch {}
      });
    });
  }

  function scheduleRestoreShutdown() {
    const noExit = process.env.BANANZA_TEST_RESTORE_NO_EXIT === '1';
    const timer = setTimeout(() => {
      try {
        server?.close?.();
      } catch {}
      if (!noExit) exitProcess(0);
    }, 250);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function restoreUploadMiddleware(req, res, next) {
    restoreUpload.single('backup')(req, res, (error) => {
      if (!error) return next();
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      res.status(status).json({ error: error.message || 'Could not upload backup archive' });
    });
  }

  app.use('/api', (req, res, next) => {
    if (!restoreApplying) return next();
    if (req.path.startsWith('/admin/backup/restore')) return next();
    res.status(503).json({ error: 'Backup restore is in progress' });
  });

  app.get('/api/admin/backup/export', auth, adminOnly, async (req, res, next) => {
    if (String(req.query?.mode || '').toLowerCase() === 'stream') {
      let backup = null;
      try {
        backup = await createStreamingBackupArchive({ db, rootDir, uploadsDir, tempDir });
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
        res.on('close', () => {
          if (!res.writableEnded) backup?.abort?.();
        });
        const streamPromise = pipeline(backup.stream, res);
        const startPromise = backup.start();
        await Promise.all([startPromise, streamPromise]);
      } catch (error) {
        backup?.abort?.();
        if (error.code !== 'BACKUP_STREAM_ABORTED') {
          console.warn('[backup] streaming export failed:', error.message);
        }
        if (!res.headersSent) {
          res.status(500).json({ error: 'Could not create backup' });
        } else if (!res.destroyed) {
          res.destroy(error);
        }
      } finally {
        if (backup) await backup.cleanup().catch(() => {});
      }
      return;
    }

    let backup = null;
    try {
      backup = await createBackupArchive({ db, rootDir, uploadsDir });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/gzip');
      res.download(backup.archivePath, backup.filename, async (error) => {
        await backup.cleanup();
        if (error) {
          if (!res.headersSent) next(error);
          else console.warn('[backup] download failed:', error.message);
        }
      });
    } catch (error) {
      if (backup) await backup.cleanup().catch(() => {});
      console.warn('[backup] export failed:', error.message);
      if (res.headersSent) return;
      res.status(500).json({ error: 'Could not create backup' });
    }
  });

  app.post('/api/admin/backup/restore/preview', auth, adminOnly, restoreUploadMiddleware, async (req, res) => {
    const uploadedPath = req.file?.path;
    try {
      if (restoreApplying) return res.status(409).json({ error: 'Backup restore is in progress' });
      if (!uploadedPath) return res.status(400).json({ error: 'Backup archive is required' });
      await cleanupExpiredRestoreSessions();
      const session = await createRestorePreview({
        archivePath: uploadedPath,
        tempDir,
      });
      restoreSessions.set(session.restoreId, session);
      res.json(session.preview);
    } catch (error) {
      console.warn('[backup] restore preview failed:', error.message);
      res.status(error.status || 500).json({ error: error.message || 'Could not validate backup archive' });
    } finally {
      if (uploadedPath) {
        await fsp.rm(uploadedPath, { force: true }).catch(() => {});
      }
    }
  });

  app.post('/api/admin/backup/restore/apply', auth, adminOnly, async (req, res) => {
    const restoreId = normalizeRestoreId(req.body?.restore_id || req.body?.restoreId);
    try {
      if (restoreApplying) return res.status(409).json({ error: 'Backup restore is in progress' });
      if (!restoreId) return res.status(400).json({ error: 'Restore session expired or not found' });
      if (String(req.body?.confirm || '') !== RESTORE_CONFIRM_TEXT) {
        return res.status(400).json({ error: 'Type RESTORE to confirm' });
      }
      await cleanupExpiredRestoreSessions();
      const session = restoreSessions.get(restoreId);
      if (!session) return res.status(404).json({ error: 'Restore session expired or not found' });

      restoreApplying = true;
      const result = await applyRestoreSession({
        db,
        session,
        rootDir,
        uploadsDir,
        recoveryAdmin: req.body?.recovery_admin || req.body?.recoveryAdmin,
        deferRuntimeReplace: process.env.BANANZA_TEST_RESTORE_NO_EXIT !== '1',
      });
      await cleanupRestoreSession(restoreId).catch(() => {});
      closeRestoreWebSockets();
      res.json(result);
      scheduleRestoreShutdown();
    } catch (error) {
      restoreApplying = false;
      console.warn('[backup] restore apply failed:', error.message);
      res.status(error.status || 500).json({ error: error.message || 'Could not apply backup restore' });
    }
  });

  return {
    createBackupArchive,
    createStreamingBackupArchive,
    createRestorePreview,
    applyRestoreSession,
  };
}

module.exports = {
  BACKUP_FORMAT_VERSION,
  DEFAULT_EXCLUDED,
  RESTORE_CONFIRM_TEXT,
  backupTimestamp,
  buildBackupManifest,
  createBackupArchive,
  createStreamingBackupArchive,
  createBackupFeature,
  createRestorePreview,
  applyRestoreSession,
  applyPendingRestoreOnStartup,
  patchRecoveryAdmin,
  validateArchiveEntryPath,
  validateBackupArchiveEntries,
};

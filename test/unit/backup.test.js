const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const tar = require('tar');
const { pipeline } = require('stream/promises');

const {
  BACKUP_FORMAT_VERSION,
  backupTimestamp,
  buildBackupManifest,
  applyPendingRestoreOnStartup,
  createStreamingBackupArchive,
  createBackupArchive,
  createRestorePreview,
  applyRestoreSession,
  assertSafeExternalRestoreTarget,
  patchRecoveryAdmin,
  validateArchiveEntryPath,
} = require('../../backup');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-backup-unit-'));
}

function createRestoreDatabase(dbPath, { username = 'admin', isAdmin = 1 } = {}) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      is_ai_bot INTEGER DEFAULT 0,
      avatar_color TEXT NOT NULL,
      ui_language TEXT DEFAULT 'ru'
    );
    CREATE TABLE chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      created_by INTEGER
    );
    CREATE TABLE chat_members (
      chat_id INTEGER,
      user_id INTEGER,
      PRIMARY KEY (chat_id, user_id)
    );
    CREATE TABLE files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      type TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT,
      file_id INTEGER
    );
  `);
  db.prepare(`
    INSERT INTO users(username,password,display_name,is_admin,is_blocked,is_ai_bot,avatar_color)
    VALUES(?,?,?,?,?,?,?)
  `).run(username, 'old-password-hash', username, isAdmin, 0, 0, '#65aadd');
  db.prepare('INSERT INTO chats(name,type,created_by) VALUES(?,?,?)').run('General', 'general', 1);
  db.close();
}

async function createRestoreArchive(rootDir) {
  const workspace = path.join(rootDir, 'workspace');
  const archivePath = path.join(rootDir, 'backup.tar.gz');
  fs.mkdirSync(path.join(workspace, 'uploads'), { recursive: true });
  createRestoreDatabase(path.join(workspace, 'bananza.db'));
  fs.writeFileSync(path.join(workspace, 'uploads', 'note.txt'), 'hello');
  fs.writeFileSync(path.join(workspace, '.secret'), 'secret');
  fs.writeFileSync(path.join(workspace, '.vapid.json'), '{}');
  fs.writeFileSync(
    path.join(workspace, 'backup-manifest.json'),
    JSON.stringify(buildBackupManifest({
      createdAt: new Date('2026-05-24T15:30:07.000Z'),
      included: { secrets: ['.secret', '.vapid.json'] },
      uploads: { files: 1, bytes: 5 },
    }), null, 2)
  );
  await tar.create({
    cwd: workspace,
    file: archivePath,
    gzip: true,
    portable: true,
  }, ['bananza.db', 'uploads', '.secret', '.vapid.json', 'backup-manifest.json']);
  return archivePath;
}

test('backupTimestamp formats UTC timestamps for archive filenames', () => {
  const date = new Date('2026-05-24T15:30:07.000Z');
  assert.equal(backupTimestamp(date), '2026-05-24-153007');
});

test('buildBackupManifest records included and excluded backup parts', () => {
  const manifest = buildBackupManifest({
    createdAt: new Date('2026-05-24T15:30:07.000Z'),
    included: {
      secrets: ['.secret', '.vapid.json'],
    },
    uploads: {
      files: 3,
      bytes: 42,
    },
    app: {
      name: 'bananza-test',
      version: '9.9.9',
    },
  });

  assert.equal(manifest.format_version, BACKUP_FORMAT_VERSION);
  assert.equal(manifest.created_at, '2026-05-24T15:30:07.000Z');
  assert.deepEqual(manifest.archive, { mode: 'file' });
  assert.deepEqual(manifest.app, { name: 'bananza-test', version: '9.9.9' });
  assert.equal(manifest.included.database, 'bananza.db');
  assert.equal(manifest.included.uploads, 'uploads/');
  assert.deepEqual(manifest.included.secrets, ['.secret', '.vapid.json']);
  assert.equal(manifest.included.manifest, 'backup-manifest.json');
  assert.deepEqual(manifest.uploads, { files: 3, bytes: 42 });
  assert.ok(manifest.excluded.includes('.env'));
  assert.ok(manifest.excluded.includes('node_modules/'));
  assert.ok(manifest.excluded.includes('.git/'));
  assert.ok(manifest.excluded.includes('bananza.db-wal'));
  assert.ok(manifest.excluded.includes('bananza.db-shm'));
  assert.ok(manifest.excluded.includes('voice/models/*.bin'));
  assert.deepEqual(manifest.optional_components, {});
  assert.ok(manifest.notes.some((note) => note.includes('Whisper runtime')));
  assert.ok(manifest.notes.some((note) => note.includes('Telegram bot tokens') && note.includes('.secret')));
});

test('restore archive entry validation rejects unsafe and excluded paths', () => {
  assert.throws(() => validateArchiveEntryPath('../bananza.db', 'File'), /Invalid archive path/);
  assert.throws(() => validateArchiveEntryPath('/bananza.db', 'File'), /Invalid archive path/);
  assert.equal(validateArchiveEntryPath('.env', 'File'), '.env');
  assert.equal(validateArchiveEntryPath('external/call-recordings/mixed.ogg', 'File'), 'external/call-recordings/mixed.ogg');
  assert.throws(() => validateArchiveEntryPath('bananza.db-wal', 'File'), /excluded files/);
  assert.throws(() => validateArchiveEntryPath('node_modules/pkg/index.js', 'File'), /excluded files/);
  assert.throws(() => validateArchiveEntryPath('uploads/link', 'SymbolicLink'), /links are not allowed/);
  assert.equal(validateArchiveEntryPath('uploads/file.txt', 'File'), 'uploads/file.txt');
  assert.equal(validateArchiveEntryPath('./backup-manifest.json', 'File'), 'backup-manifest.json');
});

test('external restore destinations reject filesystem and project roots', () => {
  const rootDir = path.resolve('/tmp/bananza-backup-target-test');
  assert.throws(() => assertSafeExternalRestoreTarget(path.parse(rootDir).root, rootDir), /Unsafe external restore destination/);
  assert.throws(() => assertSafeExternalRestoreTarget(rootDir, rootDir), /Unsafe external restore destination/);
  assert.equal(assertSafeExternalRestoreTarget(path.join(rootDir, 'external-data'), rootDir), path.join(rootDir, 'external-data'));
});

test('createStreamingBackupArchive streams safe entries without copying excluded runtime files', async () => {
  const tempDir = makeTempDir();
  const liveDbPath = path.join(tempDir, 'live.db');
  const uploadsDir = path.join(tempDir, 'uploads');
  const archivePath = path.join(tempDir, 'streamed-backup.tar.gz');
  let db = null;
  let backup = null;
  try {
    createRestoreDatabase(liveDbPath);
    db = new Database(liveDbPath);

    fs.mkdirSync(path.join(uploadsDir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, 'note.txt'), 'hello');
    fs.writeFileSync(path.join(uploadsDir, 'nested', 'deep.txt'), 'deep');
    let symlinkCreated = false;
    try {
      fs.symlinkSync(path.join(uploadsDir, 'note.txt'), path.join(uploadsDir, 'linked-note.txt'));
      symlinkCreated = true;
    } catch {}

    fs.writeFileSync(path.join(tempDir, '.secret'), 'secret');
    fs.writeFileSync(path.join(tempDir, '.vapid.json'), '{"publicKey":"test"}');
    fs.writeFileSync(path.join(tempDir, '.env'), 'SHOULD_NOT_EXPORT=1');
    fs.writeFileSync(path.join(tempDir, 'bananza.db-wal'), 'wal');
    fs.writeFileSync(path.join(tempDir, 'bananza.db-shm'), 'shm');
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });

    backup = await createStreamingBackupArchive({
      db,
      rootDir: tempDir,
      uploadsDir,
      tempDir,
      now: new Date('2026-05-24T15:30:07.000Z'),
    });
    assert.equal(backup.filename, 'bananza-backup-2026-05-24-153007.tar.gz');
    assert.equal(backup.manifest.archive.mode, 'stream');
    assert.equal(backup.manifest.uploads.files, 2);

    const streamPromise = pipeline(backup.stream, fs.createWriteStream(archivePath));
    const startPromise = backup.start();
    await Promise.all([startPromise, streamPromise]);

    const entries = [];
    await tar.list({
      file: archivePath,
      onentry: (entry) => entries.push(entry.path.replace(/\\/g, '/').replace(/\/+$/, '')),
    });
    const paths = new Set(entries);
    assert.ok(paths.has('bananza.db'));
    assert.ok(paths.has('uploads'));
    assert.ok(paths.has('uploads/note.txt'));
    assert.ok(paths.has('uploads/nested/deep.txt'));
    assert.ok(paths.has('backup-manifest.json'));
    assert.ok(paths.has('.secret'));
    assert.ok(paths.has('.vapid.json'));
    assert.equal(paths.has('.env'), false);
    assert.equal(paths.has('bananza.db-wal'), false);
    assert.equal(paths.has('bananza.db-shm'), false);
    assert.equal(paths.has('.git'), false);
    assert.equal(paths.has('node_modules'), false);
    if (symlinkCreated) assert.equal(paths.has('uploads/linked-note.txt'), false);
    for (const entry of paths) {
      assert.equal(path.posix.isAbsolute(entry), false);
      assert.equal(entry.split('/').includes('..'), false);
    }

    const extractDir = fs.mkdtempSync(path.join(tempDir, 'extract-'));
    try {
      await tar.extract({ file: archivePath, cwd: extractDir });
      const manifest = JSON.parse(fs.readFileSync(path.join(extractDir, 'backup-manifest.json'), 'utf8'));
      assert.equal(manifest.archive.mode, 'stream');
      const restoredDb = new Database(path.join(extractDir, 'bananza.db'), { readonly: true });
      try {
        assert.equal(restoredDb.pragma('integrity_check', { simple: true }), 'ok');
        assert.equal(restoredDb.prepare('SELECT COUNT(*) AS count FROM users').get().count, 1);
      } finally {
        restoredDb.close();
      }
    } finally {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  } finally {
    if (backup) await backup.cleanup().catch(() => {});
    db?.close?.();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('optional export components include env, completed recordings, and configured model files only', async () => {
  const tempDir = makeTempDir();
  const uploadsDir = path.join(tempDir, 'uploads');
  const archivePath = path.join(tempDir, 'optional.tar.gz');
  const recordingsDir = path.join(tempDir, 'call-recordings');
  const modelsDir = path.join(tempDir, 'speech-models');
  let db = null;
  let backup = null;
  try {
    createRestoreDatabase(path.join(tempDir, 'bananza.db'));
    db = new Database(path.join(tempDir, 'bananza.db'));
    db.exec(`
      CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT);
      CREATE TABLE call_recordings (id INTEGER PRIMARY KEY, file_path TEXT NOT NULL, status TEXT NOT NULL);
    `);
    db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?)').run('call_settings', JSON.stringify({ call_recording_path: recordingsDir }));
    db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?)').run('voice_settings', JSON.stringify({ whisper_models_dir: modelsDir, vosk_model_path: modelsDir }));
    fs.mkdirSync(path.join(recordingsDir, 'call-1'), { recursive: true });
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.writeFileSync(path.join(recordingsDir, 'call-1', 'completed.ogg'), 'completed');
    fs.writeFileSync(path.join(recordingsDir, 'call-1', 'active.ogg'), 'active');
    fs.writeFileSync(path.join(modelsDir, 'ggml-test.bin'), 'model');
    fs.writeFileSync(path.join(tempDir, '.env'), 'ARCHIVED=1');
    db.prepare('INSERT INTO call_recordings(id,file_path,status) VALUES(?,?,?)').run(1, path.join(recordingsDir, 'call-1', 'completed.ogg'), 'completed');
    db.prepare('INSERT INTO call_recordings(id,file_path,status) VALUES(?,?,?)').run(2, path.join(recordingsDir, 'call-1', 'active.ogg'), 'recording');

    backup = await createStreamingBackupArchive({
      db,
      rootDir: tempDir,
      uploadsDir,
      tempDir,
      optionalComponents: ['env', 'call_recordings', 'voice_models'],
    });
    await Promise.all([backup.start(), pipeline(backup.stream, fs.createWriteStream(archivePath))]);
    const entries = [];
    await tar.list({ file: archivePath, onentry: (entry) => entries.push(entry.path.replace(/\\/g, '/').replace(/\/+$/, '')) });
    assert.ok(entries.includes('.env'));
    assert.ok(entries.includes('external/call-recordings/call-1/completed.ogg'));
    assert.equal(entries.includes('external/call-recordings/call-1/active.ogg'), false);
    assert.ok(entries.some((item) => item.startsWith('external/models/') && item.endsWith('ggml-test.bin')));
    const extractDir = fs.mkdtempSync(path.join(tempDir, 'optional-extract-'));
    try {
      await tar.extract({ file: archivePath, cwd: extractDir });
      const manifest = JSON.parse(fs.readFileSync(path.join(extractDir, 'backup-manifest.json'), 'utf8'));
      assert.equal(manifest.format_version, BACKUP_FORMAT_VERSION);
      assert.equal(manifest.optional_components.env.status, 'included');
      assert.equal(manifest.optional_components.call_recordings.active_or_processing, 1);
      assert.equal(manifest.optional_components.call_recordings.files, 1);
      assert.equal(manifest.optional_components.voice_models.files, 1);
    } finally {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  } finally {
    if (backup) await backup.cleanup().catch(() => {});
    if (db) db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('selected optional env restore replaces only the explicitly selected file', async () => {
  const tempDir = makeTempDir();
  const uploadsDir = path.join(tempDir, 'uploads');
  let db = null;
  let backup = null;
  let session = null;
  try {
    createRestoreDatabase(path.join(tempDir, 'bananza.db'));
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.env'), 'ARCHIVED=1');
    fs.writeFileSync(path.join(tempDir, '.env.local'), 'LOCAL_CURRENT=1');
    db = new Database(path.join(tempDir, 'bananza.db'));
    backup = await createBackupArchive({ db, rootDir: tempDir, uploadsDir, tempDir, optionalComponents: ['env'] });
    fs.writeFileSync(path.join(tempDir, '.env'), 'CURRENT=1');
    session = await createRestorePreview({ archivePath: backup.archivePath, tempDir, rootDir: tempDir });
    const result = await applyRestoreSession({
      db,
      session,
      rootDir: tempDir,
      uploadsDir,
      recoveryAdmin: { username: 'restore_admin', password: 'restore-password' },
      deferRuntimeReplace: true,
      restoreComponents: ['env'],
    });
    assert.equal(result.pending_restart, true);
    db.close();
    db = null;
    applyPendingRestoreOnStartup({ rootDir: tempDir, uploadsDir });
    assert.equal(fs.readFileSync(path.join(tempDir, '.env'), 'utf8'), 'ARCHIVED=1');
    assert.equal(fs.readFileSync(path.join(tempDir, '.env.local'), 'utf8'), 'LOCAL_CURRENT=1');
  } finally {
    if (db) db.close();
    if (session) fs.rmSync(session.sessionRoot, { recursive: true, force: true });
    if (backup) await backup.cleanup().catch(() => {});
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('createRestorePreview validates archive manifest and database summary', async () => {
  const tempDir = makeTempDir();
  try {
    const archivePath = await createRestoreArchive(tempDir);
    const session = await createRestorePreview({
      archivePath,
      tempDir,
      restoreId: '0123456789abcdef0123456789abcdef',
    });
    try {
      assert.equal(session.preview.restore_id, '0123456789abcdef0123456789abcdef');
      assert.equal(session.preview.manifest.format_version, BACKUP_FORMAT_VERSION);
      assert.equal(session.preview.database.users, 1);
      assert.equal(session.preview.database.admins, 1);
      assert.equal(session.preview.database.chats, 1);
      assert.equal(session.preview.uploads.files, 1);
      assert.equal(session.preview.includes.secret, true);
      assert.equal(session.preview.includes.vapid, true);
      assert.ok(fs.existsSync(path.join(session.extractDir, 'bananza.db')));
    } finally {
      fs.rmSync(session.sessionRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('createRestorePreview keeps backward compatibility with a v1 manifest', async () => {
  const tempDir = makeTempDir();
  try {
    const archivePath = await createRestoreArchive(tempDir);
    const workspace = path.join(tempDir, 'legacy-workspace');
    fs.mkdirSync(workspace, { recursive: true });
    await tar.extract({ file: archivePath, cwd: workspace });
    const manifestPath = path.join(workspace, 'backup-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.format_version = 1;
    delete manifest.optional_components;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const legacyArchivePath = path.join(tempDir, 'legacy.tar.gz');
    await tar.create({ cwd: workspace, file: legacyArchivePath, gzip: true }, ['bananza.db', 'uploads', '.secret', '.vapid.json', 'backup-manifest.json']);
    const session = await createRestorePreview({ archivePath: legacyArchivePath, tempDir });
    try {
      assert.equal(session.preview.manifest.format_version, 1);
      assert.deepEqual(session.preview.optional_components, {});
    } finally {
      fs.rmSync(session.sessionRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('patchRecoveryAdmin creates and updates an admin with a known password', async () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, 'bananza.db');
  try {
    createRestoreDatabase(dbPath, { username: 'existing_admin', isAdmin: 0 });

    const created = await patchRecoveryAdmin({
      dbPath,
      recoveryAdmin: {
        username: 'recovery_admin',
        password: 'fresh-password',
      },
    });
    assert.equal(created.username, 'recovery_admin');
    assert.equal(created.created, true);

    const updated = await patchRecoveryAdmin({
      dbPath,
      recoveryAdmin: {
        username: 'existing_admin',
        password: 'updated-password',
      },
    });
    assert.equal(updated.username, 'existing_admin');
    assert.equal(updated.created, false);

    const db = new Database(dbPath, { readonly: true });
    try {
      const recovery = db.prepare('SELECT username,password,is_admin,is_blocked,is_ai_bot FROM users WHERE username=?').get('recovery_admin');
      assert.equal(recovery.is_admin, 1);
      assert.equal(recovery.is_blocked, 0);
      assert.equal(recovery.is_ai_bot, 0);
      assert.equal(await bcrypt.compare('fresh-password', recovery.password), true);

      const existing = db.prepare('SELECT password,is_admin,is_blocked,is_ai_bot FROM users WHERE username=?').get('existing_admin');
      assert.equal(existing.is_admin, 1);
      assert.equal(existing.is_blocked, 0);
      assert.equal(existing.is_ai_bot, 0);
      assert.equal(await bcrypt.compare('updated-password', existing.password), true);
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('applyPendingRestoreOnStartup swaps runtime files before the live database opens', () => {
  const tempDir = makeTempDir();
  const uploadsDir = path.join(tempDir, 'uploads');
  const pendingDir = path.join(tempDir, 'restore-pending');
  const pendingWorkspace = path.join(pendingDir, 'workspace');
  try {
    fs.mkdirSync(path.join(pendingWorkspace, 'uploads'), { recursive: true });
    createRestoreDatabase(path.join(tempDir, 'bananza.db'), { username: 'old_admin', isAdmin: 1 });
    createRestoreDatabase(path.join(pendingWorkspace, 'bananza.db'), { username: 'restored_admin', isAdmin: 1 });
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, 'old.txt'), 'old');
    fs.writeFileSync(path.join(tempDir, 'bananza.db-wal'), 'old wal');
    fs.writeFileSync(path.join(tempDir, 'bananza.db-shm'), 'old shm');
    fs.writeFileSync(path.join(pendingWorkspace, 'uploads', 'restored.txt'), 'restored');
    fs.writeFileSync(path.join(pendingWorkspace, '.secret'), 'restored-secret');
    fs.writeFileSync(path.join(pendingWorkspace, '.vapid.json'), '{"restored":true}');
    fs.writeFileSync(
      path.join(pendingDir, 'restore-pending.json'),
      JSON.stringify({ created_at: '2026-05-24T15:30:07.000Z', workspace: 'workspace' })
    );

    const applied = applyPendingRestoreOnStartup({
      rootDir: tempDir,
      uploadsDir,
    });
    assert.equal(applied.ok, true);
    assert.equal(fs.existsSync(pendingDir), false);
    assert.equal(fs.existsSync(path.join(tempDir, 'bananza.db-wal')), false);
    assert.equal(fs.existsSync(path.join(tempDir, 'bananza.db-shm')), false);
    assert.equal(fs.existsSync(path.join(uploadsDir, 'old.txt')), false);
    assert.equal(fs.readFileSync(path.join(uploadsDir, 'restored.txt'), 'utf8'), 'restored');
    assert.equal(fs.readFileSync(path.join(tempDir, '.secret'), 'utf8'), 'restored-secret');

    const db = new Database(path.join(tempDir, 'bananza.db'), { readonly: true });
    try {
      assert.ok(db.prepare('SELECT 1 FROM users WHERE username=?').get('restored_admin'));
      assert.equal(db.prepare('SELECT 1 FROM users WHERE username=?').get('old_admin'), undefined);
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');
const { repoRoot, runtimeRoot } = require('../support/paths');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeSchemaStub(appDir, relativePath, exportName) {
  const filePath = path.join(appDir, relativePath);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `exports.${exportName} = () => {};\n`);
}

function seedLegacyDocumentAssetsDatabase(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0
    );
    CREATE TABLE chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id)
    );
    CREATE TABLE chat_members (
      chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (chat_id, user_id)
    );
    CREATE TABLE documents (
      chat_id INTEGER PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      invite_token TEXT DEFAULT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE document_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES documents(chat_id) ON DELETE CASCADE,
      stored_name TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.prepare("INSERT INTO users(id, username, password, display_name, is_admin) VALUES(7, 'owner', 'x', 'Owner', 1)").run();
  db.prepare("INSERT INTO chats(id, name, type, created_by) VALUES(20, 'Doc', 'group', 7)").run();
  db.prepare("INSERT INTO chat_members(chat_id, user_id) VALUES(20, 7)").run();
  db.prepare("INSERT INTO documents(chat_id, title) VALUES(20, 'Doc')").run();
  db.prepare(`
    INSERT INTO document_assets(id, chat_id, stored_name, original_name, mime_type, size, uploaded_by, created_at)
    VALUES(3, 20, 'legacy-image.png', 'Legacy Image.png', 'image/png', 123, 7, '2026-06-15 10:00:00')
  `).run();
  db.close();
}

test('db startup migrates legacy document_assets rows into file-backed assets', () => {
  ensureDir(runtimeRoot);
  const appDir = fs.mkdtempSync(path.join(runtimeRoot, 'document-assets-migration-'));

  try {
    fs.copyFileSync(path.join(repoRoot, 'db.js'), path.join(appDir, 'db.js'));
    writeSchemaStub(appDir, path.join('voice', 'schema.js'), 'initVoiceSchema');
    writeSchemaStub(appDir, path.join('videoNotes', 'schema.js'), 'initVideoNoteSchema');
    writeSchemaStub(appDir, path.join('calls', 'schema.js'), 'initCallSchema');
    writeSchemaStub(appDir, path.join('ai', 'schema.js'), 'initAiSchema');
    writeSchemaStub(appDir, path.join('telegramTranscription', 'schema.js'), 'initTelegramTranscriptionSchema');
    seedLegacyDocumentAssetsDatabase(path.join(appDir, 'bananza.db'));

    const child = spawnSync(process.execPath, ['-e', `
      const db = require('./db');
      const payload = {
        columns: db.prepare("PRAGMA table_info(document_assets)").all().map((row) => row.name),
        row: db.prepare(\`
          SELECT da.id, da.chat_id, da.created_by, f.stored_name, f.original_name, f.mime_type, f.size, f.type, f.uploaded_by
          FROM document_assets da
          JOIN files f ON f.id=da.file_id
        \`).get(),
        integrity: db.prepare("PRAGMA integrity_check").get().integrity_check,
        indexName: db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_document_assets_file'").get()?.name || null,
        legacyTable: db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='document_assets_legacy_migration'").get()?.name || null,
      };
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('MIGRATION_RESULT ' + JSON.stringify(payload));
    `], { cwd: appDir, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const line = child.stdout.split(/\r?\n/).find((entry) => entry.startsWith('MIGRATION_RESULT '));
    assert.ok(line, child.stdout);
    const payload = JSON.parse(line.slice('MIGRATION_RESULT '.length));

    assert.deepEqual(payload.columns, ['id', 'chat_id', 'file_id', 'created_by', 'kind', 'created_at']);
    assert.deepEqual(payload.row, {
      id: 3,
      chat_id: 20,
      created_by: 7,
      stored_name: 'legacy-image.png',
      original_name: 'Legacy Image.png',
      mime_type: 'image/png',
      size: 123,
      type: 'image',
      uploaded_by: 7,
    });
    assert.equal(payload.integrity, 'ok');
    assert.equal(payload.indexName, 'idx_document_assets_file');
    assert.equal(payload.legacyTable, null);
  } finally {
    fs.rmSync(appDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

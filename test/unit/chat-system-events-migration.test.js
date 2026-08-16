const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { repoRoot, runtimeRoot } = require('../support/paths');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeSchemaStub(appDir, relativePath, exportName) {
  const filePath = path.join(appDir, relativePath);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `exports.${exportName} = () => {};\n`);
}

function runDbScript(appDir, script) {
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: appDir,
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  return child.stdout;
}

function readMigrationSnapshot(appDir) {
  const stdout = runDbScript(appDir, `
    const db = require('./db');
    const payload = {
      rows: db.prepare(\`
        SELECT id, actor_id, actor_name, metadata_json
        FROM chat_system_events
        WHERE id BETWEEN 9201 AND 9207
        ORDER BY id
      \`).all(),
      integrity: db.prepare('PRAGMA integrity_check').get().integrity_check,
    };
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    console.log('MIGRATION_RESULT ' + JSON.stringify(payload));
  `);
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith('MIGRATION_RESULT '));
  assert.ok(line, stdout);
  return JSON.parse(line.slice('MIGRATION_RESULT '.length));
}

test('db startup repairs only legacy bot-add events created with their chat', () => {
  ensureDir(runtimeRoot);
  const appDir = fs.mkdtempSync(path.join(runtimeRoot, 'chat-system-events-migration-'));

  try {
    fs.copyFileSync(path.join(repoRoot, 'db.js'), path.join(appDir, 'db.js'));
    writeSchemaStub(appDir, path.join('voice', 'schema.js'), 'initVoiceSchema');
    writeSchemaStub(appDir, path.join('videoNotes', 'schema.js'), 'initVideoNoteSchema');
    writeSchemaStub(appDir, path.join('calls', 'schema.js'), 'initCallSchema');
    writeSchemaStub(appDir, path.join('ai', 'schema.js'), 'initAiSchema');
    writeSchemaStub(appDir, path.join('telegramTranscription', 'schema.js'), 'initTelegramTranscriptionSchema');

    runDbScript(appDir, `
      const db = require('./db');
      db.prepare(\`
        INSERT INTO users(id, username, password, display_name, is_admin, is_ai_bot, avatar_color)
        VALUES
          (901, 'repair_admin', 'x', 'Repair Admin', 1, 0, '#111111'),
          (902, 'repair_bot', 'x', 'Repair Bot', 0, 1, '#222222'),
          (903, 'repair_member', 'x', 'Repair Member', 0, 0, '#333333')
      \`).run();
      db.prepare(\`
        INSERT INTO chats(id, name, type, created_by, created_at)
        VALUES
          (911, 'Legacy group', 'group', 901, '2026-06-01 10:00:00'),
          (912, 'Legacy private', 'private', 901, '2026-06-01 11:00:00'),
          (913, 'Later bot add', 'group', 901, '2026-06-01 12:00:00')
      \`).run();
      const insertEvent = db.prepare(\`
        INSERT INTO chat_system_events(
          id, chat_id, event_type, actor_id, actor_name,
          target_user_id, target_user_name, target_is_ai_bot, metadata_json, created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?)
      \`);
      insertEvent.run(9200, 911, 'chat_created', 901, 'Repair Admin', null, null, 0, '{"chat_name":"Legacy group"}', '2026-06-01 10:00:00');
      insertEvent.run(9201, 911, 'member_added', null, null, 902, 'Repair Bot', 1, '{"source":"chat_bot_setting","bot_id":1}', '2026-06-01 10:00:00');
      insertEvent.run(9202, 912, 'chat_created', 901, 'Repair Admin', null, null, 0, '{"chat_name":"Legacy private"}', '2026-06-01 11:00:00');
      insertEvent.run(9203, 912, 'member_added', null, null, 902, 'Repair Bot', 1, '{"source":"chat_bot_setting","bot_id":1}', '2026-06-01 11:00:00');
      insertEvent.run(9204, 913, 'chat_created', 901, 'Repair Admin', null, null, 0, '{"chat_name":"Later bot add"}', '2026-06-01 12:00:00');
      insertEvent.run(9205, 913, 'member_added', null, null, 902, 'Repair Bot', 1, '{"source":"chat_bot_setting","bot_id":1}', '2026-06-01 12:00:01');
      insertEvent.run(9206, 911, 'member_added', null, null, 903, 'Repair Member', 0, '{"source":"chat_bot_setting"}', '2026-06-01 10:00:00');
      insertEvent.run(9207, 911, 'member_added', null, null, 902, 'Repair Bot', 1, '{"source":"group_member_add"}', '2026-06-01 10:00:00');
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
    `);

    const first = readMigrationSnapshot(appDir);
    const second = readMigrationSnapshot(appDir);

    assert.deepEqual(first.rows, [
      {
        id: 9201,
        actor_id: 901,
        actor_name: 'Repair Admin',
        metadata_json: '{"source":"group_chat_create","bot_id":1}',
      },
      {
        id: 9202,
        actor_id: 901,
        actor_name: 'Repair Admin',
        metadata_json: '{"chat_name":"Legacy private"}',
      },
      {
        id: 9203,
        actor_id: 901,
        actor_name: 'Repair Admin',
        metadata_json: '{"source":"private_chat_create","bot_id":1}',
      },
      {
        id: 9204,
        actor_id: 901,
        actor_name: 'Repair Admin',
        metadata_json: '{"chat_name":"Later bot add"}',
      },
      {
        id: 9205,
        actor_id: null,
        actor_name: null,
        metadata_json: '{"source":"chat_bot_setting","bot_id":1}',
      },
      {
        id: 9206,
        actor_id: null,
        actor_name: null,
        metadata_json: '{"source":"chat_bot_setting"}',
      },
      {
        id: 9207,
        actor_id: null,
        actor_name: null,
        metadata_json: '{"source":"group_member_add"}',
      },
    ]);
    assert.equal(first.integrity, 'ok');
    assert.deepEqual(second, first);
  } finally {
    fs.rmSync(appDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

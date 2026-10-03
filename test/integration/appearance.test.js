const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { createSandbox, stopSandbox } = require('../support/runtimeSandbox');
const { createSession, makeUser } = require('../support/api');
const catalog = require('../../public/js/appearance');

test('glass rollout preserves every color theme, runs once, and survives database restore', async () => {
  const sandbox = await createSandbox({ name: 'glass-rollout' });
  try {
    await stopSandbox({ pid: sandbox.pid });
    const dbPath = path.join(sandbox.appDir, 'bananza.db');
    const backupPath = path.join(sandbox.rootDir, 'appearance-backup.db');
    const legacyDb = new Database(dbPath);
    const expected = [];
    try {
      // Model a pre-rollout database with users in every appearance combination.
      legacyDb.exec('DROP TABLE schema_migrations');
      const insert = legacyDb.prepare(`INSERT INTO users
        (username,password,display_name,avatar_color,ui_theme,ui_visual_mode)
        VALUES(?, 'test', 'Appearance test', '#123456', ?, ?)`);
      for (const theme of catalog.themes) for (const mode of catalog.modes) {
        const username = `rollout-${theme.id}-${mode.id}`;
        insert.run(username, theme.id, mode.id);
        expected.push({ username, ui_theme: theme.id, ui_visual_mode: 'glass' });
      }
    } finally { legacyDb.close(); }
    expected.sort((a, b) => a.username < b.username ? -1 : 1);

    const migrate = () => {
      const result = spawnSync(process.execPath, ['-e', `
        const db = require('./db');
        console.log(JSON.stringify({
          users: db.prepare("SELECT username,ui_theme,ui_visual_mode FROM users WHERE username LIKE 'rollout-%' ORDER BY username").all(),
          markers: db.prepare("SELECT count(*) AS count FROM schema_migrations WHERE name='2026-10-04-glass-interface'").get().count,
          integrity: db.pragma('integrity_check', { simple: true })
        }));
        db.close();
      `], { cwd: sandbox.appDir, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const value = JSON.parse(result.stdout.trim().split('\n').at(-1));
      assert.equal(value.integrity, 'ok');
      assert.equal(value.markers, 1);
      return value.users;
    };
    assert.deepEqual(migrate(), expected);

    const migratedDb = new Database(dbPath);
    try {
      // A subsequent explicit choice must survive both restart and restore.
      expected[0].ui_visual_mode = 'classic';
      expected[1].ui_visual_mode = 'rich';
      for (const user of expected.slice(0, 2)) {
        migratedDb.prepare('UPDATE users SET ui_visual_mode=? WHERE username=?').run(user.ui_visual_mode, user.username);
      }
      await migratedDb.backup(backupPath);
    } finally { migratedDb.close(); }
    assert.deepEqual(migrate(), expected);
    // All connections are closed before replacing the runtime database.
    fs.copyFileSync(backupPath, dbPath);
    assert.deepEqual(migrate(), expected);
  } finally { await sandbox.stop(); }
});

test('appearance endpoints accept the catalog and keep glass through startup migrations', async () => {
  const sandbox = await createSandbox({ name: 'appearance' });
  try {
    const user = createSession(sandbox.baseUrl); await user.register(makeUser('glass'));
    for (const theme of catalog.themes) {
      const response = await user.request('/api/user/theme', { method: 'PATCH', json: { theme: theme.id } });
      assert.equal(response.data.user.ui_theme, theme.id);
    }
    for (const mode of catalog.modes) {
      const response = await user.request('/api/user/visual-mode', { method: 'PATCH', json: { mode: mode.id } });
      assert.equal(response.data.user.ui_visual_mode, mode.id);
    }
    await user.request('/api/user/visual-mode', { method: 'PATCH', json: { mode: 'bogus' }, expectedStatus: 400 });
    await user.request('/api/user/theme', { method: 'PATCH', json: { theme: 'bogus' }, expectedStatus: 400 });
    await stopSandbox({ pid: sandbox.pid });
    const result = spawnSync(process.execPath, ['-e', "const db=require('./db'); const u=db.prepare('SELECT ui_theme,ui_visual_mode FROM users WHERE username=?').get(process.argv[1]); console.log(JSON.stringify({u,integrity:db.pragma('integrity_check',{simple:true})})); db.close();", user.user.username], { cwd: sandbox.appDir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const value = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.deepEqual(value.u, { ui_theme: 'banan-cream', ui_visual_mode: 'glass' });
    assert.equal(value.integrity, 'ok');
  } finally { await sandbox.stop(); }
});

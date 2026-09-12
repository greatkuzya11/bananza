const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const { createSandbox, stopSandbox } = require('../support/runtimeSandbox');
const { createSession, makeUser } = require('../support/api');
const catalog = require('../../public/js/appearance');

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

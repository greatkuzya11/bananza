const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');

let sandbox;

test('admin backup restore previews archives, stays admin-only, and applies recovery admin without exiting in test mode', async () => {
  sandbox = await createSandbox({
    name: 'backup-restore',
    env: {
      BANANZA_TEST_RESTORE_NO_EXIT: '1',
    },
  });

  try {
    const scenario = await createBasicChatScenario(sandbox.baseUrl);
    const { admin, bob } = scenario;
    const uploaded = await admin.uploadTextFile('restore-note.txt', 'restore payload');

    const exportResponse = await fetch(`${sandbox.baseUrl}/api/admin/backup/export`, {
      headers: {
        Authorization: `Bearer ${admin.token}`,
      },
    });
    assert.equal(exportResponse.status, 200);
    const archiveBuffer = Buffer.from(await exportResponse.arrayBuffer());

    function archiveForm() {
      const form = new FormData();
      form.append('backup', new Blob([archiveBuffer], { type: 'application/gzip' }), 'backup.tar.gz');
      return form;
    }

    const forbidden = await bob.request('/api/admin/backup/restore/preview', {
      method: 'POST',
      formData: archiveForm(),
      expectedStatus: 403,
    });
    assert.equal(forbidden.data.error, 'Admin only');

    const preview = await admin.request('/api/admin/backup/restore/preview', {
      method: 'POST',
      formData: archiveForm(),
    });
    assert.match(preview.data.restore_id, /^[a-f0-9]{32}$/);
    assert.equal(preview.data.manifest.included.database, 'bananza.db');
    assert.equal(preview.data.includes.database, true);
    assert.equal(preview.data.includes.uploads, true);
    assert.equal(preview.data.database.users >= 2, true);
    assert.equal(preview.data.uploads.files >= 1, true);

    const wrongConfirm = await admin.request('/api/admin/backup/restore/apply', {
      method: 'POST',
      json: {
        restore_id: preview.data.restore_id,
        confirm: 'NOPE',
        recovery_admin: {
          username: 'restore_admin',
          password: 'restore-password',
        },
      },
      expectedStatus: 400,
    });
    assert.equal(wrongConfirm.data.error, 'Type RESTORE to confirm');

    const shortPassword = await admin.request('/api/admin/backup/restore/apply', {
      method: 'POST',
      json: {
        restore_id: preview.data.restore_id,
        confirm: 'RESTORE',
        recovery_admin: {
          username: 'restore_admin',
          password: 'short',
        },
      },
      expectedStatus: 400,
    });
    assert.equal(shortPassword.data.error, 'Password: 6-100 characters');

    const applied = await admin.request('/api/admin/backup/restore/apply', {
      method: 'POST',
      json: {
        restore_id: preview.data.restore_id,
        confirm: 'RESTORE',
        recovery_admin: {
          username: 'restore_admin',
          password: 'restore-password',
        },
      },
    });
    assert.equal(applied.data.ok, true);
    assert.equal(applied.data.restart_required, true);
    assert.equal(applied.data.login_required, true);
    assert.equal(applied.data.recovery_admin.username, 'restore_admin');

    const rollbackDir = applied.data.rollback_dir;
    assert.equal(fs.existsSync(path.join(rollbackDir, 'bananza.db')), true);
    assert.equal(fs.existsSync(path.join(rollbackDir, 'uploads')), true);

    const restoredDb = new Database(path.join(sandbox.appDir, 'bananza.db'), { readonly: true });
    try {
      const recovery = restoredDb.prepare('SELECT password,is_admin,is_blocked FROM users WHERE username=?').get('restore_admin');
      assert.ok(recovery);
      assert.equal(recovery.is_admin, 1);
      assert.equal(recovery.is_blocked, 0);
      assert.equal(await bcrypt.compare('restore-password', recovery.password), true);
      const fileRow = restoredDb.prepare('SELECT stored_name FROM files WHERE id=?').get(uploaded.id);
      assert.ok(fileRow);
      assert.equal(fs.existsSync(path.join(sandbox.appDir, 'uploads', fileRow.stored_name)), true);
    } finally {
      restoredDb.close();
    }
  } finally {
    await sandbox.stop();
    sandbox = null;
  }
});

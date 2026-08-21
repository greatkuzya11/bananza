const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');
const { createBot: createTelegramBot, readBot: readTelegramBot, getBotToken } = require('../../telegramTranscription/settings');

let sandbox;

function tinyPngBuffer() {
  return Buffer.from(
    '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360606060000000040001F61738550000000049454E44AE426082',
    'hex'
  );
}

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
    const liveDb = new Database(path.join(sandbox.appDir, 'bananza.db'));
    let initiativeRuleId;
    let telegramBotId;
    const telegramImageUpdateId = 987654;
    try {
      const chat = liveDb.prepare('SELECT id FROM chats ORDER BY id ASC LIMIT 1').get();
      const bot = liveDb.prepare(`
        INSERT INTO ai_bots(name, mention, enabled)
        VALUES('Backup initiative bot', 'backup_initiative_bot', 1)
      `).run();
      initiativeRuleId = Number(liveDb.prepare(`
        INSERT INTO ai_bot_initiative_rules(name, chat_id, bot_id, prompt_mode)
        VALUES('Backup initiative rule', ?, ?, 'idle_ping')
      `).run(chat.id, bot.lastInsertRowid).lastInsertRowid);
      const sandboxSecret = fs.readFileSync(path.join(sandbox.appDir, '.secret'), 'utf8').trim();
      const telegramBot = createTelegramBot(liveDb, {
        name: 'Backup Telegram bot',
        transcription_enabled: true,
        image_generation_enabled: true,
        generate_image_from_transcription: true,
        image_bot_id: Number(bot.lastInsertRowid),
        bot_token: '123456:backup-telegram-token',
        allowed_user_ids: ['777'],
      }, sandboxSecret);
      telegramBotId = telegramBot.id;
      liveDb.prepare(`
        INSERT INTO telegram_image_generation_jobs(
          telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
          language_code, prompt_text, image_bot_id, image_bot_name, status,
          image_data, image_mime_type, image_file_name
        ) VALUES(?, ?, '777', '777', 42, 'ru', 'backup image prompt', ?, 'Backup image bot',
          'delivering', ?, 'image/png', 'backup-image.png')
      `).run(telegramBotId, telegramImageUpdateId, bot.lastInsertRowid, tinyPngBuffer());
    } finally {
      liveDb.close();
    }
    const uploaded = await admin.uploadTextFile('restore-note.txt', 'restore payload');
    const documentChat = await admin.request('/api/documents', {
      method: 'POST',
      json: { title: 'Restore Image Doc' },
    });
    const documentImageForm = new FormData();
    documentImageForm.append('file', new Blob([tinyPngBuffer()], { type: 'image/png' }), 'restore-document-image.png');
    const documentImage = await admin.request(`/api/documents/${documentChat.data.id}/images`, {
      method: 'POST',
      formData: documentImageForm,
    });

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
      const documentAssetRow = restoredDb.prepare(`
        SELECT da.chat_id, da.file_id, da.kind, f.stored_name
        FROM document_assets da
        JOIN files f ON f.id=da.file_id
        WHERE da.id=?
      `).get(documentImage.data.asset.id);
      const newsSource = restoredDb.prepare('SELECT name, url FROM ai_news_sources WHERE url=?').get('https://lenta.ru/rss/top7');
      const initiativeRule = restoredDb.prepare('SELECT name FROM ai_bot_initiative_rules WHERE id=?').get(initiativeRuleId);
      const telegramImageJob = restoredDb.prepare('SELECT * FROM telegram_image_generation_jobs WHERE update_id=?').get(telegramImageUpdateId);
      const telegramSettings = readTelegramBot(restoredDb, telegramBotId);
      const restoredSecret = fs.readFileSync(path.join(sandbox.appDir, '.secret'), 'utf8').trim();
      assert.ok(fileRow);
      assert.equal(fs.existsSync(path.join(sandbox.appDir, 'uploads', fileRow.stored_name)), true);
      assert.ok(documentAssetRow);
      assert.equal(documentAssetRow.chat_id, documentChat.data.id);
      assert.equal(documentAssetRow.file_id, documentImage.data.asset.fileId);
      assert.equal(documentAssetRow.kind, 'image');
      assert.equal(documentAssetRow.stored_name, documentImage.data.asset.stored_name);
      assert.equal(fs.existsSync(path.join(sandbox.appDir, 'uploads', documentImage.data.asset.stored_name)), true);
      assert.equal(newsSource.name, 'Lenta.ru top7');
      assert.equal(initiativeRule.name, 'Backup initiative rule');
      assert.equal(telegramSettings.image_generation_enabled, true);
      assert.equal(telegramSettings.generate_image_from_transcription, true);
      assert.equal(telegramSettings.image_bot_id, telegramImageJob.image_bot_id);
      assert.equal(getBotToken(restoredDb, telegramBotId, restoredSecret), '123456:backup-telegram-token');
      assert.equal(telegramImageJob.status, 'delivering');
      assert.equal(telegramImageJob.prompt_text, 'backup image prompt');
      assert.deepEqual(telegramImageJob.image_data, tinyPngBuffer());
      assert.equal(restoredDb.pragma('integrity_check', { simple: true }), 'ok');
    } finally {
      restoredDb.close();
    }
  } finally {
    await sandbox.stop();
    sandbox = null;
  }
});

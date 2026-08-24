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
    const callRecordingsDir = path.join(sandbox.appDir, 'external-call-recordings');
    const modelsDir = path.join(sandbox.appDir, 'external-speech-models');
    const completedRecordingPath = path.join(callRecordingsDir, 'call-1', 'mixed.ogg');
    const modelPath = path.join(modelsDir, 'ggml-backup-test.bin');
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
        universal_enabled: true,
        universal_bot_id: Number(bot.lastInsertRowid),
        bot_token: '123456:backup-telegram-token',
        allowed_user_ids: ['777'],
      }, sandboxSecret);
      telegramBotId = telegramBot.id;
      const telegramStoredImagePath = path.posix.join('telegram', String(telegramBotId), 'backup-image.png');
      const telegramStoredImageFile = path.join(sandbox.appDir, 'uploads', ...telegramStoredImagePath.split('/'));
      fs.mkdirSync(path.dirname(telegramStoredImageFile), { recursive: true });
      fs.writeFileSync(telegramStoredImageFile, tinyPngBuffer());
      liveDb.prepare(`
        INSERT INTO telegram_image_generation_jobs(
          telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
          language_code, prompt_text, image_bot_id, image_bot_name, operation_kind, status,
          source_file_id, source_file_unique_id, source_file_name, source_mime_type, source_file_size,
          image_data, image_mime_type, image_file_name, stored_image_path
        ) VALUES(?, ?, '777', '777', 42, 'ru', 'backup image prompt', ?, 'Backup image bot',
          'universal_edit', 'delivering', 'telegram-source-id', 'telegram-source-unique', 'source.png',
          'image/png', 1234, ?, 'image/png', 'backup-image.png', ?)
      `).run(telegramBotId, telegramImageUpdateId, bot.lastInsertRowid, tinyPngBuffer(), telegramStoredImagePath);
      const adminRow = liveDb.prepare('SELECT id FROM users WHERE is_admin=1 ORDER BY id ASC LIMIT 1').get();
      const call = liveDb.prepare(`
        INSERT INTO call_sessions(chat_id, livekit_room_name, started_by)
        VALUES(?, 'backup-restore-call-room', ?)
      `).run(chat.id, adminRow.id);
      fs.mkdirSync(path.dirname(completedRecordingPath), { recursive: true });
      fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(completedRecordingPath, 'completed call recording');
      fs.writeFileSync(modelPath, 'speech model');
      liveDb.prepare(`
        INSERT INTO call_recordings(call_id, user_id, scope, file_path, status)
        VALUES(?, ?, 'mixed', ?, 'completed')
      `).run(call.lastInsertRowid, adminRow.id, completedRecordingPath);
      liveDb.prepare(`
        INSERT INTO app_settings(key, value, updated_at) VALUES(?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
      `).run('call_settings', JSON.stringify({ call_recording_path: callRecordingsDir }));
      liveDb.prepare(`
        INSERT INTO app_settings(key, value, updated_at) VALUES(?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
      `).run('voice_settings', JSON.stringify({ whisper_models_dir: modelsDir, vosk_model_path: modelsDir }));
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

    fs.writeFileSync(path.join(sandbox.appDir, '.env'), 'BACKUP_ENV=1\n');
    const exportResponse = await fetch(`${sandbox.baseUrl}/api/admin/backup/export?components=env,call_recordings,voice_models`, {
      headers: {
        Authorization: `Bearer ${admin.token}`,
      },
    });
    assert.equal(exportResponse.status, 200);
    const archiveBuffer = Buffer.from(await exportResponse.arrayBuffer());
    fs.writeFileSync(path.join(sandbox.appDir, '.env'), 'CURRENT_ENV=1\n');
    fs.writeFileSync(completedRecordingPath, 'current recording');
    fs.writeFileSync(modelPath, 'current model');

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
    assert.equal(preview.data.optional_components.env.status, 'included');
    assert.equal(preview.data.optional_components.call_recordings.files, 1);
    assert.equal(preview.data.optional_components.voice_models.files >= 1, true);

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
        restore_components: ['env', 'call_recordings', 'voice_models'],
      },
    });
    assert.equal(applied.data.ok, true);
    assert.equal(applied.data.restart_required, true);
    assert.equal(applied.data.login_required, true);
    assert.equal(applied.data.recovery_admin.username, 'restore_admin');

    const rollbackDir = applied.data.rollback_dir;
    assert.equal(fs.existsSync(path.join(rollbackDir, 'bananza.db')), true);
    assert.equal(fs.existsSync(path.join(rollbackDir, 'uploads')), true);
    assert.equal(fs.readFileSync(path.join(sandbox.appDir, '.env'), 'utf8'), 'BACKUP_ENV=1\n');
    assert.equal(fs.readFileSync(completedRecordingPath, 'utf8'), 'completed call recording');
    assert.equal(fs.readFileSync(modelPath, 'utf8'), 'speech model');

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
      assert.equal(telegramSettings.universal_enabled, true);
      assert.equal(telegramSettings.universal_bot_id, telegramImageJob.image_bot_id);
      assert.equal(getBotToken(restoredDb, telegramBotId, restoredSecret), '123456:backup-telegram-token');
      assert.equal(telegramImageJob.status, 'delivering');
      assert.equal(telegramImageJob.prompt_text, 'backup image prompt');
      assert.equal(telegramImageJob.operation_kind, 'universal_edit');
      assert.equal(telegramImageJob.source_file_id, 'telegram-source-id');
      assert.equal(telegramImageJob.source_file_unique_id, 'telegram-source-unique');
      assert.equal(telegramImageJob.source_file_name, 'source.png');
      assert.equal(telegramImageJob.source_mime_type, 'image/png');
      assert.equal(telegramImageJob.source_file_size, 1234);
      assert.deepEqual(telegramImageJob.image_data, tinyPngBuffer());
      assert.equal(telegramImageJob.stored_image_path, path.posix.join('telegram', String(telegramBotId), 'backup-image.png'));
      assert.equal(fs.existsSync(path.join(sandbox.appDir, 'uploads', ...telegramImageJob.stored_image_path.split('/'))), true);
      assert.equal(restoredDb.pragma('integrity_check', { simple: true }), 'ok');
    } finally {
      restoredDb.close();
    }
  } finally {
    await sandbox.stop();
    sandbox = null;
  }
});

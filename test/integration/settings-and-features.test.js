const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { before, after } = require('node:test');
const Database = require('better-sqlite3');
const tar = require('tar');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario, sleep } = require('../support/scenario');

let sandbox;
let scenario;

before(async () => {
  sandbox = await createSandbox({ name: 'settings-features' });
  scenario = await createBasicChatScenario(sandbox.baseUrl);
});

after(async () => {
  await sandbox?.stop?.();
});

async function createOpenAiBot(admin, {
  name,
  mention,
  visibleToUsers = true,
} = {}) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const botName = name || `Bot ${token}`.slice(0, 30);
  const botMention = mention || `bot_${token}`.slice(0, 24);
  const response = await admin.request('/api/admin/ai-bots', {
    method: 'POST',
    json: {
      name: botName,
      mention: botMention,
      enabled: true,
      visible_to_users: visibleToUsers,
      response_model: 'gpt-4o-mini',
      summary_model: 'gpt-4o-mini',
    },
  });
  return response.data.bot;
}

test('weather, notification and sound settings use deterministic mocked integrations', async () => {
  const { bob } = scenario;

  const soundSettings = await bob.request('/api/sound-settings', {
    method: 'PUT',
    json: {
      sounds_enabled: false,
      volume: 82,
      play_mentions: false,
    },
  });
  assert.equal(soundSettings.data.settings.volume, 82);
  assert.equal(soundSettings.data.settings.play_mentions, false);

  const weatherSearch = await bob.request('/api/weather/search', {
    searchParams: { q: 'moscow' },
  });
  assert.equal(weatherSearch.data.results.length, 1);

  const weatherSave = await bob.request('/api/weather/settings', {
    method: 'PUT',
    json: {
      enabled: true,
      refresh_minutes: 35,
      location: weatherSearch.data.results[0],
    },
  });
  assert.equal(weatherSave.data.settings.enabled, true);
  assert.equal(weatherSave.data.settings.location.name, 'Moscow');

  const weatherCurrent = await bob.request('/api/weather/current', {
    searchParams: { force: 1 },
  });
  assert.equal(weatherCurrent.data.enabled, true);
  assert.equal(weatherCurrent.data.temperature, 21.5);

  const subscription = {
    endpoint: 'https://push.test/subscription',
    keys: {
      p256dh: 'mock-p256dh',
      auth: 'mock-auth',
    },
  };
  const pushSubscribed = await bob.request('/api/push/subscribe', {
    method: 'POST',
    json: { subscription },
  });
  assert.equal(pushSubscribed.data.ok, true);

  const pushSettings = await bob.request('/api/notification-settings', {
    method: 'PUT',
    json: {
      push_enabled: true,
      notify_messages: true,
      notify_mentions: true,
    },
  });
  assert.equal(pushSettings.data.settings.push_enabled, true);

  const pushTest = await bob.request('/api/push/test', {
    method: 'POST',
    json: {},
  });
  assert.equal(pushTest.data.ok, true);
  assert.equal(pushTest.data.sent, 1);
});

test('admin backup export downloads a complete archive and stays admin-only', async () => {
  const { admin, bob } = scenario;
  const uploaded = await admin.uploadTextFile('backup-note.txt', 'Backup export payload');
  const invite = await admin.request(`/api/chats/${scenario.groupChat.id}/invite-link`);

  const forbidden = await bob.request('/api/admin/backup/export', {
    expectedStatus: 403,
  });
  assert.equal(forbidden.data.error, 'Admin only');

  const forbiddenStream = await bob.request('/api/admin/backup/export', {
    searchParams: { mode: 'stream' },
    expectedStatus: 403,
  });
  assert.equal(forbiddenStream.data.error, 'Admin only');

  async function assertBackupDownload({ mode, expectedArchiveMode }) {
    const suffix = mode ? `?mode=${mode}` : '';
    const response = await fetch(`${sandbox.baseUrl}/api/admin/backup/export${suffix}`, {
      headers: {
        Authorization: `Bearer ${admin.token}`,
      },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition') || '', /bananza-backup-.*\.tar\.gz/);
    assert.match(response.headers.get('content-type') || '', /application\/gzip|application\/x-gzip|application\/octet-stream/);

    const archivePath = path.join(sandbox.rootDir, `downloaded-backup-${expectedArchiveMode}.tar.gz`);
    fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));

    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bananza-backup-test-'));
    try {
      await tar.extract({ file: archivePath, cwd: extractDir });

      const manifestPath = path.join(extractDir, 'backup-manifest.json');
      const dbPath = path.join(extractDir, 'bananza.db');
      assert.ok(fs.existsSync(manifestPath));
      assert.ok(fs.existsSync(dbPath));
      assert.ok(fs.existsSync(path.join(extractDir, 'uploads')));
      assert.ok(fs.existsSync(path.join(extractDir, 'uploads', uploaded.stored_name)));
      assert.ok(fs.existsSync(path.join(extractDir, '.secret')));
      assert.ok(fs.existsSync(path.join(extractDir, '.vapid.json')));
      assert.equal(fs.existsSync(path.join(extractDir, '.env')), false);
      assert.equal(fs.existsSync(path.join(extractDir, 'node_modules')), false);
      assert.equal(fs.existsSync(path.join(extractDir, '.git')), false);
      assert.equal(fs.existsSync(path.join(extractDir, 'bananza.db-wal')), false);
      assert.equal(fs.existsSync(path.join(extractDir, 'bananza.db-shm')), false);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.equal(manifest.archive.mode, expectedArchiveMode);
      assert.equal(manifest.included.database, 'bananza.db');
      assert.equal(manifest.included.uploads, 'uploads/');
      assert.ok(manifest.included.secrets.includes('.secret'));
      assert.ok(manifest.included.secrets.includes('.vapid.json'));
      assert.ok(manifest.excluded.includes('.env'));
      assert.ok(manifest.excluded.includes('bananza.db-wal'));
      assert.ok(manifest.uploads.files >= 1);

      const backupDb = new Database(dbPath, { readonly: true });
      try {
        assert.equal(backupDb.pragma('integrity_check', { simple: true }), 'ok');
        const userCount = backupDb.prepare('SELECT COUNT(*) AS count FROM users').get().count;
        const fileRow = backupDb.prepare('SELECT stored_name FROM files WHERE id = ?').get(uploaded.id);
        const newsSource = backupDb.prepare('SELECT name, url FROM ai_news_sources WHERE url = ?').get('https://lenta.ru/rss/top7');
        const inviteRow = backupDb.prepare('SELECT invite_token, invite_token_created_at FROM chats WHERE id = ?').get(scenario.groupChat.id);
        assert.ok(userCount >= 2);
        assert.equal(fileRow.stored_name, uploaded.stored_name);
        assert.equal(newsSource.name, 'Lenta.ru top7');
        assert.equal(inviteRow.invite_token, invite.data.token);
        assert.ok(inviteRow.invite_token_created_at);
      } finally {
        backupDb.close();
      }

      const form = new FormData();
      form.append(
        'backup',
        new Blob([fs.readFileSync(archivePath)], { type: 'application/gzip' }),
        'backup.tar.gz'
      );
      const preview = await admin.request('/api/admin/backup/restore/preview', {
        method: 'POST',
        formData: form,
      });
      assert.equal(preview.data.includes.database, true);
      assert.equal(preview.data.manifest.archive.mode, expectedArchiveMode);
    } finally {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  }

  await assertBackupDownload({ mode: '', expectedArchiveMode: 'file' });
  await assertBackupDownload({ mode: 'stream', expectedArchiveMode: 'stream' });
});

test('chat folder strip visibility is stored on the user account and exposed via auth/me', async () => {
  const { bob } = scenario;

  const before = await bob.request('/api/auth/me');
  assert.equal(before.data.user.ui_show_chat_folder_strip_in_all_chats, false);

  const updated = await bob.request('/api/user/chat-folder-strip-visibility', {
    method: 'PATCH',
    json: {
      show_in_all_chats: true,
    },
  });
  assert.equal(updated.data.user.ui_show_chat_folder_strip_in_all_chats, true);

  const after = await bob.request('/api/auth/me');
  assert.equal(after.data.user.ui_show_chat_folder_strip_in_all_chats, true);
});

test('interface language defaults to ru and can be stored on the user account', async () => {
  const { bob } = scenario;

  const before = await bob.request('/api/auth/me');
  assert.equal(before.data.user.ui_language, 'ru');

  const updated = await bob.request('/api/user/language', {
    method: 'PATCH',
    json: { language: 'en' },
  });
  assert.equal(updated.data.user.ui_language, 'en');

  const after = await bob.request('/api/auth/me');
  assert.equal(after.data.user.ui_language, 'en');

  const invalid = await bob.request('/api/user/language', {
    method: 'PATCH',
    json: { language: 'de' },
    expectedStatus: 400,
  });
  assert.equal(invalid.data.error, 'Unknown interface language');

  await bob.request('/api/user/language', {
    method: 'PATCH',
    json: { language: 'ru' },
  });
});

test('recent emojis are stored per user and capped', async () => {
  const { bob } = scenario;

  const before = await bob.request('/api/user/recent-emojis');
  assert.deepEqual(before.data.emojis, []);

  const first = await bob.request('/api/user/recent-emojis', {
    method: 'POST',
    json: { emoji: '😀' },
  });
  assert.deepEqual(first.data.emojis, ['😀']);

  await bob.request('/api/user/recent-emojis', {
    method: 'POST',
    json: { emoji: '🔥' },
  });
  await sleep(5);

  const repeated = await bob.request('/api/user/recent-emojis', {
    method: 'POST',
    json: { emoji: '😀' },
  });
  assert.equal(repeated.data.emojis[0], '😀');
  assert.equal(repeated.data.emojis.filter((emoji) => emoji === '😀').length, 1);

  const many = [
    '😃','😄','😁','😆','😅','😂','🙂','😉',
    '😊','😍','🤩','😘','😋','😜','🤪','🤔',
    '😎','🥳','😭','😡','👍','👎','❤️','🎉',
    '🍕','🌿','🚗','💡','🔣','🏳️','🐶','🍌','⚡',
  ];
  let capped = repeated;
  for (const emoji of many) {
    capped = await bob.request('/api/user/recent-emojis', {
      method: 'POST',
      json: { emoji },
    });
  }
  assert.equal(capped.data.emojis.length, 32);
  assert.equal(new Set(capped.data.emojis).size, 32);

  const qip = await bob.request('/api/user/recent-emojis', {
    method: 'POST',
    json: { emoji: ':qip-infium-001:' },
  });
  assert.equal(qip.data.emojis[0], ':qip-infium-001:');
  assert.equal(qip.data.emojis.length, 32);

  const qipHd = await bob.request('/api/user/recent-emojis', {
    method: 'POST',
    json: { emoji: ':qip-hd-qippda-aa:' },
  });
  assert.equal(qipHd.data.emojis[0], ':qip-hd-qippda-aa:');
  assert.equal(qipHd.data.emojis.length, 32);

  const invalidQip = await bob.request('/api/user/recent-emojis', {
    method: 'POST',
    json: { emoji: ':qip-infium-999:' },
    expectedStatus: 400,
  });
  assert.equal(invalidQip.data.error, 'Invalid emoji');
  const malformedQip = await bob.request('/api/user/recent-emojis', {
    method: 'POST',
    json: { emoji: ':qip-infium-1:' },
    expectedStatus: 400,
  });
  assert.equal(malformedQip.data.error, 'Invalid emoji');
  const invalidQipHd = await bob.request('/api/user/recent-emojis', {
    method: 'POST',
    json: { emoji: ':qip-hd-nope:' },
    expectedStatus: 400,
  });
  assert.equal(invalidQipHd.data.error, 'Invalid emoji');
  const malformedQipHd = await bob.request('/api/user/recent-emojis', {
    method: 'POST',
    json: { emoji: ':qip-hd-:' },
    expectedStatus: 400,
  });
  assert.equal(malformedQipHd.data.error, 'Invalid emoji');

  const invalid = await bob.request('/api/user/recent-emojis', {
    method: 'POST',
    json: { emoji: 'not-an-emoji' },
    expectedStatus: 400,
  });
  assert.equal(invalid.data.error, 'Invalid emoji');
});

test('voice and AI admin settings routes stay isolated and usable locally', async () => {
  const { admin, bob } = scenario;

  const featuresBefore = await bob.request('/api/features');
  assert.equal(featuresBefore.data.voice_notes_enabled, false);

  const voiceSettings = await admin.request('/api/admin/voice-settings', {
    method: 'PUT',
    json: {
      voice_notes_enabled: true,
      auto_transcribe_on_send: false,
      active_provider: 'grok',
      grok_api_key: 'grok-test-key',
    },
  });
  assert.equal(voiceSettings.data.publicSettings.voice_notes_enabled, true);

  const featuresAfter = await bob.request('/api/features');
  assert.equal(featuresAfter.data.voice_notes_enabled, true);

  const voiceModelTest = await admin.request('/api/admin/voice-settings/test-model', {
    method: 'POST',
    json: {
      active_provider: 'grok',
      grok_api_key: 'grok-test-key',
    },
  });
  assert.equal(voiceModelTest.data.ok, true);
  assert.equal(voiceModelTest.data.result.provider, 'grok');

  const aiState = await admin.request('/api/admin/ai-bots');
  assert.ok(aiState.data.settings);

  const aiSaved = await admin.request('/api/admin/ai-bots/settings', {
    method: 'PUT',
    json: {
      enabled: true,
      openai_interactive_enabled: true,
      openai_api_key: 'sk-ai-test',
      default_response_model: 'gpt-5.4',
    },
  });
  assert.equal(aiSaved.data.settings.enabled, true);
  assert.equal(aiSaved.data.settings.openai_interactive_enabled, true);
});

test('admin users API hides AI bot-backed users and rejects admin actions for them', async () => {
  const { admin } = scenario;
  const db = new Database(path.join(sandbox.appDir, 'bananza.db'));
  const suffix = Date.now();

  try {
    const insertUser = db.prepare(`
      INSERT INTO users(username, password, display_name, is_admin, is_blocked, is_ai_bot, avatar_color)
      VALUES(?,?,?,?,?,?,?)
    `);
    const humanUserId = Number(insertUser.run(
      `human_admin_${suffix}`,
      'human-placeholder-password',
      `Human Admin ${suffix}`,
      0,
      0,
      0,
      '#4f8cff'
    ).lastInsertRowid);
    const botUserId = Number(insertUser.run(
      `ai_admin_${suffix}`,
      'bot-placeholder-password',
      `AI Admin ${suffix}`,
      0,
      0,
      1,
      '#8892a0'
    ).lastInsertRowid);

    const adminUsers = await admin.request('/api/admin/users');
    assert.ok(adminUsers.data.some((user) => user.id === humanUserId));
    assert.ok(adminUsers.data.every((user) => user.id !== botUserId));

    const humanBlock = await admin.request(`/api/admin/users/${humanUserId}/block`, {
      method: 'POST',
    });
    assert.equal(humanBlock.data.is_blocked, 1);

    const humanReset = await admin.request(`/api/admin/users/${humanUserId}/reset-password`, {
      method: 'POST',
    });
    assert.equal(humanReset.data.ok, true);

    const botBlock = await admin.request(`/api/admin/users/${botUserId}/block`, {
      method: 'POST',
      expectedStatus: 400,
    });
    assert.equal(botBlock.data.error, 'AI bots are managed from the AI bot settings');

    const botReset = await admin.request(`/api/admin/users/${botUserId}/reset-password`, {
      method: 'POST',
      expectedStatus: 400,
    });
    assert.equal(botReset.data.error, 'AI bots are managed from the AI bot settings');
  } finally {
    db.close();
  }
});

test('admin users API exposes bot access flag and lets admins toggle it for human users', async () => {
  const { admin, bob } = scenario;

  const usersBefore = await admin.request('/api/admin/users');
  const bobBefore = usersBefore.data.find((user) => user.id === bob.user.id);
  assert.ok(bobBefore);
  assert.equal(Object.prototype.hasOwnProperty.call(bobBefore, 'can_add_bots_to_chats'), true);
  assert.equal(bobBefore.can_add_bots_to_chats, 0);

  const toggledOn = await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
    method: 'PUT',
    json: { can_add_bots_to_chats: true },
  });
  assert.equal(toggledOn.data.can_add_bots_to_chats, 1);

  const usersAfterOn = await admin.request('/api/admin/users');
  const bobAfterOn = usersAfterOn.data.find((user) => user.id === bob.user.id);
  assert.equal(bobAfterOn.can_add_bots_to_chats, 1);

  const toggledOff = await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
    method: 'PUT',
    json: { can_add_bots_to_chats: false },
  });
  assert.equal(toggledOff.data.can_add_bots_to_chats, 0);
});

test('AI bot export and import preserve visible_to_users for chat bots', async () => {
  const { admin } = scenario;
  const created = await createOpenAiBot(admin, { visibleToUsers: true });

  const exported = await admin.request(`/api/admin/ai-bots/${created.id}/export`);
  assert.equal(exported.data.schema_version, 5);
  assert.equal(exported.data.bot.visible_to_users, true);

  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const imported = await admin.request('/api/admin/ai-bots/import', {
    method: 'POST',
    json: {
      bot: {
        name: `Imported ${token}`.slice(0, 30),
        mention: `imp_${token}`.slice(0, 24),
        enabled: true,
        visible_to_users: true,
        response_model: 'gpt-4o-mini',
        summary_model: 'gpt-4o-mini',
      },
    },
  });
  assert.equal(imported.data.bot.visible_to_users, true);
});

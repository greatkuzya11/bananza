const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { before, after } = require('node:test');
const Database = require('better-sqlite3');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');

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

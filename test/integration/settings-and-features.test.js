const test = require('node:test');
const assert = require('node:assert/strict');
const { before, after } = require('node:test');

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

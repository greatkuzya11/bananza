const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installAppBridge,
  loadBrowserScript,
} = require('../support/domHarness');

function waitTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function payload(overrides = {}) {
  return {
    settings: {
      enabled: false,
      has_bot_token: false,
      masked_bot_token: '',
      bot_id: '',
      bot_name: '',
      bot_username: '',
      allowed_user_ids: [],
      active_provider: 'whisper',
      fallback_to_openai: false,
      context_bot_enabled: false,
      context_bot_id: null,
      transcription_timeout_ms: 120000,
      max_file_size_bytes: 20 * 1024 * 1024,
      vosk_model: 'vosk-model-small-ru-0.22',
      vosk_model_path: '',
      whisper_model: 'ggml-tiny.bin',
      whisper_language: 'ru',
      openai_model: 'gpt-4o-mini-transcribe',
      openai_language: 'ru',
      grok_language: 'ru',
      ...(overrides.settings || {}),
    },
    options: {
      providers: [
        { value: 'vosk', label: 'Vosk' },
        { value: 'whisper', label: 'Whisper' },
        { value: 'openai', label: 'OpenAI' },
        { value: 'grok', label: 'Grok' },
      ],
      models: {
        vosk: [{ value: 'vosk-model-small-ru-0.22', label: 'Vosk small' }],
        whisper: [{ value: 'ggml-tiny.bin', label: 'Whisper tiny' }],
        openai: [{ value: 'gpt-4o-mini-transcribe', label: 'OpenAI mini' }],
        grok: [{ value: 'speech-to-text', label: 'Grok STT' }],
      },
    },
    contextConvertBots: [{ id: 42, name: 'Cleanup', provider: 'openai', enabled: true, provider_enabled: true }],
    providerReadiness: { vosk: true, whisper: true, openai: true, grok: true, fallback_openai: true, ffmpeg: true },
    runtime: { state: 'stopped', running: false, webhook_conflict: false, queue: { total: 0 } },
    ...overrides,
  };
}

test('Telegram transcription admin connects bot and saves independent provider settings', async (t) => {
  const dom = createAppDom();
  t.after(() => dom.window.close());
  let current = payload();
  let savedBody = null;
  let testedBody = null;

  installAppBridge(dom, {
    t: (key, params = {}) => Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      String(key)
    ),
    async api(url, options = {}) {
      if (url === '/api/admin/telegram-transcription' && options.method === 'PUT') {
        savedBody = options.body;
        current = payload({
          settings: {
            ...current.settings,
            ...options.body,
            allowed_user_ids: String(options.body.allowed_user_ids || '').split(/\s+/).filter(Boolean),
            enabled: true,
            has_bot_token: true,
            masked_bot_token: '123...oken',
            bot_id: '99',
            bot_name: 'BananZa STT',
            bot_username: 'bananza_stt_bot',
          },
          runtime: { state: 'polling', running: true, webhook_conflict: false, queue: { total: 0 } },
        });
        return current;
      }
      if (url === '/api/admin/telegram-transcription') return current;
      if (url === '/api/admin/telegram-transcription/test-bot') {
        testedBody = options.body;
        return {
          ok: true,
          bot: { id: '99', name: 'BananZa STT', username: 'bananza_stt_bot' },
          webhook: { active: false, pending_update_count: 0, last_error_message: '' },
        };
      }
      return {};
    },
  });

  loadBrowserScript(dom, 'public/js/telegram-transcription.js');
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await waitTick();

  const entry = dom.window.document.getElementById('settingsTelegramTranscription');
  assert.ok(entry);
  assert.equal(entry.classList.contains('hidden'), false);
  entry.click();
  await waitTick();
  await waitTick();

  const ordinaryActions = [
    dom.window.document.querySelector('a[href="https://t.me/BotFather"]'),
    dom.window.document.getElementById('telegramTranscriptionDeleteToken'),
    dom.window.document.getElementById('telegramTranscriptionClaim'),
    dom.window.document.getElementById('telegramTranscriptionOpenVoice'),
  ];
  assert.ok(ordinaryActions.every((node) => node?.classList.contains('weather-action-btn')));
  assert.ok(ordinaryActions.every((node) => !node?.classList.contains('btn-text')));

  dom.window.document.getElementById('telegramTranscriptionToken').value = '123:new-token';
  dom.window.document.getElementById('telegramTranscriptionTestBot').click();
  await waitTick();
  await waitTick();

  assert.equal(testedBody.bot_token, '123:new-token');
  const botTestStatus = dom.window.document.getElementById('telegramTranscriptionBotTestStatus');
  assert.equal(botTestStatus.classList.contains('success'), true);
  assert.match(botTestStatus.textContent, /BananZa STT @bananza_stt_bot/);
  assert.match(dom.window.document.getElementById('telegramTranscriptionBotIdentity').textContent, /bananza_stt_bot/);

  dom.window.document.getElementById('telegramTranscriptionAllowlist').value = '777\n888';
  const provider = dom.window.document.getElementById('telegramTranscriptionProvider');
  provider.value = 'openai';
  provider.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  dom.window.document.getElementById('telegramTranscriptionModel').value = 'gpt-4o-mini-transcribe';
  dom.window.document.getElementById('telegramTranscriptionLanguage').value = 'en';
  dom.window.document.getElementById('telegramTranscriptionContextEnabled').checked = true;
  dom.window.document.getElementById('telegramTranscriptionContextBot').value = '42';
  dom.window.document.getElementById('telegramTranscriptionConnect').click();
  await waitTick();
  await waitTick();
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(savedBody.enabled, true);
  assert.equal(savedBody.bot_token, '123:new-token');
  assert.equal(savedBody.active_provider, 'openai');
  assert.equal(savedBody.openai_model, 'gpt-4o-mini-transcribe');
  assert.equal(savedBody.openai_language, 'en');
  assert.equal(savedBody.context_bot_id, 42);
  assert.equal(current.settings.bot_username, 'bananza_stt_bot');
  const adminStatus = dom.window.document.getElementById('telegramTranscriptionAdminStatus');
  assert.equal(adminStatus.classList.contains('error'), false, adminStatus.textContent);
  assert.match(dom.window.document.getElementById('telegramTranscriptionBotIdentity').textContent, /bananza_stt_bot/);
  assert.match(dom.window.document.getElementById('telegramTranscriptionTokenState').textContent, /123\.\.\.oken/);

  dom.window.document.getElementById('telegramTranscriptionClose').click();
});

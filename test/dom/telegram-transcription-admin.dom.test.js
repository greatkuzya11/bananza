const test = require('node:test');
const assert = require('node:assert/strict');

const { createAppDom, installAppBridge, loadBrowserScript } = require('../support/domHarness');

function tick(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bot(id, overrides = {}) {
  return {
    id,
    name: `Telegram bot ${id}`,
    has_bot_token: true,
    masked_bot_token: '123...oken',
    telegram_api_bot_id: String(900 + id),
    telegram_bot_name: `Remote ${id}`,
    telegram_bot_username: `remote_${id}`,
    allowed_user_ids: ['777'],
    transcription_enabled: true,
    image_generation_enabled: false,
    active_provider: 'whisper',
    fallback_to_openai: false,
    context_bot_enabled: false,
    context_bot_id: null,
    image_bot_id: null,
    transcription_timeout_ms: 120000,
    max_file_size_bytes: 20 * 1024 * 1024,
    vosk_model: 'vosk-model-small-ru-0.22',
    vosk_model_path: '',
    whisper_model: 'ggml-tiny.bin',
    whisper_language: 'ru',
    openai_model: 'gpt-4o-mini-transcribe',
    openai_language: 'ru',
    grok_language: 'ru',
    providerReadiness: { vosk: true, whisper: true, openai: true, grok: true, fallback_openai: true },
    runtime: { state: 'polling', queue: { total: 0, transcription: 0, images: 0 } },
    ...overrides,
  };
}

function payload(bots = [bot(1)], selectedBotId = null) {
  return {
    bots,
    selected_bot_id: selectedBotId,
    options: {
      providers: ['vosk', 'whisper', 'openai', 'grok'].map((value) => ({ value, label: value })),
      models: {
        vosk: [{ value: 'vosk-model-small-ru-0.22', label: 'Vosk small' }],
        whisper: [{ value: 'ggml-tiny.bin', label: 'Whisper tiny' }],
        openai: [{ value: 'gpt-4o-mini-transcribe', label: 'OpenAI mini' }],
        grok: [{ value: 'speech-to-text', label: 'Grok STT' }],
      },
    },
    contextConvertBots: [{ id: 42, name: 'Cleanup', provider: 'openai', enabled: true, provider_enabled: true }],
    imageBots: [{ id: 17, name: 'Painter', provider: 'openai', image_model: 'gpt-image-2', enabled: true, provider_enabled: true, allow_image_generate: true }],
  };
}

test('Telegram bots admin edits capabilities and creates a second independent bot', async (t) => {
  const dom = createAppDom();
  t.after(() => dom.window.close());
  let current = payload();
  const calls = [];

  installAppBridge(dom, {
    t: (key, params = {}) => Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), String(key)
    ),
    async api(url, options = {}) {
      calls.push({ url, options });
      if (url === '/api/admin/telegram-bots' && !options.method) return current;
      if (url === '/api/admin/telegram-bots/test-token') {
        return { ok: true, bot: { id: '902', name: 'Remote 2', username: 'remote_2' }, webhook: { active: false } };
      }
      if (url === '/api/admin/telegram-bots/1' && options.method === 'PUT') {
        current = payload([bot(1, {
          ...options.body,
          allowed_user_ids: ['777', '888'],
          image_generation_enabled: true,
          image_bot_id: 17,
        })], 1);
        return current;
      }
      if (url === '/api/admin/telegram-bots' && options.method === 'POST') {
        current = payload([bot(1), bot(2, {
          name: options.body.name,
          transcription_enabled: options.body.transcription_enabled,
          image_generation_enabled: options.body.image_generation_enabled,
        })], 2);
        return current;
      }
      return current;
    },
  });

  loadBrowserScript(dom, 'public/js/telegram-transcription.js');
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await tick();

  const entry = dom.window.document.getElementById('settingsTelegramBots');
  assert.ok(entry);
  assert.equal(entry.classList.contains('hidden'), false);
  entry.click();
  await tick();
  await tick();

  assert.equal(dom.window.document.querySelectorAll('[data-telegram-bot-id]').length, 1);
  assert.equal(dom.window.document.getElementById('telegramBotName').value, 'Telegram bot 1');
  dom.window.document.getElementById('telegramBotAllowlist').value = '777\n888';
  dom.window.document.getElementById('telegramBotImageEnabled').checked = true;
  dom.window.document.getElementById('telegramBotImageEnabled').dispatchEvent(new dom.window.Event('change'));
  const chainedToggle = dom.window.document.getElementById('telegramBotTranscriptImageToggle');
  assert.equal(chainedToggle.classList.contains('hidden'), false);
  dom.window.document.getElementById('telegramBotGenerateImageFromTranscription').checked = true;
  dom.window.document.getElementById('telegramBotImageBot').value = '17';
  dom.window.document.getElementById('telegramBotsSave').click();
  await tick(20);

  const update = calls.find((call) => call.url === '/api/admin/telegram-bots/1' && call.options.method === 'PUT');
  assert.ok(update);
  assert.equal(update.options.body.image_generation_enabled, true);
  assert.equal(update.options.body.generate_image_from_transcription, true);
  assert.equal(update.options.body.image_bot_id, 17);
  assert.match(update.options.body.allowed_user_ids, /888/);

  dom.window.document.getElementById('telegramBotsNew').click();
  dom.window.document.getElementById('telegramBotName').value = 'Second bot';
  dom.window.document.getElementById('telegramBotToken').value = '456:new-token';
  dom.window.document.getElementById('telegramBotTestToken').click();
  await tick(10);
  assert.match(dom.window.document.getElementById('telegramBotIdentity').textContent, /remote_2/);
  dom.window.document.getElementById('telegramBotImageEnabled').checked = true;
  dom.window.document.getElementById('telegramBotImageEnabled').dispatchEvent(new dom.window.Event('change'));
  dom.window.document.getElementById('telegramBotsSave').click();
  await tick(20);

  const create = calls.find((call) => call.url === '/api/admin/telegram-bots' && call.options.method === 'POST');
  assert.ok(create);
  assert.equal(create.options.body.name, 'Second bot');
  assert.equal(create.options.body.bot_token, '456:new-token');
  assert.equal(dom.window.document.querySelectorAll('[data-telegram-bot-id]').length, 2);
  dom.window.document.getElementById('telegramBotsClose').click();
});

test('Telegram bot history opens from settings, filters user operations, and clears terminal history', async (t) => {
  const dom = createAppDom();
  t.after(() => dom.window.close());
  const calls = [];
  const history = {
    items: [{
      kind: 'combined', record_id: 9, image_job_id: 9,
      telegram_user_id: '777', telegram_user_username: 'alice', telegram_user_display_name: 'Alice',
      transcript_text: 'Voice transcript', prompt_text: 'Voice transcript', has_image: false,
      status: 'completed', transcription_status: 'completed', image_status: 'completed',
      provider: 'openai', model: 'gpt-image-2', created_at: '2026-08-21 12:00:00', completed_at: '2026-08-21 12:01:00', error: null,
    }],
    users: [{ telegram_user_id: '777', telegram_user_username: 'alice', telegram_user_display_name: 'Alice', count: 1 }],
    page: 1, limit: 25, total: 1, total_pages: 1,
  };
  dom.window.confirm = () => true;
  installAppBridge(dom, {
    t: (key, params = {}) => Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), String(key)
    ),
    async api(url, options = {}) {
      calls.push({ url, options });
      if (url === '/api/admin/telegram-bots' && !options.method) return payload();
      if (url.startsWith('/api/admin/telegram-bots/1/history?')) return history;
      if (url === '/api/admin/telegram-bots/1/history' && options.method === 'DELETE') {
        return { ok: true, cleared: { images: 1, transcriptions: 1, files: 1 } };
      }
      return payload();
    },
  });
  loadBrowserScript(dom, 'public/js/telegram-transcription.js');
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await tick();
  dom.window.document.getElementById('settingsTelegramBots').click();
  await tick();
  dom.window.document.getElementById('telegramBotsHistory').click();
  await tick();
  await tick();

  const historyModal = dom.window.document.getElementById('telegramBotHistoryModal');
  assert.equal(historyModal.classList.contains('hidden'), false);
  assert.match(dom.window.document.getElementById('telegramHistoryList').textContent, /Voice transcript/);
  assert.match(dom.window.document.getElementById('telegramHistoryList').textContent, /Transcription result \/ Image prompt/);
  assert.equal(dom.window.document.querySelectorAll('#telegramHistoryList details').length, 1);
  assert.equal(dom.window.document.getElementById('telegramHistoryUser').value, '');
  dom.window.document.getElementById('telegramHistoryUser').value = '777';
  dom.window.document.getElementById('telegramHistoryUser').dispatchEvent(new dom.window.Event('change'));
  await tick();
  assert.ok(calls.some((call) => call.url.includes('history?page=1&limit=25&user_id=777')));

  dom.window.document.getElementById('telegramHistoryClear').click();
  await tick();
  assert.ok(calls.some((call) => call.url === '/api/admin/telegram-bots/1/history' && call.options.method === 'DELETE'));
});

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
    settings: { enabled: false, image_bot_id: 17, ...(overrides.settings || {}) },
    telegram: {
      configured: true,
      bot_id: '99',
      bot_name: 'BananZa Bot',
      bot_username: 'bananza_bot',
      allowed_user_count: 2,
      ...(overrides.telegram || {}),
    },
    imageBots: [{
      id: 17,
      name: 'Painter',
      provider: 'openai',
      image_model: 'gpt-image-2',
      enabled: true,
      provider_enabled: true,
      allow_image_generate: true,
    }],
    runtime: {
      state: 'polling',
      queue: { total: 1, image: { total: 1, queued: 1, processing: 0, delivering: 0 } },
    },
    ...overrides,
  };
}

test('Telegram image generation admin saves selection and runs a real model test', async (t) => {
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
      if (url === '/api/admin/telegram-image-generation' && options.method === 'PUT') {
        savedBody = options.body;
        current = payload({ settings: { enabled: true, image_bot_id: Number(options.body.image_bot_id) } });
        return current;
      }
      if (url === '/api/admin/telegram-image-generation/test') {
        testedBody = options.body;
        return { ok: true, provider: 'openai', model: 'gpt-image-2', latency_ms: 321, mime_type: 'image/png', bytes: 4567 };
      }
      if (url === '/api/admin/telegram-image-generation') return current;
      return {};
    },
  });

  loadBrowserScript(dom, 'public/js/telegram-image-generation.js');
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await waitTick();

  const entry = dom.window.document.getElementById('settingsTelegramImageGeneration');
  assert.ok(entry);
  assert.equal(entry.classList.contains('hidden'), false);
  entry.click();
  await waitTick();
  await waitTick();

  assert.match(dom.window.document.getElementById('telegramImageGenerationTelegramState').textContent, /bananza_bot/);
  assert.match(dom.window.document.getElementById('telegramImageGenerationRuntime').textContent, /1/);
  assert.equal(dom.window.document.getElementById('telegramImageGenerationBot').value, '17');

  dom.window.document.getElementById('telegramImageGenerationTest').click();
  await waitTick();
  await waitTick();
  assert.equal(testedBody.image_bot_id, 17);
  assert.match(dom.window.document.getElementById('telegramImageGenerationStatus').textContent, /gpt-image-2/);
  assert.match(dom.window.document.getElementById('telegramImageGenerationStatus').textContent, /4567/);

  dom.window.document.getElementById('telegramImageGenerationEnabled').checked = true;
  dom.window.document.getElementById('telegramImageGenerationSave').click();
  await waitTick();
  await waitTick();
  assert.equal(savedBody.enabled, true);
  assert.equal(savedBody.image_bot_id, 17);

  dom.window.document.getElementById('telegramImageGenerationClose').click();
});

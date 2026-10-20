const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppDom, loadBrowserScript } = require('../support/domHarness');

function setup(t, api) {
  const dom = createAppDom();
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  const opened = [];
  dom.window.BananzaAppBridge = {
    api,
    getCurrentUser: () => ({ id: 1, is_admin: true }),
    getCurrentChatId: () => 7,
    getCurrentLanguage: () => 'en',
    tx: (text) => text,
    registerManagedModal() {},
    openManagedModal: (id) => doc.getElementById(id).classList.remove('hidden'),
    closeManagedModal: (id) => doc.getElementById(id).classList.add('hidden'),
    closeAllModals: () => doc.getElementById('botImageHistoryModal').classList.add('hidden'),
    openChat: (id, options) => opened.push({ id, options }),
  };
  loadBrowserScript(dom, 'public/js/bot-image-history.js');
  return { dom, doc, opened, history: dom.window.BananzaBotImages };
}
function image(id) {
  return { id, chat_id: 7, prompt: '<img src=x onerror=alert(1)>', created_at: '2026-10-20 12:00:00', requested_by: { id: 3, display_name: '<b>Alice</b>', username: 'alice' }, file_url: `/uploads/image-${id}.png` };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('history renders safe captions, loads further pages and opens the source message', async (t) => {
  const calls = [];
  const { doc, history, opened } = setup(t, async (url) => {
    calls.push(url);
    return { bot: { name: 'Qwen' }, images: [image(calls.length === 1 ? 20 : 10)], next_before: calls.length === 1 ? 20 : null };
  });
  await history.open(4);
  assert.equal(doc.querySelectorAll('#botImageHistoryGrid img').length, 1);
  assert.equal(doc.querySelector('#botImageHistoryGrid p').textContent, image(20).prompt);
  assert.equal(doc.querySelector('#botImageHistoryGrid p img'), null);
  assert.equal(doc.querySelector('.bot-image-history-requester').textContent, 'Requested by: <b>Alice</b> (@alice)');
  assert.equal(doc.querySelector('.bot-image-history-requester b'), null);
  assert.match(doc.querySelector('#botImageHistoryGrid a').href, /image-20.png\/preview$/);
  doc.getElementById('botImageHistoryMore').click();
  await tick();
  assert.match(calls[1], /before=20/);
  assert.equal(doc.querySelectorAll('#botImageHistoryGrid img').length, 2);
  assert.equal(doc.getElementById('botImageHistoryMore').classList.contains('hidden'), true);
  doc.querySelector('#botImageHistoryGrid button').click();
  assert.equal(opened[0].id, 7);
  assert.equal(opened[0].options.anchorMessageId, 20);
});

test('switching bots cannot let an older response replace the new gallery', async (t) => {
  let resolveOld;
  const { doc, history } = setup(t, (url) => {
    if (url.includes('/1/')) return new Promise((resolve) => { resolveOld = resolve; });
    return Promise.resolve({ bot: { name: 'Second' }, images: [image(99)], next_before: null });
  });
  const old = history.open(1);
  await history.open(2);
  resolveOld({ bot: { name: 'First' }, images: [image(1)], next_before: null });
  await old;
  assert.equal(doc.querySelectorAll('#botImageHistoryGrid img').length, 1);
  assert.match(doc.querySelector('#botImageHistoryGrid img').src, /image-99/);
  assert.match(doc.getElementById('botImageHistoryTitle').textContent, /Second/);
});

test('chat history selects a bot and failed requests can be retried', async (t) => {
  let attempts = 0;
  const { doc, history } = setup(t, async (url) => {
    if (url.endsWith('/members')) return [
      { is_ai_bot: 1, ai_bot_id: 1, display_name: 'One' },
      { is_ai_bot: 1, ai_bot_id: 2, display_name: 'Two' },
    ];
    if (++attempts === 1) throw new Error('offline');
    return { bot: { name: 'Two' }, images: [], next_before: null };
  });
  await history.openForChat();
  assert.equal(doc.querySelectorAll('#botImageHistoryBots button').length, 2);
  doc.querySelectorAll('#botImageHistoryBots button')[1].click();
  await tick();
  assert.equal(doc.getElementById('botImageHistoryStatus').textContent, 'Could not load image history');
  assert.equal(doc.getElementById('botImageHistoryMore').disabled, false);
  doc.getElementById('botImageHistoryMore').click();
  await tick();
  assert.equal(doc.getElementById('botImageHistoryStatus').textContent, 'No images yet');
});

test('Qwen Images remains safe before lazy AI helpers load and renders the normal bot editor afterwards', async (t) => {
  const state = {
    settings: { local_image_enabled: true, local_image_base_url: 'http://127.0.0.1:1234', local_image_default_model: 'qwen-image', local_image_default_size: '1024x1024', local_image_timeout_ms: 600000 },
    bots: [{ id: 8, name: 'Image bot', mention: 'image', image_resolution: '1024x1024', enabled: true, allow_image_edit: true }],
    models: { size: ['1024x1024'] }, chats: [], chatSettings: [],
  };
  const { dom, doc } = setup(t, async () => state);
  let languageChange;
  dom.window.BananzaApp = { aiAdmin: {} };
  dom.window.BananzaAppBridge.onLanguageChange = (listener) => { languageChange = listener; };
  loadBrowserScript(dom, 'public/js/local-image.js');
  assert.doesNotThrow(() => languageChange());
  loadBrowserScript(dom, 'public/js/app/ai-admin/shared.js');
  doc.getElementById('qwenAiOpenImageBots').click();
  await tick();
  assert.equal(doc.getElementById('localImageBotName').value, 'Image bot');
  assert.ok(doc.querySelector('#localImageBotList [data-bot-history-id="8"]'));
  assert.equal(doc.getElementById('localImageBotAvatarInput').disabled, false);
  doc.getElementById('localImageNewBot').click();
  assert.equal(doc.getElementById('localImageBotAvatarInput').disabled, true);
  assert.equal(doc.getElementById('localImageBotHistory').disabled, true);
  assert.equal(doc.getElementById('localImageBotGenerate').checked, true);
});

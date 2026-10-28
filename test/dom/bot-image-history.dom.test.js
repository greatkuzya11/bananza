const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppDom, loadBrowserScript } = require('../support/domHarness');

function setup(t, api, { admin = true } = {}) {
  const dom = createAppDom();
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  const opened = [];
  const galleries = [];
  dom.window.BananzaAppBridge = {
    api,
    getCurrentUser: () => ({ id: 1, is_admin: admin }),
    getCurrentChatId: () => 7,
    getCurrentChat: () => ({ id: 7, type: 'group' }),
    getCurrentLanguage: () => 'en',
    tx: (text, params = {}) => text.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? key),
    registerManagedModal() {},
    openManagedModal: (id) => doc.getElementById(id).classList.remove('hidden'),
    closeManagedModal: (id) => doc.getElementById(id).classList.add('hidden'),
    closeAllModals: () => doc.getElementById('botImageHistoryModal').classList.add('hidden'),
    openChat: (id, options) => opened.push({ id, options }),
    openMediaViewer: (src, type, options) => galleries.push({ src, type, options }),
  };
  loadBrowserScript(dom, 'public/js/bot-image-history.js');
  return { dom, doc, opened, galleries, history: dom.window.BananzaBotImages };
}
const requester = { id: 3, display_name: '<b>Alice</b>', username: 'alice' };
function image(id, access = true) {
  return { id, chat_id: access ? 7 : null, can_open_chat: access, prompt: '<img src=x onerror=alert(1)>', created_at: '2026-10-20 12:00:00', requested_by: requester, file_url: '/uploads/image-' + id + '.png' };
}
function payload(images = [], extra = {}) {
  return { bot: { name: 'Qwen' }, images, users: [requester], page: 1, total_pages: 1, total: images.length, limit: 25, ...extra };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('history pages safely render all users, navigate accessible chats and open the page gallery', async (t) => {
  const calls = [];
  const { doc, history, opened, galleries } = setup(t, async (url) => {
    calls.push(url);
    return url.includes('page=2') ? payload([image(10)], { page: 2, total_pages: 2 })
      : payload([image(20, false), image(19)], { total_pages: 2 });
  });
  await history.open(4);
  assert.equal(doc.querySelectorAll('#botImageHistoryGrid img').length, 2);
  assert.equal(doc.querySelector('#botImageHistoryGrid p').textContent, image(20).prompt);
  assert.equal(doc.querySelector('#botImageHistoryGrid p img'), null);
  assert.equal(doc.querySelector('.bot-image-history-requester').textContent, 'Requested by: <b>Alice</b> (@alice)');
  assert.equal(doc.querySelector('.bot-image-history-requester b'), null);
  assert.equal(doc.querySelector('#botImageHistoryGrid a'), null);
  assert.equal(doc.querySelectorAll('#botImageHistoryGrid figcaption button').length, 1);
  doc.querySelectorAll('.bot-image-history-preview')[1].click();
  assert.equal(galleries[0].options.initialIndex, 1);
  assert.deepEqual(Array.from(galleries[0].options.items, (item) => item.id), ['20', '19']);
  assert.match(galleries[0].src, /image-19.png\/preview$/);
  assert.equal(doc.getElementById('botImageHistoryModal').classList.contains('hidden'), false);
  assert.equal(doc.getElementById('botImageHistoryPage').textContent, 'Page 1 of 2');
  assert.equal(doc.getElementById('botImageHistoryPrevious').disabled, true);
  doc.getElementById('botImageHistoryNext').click();
  await tick();
  assert.match(calls[1], /page=2&limit=25/);
  assert.equal(doc.querySelectorAll('#botImageHistoryGrid img').length, 1);
  assert.equal(doc.getElementById('botImageHistoryNext').disabled, true);
  doc.querySelector('#botImageHistoryGrid figcaption button').click();
  assert.equal(opened[0].id, 7);
  assert.equal(opened[0].options.anchorMessageId, 10);
});

test('filter resets the page and late page/filter responses cannot replace current results', async (t) => {
  let resolveOld;
  const calls = [];
  const { dom, doc, history } = setup(t, (url) => {
    calls.push(url);
    if (url.includes('page=2')) return new Promise((resolve) => { resolveOld = resolve; });
    return Promise.resolve(payload([image(url.includes('user_id=3') ? 99 : 20)], { total_pages: 2 }));
  });
  await history.open(4);
  doc.getElementById('botImageHistoryNext').click();
  const select = doc.getElementById('botImageHistoryUser');
  select.value = '3';
  select.dispatchEvent(new dom.window.Event('change'));
  await tick();
  assert.match(calls[2], /page=1&limit=25&user_id=3/);
  resolveOld(payload([image(10)], { page: 2, total_pages: 2 }));
  await tick();
  assert.match(doc.querySelector('#botImageHistoryGrid img').src, /image-99/);
  assert.equal(select.value, '3');
  assert.equal(doc.getElementById('botImageHistoryPage').textContent, 'Page 1 of 2');
});

test('switching bots and closing the modal ignore pending responses', async (t) => {
  let resolveOld;
  const { doc, history } = setup(t, (url) => {
    if (url.includes('/1/')) return new Promise((resolve) => { resolveOld = resolve; });
    return Promise.resolve(payload([image(99)], { bot: { name: 'Second' } }));
  });
  const old = history.open(1);
  await history.open(2);
  resolveOld(payload([image(1)]));
  await old;
  assert.match(doc.querySelector('#botImageHistoryGrid img').src, /image-99/);
  assert.match(doc.getElementById('botImageHistoryTitle').textContent, /Second/);
  const pending = history.open(1);
  doc.getElementById('botImageHistoryClose').click();
  await tick();
  resolveOld(payload([image(1)]));
  await pending;
  assert.equal(doc.querySelectorAll('#botImageHistoryGrid img').length, 0);
});

test('history opened from bot settings retries failed requests', async (t) => {
  let attempts = 0;
  const { doc, history } = setup(t, async (url) => {
    assert.match(url, /\/api\/ai-bots\/2\/images\?/);
    if (++attempts === 1) throw new Error('offline');
    return payload();
  });
  await history.open(2);
  assert.equal(doc.getElementById('botImageHistoryStatus').textContent, 'Could not load image history');
  assert.equal(doc.getElementById('botImageHistoryRetry').classList.contains('hidden'), false);
  doc.getElementById('botImageHistoryRetry').click();
  await tick();
  assert.equal(doc.getElementById('botImageHistoryStatus').textContent, 'No images yet');
  assert.equal(doc.getElementById('botImageHistoryRetry').classList.contains('hidden'), true);
});

test('history entrypoints and list buttons are admin-only and type restricted', async (t) => {
  const { dom, doc, history } = setup(t, () => assert.fail('Non-admin must not request history'), { admin: false });
  loadBrowserScript(dom, 'public/js/app/ai-admin/shared.js');
  const render = dom.window.BananzaApp.aiAdmin.shared.renderBotHistoryButton;
  for (const kind of ['image', 'universal', 'chatshot', 'text', 'convert']) assert.equal(render({ id: 1, kind }), '');
  await history.open(1);
  assert.equal(doc.getElementById('botImageHistoryChat'), null);
  assert.equal(doc.getElementById('botImageHistoryModal').classList.contains('hidden'), true);
  dom.window.BananzaAppBridge.getCurrentUser = () => ({ id: 1, is_admin: true });
  for (const kind of ['image', 'universal', 'chatshot']) {
    assert.match(render({ id: 1, kind }), /data-bot-history-id="1"/);
  }
  for (const kind of ['text', 'convert', '', undefined]) {
    assert.equal(render({ id: 1, kind }), '');
  }
});

test('unavailable images show a fallback and are omitted from the fullscreen gallery', async (t) => {
  const { dom, doc, history, galleries } = setup(t, async () => payload([image(1), image(2)]));
  await history.open(4);
  doc.querySelector('#botImageHistoryGrid img').dispatchEvent(new dom.window.Event('error'));
  assert.equal(doc.querySelector('.bot-image-history-preview').disabled, true);
  assert.equal(doc.querySelector('.bot-image-history-preview').textContent, 'Image file is unavailable');
  doc.querySelectorAll('.bot-image-history-preview')[1].click();
  assert.deepEqual(Array.from(galleries[0].options.items, (item) => item.id), ['2']);
});

test('Qwen Images remains safe before lazy AI helpers load and renders the normal bot editor afterwards', async (t) => {
  const state = {
    settings: { local_image_enabled: true, local_image_base_url: 'http://127.0.0.1:1234', local_image_default_model: 'qwen-image', local_image_default_size: '1024x1024', local_image_timeout_ms: 600000 },
    bots: [{ id: 8, kind: 'image', name: 'Image bot', mention: 'image', image_resolution: '1024x1024', enabled: true, allow_image_edit: true }],
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

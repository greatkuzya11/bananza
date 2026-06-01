const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  createAppDom,
  installVisualViewportMock,
  loadAppRuntimeScripts,
  loadAppScript,
  loadBrowserScript,
} = require('../support/domHarness');
const { repoRoot } = require('../support/paths');

function jsonResponse(dom, data, init = {}) {
  return new dom.window.Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  });
}

function loadAiAdminRuntime({ risk = null } = {}) {
  const dom = createAppDom();
  if (risk) dom.window.BananzaAiImageRisk = risk;
  dom.window.HTMLAnchorElement.prototype.click = function click() {};
  loadAppRuntimeScripts(dom);
  return dom;
}

function createApiRecorder(dom) {
  const calls = [];
  const state = {
    settings: {},
    bots: [{ id: 11, name: 'Bot', mention: 'bot', enabled: true }],
    imageBots: [{ id: 12, name: 'Image', mention: 'image', kind: 'image', enabled: true }],
    universalBots: [{ id: 13, name: 'Universal', mention: 'universal', kind: 'universal', enabled: true }],
    chats: [{ id: 7, name: 'Chat', type: 'group' }],
    chatSettings: [],
    models: { response: ['model-a'], image: ['image-a'] },
  };
  async function api(url, options = {}) {
    calls.push({ url, options });
    if (String(url).includes('/test')) return { result: { text: 'ok', latencyMs: 1 } };
    if (String(url).includes('/chat-settings')) return { state };
    if (options.method === 'DELETE') return { state };
    if (options.method === 'POST' || options.method === 'PUT') return { state, bot: { id: 11, ...options.body } };
    return state;
  }
  return { api, calls };
}

test('ai-admin modules publish expected namespaces', () => {
  const dom = loadAiAdminRuntime();
  const aiAdmin = dom.window.BananzaApp.aiAdmin;
  const admin = dom.window.BananzaApp.admin;

  assert.equal(typeof admin.botAudit.createBotAuditController, 'function');
  assert.equal(typeof admin.backup.createBackupController, 'function');
  assert.equal(typeof admin.users.createAdminUsersController, 'function');
  assert.equal(typeof aiAdmin.shared.uniqueAiModelValues, 'function');
  assert.equal(typeof aiAdmin.openai.createOpenAiAdmin, 'function');
  assert.equal(typeof aiAdmin.yandex.createYandexAdmin, 'function');
  assert.equal(typeof aiAdmin.deepseek.createDeepseekAdmin, 'function');
  assert.equal(typeof aiAdmin.qwen.createQwenAdmin, 'function');
  assert.equal(typeof aiAdmin.grok.createGrokAdmin, 'function');
  assert.equal(typeof aiAdmin.contextConvert.createContextConvertAdmin, 'function');
  assert.equal(typeof aiAdmin.chatShot.createChatShotAdmin, 'function');
  assert.equal(typeof aiAdmin.grokImageRisk.createGrokImageRiskController, 'function');
  assert.equal(typeof aiAdmin.modals.openOpenAiTextBotsModal, 'function');
  assert.equal(typeof aiAdmin.modals.openGrokImageBotsModal, 'function');
  assert.equal(typeof aiAdmin.modals.openContextConvertBotsModal, 'function');
  assert.equal(typeof aiAdmin.modals.createFinalAppRuntime, 'undefined');
  assert.equal(typeof dom.window.BananzaApp.runtime.createAppRuntime, 'function');
});

test('provider controllers create, render, and call expected endpoints', async () => {
  const dom = loadAiAdminRuntime();
  const aiAdmin = dom.window.BananzaApp.aiAdmin;
  const { api, calls } = createApiRecorder(dom);
  const fetchCalls = [];
  const fetchImpl = async (url, options = {}) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      status: 200,
      headers: new dom.window.Headers({ 'content-disposition': 'attachment; filename="bot.json"' }),
      blob: () => Promise.resolve(new dom.window.Blob(['{}'], { type: 'application/json' })),
    };
  };

  const providers = [
    [aiAdmin.openai.createOpenAiAdmin, '/api/admin/ai-bots'],
    [aiAdmin.yandex.createYandexAdmin, '/api/admin/yandex-ai-bots'],
    [aiAdmin.deepseek.createDeepseekAdmin, '/api/admin/deepseek-ai-bots'],
    [aiAdmin.qwen.createQwenAdmin, '/api/admin/qwen-ai-bots'],
    [aiAdmin.grok.createGrokAdmin, '/api/admin/grok-ai-bots'],
  ];

  for (const [factory, base] of providers) {
    const controller = factory({ api, fetch: fetchImpl, getToken: () => 'token' });
    assert.doesNotThrow(() => controller.renderSettings());
    await controller.loadState();
    controller.setSelectedId('text', 11);
    await controller.saveSettings({ enabled: true });
    await controller.saveBot({ name: 'Saved', mention: 'saved', enabled: true });
    await controller.testBot();
    await controller.uploadBotAvatar(new dom.window.Blob(['x'], { type: 'image/png' }));
    await controller.removeBotAvatar();
    await controller.exportBotJson();
    await controller.importBotJsonFile(new dom.window.Blob(['{"name":"Imported"}'], { type: 'application/json' }));
    await controller.saveChatBotSettings({ chatId: 7, botId: 11, enabled: true });
    assert.ok(calls.some((call) => call.url === base), `expected ${base}`);
  }

  assert.ok(fetchCalls.some((call) => /\/export$/.test(call.url)));
  assert.ok(calls.some((call) => call.url === '/api/admin/ai-bots/settings' && call.options.method === 'PUT'));
  assert.ok(calls.some((call) => call.url === '/api/admin/grok-ai-bots/11/avatar' && call.options.method === 'POST'));
});

test('generic admin bot audit and backup controllers call expected endpoints', async () => {
  const dom = loadAiAdminRuntime();
  const calls = [];
  const fetchCalls = [];
  let openedModal = '';
  const api = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/admin/users/5/bot-additions') {
      return {
        additions: [{
          bot_name: 'AuditBot',
          bot_mention: 'audit',
          chat_name: 'Room',
          chat_type: 'group',
          bot_model: 'model-a',
          source: 'group_chat_create',
          created_at: '2026-05-31T12:00:00Z',
        }],
      };
    }
    if (url === '/api/admin/users') {
      return [{
        id: 6,
        username: 'bob',
        display_name: 'Bob',
        avatar_color: '#123456',
        avatar_url: '',
        is_admin: 0,
        is_blocked: 0,
        can_add_bots_to_chats: true,
        created_at: '2026-05-31T00:00:00',
        last_activity: '2026-05-31T12:00:00Z',
      }];
    }
    if (url === '/api/admin/backup/restore/preview') {
      return {
        restore_id: 'restore-1',
        manifest: { created_at: '2026-05-31T12:00:00Z', app: { name: 'bananza', version: 'test' } },
        database: { users: 1, admins: 1, chats: 1, messages: 1, files: 1 },
        uploads: { files: 1, bytes: 10 },
        includes: { secret: true, vapid: false },
      };
    }
    return {};
  };
  const auditController = dom.window.BananzaApp.admin.botAudit.createBotAuditController({
    api,
    document: dom.window.document,
    openModal(id) { openedModal = id; },
    esc: (value) => String(value == null ? '' : value),
    avatarHtml: () => '<div class="avatar"></div>',
    formatDate: () => '2026-05-31',
    formatTime: () => '12:00',
  });
  await auditController.openAdminBotAuditModal(5, 'Alice');
  assert.equal(openedModal, 'adminBotAuditModal');
  assert.ok(calls.some((call) => call.url === '/api/admin/users/5/bot-additions'));
  assert.match(dom.window.document.getElementById('adminBotAuditList').textContent, /AuditBot/);

  const usersController = dom.window.BananzaApp.admin.users.createAdminUsersController({
    api,
    document: dom.window.document,
    openModal(id) { openedModal = id; },
    getTopModal: () => null,
    getOnlineUsers: () => new Set([6]),
    esc: (value) => String(value == null ? '' : value),
    avatarHtml: () => '<div class="avatar"></div>',
    formatDate: () => '2026-05-31',
    formatTime: () => '12:00',
    alert: () => {},
    confirm: () => true,
    openAdminBotAuditModal: () => Promise.resolve(),
  });
  await usersController.openAdminModal();
  assert.equal(openedModal, 'adminModal');
  assert.match(dom.window.document.getElementById('adminUserList').textContent, /Bob/);

  const backupFile = new Blob(['backup'], { type: 'application/gzip' });
  Object.defineProperty(backupFile, 'name', { value: 'backup.tar.gz' });
  const backupController = dom.window.BananzaApp.admin.backup.createBackupController({
    api,
    document: dom.window.document,
    window: dom.window,
    $: (selector) => {
      if (selector === '#backupRestoreFile') return { files: [backupFile], value: '' };
      return dom.window.document.querySelector(selector);
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        headers: new dom.window.Headers({ 'content-disposition': 'attachment; filename="backup.tar.gz"' }),
        blob: () => Promise.resolve(new dom.window.Blob(['backup'], { type: 'application/gzip' })),
      };
    },
    openModal() {},
    getTopModal: () => null,
    setInlineStatus(id, message, type) {
      const node = dom.window.document.getElementById(id);
      if (node) {
        node.textContent = message;
        node.dataset.type = type;
      }
    },
    tx: (text) => String(text || ''),
    esc: (value) => String(value == null ? '' : value),
    formatSize: () => '10 B',
    filenameFromContentDisposition: () => 'backup.tar.gz',
    getCurrentUser: () => ({ username: 'alice' }),
    getToken: () => 'token',
  });
  await backupController.downloadBackupExport();
  assert.equal(fetchCalls[0].url, '/api/admin/backup/export');
  assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer token');

  await backupController.previewBackupRestore();
  assert.ok(calls.some((call) => call.url === '/api/admin/backup/restore/preview' && call.options.method === 'POST'));
  await backupController.applyBackupRestore();
  assert.ok(calls.some((call) => call.url === '/api/admin/backup/restore/apply' && call.options.method === 'POST'));
});

test('context convert admin/runtime loads, caches, invalidates, and transforms', async () => {
  const dom = loadAiAdminRuntime();
  const calls = [];
  let composerText = 'make this clearer';
  const api = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/admin/openai-convert-bots') {
      return { bots: [{ id: 21, name: 'Convert' }], chats: [{ id: 7, name: 'Chat', type: 'group' }], chatSettings: [], models: { response: ['gpt'] } };
    }
    if (url === '/api/chats/7/context-convert-bots') {
      return { enabled: true, bots: [{ id: 21, name: 'Convert', provider: 'openai' }] };
    }
    if (url === '/api/chats/7/context-convert') {
      return { text: 'clearer text' };
    }
    if (url === '/api/messages/33/context-convert') {
      return { message: { id: 33, text: 'converted' } };
    }
    return { bot: { id: 21 }, bots: [{ id: 21, name: 'Convert' }] };
  };
  const applied = [];
  const controller = dom.window.BananzaApp.aiAdmin.contextConvert.createContextConvertAdmin({
    api,
    getCurrentChatId: () => 7,
    services: {
      composer: {
        getText: () => composerText,
        setText: (value) => { composerText = value; },
      },
      messages: {
        applyMessageUpdate: (message) => applied.push(message),
      },
    },
  });

  await controller.loadState('openai');
  assert.equal(controller.currentState().bots[0].name, 'Convert');
  const first = await controller.loadContextConvertAvailability(7);
  const second = await controller.loadContextConvertAvailability(7);
  assert.equal(first, second);
  assert.equal(calls.filter((call) => call.url === '/api/chats/7/context-convert-bots').length, 1);
  controller.invalidateContextConvertAvailability(7);
  await controller.loadContextConvertAvailability(7);
  assert.equal(calls.filter((call) => call.url === '/api/chats/7/context-convert-bots').length, 2);
  await controller.transformComposerTextWithContextConvertBot({ id: 21 });
  assert.equal(composerText, 'clearer text');
  await controller.transformMessageWithContextConvertBot(33, { id: 21 });
  assert.deepEqual(applied[0], { id: 33, text: 'converted' });
});

test('ChatShot state loads, form renders, generation calls endpoint, and button syncs', async () => {
  const dom = loadAiAdminRuntime();
  const calls = [];
  const api = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/chats/7/chatshot') {
      return {
        chatId: 7,
        enabled: true,
        ready: true,
        botId: 31,
        message_count: 3,
        bots: [{ id: 31, name: 'Shot', provider: 'openai' }],
      };
    }
    return { bots: [{ id: 31, name: 'Shot' }], chats: [{ id: 7, name: 'Chat' }], chatSettings: [] };
  };
  const controller = dom.window.BananzaApp.aiAdmin.chatShot.createChatShotAdmin({
    api,
    dom: dom.window.BananzaApp.dom.createDomRefs(),
    getCurrentChatId: () => 7,
  });

  const state = await controller.loadChatShotState(7);
  assert.equal(state.ready, true);
  controller.renderChatShotForm(state);
  assert.equal(dom.window.document.getElementById('chatShotBtn').classList.contains('hidden'), false);
  await controller.runChatShotGeneration();
  assert.ok(calls.some((call) => call.url === '/api/chats/7/chatshot' && call.options.method === 'POST'));
});

test('Grok image risk resolves targets and confirm modal resolves on confirm/cancel', async () => {
  const dom = loadAiAdminRuntime({
    risk: {
      analyzeAiImageRisk(prompt) {
        return { risky: /banana/i.test(prompt), matches: [{ term: 'banana' }] };
      },
    },
  });
  let modalOpened = false;
  const controller = dom.window.BananzaApp.aiAdmin.grokImageRisk.createGrokImageRiskController({
    dom: dom.window.BananzaApp.dom.createDomRefs(),
    services: {
      modals: {
        open(id) {
          if (id === 'grokImageRiskConfirmModal') modalOpened = true;
        },
      },
    },
    loadMentionTargets: async () => [{
      token: 'pic',
      bot_id: 41,
      bot_provider: 'grok',
      bot_kind: 'image',
      image_risk_filter_enabled: true,
    }],
  });

  assert.equal(dom.window.BananzaApp.aiAdmin.grokImageRisk.isGrokImageBotTarget({ bot_provider: 'grok', bot_kind: 'image' }), true);
  const risk = await controller.analyzeOutgoingGrokImageRisk('@pic banana portrait');
  assert.equal(risk.risky, true);
  const confirmPromise = controller.openGrokImageRiskConfirm(risk.matches);
  assert.equal(modalOpened, true);
  controller.confirmRisk(true);
  assert.equal(await confirmPromise, true);
  const cancelPromise = controller.openGrokImageRiskConfirm(risk.matches);
  controller.handleGrokImageRiskModalClosed();
  assert.equal(await cancelPromise, false);
});

function installBootStubs(dom) {
  const { window } = dom;
  window.localStorage.setItem('token', 'test-token');
  window.localStorage.setItem('user', JSON.stringify({ id: 1, display_name: 'Alice', is_admin: 1 }));
  installVisualViewportMock(window, { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 });
  window.alert = () => {};
  window.confirm = () => true;
  window.Notification = class Notification {
    static permission = 'default';
    static requestPermission() { return Promise.resolve('default'); }
  };
  window.navigator.serviceWorker = {
    addEventListener() {},
    register() { return Promise.resolve(); },
    getRegistration() {
      return Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(null) } });
    },
  };
  window.WebSocket = class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor() {
      this.readyState = window.WebSocket.CONNECTING;
      window.setTimeout(() => {
        this.readyState = window.WebSocket.OPEN;
        this.onopen?.();
      }, 0);
    }
    close() {
      this.readyState = window.WebSocket.CLOSED;
      this.onclose?.({ code: 1000 });
    }
    send() {}
  };
  window.fetch = async (input, options = {}) => {
    const url = new URL(String(input), window.location.href);
    if (url.pathname === '/api/auth/me') {
      return jsonResponse(dom, { user: { id: 1, display_name: 'Alice', is_admin: 1, ui_language: 'en' } });
    }
    if (url.pathname === '/api/chat-folders') return jsonResponse(dom, { folders: [] });
    if (url.pathname === '/api/chats') return jsonResponse(dom, []);
    if (url.pathname === '/api/users') return jsonResponse(dom, []);
    if (url.pathname === '/api/weather/settings') return jsonResponse(dom, { enabled: false });
    if (url.pathname === '/api/weather/current') return jsonResponse(dom, { weather: null });
    if (url.pathname === '/api/sound-settings') return jsonResponse(dom, {});
    if (url.pathname === '/api/notification-settings') return jsonResponse(dom, {});
    if (/^\/api\/chats\/\d+\/context-convert-bots$/.test(url.pathname)) return jsonResponse(dom, { enabled: false, bots: [] });
    if (/^\/api\/chats\/\d+\/chatshot$/.test(url.pathname)) return jsonResponse(dom, { enabled: false, ready: false, bots: [] });
    return jsonResponse(dom, options.method === 'POST' || options.method === 'PUT' ? {} : []);
  };
}

test('final boot loads runtime scripts, keeps bridge helpers, dispatches ready once, and launcher stays tiny', async (t) => {
  const dom = createAppDom();
  t.after(() => dom.window.close());
  installBootStubs(dom);
  let readyCount = 0;
  const ready = new Promise((resolve) => {
    dom.window.addEventListener('bananza:ready', () => {
      readyCount += 1;
      resolve();
    });
  });
  loadBrowserScript(dom, 'public/js/ai-image-risk.js');
  loadBrowserScript(dom, 'public/js/qip-infium-original.js');
  loadBrowserScript(dom, 'public/js/qip-hd.js');
  assert.doesNotThrow(() => loadAppScript(dom));
  await ready;

  assert.equal(readyCount, 1);
  assert.ok(dom.window.BananzaAppBridge);
  assert.equal(typeof dom.window.BananzaAppBridge.api, 'function');
  assert.equal(typeof dom.window.BananzaAppBridge.getCurrentUser, 'function');
  assert.equal(typeof dom.window.BananzaAppBridge.openAiBotSettingsModal, 'function');
  assert.equal(typeof dom.window.BananzaAppBridge.__testing.openChat, 'function');
  assert.equal(typeof dom.window.BananzaAppBridge.__testing.normalizeContextConvertAvailability, 'function');
  assert.equal(typeof dom.window.BananzaAppBridge.__testing.loadChatShotState, 'function');

  const appJsLines = fs.readFileSync(path.join(repoRoot, 'public/js/app.js'), 'utf8').trim().split(/\r?\n/).length;
  const modalsJsLines = fs.readFileSync(path.join(repoRoot, 'public/js/app/ai-admin/modals.js'), 'utf8').trim().split(/\r?\n/).length;
  const runtimeJsLines = fs.readFileSync(path.join(repoRoot, 'public/js/app/runtime.js'), 'utf8').trim().split(/\r?\n/).length;
  assert.ok(appJsLines < 100, `public/js/app.js line count ${appJsLines} should stay below 100`);
  assert.ok(modalsJsLines < 200, `public/js/app/ai-admin/modals.js line count ${modalsJsLines} should stay below 200`);
  assert.ok(runtimeJsLines < 800, `public/js/app/runtime.js line count ${runtimeJsLines} should stay below 800`);
});

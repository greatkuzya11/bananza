const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  createAppDom,
  installVisualViewportMock,
  loadAppAdminScripts,
  loadAppAiAdminScripts,
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
  loadAppAdminScripts(dom);
  loadAppAiAdminScripts(dom);
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

test('AI admin behavior rules textareas use the server-side maxlength', (t) => {
  const dom = createAppDom();
  t.after(() => dom.window.close());

  [
    'aiBotRules',
    'openAiUniversalBotRules',
    'deepseekAiBotRules',
    'qwenAiBotRules',
    'yandexAiBotRules',
    'grokAiBotRules',
    'grokAiImageBotRules',
    'grokAiUniversalBotRules',
  ].forEach((id) => {
    const textarea = dom.window.document.getElementById(id);
    assert.ok(textarea, `expected #${id} to exist`);
    assert.equal(textarea.getAttribute('maxlength'), '8000', `expected #${id} maxlength`);
  });
});

function installEvalExports(scope, runtimeExports) {
  Object.defineProperties(scope, Object.getOwnPropertyDescriptors(runtimeExports));
}

function escapeTestHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadAiAdminRuntimeOnly(dom, runtimeScriptPath) {
  loadBrowserScript(dom, 'public/js/app/boot/composition/export-utils.js');
  loadBrowserScript(dom, 'public/js/app/boot/composition/runtime-proxy-scope.js');
  loadBrowserScript(dom, 'public/js/app/boot/composition/ai-admin-composition.js');
  loadBrowserScript(dom, runtimeScriptPath);
}

function createLazyAiAdminScope(dom, api) {
  const { window } = dom;
  const { document } = window;
  return Object.assign(Object.create(null), {
    window,
    document,
    console,
    ctx: null,
    appDom: {},
    $: (selector, base = document) => base.querySelector(selector),
    $$: (selector, base = document) => Array.from(base.querySelectorAll(selector)),
    resolveUiTarget(targetId) {
      if (!targetId) return null;
      if (typeof targetId !== 'string') return targetId;
      return document.getElementById(targetId.replace(/^#/, '')) || document.querySelector(targetId);
    },
    tx: (text) => String(text || ''),
    t: (text) => String(text || ''),
    esc: escapeTestHtml,
    initials: (value) => String(value || '?').trim().slice(0, 2).toUpperCase() || '?',
    api,
    token: 'test-token',
    currentChatId: null,
    aiModelRefreshTriggeredByButton: false,
    aiModelCatalog: {
      response: ['gpt-5.1'],
      summary: ['gpt-4o-mini'],
      embedding: ['text-embedding-3-small'],
      image: ['gpt-image-2'],
    },
    aiBotState: {
      settings: {},
      bots: [{ id: 11, name: 'Bot', mention: 'bot', enabled: true }],
      chats: [],
      chatSettings: [],
    },
    openAiUniversalState: { settings: {}, bots: [], chats: [], chatSettings: [] },
    openAiImageState: { settings: {}, bots: [], chats: [], chatSettings: [] },
    deepseekBotState: {
      settings: {},
      bots: [{ id: 21, name: 'Deep', mention: 'deep', enabled: true }],
      chats: [],
      chatSettings: [],
      models: { response: ['deepseek-chat'], summary: ['deepseek-chat'] },
    },
    qwenBotState: { settings: {}, bots: [], chats: [], chatSettings: [], models: {} },
    yandexBotState: { settings: {}, bots: [], chats: [], chatSettings: [], models: {} },
    grokBotState: { settings: {} },
    grokUniversalState: { settings: {} },
    selectedAiBotId: 11,
    selectedOpenAiUniversalBotId: null,
    selectedOpenAiImageBotId: null,
    selectedDeepseekBotId: 21,
    selectedQwenBotId: null,
    selectedYandexBotId: null,
    composerStateController: { mentionTargetsByChat: new Map() },
    updateComposerAiOverrideState: async () => {},
    applyUserUpdate: () => {},
    refreshRenderedAiBotAvatar: () => {},
    OPENAI_IMAGE_SIZE_OPTIONS: ['1024x1024'],
    OPENAI_IMAGE_QUALITY_OPTIONS: ['auto'],
    OPENAI_IMAGE_BACKGROUND_OPTIONS: ['auto'],
    OPENAI_IMAGE_OUTPUT_OPTIONS: ['png'],
    DOCUMENT_FORMAT_OPTIONS: ['md'],
    getBotVisibilityToggle(id) {
      return !!document.getElementById(id)?.checked;
    },
    setBotVisibilityToggle(id, value) {
      const el = document.getElementById(id);
      if (el) el.checked = !!value;
    },
  });
}

function installAiAdminCompositionForTest(dom, scope) {
  const composition = dom.window.BananzaApp.boot.composition;
  installEvalExports(scope, composition.composeRuntimeProxyScope(scope));
  installEvalExports(scope, composition.composeAiAdmin(scope));
  return scope;
}

function waitForAsyncAction() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('ai-admin modules publish expected namespaces', () => {
  const dom = loadAiAdminRuntime();
  const aiAdmin = dom.window.BananzaApp.aiAdmin;
  const admin = dom.window.BananzaApp.admin;

  assert.equal(typeof admin.botAudit.createBotAuditController, 'function');
  assert.equal(typeof admin.backup.createBackupController, 'function');
  assert.equal(typeof admin.users.createAdminUsersController, 'function');
  assert.equal(typeof aiAdmin.shared.uniqueAiModelValues, 'function');
  assert.equal(typeof aiAdmin.shared.formatChatOptionLabel, 'function');
  assert.equal(typeof aiAdmin.shared.renderChatOptions, 'function');
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

test('AI admin chat option renderer uses option_label and legacy fallback', () => {
  const dom = loadAiAdminRuntime();
  const shared = dom.window.BananzaApp.aiAdmin.shared;
  const select = dom.window.document.createElement('select');

  select.innerHTML = shared.renderChatOptions([
    {
      id: 7,
      name: 'Private: Alice',
      type: 'private',
      option_label: 'Topic Plan — Alice, Bot (private)',
    },
    {
      id: 8,
      name: 'Legacy Room',
      type: 'group',
    },
  ]);

  assert.equal(shared.formatChatOptionLabel({
    id: 9,
    name: 'Computed Room',
    type: 'group',
    participant_label: 'Alice, Bot',
  }), 'Computed Room — Alice, Bot (group)');
  assert.equal(select.options[0].value, '7');
  assert.equal(select.options[0].textContent, 'Topic Plan — Alice, Bot (private)');
  assert.equal(select.options[1].value, '8');
  assert.equal(select.options[1].textContent, 'Legacy Room (group)');
});

test('OpenAI runtime saves text bots without Grok runtime formatter loaded', async () => {
  const dom = createAppDom();
  const calls = [];
  let scope = null;
  loadAiAdminRuntimeOnly(dom, 'public/js/app/ai-admin/openai-runtime.js');
  assert.equal(typeof dom.window.BananzaApp.aiAdmin.grokRuntime, 'undefined');

  scope = createLazyAiAdminScope(dom, async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/admin/ai-bots/settings') {
      return { settings: { openai_interactive_enabled: true } };
    }
    if (url === '/api/admin/ai-bots/11') {
      const bot = { id: 11, ...options.body };
      return {
        state: { settings: scope.aiBotState.settings, bots: [bot], chats: [], chatSettings: [] },
        bot,
      };
    }
    throw new Error(`Unexpected OpenAI admin request: ${url}`);
  });
  installAiAdminCompositionForTest(dom, scope);

  dom.window.document.getElementById('aiBotName').value = 'Saved';
  dom.window.document.getElementById('aiBotMention').value = 'saved';
  await scope.saveAiBot();

  const status = dom.window.document.getElementById('aiBotEditorStatus').textContent;
  assert.match(status, /interactive actions: off/);
  assert.doesNotMatch(status, /formatCapabilityState|is not a function/);
  assert.ok(calls.some((call) => call.url === '/api/admin/ai-bots/11' && call.options.method === 'PUT'));
});

test('local provider runtime saves bots without OpenAI save helpers loaded', async () => {
  const dom = createAppDom();
  const calls = [];
  let scope = null;
  loadAiAdminRuntimeOnly(dom, 'public/js/app/ai-admin/local-providers-runtime.js');
  assert.equal(typeof dom.window.BananzaApp.aiAdmin.openaiRuntime, 'undefined');

  scope = createLazyAiAdminScope(dom, async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/admin/deepseek-ai-bots/settings') {
      return { settings: { deepseek_interactive_enabled: true } };
    }
    if (url === '/api/admin/deepseek-ai-bots/21') {
      const bot = { id: 21, ...options.body };
      return {
        state: {
          settings: scope.deepseekBotState.settings,
          bots: [bot],
          chats: [],
          chatSettings: [],
          models: scope.deepseekBotState.models,
        },
        bot,
      };
    }
    throw new Error(`Unexpected DeepSeek admin request: ${url}`);
  });
  installAiAdminCompositionForTest(dom, scope);

  dom.window.document.getElementById('deepseekAiBotName').value = 'Deep Saved';
  dom.window.document.getElementById('deepseekAiBotMention').value = 'deep_saved';
  await scope.saveDeepseekBot();

  const status = dom.window.document.getElementById('deepseekAiBotEditorStatus').textContent;
  assert.match(status, /Values were saved on the server/);
  assert.match(status, /interactive actions: off/);
  assert.doesNotMatch(status, /buildVerifiedBotSaveStatus|formatCapabilityState|is not a function/);
  assert.ok(calls.some((call) => call.url === '/api/admin/deepseek-ai-bots/21' && call.options.method === 'PUT'));
});

test('AI admin chat save handlers send current form values without provider settings save', async () => {
  const cases = [
    {
      name: 'openai text',
      runtime: 'public/js/app/ai-admin/openai-runtime.js',
      stateName: 'aiBotState',
      selectedName: 'selectedAiBotId',
      renderName: 'renderAiChatBotSettings',
      saveName: 'saveAiChatBotSettings',
      chatUrl: '/api/admin/ai-bots/chat-settings',
      settingsUrl: '/api/admin/ai-bots/settings',
      bot: { id: 11, name: 'OpenAI Text', mention: 'open_text', enabled: true },
      ids: {
        chat: 'aiBotChatSelect',
        bot: 'aiBotChatBotSelect',
        enabled: 'aiBotChatEnabled',
        mode: 'aiBotChatMode',
        hot: 'aiBotChatHotLimit',
        auto: 'aiBotChatAutoReact',
      },
      expectedMode: 'hybrid',
    },
    {
      name: 'deepseek text',
      runtime: 'public/js/app/ai-admin/local-providers-runtime.js',
      stateName: 'deepseekBotState',
      selectedName: 'selectedDeepseekBotId',
      renderName: 'renderDeepseekChatBotSettings',
      saveName: 'saveDeepseekChatBotSettings',
      chatUrl: '/api/admin/deepseek-ai-bots/chat-settings',
      settingsUrl: '/api/admin/deepseek-ai-bots/settings',
      bot: { id: 21, name: 'DeepSeek Text', mention: 'deep_text', enabled: true },
      ids: {
        chat: 'deepseekAiBotChatSelect',
        bot: 'deepseekAiBotChatBotSelect',
        enabled: 'deepseekAiBotChatEnabled',
        mode: 'deepseekAiBotChatMode',
        hot: 'deepseekAiBotChatHotLimit',
        auto: 'deepseekAiBotChatAutoReact',
      },
      expectedMode: 'simple',
    },
    {
      name: 'qwen text',
      runtime: 'public/js/app/ai-admin/local-providers-runtime.js',
      stateName: 'qwenBotState',
      selectedName: 'selectedQwenBotId',
      renderName: 'renderQwenChatBotSettings',
      saveName: 'saveQwenChatBotSettings',
      chatUrl: '/api/admin/qwen-ai-bots/chat-settings',
      settingsUrl: '/api/admin/qwen-ai-bots/settings',
      bot: { id: 31, name: 'Qwen Text', mention: 'qwen_text', enabled: true },
      ids: {
        chat: 'qwenAiBotChatSelect',
        bot: 'qwenAiBotChatBotSelect',
        enabled: 'qwenAiBotChatEnabled',
        mode: 'qwenAiBotChatMode',
        hot: 'qwenAiBotChatHotLimit',
        auto: 'qwenAiBotChatAutoReact',
      },
      expectedMode: 'simple',
    },
    {
      name: 'yandex text',
      runtime: 'public/js/app/ai-admin/local-providers-runtime.js',
      stateName: 'yandexBotState',
      selectedName: 'selectedYandexBotId',
      renderName: 'renderYandexChatBotSettings',
      saveName: 'saveYandexChatBotSettings',
      chatUrl: '/api/admin/yandex-ai-bots/chat-settings',
      settingsUrl: '/api/admin/yandex-ai-bots/settings',
      bot: { id: 41, name: 'Yandex Text', mention: 'yandex_text', enabled: true },
      ids: {
        chat: 'yandexAiBotChatSelect',
        bot: 'yandexAiBotChatBotSelect',
        enabled: 'yandexAiBotChatEnabled',
        mode: 'yandexAiBotChatMode',
        hot: 'yandexAiBotChatHotLimit',
        auto: 'yandexAiBotChatAutoReact',
      },
      expectedMode: 'hybrid',
    },
  ];

  for (const item of cases) {
    const dom = createAppDom();
    const calls = [];
    const chat = { id: 7, name: 'Chat', type: 'group' };
    let scope = null;
    loadAiAdminRuntimeOnly(dom, item.runtime);
    scope = createLazyAiAdminScope(dom, async (url, options = {}) => {
      calls.push({ url, options });
      if (url === item.chatUrl) {
        const body = options.body || {};
        const mode = item.expectedMode === 'simple' ? 'simple' : (body.mode || 'simple');
        return {
          state: {
            settings: scope[item.stateName].settings || {},
            bots: [item.bot],
            chats: [chat],
            chatSettings: [{
              chat_id: body.chatId,
              bot_id: body.botId,
              enabled: !!body.enabled,
              mode,
              hot_context_limit: body.hot_context_limit,
              auto_react_on_mention: !!body.auto_react_on_mention,
            }],
            models: scope[item.stateName].models || {},
          },
        };
      }
      if (url === item.settingsUrl) {
        return {
          state: {
            settings: scope[item.stateName].settings || {},
            bots: [item.bot],
            chats: [chat],
            chatSettings: [{
              chat_id: chat.id,
              bot_id: item.bot.id,
              enabled: false,
              mode: 'simple',
              hot_context_limit: 50,
              auto_react_on_mention: false,
            }],
          },
        };
      }
      throw new Error(`Unexpected ${item.name} request: ${url}`);
    });
    installAiAdminCompositionForTest(dom, scope);

    scope[item.stateName].bots = [item.bot];
    scope[item.stateName].chats = [chat];
    scope[item.stateName].chatSettings = [];
    scope[item.selectedName] = item.bot.id;
    scope[item.renderName]();

    dom.window.document.getElementById(item.ids.chat).value = String(chat.id);
    dom.window.document.getElementById(item.ids.bot).value = String(item.bot.id);
    dom.window.document.getElementById(item.ids.enabled).checked = true;
    dom.window.document.getElementById(item.ids.mode).value = item.expectedMode;
    dom.window.document.getElementById(item.ids.hot).value = '77';
    dom.window.document.getElementById(item.ids.auto).checked = true;

    await scope[item.saveName]();

    const chatSaveCall = calls.find((call) => call.url === item.chatUrl);
    assert.ok(chatSaveCall, `expected ${item.name} chat settings request`);
    assert.equal(calls.some((call) => call.url === item.settingsUrl), false, `${item.name} should not save provider settings`);
    assert.deepEqual(JSON.parse(JSON.stringify(chatSaveCall.options.body)), {
      chatId: chat.id,
      botId: item.bot.id,
      enabled: true,
      mode: item.expectedMode,
      hot_context_limit: 77,
      auto_react_on_mention: true,
    });
    assert.equal(dom.window.document.getElementById(item.ids.hot).value, '77');
    assert.equal(dom.window.document.getElementById(item.ids.auto).checked, true);
    assert.equal(dom.window.document.getElementById(item.ids.mode).value, item.expectedMode);
  }
});

test('AI admin chat save buttons are bound and show click feedback', async () => {
  const dom = createAppDom();
  const calls = [];
  const chat = { id: 7, name: 'Chat', type: 'group' };
  let scope = null;

  loadAiAdminRuntimeOnly(dom, 'public/js/app/ai-admin/openai-runtime.js');
  loadBrowserScript(dom, 'public/js/app/ai-admin/local-providers-runtime.js');
  loadBrowserScript(dom, 'public/js/app/ai-admin/events.js');

  const cases = [
    {
      name: 'openai text',
      stateName: 'aiBotState',
      selectedName: 'selectedAiBotId',
      renderName: 'renderAiChatBotSettings',
      buttonId: 'aiBotChatSave',
      chatUrl: '/api/admin/ai-bots/chat-settings',
      settingsUrl: '/api/admin/ai-bots/settings',
      statusId: 'aiBotChatStatus',
      bot: { id: 11, name: 'OpenAI Text', mention: 'open_text', enabled: true },
      ids: {
        chat: 'aiBotChatSelect',
        bot: 'aiBotChatBotSelect',
        enabled: 'aiBotChatEnabled',
        mode: 'aiBotChatMode',
        hot: 'aiBotChatHotLimit',
        auto: 'aiBotChatAutoReact',
      },
      expectedMode: 'hybrid',
    },
    {
      name: 'deepseek text',
      stateName: 'deepseekBotState',
      selectedName: 'selectedDeepseekBotId',
      renderName: 'renderDeepseekChatBotSettings',
      buttonId: 'deepseekAiBotChatSave',
      chatUrl: '/api/admin/deepseek-ai-bots/chat-settings',
      settingsUrl: '/api/admin/deepseek-ai-bots/settings',
      statusId: 'deepseekAiBotChatStatus',
      bot: { id: 21, name: 'DeepSeek Text', mention: 'deep_text', enabled: true },
      ids: {
        chat: 'deepseekAiBotChatSelect',
        bot: 'deepseekAiBotChatBotSelect',
        enabled: 'deepseekAiBotChatEnabled',
        mode: 'deepseekAiBotChatMode',
        hot: 'deepseekAiBotChatHotLimit',
        auto: 'deepseekAiBotChatAutoReact',
      },
      expectedMode: 'simple',
    },
    {
      name: 'qwen text',
      stateName: 'qwenBotState',
      selectedName: 'selectedQwenBotId',
      renderName: 'renderQwenChatBotSettings',
      buttonId: 'qwenAiBotChatSave',
      chatUrl: '/api/admin/qwen-ai-bots/chat-settings',
      settingsUrl: '/api/admin/qwen-ai-bots/settings',
      statusId: 'qwenAiBotChatStatus',
      bot: { id: 31, name: 'Qwen Text', mention: 'qwen_text', enabled: true },
      ids: {
        chat: 'qwenAiBotChatSelect',
        bot: 'qwenAiBotChatBotSelect',
        enabled: 'qwenAiBotChatEnabled',
        mode: 'qwenAiBotChatMode',
        hot: 'qwenAiBotChatHotLimit',
        auto: 'qwenAiBotChatAutoReact',
      },
      expectedMode: 'simple',
    },
    {
      name: 'yandex text',
      stateName: 'yandexBotState',
      selectedName: 'selectedYandexBotId',
      renderName: 'renderYandexChatBotSettings',
      buttonId: 'yandexAiBotChatSave',
      chatUrl: '/api/admin/yandex-ai-bots/chat-settings',
      settingsUrl: '/api/admin/yandex-ai-bots/settings',
      statusId: 'yandexAiBotChatStatus',
      bot: { id: 41, name: 'Yandex Text', mention: 'yandex_text', enabled: true },
      ids: {
        chat: 'yandexAiBotChatSelect',
        bot: 'yandexAiBotChatBotSelect',
        enabled: 'yandexAiBotChatEnabled',
        mode: 'yandexAiBotChatMode',
        hot: 'yandexAiBotChatHotLimit',
        auto: 'yandexAiBotChatAutoReact',
      },
      expectedMode: 'hybrid',
    },
  ];

  scope = createLazyAiAdminScope(dom, async (url, options = {}) => {
    calls.push({ url, options });
    const item = cases.find((candidate) => candidate.chatUrl === url);
    if (!item) throw new Error(`Unexpected chat save request: ${url}`);
    await waitForAsyncAction();
    const body = options.body || {};
    const mode = item.expectedMode === 'simple' ? 'simple' : (body.mode || 'simple');
    return {
      state: {
        settings: scope[item.stateName].settings || {},
        bots: [item.bot],
        chats: [chat],
        chatSettings: [{
          chat_id: body.chatId,
          bot_id: body.botId,
          enabled: !!body.enabled,
          mode,
          hot_context_limit: body.hot_context_limit,
          auto_react_on_mention: !!body.auto_react_on_mention,
        }],
        models: scope[item.stateName].models || {},
      },
    };
  });
  installAiAdminCompositionForTest(dom, scope);
  [
    'openAiBotSettingsModal',
    'openYandexAiSettingsModal',
    'openDeepseekAiSettingsModal',
    'openQwenAiSettingsModal',
    'openGrokAiSettingsModal',
    'openOpenAiTextBotsModal',
    'openOpenAiUniversalBotsModal',
    'openOpenAiImageBotsModal',
    'openDeepseekTextBotsModal',
    'openQwenTextBotsModal',
    'openGrokTextBotsModal',
    'openGrokImageBotsModal',
    'openGrokUniversalBotsModal',
    'closeModal',
  ].forEach((name) => {
    scope[name] = () => {};
  });

  const controller = dom.window.BananzaApp.aiAdmin.createEventController({ scope });
  assert.equal(controller.bindEvents(), true);
  assert.equal(controller.bindEvents(), false);

  for (const item of cases) {
    scope[item.stateName].bots = [item.bot];
    scope[item.stateName].chats = [chat];
    scope[item.stateName].chatSettings = [];
    scope[item.selectedName] = item.bot.id;
    scope[item.renderName]();

    dom.window.document.getElementById(item.ids.chat).value = String(chat.id);
    dom.window.document.getElementById(item.ids.bot).value = String(item.bot.id);
    dom.window.document.getElementById(item.ids.enabled).checked = true;
    dom.window.document.getElementById(item.ids.mode).value = item.expectedMode;
    dom.window.document.getElementById(item.ids.hot).value = '77';
    dom.window.document.getElementById(item.ids.auto).checked = true;

    const button = dom.window.document.getElementById(item.buttonId);
    button.click();

    assert.equal(button.dataset.adminBusy, '1', `${item.name} should show pending click state`);
    assert.equal(button.textContent, 'Saving...', `${item.name} should show pending label`);

    for (let i = 0; i < 5 && button.dataset.adminBusy === '1'; i += 1) {
      await waitForAsyncAction();
    }

    const chatSaveCall = calls.find((call) => call.url === item.chatUrl);
    assert.ok(chatSaveCall, `expected ${item.name} chat settings request`);
    assert.equal(calls.some((call) => call.url === item.settingsUrl), false, `${item.name} should not save provider settings`);
    assert.deepEqual(JSON.parse(JSON.stringify(chatSaveCall.options.body)), {
      chatId: chat.id,
      botId: item.bot.id,
      enabled: true,
      mode: item.expectedMode,
      hot_context_limit: 77,
      auto_react_on_mention: true,
    });
    const status = dom.window.document.getElementById(item.statusId);
    assert.equal(status.classList.contains('is-success'), true, `${item.name} should show saved status`);
    assert.equal(dom.window.document.getElementById(item.ids.hot).value, '77');
    assert.equal(dom.window.document.getElementById(item.ids.auto).checked, true);
    assert.equal(dom.window.document.getElementById(item.ids.mode).value, item.expectedMode);
  }
});

test('AI admin chat save buttons resolve runtime handlers at click time', async () => {
  const dom = createAppDom();
  let firstHandlerCalled = false;
  let secondHandlerCalled = false;
  let currentSaveHandler = async () => {
    firstHandlerCalled = true;
  };

  loadBrowserScript(dom, 'public/js/app/boot/composition/export-utils.js');
  loadBrowserScript(dom, 'public/js/app/boot/composition/runtime-proxy-scope.js');
  loadBrowserScript(dom, 'public/js/app/boot/composition/ai-admin-composition.js');
  loadBrowserScript(dom, 'public/js/app/ai-admin/events.js');

  const scope = createLazyAiAdminScope(dom, async () => {
    throw new Error('API should not be called by deferred handler test');
  });
  installAiAdminCompositionForTest(dom, scope);
  [
    'openAiBotSettingsModal',
    'openYandexAiSettingsModal',
    'openDeepseekAiSettingsModal',
    'openQwenAiSettingsModal',
    'openGrokAiSettingsModal',
    'openOpenAiTextBotsModal',
    'openOpenAiUniversalBotsModal',
    'openOpenAiImageBotsModal',
    'openDeepseekTextBotsModal',
    'openQwenTextBotsModal',
    'openGrokTextBotsModal',
    'openGrokImageBotsModal',
    'openGrokUniversalBotsModal',
    'closeModal',
  ].forEach((name) => {
    scope[name] = () => {};
  });
  Object.defineProperty(scope, 'saveAiChatBotSettings', {
    configurable: true,
    get() {
      return currentSaveHandler;
    },
  });

  const controller = dom.window.BananzaApp.aiAdmin.createEventController({ scope });
  assert.equal(controller.bindEvents(), true);

  currentSaveHandler = async () => {
    secondHandlerCalled = true;
  };
  dom.window.document.getElementById('aiBotChatSave').click();
  await waitForAsyncAction();

  assert.equal(firstHandlerCalled, false);
  assert.equal(secondHandlerCalled, true);
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
  const copied = [];
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
    if (url === '/api/admin/users/6/tokens') {
      return {
        token: 'admin-issued-token',
        token_type: 'Bearer',
        expires_in_seconds: options.body.expiresInSeconds,
        expires_at: '2026-07-05T12:00:00.000Z',
        never_expires: false,
        user: { id: 6, username: 'bob' },
      };
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
    tx: (text, params = {}) => String(text || '').replace(/\{([^}]+)\}/g, (_match, key) => String(params[key] ?? '')),
    copyTextToClipboard: async (value) => {
      copied.push(value);
      return true;
    },
    openAdminBotAuditModal: () => Promise.resolve(),
  });
  await usersController.openAdminModal();
  assert.equal(openedModal, 'adminModal');
  assert.match(dom.window.document.getElementById('adminUserList').textContent, /Bob/);

  const tokenBtn = dom.window.document.querySelector('.admin-user-token-btn');
  tokenBtn.click();
  const tokenPanel = dom.window.document.querySelector('.admin-user-token-panel');
  assert.equal(tokenPanel.classList.contains('hidden'), false);
  tokenPanel.querySelector('.admin-token-generate-btn').click();
  await waitForAsyncAction();
  assert.ok(calls.some((call) => call.url === '/api/admin/users/6/tokens' && call.options.method === 'POST'));
  assert.equal(tokenPanel.querySelector('.admin-token-output').value, 'admin-issued-token');
  tokenPanel.querySelector('.admin-token-copy-btn').click();
  await waitForAsyncAction();
  assert.deepEqual(copied, ['admin-issued-token']);

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

test('ChatShot chat setting save keeps Saved status and skips own refresh echo', async () => {
  const dom = loadAiAdminRuntime();
  const { document } = dom.window;
  const calls = [];
  const savedState = {
    chatId: 7,
    enabled: true,
    requested_enabled: true,
    ready: true,
    botId: 31,
    style: 'photo',
    banana_filter_enabled: false,
    message_count: 3,
    bots: [{ id: 31, name: 'Shot', provider: 'openai' }],
    selectedBot: { id: 31, name: 'Shot', provider: 'openai' },
  };
  const api = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/chats/7/chatshot' && options.method === 'PUT') return savedState;
    if (url === '/api/chats/7/chatshot') {
      return {
        ...savedState,
        style: 'comic',
        banana_filter_enabled: true,
      };
    }
    throw new Error(`Unexpected ChatShot request: ${url}`);
  };
  const scope = {
    currentChatId: 7,
    chatShotStateByChat: new Map(),
    chatShotStateRequests: new Map(),
    chatShotStateFailuresByChat: new Set(),
    chatShotGeneratingByChat: new Set(),
    chatShotBtn: document.getElementById('chatShotBtn'),
    chatInfoModal: document.getElementById('chatInfoModal'),
    api,
    esc: (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    $: (selector) => document.querySelector(selector),
    syncChatHeaderActionsAccessibility() {},
  };
  const runtime = dom.window.BananzaApp.aiAdmin.contextChatShotRuntime.createContextChatShotRuntime(scope);

  await runtime.loadChatShotState(7);
  const botSelect = document.getElementById('chatShotBotSelect');
  const firstOption = botSelect.options[0];
  document.getElementById('chatShotStyleSelect').value = 'photo';
  document.getElementById('chatShotBananaFilterToggle').checked = false;

  await runtime.saveChatShotChatSetting();
  assert.equal(document.getElementById('chatShotChatStatus').textContent, 'Saved');
  assert.equal(runtime.invalidateChatShotState(7, {
    chat: {
      id: 7,
      chatshot_enabled: 1,
      chatshot_bot_id: 31,
      chatshot_style: 'photo',
      chatshot_banana_filter_enabled: 0,
    },
    source: 'chat_updated',
  }), false);
  assert.equal(runtime.invalidateChatShotState(7, { source: 'chatshot_bots_updated' }), false);
  runtime.renderChatShotForm(runtime.getCurrentChatShotState());

  assert.equal(document.getElementById('chatShotChatStatus').textContent, 'Saved');
  assert.equal(botSelect.options[0], firstOption);
  assert.equal(calls.filter((call) => call.url === '/api/chats/7/chatshot' && call.options.method !== 'PUT').length, 1);
});

test('Document ChatShot action appears after enabling even before document text is ready', async () => {
  const dom = loadAiAdminRuntime();
  const { document } = dom.window;
  const calls = [];
  const documentState = {
    chatId: 7,
    enabled: true,
    requested_enabled: true,
    ready: false,
    botId: 31,
    source: 'document',
    document_text_length: 0,
    style: 'photo',
    banana_filter_enabled: true,
    message_count: 0,
    bots: [{ id: 31, name: 'Shot', provider: 'openai' }],
    selectedBot: { id: 31, name: 'Shot', provider: 'openai' },
  };
  const api = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/chats/7/chatshot') return documentState;
    if (url === '/api/documents/7/chatshot' && options.method === 'POST') return { ok: true, delivered: 2 };
    throw new Error(`Unexpected ChatShot request: ${url}`);
  };
  const scope = {
    currentChatId: 7,
    chatShotStateByChat: new Map(),
    chatShotStateRequests: new Map(),
    chatShotStateFailuresByChat: new Set(),
    chatShotGeneratingByChat: new Set(),
    chatShotBtn: document.getElementById('chatShotBtn'),
    chatInfoModal: document.getElementById('chatInfoModal'),
    api,
    getChatById: (chatId) => Number(chatId) === 7 ? { id: 7, is_document: 1 } : null,
    esc: (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    $: (selector) => document.querySelector(selector),
    t: (key) => key,
    showCenterToast() {},
    syncChatHeaderActionsAccessibility() {},
  };
  const runtime = dom.window.BananzaApp.aiAdmin.contextChatShotRuntime.createContextChatShotRuntime(scope);

  const state = await runtime.loadChatShotState(7);
  assert.equal(state.source, 'document');
  assert.equal(state.ready, false);
  assert.equal(document.getElementById('chatShotBtn').classList.contains('hidden'), false);

  await runtime.runChatShotGeneration();
  assert.ok(calls.some((call) => call.url === '/api/documents/7/chatshot' && call.options.method === 'POST'));
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
  assert.equal(typeof dom.window.BananzaAppBridge.openChat, 'function');
  assert.equal(typeof dom.window.BananzaAppBridge.openChatFromPush, 'function');
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

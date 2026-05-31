const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  loadAppRuntimeScripts,
  loadAppScript,
} = require('../support/domHarness');

function wait(window, ms = 0) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createJsonResponse(dom, data, init = {}) {
  return new dom.window.Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function createUiController(dom, overrides = {}) {
  const { window } = dom;
  const state = {
    currentUiTheme: 'bananza',
    currentVisualMode: 'classic',
    pollComposerStyle: 'pulse',
    currentModalAnimation: 'soft',
    currentModalAnimationSpeed: 8,
    currentMobileFontSize: 5,
    currentUiLanguage: 'ru',
    microphoneMode: 'voice_message',
    screenRotationAllowed: true,
    sendByEnter: true,
    scrollRestoreMode: 'bottom',
    openLastChatOnReload: true,
    user: { id: 1, ui_theme: 'bananza', ui_visual_mode: 'classic', ui_modal_animation: 'soft', ui_modal_animation_speed: 8, ui_mobile_font_size: 5, ui_language: 'ru' },
  };
  const calls = { api: [] };
  const controller = window.BananzaApp.settings.ui.createUiSettings({
    document: window.document,
    window,
    dom: window.BananzaApp.dom.createDomRefs(),
    config: window.BananzaApp.config,
    androidBridge: window.BananzaApp.androidBridge,
    i18nHelpers: window.BananzaApp.i18nHelpers,
    api: async (url, opts) => {
      calls.api.push({ url, opts });
      return { user: state.user };
    },
    getCurrentUser: () => state.user,
    setCurrentUser: (nextUser) => {
      state.user = nextUser;
      return state.user;
    },
    state: {
      getCurrentUiTheme: () => state.currentUiTheme,
      setCurrentUiTheme: (value) => { state.currentUiTheme = value; },
      getCurrentVisualMode: () => state.currentVisualMode,
      setCurrentVisualMode: (value) => { state.currentVisualMode = value; },
      getPollComposerStyle: () => state.pollComposerStyle,
      setPollComposerStyle: (value) => { state.pollComposerStyle = value; },
      getCurrentModalAnimation: () => state.currentModalAnimation,
      setCurrentModalAnimation: (value) => { state.currentModalAnimation = value; },
      getCurrentModalAnimationSpeed: () => state.currentModalAnimationSpeed,
      setCurrentModalAnimationSpeed: (value) => { state.currentModalAnimationSpeed = value; },
      getCurrentMobileFontSize: () => state.currentMobileFontSize,
      setCurrentMobileFontSize: (value) => { state.currentMobileFontSize = value; },
      getCurrentUiLanguage: () => state.currentUiLanguage,
      setCurrentUiLanguage: (value) => { state.currentUiLanguage = value; },
      getMicrophoneMode: () => state.microphoneMode,
      setMicrophoneMode: (value) => { state.microphoneMode = value; },
      getScreenRotationAllowed: () => state.screenRotationAllowed,
      setScreenRotationAllowed: (value) => { state.screenRotationAllowed = value; },
      getSendByEnter: () => state.sendByEnter,
      setSendByEnter: (value) => { state.sendByEnter = value; },
      getScrollRestoreMode: () => state.scrollRestoreMode,
      setScrollRestoreMode: (value) => { state.scrollRestoreMode = value; },
      getOpenLastChatOnReload: () => state.openLastChatOnReload,
      setOpenLastChatOnReload: (value) => { state.openLastChatOnReload = value; },
    },
    actions: {
      isMobileLayoutViewport: () => overrides.mobileLayout ?? true,
      refreshLocalizedUiRuntime: () => { calls.localizedRuntime = true; },
      refreshVoiceComposerState: () => { calls.voiceRefresh = true; },
      setInlineStatus(id, message, type) {
        calls.status = { id, message, type };
      },
    },
  });
  return { controller, state, calls };
}

test('settings modules are published on BananzaApp.settings', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);

  const settings = dom.window.BananzaApp.settings;
  assert.equal(typeof settings.ui.createUiSettings, 'function');
  assert.equal(typeof settings.weather.createWeatherSettings, 'function');
  assert.equal(typeof settings.notifications.createNotificationSettings, 'function');
  assert.equal(typeof settings.sound.createSoundSettings, 'function');
  assert.equal(typeof settings.modal.createSettingsModal, 'function');
});

test('ui settings controller applies theme, language, font and rotation contracts', async () => {
  const dom = createAppDom();
  const { window } = dom;
  const androidMessages = [];
  const i18nCalls = [];
  window.BananzaI18n = {
    normalizeLanguage(language) { return String(language).toLowerCase() === 'en' ? 'en' : 'ru'; },
    setLanguage(language, options) { i18nCalls.push({ language, options }); },
    applyStaticDom(root) { i18nCalls.push({ applyRoot: root.nodeType }); },
    t(value) { return value; },
    text(value) { return value; },
  };
  window.BananzaAndroid = {
    postMessage(payload) {
      androidMessages.push(JSON.parse(payload));
    },
  };
  loadAppRuntimeScripts(dom);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });

  const { controller, state, calls } = createUiController(dom);
  controller.applyUiTheme('tokyo-night', false);
  assert.equal(window.document.documentElement.dataset.uiTheme, 'tokyo-night');
  assert.equal(state.currentUiTheme, 'tokyo-night');

  controller.applyUiLanguage('en', false);
  assert.equal(window.document.documentElement.lang, 'en');
  assert.equal(i18nCalls[0].language, 'en');
  assert.equal(i18nCalls[0].options.persist, false);
  assert.equal(calls.localizedRuntime, true);

  delete window.BananzaAndroid;
  controller.applyMobileFontSize(8, false);
  assert.equal(window.document.documentElement.style.getPropertyValue('-webkit-text-size-adjust'), '112%');

  window.BananzaAndroid = {
    postMessage(payload) {
      androidMessages.push(JSON.parse(payload));
    },
  };
  controller.applyMobileFontSize(7, false);
  assert.deepEqual(androidMessages.at(-1), {
    type: 'mobile_font_size',
    payload: { size: 7, mobileLayout: true },
  });

  await controller.setScreenRotationAllowed(false, { showStatus: false });
  assert.equal(state.screenRotationAllowed, false);
  assert.equal(window.localStorage.getItem('screenRotationAllowed'), '0');
  assert.deepEqual(androidMessages.at(-1), {
    type: 'screen_rotation_preference',
    payload: { allowed: false, reason: 'setting-change' },
  });
});

test('weather controller renders state and uses settings/current endpoints', async () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const calls = [];
  const location = { name: 'Kaliningrad', admin1: 'Kaliningrad', country: 'Russia', latitude: 54.7, longitude: 20.5 };
  const controller = window.BananzaApp.settings.weather.createWeatherSettings({
    document: window.document,
    window,
    dom: window.BananzaApp.dom.createDomRefs(),
    esc: window.BananzaApp.formatters.esc,
    api: async (url, opts = {}) => {
      calls.push({ url, opts });
      if (url === '/api/weather/settings' && opts.method === 'PUT') return { settings: opts.body };
      if (url === '/api/weather/settings') return { settings: { enabled: true, refresh_minutes: 30, location } };
      if (String(url).startsWith('/api/weather/current')) {
        return { enabled: true, settings: { enabled: true, refresh_minutes: 30, location }, temperature: 21.4, wind_speed: 3.2, weather_code: 0, is_day: true, fetched_at: new Date().toISOString() };
      }
      if (String(url).startsWith('/api/weather/search')) return { results: [location] };
      throw new Error(`Unexpected weather endpoint ${url}`);
    },
  });

  controller.renderWeatherWidget(null);
  assert.equal(window.document.getElementById('weatherWidget').classList.contains('hidden'), true);

  await controller.loadWeatherSettings();
  await controller.loadCurrentWeather(true);
  assert.equal(window.document.getElementById('weatherWidget').classList.contains('hidden'), false);
  assert.match(window.document.getElementById('weatherWidget').textContent, /21/);

  await controller.saveWeatherSettings();
  window.document.getElementById('settingsWeatherEnabled').checked = false;
  await controller.saveWeatherSettings();
  assert.ok(calls.some((entry) => entry.url === '/api/weather/settings' && entry.opts.method === 'PUT'));
  assert.ok(calls.some((entry) => entry.url === '/api/weather/current?force=1'));
});

test('notification controller renders support and fake push subscription path', async () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const calls = [];
  window.PushManager = function PushManager() {};
  window.Notification = class Notification {
    static permission = 'granted';
    static requestPermission() {
      return Promise.resolve('granted');
    }
  };
  const subscription = {
    endpoint: 'https://push.example/device',
    toJSON() {
      return { endpoint: this.endpoint };
    },
    unsubscribe() {
      return Promise.resolve(true);
    },
  };
  window.navigator.serviceWorker = {
    register() {
      return Promise.resolve({
        pushManager: {
          getSubscription: () => Promise.resolve(null),
          subscribe: () => Promise.resolve(subscription),
        },
      });
    },
    getRegistration() {
      return Promise.resolve({
        pushManager: {
          getSubscription: () => Promise.resolve(subscription),
        },
      });
    },
  };
  const controller = window.BananzaApp.settings.notifications.createNotificationSettings({
    document: window.document,
    window,
    state: { getCurrentChatId: () => 7 },
    api: async (url, opts = {}) => {
      calls.push({ url, opts });
      if (url === '/api/notification-settings') return { settings: { push_enabled: false, notify_messages: true, notify_chat_invites: true, notify_reactions: true, notify_pins: true, notify_mentions: true } };
      if (url === '/api/push/vapid-public-key') return { publicKey: 'AQID' };
      if (url === '/api/push/subscribe') return { settings: { push_enabled: true, notify_messages: true } };
      if (url === '/api/push/test') return { sent: 1 };
      throw new Error(`Unexpected notification endpoint ${url}`);
    },
  });

  await controller.loadNotificationSettings();
  controller.renderNotificationSettingsForm();
  assert.match(window.document.getElementById('settingsNotificationsSupport').textContent, /Status|Статус/);

  await controller.enablePushNotifications();
  await controller.testPushNotification();
  assert.equal(controller.isPushDeviceSubscribed(), true);
  assert.ok(calls.some((entry) => entry.url === '/api/push/subscribe'));
  assert.ok(calls.some((entry) => entry.url === '/api/push/test'));
});

test('sound controller configures BananzaSounds and play respects enabled state', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  let lastSettings = null;
  const played = [];
  window.BananzaSounds = {
    configure(settings) {
      lastSettings = { ...settings };
    },
    play(type) {
      if (!lastSettings?.sounds_enabled) return false;
      played.push(type);
      return true;
    },
    preview(type) {
      played.push(`preview:${type}`);
      return true;
    },
  };
  const controller = window.BananzaApp.settings.sound.createSoundSettings({
    document: window.document,
    window,
    api: async () => ({ settings: lastSettings }),
  });

  controller.applySoundSettings({ sounds_enabled: false, volume: 33 });
  assert.equal(lastSettings.volume, 33);
  assert.equal(controller.playAppSound('incoming'), false);

  controller.applySoundSettings({ sounds_enabled: true });
  assert.equal(controller.playAppSound('incoming'), true);
  assert.deepEqual(played, ['incoming']);
});

test('full app bridge keeps settings modal and AI settings boundary intact', async () => {
  const dom = createAppDom();
  const { window } = dom;
  const currentUser = {
    id: 1,
    username: 'alice',
    display_name: 'Alice',
    is_admin: 1,
    ui_theme: 'bananza',
    ui_visual_mode: 'classic',
    ui_modal_animation: 'soft',
    ui_modal_animation_speed: 8,
    ui_mobile_font_size: 5,
    ui_language: 'ru',
    ui_show_chat_folder_strip_in_all_chats: false,
  };
  window.alert = () => {};
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
    constructor() {
      this.readyState = window.WebSocket.CONNECTING;
      window.setTimeout(() => {
        this.readyState = window.WebSocket.OPEN;
        this.onopen?.();
      }, 0);
    }
    close() {}
    send() {}
  };
  window.localStorage.setItem('token', 'test-token');
  window.localStorage.setItem('user', JSON.stringify(currentUser));
  window.fetch = async (input) => {
    const url = new URL(String(input), window.location.origin);
    switch (url.pathname) {
      case '/api/auth/me':
        return createJsonResponse(dom, { user: currentUser });
      case '/api/user/recent-emojis':
        return createJsonResponse(dom, { emojis: [] });
      case '/api/weather/settings':
        return createJsonResponse(dom, { settings: { enabled: false, location: null, refresh_minutes: 30 } });
      case '/api/sound-settings':
        return createJsonResponse(dom, { settings: { sounds_enabled: true, volume: 55, play_send: true, play_incoming: true, play_notifications: true, play_reactions: true, play_pins: true, play_invites: true, play_voice: true, play_mentions: true } });
      case '/api/notification-settings':
        return createJsonResponse(dom, { settings: { push_enabled: false, notify_messages: true, notify_chat_invites: true, notify_reactions: true, notify_pins: true, notify_mentions: true } });
      case '/api/chats':
      case '/api/users':
        return createJsonResponse(dom, []);
      default:
        throw new Error(`Unexpected full app settings endpoint ${url.pathname}`);
    }
  };
  const ready = new Promise((resolve) => window.addEventListener('bananza:ready', resolve, { once: true }));
  loadAppScript(dom);
  await ready;
  await wait(window);

  assert.equal(window.BananzaAppBridge.getCurrentModalAnimation(), 'soft');
  assert.equal(window.BananzaAppBridge.getCurrentModalAnimationSpeed(), 8);
  assert.equal(typeof window.BananzaAppBridge.openSettingsModal, 'function');
  assert.equal(window.BananzaApp.settings.modal.openAiBotSettingsModal, undefined);

  window.BananzaAppBridge.__testing.openSettingsModal();
  await wait(window, 40);
  assert.equal(window.document.getElementById('settingsModal').classList.contains('hidden'), false);
  assert.ok(window.document.getElementById('settingsAiBotsPanel'));
  assert.equal(window.document.getElementById('settingsAiBotsPanel').classList.contains('hidden'), false);
});

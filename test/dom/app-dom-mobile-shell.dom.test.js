const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installVisualViewportMock,
  loadAppRuntimeScripts,
  loadAppScript,
} = require('../support/domHarness');

function createJsonResponse(dom, data, init = {}) {
  return new dom.window.Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function installRuntimeStubs(dom) {
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
    ui_show_chat_folder_strip_in_all_chats: false,
  };

  window.alert = () => {};
  window.confirm = () => true;
  window.Notification = class Notification {
    static permission = 'default';
    static requestPermission() {
      return Promise.resolve('default');
    }
  };
  window.navigator.serviceWorker = {
    addEventListener() {},
    register() {
      return Promise.resolve();
    },
    getRegistration() {
      return Promise.resolve({
        pushManager: {
          getSubscription() {
            return Promise.resolve(null);
          },
        },
      });
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

  window.localStorage.setItem('token', 'test-token');
  window.localStorage.setItem('user', JSON.stringify(currentUser));
  window.localStorage.removeItem('lastChat');

  window.fetch = async (input) => {
    const url = new URL(String(input), window.location.origin);
    switch (url.pathname) {
      case '/api/auth/me':
        return createJsonResponse(dom, { user: currentUser });
      case '/api/user/recent-emojis':
        return createJsonResponse(dom, { emojis: [] });
      case '/api/weather/settings':
        return createJsonResponse(dom, {
          settings: { enabled: false, location: null, refresh_minutes: 30 },
        });
      case '/api/sound-settings':
        return createJsonResponse(dom, {
          settings: {
            sounds_enabled: true,
            volume: 100,
            play_send: true,
            play_incoming: true,
            play_notifications: true,
            play_reactions: true,
            play_pins: true,
            play_invites: true,
            play_voice: true,
            play_mentions: true,
          },
        });
      case '/api/notification-settings':
        return createJsonResponse(dom, {
          settings: {
            push_enabled: false,
            notify_messages: true,
            notify_chat_invites: true,
            notify_reactions: true,
            notify_pins: true,
            notify_mentions: true,
          },
        });
      case '/api/chats':
        return createJsonResponse(dom, []);
      case '/api/users':
        return createJsonResponse(dom, []);
      default:
        throw new Error(`Unexpected fetch in DOM mobile shell test: ${url.pathname}`);
    }
  };
}

function setViewportSize(window, width, height) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  });
}

function setIosNavigator(window) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: 'iPhone',
  });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: 5,
  });
}

test('BananzaApp.dom exposes selectors and current DOM refs', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);

  const { document, BananzaApp } = dom.window;
  assert.equal(BananzaApp.dom.$('#chatList'), document.getElementById('chatList'));

  const modals = BananzaApp.dom.$$('.modal');
  assert.equal(Array.isArray(modals), true);
  assert.ok(modals.length > 0);

  const refs = BananzaApp.dom.createDomRefs();
  [
    'chatList',
    'messagesEl',
    'msgInput',
    'sendBtn',
    'settingsModal',
    'chatHeaderActions',
  ].forEach((key) => {
    assert.ok(refs[key], `Expected ${key} ref`);
  });
});

test('legacy ui runtime calls getComputedStyle with the window receiver through proxy scope', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const sidebar = window.document.getElementById('sidebar');
  let calls = 0;

  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    value(el) {
      assert.equal(this, window);
      assert.equal(el, sidebar);
      calls += 1;
      return {
        transitionDuration: '0.12s, 75ms',
        transitionDelay: '10ms, 0s',
      };
    },
  });

  const scopeTarget = Object.assign(Object.create(null), {
    authService: {
      configure() {},
      getToken() {
        return '';
      },
      checkAuth() {
        return false;
      },
      logout() {},
    },
  });
  const scope = new Proxy(scopeTarget, {
    has() {
      return true;
    },
    get(target, key) {
      if (key === Symbol.unscopables) return undefined;
      if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
      if (key === 'window') return window;
      if (key === 'document') return window.document;
      if (typeof key === 'string' && key in window) return window[key];
      return undefined;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });

  const api = window.BananzaApp.shell.legacyUiRuntime.createLegacyUiRuntime(scope);
  assert.equal(api.getElementTransitionTotalMs(sidebar), 130);
  assert.equal(calls, 1);
});

test('android bridge helper no-ops without bridge and posts matching payloads with bridge', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const bridge = window.BananzaApp.androidBridge;

  assert.equal(bridge.hasAndroidNativeBridge(), false);
  assert.equal(bridge.notifyAndroidScreenRotationPreference(false, 'sync'), false);

  const messages = [];
  window.BananzaAndroid = {
    postMessage(payload) {
      messages.push(JSON.parse(payload));
    },
  };

  assert.equal(bridge.hasAndroidNativeBridge(), true);
  assert.equal(bridge.notifyAndroidScreenRotationPreference(false, 'setting-change'), true);
  assert.equal(bridge.notifyAndroidMobileFontSize(6, true), true);
  assert.deepEqual(messages, [
    {
      type: 'screen_rotation_preference',
      payload: { allowed: false, reason: 'setting-change' },
    },
    {
      type: 'mobile_font_size',
      payload: { size: 6, mobileLayout: true },
    },
  ]);
});

test('mobile viewport shell exposes helpers and reads mocked visualViewport metrics', () => {
  const dom = createAppDom();
  const { window } = dom;
  setViewportSize(window, 390, 800);
  const viewport = installVisualViewportMock(window, {
    width: 390,
    height: 800,
    offsetTop: 0,
  });
  loadAppRuntimeScripts(dom);

  const refs = window.BananzaApp.dom.createDomRefs();
  refs.chatView.classList.remove('hidden');
  const shell = window.BananzaApp.mobileViewport.createMobileViewportShell({
    window,
    document: window.document,
    dom: refs,
    state: {
      getIosComposerFocused: () => true,
    },
  });

  [
    'isIosViewportFixTarget',
    'isIosMobileViewportTarget',
    'isMobileViewportTarget',
    'getMobileVisualViewportMetrics',
    'getMobileViewportBaselineHeight',
    'isMobileKeyboardOpen',
    'isMobileChatKeyboardLayoutActive',
    'restoreMobileKeyboardDocumentScroll',
    'shouldBypassLockedMobileViewportSync',
  ].forEach((name) => {
    assert.equal(typeof shell[name], 'function', `Expected ${name} method`);
  });

  assert.equal(shell.isMobileViewportTarget(), true);
  const metrics = shell.getMobileVisualViewportMetrics();
  assert.equal(metrics.top, 0);
  assert.equal(metrics.height, 800);
  assert.equal(metrics.width, 390);
  assert.equal(metrics.bottom, 800);
  assert.equal(shell.getMobileViewportBaselineHeight(), 800);

  viewport.set({ height: 610 });
  assert.equal(shell.isMobileKeyboardOpen(), true);
  assert.equal(shell.isMobileChatKeyboardLayoutActive(), true);
});

test('chat header actions shell preserves aria, class and focus state', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const refs = window.BananzaApp.dom.createDomRefs();
  let open = false;
  const shell = window.BananzaApp.chatHeaderActions.createChatHeaderActions({
    document: window.document,
    dom: refs,
    state: {
      getChatHeaderActionsOpen: () => open,
      setChatHeaderActionsOpen: (value) => {
        open = Boolean(value);
        return open;
      },
    },
  });

  refs.searchBtn.focus();
  shell.syncChatHeaderActionsAccessibility();
  assert.equal(refs.chatHeaderActions.classList.contains('is-open'), false);
  assert.equal(refs.chatHeaderActions.getAttribute('aria-hidden'), 'true');
  assert.equal(refs.chatHeaderActions.inert, true);
  assert.equal(refs.searchBtn.tabIndex, -1);
  assert.notEqual(window.document.activeElement, refs.searchBtn);

  assert.equal(shell.setChatHeaderActionsOpen(true), true);
  assert.equal(refs.chatHeaderActions.classList.contains('is-open'), true);
  assert.equal(refs.chatHeaderActions.getAttribute('aria-hidden'), 'false');
  assert.equal(refs.chatInfoBtn.getAttribute('aria-expanded'), 'true');
  assert.equal(refs.chatInfoBtn.classList.contains('is-active'), true);
  assert.equal(refs.searchBtn.getAttribute('tabindex'), null);

  assert.equal(shell.closeChatHeaderActions(), false);
  assert.equal(refs.chatHeaderActions.classList.contains('is-open'), false);
  assert.equal(refs.chatInfoBtn.getAttribute('aria-expanded'), 'false');
});

test('full app runtime still publishes bridge, testing API and bananza ready', async () => {
  const dom = createAppDom();
  const { window } = dom;
  installRuntimeStubs(dom);
  setViewportSize(window, 390, 800);
  installVisualViewportMock(window, {
    width: 390,
    height: 800,
    offsetTop: 0,
  });
  setIosNavigator(window);

  let readyCount = 0;
  const ready = new Promise((resolve) => {
    window.addEventListener('bananza:ready', () => {
      readyCount += 1;
      resolve();
    });
  });

  loadAppScript(dom);
  await ready;
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  assert.equal(readyCount, 1);
  assert.ok(window.BananzaAppBridge);
  assert.ok(window.BananzaAppBridge.__testing);
  assert.equal(window.document.documentElement.classList.contains('is-ios-webkit'), true);
  assert.equal(typeof window.BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot, 'function');
});

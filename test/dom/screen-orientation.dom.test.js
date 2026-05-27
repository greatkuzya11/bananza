const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installVisualViewportMock,
  loadBrowserScript,
} = require('../support/domHarness');

function createJsonResponse(dom, data, init = {}) {
  return new dom.window.Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function installAppRuntimeStubs(dom) {
  const { window } = dom;

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 390,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 844,
  });

  window.alert = () => {};
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

    constructor(url) {
      this.url = url;
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

  window.localStorage.setItem('token', 'test-token');
  window.localStorage.setItem('user', JSON.stringify(currentUser));
  window.localStorage.removeItem('lastChat');
  window.localStorage.removeItem('screenRotationAllowed');

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
        throw new Error(`Unexpected fetch in screen orientation DOM test: ${url.pathname}`);
    }
  };
}

function installScreenOrientationMock(dom, { lockImpl = null, unlockImpl = null } = {}) {
  const calls = [];
  let unlocks = 0;
  const orientation = {
    lock(type) {
      calls.push(type);
      if (typeof lockImpl === 'function') return lockImpl(type);
      return Promise.resolve();
    },
    unlock() {
      unlocks += 1;
      if (typeof unlockImpl === 'function') return unlockImpl();
      return undefined;
    },
  };

  Object.defineProperty(dom.window.screen, 'orientation', {
    configurable: true,
    value: orientation,
  });

  return {
    calls,
    get unlocks() {
      return unlocks;
    },
    reset() {
      calls.length = 0;
      unlocks = 0;
    },
  };
}

async function bootAppDom({ beforeLoad = null } = {}) {
  const dom = createAppDom();
  installAppRuntimeStubs(dom);
  installVisualViewportMock(dom.window, {
    width: 390,
    height: 844,
    offsetTop: 0,
    offsetLeft: 0,
  });
  if (typeof beforeLoad === 'function') beforeLoad(dom);
  const ready = new Promise((resolve) => {
    dom.window.addEventListener('bananza:ready', resolve, { once: true });
  });
  loadBrowserScript(dom, 'public/js/ai-image-risk.js');
  loadBrowserScript(dom, 'public/js/qip-infium-original.js');
  loadBrowserScript(dom, 'public/js/qip-hd.js');
  loadBrowserScript(dom, 'public/js/app.js');
  await ready;
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  return dom;
}

test('screen rotation setting defaults to allowed and toggles lock/unlock locally', async () => {
  let orientationMock;
  const dom = await bootAppDom({
    beforeLoad(nextDom) {
      orientationMock = installScreenOrientationMock(nextDom);
    },
  });
  const { window } = dom;
  const testing = window.BananzaAppBridge.__testing;
  const toggle = window.document.getElementById('settingsScreenRotationAllowed');

  orientationMock.reset();
  assert.equal(testing.getScreenRotationAllowed(), true);
  assert.equal(toggle.checked, true);
  assert.equal(window.localStorage.getItem('screenRotationAllowed'), null);

  await testing.setScreenRotationAllowed(false, { showStatus: false });
  assert.equal(testing.getScreenRotationAllowed(), false);
  assert.equal(toggle.checked, false);
  assert.equal(window.localStorage.getItem('screenRotationAllowed'), '0');
  assert.deepEqual(orientationMock.calls, ['portrait-primary']);

  await testing.setScreenRotationAllowed(true, { showStatus: false });
  assert.equal(testing.getScreenRotationAllowed(), true);
  assert.equal(toggle.checked, true);
  assert.equal(window.localStorage.getItem('screenRotationAllowed'), '1');
  assert.equal(orientationMock.unlocks, 1);
});

test('screen rotation lock falls back from portrait-primary to portrait', async () => {
  let orientationMock;
  const dom = await bootAppDom({
    beforeLoad(nextDom) {
      orientationMock = installScreenOrientationMock(nextDom, {
        lockImpl(type) {
          if (type === 'portrait-primary') {
            const error = new Error('primary orientation unavailable');
            error.name = 'NotSupportedError';
            return Promise.reject(error);
          }
          return Promise.resolve();
        },
      });
    },
  });

  orientationMock.reset();
  await dom.window.BananzaAppBridge.__testing.setScreenRotationAllowed(false, { showStatus: false });

  assert.deepEqual(orientationMock.calls, ['portrait-primary', 'portrait']);
  assert.equal(dom.window.localStorage.getItem('screenRotationAllowed'), '0');
});

test('screen rotation setting applies web portrait fallback in mobile landscape', async () => {
  let orientationMock;
  const dom = await bootAppDom({
    beforeLoad(nextDom) {
      orientationMock = installScreenOrientationMock(nextDom);
    },
  });
  const { window } = dom;

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 844,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 390,
  });

  orientationMock.reset();
  await window.BananzaAppBridge.__testing.setScreenRotationAllowed(false, { showStatus: false });

  assert.equal(window.document.documentElement.classList.contains('is-screen-rotation-web-locked'), true);
  assert.equal(window.document.documentElement.style.getPropertyValue('--screen-rotation-lock-width'), '390px');
  assert.equal(window.document.documentElement.style.getPropertyValue('--screen-rotation-lock-height'), '844px');
  assert.equal(window.BananzaAppBridge.isMobileLayout(), true);

  await window.BananzaAppBridge.__testing.setScreenRotationAllowed(true, { showStatus: false });

  assert.equal(window.document.documentElement.classList.contains('is-screen-rotation-web-locked'), false);
  assert.equal(window.document.documentElement.style.getPropertyValue('--screen-rotation-lock-width'), '');
  assert.equal(window.document.documentElement.style.getPropertyValue('--screen-rotation-lock-height'), '');
});

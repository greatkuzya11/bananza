const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installVisualViewportMock,
  loadAppScript,
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

function installAndroidBridgeMock(dom) {
  const messages = [];
  dom.window.BananzaAndroid = {
    postMessage(payload) {
      messages.push(JSON.parse(payload));
    },
  };
  return {
    messages,
    reset() {
      messages.length = 0;
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
  loadAppScript(dom);
  await ready;
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  return dom;
}

test('screen rotation setting defaults to allowed and sends Android bridge preference', async () => {
  let androidBridge;
  const dom = await bootAppDom({
    beforeLoad(nextDom) {
      androidBridge = installAndroidBridgeMock(nextDom);
    },
  });
  const { window } = dom;
  const testing = window.BananzaAppBridge.__testing;
  const toggle = window.document.getElementById('settingsScreenRotationAllowed');

  androidBridge.reset();
  assert.equal(testing.getScreenRotationAllowed(), true);
  assert.equal(toggle.checked, true);
  assert.equal(window.localStorage.getItem('screenRotationAllowed'), null);

  await testing.setScreenRotationAllowed(false, { showStatus: false });
  assert.equal(testing.getScreenRotationAllowed(), false);
  assert.equal(toggle.checked, false);
  assert.equal(window.localStorage.getItem('screenRotationAllowed'), '0');
  assert.deepEqual(androidBridge.messages, [{
    type: 'screen_rotation_preference',
    payload: { allowed: false, reason: 'setting-change' },
  }]);

  androidBridge.reset();
  await testing.setScreenRotationAllowed(true, { showStatus: false });
  assert.equal(testing.getScreenRotationAllowed(), true);
  assert.equal(toggle.checked, true);
  assert.equal(window.localStorage.getItem('screenRotationAllowed'), '1');
  assert.deepEqual(androidBridge.messages, [{
    type: 'screen_rotation_preference',
    payload: { allowed: true, reason: 'setting-change' },
  }]);
});

test('screen rotation setting does not apply a web portrait fallback in mobile landscape', async () => {
  const dom = await bootAppDom();
  const { window } = dom;

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 844,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 390,
  });

  await window.BananzaAppBridge.__testing.setScreenRotationAllowed(false, { showStatus: false });

  assert.equal(window.document.documentElement.classList.contains('is-screen-rotation-web-locked'), false);
  assert.equal(window.document.documentElement.style.getPropertyValue('--screen-rotation-lock-width'), '');
  assert.equal(window.document.documentElement.style.getPropertyValue('--screen-rotation-lock-height'), '');
  assert.equal(window.BananzaAppBridge.isMobileLayout(), false);

  await window.BananzaAppBridge.__testing.setScreenRotationAllowed(true, { showStatus: false });

  assert.equal(window.document.documentElement.classList.contains('is-screen-rotation-web-locked'), false);
  assert.equal(window.document.documentElement.style.getPropertyValue('--screen-rotation-lock-width'), '');
  assert.equal(window.document.documentElement.style.getPropertyValue('--screen-rotation-lock-height'), '');
});

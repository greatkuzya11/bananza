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
  };

  window.localStorage.setItem('token', 'test-token');
  window.localStorage.setItem('user', JSON.stringify(currentUser));

  window.fetch = async (input) => {
    const url = new URL(String(input), window.location.origin);
    switch (url.pathname) {
      case '/api/auth/me':
        return createJsonResponse(dom, { user: currentUser });
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
        throw new Error(`Unexpected fetch in media viewer DOM test: ${url.pathname}`);
    }
  };
}

async function bootAppDom() {
  const dom = createAppDom();
  installAppRuntimeStubs(dom);
  dom.visualViewportMock = installVisualViewportMock(dom.window, {
    width: 390,
    height: 844,
    offsetTop: 0,
    offsetLeft: 0,
  });
  const ready = new Promise((resolve) => {
    dom.window.addEventListener('bananza:ready', resolve, { once: true });
  });
  loadBrowserScript(dom, 'public/js/ai-image-risk.js');
  loadBrowserScript(dom, 'public/js/app.js');
  await ready;
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  return dom;
}

async function waitForViewportRecovery(dom, delayMs = 240) {
  await new Promise((resolve) => dom.window.setTimeout(resolve, delayMs));
}

function createTouchEndEvent(window, { clientX = 0, clientY = 0, identifier = 1 } = {}) {
  const event = new window.Event('touchend', { bubbles: true, cancelable: true });
  const touch = { identifier, clientX, clientY };
  Object.defineProperties(event, {
    touches: { configurable: true, value: [] },
    changedTouches: { configurable: true, value: [touch] },
  });
  return event;
}

test('media viewer close suppresses follow-up click-through to settings', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const imageViewer = document.getElementById('imageViewer');
  const closeBtn = imageViewer.querySelector('.iv-close');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');

  imageViewer.classList.remove('hidden');
  const touchEnd = createTouchEndEvent(dom.window, { clientX: 12, clientY: 12 });
  closeBtn.dispatchEvent(touchEnd);

  assert.equal(imageViewer.classList.contains('hidden'), true);

  settingsBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  assert.equal(settingsModal.classList.contains('hidden'), true);
});

test('settings button still opens settings without preceding media-viewer close', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');

  settingsBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  assert.equal(settingsModal.classList.contains('hidden'), false);
});

test('app resume recovers stale mobile viewport height without a final resize event', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');

  assert.equal(app.style.height, '844px');

  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await new Promise((resolve) => dom.window.setTimeout(resolve, 30));
  assert.equal(app.style.height, '420px');

  dom.visualViewportMock.set({ height: 844 });
  dom.window.dispatchEvent(new dom.window.Event('focus'));
  await waitForViewportRecovery(dom);

  assert.equal(app.style.height, '844px');
});

test('uploading media recovers stale mobile viewport height without a final resize event', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const fileInputGallery = document.getElementById('fileInputGallery');
  const pendingFile = document.getElementById('pendingFile');

  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await new Promise((resolve) => dom.window.setTimeout(resolve, 30));
  assert.equal(app.style.height, '420px');

  dom.visualViewportMock.set({ height: 844 });
  Object.defineProperty(fileInputGallery, 'files', {
    configurable: true,
    value: [new dom.window.File(['image'], 'photo.jpg', { type: 'image/jpeg' })],
  });
  fileInputGallery.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await waitForViewportRecovery(dom);

  assert.equal(app.style.height, '844px');
  assert.equal(pendingFile.classList.contains('hidden'), false);
});

test('emoji picker keeps the mobile composer attached when the keyboard is already open', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  msgInput.focus();
  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await new Promise((resolve) => dom.window.setTimeout(resolve, 30));
  assert.equal(app.style.height, '420px');

  const mouseDown = new dom.window.MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
  });
  emojiBtn.dispatchEvent(mouseDown);
  assert.equal(mouseDown.defaultPrevented, true);

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));

  assert.equal(emojiPicker.classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('emoji picker inserts emoji without focusing the composer when the keyboard is closed', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const msgInput = document.getElementById('msgInput');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  let focusCalls = 0;
  msgInput.focus = () => {
    focusCalls += 1;
  };

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));

  const firstEmoji = emojiPicker.querySelector('.emoji-item');
  assert.ok(firstEmoji, 'Expected at least one emoji item in the picker');

  firstEmoji.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  assert.notEqual(msgInput.value, '');
  assert.equal(focusCalls, 0);
  assert.notEqual(document.activeElement, msgInput);
});

test('emoji picker closes when navigating back out of the mobile chat view', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const sidebar = document.getElementById('sidebar');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));
  assert.equal(emojiPicker.classList.contains('hidden'), false);

  sidebar.classList.add('sidebar-hidden');
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

  assert.equal(emojiPicker.classList.contains('hidden'), true);
});

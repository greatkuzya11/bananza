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
        throw new Error(`Unexpected fetch in private chat DOM test: ${url.pathname}`);
    }
  };
}

async function bootAppDom() {
  const dom = createAppDom();
  installAppRuntimeStubs(dom);
  installVisualViewportMock(dom.window, {
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

function chatNameText(document, chatId) {
  const node = document.querySelector(`.chat-item[data-chat-id="${chatId}"] .chat-item-name`);
  return node ? node.textContent.trim() : '';
}

test('applyChatUpdate keeps human private display name when chat_updated omits private_user', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  document.getElementById('chatInfoModal').classList.remove('hidden');

  BananzaAppBridge.__testing.setChats([{
    id: 41,
    type: 'private',
    name: 'Bob',
    created_at: '2026-04-28 10:00:00',
    private_user: {
      id: 2,
      display_name: 'Bob',
      username: 'bob',
      avatar_color: '#65aadd',
      avatar_url: null,
      is_ai_bot: 0,
    },
  }], { currentChatId: 41 });

  assert.equal(chatNameText(document, 41), 'Bob');
  assert.equal(document.getElementById('chatTitle').textContent.trim(), 'Bob');
  assert.equal(document.getElementById('chatInfoTitle').textContent.trim(), 'Bob');

  const updated = BananzaAppBridge.__testing.applyChatUpdate({
    id: 41,
    type: 'private',
    name: 'Private',
  });

  assert.equal(updated.name, 'Bob');
  assert.equal(updated.private_user.display_name, 'Bob');
  assert.equal(chatNameText(document, 41), 'Bob');
  assert.equal(document.getElementById('chatTitle').textContent.trim(), 'Bob');
  assert.equal(document.getElementById('chatInfoTitle').textContent.trim(), 'Bob');
});

test('applyChatUpdate immediately applies bot private chat title changes without losing private_user', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  document.getElementById('chatInfoModal').classList.remove('hidden');

  BananzaAppBridge.__testing.setChats([{
    id: 77,
    type: 'private',
    name: 'OpenAI Universal',
    created_at: '2026-04-28 10:00:00',
    private_user: {
      id: 12,
      display_name: 'OpenAI Universal',
      username: 'openai_universal',
      avatar_color: '#55c4c2',
      avatar_url: null,
      is_ai_bot: 1,
      ai_bot_mention: 'openai_universal',
      ai_bot_model: 'gpt-4o-mini',
    },
  }], { currentChatId: 77 });

  assert.equal(chatNameText(document, 77), 'OpenAI Universal');
  assert.equal(document.getElementById('chatTitle').textContent.trim(), 'OpenAI Universal');
  assert.equal(document.getElementById('chatInfoTitle').textContent.trim(), 'OpenAI Universal');

  const updated = BananzaAppBridge.__testing.applyChatUpdate({
    id: 77,
    type: 'private',
    name: 'Trip Budget Planning',
  });

  assert.equal(updated.name, 'Trip Budget Planning');
  assert.equal(updated.private_user.display_name, 'OpenAI Universal');
  assert.equal(updated.private_user.ai_bot_model, 'gpt-4o-mini');
  assert.equal(chatNameText(document, 77), 'Trip Budget Planning');
  assert.equal(document.getElementById('chatTitle').textContent.trim(), 'Trip Budget Planning');
  assert.equal(document.getElementById('chatInfoTitle').textContent.trim(), 'Trip Budget Planning');
});

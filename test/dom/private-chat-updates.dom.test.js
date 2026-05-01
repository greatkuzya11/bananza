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

function installAppRuntimeStubs(dom, { fetchHandler = null } = {}) {
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

  window.fetch = async (input, init = {}) => {
    const url = new URL(String(input), window.location.origin);
    if (typeof fetchHandler === 'function') {
      const handled = await fetchHandler({ url, init, dom, currentUser });
      if (handled) return handled;
    }
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

async function bootAppDom(options = {}) {
  const dom = createAppDom();
  installAppRuntimeStubs(dom, options);
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

function chatUnreadBadgeText(document, chatId) {
  const node = document.querySelector(`.chat-item[data-chat-id="${chatId}"] .unread-badge`);
  return node ? node.textContent.trim() : '';
}

function chatUnreadBadgeClassName(document, chatId) {
  const node = document.querySelector(`.chat-item[data-chat-id="${chatId}"] .unread-badge`);
  return node ? node.className : '';
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

test('chat info renders bot members once inside the members list', async (t) => {
  const chatId = 77;
  const requests = [];
  const dom = await bootAppDom({
    fetchHandler: ({ url, dom, currentUser }) => {
      requests.push(url.pathname);
      if (url.pathname === `/api/chats/${chatId}/preferences`) {
        return createJsonResponse(dom, {
          preferences: { notify_enabled: true, sounds_enabled: true },
        });
      }
      if (url.pathname === `/api/chats/${chatId}/members`) {
        return createJsonResponse(dom, [
          {
            id: currentUser.id,
            username: currentUser.username,
            display_name: currentUser.display_name,
            avatar_color: '#65aadd',
            avatar_url: null,
            is_ai_bot: 0,
          },
          {
            id: 12,
            username: 'openai_universal',
            display_name: 'OpenAI Universal',
            avatar_color: '#55c4c2',
            avatar_url: null,
            is_ai_bot: 1,
            ai_bot_id: 91,
            ai_bot_provider: 'openai',
            ai_bot_kind: 'universal',
            ai_bot_mention: 'openai_universal',
            ai_bot_model: 'gpt-4o-mini',
          },
        ]);
      }
      return null;
    },
  });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([{
    id: chatId,
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
  }], { currentChatId: chatId });

  await BananzaAppBridge.__testing.openChatInfoModal(document.getElementById('chatInfoBtn'));

  assert.equal(document.getElementById('chatBotInfoSection'), null);
  assert.equal(requests.includes(`/api/chats/${chatId}/bots`), false);

  const memberList = document.getElementById('chatMemberList');
  const rows = memberList.querySelectorAll('.user-list-item');
  const botRows = memberList.querySelectorAll('.user-list-item.is-ai-bot');
  const humanStatus = memberList.querySelector('.user-list-item[data-bot="0"] .admin-user-status');

  assert.equal(rows.length, 2);
  assert.equal(botRows.length, 1);
  assert.ok(humanStatus);
  assert.equal(humanStatus.textContent.trim(), 'offline');
  assert.equal(botRows[0].querySelector('.user-list-meta').textContent.trim(), '@openai_universal \u2022 gpt-4o-mini');
});

test('chat list keeps unread badges rendered for both active and inactive chats', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([
    {
      id: 41,
      type: 'private',
      name: 'greatkuzya',
      unread_count: 1,
      last_text: 'greatkuzya: ккк',
      last_time: '2026-04-29T20:29:00.000Z',
      created_at: '2026-04-29 20:00:00',
      private_user: {
        id: 2,
        display_name: 'greatkuzya',
        username: 'greatkuzya',
        avatar_color: '#65aadd',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
    {
      id: 42,
      type: 'private',
      name: 'Как правильно жрать',
      unread_count: 3,
      last_text: 'Типа Кузя: Че, нормально захожу, как все, не понял...',
      last_time: '2026-04-29T00:38:00.000Z',
      created_at: '2026-04-29 00:00:00',
      private_user: {
        id: 3,
        display_name: 'Как правильно жрать',
        username: 'food_chat',
        avatar_color: '#f0b020',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
  ], { currentChatId: 41 });

  assert.ok(document.querySelector('.chat-item[data-chat-id="41"].active'));
  assert.ok(document.querySelector('.chat-item[data-chat-id="42"]:not(.active)'));
  assert.equal(chatUnreadBadgeText(document, 41), '1');
  assert.equal(chatUnreadBadgeText(document, 42), '3');
  assert.match(chatUnreadBadgeClassName(document, 41), /\bunread-badge--active-chat\b/);
  assert.doesNotMatch(chatUnreadBadgeClassName(document, 42), /\bunread-badge--active-chat\b/);
});

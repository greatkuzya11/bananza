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
    ui_mobile_font_size: 5,
    ui_show_chat_folder_strip_in_all_chats: false,
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

async function waitForAnimationFrames(window, count = 2) {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }
}

async function waitForMs(window, ms = 0) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
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
      last_text: 'greatkuzya: \u043a\u043a\u043a',
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
      name: '\u041a\u0430\u043a \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e \u0436\u0440\u0430\u0442\u044c',
      unread_count: 3,
      last_text: '\u0422\u0438\u043f\u0430 \u041a\u0443\u0437\u044f: \u0427\u0435, \u043d\u043e\u0440\u043c\u0430\u043b\u044c\u043d\u043e \u0437\u0430\u0445\u043e\u0436\u0443, \u043a\u0430\u043a \u0432\u0441\u0435, \u043d\u0435 \u043f\u043e\u043d\u044f\u043b...',
      last_time: '2026-04-29T00:38:00.000Z',
      created_at: '2026-04-29 00:00:00',
      private_user: {
        id: 3,
        display_name: '\u041a\u0430\u043a \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e \u0436\u0440\u0430\u0442\u044c',
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

test('chat folders testing helpers filter the list and keep folder-local pins separate from All chats', async (t) => {
  const initialChats = [
    {
      id: 11,
      type: 'private',
      name: 'Pinned all chats',
      chat_list_pin_order: 1,
      unread_count: 0,
      last_text: 'Global pin',
      last_time: '2026-04-29T20:00:00.000Z',
      created_at: '2026-04-29 19:00:00',
      private_user: {
        id: 2,
        display_name: 'Pinned all chats',
        username: 'pinned_all',
        avatar_color: '#65aadd',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
    {
      id: 12,
      type: 'private',
      name: 'Folder pinned',
      unread_count: 2,
      last_text: 'Folder pin',
      last_time: '2026-04-29T18:00:00.000Z',
      created_at: '2026-04-29 18:00:00',
      private_user: {
        id: 3,
        display_name: 'Folder pinned',
        username: 'folder_pin',
        avatar_color: '#55c4c2',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
    {
      id: 13,
      type: 'private',
      name: 'Folder regular',
      unread_count: 1,
      last_text: 'Folder regular',
      last_time: '2026-04-29T21:00:00.000Z',
      created_at: '2026-04-29 17:00:00',
      private_user: {
        id: 4,
        display_name: 'Folder regular',
        username: 'folder_regular',
        avatar_color: '#f0b020',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
  ];
  const dom = await bootAppDom({
    fetchHandler: ({ url, dom }) => {
      if (url.pathname === '/api/chats') return createJsonResponse(dom, initialChats);
      return null;
    },
  });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  const strip = document.getElementById('activeChatFolderStrip');
  let stripScrollLeft = 0;
  const centerCalls = [];
  Object.defineProperty(strip, 'clientWidth', {
    configurable: true,
    get: () => 120,
  });
  Object.defineProperty(strip, 'scrollWidth', {
    configurable: true,
    get: () => 320,
  });
  Object.defineProperty(strip, 'scrollLeft', {
    configurable: true,
    get: () => stripScrollLeft,
    set: (value) => {
      stripScrollLeft = Number(value || 0);
    },
  });
  strip.scrollTo = ({ left, behavior }) => {
    centerCalls.push({ left: Number(left || 0), behavior: behavior || 'auto' });
    stripScrollLeft = Number(left || 0);
  };
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get() {
      if (this.dataset?.folderChip === '0') return 0;
      if (this.dataset?.folderChip === '9') return 164;
      return 0;
    },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      if (this.dataset?.folderChip === '0') return 86;
      if (this.dataset?.folderChip === '9') return 82;
      return 0;
    },
  });

  BananzaAppBridge.__testing.setChats(initialChats, { currentChatId: 11 });

  BananzaAppBridge.__testing.setChatFolders([{
    id: 9,
    name: 'Launch',
    kind: 'custom',
    sort_order: 1,
    chat_ids: [12, 13],
    pins: [{ chat_id: 12, pin_order: 1 }],
  }], {
    activeFolderId: 9,
  });
  await waitForAnimationFrames(dom.window, 3);

  assert.equal(document.getElementById('activeChatFolderBar').classList.contains('hidden'), false);
  assert.equal(document.getElementById('activeChatFolderName').textContent.trim(), 'Launch');
  assert.deepEqual(
    [...document.querySelectorAll('#activeChatFolderStrip [data-folder-chip]')].map((node) => node.textContent.trim()),
    ['\u0412\u0441\u0435 \u0447\u0430\u0442\u044b', 'Launch']
  );
  assert.equal(document.querySelector('#activeChatFolderStrip [data-folder-chip="9"]').classList.contains('is-active'), true);
  assert.deepEqual(centerCalls.at(-1), { left: 145, behavior: 'auto' });

  let renderedIds = [...document.querySelectorAll('#chatList .chat-item[data-chat-id]')]
    .map((node) => Number(node.dataset.chatId));
  assert.deepEqual(renderedIds, [12, 13]);
  assert.equal(document.querySelector('.chat-item[data-chat-id="12"]').classList.contains('is-pinned'), true);
  assert.equal(document.querySelector('.chat-item[data-chat-id="11"]'), null);

  BananzaAppBridge.__testing.setActiveChatFolder(0, { render: true });

  assert.equal(document.getElementById('activeChatFolderBar').classList.contains('hidden'), true);
  renderedIds = [...document.querySelectorAll('#chatList .chat-item[data-chat-id]')]
    .map((node) => Number(node.dataset.chatId));
  assert.equal(renderedIds[0], 11);
  assert.equal(document.querySelector('.chat-item[data-chat-id="12"]').classList.contains('is-pinned'), false);
});

test('chat folder transitions animate the shared list container and use smooth centering for user switches only', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  const strip = document.getElementById('activeChatFolderStrip');
  const content = document.getElementById('chatFolderListSurface');
  const bar = document.getElementById('activeChatFolderBar');
  let stripScrollLeft = 0;
  const centerCalls = [];
  Object.defineProperty(strip, 'clientWidth', {
    configurable: true,
    get: () => 140,
  });
  Object.defineProperty(strip, 'scrollWidth', {
    configurable: true,
    get: () => 420,
  });
  Object.defineProperty(strip, 'scrollLeft', {
    configurable: true,
    get: () => stripScrollLeft,
    set: (value) => {
      stripScrollLeft = Number(value || 0);
    },
  });
  strip.scrollTo = ({ left, behavior }) => {
    centerCalls.push({ left: Number(left || 0), behavior: behavior || 'auto' });
    stripScrollLeft = Number(left || 0);
  };
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get() {
      if (this.dataset?.folderChip === '0') return 0;
      if (this.dataset?.folderChip === '9') return 120;
      if (this.dataset?.folderChip === '10') return 260;
      return 0;
    },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      if (this.dataset?.folderChip === '0') return 86;
      if (this.dataset?.folderChip === '9') return 88;
      if (this.dataset?.folderChip === '10') return 92;
      return 0;
    },
  });

  BananzaAppBridge.__testing.setChats([
    {
      id: 21,
      type: 'private',
      name: 'Launch chat',
      unread_count: 1,
      last_text: 'Launch',
      last_time: '2026-04-29T20:29:00.000Z',
      created_at: '2026-04-29 20:00:00',
      private_user: {
        id: 21,
        display_name: 'Launch chat',
        username: 'launch_chat',
        avatar_color: '#65aadd',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
    {
      id: 22,
      type: 'private',
      name: 'Ops chat',
      unread_count: 2,
      last_text: 'Ops',
      last_time: '2026-04-29T20:30:00.000Z',
      created_at: '2026-04-29 20:01:00',
      private_user: {
        id: 22,
        display_name: 'Ops chat',
        username: 'ops_chat',
        avatar_color: '#55c4c2',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
  ], { currentChatId: 21 });

  BananzaAppBridge.__testing.setChatFolders([
    {
      id: 9,
      name: 'Launch',
      kind: 'custom',
      sort_order: 1,
      chat_ids: [21],
      pins: [],
    },
    {
      id: 10,
      name: 'Ops',
      kind: 'custom',
      sort_order: 2,
      chat_ids: [22],
      pins: [],
    },
  ], {
    activeFolderId: 9,
  });
  await waitForAnimationFrames(dom.window, 3);
  assert.deepEqual(centerCalls.at(-1), { left: 94, behavior: 'auto' });
  const launchChipBefore = document.querySelector('#activeChatFolderStrip [data-folder-chip="9"]');
  const opsChipBefore = document.querySelector('#activeChatFolderStrip [data-folder-chip="10"]');

  const transitionPromise = BananzaAppBridge.__testing.transitionToChatFolder(10, { persist: false });
  assert.equal(bar.classList.contains('is-folder-switching'), false);
  assert.equal(content.classList.contains('is-folder-switching'), true);
  assert.equal(content.classList.contains('is-folder-switching-out'), true);
  assert.equal(document.querySelector('#activeChatFolderStrip [data-folder-chip="10"]').classList.contains('is-active'), true);
  await transitionPromise;

  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder().id, 10);
  assert.deepEqual(centerCalls.at(-1), { left: 236, behavior: 'smooth' });
  assert.equal(content.classList.contains('is-folder-switching'), false);
  assert.equal(document.querySelector('#activeChatFolderStrip [data-folder-chip="9"]'), launchChipBefore);
  assert.equal(document.querySelector('#activeChatFolderStrip [data-folder-chip="10"]'), opsChipBefore);

  BananzaAppBridge.__testing.setChats([
    {
      id: 21,
      type: 'private',
      name: 'Launch chat',
      unread_count: 3,
      last_text: 'Launch updated',
      last_time: '2026-04-29T20:31:00.000Z',
      created_at: '2026-04-29 20:00:00',
      private_user: {
        id: 21,
        display_name: 'Launch chat',
        username: 'launch_chat',
        avatar_color: '#65aadd',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
    {
      id: 22,
      type: 'private',
      name: 'Ops chat',
      unread_count: 4,
      last_text: 'Ops updated',
      last_time: '2026-04-29T20:32:00.000Z',
      created_at: '2026-04-29 20:01:00',
      private_user: {
        id: 22,
        display_name: 'Ops chat',
        username: 'ops_chat',
        avatar_color: '#55c4c2',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
  ], { currentChatId: 21 });

  assert.equal(content.classList.contains('is-folder-switching'), false);
  assert.equal(document.querySelector('#activeChatFolderStrip [data-folder-chip="9"]'), launchChipBefore);
  assert.equal(document.querySelector('#activeChatFolderStrip [data-folder-chip="10"]'), opsChipBefore);

  const toAllPromise = BananzaAppBridge.__testing.transitionToChatFolder(0, { persist: false });
  assert.equal(bar.classList.contains('hidden'), false);
  assert.equal(document.querySelector('#activeChatFolderStrip [data-folder-chip="0"]').classList.contains('is-active'), true);
  assert.equal(content.classList.contains('is-folder-switching'), true);
  await toAllPromise;
  assert.equal(bar.classList.contains('hidden'), true);
});

test('chat folder strip visibility toggle lives on the All chats row and keeps the picker open', async (t) => {
  const dom = await bootAppDom({
    fetchHandler: async ({ url, init, dom: testDom, currentUser }) => {
      if (url.pathname !== '/api/user/chat-folder-strip-visibility') return null;
      const payload = typeof init.body === 'string' ? JSON.parse(init.body) : (init.body || {});
      currentUser.ui_show_chat_folder_strip_in_all_chats = Boolean(payload.show_in_all_chats);
      return createJsonResponse(testDom, { user: currentUser });
    },
  });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  const bar = document.getElementById('activeChatFolderBar');
  const picker = document.getElementById('chatFolderPicker');

  BananzaAppBridge.__testing.setChats([
    {
      id: 41,
      type: 'private',
      name: 'Folder chat',
      unread_count: 0,
      last_text: 'Hello',
      last_time: '2026-04-29T20:29:00.000Z',
      created_at: '2026-04-29 20:00:00',
      private_user: {
        id: 41,
        display_name: 'Folder chat',
        username: 'folder_chat',
        avatar_color: '#65aadd',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
  ], { currentChatId: 41 });

  BananzaAppBridge.__testing.setChatFolders([
    {
      id: 9,
      name: 'Launch',
      kind: 'custom',
      sort_order: 1,
      chat_ids: [41],
      pins: [],
    },
  ], {
    activeFolderId: 0,
  });
  await waitForAnimationFrames(dom.window, 3);

  assert.equal(bar.classList.contains('hidden'), true);

  document.getElementById('chatFoldersBtn').click();
  await waitForAnimationFrames(dom.window, 2);

  const toggle = picker.querySelector('[data-chat-folder-strip-toggle]');
  assert.ok(toggle);
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(picker.classList.contains('hidden'), false);

  toggle.click();
  await waitForAnimationFrames(dom.window, 2);

  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(bar.classList.contains('hidden'), false);
  assert.equal(picker.classList.contains('hidden'), false);
  assert.equal(BananzaAppBridge.__testing.getCurrentUser().ui_show_chat_folder_strip_in_all_chats, true);
});

test('mobile return to the chat list animates the folder content enter phase', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  const content = document.getElementById('chatFolderListSurface');
  const bar = document.getElementById('activeChatFolderBar');
  const sidebar = document.getElementById('sidebar');

  BananzaAppBridge.__testing.setChats([
    {
      id: 31,
      type: 'private',
      name: 'Mobile chat',
      unread_count: 0,
      last_text: 'Hello',
      last_time: '2026-04-29T20:29:00.000Z',
      created_at: '2026-04-29 20:00:00',
      private_user: {
        id: 31,
        display_name: 'Mobile chat',
        username: 'mobile_chat',
        avatar_color: '#65aadd',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
  ], { currentChatId: 31 });

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: false });
  sidebar.classList.add('sidebar-hidden');

  BananzaAppBridge.__testing.revealSidebarFromChat({ forceAnimation: true });

  assert.equal(content.classList.contains('is-folder-switching'), true);
  assert.equal(content.classList.contains('is-folder-switching-in'), true);
  assert.equal(bar.classList.contains('is-folder-switching'), false);
  await waitForMs(dom.window, 360);
  assert.equal(content.classList.contains('is-folder-switching'), false);
});

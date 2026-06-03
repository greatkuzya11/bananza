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
  window.localStorage.removeItem('lastChat');

  window.fetch = async (input, init = {}) => {
    const url = new URL(String(input), window.location.origin);
    if (typeof fetchHandler === 'function') {
      const handled = await fetchHandler({ url, init, dom, currentUser });
      if (handled) return handled;
    }
    const chatShotMatch = url.pathname.match(/^\/api\/chats\/(\d+)\/chatshot$/);
    if (chatShotMatch) {
      return createJsonResponse(dom, {
        chatId: Number(chatShotMatch[1]),
        enabled: false,
        requested_enabled: false,
        botId: null,
        style: 'comic',
        ready: false,
        message_count: 0,
        bots: [],
        selectedBot: null,
      });
    }
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
        throw new Error(`Unexpected fetch in private chat DOM test: ${url.pathname}`);
    }
  };
}

async function bootAppDom(options = {}) {
  const dom = createAppDom();
  installAppRuntimeStubs(dom, options);
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
  loadBrowserScript(dom, 'public/js/qip-infium-original.js');
  loadBrowserScript(dom, 'public/js/qip-hd.js');
  loadAppScript(dom);
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

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForCondition(window, predicate, { attempts = 50, delayMs = 0 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) return;
    await waitForMs(window, delayMs);
  }
  throw new Error('Timed out waiting for condition');
}

function createTouchPoint({ identifier = 1, clientX = 0, clientY = 0 } = {}) {
  return { identifier, clientX, clientY };
}

function createTouchEvent(window, type, { touches = [], changedTouches = touches } = {}) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { configurable: true, value: touches },
    changedTouches: { configurable: true, value: changedTouches },
  });
  return event;
}

function dispatchTouchSwipe(window, target, {
  identifier = 1,
  startX = 320,
  startY = 420,
  moveX = 180,
  moveY = startY,
  endX = moveX,
  endY = moveY,
} = {}) {
  const startTouch = createTouchPoint({ identifier, clientX: startX, clientY: startY });
  const moveTouch = createTouchPoint({ identifier, clientX: moveX, clientY: moveY });
  const endTouch = createTouchPoint({ identifier, clientX: endX, clientY: endY });
  target.dispatchEvent(createTouchEvent(window, 'touchstart', {
    touches: [startTouch],
    changedTouches: [startTouch],
  }));
  const moveEvent = createTouchEvent(window, 'touchmove', {
    touches: [moveTouch],
    changedTouches: [moveTouch],
  });
  target.dispatchEvent(moveEvent);
  const endEvent = createTouchEvent(window, 'touchend', {
    touches: [],
    changedTouches: [endTouch],
  });
  target.dispatchEvent(endEvent);
  return { moveEvent, endEvent };
}

function startTouchSwipe(window, target, {
  identifier = 1,
  startX = 320,
  startY = 420,
  moveX = 180,
  moveY = startY,
} = {}) {
  const startTouch = createTouchPoint({ identifier, clientX: startX, clientY: startY });
  const moveTouch = createTouchPoint({ identifier, clientX: moveX, clientY: moveY });
  target.dispatchEvent(createTouchEvent(window, 'touchstart', {
    touches: [startTouch],
    changedTouches: [startTouch],
  }));
  const moveEvent = createTouchEvent(window, 'touchmove', {
    touches: [moveTouch],
    changedTouches: [moveTouch],
  });
  target.dispatchEvent(moveEvent);
  return {
    moveEvent,
    end(endX = moveX, endY = moveY) {
      const endTouch = createTouchPoint({ identifier, clientX: endX, clientY: endY });
      const endEvent = createTouchEvent(window, 'touchend', {
        touches: [],
        changedTouches: [endTouch],
      });
      target.dispatchEvent(endEvent);
      return endEvent;
    },
  };
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

function chatItemTimeText(document, chatId) {
  const node = document.querySelector(`.chat-item[data-chat-id="${chatId}"] .chat-item-time`);
  return node ? node.textContent.trim() : '';
}

function renderedChatIds(document) {
  return [...document.querySelectorAll('#chatList .chat-item[data-chat-id]')]
    .map((node) => Number(node.dataset.chatId));
}

function localIsoWithOffset(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    + `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function makeFolderSwipeChat(id, name, lastTime = `2026-04-29T20:${String(Number(id || 0) % 50).padStart(2, '0')}:00.000Z`) {
  return {
    id,
    type: 'private',
    name,
    unread_count: 0,
    last_text: name,
    last_time: lastTime,
    created_at: '2026-04-29 20:00:00',
    private_user: {
      id,
      display_name: name,
      username: name.toLowerCase().replace(/\s+/g, '_'),
      avatar_color: '#65aadd',
      avatar_url: null,
      is_ai_bot: 0,
    },
  };
}

function createChatListFetchHandler(chatList) {
  return ({ url, dom }) => {
    if (url.pathname === '/api/chats') return createJsonResponse(dom, chatList);
    return null;
  };
}

function installFolderStripMetrics(dom, centerCalls = []) {
  const { document } = dom.window;
  const strip = document.getElementById('activeChatFolderStrip');
  let stripScrollLeft = 0;
  Object.defineProperty(strip, 'clientWidth', {
    configurable: true,
    get: () => 140,
  });
  Object.defineProperty(strip, 'scrollWidth', {
    configurable: true,
    get: () => 460,
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

test('chat background is rendered on a stable layer instead of the messages scroller', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  const chatView = document.getElementById('chatView');
  const layer = document.getElementById('chatBackgroundLayer');
  const messages = document.getElementById('messages');

  BananzaAppBridge.__testing.setChats([{
    id: 81,
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
  }], { currentChatId: 81 });

  BananzaAppBridge.__testing.applyChatUpdate({
    id: 81,
    background_url: '/uploads/backgrounds/test-bg.jpg',
    background_style: 'tile',
  });

  assert.equal(chatView.classList.contains('has-chat-background'), true);
  assert.match(layer.style.backgroundImage, /test-bg\.jpg/);
  assert.equal(layer.style.backgroundRepeat, 'repeat');
  assert.equal(layer.style.backgroundSize, 'auto');
  assert.equal(layer.style.backgroundPosition, 'left top');
  assert.equal(messages.classList.contains('has-bg'), false);
  assert.equal(messages.style.backgroundImage, '');

  BananzaAppBridge.__testing.applyChatUpdate({
    id: 81,
    background_url: '/uploads/backgrounds/test-bg.jpg',
    background_style: 'contain',
  });

  assert.match(layer.style.backgroundImage, /test-bg\.jpg/);
  assert.equal(layer.style.backgroundRepeat, 'no-repeat');
  assert.equal(layer.style.backgroundSize, 'contain');
  assert.equal(layer.style.backgroundPosition, 'center center');
  assert.equal(messages.style.backgroundImage, '');

  BananzaAppBridge.__testing.applyChatUpdate({
    id: 81,
    background_url: '/uploads/backgrounds/test-bg.jpg',
    background_style: '100%',
  });

  assert.equal(layer.style.backgroundRepeat, 'no-repeat');
  assert.equal(layer.style.backgroundSize, '100%');
  assert.equal(layer.style.backgroundPosition, 'center center');
  assert.equal(messages.style.backgroundImage, '');

  BananzaAppBridge.__testing.applyChatUpdate({
    id: 81,
    background_url: '/uploads/backgrounds/test-bg.jpg',
    background_style: 'center',
  });

  assert.equal(layer.style.backgroundRepeat, 'no-repeat');
  assert.equal(layer.style.backgroundSize, 'contain');
  assert.equal(layer.style.backgroundPosition, 'center center');
  assert.equal(messages.style.backgroundImage, '');

  BananzaAppBridge.__testing.applyChatUpdate({
    id: 81,
    background_url: null,
  });

  assert.equal(chatView.classList.contains('has-chat-background'), false);
  assert.equal(layer.style.backgroundImage, '');
  assert.equal(layer.style.backgroundRepeat, '');
  assert.equal(layer.style.backgroundSize, '');
  assert.equal(layer.style.backgroundPosition, '');
  assert.equal(messages.style.backgroundImage, '');
});

test('mobile keyboard resize keeps chat background height anchored to viewport baseline', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  const root = document.documentElement;
  const chatArea = document.getElementById('chatArea');
  const layer = document.getElementById('chatBackgroundLayer');
  const messages = document.getElementById('messages');
  let chatAreaHeight = 844;

  chatArea.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 390,
    height: chatAreaHeight,
    right: 390,
    bottom: chatAreaHeight,
  });

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: false, syncChatMetrics: true });
  assert.equal(root.style.getPropertyValue('--chat-bg-stable-height'), '844px');

  BananzaAppBridge.__testing.setChats([{
    id: 82,
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
  }], { currentChatId: 82 });
  BananzaAppBridge.__testing.applyChatUpdate({
    id: 82,
    background_url: '/uploads/backgrounds/mobile-bg.jpg',
    background_style: 'cover',
  });

  chatAreaHeight = 420;
  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await waitForAnimationFrames(dom.window, 2);

  assert.equal(root.style.getPropertyValue('--chat-bg-stable-height'), '844px');
  assert.match(layer.style.backgroundImage, /mobile-bg\.jpg/);
  assert.equal(layer.style.backgroundSize, 'cover');
  assert.equal(messages.style.backgroundImage, '');
  assert.equal(messages.classList.contains('has-bg'), false);
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

test('chat list renders QIP custom emojis in last message previews', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([
    {
      ...makeFolderSwipeChat(45, 'QIP preview'),
      last_user: 'Admin 11',
      last_text: ':qip-infium-047:',
    },
    {
      ...makeFolderSwipeChat(46, 'QIP HD preview'),
      last_user: 'Admin 11',
      last_text: ':qip-hd-qippda-aa:',
    },
  ], { currentChatId: 45 });

  const qipPreview = document.querySelector('.chat-item[data-chat-id="45"] .chat-item-last span');
  const qipImg = qipPreview?.querySelector('img.qip-infium-emoji.chat-preview-emoji');
  assert.ok(qipImg);
  assert.match(qipImg.getAttribute('src') || '', /\/assets\/emoji\/qip-infium-original\/047\.gif$/);
  assert.equal(qipPreview.textContent.includes(':qip-infium-047:'), false);

  const qipHdPreview = document.querySelector('.chat-item[data-chat-id="46"] .chat-item-last span');
  const qipHdImg = qipHdPreview?.querySelector('img.qip-hd-emoji.chat-preview-emoji');
  assert.ok(qipHdImg);
  assert.match(qipHdImg.getAttribute('src') || '', /\/assets\/emoji\/qip-hd\/qippda_aa\.gif$/);
  assert.equal(qipHdPreview.textContent.includes(':qip-hd-qippda-aa:'), false);
});

test('chat list shows time only for today and short date for older last messages', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  const today = new Date();
  today.setHours(12, 34, 0, 0);
  const older = new Date(today);
  older.setDate(older.getDate() - 8);
  older.setHours(9, 5, 0, 0);

  BananzaAppBridge.__testing.setChats([
    {
      id: 51,
      type: 'private',
      name: 'Today chat',
      unread_count: 0,
      last_text: 'Fresh message',
      last_time: localIsoWithOffset(today),
      created_at: localIsoWithOffset(today),
      private_user: {
        id: 5,
        display_name: 'Today chat',
        username: 'today_chat',
        avatar_color: '#65aadd',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
    {
      id: 52,
      type: 'private',
      name: 'Older chat',
      unread_count: 0,
      last_text: 'Older message',
      last_time: localIsoWithOffset(older),
      created_at: localIsoWithOffset(older),
      private_user: {
        id: 6,
        display_name: 'Older chat',
        username: 'older_chat',
        avatar_color: '#f0b020',
        avatar_url: null,
        is_ai_bot: 0,
      },
    },
  ], { currentChatId: 51 });

  assert.equal(chatItemTimeText(document, 51), today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  assert.equal(chatItemTimeText(document, 52), older.toLocaleDateString([], { day: 'numeric', month: 'short' }));
  assert.doesNotMatch(chatItemTimeText(document, 52), /\d{1,2}:\d{2}/);
});

test('chat list shows compact tool badges for context convert and ChatShot', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([
    {
      id: 61,
      type: 'group',
      name: 'Context tools',
      unread_count: 0,
      last_text: 'Tool status',
      last_time: '2026-04-29T20:00:00.000Z',
      created_at: '2026-04-29 20:00:00',
      context_transform_enabled: 1,
      chatshot_enabled: 0,
    },
    {
      id: 62,
      type: 'group',
      name: 'ChatShot tools',
      unread_count: 0,
      last_text: 'Tool status',
      last_time: '2026-04-29T19:00:00.000Z',
      created_at: '2026-04-29 19:00:00',
      context_transform_enabled: 0,
      chatshot_enabled: 1,
    },
    {
      id: 63,
      type: 'group',
      name: 'Plain chat',
      unread_count: 0,
      last_text: 'No tools',
      last_time: '2026-04-29T18:00:00.000Z',
      created_at: '2026-04-29 18:00:00',
      context_transform_enabled: 0,
      chatshot_enabled: 0,
    },
  ]);

  const contextBadge = document.querySelector('.chat-item[data-chat-id="61"] .chat-item-context-convert-indicator');
  const chatShotBadge = document.querySelector('.chat-item[data-chat-id="62"] .chat-item-chatshot-indicator');
  assert.ok(contextBadge);
  assert.ok(chatShotBadge);
  assert.equal(contextBadge.textContent, String.fromCodePoint(0x1F34C));
  assert.equal(chatShotBadge.textContent, String.fromCodePoint(0x1F4F8));
  assert.equal(document.querySelector('.chat-item[data-chat-id="63"] .chat-item-tool-indicator'), null);
});

test('saved active chat folder is restored after startup folders load', async (t) => {
  const initialChats = [
    {
      id: 71,
      type: 'group',
      name: 'All chats only',
      unread_count: 0,
      last_text: 'Outside folder',
      last_time: '2026-04-29T20:00:00.000Z',
      created_at: '2026-04-29 20:00:00',
    },
    {
      id: 72,
      type: 'group',
      name: 'Saved folder first',
      unread_count: 0,
      last_text: 'Inside folder',
      last_time: '2026-04-29T19:00:00.000Z',
      created_at: '2026-04-29 19:00:00',
    },
    {
      id: 73,
      type: 'group',
      name: 'Saved folder second',
      unread_count: 0,
      last_text: 'Inside folder',
      last_time: '2026-04-29T18:00:00.000Z',
      created_at: '2026-04-29 18:00:00',
    },
  ];
  const folderPayload = {
    id: 9,
    name: 'Saved',
    kind: 'custom',
    sort_order: 1,
    chat_ids: [72, 73],
    pins: [],
  };
  const switchFolderPayload = {
    id: 10,
    name: 'Manual switch',
    kind: 'custom',
    sort_order: 2,
    chat_ids: [71],
    pins: [],
  };
  const dom = await bootAppDom({
    fetchHandler: ({ url, dom }) => {
      if (url.pathname === '/api/auth/me') {
        dom.window.localStorage.setItem('bananza:active-chat-folder:1', '9');
        return null;
      }
      if (url.pathname === '/api/chats') return createJsonResponse(dom, initialChats);
      if (url.pathname === '/api/chat-folders') {
        return createJsonResponse(dom, { folders: [folderPayload, switchFolderPayload] });
      }
      return null;
    },
  });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge, localStorage } = dom.window;
  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder()?.id, 9);
  assert.deepEqual(renderedChatIds(document), [72, 73]);
  assert.equal(localStorage.getItem('bananza:active-chat-folder:1'), '9');

  await BananzaAppBridge.__testing.transitionToChatFolder(10, { persist: true });
  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder()?.id, 10);
  assert.deepEqual(renderedChatIds(document), [71]);
  assert.equal(localStorage.getItem('bananza:active-chat-folder:1'), '10');
});

test('startup cache does not flash all chats while saved active folder is loading', async (t) => {
  const initialChats = [
    {
      id: 71,
      type: 'group',
      name: 'All chats only',
      unread_count: 0,
      last_text: 'Outside folder',
      last_time: '2026-04-29T20:00:00.000Z',
      created_at: '2026-04-29 20:00:00',
    },
    {
      id: 72,
      type: 'group',
      name: 'Saved folder first',
      unread_count: 0,
      last_text: 'Inside folder',
      last_time: '2026-04-29T19:00:00.000Z',
      created_at: '2026-04-29 19:00:00',
    },
    {
      id: 73,
      type: 'group',
      name: 'Saved folder second',
      unread_count: 0,
      last_text: 'Inside folder',
      last_time: '2026-04-29T18:00:00.000Z',
      created_at: '2026-04-29 18:00:00',
    },
  ];
  const folderGate = createDeferred();
  let foldersRequested = false;
  const dom = createAppDom();
  t.after(() => {
    dom.window.close();
  });
  installAppRuntimeStubs(dom, {
    fetchHandler: async ({ url, dom }) => {
      if (url.pathname === '/api/chats') return createJsonResponse(dom, initialChats);
      if (url.pathname === '/api/chat-folders') {
        foldersRequested = true;
        await folderGate.promise;
        return createJsonResponse(dom, {
          folders: [{
            id: 9,
            name: 'Saved',
            kind: 'custom',
            sort_order: 1,
            chat_ids: [72, 73],
            pins: [],
          }],
        });
      }
      return null;
    },
  });
  installVisualViewportMock(dom.window, {
    width: 390,
    height: 844,
    offsetTop: 0,
    offsetLeft: 0,
  });
  dom.window.localStorage.setItem('bananza:active-chat-folder:1', '9');
  dom.window.localStorage.setItem('bananza:chat-list:1', JSON.stringify({
    version: 3,
    chats: initialChats,
  }));

  const ready = new Promise((resolve) => {
    dom.window.addEventListener('bananza:ready', resolve, { once: true });
  });
  const paintedChatIdSnapshots = [];
  const observer = new dom.window.MutationObserver(() => {
    paintedChatIdSnapshots.push(renderedChatIds(dom.window.document));
  });
  observer.observe(dom.window.document.getElementById('chatList'), { childList: true, subtree: true });
  loadBrowserScript(dom, 'public/js/ai-image-risk.js');
  loadBrowserScript(dom, 'public/js/qip-infium-original.js');
  loadBrowserScript(dom, 'public/js/qip-hd.js');
  loadAppScript(dom);
  await waitForCondition(dom.window, () => foldersRequested);
  await waitForMs(dom.window, 0);

  assert.deepEqual(renderedChatIds(dom.window.document), []);
  assert.equal(
    paintedChatIdSnapshots.some((ids) => ids.includes(71) && ids.includes(72) && ids.includes(73)),
    false
  );

  folderGate.resolve();
  await ready;
  await waitForMs(dom.window, 0);
  observer.disconnect();

  assert.deepEqual(renderedChatIds(dom.window.document), [72, 73]);
});

test('stale saved active chat folder falls back to all chats after startup folders load', async (t) => {
  const initialChats = [
    {
      id: 81,
      type: 'group',
      name: 'Fallback first',
      unread_count: 0,
      last_text: 'A',
      last_time: '2026-04-29T20:00:00.000Z',
      created_at: '2026-04-29 20:00:00',
    },
    {
      id: 82,
      type: 'group',
      name: 'Fallback second',
      unread_count: 0,
      last_text: 'B',
      last_time: '2026-04-29T19:00:00.000Z',
      created_at: '2026-04-29 19:00:00',
    },
  ];
  const dom = await bootAppDom({
    fetchHandler: ({ url, dom }) => {
      if (url.pathname === '/api/auth/me') {
        dom.window.localStorage.setItem('bananza:active-chat-folder:1', '404');
        return null;
      }
      if (url.pathname === '/api/chats') return createJsonResponse(dom, initialChats);
      if (url.pathname === '/api/chat-folders') {
        return createJsonResponse(dom, {
          folders: [{
            id: 9,
            name: 'Existing',
            kind: 'custom',
            sort_order: 1,
            chat_ids: [82],
            pins: [],
          }],
        });
      }
      return null;
    },
  });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge, localStorage } = dom.window;
  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder(), null);
  assert.deepEqual(renderedChatIds(document), [81, 82]);
  assert.equal(localStorage.getItem('bananza:active-chat-folder:1'), '0');
});

test('chat list rerender reuses unchanged avatar image nodes', async (t) => {
  const chat = makeFolderSwipeChat(501, 'Avatar Chat');
  chat.private_user.avatar_url = '/uploads/avatars/avatar-a.png';
  const dom = await bootAppDom({
    fetchHandler: createChatListFetchHandler([chat]),
  });
  t.after(() => dom.window.close());

  const { document, BananzaAppBridge } = dom.window;
  const firstImg = document.querySelector('#chatList .chat-item[data-chat-id="501"] .avatar-img');
  assert.ok(firstImg);

  BananzaAppBridge.__testing.setChats([chat]);
  await waitForMs(dom.window, 0);
  const rerenderedImg = document.querySelector('#chatList .chat-item[data-chat-id="501"] .avatar-img');
  assert.equal(rerenderedImg, firstImg);

  const updatedChat = {
    ...chat,
    private_user: {
      ...chat.private_user,
      avatar_url: '/uploads/avatars/avatar-b.png',
    },
  };
  BananzaAppBridge.__testing.setChats([updatedChat]);
  await waitForMs(dom.window, 0);
  const updatedImg = document.querySelector('#chatList .chat-item[data-chat-id="501"] .avatar-img');
  assert.ok(updatedImg);
  assert.notEqual(updatedImg, firstImg);
  assert.equal(updatedImg.getAttribute('src'), '/uploads/avatars/avatar-b.png');
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

test('mobile folder swipe switches pages and centers the active folder chip', async (t) => {
  const initialChats = [
    makeFolderSwipeChat(101, 'All chat'),
    makeFolderSwipeChat(102, 'Launch chat'),
    makeFolderSwipeChat(103, 'Ops chat'),
  ];
  const dom = await bootAppDom({ fetchHandler: createChatListFetchHandler(initialChats) });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  const centerCalls = [];
  installFolderStripMetrics(dom, centerCalls);

  BananzaAppBridge.__testing.setChats(initialChats);
  BananzaAppBridge.__testing.setChatFolders([
    { id: 9, name: 'Launch', kind: 'custom', sort_order: 1, chat_ids: [102], pins: [] },
    { id: 10, name: 'Ops', kind: 'custom', sort_order: 2, chat_ids: [103], pins: [] },
  ], { activeFolderId: 0 });
  BananzaAppBridge.__testing.setMobileBaseScene('sidebar', { hideInactive: false });
  await waitForMs(dom.window, 360);

  assert.equal(document.getElementById('activeChatFolderBar').classList.contains('hidden'), true);

  const nextGesture = startTouchSwipe(dom.window, document.getElementById('chatList'), {
    startX: 330,
    moveX: 160,
  });

  const swipeStage = document.querySelector('.chat-folder-swipe-stage');
  assert.ok(swipeStage, 'swipe stage is visible while the finger is still dragging');
  assert.deepEqual(
    [...swipeStage.querySelectorAll('[data-folder-swipe-role="adjacent"] .chat-item[data-chat-id]')]
      .map((node) => Number(node.dataset.chatId)),
    [102]
  );
  assert.match(
    document.querySelector('.chat-folder-swipe-track').style.transform,
    /translate3d\(-170px, 0, 0\)/
  );
  nextGesture.end();
  await waitForMs(dom.window, 560);

  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder().id, 9);
  assert.equal(document.querySelector('.chat-folder-swipe-stage'), null);
  assert.deepEqual(
    [...document.querySelectorAll('#chatList .chat-item[data-chat-id]')].map((node) => Number(node.dataset.chatId)),
    [102]
  );
  assert.equal(document.querySelector('#activeChatFolderStrip [data-folder-chip="9"]').classList.contains('is-active'), true);
  assert.deepEqual(centerCalls.at(-1), { left: 94, behavior: 'smooth' });

  dispatchTouchSwipe(dom.window, document.getElementById('chatList'), {
    identifier: 2,
    startX: 100,
    moveX: 250,
    endX: 250,
  });
  await waitForMs(dom.window, 560);

  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder(), null);
  assert.equal(document.getElementById('activeChatFolderBar').classList.contains('hidden'), true);
});

test('mobile folder swipe ignores vertical and short drags, snaps at edges, and suppresses row taps', async (t) => {
  const initialChats = [
    makeFolderSwipeChat(101, 'All chat'),
    makeFolderSwipeChat(102, 'Launch chat'),
    makeFolderSwipeChat(103, 'Current chat'),
  ];
  const dom = await bootAppDom({ fetchHandler: createChatListFetchHandler(initialChats) });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  installFolderStripMetrics(dom, []);

  BananzaAppBridge.__testing.setChats(initialChats);
  BananzaAppBridge.__testing.setChatFolders([
    { id: 9, name: 'Launch', kind: 'custom', sort_order: 1, chat_ids: [102], pins: [] },
    { id: 10, name: 'Current', kind: 'custom', sort_order: 2, chat_ids: [103], pins: [] },
  ], { activeFolderId: 9 });
  BananzaAppBridge.__testing.setMobileBaseScene('sidebar', { hideInactive: false });
  await waitForMs(dom.window, 360);

  const chatList = document.getElementById('chatList');
  const content = document.getElementById('chatFolderListSurface');

  dispatchTouchSwipe(dom.window, chatList, {
    startX: 260,
    moveX: 232,
    endX: 232,
  });
  await waitForMs(dom.window, 260);
  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder().id, 9);
  assert.equal(content.style.transform, '');

  dispatchTouchSwipe(dom.window, chatList, {
    identifier: 2,
    startX: 260,
    startY: 410,
    moveX: 130,
    moveY: 220,
    endX: 130,
    endY: 220,
  });
  await waitForMs(dom.window, 260);
  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder().id, 9);
  assert.equal(content.style.transform, '');

  BananzaAppBridge.__testing.setActiveChatFolder(0, { render: true });
  await waitForAnimationFrames(dom.window, 2);
  const edgeGesture = startTouchSwipe(dom.window, chatList, {
    identifier: 3,
    startX: 120,
    moveX: 300,
  });
  assert.equal(document.querySelector('.chat-folder-swipe-stage'), null);
  edgeGesture.end();
  await waitForMs(dom.window, 280);
  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder(), null);
  assert.equal(content.style.transform, '');

  const firstRow = document.querySelector('.chat-item[data-chat-id="101"]');
  dispatchTouchSwipe(dom.window, firstRow, {
    identifier: 4,
    startX: 330,
    moveX: 150,
    endX: 150,
  });
  firstRow.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await waitForMs(dom.window, 560);

  assert.equal(BananzaAppBridge.getCurrentChatId(), null);
  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder().id, 9);
});

test('desktop width does not enable chat folder page swiping', async (t) => {
  const initialChats = [
    makeFolderSwipeChat(101, 'All chat'),
    makeFolderSwipeChat(102, 'Launch chat'),
  ];
  const dom = await bootAppDom({ fetchHandler: createChatListFetchHandler(initialChats) });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  Object.defineProperty(dom.window, 'innerWidth', {
    configurable: true,
    value: 1024,
  });

  BananzaAppBridge.__testing.setChats(initialChats, { currentChatId: 101 });
  BananzaAppBridge.__testing.setChatFolders([
    { id: 9, name: 'Launch', kind: 'custom', sort_order: 1, chat_ids: [102], pins: [] },
  ], { activeFolderId: 0 });
  await waitForAnimationFrames(dom.window, 2);

  dispatchTouchSwipe(dom.window, document.getElementById('chatList'), {
    startX: 800,
    moveX: 520,
    endX: 520,
  });
  await waitForMs(dom.window, 260);

  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder(), null);
  assert.deepEqual(
    [...document.querySelectorAll('#chatList .chat-item[data-chat-id]')].map((node) => Number(node.dataset.chatId)),
    [102, 101]
  );
  assert.equal(document.getElementById('chatFolderListSurface').style.transform, '');
  assert.equal(document.querySelector('.chat-folder-swipe-stage'), null);
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

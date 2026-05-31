const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installVisualViewportMock,
  loadAppRuntimeScripts,
  loadAppScript,
  loadBrowserScript,
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

function loadOpenChatRuntime(dom) {
  loadAppRuntimeScripts(dom);
  return dom.window.BananzaApp.openChat;
}

test('open-chat modules publish expected factories', () => {
  const dom = createAppDom();
  const openChat = loadOpenChatRuntime(dom);

  assert.equal(typeof openChat.pages.createMessagePagesController, 'function');
  assert.equal(typeof openChat.readReceipts.createReadReceiptController, 'function');
  assert.equal(typeof openChat.scroll.createScrollController, 'function');
  assert.equal(typeof openChat.mediaPlayback.createMediaPlaybackController, 'function');
  assert.equal(typeof openChat.controller.createOpenChatController, 'function');
  dom.window.close();
});

test('pages controller normalizes, fetches, caches, and warms assets', async () => {
  const dom = createAppDom();
  const { window } = dom;
  const openChat = loadOpenChatRuntime(dom);
  const calls = [];
  const warmed = [];
  const cacheCalls = [];
  const fakeCache = {
    writeWindow(chatId, messages, meta) {
      cacheCalls.push(['writeWindow', chatId, messages.map((msg) => msg.id), meta]);
      return Promise.resolve(true);
    },
    getCachedRange(chatId) {
      cacheCalls.push(['getCachedRange', chatId]);
      return Promise.resolve(null);
    },
    readChatMeta(chatId) {
      cacheCalls.push(['readChatMeta', chatId]);
      return Promise.resolve({ maxId: 9 });
    },
    writeChatMeta(chatId, patch) {
      cacheCalls.push(['writeChatMeta', chatId, patch]);
      return Promise.resolve(patch);
    },
    writePage(chatId, page) {
      cacheCalls.push(['writePage', chatId, page.direction, page.cursor]);
      return Promise.resolve(true);
    },
    readPage(chatId, direction, cursor) {
      cacheCalls.push(['readPage', chatId, direction, cursor]);
      return Promise.resolve({ complete: true, messages: [{ id: 3 }] });
    },
  };
  const controller = openChat.pages.createMessagePagesController({
    api: async (url, opts = {}) => {
      calls.push({ url, opts });
      return {
        messages: [{ id: 1 }, { id: 2 }],
        pin_events: [{ id: 5, chat_id: 7, message_id: 1, action: 'pinned' }],
        has_more_before: true,
        has_more_after: false,
        member_last_reads: { 1: 2 },
      };
    },
    cache: fakeCache,
    cacheAssets: async (urls) => warmed.push(...urls),
    config: { MESSAGE_CACHE_LIMIT: 25 },
    attachments: window.BananzaApp.attachments,
    state: {
      getChatById: () => ({ id: 7, last_message_id: 11 }),
    },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(controller.normalizeMessagesPage([{ id: 1 }]))), {
    messages: [{ id: 1 }],
    pinEvents: [],
    hasMoreBefore: null,
    hasMoreAfter: null,
  });
  const normalized = controller.normalizeMessagesPage({ messages: [], has_more_before: false, has_more_after: true });
  assert.equal(normalized.hasMoreAfter, true);

  const result = await controller.fetchMessagesPage(7, new window.URLSearchParams({ limit: '2', before: '9' }));
  assert.equal(calls[0].url, '/api/chats/7/messages?limit=2&before=9');
  assert.deepEqual(result.messages.map((msg) => msg.id), [1, 2]);
  assert.equal(result.pinEvents[0].message_id, 1);
  assert.deepEqual(result.memberLastReads, { 1: 2 });

  await controller.cacheMessages(7, [{ id: 4 }], { hasMoreBefore: true, hasMoreAfter: false });
  await controller.readCachedChatRange(7);
  await controller.writeCachedChatMeta(7, { maxId: 4 });
  controller.cacheCursorPage(7, 'before', 4, [{ id: 2 }], {});
  const cachedPage = await controller.readCachedCursorPage(7, 'after', 4);
  controller.warmMessageWindowAssets({ background_url: '/bg.png' }, [{ avatar_url: '/a.png', file_type: 'image', file_stored: 'pic.png' }]);
  await wait(window);

  assert.equal(cachedPage.messages[0].id, 3);
  assert.ok(cacheCalls.some((entry) => entry[0] === 'writeWindow'));
  assert.ok(cacheCalls.some((entry) => entry[0] === 'writeChatMeta'));
  assert.ok(warmed.includes('/bg.png'));
  assert.ok(warmed.includes('/a.png'));
  dom.window.close();
});

test('read receipt controller stores reads, applies own state, and updates chat list service', async () => {
  const dom = createAppDom();
  const openChat = loadOpenChatRuntime(dom);
  const chats = [{ id: 7, type: 'private', last_message_id: 10, last_read_id: 0, unread_count: 3, first_unread_id: 4 }];
  const updates = [];
  const controller = openChat.readReceipts.createReadReceiptController({
    api: async () => ({}),
    state: {
      getCurrentUser: () => ({ id: 1 }),
      getCurrentChatId: () => 7,
      getChats: () => chats,
      getChatById: (chatId) => chats.find((chat) => chat.id === Number(chatId)),
    },
    services: {
      chatList: {
        data: {
          applyLocalRead(chatId, lastReadId) {
            const chat = chats.find((item) => item.id === Number(chatId));
            chat.last_read_id = Math.max(chat.last_read_id, Number(lastReadId));
            if (chat.last_read_id >= chat.last_message_id) {
              chat.unread_count = 0;
              chat.first_unread_id = null;
            }
            updates.push(['applyLocalRead', chatId, lastReadId]);
          },
        },
      },
    },
    actions: {
      updateVisibleOwnReadState: (chatId, threshold) => updates.push(['visible', chatId, threshold]),
      isCurrentChatActivelyVisible: () => true,
      isNearBottom: () => true,
      getMaxRenderedMessageId: () => 10,
      renderChatList: () => updates.push(['render']),
    },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(controller.normalizeMemberLastReads({ 1: '4', nope: 2, 2: '6' }))), { 1: 4, 2: 6 });
  controller.storeChatMemberLastReads(7, { 1: 4, 2: 6 }, { replace: true });
  assert.equal(controller.getChatReadReceiptThreshold(7), 6);
  assert.equal(controller.applyOwnReadStateToMessage({ id: 5, user_id: 1 }, 7).is_read, 1);
  assert.equal(controller.applyOwnReadStateToMessage({ id: 7, user_id: 1 }, 7).is_read, 0);

  const readState = await controller.reconcileChatReadState(7, { 1: 10, 2: 9 }, { replace: true, updateVisible: true });
  assert.equal(readState.chatReadChanged, true);
  assert.ok(updates.some((entry) => entry[0] === 'applyLocalRead'));
  assert.ok(updates.some((entry) => entry[0] === 'visible'));
  dom.window.close();
});

test('scroll controller saves and restores anchors and manages date indicator', () => {
  const dom = createAppDom();
  const { window, document } = dom.window;
  const openChat = loadOpenChatRuntime(dom);
  const messagesEl = document.getElementById('messages');
  const chatView = document.getElementById('chatView');
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.dataset.msgId = '10';
  row.__messageData = { id: 10, created_at: '2026-05-31T10:00:00.000Z' };
  messagesEl.appendChild(row);

  Object.defineProperty(messagesEl, 'clientHeight', { configurable: true, value: 100 });
  Object.defineProperty(messagesEl, 'scrollHeight', { configurable: true, value: 300 });
  messagesEl.scrollTop = 195;
  messagesEl.getBoundingClientRect = () => ({ top: 0, bottom: 100, height: 100, width: 300 });
  row.getBoundingClientRect = () => ({ top: 10, bottom: 30, height: 20, width: 260 });
  chatView.getBoundingClientRect = () => ({ top: 0, bottom: 500, height: 500, width: 320 });

  const controller = openChat.scroll.createScrollController({
    window,
    document,
    dom: { messagesEl, chatView, scrollBottomBtn: document.getElementById('scrollBottomBtn') },
    storage: window.localStorage,
    formatDate: () => 'May 31, 2026',
    state: {
      getCurrentUser: () => ({ id: 42 }),
      getCurrentChatId: () => 7,
      getOpenSeq: () => 1,
      getScrollRestoreMode: () => 'restore',
    },
    actions: {
      isCurrentChatActivelyVisible: () => true,
      getHasMoreAfter: () => false,
      hasPendingMediaBottomScroll: () => false,
    },
  });

  assert.equal(controller.scrollAnchorStorageKey(), 'bananza:scrollAnchors:42');
  assert.equal(controller.isNearBottom(8), true);
  assert.equal(controller.saveCurrentScrollAnchor(7, { force: true }), true);
  assert.equal(JSON.parse(window.localStorage.getItem('bananza:scrollAnchors:42'))['7'].messageId, 10);
  assert.equal(controller.restoreScrollAnchor({ messageId: 10, offsetTop: 5 }, 1, { openSeq: 1, chatId: 7 }), true);

  const indicator = controller.ensureScrollDateIndicator();
  controller.updateScrollDateIndicator({ show: true });
  assert.equal(indicator.parentElement, chatView);
  assert.equal(indicator.textContent, 'May 31, 2026');
  controller.hideScrollDateIndicator({ immediate: true });
  assert.equal(indicator.getAttribute('aria-hidden'), 'true');
  dom.window.close();
});

test('media playback controller persists resume and completed state', () => {
  const dom = createAppDom();
  const { window, document } = dom.window;
  const openChat = loadOpenChatRuntime(dom);
  const writes = [];
  const fakeCache = {
    writeChatMeta(chatId, patch) {
      writes.push({ chatId, patch });
      return Promise.resolve(patch);
    },
    readChatMeta() {
      return Promise.resolve({ mediaPlaybackCompleted: { 'attachment-audio:1': 123 } });
    },
  };
  const controller = openChat.mediaPlayback.createMediaPlaybackController({
    dom: { messagesEl: document.getElementById('messages') },
    cache: fakeCache,
    state: { getCurrentChatId: () => 7 },
  });
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.__messageData = { id: 1, chat_id: 7 };
  const audio = document.createElement('audio');
  row.appendChild(audio);
  document.getElementById('messages').appendChild(row);
  Object.defineProperty(audio, 'paused', { configurable: true, value: false });
  Object.defineProperty(audio, 'ended', { configurable: true, value: false });
  Object.defineProperty(audio, 'duration', { configurable: true, value: 20 });
  audio.currentTime = 5;

  controller.bindMediaPlaybackState(audio, row.__messageData, 'attachment-audio');
  audio.dispatchEvent(new window.Event('play'));
  assert.equal(controller.readMediaPlaybackState(row.__messageData, 'attachment-audio').currentTime, 5);

  assert.equal(controller.setMediaPlaybackCompleted(row.__messageData, 'attachment-audio', true), true);
  assert.equal(controller.isMediaPlaybackCompleted(row.__messageData, 'attachment-audio'), true);
  assert.equal(writes.at(-1).chatId, 7);
  assert.ok(writes.at(-1).patch.mediaPlaybackCompleted['attachment-audio:1']);
  dom.window.close();
});

function installFullAppStubs(dom, { fetchHandler = null } = {}) {
  const { window } = dom;
  const currentUser = {
    id: 1,
    username: 'alice',
    display_name: 'Alice',
    avatar_color: '#65aadd',
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
  window.localStorage.setItem('token', 'test-token');
  window.localStorage.setItem('user', JSON.stringify(currentUser));
  window.fetch = async (input, init = {}) => {
    const url = new URL(String(input), window.location.origin);
    if (typeof fetchHandler === 'function') {
      const response = await fetchHandler({ url, init, dom, currentUser });
      if (response) return response;
    }
    if (url.pathname === '/api/auth/me') return createJsonResponse(dom, { user: currentUser });
    if (url.pathname === '/api/user/recent-emojis') return createJsonResponse(dom, { emojis: [] });
    if (url.pathname === '/api/weather/settings') return createJsonResponse(dom, { settings: { enabled: false, location: null, refresh_minutes: 30 } });
    if (url.pathname === '/api/sound-settings') {
      return createJsonResponse(dom, { settings: { sounds_enabled: true, volume: 100, play_send: true, play_incoming: true, play_notifications: true, play_reactions: true, play_pins: true, play_invites: true, play_voice: true, play_mentions: true } });
    }
    if (url.pathname === '/api/notification-settings') {
      return createJsonResponse(dom, { settings: { push_enabled: false, notify_messages: true, notify_chat_invites: true, notify_reactions: true, notify_pins: true, notify_mentions: true } });
    }
    if (url.pathname === '/api/users') return createJsonResponse(dom, []);
    if (url.pathname === '/api/chat-folders') return createJsonResponse(dom, { folders: [] });
    if (url.pathname.match(/^\/api\/chats\/\d+\/pins$/)) return createJsonResponse(dom, { pins: [], events: [] });
    if (url.pathname.match(/^\/api\/chats\/\d+\/read$/)) return createJsonResponse(dom, {});
    if (url.pathname.match(/^\/api\/chats\/\d+\/context-convert/)) return createJsonResponse(dom, { enabled: false, bots: [] });
    if (url.pathname.match(/^\/api\/chats\/\d+\/chatshot/)) return createJsonResponse(dom, { enabled: false, ready: false });
    throw new Error(`Unexpected app-open-chat fetch: ${url.pathname}`);
  };
}

async function bootFullApp(options = {}) {
  const dom = createAppDom();
  installFullAppStubs(dom, options);
  installVisualViewportMock(dom.window, { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 });
  const ready = new Promise((resolve) => dom.window.addEventListener('bananza:ready', resolve, { once: true }));
  loadBrowserScript(dom, 'public/js/ai-image-risk.js');
  loadBrowserScript(dom, 'public/js/qip-infium-original.js');
  loadBrowserScript(dom, 'public/js/qip-hd.js');
  loadAppScript(dom);
  await ready;
  await wait(dom.window);
  return dom;
}

test('full app bridge opens chats through extracted controller and keeps media bridge methods', async (t) => {
  const messagesByChat = new Map([
    [1, [{ id: 1, chat_id: 1, user_id: 2, display_name: 'Bob', text: 'One', created_at: '2026-05-31T10:00:00.000Z' }]],
    [2, [{ id: 2, chat_id: 2, user_id: 1, display_name: 'Alice', text: 'Two', created_at: '2026-05-31T10:01:00.000Z', is_read: 0 }]],
  ]);
  const dom = await bootFullApp({
    fetchHandler: ({ url, dom: testDom }) => {
      if (url.pathname === '/api/chats') {
        return createJsonResponse(testDom, [
          { id: 1, type: 'group', name: 'One', last_message_id: 1, unread_count: 0 },
          { id: 2, type: 'group', name: 'Two', last_message_id: 2, unread_count: 0 },
        ]);
      }
      const match = url.pathname.match(/^\/api\/chats\/(\d+)\/messages$/);
      if (match) {
        const chatId = Number(match[1]);
        return createJsonResponse(testDom, {
          messages: messagesByChat.get(chatId) || [],
          has_more_before: false,
          has_more_after: false,
          member_last_reads: { 1: chatId, 2: chatId },
        });
      }
      return null;
    },
  });
  t.after(() => dom.window.close());

  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([
    { id: 1, type: 'group', name: 'One', last_message_id: 1, unread_count: 0 },
    { id: 2, type: 'group', name: 'Two', last_message_id: 2, unread_count: 0 },
  ]);

  await BananzaAppBridge.__testing.openChat(1);
  assert.equal(BananzaAppBridge.getCurrentChatId(), 1);
  assert.equal(document.querySelectorAll('#messages .msg-row[data-msg-id]').length, 1);
  assert.equal(document.querySelector('#messages .msg-row[data-msg-id="1"]').__messageData.text, 'One');

  await BananzaAppBridge.__testing.openChat(2);
  assert.equal(BananzaAppBridge.getCurrentChat().id, 2);
  assert.equal(document.querySelector('#messages .msg-row[data-msg-id="2"]').__messageData.text, 'Two');

  const audio = document.createElement('audio');
  const message = { id: 99, chat_id: 2 };
  BananzaAppBridge.bindMediaPlayback(audio, message, 'attachment-audio');
  assert.equal(BananzaAppBridge.setMediaPlaybackCompleted(message, 'attachment-audio', true), true);
  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(message, 'attachment-audio'), true);
  assert.equal(typeof BananzaAppBridge.__testing.openChatControllers().controller.openChat, 'function');
});

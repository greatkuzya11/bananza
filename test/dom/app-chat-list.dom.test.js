const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installVisualViewportMock,
  loadAppRuntimeScripts,
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

function loadChatListRuntime(dom) {
  loadAppRuntimeScripts(dom);
  return dom.window.BananzaApp.chatList;
}

function createFolderStore(dom, folders = []) {
  const store = dom.window.BananzaApp.folders.store.createChatFolderStore({
    getCurrentUser: () => ({ id: 42 }),
    storage: dom.window.localStorage,
    config: dom.window.BananzaApp.config,
  });
  store.setFolders(folders, { persist: false });
  return store;
}

test('chat list modules publish store, renderer, data, presence, and recovery factories', () => {
  const dom = createAppDom();
  const chatList = loadChatListRuntime(dom);

  assert.equal(typeof chatList.store.createChatListStore, 'function');
  assert.equal(typeof chatList.render.createChatListRenderer, 'function');
  assert.equal(typeof chatList.data.createChatListDataController, 'function');
  assert.equal(typeof chatList.presence.createPresenceController, 'function');
  assert.equal(typeof chatList.recovery.createChatListRecovery, 'function');
  dom.window.close();
});

test('chat list store normalizes, patches, removes, and tracks online users', () => {
  const dom = createAppDom();
  const chatList = loadChatListRuntime(dom);
  const store = chatList.store.createChatListStore({
    compareChatsForList: chatList.store.compareChatsForList,
  });

  store.setChats([
    { id: '1', name: 'Regular', last_time: '2026-01-01T10:00:00.000Z', notify_enabled: 0 },
    { id: '2', name: 'Pinned', chat_list_pin_order: '1', sounds_enabled: 0 },
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(store.getChats().map((chat) => chat.id))), [2, 1]);
  assert.equal(store.getChatById(1).notify_enabled, false);
  assert.equal(store.getChatById(2).is_pinned, true);
  assert.equal(store.getChatById(2).sounds_enabled, false);

  store.patchChat(1, { unread_count: 3, last_text: 'Hello' });
  assert.equal(store.getChatById(1).unread_count, 3);
  assert.equal(store.getChatById(1).last_text, 'Hello');

  assert.equal(store.removeChat(2), true);
  assert.deepEqual(JSON.parse(JSON.stringify(store.getChats().map((chat) => chat.id))), [1]);

  store.setOnlineUsers(['5', 0, 'bad', 6]);
  assert.deepEqual(JSON.parse(JSON.stringify(Array.from(store.getOnlineUsers()).sort((a, b) => a - b))), [5, 6]);
  dom.window.close();
});

test('chat list renderer preserves sidebar DOM behavior and folder integration', () => {
  const dom = createAppDom();
  const { window } = dom;
  const chatList = loadChatListRuntime(dom);
  const folderStore = createFolderStore(dom, [{
    id: 9,
    name: 'Ops',
    chat_ids: [1, 2],
    pins: [{ chat_id: 1, pin_order: 1 }],
  }]);
  folderStore.setActiveFolderId(9, { persist: false });
  const store = chatList.store.createChatListStore({
    compareChatsForList: chatList.store.compareChatsForList,
  });
  store.setChats([
    {
      id: 1,
      type: 'private',
      name: 'Bob',
      unread_count: 7,
      last_text: 'Ping',
      last_time: '2026-01-01T10:00:00.000Z',
      private_user: { id: 10, display_name: 'Bob', username: 'bob', is_ai_bot: 0, avatar_color: '#65aadd' },
    },
    { id: 2, type: 'group', name: 'Ops room', last_text: 'Ship', last_time: '2026-01-01T09:00:00.000Z' },
    { id: 3, type: 'group', name: 'Outside', last_text: 'Nope', last_time: '2026-01-01T11:00:00.000Z' },
  ]);
  store.setOnlineUsers([10]);

  let openedChatId = 0;
  const renderer = chatList.render.createChatListRenderer({
    document: window.document,
    window,
    dom: window.BananzaApp.dom.createDomRefs(),
    store,
    folders: { store: folderStore },
    config: window.BananzaApp.config,
    formatters: window.BananzaApp.formatters,
    actions: {
      getCurrentChatId: () => 0,
      isChatPinned: (chat) => Boolean(chat.is_pinned),
      isChatPinnedInFolder: (folderId, chat) => folderStore.isChatPinnedInFolder(folderId, chat),
      compareChatsForFolder: (folderId, a, b) => folderStore.compareChatsForFolder(folderId, a, b),
      openChat: (chatId) => { openedChatId = chatId; },
    },
  });

  renderer.renderChatList();
  const renderedIds = [...window.document.querySelectorAll('#chatList .chat-item[data-chat-id]')]
    .map((node) => Number(node.dataset.chatId));
  assert.deepEqual(renderedIds, [1, 2]);
  assert.ok(window.document.querySelector('#chatList .chat-list-group--pinned .chat-item[data-chat-id="1"]'));
  assert.ok(window.document.querySelector('#chatList .chat-item[data-chat-id="1"] .online-dot'));
  assert.equal(window.document.querySelector('#chatList .chat-item[data-chat-id="1"] .unread-badge').textContent, '7');

  window.document.querySelector('#chatList .chat-item[data-chat-id="1"]').click();
  assert.equal(openedChatId, 1);
  dom.window.close();
});

test('hidden chat search renders sidebar extras and delegates opening through callbacks', async () => {
  const dom = createAppDom();
  const { window } = dom;
  const chatList = loadChatListRuntime(dom);
  const folderStore = createFolderStore(dom);
  const store = chatList.store.createChatListStore();
  store.setChats([{ id: 1, type: 'group', name: 'Visible', last_text: 'Hi' }]);
  store.setAllUsers([{ id: 8, display_name: 'Sec Bot', username: 'sbot', is_ai_bot: 1, avatar_color: '#65aadd' }]);
  store.setHiddenChatSearch('sec', [{
    id: 5,
    type: 'private',
    name: 'Secret',
    private_user: { id: 55, display_name: 'Secret', username: 'secret', is_ai_bot: 0, avatar_color: '#65aadd' },
  }]);

  let hiddenOpened = 0;
  let scheduledQuery = '';
  const renderer = chatList.render.createChatListRenderer({
    document: window.document,
    window,
    dom: window.BananzaApp.dom.createDomRefs(),
    store,
    folders: { store: folderStore },
    config: window.BananzaApp.config,
    formatters: window.BananzaApp.formatters,
    actions: {
      getCurrentChatId: () => 0,
      scheduleHiddenChatSearch: (query) => { scheduledQuery = query; },
      openHiddenChatFromSearch: (chatId) => { hiddenOpened = chatId; },
      openPrivateChatFromDirectory: async () => {},
    },
  });

  renderer.renderChatList('sec');
  assert.equal(scheduledQuery, 'sec');
  assert.ok(window.document.querySelector('#chatList .chat-item.is-hidden-search-result[data-chat-id="5"]'));
  assert.ok(window.document.querySelector('#chatList .chat-item:not(.is-hidden-search-result) .chat-item-name')?.textContent.includes('Sec Bot'));
  window.document.querySelector('#chatList .chat-item.is-hidden-search-result[data-chat-id="5"]').click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  assert.equal(hiddenOpened, 5);
  dom.window.close();
});

test('chat list data controller loads chats, aborts slow requests, loads users, and opens hidden chats by callback', async () => {
  const dom = createAppDom();
  const { window } = dom;
  const chatList = loadChatListRuntime(dom);
  const store = chatList.store.createChatListStore();
  const calls = [];
  let renderCount = 0;
  let openedChatId = 0;
  let searchClosed = false;
  const api = async (url, init = {}) => {
    calls.push({ url, init });
    if (url === '/api/chats') return [{ id: 1, type: 'group', name: 'Loaded', last_text: 'Yo' }];
    if (url === '/api/users') return [{ id: 2, display_name: 'Alice' }];
    if (url === '/api/chats/5/unhide') return {};
    throw new Error(`Unexpected api call ${url}`);
  };
  const controller = chatList.data.createChatListDataController({
    document: window.document,
    dom: window.BananzaApp.dom.createDomRefs(),
    api,
    store,
    renderer: { renderChatList: () => { renderCount += 1; } },
    folders: { store: createFolderStore(dom) },
    cache: { storage: window.localStorage },
    config: { ...window.BananzaApp.config, CHAT_LIST_REQUEST_TIMEOUT_MS: 50 },
    actions: {
      loadChatFolders: async () => [],
      openChat: async (chatId) => { openedChatId = chatId; },
      setChatSearchOpen: () => { searchClosed = true; },
    },
  });

  await controller.loadChats();
  assert.equal(calls[0].url, '/api/chats');
  assert.equal(store.getChatById(1).name, 'Loaded');
  assert.ok(renderCount > 0);

  await controller.loadAllUsers();
  assert.equal(store.getAllUsers()[0].display_name, 'Alice');

  await controller.openHiddenChatFromSearch(5);
  assert.equal(openedChatId, 5);
  assert.equal(searchClosed, true);

  const slowStore = chatList.store.createChatListStore();
  const slowController = chatList.data.createChatListDataController({
    document: window.document,
    dom: window.BananzaApp.dom.createDomRefs(),
    api: (url, init = {}) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new window.DOMException('Aborted', 'AbortError')));
    }),
    store: slowStore,
    renderer: { renderChatList() {} },
    folders: { store: createFolderStore(dom) },
    cache: { storage: window.localStorage },
    config: { ...window.BananzaApp.config, CHAT_LIST_REQUEST_TIMEOUT_MS: 1 },
  });
  await slowController.loadChats();
  assert.deepEqual(JSON.parse(JSON.stringify(slowStore.getChats())), []);
  dom.window.close();
});

test('presence controller updates online state, private chat display, and delegates message refresh', () => {
  const dom = createAppDom();
  const { window } = dom;
  const chatList = loadChatListRuntime(dom);
  const store = chatList.store.createChatListStore();
  store.setChats([{
    id: 1,
    type: 'private',
    name: 'Bob',
    private_user: { id: 10, display_name: 'Bob', username: 'bob', avatar_color: '#65aadd' },
  }]);
  let renderCount = 0;
  let refreshedUserId = 0;
  const presence = chatList.presence.createPresenceController({
    document: window.document,
    store,
    renderer: { renderChatList: () => { renderCount += 1; } },
    formatters: window.BananzaApp.formatters,
    state: {
      getCurrentUser: () => ({ id: 1 }),
      getCurrentChatId: () => 0,
      getChatSearchValue: () => '',
    },
    actions: {
      refreshRenderedUserMessages: (user) => { refreshedUserId = user.id; },
    },
  });

  presence.setOnlineUsers([10]);
  assert.equal(store.getOnlineUsers().has(10), true);
  assert.ok(renderCount > 0);

  presence.applyUserUpdate({ id: 10, display_name: 'Bobby', username: 'bobby', avatar_url: '/a.png' });
  assert.equal(store.getChatById(1).name, 'Bobby');
  assert.equal(store.getChatById(1).private_user.username, 'bobby');
  assert.equal(refreshedUserId, 10);
  dom.window.close();
});

function installAppRuntimeStubs(dom, { fetchHandler = null } = {}) {
  const { window } = dom;
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
      const response = await fetchHandler({ url, init, dom, currentUser });
      if (response) return response;
    }
    switch (url.pathname) {
      case '/api/auth/me':
        return createJsonResponse(dom, { user: currentUser });
      case '/api/user/recent-emojis':
        return createJsonResponse(dom, { emojis: [] });
      case '/api/weather/settings':
        return createJsonResponse(dom, { settings: { enabled: false, location: null, refresh_minutes: 30 } });
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
      case '/api/chat-folders':
        return createJsonResponse(dom, { folders: [] });
      default:
        throw new Error(`Unexpected fetch in chat-list DOM test: ${url.pathname}`);
    }
  };
}

async function bootAppDom(options = {}) {
  const dom = createAppDom();
  installAppRuntimeStubs(dom, options);
  installVisualViewportMock(dom.window, { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 });
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

test('app integration keeps chat list bridge helpers and websocket updates wired', async (t) => {
  let chatFetchCount = 0;
  const dom = await bootAppDom({
    fetchHandler: ({ url, dom: testDom }) => {
      if (url.pathname === '/api/chats') {
        chatFetchCount += 1;
        return createJsonResponse(testDom, [{
          id: 1,
          type: 'private',
          name: 'Bob',
          private_user: { id: 10, display_name: 'Bob', username: 'bob', avatar_color: '#65aadd' },
          last_text: 'Hi',
        }]);
      }
      return null;
    },
  });
  t.after(() => dom.window.close());
  const { BananzaAppBridge } = dom.window;

  const chats = BananzaAppBridge.__testing.setChats([{ id: '2', type: 'group', name: 'Manual', notify_enabled: 0 }]);
  assert.equal(chats[0].id, 2);
  assert.equal(BananzaAppBridge.__testing.getChats()[0].notify_enabled, false);

  await BananzaAppBridge.__testing.handleWSMessage({ type: 'online', userIds: [10] });
  assert.deepEqual(JSON.parse(JSON.stringify(BananzaAppBridge.__testing.getOnlineUsers())), [10]);

  const before = chatFetchCount;
  await BananzaAppBridge.__testing.handleWSMessage({ type: 'chat_list_updated' });
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  assert.ok(chatFetchCount > before);
});

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

function loadFolderRuntime(dom) {
  loadAppRuntimeScripts(dom);
  return dom.window.BananzaApp.folders;
}

function makeStore(dom, options = {}) {
  const folders = dom.window.BananzaApp.folders;
  return folders.store.createChatFolderStore({
    getCurrentUser: () => ({ id: 42 }),
    storage: dom.window.localStorage,
    config: dom.window.BananzaApp.config,
    compareChatActivity: (a, b) => String(b.last_time || '').localeCompare(String(a.last_time || '')),
    ...options,
  });
}

test('folder modules publish store, ui, actions, manage modal, and new folder tab factories', () => {
  const dom = createAppDom();
  loadFolderRuntime(dom);
  const { folders } = dom.window.BananzaApp;

  assert.equal(typeof folders.store.createChatFolderStore, 'function');
  assert.equal(typeof folders.ui.createChatFolderUi, 'function');
  assert.equal(typeof folders.actions.createChatFolderActions, 'function');
  assert.equal(typeof folders.manageModal.createChatFolderManageModal, 'function');
  assert.equal(typeof folders.newFolderTab.createNewFolderTab, 'function');
  dom.window.close();
});

test('folder store normalizes folders, persists active ids, resets missing ids, and sorts pins', () => {
  const dom = createAppDom();
  loadFolderRuntime(dom);
  const store = makeStore(dom);

  store.setFolders([
    {
      id: '9',
      name: '  Launch  ',
      kind: 'custom',
      sort_order: 2,
      chat_ids: [2, '2', 0, 3],
      pins: [
        { chat_id: 3, pin_order: 2 },
        { chat_id: 2, pin_order: 1 },
      ],
    },
    { id: 8, name: 'Bots', kind: 'bot_auto', sort_order: 1, chat_ids: [4] },
  ], { persist: false });

  assert.deepEqual(store.getFolders().map((folder) => folder.id), [8, 9]);
  const launch = store.getFolderById(9);
  assert.equal(launch.name, 'Launch');
  assert.deepEqual(Array.from(launch.chat_ids), [2, 3]);
  assert.deepEqual(JSON.parse(JSON.stringify(launch.pins)), [{ chat_id: 2, pin_order: 1 }, { chat_id: 3, pin_order: 2 }]);

  store.setActiveFolderId(9, { persist: true });
  assert.equal(dom.window.localStorage.getItem('bananza:active-chat-folder:42'), '9');
  assert.equal(store.getActiveChatFolder().id, 9);

  store.setFolders([{ id: 10, name: 'Ops', chat_ids: [5], pins: [] }], { persist: true });
  assert.equal(store.activeFolderId, 0);
  assert.equal(dom.window.localStorage.getItem('bananza:active-chat-folder:42'), '0');

  store.setFolders([{ id: 11, name: 'Pinned', chat_ids: [1, 2], pins: [{ chat_id: 2, pin_order: 1 }] }], { persist: false });
  const sorted = [
    { id: 1, last_time: '2026-01-02T00:00:00.000Z' },
    { id: 2, last_time: '2026-01-01T00:00:00.000Z' },
  ].sort((a, b) => store.compareChatsForFolder(11, a, b));
  assert.deepEqual(sorted.map((chat) => chat.id), [2, 1]);
  assert.equal(
    store.folderSummaryText(store.getFolderById(11), [{ id: 1, unread_count: 1 }, { id: 2, unread_count: 2 }]),
    '2 \u0447\u0430\u0442\u043E\u0432 \u2022 3 \u043D\u0435\u043F\u0440\u043E\u0447\u0438\u0442.'
  );
  dom.window.close();
});

test('folder ui renders the active strip, picker, and context menu without owning chats', async () => {
  const dom = createAppDom();
  loadFolderRuntime(dom);
  const { window } = dom;
  const store = makeStore(dom);
  let currentUser = { id: 42, ui_show_chat_folder_strip_in_all_chats: true };
  const chats = [
    { id: 1, type: 'group', name: 'Launch chat', unread_count: 2, last_text: 'Go' },
    { id: 2, type: 'group', name: 'Bot chat', unread_count: 0, last_text: 'Auto' },
  ];
  store.setFolders([
    { id: 9, name: 'Launch', kind: 'custom', sort_order: 1, chat_ids: [1], pins: [] },
    { id: 10, name: 'Bots', kind: 'bot_auto', sort_order: 2, chat_ids: [2], pins: [] },
  ], { persist: false });
  store.setActiveFolderId(9, { persist: false });

  const ui = window.BananzaApp.folders.ui.createChatFolderUi({
    document: window.document,
    window,
    dom: window.BananzaApp.dom.createDomRefs(),
    store,
    config: window.BananzaApp.config,
    formatters: window.BananzaApp.formatters,
    state: {
      getCurrentUser: () => currentUser,
      setCurrentUser: (next) => { currentUser = next; },
      getChats: () => chats,
      getOnlineUsers: () => new Set(),
      getCurrentModalAnimation: () => 'soft',
    },
    actions: {
      chatItemAvatarHtml: () => '<div class="chat-item-avatar">',
      renderChatLastPreviewHtml: (chat) => chat.last_text || '',
    },
  });

  assert.equal(ui.renderActiveChatFolderBar(), true);
  assert.equal(window.document.getElementById('activeChatFolderBar').classList.contains('hidden'), false);
  assert.deepEqual(
    [...window.document.querySelectorAll('#activeChatFolderStrip [data-folder-chip]')].map((node) => node.dataset.folderChip),
    ['0', '9', '10']
  );

  ui.showChatFolderPicker(window.document.getElementById('chatFoldersBtn'));
  const picker = window.document.getElementById('chatFolderPicker');
  assert.equal(picker.classList.contains('hidden'), false);
  assert.equal(picker.getAttribute('role'), 'menu');
  assert.equal(picker.querySelector('[data-folder-select="0"]')?.getAttribute('type'), 'button');
  assert.equal(picker.querySelector('[data-chat-folder-strip-toggle]')?.getAttribute('aria-pressed'), 'true');

  const menuAnchor = picker.querySelector('[data-folder-menu="9"]');
  ui.showChatFolderContextMenu(9, menuAnchor);
  const menu = window.document.getElementById('chatFolderContextMenu');
  assert.equal(menu.classList.contains('hidden'), false);
  assert.equal(menu.getAttribute('role'), 'menu');
  assert.deepEqual(
    [...menu.querySelectorAll('[data-folder-action]')].map((node) => node.dataset.folderAction),
    ['move-up-folder', 'move-down-folder', 'rename-folder', 'delete-folder']
  );

  await ui.hideChatFolderPicker({ immediate: true });
  assert.equal(picker.getAttribute('aria-hidden'), 'true');
  dom.window.close();
});

test('folder actions call expected endpoints and render after changes', async () => {
  const dom = createAppDom();
  loadFolderRuntime(dom);
  const { window } = dom;
  window.confirm = () => true;
  const store = makeStore(dom);
  const calls = [];
  let renderCount = 0;
  let transitionFolderId = 0;
  const ui = {
    renderActiveChatFolderBar() {},
    renderChatFolderPicker() {},
    refreshChatFolderContextMenu() {},
  };
  const api = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body || null });
    if (url === '/api/chat-folders' && !init.method) {
      return { folders: [{ id: 9, name: 'Launch', kind: 'custom', sort_order: 1, chat_ids: [1], pins: [] }] };
    }
    if (url === '/api/chat-folders' && init.method === 'POST') return { folder: { id: 9, name: init.body.name } };
    if (url === '/api/chat-folders/9' && init.method === 'PUT') return { folder: { id: 9, name: init.body.name } };
    return {};
  };
  const actions = window.BananzaApp.folders.actions.createChatFolderActions({
    window,
    api,
    store,
    ui,
    state: { getChatSearchValue: () => 'launch' },
    actions: {
      renderChatList: () => { renderCount += 1; },
      transitionToChatFolder: (folderId) => { transitionFolderId = folderId; },
      showCenterToast() {},
    },
  });

  await actions.loadChatFolders();
  await actions.createChatFolder('Launch', [1]);
  await actions.renameChatFolder(9, 'Renamed');
  await actions.deleteChatFolder(9);
  await actions.setChatFolderOrder([9]);
  await actions.addChatsToFolder(9, [1, 2]);
  await actions.removeChatFromFolder(9, 1);
  await actions.setFolderChatPin(9, 1, true);
  await actions.moveFolderChatPin(9, 1, 'down');

  assert.equal(calls[0].url, '/api/chat-folders');
  assert.ok(calls.some((call) => call.url === '/api/chat-folders' && call.method === 'POST'));
  assert.ok(calls.some((call) => call.url === '/api/chat-folders/9' && call.method === 'PUT'));
  assert.ok(calls.some((call) => call.url === '/api/chat-folders/9' && call.method === 'DELETE'));
  assert.ok(calls.some((call) => call.url === '/api/chat-folders/order' && call.method === 'PUT'));
  assert.ok(calls.some((call) => call.url === '/api/chat-folders/9/chats' && call.method === 'POST'));
  assert.ok(calls.some((call) => call.url === '/api/chat-folders/9/chats/1' && call.method === 'DELETE'));
  assert.ok(calls.some((call) => call.url === '/api/chat-folders/9/chats/1/pin' && call.method === 'PUT'));
  assert.ok(calls.some((call) => call.url === '/api/chat-folders/9/chats/1/pin/move' && call.method === 'POST'));
  assert.equal(transitionFolderId, 9);
  assert.ok(renderCount > 0);
  dom.window.close();
});

test('folder manage modal opens through modal manager, renders chats, and saves add/remove actions', async () => {
  const dom = createAppDom();
  loadFolderRuntime(dom);
  const { window } = dom;
  const store = makeStore(dom);
  store.setFolders([
    { id: 9, name: 'Launch', kind: 'custom', sort_order: 1, chat_ids: [1], pins: [] },
    { id: 10, name: 'Ops', kind: 'custom', sort_order: 2, chat_ids: [], pins: [] },
  ], { persist: false });
  const chats = [{ id: 1, name: 'Alpha' }];
  const opened = [];
  const writes = [];
  const ui = {
    chatFolderIconMarkup: () => '<span></span>',
    chatFolderEmojiMarkup: () => '<span></span>',
  };
  const manage = window.BananzaApp.folders.manageModal.createChatFolderManageModal({
    document: window.document,
    dom: window.BananzaApp.dom.createDomRefs(),
    store,
    ui,
    modals: { open: (id) => opened.push(id) },
    formatters: window.BananzaApp.formatters,
    getChats: () => chats,
    getChatById: (chatId) => chats.find((chat) => chat.id === Number(chatId)),
    actions: {
      loadChatFolders: async () => [],
      addChatsToFolder: async (folderId, chatIds) => writes.push(['add', folderId, chatIds]),
      removeChatFromFolder: async (folderId, chatId) => writes.push(['remove', folderId, chatId]),
    },
  });

  await manage.openChatFolderManageModal(1);
  assert.deepEqual(opened, ['chatFolderManageModal']);
  assert.match(window.document.getElementById('chatFolderManageTitle').textContent, /Alpha/);
  assert.equal(window.document.querySelectorAll('#chatFolderManageCustomList .user-list-item').length, 2);
  window.document.querySelector('[data-folder-id="9"]').classList.remove('selected');
  window.document.querySelector('[data-folder-id="10"]').classList.add('selected');
  await manage.saveChatFolderManageChanges();
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [['add', 10, [1]], ['remove', 9, 1]]);
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
        throw new Error(`Unexpected fetch in folders DOM test: ${url.pathname}`);
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

test('app integration keeps bridge folder helpers wired to the extracted controllers', async (t) => {
  const initialChats = [
    {
      id: 1,
      type: 'group',
      name: 'All chat',
      unread_count: 0,
      last_text: 'All',
      last_time: '2026-05-01T10:00:00.000Z',
      created_at: '2026-05-01T10:00:00.000Z',
    },
    {
      id: 2,
      type: 'group',
      name: 'Folder chat',
      unread_count: 1,
      last_text: 'Folder',
      last_time: '2026-05-01T11:00:00.000Z',
      created_at: '2026-05-01T11:00:00.000Z',
    },
  ];
  const dom = await bootAppDom({
    fetchHandler: ({ url, dom: testDom }) => {
      if (url.pathname === '/api/chats') return createJsonResponse(testDom, initialChats);
      return null;
    },
  });
  t.after(() => dom.window.close());
  const { document, BananzaAppBridge } = dom.window;

  BananzaAppBridge.__testing.setChats(initialChats);
  const folders = BananzaAppBridge.__testing.setChatFolders([{
    id: 9,
    name: 'Launch',
    kind: 'custom',
    sort_order: 1,
    chat_ids: [2],
    pins: [{ chat_id: 2, pin_order: 1 }],
  }], { activeFolderId: 9 });

  assert.equal(folders[0].id, 9);
  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder().id, 9);
  assert.equal(document.querySelector('#activeChatFolderStrip [data-folder-chip="9"]').classList.contains('is-active'), true);
  assert.deepEqual(
    [...document.querySelectorAll('#chatList .chat-item[data-chat-id]')].map((node) => Number(node.dataset.chatId)),
    [2]
  );

  await BananzaAppBridge.__testing.transitionToChatFolder(0, { persist: false });
  assert.equal(BananzaAppBridge.__testing.getActiveChatFolder(), null);
  assert.equal(BananzaAppBridge.__testing.getChats().length, 2);
  assert.deepEqual(
    [...document.querySelectorAll('#chatList .chat-item[data-chat-id]')].map((node) => Number(node.dataset.chatId)),
    [2, 1]
  );
});

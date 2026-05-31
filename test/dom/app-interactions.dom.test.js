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

function createRow(dom, {
  id = 101,
  chatId = 1,
  userId = 2,
  text = 'Hello search target',
  media = null,
} = {}) {
  const { document } = dom.window;
  const row = document.createElement('div');
  row.className = 'msg-row other';
  row.dataset.msgId = String(id);
  row.__messageData = {
    id,
    chat_id: chatId,
    user_id: userId,
    display_name: 'Bob',
    text,
    created_at: '2026-05-31T10:00:00.000Z',
    reactions: [],
    is_deleted: false,
  };
  row.__replyPayload = { id, display_name: 'Bob', text };
  row.innerHTML = `
    <div class="msg-content">
      <div class="msg-bubble">
        <div class="msg-text">${text}</div>
        <div class="msg-footer"><div></div></div>
        <div class="msg-actions">
          <button type="button" class="msg-reply-btn" data-msg-action="reply">R</button>
          <button type="button" class="msg-react-btn" data-msg-action="react">+</button>
        </div>
      </div>
    </div>
  `;
  if (media === 'image') {
    row.__messageData.file_type = 'image';
    row.__messageData.file_name = 'photo.png';
    row.__messageData.file_mime = 'image/png';
    row.__messageData.file_stored = 'photo.png';
    row.querySelector('.msg-bubble').insertAdjacentHTML(
      'beforeend',
      '<img class="msg-image" src="/uploads/photo.png/preview" alt="photo">'
    );
  } else if (media === 'video') {
    row.__messageData.file_type = 'video';
    row.__messageData.file_name = 'clip.mp4';
    row.__messageData.file_mime = 'video/mp4';
    row.__messageData.file_stored = 'clip.mp4';
    row.querySelector('.msg-bubble').insertAdjacentHTML(
      'beforeend',
      '<div class="msg-video"><video src="/uploads/clip.mp4/preview"></video></div>'
    );
  } else if (media === 'file') {
    row.__messageData.file_type = 'document';
    row.__messageData.file_name = 'note.txt';
    row.__messageData.file_mime = 'text/plain';
    row.__messageData.file_stored = 'note.txt';
    row.querySelector('.msg-bubble').insertAdjacentHTML(
      'beforeend',
      '<a class="msg-file" href="/uploads/note.txt">note.txt</a>'
    );
  }
  document.getElementById('messages').appendChild(row);
  return row;
}

function createControllers(dom, overrides = {}) {
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const { document } = window;
  window.HTMLMediaElement.prototype.pause = function pause() {};
  window.HTMLMediaElement.prototype.play = function play() { return Promise.resolve(); };
  const mediaPages = new Map();
  window.messageCache = {
    patchMessage() { return Promise.resolve(); },
    readMediaPage(chatId, direction, cursor) {
      return Promise.resolve(mediaPages.get(`${chatId}:${direction}:${cursor}`) || null);
    },
    writeMediaPage(chatId, page) {
      mediaPages.set(`${chatId}:${page.direction}:${page.cursor}`, { ...page, complete: true });
      return Promise.resolve();
    },
  };
  const domRefs = window.BananzaApp.dom.createDomRefs();
  domRefs.$ = (selector, root = document) => root?.querySelector?.(selector) || null;
  domRefs.$$ = (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);
  Object.assign(domRefs, {
    searchPanel: document.getElementById('searchPanel'),
    searchPanelSheet: document.getElementById('searchPanelSheet'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    searchAllChatsToggle: document.getElementById('searchAllChatsToggle'),
    searchBtn: document.getElementById('searchBtn'),
    chatInfoBtn: document.getElementById('chatInfoBtn'),
    messagesEl: document.getElementById('messages'),
    chatList: document.getElementById('chatList'),
    reactionPicker: document.getElementById('reactionPicker'),
    reactionEmojiPopover: document.getElementById('reactionEmojiPopover'),
    imageViewer: document.getElementById('imageViewer'),
    ivStrip: document.getElementById('ivStrip'),
    chatContextMenuBackdrop: document.getElementById('chatContextMenuBackdrop'),
    chatContextMenu: document.getElementById('chatContextMenu'),
    mediaContextMenuBackdrop: document.getElementById('mediaContextMenuBackdrop'),
    mediaContextMenu: document.getElementById('mediaContextMenu'),
    forwardMessageModal: document.getElementById('forwardMessageModal'),
    forwardChatSearch: document.getElementById('forwardChatSearch'),
    forwardChatList: document.getElementById('forwardChatList'),
    forwardMessageStatus: document.getElementById('forwardMessageStatus'),
  });

  const calls = [];
  const chats = overrides.chats || [
    { id: 1, type: 'group', name: 'General', last_time: '2026-05-31T10:00:00.000Z', last_message: 'Hello' },
    { id: 2, type: 'private', name: 'Notes target', last_time: '2026-05-31T11:00:00.000Z', last_message: 'Saved' },
  ];
  const api = overrides.api || (async (url, opts = {}) => {
    calls.push({ url, opts });
    if (String(url).startsWith('/api/messages/search')) {
      return [{ id: 101, chat_id: 1, display_name: 'Bob', text: 'Hello search target', chat_name: 'General', created_at: '2026-05-31T10:00:00.000Z' }];
    }
    if (String(url).endsWith('/reactions')) return { reactions: [{ emoji: '\uD83D\uDC4D', user_id: 1 }] };
    if (String(url).endsWith('/forward')) return { ok: true };
    if (String(url).endsWith('/save-to-notes')) return { chat_id: 2, id: 999, text: 'Saved' };
    if (String(url).includes('/media?')) return { media: [], has_more_before: false, has_more_after: false };
    return {};
  });
  const state = {
    getCurrentUser: () => ({ id: 1, display_name: 'Alice', is_admin: 1 }),
    getCurrentChatId: () => overrides.currentChatId ?? 1,
    getCurrentModalAnimation: () => 'none',
    getChats: () => chats,
    getOnlineUsers: () => new Set([2]),
    contextConvertPendingMessageIds: new Set(),
    contextOriginalRestorePendingMessageIds: new Set(),
  };
  const openedChats = [];
  const toasts = [];
  const baseActions = {
    showCenterToast: (message) => toasts.push(message),
    openChat: async (chatId, options = {}) => {
      openedChats.push({ chatId, options });
      return true;
    },
    closeMobileComposerTransientUi() {},
    dismissMobileComposer() {},
    getMobileComposerSafeReturnFocusEl: (fallback) => fallback,
    forceIosAnimationMount() {},
    getElementTransitionTotalMs: () => 0,
    focusElementIfPossible: (el) => {
      try { el?.focus?.({ preventScroll: true }); } catch {}
      return true;
    },
    blurFocusedElementWithin() {},
    prefersReducedMotion: () => true,
    isMobileLayoutViewport: () => false,
    revealSidebarFromChat() {},
    normalizeMobileChatListHistoryState() {},
    isResolvedMobileChatScene: () => false,
    waitForAnimationFrames: () => Promise.resolve(),
  };
  const floating = window.BananzaApp.interactions.floatingActions.createFloatingMessageActions({
    window,
    document,
    dom: domRefs,
    state,
    config: window.BananzaApp.config,
    getReactions: () => reactions,
    actions: {
      forceIosAnimationMount() {},
      getElementTransitionTotalMs: () => 0,
      prefersReducedMotion: () => true,
      isMobileComposerKeyboardOpen: () => false,
      focusComposerKeepKeyboard() {},
    },
  });
  const forwarding = window.BananzaApp.interactions.forwarding.createForwardingController({
    window,
    document,
    dom: domRefs,
    state,
    config: window.BananzaApp.config,
    api,
    esc: window.BananzaApp.formatters.esc,
    actions: {
      isNotesChat: () => false,
      getChatSearchHaystack: (chat) => `${chat.name || ''}`.toLowerCase(),
      formatChatListTimestamp: () => '',
      chatItemAvatarHtml: () => '<div class="avatar"></div>',
      renderChatLastPreviewHtml: (chat) => chat.last_message || '',
      closeModal: (modalOrId) => {
        const el = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
        el?.classList.add('hidden');
        return true;
      },
      openModal: (modalOrId) => {
        const el = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
        el?.classList.remove('hidden');
        return { el };
      },
      closeAllModals: () => document.querySelectorAll('.modal').forEach((el) => el.classList.add('hidden')),
      showCenterToast: (message) => toasts.push(message),
      playAppSound() {},
      scrollToBottom() {},
      updateChatListLastMessage() {},
      hideFloatingMessageActions: (options) => floating.hideFloatingMessageActions(options),
      isMobileLayoutViewport: () => false,
      prefersReducedMotion: () => true,
      getElementTransitionTotalMs: () => 0,
    },
  });
  const reactions = window.BananzaApp.interactions.reactions.createReactionController({
    window,
    document,
    dom: domRefs,
    state,
    api,
    esc: window.BananzaApp.formatters.esc,
    t: (key) => key,
    getFloatingActions: () => floating,
    actions: {
      getEmojiPickerCategories: () => ['recent', 'people'],
      isCustomEmojiCategory: () => false,
      getEmojiCategoryItems: () => ['\uD83D\uDC4D', '\u2764\uFE0F'],
      getRecentEmojiCategory: () => 'recent',
      isCustomEmojiToken: () => false,
      createHorizontalSwipePager: () => null,
      scheduleScrollableItemCenter: () => false,
      rememberRecentEmoji() {},
      canContextConvertMessage: () => false,
      canRestoreContextOriginalMessage: () => false,
      openMessageContextConvertPicker: () => Promise.resolve(false),
      restoreContextOriginalMessage: () => Promise.resolve(false),
      bindTouchSafeButtonActivation: (button, handler) => button?.addEventListener('click', (event) => handler({ event })),
      isMobileComposerKeyboardOpen: () => false,
      preventMobileComposerBlur: () => false,
      focusComposerKeepKeyboard() {},
      safeVibrate() {},
      getSelectedMessageFragment: () => '',
      isSelectableMessageTextTarget: () => false,
      getMessageMediaContextTarget: (target) => contextMenus.getMessageMediaContextTarget(target),
    },
  });
  const mediaViewer = window.BananzaApp.interactions.mediaViewer.createMediaViewer({
    window,
    document,
    dom: domRefs,
    state,
    config: window.BananzaApp.config,
    api,
    esc: window.BananzaApp.formatters.esc,
    actions: {
      getAttachmentPreviewUrl: (source) => source?.client_file_url || (source?.file_stored ? `/uploads/${source.file_stored}/preview` : ''),
      getAttachmentPosterUrl: () => '',
      ensureAttachmentPoster: () => Promise.resolve(''),
      markAttachmentPosterAvailable() {},
      applyPosterToVideoElement() {},
      closeMobileComposerTransientUi() {},
      dismissMobileComposer() {},
      isMobileLayoutViewport: () => false,
      scheduleMobileViewportRecovery() {},
      isGroupLikeCurrentChat: () => true,
      openAvatarUserMenu() {},
    },
  });
  const contextMenus = window.BananzaApp.interactions.contextMenus.createContextMenus({
    window,
    document,
    dom: domRefs,
    state,
    config: window.BananzaApp.config,
    api,
    esc: window.BananzaApp.formatters.esc,
    t: (key) => key,
    tx: (text) => text,
    confirm: () => true,
    getFloatingActions: () => floating,
    getReactions: () => reactions,
    getForwarding: () => forwarding,
    actions: {
      getChatById: (chatId) => chats.find((chat) => Number(chat.id) === Number(chatId)) || null,
      getActiveChatFolder: () => null,
      getPinnedChatMoveState: () => ({ canMoveUp: false, canMoveDown: false }),
      getFolderPinnedChatMoveState: () => ({ canMoveUp: false, canMoveDown: false }),
      isChatPinned: () => false,
      isChatPinnedInFolder: () => false,
      localChatPreferenceEnabled: (value) => value !== false,
      canHideChat: () => true,
      canLeaveChat: () => false,
      canManageDestructiveChat: () => false,
      setChatSidebarPin: async (chatId, pinned) => calls.push({ action: 'pin', chatId, pinned }),
      moveChatSidebarPin: async () => {},
      setFolderChatPin: async () => {},
      moveFolderChatPin: async () => {},
      removeChatFromFolder: async () => {},
      openChatFolderManageModal: async (chatId) => calls.push({ action: 'manage-folders', chatId }),
      hideChatFromList: async (chatId) => calls.push({ action: 'hide-chat', chatId }),
      leaveChat: async () => {},
      deleteChatCompletely: async () => {},
      loadChats: async () => [],
      renderChatList() {},
      renderChatPreferencesForm() {},
      getAttachmentPreviewUrl: (source) => source?.client_file_url || (source?.file_stored ? `/uploads/${source.file_stored}/preview` : ''),
      getAttachmentDownloadUrl: (source) => source?.client_file_url || (source?.file_stored ? `/uploads/${source.file_stored}` : ''),
      getMediaNoteFallbackLabel: () => 'Media note',
      normalizeMimeType: (value) => value || '',
      filenameFromContentDisposition: (_header, fallback) => fallback,
      getMessageCopyTextData: () => ({ text: 'copy me', hasMeaningfulContent: true }),
      canForwardMessage: () => true,
      canSaveMessageToNotes: () => true,
      canEditMessage: () => true,
      getPinActionState: () => ({ show: true, isPinned: false, disabled: false }),
      copyTextToClipboard: async () => true,
      showCenterToast: (message) => toasts.push(message),
      setReplyFromRow: () => calls.push({ action: 'reply' }),
      setEditFromRow: () => calls.push({ action: 'edit' }),
      togglePinFromRow: async () => calls.push({ action: 'toggle-pin' }),
      hasAndroidNativeBridge: () => false,
      safeVibrate() {},
      isMobileLayoutViewport: () => false,
      isMobileComposerKeyboardOpen: () => false,
      focusComposerKeepKeyboard() {},
    },
  });
  const search = window.BananzaApp.interactions.search.createSearchController({
    window,
    document,
    dom: domRefs,
    state,
    config: window.BananzaApp.config,
    api,
    esc: window.BananzaApp.formatters.esc,
    t: (key) => key,
    tx: (text) => text,
    $: domRefs.$,
    actions: baseActions,
  });

  return { calls, openedChats, toasts, search, reactions, floating, mediaViewer, contextMenus, forwarding };
}

async function bootFullApp() {
  const dom = createAppDom();
  const { window } = dom;
  installVisualViewportMock(window, { width: 390, height: 844 });
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
    getRegistration() { return Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(null) } }); },
  };
  window.WebSocket = class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;
    constructor() {
      this.readyState = window.WebSocket.OPEN;
      window.setTimeout(() => this.onopen?.(), 0);
    }
    close() { this.readyState = window.WebSocket.CLOSED; }
    send() {}
  };
  window.localStorage.setItem('token', 'test-token');
  window.localStorage.setItem('user', JSON.stringify(currentUser));
  window.fetch = async (input) => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname === '/api/auth/me') return createJsonResponse(dom, { user: currentUser });
    if (url.pathname === '/api/user/recent-emojis') return createJsonResponse(dom, { emojis: [] });
    if (url.pathname === '/api/weather/settings') return createJsonResponse(dom, { settings: { enabled: false, location: null, refresh_minutes: 30 } });
    if (url.pathname === '/api/sound-settings') return createJsonResponse(dom, { settings: { sounds_enabled: true, volume: 100, play_send: true, play_incoming: true, play_notifications: true, play_reactions: true, play_pins: true, play_invites: true, play_voice: true, play_mentions: true } });
    if (url.pathname === '/api/notification-settings') return createJsonResponse(dom, { settings: { push_enabled: false, notify_messages: true, notify_chat_invites: true, notify_reactions: true, notify_pins: true, notify_mentions: true } });
    if (url.pathname === '/api/users') return createJsonResponse(dom, []);
    if (url.pathname === '/api/chat-folders') return createJsonResponse(dom, { folders: [] });
    if (url.pathname === '/api/chats') return createJsonResponse(dom, [{ id: 1, type: 'group', name: 'General', last_message_id: 1, unread_count: 0 }]);
    if (url.pathname.match(/^\/api\/chats\/\d+\/messages$/)) return createJsonResponse(dom, { messages: [], has_more_before: false, has_more_after: false, member_last_reads: { 1: 1 } });
    if (url.pathname.match(/^\/api\/chats\/\d+\/pins$/)) return createJsonResponse(dom, { pins: [], events: [] });
    if (url.pathname.match(/^\/api\/chats\/\d+\/members$/)) return createJsonResponse(dom, []);
    if (url.pathname.match(/^\/api\/chats\/\d+\/mention-targets$/)) return createJsonResponse(dom, { users: [] });
    if (url.pathname.match(/^\/api\/chats\/\d+\/read$/)) return createJsonResponse(dom, {});
    if (url.pathname.match(/^\/api\/chats\/\d+\/context-convert/)) return createJsonResponse(dom, { enabled: false, bots: [] });
    if (url.pathname.match(/^\/api\/chats\/\d+\/chatshot/)) return createJsonResponse(dom, { enabled: false, ready: false });
    throw new Error(`Unexpected fetch: ${url.pathname}`);
  };
  const ready = new Promise((resolve) => window.addEventListener('bananza:ready', resolve, { once: true }));
  loadBrowserScript(dom, 'public/js/ai-image-risk.js');
  loadBrowserScript(dom, 'public/js/qip-infium-original.js');
  loadBrowserScript(dom, 'public/js/qip-hd.js');
  loadAppScript(dom);
  await ready;
  await wait(window);
  return dom;
}

test('interaction modules publish expected factories', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { interactions } = dom.window.BananzaApp;
  assert.equal(typeof interactions.search.createSearchController, 'function');
  assert.equal(typeof interactions.reactions.createReactionController, 'function');
  assert.equal(typeof interactions.floatingActions.createFloatingMessageActions, 'function');
  assert.equal(typeof interactions.mediaViewer.createMediaViewer, 'function');
  assert.equal(typeof interactions.contextMenus.createContextMenus, 'function');
  assert.equal(typeof interactions.forwarding.createForwardingController, 'function');
  dom.window.close();
});

test('search opens, calls search endpoint, and delegates cross-chat jump', async () => {
  const dom = createAppDom();
  const { window, document } = dom.window;
  const { search, calls, openedChats } = createControllers(dom);
  search.openSearchPanel({ focusInput: false });
  await wait(window, 20);
  assert.equal(document.getElementById('searchPanel').getAttribute('aria-hidden'), 'false');
  assert.equal(document.getElementById('searchBtn').classList.contains('is-active'), true);

  document.getElementById('searchInput').value = 'Hello';
  search.performSearch({ immediate: true });
  await wait(window, 80);
  assert.ok(calls.some((call) => String(call.url).startsWith('/api/messages/search?')));

  await search.jumpToSearchResult({ id: 202, chat_id: 2 });
  assert.equal(openedChats[0].chatId, 2);
  assert.equal(openedChats[0].options.anchorMessageId, 202);

  search.closeSearchPanel({ immediate: true });
  assert.equal(document.getElementById('searchPanel').getAttribute('aria-hidden'), 'true');
  dom.window.close();
});

test('reactions render, picker toggles, api toggle updates row bar', async () => {
  const dom = createAppDom();
  const { document } = dom.window;
  const { reactions, calls } = createControllers(dom);
  const row = createRow(dom, { id: 101 });
  const like = '\uD83D\uDC4D';

  reactions.updateReactionBar(101, [{ emoji: like, user_id: 1 }]);
  assert.equal(row.querySelector('.reaction-badge')?.textContent.includes('1'), true);
  reactions.showReactionPicker(row);
  assert.equal(document.getElementById('reactionPicker').classList.contains('hidden'), false);
  reactions.hideReactionUi({ immediate: true });
  assert.equal(document.getElementById('reactionPicker').classList.contains('hidden'), true);

  await reactions.toggleReaction(101, like);
  assert.ok(calls.some((call) => String(call.url).endsWith('/api/messages/101/reactions')));
  assert.equal(row.querySelector('.reaction-badge')?.textContent.includes('1'), true);
  dom.window.close();
});

test('floating actions portal and restore without losing message row', () => {
  const dom = createAppDom();
  const { document } = dom.window;
  const { floating } = createControllers(dom);
  const row = createRow(dom, { id: 301 });
  const originalActions = row.querySelector('.msg-actions');

  assert.equal(floating.showMessageActions(row), true);
  assert.equal(row.classList.contains('actions-open'), true);
  assert.equal(floating.getActiveMessageActionsRow(), row);
  assert.equal(document.body.contains(originalActions), true);
  floating.positionMessageActionSurfaces();
  floating.hideFloatingMessageActions({ immediate: true });
  assert.equal(row.classList.contains('actions-open'), false);
  assert.equal(row.querySelector('.msg-actions'), originalActions);
  dom.window.close();
});

test('media viewer opens image and video, exposes zoom state, navs gallery, and caches pages', async () => {
  const dom = createAppDom();
  const { document } = dom.window;
  const { mediaViewer } = createControllers(dom);
  createRow(dom, { id: 401, media: 'image' });
  createRow(dom, { id: 402, media: 'video' });

  mediaViewer.openMediaViewer('/uploads/photo.png/preview', 'image');
  assert.equal(document.getElementById('imageViewer').classList.contains('hidden'), false);
  mediaViewer.ivToggleZoomAt(120, 120);
  assert.ok(mediaViewer.getMediaViewerState().scale > 1);
  await mediaViewer.galleryNav(1);
  assert.equal(mediaViewer.getMediaViewerState().galleryIndex, 1);
  mediaViewer.closeMediaViewer();
  assert.equal(document.getElementById('imageViewer').classList.contains('hidden'), true);

  const page = { media: [{ id: 9, chat_id: 1, file_type: 'image', file_stored: 'cached.png' }], hasMoreBefore: false, hasMoreAfter: false };
  mediaViewer.cacheGalleryMediaPage(1, 'after', 1, page);
  const cachedPage = await mediaViewer.readCachedGalleryMediaPage(1, 'after', 1);
  assert.deepEqual(cachedPage.media, page.media);
  assert.equal(cachedPage.hasMoreBefore, false);
  assert.equal(cachedPage.hasMoreAfter, false);
  dom.window.close();
});

test('context menus resolve chat and media contexts and hide cleanly', async () => {
  const dom = createAppDom();
  const { document } = dom.window;
  const { contextMenus, calls } = createControllers(dom);
  const chatRow = document.createElement('button');
  chatRow.className = 'chat-item';
  chatRow.dataset.chatId = '1';
  document.getElementById('chatList').appendChild(chatRow);
  contextMenus.showChatContextMenuForRow(chatRow);
  assert.equal(document.getElementById('chatContextMenu').classList.contains('hidden'), false);
  await contextMenus.handleChatContextMenuAction('manage-folders', 1);
  assert.ok(calls.some((call) => call.action === 'manage-folders'));

  const imageRow = createRow(dom, { id: 501, media: 'image' });
  const videoRow = createRow(dom, { id: 502, media: 'video' });
  const fileRow = createRow(dom, { id: 503, media: 'file' });
  assert.equal(contextMenus.getMessageMediaContext(imageRow, imageRow.querySelector('.msg-image')).mediaKind, 'image');
  assert.equal(contextMenus.getMessageMediaContext(videoRow, videoRow.querySelector('video')).mediaKind, 'video');
  assert.equal(contextMenus.getMessageMediaContext(fileRow, fileRow.querySelector('.msg-file')).mediaKind, 'file');
  contextMenus.showMediaContextMenuForRow(imageRow, imageRow.querySelector('.msg-image'));
  assert.equal(document.getElementById('mediaContextMenu').classList.contains('hidden'), false);
  contextMenus.hideMediaContextMenu({ immediate: true });
  contextMenus.hideChatContextMenu({ immediate: true });
  assert.equal(document.getElementById('mediaContextMenu').getAttribute('aria-hidden'), 'true');
  dom.window.close();
});

test('forwarding modal opens and forwarding/save-to-notes call expected APIs', async () => {
  const dom = createAppDom();
  const { document } = dom.window;
  const { forwarding, calls } = createControllers(dom);
  forwarding.openForwardMessageModal({ id: 701 });
  assert.equal(document.getElementById('forwardMessageModal').classList.contains('hidden'), false);
  assert.ok(document.querySelector('.forward-chat-item[data-chat-id="1"]'));

  await forwarding.forwardMessageToChat(2);
  await forwarding.saveMessageToNotes({ id: 701 });
  assert.ok(calls.some((call) => call.url === '/api/messages/701/forward' && call.opts.body.targetChatId === 2));
  assert.ok(calls.some((call) => call.url === '/api/messages/701/save-to-notes'));
  dom.window.close();
});

test('full app bridge keeps media viewer testing API compatible', async (t) => {
  const dom = await bootFullApp();
  t.after(() => dom.window.close());
  const { document, BananzaAppBridge } = dom.window;

  BananzaAppBridge.__testing.openMediaViewer('https://example.com/test.jpg', 'image');
  await wait(dom.window, 20);
  assert.equal(document.getElementById('imageViewer').classList.contains('hidden'), false);
  assert.ok(BananzaAppBridge.__testing.getMediaViewerState().galleryItems.length >= 1);
  BananzaAppBridge.__testing.closeMediaViewer();
  await wait(dom.window, 20);
  assert.equal(document.getElementById('imageViewer').classList.contains('hidden'), true);
});

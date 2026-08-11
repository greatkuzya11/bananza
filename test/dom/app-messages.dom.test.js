const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const {
  createAppDom,
  installVisualViewportMock,
  loadAppRuntimeScripts,
  loadAppScript,
  loadBrowserScript,
} = require('../support/domHarness');
const { repoRoot } = require('../support/paths');

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

function createLoginDom(url) {
  const html = fs.readFileSync(path.join(repoRoot, 'public', 'login.html'), 'utf8');
  const dom = new JSDOM(html, {
    url,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const i18nSource = fs.readFileSync(path.join(repoRoot, 'public', 'js', 'i18n.js'), 'utf8');
  dom.window.eval(i18nSource);
  const inlineScript = [...dom.window.document.querySelectorAll('script')]
    .map((script) => script.textContent || '')
    .find((source) => source.includes('function safeNextPath'));
  dom.window.eval(inlineScript);
  return dom;
}

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
    if (url.pathname === '/api/sound-settings') return createJsonResponse(dom, { settings: { sounds_enabled: true, volume: 100, play_send: true, play_incoming: true, play_notifications: true, play_reactions: true, play_pins: true, play_invites: true, play_voice: true, play_mentions: true } });
    if (url.pathname === '/api/notification-settings') return createJsonResponse(dom, { settings: { push_enabled: false, notify_messages: true, notify_chat_invites: true, notify_reactions: true, notify_pins: true, notify_mentions: true } });
    if (url.pathname === '/api/users') return createJsonResponse(dom, []);
    if (url.pathname === '/api/chat-folders') return createJsonResponse(dom, { folders: [] });
    if (url.pathname.match(/^\/api\/chats\/\d+\/pins$/)) return createJsonResponse(dom, { pins: [], events: [] });
    if (url.pathname.match(/^\/api\/chats\/\d+\/members$/)) return createJsonResponse(dom, []);
    if (url.pathname.match(/^\/api\/chats\/\d+\/mention-targets$/)) return createJsonResponse(dom, { users: [] });
    if (url.pathname.match(/^\/api\/chats\/\d+\/read$/)) return createJsonResponse(dom, {});
    if (url.pathname.match(/^\/api\/chats\/\d+\/context-convert/)) return createJsonResponse(dom, { enabled: false, bots: [] });
    if (url.pathname.match(/^\/api\/chats\/\d+\/chatshot/)) return createJsonResponse(dom, { enabled: false, ready: false });
    if (url.pathname === '/api/chats') return createJsonResponse(dom, [{ id: 1, type: 'group', name: 'One', last_message_id: 3, unread_count: 0 }]);
    if (url.pathname.match(/^\/api\/chats\/\d+\/messages$/)) {
      return createJsonResponse(dom, { messages: [], has_more_before: false, has_more_after: false, member_last_reads: { 1: 3 } });
    }
    throw new Error(`Unexpected app-messages fetch: ${url.pathname}`);
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

function createOutboxUnitHarness({ replySnapshot = null } = {}) {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const { document } = window;
  const messagesEl = document.getElementById('messages');
  const messageState = window.BananzaApp.messages.state.createMessageState();
  const savedItems = [];
  const apiCalls = [];
  let clientSeq = 0;
  let clearReplyCalls = 0;

  window.messageCache = {
    async upsertOutboxItem(item) {
      savedItems.push({
        ...item,
        attachments: Array.isArray(item.attachments) ? item.attachments.slice() : [],
        voice: item.voice ? { ...item.voice } : null,
        videoNote: item.videoNote ? { ...item.videoNote } : null,
      });
    },
    async getOutboxItem() {
      return null;
    },
    async deleteOutboxItem() {},
  };

  const renderer = {
    appendMessage(msg) {
      const row = document.createElement('div');
      row.className = 'msg-row';
      row.dataset.outbox = '1';
      row.dataset.clientId = String(msg.client_id || msg.clientId || msg.id || '');
      row.dataset.msgId = String(msg.id || row.dataset.clientId);
      row.__messageData = msg;
      row.innerHTML = '<div class="msg-bubble"><div class="msg-footer"></div></div>';
      messagesEl.appendChild(row);
      return row;
    },
    updateRowStatus() {},
    withStableOutboxMedia(_row, msg) {
      return msg;
    },
    createMessageEl(msg) {
      return this.appendMessage(msg);
    },
  };

  const currentUser = {
    id: 1,
    username: 'alice',
    display_name: 'Alice',
    avatar_color: '#65aadd',
  };
  const outbox = window.BananzaApp.messages.outbox.createMessageOutbox({
    window,
    document,
    dom: { messagesEl },
    api: async (url, opts = {}) => {
      apiCalls.push({ url, opts });
      return null;
    },
    renderer,
    messageState,
    state: {
      getCurrentUser: () => currentUser,
      getCurrentChatId: () => 1,
    },
    actions: {
      updateScrollBottomButton() {},
      isNearBottom: () => true,
      captureScrollAnchor: () => null,
      restoreScrollAnchor() {},
      applyOwnReadStateToMessage: (msg) => msg,
      updateChatListLastMessage() {},
      scrollToBottom() {},
      getReplySnapshot: (source) => {
        if (source) return { ...source };
        return replySnapshot ? { ...replySnapshot } : null;
      },
      clearReply: () => {
        clearReplyCalls += 1;
      },
      playAppSound() {},
      makeClientId: () => `c-unit-${++clientSeq}`,
    },
  });

  return {
    dom,
    window,
    document,
    messagesEl,
    outbox,
    savedItems,
    apiCalls,
    getClearReplyCalls: () => clearReplyCalls,
  };
}

test('message modules publish expected factories', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { messages } = dom.window.BananzaApp;

  assert.equal(typeof messages.state.createMessageState, 'function');
  assert.equal(typeof messages.attachments.createMessageAttachmentRenderer, 'function');
  assert.equal(typeof messages.polls.createPollMessageRenderer, 'function');
  assert.equal(typeof messages.callCards.createCallCardRenderer, 'function');
  assert.equal(typeof messages.outbox.createMessageOutbox, 'function');
  assert.equal(typeof messages.updates.createMessageUpdates, 'function');
  assert.equal(typeof messages.render.createMessageRenderer, 'function');
  dom.window.close();
});

test('message renderer mixes chat system events into an empty timeline and deduplicates them', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const { document } = window;
  const messagesEl = document.getElementById('messages');
  const messageState = window.BananzaApp.messages.state.createMessageState();
  const interpolate = (key, values = {}) => String(key).replace(/\{(\w+)\}/g, (_match, name) => values[name] ?? '');
  const normalizeSystemEvent = (raw = {}) => ({
    id: Number(raw.id),
    chat_id: Number(raw.chat_id || raw.chatId || 1),
    event_type: raw.event_type || raw.eventType,
    actor_id: raw.actor_id ?? null,
    actor_name: raw.actor_name || '',
    target_user_id: raw.target_user_id ?? null,
    target_user_name: raw.target_user_name || '',
    target_is_ai_bot: Number(raw.target_is_ai_bot || 0),
    metadata: raw.metadata || {},
    created_at: raw.created_at || '2026-05-31T10:00:00.000Z',
  });

  const renderer = window.BananzaApp.messages.render.createMessageRenderer({
    window,
    document,
    dom: { messagesEl },
    messageState,
    t: interpolate,
    esc: (value) => String(value ?? ''),
    formatDate: () => 'May 31, 2026',
    formatTime: () => '10:00',
    state: {
      getCurrentUser: () => ({ id: 1 }),
      getCurrentChatId: () => 1,
      isCompactView: () => false,
    },
    actions: {
      buildMessagesRootChildren: (fragment = null) => fragment ? [fragment] : [],
      normalizePinEvents: () => [],
      normalizePinEvent: () => null,
      normalizeSystemEvent,
      normalizeSystemEvents: (events = []) => events.map(normalizeSystemEvent).filter((event) => event.id),
      filterNewMessages: () => [],
      insertAtMessagesEnd: (node) => messagesEl.appendChild(node),
      getMessagesLastContentChild: () => messagesEl.lastElementChild,
      updateScrollBottomButton() {},
      refreshScrollDateIndicator() {},
      getRenderedMessageRows: () => [],
      isLoadingMoreAfter: () => false,
      isNearBottom: () => true,
      captureScrollAnchor: () => null,
      restoreScrollAnchor() {},
      saveCurrentScrollAnchor() {},
      scrollToBottom() {},
    },
  });

  const event = {
    id: 10,
    chat_id: 1,
    event_type: 'member_added',
    actor_name: 'Alice',
    target_user_name: 'Bot',
    target_is_ai_bot: 1,
    created_at: '2026-05-31T10:00:00.000Z',
  };
  renderer.replaceRenderedMessages([], [], [event]);

  const rows = messagesEl.querySelectorAll('.chat-system-row');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].dataset.systemEventId, '10');
  assert.equal(rows[0].getAttribute('role'), null);
  assert.equal(rows[0].tabIndex, -1);
  assert.match(rows[0].textContent, /Alice added bot Bot/);

  renderer.appendSystemEventIfVisible(event);
  assert.equal(messagesEl.querySelectorAll('.chat-system-row').length, 1);
  renderer.appendSystemEventIfVisible({ ...event, id: 11, event_type: 'chat_history_cleared', actor_name: 'Alice' });
  assert.equal(messagesEl.querySelectorAll('.chat-system-row').length, 2);
  dom.window.close();
});

test('bridge renderer appends rows, groups senders, preserves data, and skips duplicates', async (t) => {
  const dom = await bootFullApp();
  t.after(() => dom.window.close());
  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([{ id: 1, type: 'group', name: 'One', last_message_id: 3, unread_count: 0 }], { currentChatId: 1 });

  const first = { id: 1, chat_id: 1, user_id: 2, display_name: 'Bob', text: 'One', created_at: '2026-05-31T10:00:00.000Z' };
  const second = { id: 2, chat_id: 1, user_id: 2, display_name: 'Bob', text: 'Two', created_at: '2026-05-31T10:01:00.000Z' };
  const own = { id: 3, chat_id: 1, user_id: 1, display_name: 'Alice', text: 'Mine', created_at: '2026-05-31T10:02:00.000Z' };
  BananzaAppBridge.__testing.appendMessage(first);
  BananzaAppBridge.__testing.appendMessage(second);
  BananzaAppBridge.__testing.appendMessage(own);
  BananzaAppBridge.__testing.appendMessage(second);

  const rows = [...document.querySelectorAll('#messages .msg-row[data-msg-id]')];
  assert.equal(rows.length, 3);
  assert.ok(rows.some((row) => row.classList.contains('own')));
  assert.ok(rows.some((row) => row.classList.contains('other')));
  assert.equal(document.querySelector('.msg-group .msg-group-body')?.querySelectorAll('.msg-row').length, 2);
  assert.equal(document.querySelector('[data-msg-id="1"]').__messageData.text, 'One');
  assert.equal(dom.window.__bananzaBootContext.state.getMessages().map((msg) => msg.id).join(','), '1,2,3');
});

test('message renderer formats Markdown safely and preserves the stored source text', async (t) => {
  const dom = await bootFullApp();
  t.after(() => dom.window.close());
  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([{ id: 1, type: 'group', name: 'One', last_message_id: 1, unread_count: 0 }], { currentChatId: 1 });
  const text = '## Heading\n### Subheading\n#### Minor heading\n- **Bold** [Go](https://example.com/post)\n- *Second* ~~old~~ `code`\n> quote\n<img src=x onerror=alert(1)> [bad](javascript:alert(1)) @bob :qip-infium-001:';
  BananzaAppBridge.__testing.appendMessage({
    id: 1,
    chat_id: 1,
    user_id: 2,
    display_name: 'Bob',
    text,
    mentions: [{ user_id: 3, token: 'bob', username: 'bob' }],
    created_at: '2026-05-31T10:00:00.000Z',
  });

  const row = document.querySelector('[data-msg-id="1"]');
  const messageText = row.querySelector('.msg-text');
  assert.ok(messageText.classList.contains('markdown-content'));
  assert.equal(messageText.querySelector('h2').textContent, 'Heading');
  assert.equal(messageText.querySelector('h3').textContent, 'Subheading');
  assert.equal(messageText.querySelector('h4').textContent, 'Minor heading');
  assert.equal(messageText.querySelectorAll('ul > li').length, 2);
  assert.equal(messageText.querySelector('strong').textContent, 'Bold');
  assert.equal(messageText.querySelector('a[href="https://example.com/post"]')?.textContent, 'Go');
  assert.equal(messageText.querySelector('a[href="https://example.com/post"]')?.target, '_blank');
  assert.equal(messageText.querySelector('code').textContent, 'code');
  assert.equal(messageText.querySelector('blockquote').textContent, 'quote');
  assert.equal(messageText.querySelector('img[onerror]'), null);
  assert.match(messageText.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(messageText.querySelector('a[href^="javascript:"]'), null);
  assert.ok(messageText.querySelector('.mention-link[data-mention-user-id="3"]'));
  assert.ok(messageText.querySelector('.qip-infium-emoji'));
  assert.equal(row.__messageData.text, text);
});

test('message renderer formats GitHub-style Markdown tables safely', async (t) => {
  const dom = await bootFullApp();
  t.after(() => dom.window.close());
  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([{ id: 1, type: 'group', name: 'One', last_message_id: 2, unread_count: 0 }], { currentChatId: 1 });
  const text = '| Player | Score | Source |\n| :--- | :---: | ---: |\n| **Alice** | 10 | [Site](https://example.com) |\n| <img src=x onerror=alert(1)> | 20 | [bad](javascript:alert(1)) |';
  BananzaAppBridge.__testing.appendMessage({
    id: 1,
    chat_id: 1,
    user_id: 2,
    display_name: 'Bob',
    text,
    created_at: '2026-05-31T10:00:00.000Z',
  });
  BananzaAppBridge.__testing.appendMessage({
    id: 2,
    chat_id: 1,
    user_id: 2,
    display_name: 'Bob',
    text: '| Broken | Table |\n| --- | --- |\n| only one cell |',
    created_at: '2026-05-31T10:01:00.000Z',
  });

  const messageText = document.querySelector('[data-msg-id="1"] .msg-text');
  const table = messageText.querySelector('table.markdown-table');
  assert.ok(messageText.classList.contains('markdown-content'));
  assert.ok(messageText.querySelector('.markdown-table-wrap'));
  assert.equal(table.querySelectorAll('thead th').length, 3);
  assert.equal(table.querySelectorAll('tbody tr').length, 2);
  assert.ok(table.querySelector('th.markdown-table-align-left'));
  assert.ok(table.querySelector('th.markdown-table-align-center'));
  assert.ok(table.querySelector('th.markdown-table-align-right'));
  assert.equal(table.querySelector('strong')?.textContent, 'Alice');
  assert.equal(table.querySelector('a[href="https://example.com"]')?.textContent, 'Site');
  assert.equal(table.querySelector('img[onerror]'), null);
  assert.equal(table.querySelector('a[href^="javascript:"]'), null);
  assert.equal(document.querySelector('[data-msg-id="1"]').__messageData.text, text);
  assert.equal(document.querySelector('[data-msg-id="2"] table'), null);
});

test('invite URLs render as in-app links and clicking joins and opens target chat', async (t) => {
  const inviteToken = 'abcdefghijklmnopqrstuvwxyzABCDEF123456';
  const fetchCalls = [];
  const chats = [
    { id: 1, type: 'group', name: 'One', last_message_id: 3, unread_count: 0 },
    { id: 2, type: 'group', name: 'Joined', last_message_id: 0, unread_count: 0 },
  ];
  const dom = await bootFullApp({
    fetchHandler: async ({ url, init, dom: appDom }) => {
      fetchCalls.push({ path: url.pathname, method: init.method || 'GET' });
      if (url.pathname === '/api/chats') return createJsonResponse(appDom, chats);
      if (url.pathname === `/api/chat-invites/${inviteToken}/join`) {
        return createJsonResponse(appDom, { ok: true, chatId: 2, chat: chats[1], joined: true });
      }
      return null;
    },
  });
  t.after(() => dom.window.close());
  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats(chats, { currentChatId: 1 });

  const inviteUrl = `${dom.window.location.origin}/join/${inviteToken}`;
  const externalUrl = `https://example.com/join/${inviteToken}`;
  BananzaAppBridge.__testing.appendMessage({
    id: 50,
    chat_id: 1,
    user_id: 2,
    display_name: 'Bob',
    text: `Internal ${inviteUrl} external ${externalUrl}`,
    created_at: '2026-05-31T10:00:00.000Z',
  });

  const inviteAnchor = document.querySelector(`a[data-chat-invite-token="${inviteToken}"]`);
  assert.ok(inviteAnchor);
  assert.equal(inviteAnchor.getAttribute('target'), null);
  const externalAnchor = [...document.querySelectorAll('#messages a')]
    .find((anchor) => anchor.href.startsWith('https://example.com/'));
  assert.ok(externalAnchor);
  assert.equal(externalAnchor.getAttribute('target'), '_blank');
  assert.equal(externalAnchor.dataset.chatInviteToken, undefined);

  const clickResult = inviteAnchor.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  assert.equal(clickResult, false);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (dom.window.__bananzaBootContext.state.getCurrentChatId() === 2) break;
    await wait(dom.window, 20);
  }

  assert.ok(fetchCalls.some((call) => call.path === `/api/chat-invites/${inviteToken}/join` && call.method === 'POST'));
  assert.ok(fetchCalls.some((call) => call.path === '/api/chats'));
  assert.equal(dom.window.__bananzaBootContext.state.getCurrentChatId(), 2);
});

test('login invite next path is preserved only for safe join routes', () => {
  const token = 'abcdefghijklmnopqrstuvwxyzABCDEF123456';
  const validDom = createLoginDom(`http://localhost:3000/login.html?next=/join/${token}`);
  assert.equal(validDom.window.safeNextPath(), `/join/${token}`);
  validDom.window.close();

  const externalDom = createLoginDom(`http://localhost:3000/login.html?next=${encodeURIComponent(`https://evil.test/join/${token}`)}`);
  assert.equal(externalDom.window.safeNextPath(), '/');
  externalDom.window.close();

  const shortDom = createLoginDom('http://localhost:3000/login.html?next=/join/short');
  assert.equal(shortDom.window.safeNextPath(), '/');
  shortDom.window.close();
});

test('attachments render media/file HTML and renderer binds playback with poster behavior', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const { document } = window;
  const state = window.BananzaApp.messages.state.createMessageState();
  const attachmentRenderer = window.BananzaApp.messages.attachments.createMessageAttachmentRenderer({
    attachments: window.BananzaApp.attachments,
    formatters: window.BananzaApp.formatters,
    state,
  });

  assert.match(attachmentRenderer.renderFileAttachment({ file_type: 'image', file_name: 'a.png', file_stored: 'a.png' }), /class="msg-image"/);
  assert.match(attachmentRenderer.renderFileAttachment({ file_type: 'video', file_name: 'v.mp4', file_stored: 'v.mp4', file_poster_available: true }), /poster=/);
  assert.match(attachmentRenderer.renderFileAttachment({ file_type: 'audio', file_name: 'a.wav', file_stored: 'a.wav' }), /<audio/);
  assert.match(attachmentRenderer.renderFileAttachment({ file_type: 'document', file_name: 'd.txt', file_stored: 'd.txt' }), /class="msg-file"/);

  const playback = [];
  const renderer = window.BananzaApp.messages.render.createMessageRenderer({
    document,
    dom: { messagesEl: document.getElementById('messages') },
    formatters: window.BananzaApp.formatters,
    attachmentHelpers: window.BananzaApp.attachments,
    attachmentRenderer,
    pollRenderer: { normalizePoll: () => null, isPulsePoll: () => false, renderPollCard: () => '', bindPollControls() {}, hydratePulseInlineVoters() {} },
    callCardRenderer: { renderCallMessageCard: () => '', renderCallTranscriptRunCard: () => '', renderCallArtifactBatchCard: () => '', bindCallMessageControls() {}, bindCallTranscriptMessageControls() {}, bindCallArtifactMessageControls() {} },
    messageState: state,
    state: { getCurrentUser: () => ({ id: 1, display_name: 'Alice', avatar_color: '#65aadd' }), getCurrentChatId: () => 1 },
    actions: {
      applyOwnReadStateToMessage: (msg) => msg,
      isClientSideMessage: () => false,
      renderMessageText: (text) => text,
      bindMediaPlaybackState: (media, message, role) => playback.push(role),
      buildMessagesRootChildren: (fragment) => [fragment].filter(Boolean),
    },
  });
  const audioRow = renderer.createMessageEl({ id: 10, chat_id: 1, user_id: 2, display_name: 'Bob', file_id: 1, file_type: 'audio', file_name: 'a.wav', file_stored: 'a.wav', created_at: '2026-05-31T10:00:00.000Z' });
  const videoRow = renderer.createMessageEl({ id: 11, chat_id: 1, user_id: 2, display_name: 'Bob', file_id: 2, file_type: 'video', file_name: 'v.mp4', file_stored: 'v.mp4', file_poster_available: true, created_at: '2026-05-31T10:01:00.000Z' });
  assert.ok(audioRow.querySelector('audio'));
  assert.ok(videoRow.querySelector('video')?.getAttribute('poster'));
  assert.deepEqual(playback.sort(), ['attachment-audio', 'attachment-video']);
  dom.window.close();
});

test('message renderer refreshes date separators through injected rendered rows provider', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const { document } = window;
  const messagesEl = document.getElementById('messages');
  const row = document.createElement('div');
  let rowReads = 0;

  row.className = 'msg-row';
  row.dataset.msgId = '42';
  row.__messageData = { id: 42, created_at: '2026-06-03T10:00:00.000Z' };
  messagesEl.innerHTML = '<div class="date-separator" data-date-iso="2026-06-03T00:00:00.000Z"><span></span></div>';
  messagesEl.appendChild(row);

  const renderer = window.BananzaApp.messages.render.createMessageRenderer({
    document,
    dom: { messagesEl },
    formatDate: (value) => `fmt:${value}`,
    actions: {
      getRenderedMessageRows: () => {
        rowReads += 1;
        return [row];
      },
      refreshScrollDateIndicator() {},
    },
  });

  assert.doesNotThrow(() => renderer.refreshDateSeparators());
  assert.equal(rowReads, 1);
  assert.equal(row.dataset.date, 'fmt:2026-06-03T10:00:00.000Z');
  assert.equal(messagesEl.querySelector('.date-separator span').textContent, 'fmt:2026-06-03T00:00:00.000Z');
  dom.window.close();
});

test('poll renderer renders cards, votes/closes through API, and applies updates', async () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const { document } = window;
  const calls = [];
  const messagesEl = document.getElementById('messages');
  const pollRenderer = window.BananzaApp.messages.polls.createPollMessageRenderer({
    document,
    dom: { messagesEl },
    api: async (url, opts = {}) => {
      calls.push({ url, opts });
      return { poll: { options: [{ id: 1, text: 'A', vote_count: 1 }], total_votes: 1, my_option_ids: [1] } };
    },
    formatters: window.BananzaApp.formatters,
    ui: { normalizePollStyle: (style) => style || 'pulse', setPollStyleSurface() {} },
    state: { getCurrentUser: () => ({ id: 1, is_admin: 1 }), getCurrentChatId: () => 1, getChatById: () => ({ allow_poll_close_any: true }) },
    actions: { replaceRenderedMessage() {}, showCenterToast() {}, openFloatingSurface() {}, closeFloatingSurface() {}, openModal() {}, avatarHtml: () => '<div></div>' },
  });
  const msg = { id: 1, chat_id: 1, user_id: 2, text: 'Question', poll: { style: 'stack', options: [{ id: 1, text: 'A', vote_count: 0 }], total_votes: 0, my_option_ids: [], created_by: 2 } };
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.dataset.msgId = '1';
  row.__messageData = msg;
  row.innerHTML = pollRenderer.renderPollCard(msg);
  messagesEl.appendChild(row);

  assert.ok(row.querySelector('.poll-card'));
  await pollRenderer.togglePollVote(1, 1);
  await pollRenderer.closePollMessage(1);
  pollRenderer.applyPollUpdate(1, 1, { style: 'stack', options: [{ id: 1, text: 'A', vote_count: 3 }], total_votes: 3, my_option_ids: [1] });
  assert.ok(calls.some((call) => call.url.endsWith('/poll-vote')));
  assert.ok(calls.some((call) => call.url.endsWith('/poll-close')));
  assert.match(row.textContent, /3 votes/);
  dom.window.close();
});

test('call cards render and delegate controls to call hooks', async () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const { document } = window;
  const joined = [];
  const transcripts = [];
  const copied = [];
  const toasts = [];
  const apiCalls = [];
  window.BananzaCallHooks = {
    isCurrentCall: () => false,
    joinCallFromMessage(call) { joined.push(call.id); return Promise.resolve(); },
    openTranscriptRun(id) { transcripts.push(id); },
  };
  const callCards = window.BananzaApp.messages.callCards.createCallCardRenderer({
    document,
    dom: { messagesEl: document.getElementById('messages') },
    api: async (url, opts = {}) => {
      apiCalls.push({ url, opts });
      return { external_url: 'https://example.test/call/invite-token' };
    },
    t: (key) => key,
    esc: window.BananzaApp.formatters.esc,
    getCurrentUser: () => ({ id: 1, is_admin: 0 }),
    actions: {
      bindMediaPlaybackState() {},
      showCenterToast(message) { toasts.push(message); },
      copyTextToClipboard(text) {
        copied.push(text);
        return Promise.resolve(true);
      },
    },
  });
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.__messageData = { id: 1, call: { id: 44, status: 'active', can_join: true, media_kind: 'video', started_by: 1 } };
  row.innerHTML = callCards.renderCallMessageCard(row.__messageData);
  callCards.bindCallMessageControls(row);
  assert.ok(row.querySelector('.is-video-call-card'));
  assert.match(row.textContent, /Video call started/);
  row.querySelector('[data-call-card-join]').click();
  await wait(window);
  assert.deepEqual(joined, [44]);
  row.querySelector('[data-call-card-copy-link]').click();
  await wait(window);
  assert.equal(apiCalls.at(-1).url, '/api/calls/44/external-link');
  assert.deepEqual(copied, ['https://example.test/call/invite-token']);
  assert.equal(toasts.at(-1), 'Call link copied');

  const transcriptRow = document.createElement('div');
  transcriptRow.__messageData = { call_transcript_run: { id: 9, status: 'completed', transcript_ready: true } };
  transcriptRow.innerHTML = callCards.renderCallTranscriptRunCard(transcriptRow.__messageData);
  callCards.bindCallTranscriptMessageControls(transcriptRow);
  transcriptRow.querySelector('[data-call-transcript-run]').click();
  assert.deepEqual(transcripts, [9]);

  const videoRoomRow = document.createElement('div');
  videoRoomRow.className = 'msg-row';
  videoRoomRow.__messageData = {
    id: 2,
    is_call_message: true,
    text: 'Video call',
    call_message: {
      call_id: 45,
      status: 'active',
      can_join: true,
      media_kind: 'video',
      room_mode: 'room',
      started_by: 1,
    },
    call: {
      id: 45,
      status: 'active',
      can_join: true,
      media_kind: 'video',
      room_mode: 'room',
      started_by: 1,
    },
  };
  videoRoomRow.innerHTML = callCards.renderCallMessageCard(videoRoomRow.__messageData);
  assert.ok(videoRoomRow.querySelector('.is-video-call-card'));
  assert.equal(videoRoomRow.querySelector('.is-voice-call-card'), null);
  assert.match(videoRoomRow.textContent, /Video call started/);
  assert.doesNotMatch(videoRoomRow.textContent, /Voice room active/);

  dom.window.close();
});

test('call recording playback URL uses token query parameter', () => {
  const dom = createAppDom();
  loadAppRuntimeScripts(dom);
  const { window } = dom;
  const { document } = window;
  const callCards = window.BananzaApp.messages.callCards.createCallCardRenderer({
    document,
    dom: { messagesEl: document.getElementById('messages') },
    getToken: () => 'abc123',
  });

  const url = callCards.callRecordingPlaybackUrl('/api/calls/42/recording/mixed');
  assert.equal(url, '/api/calls/42/recording/mixed?token=abc123');
  assert.equal(url.includes('getToken'), false);
  dom.window.close();
});

test('voice outbox queues without explicit or current reply', async (t) => {
  const harness = createOutboxUnitHarness();
  t.after(() => harness.dom.window.close());

  const item = await harness.outbox.queueVoiceOutbox({
    blob: new harness.window.Blob(['voice'], { type: 'audio/wav' }),
    durationMs: 1200,
    sampleRate: 16000,
  });

  assert.equal(item.kind, 'voice');
  assert.equal(item.replyToId, null);
  assert.equal(item.reply, null);
  assert.equal(harness.savedItems[0].replyToId, null);
  assert.equal(harness.getClearReplyCalls(), 1);
  const row = harness.document.querySelector('.msg-row[data-client-id="c-unit-1"]');
  assert.ok(row);
  assert.equal(row.__messageData.is_voice_note, true);
  assert.equal(row.__messageData.reply_to_id, null);
});

test('video note outbox queues without explicit reply and preserves current reply snapshot', async (t) => {
  const harness = createOutboxUnitHarness({
    replySnapshot: {
      id: 92,
      display_name: 'Bob',
      text: 'Quoted video note reply',
      is_voice_note: true,
      is_video_note: false,
    },
  });
  t.after(() => harness.dom.window.close());

  const item = await harness.outbox.queueVideoNoteOutbox({
    videoBlob: new harness.window.Blob(['video'], { type: 'video/webm' }),
    audioBlob: new harness.window.Blob(['audio'], { type: 'audio/wav' }),
    durationMs: 1800,
    sampleRate: 16000,
    videoMime: 'video/webm',
    shapeId: 'circle',
    shapeSnapshot: { id: 'circle' },
  });

  assert.equal(item.kind, 'video_note');
  assert.equal(item.replyToId, 92);
  assert.equal(item.reply.text, 'Quoted video note reply');
  assert.equal(harness.savedItems[0].replyToId, 92);
  assert.equal(harness.getClearReplyCalls(), 1);
  const row = harness.document.querySelector('.msg-row[data-client-id="c-unit-1"]');
  assert.ok(row);
  assert.equal(row.__messageData.is_voice_note, true);
  assert.equal(row.__messageData.is_video_note, true);
  assert.equal(row.__messageData.reply_to_id, 92);
  assert.equal(row.__messageData.reply_note_kind, 'voice');
});

test('outbox renders pending rows, promotes echoes, retries, and revokes URLs', async (t) => {
  const dom = await bootFullApp();
  t.after(() => dom.window.close());
  const { window, document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([{ id: 1, type: 'group', name: 'One', last_message_id: 3, unread_count: 0 }], { currentChatId: 1 });
  const revoked = [];
  window.URL.createObjectURL = () => 'blob:outbox-file';
  window.URL.revokeObjectURL = (url) => revoked.push(url);
  const item = {
    clientId: 'c-test',
    chatId: 1,
    userId: 1,
    status: 'failed',
    kind: 'message',
    createdAt: '2026-05-31T10:00:00.000Z',
    text: 'Pending',
    attachments: [{ localId: 'file', file: new window.Blob(['x'], { type: 'text/plain' }), name: 'x.txt', size: 1, mime: 'text/plain', type: 'document' }],
  };
  const row = BananzaAppBridge.__testing.renderOutboxItem(item);
  assert.equal(row?.dataset.outbox, '1');
  row.querySelector('.msg-retry-btn')?.click();
  await BananzaAppBridge.__testing.completeOutboxSend(item, { id: 99, client_id: 'c-test', chat_id: 1, user_id: 1, display_name: 'Alice', text: 'Sent', created_at: '2026-05-31T10:00:01.000Z' });
  assert.ok(document.querySelector('[data-msg-id="99"]'));
  assert.equal(document.querySelector('[data-msg-id="c-test"]'), null);
  assert.ok(window.__bananzaBootContext.state.getMessages().some((msg) => Number(msg.id) === 99));
  assert.ok(revoked.includes('blob:outbox-file'));
});

test('updates mark rows deleted and refresh reply quotes', async (t) => {
  const dom = await bootFullApp();
  t.after(() => dom.window.close());
  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([{ id: 1, type: 'group', name: 'One', last_message_id: 3, unread_count: 0 }], { currentChatId: 1 });
  BananzaAppBridge.__testing.appendMessage({ id: 1, chat_id: 1, user_id: 2, display_name: 'Bob', text: 'Original', created_at: '2026-05-31T10:00:00.000Z' });
  BananzaAppBridge.__testing.appendMessage({ id: 2, chat_id: 1, user_id: 1, display_name: 'Alice', text: 'Reply', reply_to_id: 1, reply_display_name: 'Bob', reply_text: 'Original', created_at: '2026-05-31T10:01:00.000Z' });
  BananzaAppBridge.__testing.applyMessageUpdate({ id: 1, chat_id: 1, user_id: 2, display_name: 'Bob', text: 'Changed', created_at: '2026-05-31T10:00:00.000Z' });
  assert.equal(document.querySelector('.msg-reply[data-reply-id="1"] .msg-reply-text').textContent, 'Changed');
  assert.equal(dom.window.__bananzaBootContext.state.getMessages().find((msg) => Number(msg.id) === 1)?.text, 'Changed');
  BananzaAppBridge.__testing.applyMessageUpdate({ id: 1, chat_id: 1, user_id: 2, display_name: 'Bob', text: 'Message deleted', is_deleted: true, created_at: '2026-05-31T10:00:00.000Z' });
  BananzaAppBridge.__testing.applyMessageUpdate({ id: 1, chat_id: 1, user_id: 2, display_name: 'Bob', text: 'Message deleted', is_deleted: true, created_at: '2026-05-31T10:00:00.000Z' });
  assert.ok(document.querySelector('[data-msg-id="1"] .msg-deleted'));
  assert.equal(dom.window.__bananzaBootContext.state.getMessages().find((msg) => Number(msg.id) === 1)?.is_deleted, true);
});

test('full app bridge keeps message methods and open-chat rendering path', async (t) => {
  const dom = await bootFullApp({
    fetchHandler: ({ url, dom: testDom }) => {
      if (url.pathname === '/api/chats') return createJsonResponse(testDom, [{ id: 1, type: 'group', name: 'One', last_message_id: 7, unread_count: 0 }]);
      if (url.pathname === '/api/chats/1/messages') {
        return createJsonResponse(testDom, { messages: [{ id: 7, chat_id: 1, user_id: 2, display_name: 'Bob', text: '| Name | Value |\n| --- | ---: |\n| Hydrated | **42** |', created_at: '2026-05-31T10:00:00.000Z' }], has_more_before: false, has_more_after: false, member_last_reads: { 1: 7 } });
      }
      return null;
    },
  });
  t.after(() => dom.window.close());
  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([{ id: 1, type: 'group', name: 'One', last_message_id: 7, unread_count: 0 }]);
  await BananzaAppBridge.__testing.openChat(1);
  const hydrated = document.querySelector('[data-msg-id="7"]');
  assert.equal(hydrated.__messageData.text, '| Name | Value |\n| --- | ---: |\n| Hydrated | **42** |');
  assert.equal(hydrated.querySelector('.msg-text table')?.querySelectorAll('tbody tr').length, 1);
  assert.equal(hydrated.querySelector('.msg-text table strong')?.textContent, '42');
  assert.equal(typeof BananzaAppBridge.queueVoiceMessage, 'function');
  assert.equal(typeof BananzaAppBridge.queueVideoNote, 'function');
  assert.equal(typeof BananzaAppBridge.__testing.renderOutboxItem, 'function');
  assert.equal(typeof BananzaAppBridge.__testing.completeOutboxSend, 'function');
  assert.equal(typeof BananzaAppBridge.__testing.appendMessage, 'function');
  assert.equal(typeof BananzaAppBridge.__testing.applyMessageUpdate, 'function');
});

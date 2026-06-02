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
  window.BananzaCallHooks = {
    isCurrentCall: () => false,
    joinCallFromMessage(call) { joined.push(call.id); return Promise.resolve(); },
    openTranscriptRun(id) { transcripts.push(id); },
  };
  const callCards = window.BananzaApp.messages.callCards.createCallCardRenderer({
    document,
    dom: { messagesEl: document.getElementById('messages') },
    t: (key) => key,
    esc: window.BananzaApp.formatters.esc,
    actions: { bindMediaPlaybackState() {}, showCenterToast() {} },
  });
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.__messageData = { id: 1, call: { id: 44, status: 'active', can_join: true, media_kind: 'video' } };
  row.innerHTML = callCards.renderCallMessageCard(row.__messageData);
  callCards.bindCallMessageControls(row);
  row.querySelector('[data-call-card-join]').click();
  await wait(window);
  assert.deepEqual(joined, [44]);

  const transcriptRow = document.createElement('div');
  transcriptRow.__messageData = { call_transcript_run: { id: 9, status: 'completed', transcript_ready: true } };
  transcriptRow.innerHTML = callCards.renderCallTranscriptRunCard(transcriptRow.__messageData);
  callCards.bindCallTranscriptMessageControls(transcriptRow);
  transcriptRow.querySelector('[data-call-transcript-run]').click();
  assert.deepEqual(transcripts, [9]);
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
        return createJsonResponse(testDom, { messages: [{ id: 7, chat_id: 1, user_id: 2, display_name: 'Bob', text: 'Hydrated', created_at: '2026-05-31T10:00:00.000Z' }], has_more_before: false, has_more_after: false, member_last_reads: { 1: 7 } });
      }
      return null;
    },
  });
  t.after(() => dom.window.close());
  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.setChats([{ id: 1, type: 'group', name: 'One', last_message_id: 7, unread_count: 0 }]);
  await BananzaAppBridge.__testing.openChat(1);
  assert.equal(document.querySelector('[data-msg-id="7"]').__messageData.text, 'Hydrated');
  assert.equal(typeof BananzaAppBridge.queueVoiceMessage, 'function');
  assert.equal(typeof BananzaAppBridge.queueVideoNote, 'function');
  assert.equal(typeof BananzaAppBridge.__testing.renderOutboxItem, 'function');
  assert.equal(typeof BananzaAppBridge.__testing.completeOutboxSend, 'function');
  assert.equal(typeof BananzaAppBridge.__testing.appendMessage, 'function');
  assert.equal(typeof BananzaAppBridge.__testing.applyMessageUpdate, 'function');
});

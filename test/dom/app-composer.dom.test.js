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

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function openSurface(el) {
  el?.classList.remove('hidden');
}

function closeSurface(el) {
  el?.classList.add('hidden');
}

function isSurfaceOpen(el) {
  return Boolean(el && !el.classList.contains('hidden'));
}

function composerKey(window, key, options = {}) {
  return new window.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function loadComposerRuntime(dom) {
  loadBrowserScript(dom, 'public/js/qip-infium-original.js');
  loadBrowserScript(dom, 'public/js/qip-hd.js');
  loadAppRuntimeScripts(dom);
}

function createComposerHarness(options = {}) {
  const dom = createAppDom();
  installVisualViewportMock(dom.window, { width: 390, height: 844 });
  loadComposerRuntime(dom);
  const { window } = dom;
  const root = window.BananzaApp;
  const appDom = root.dom.createDomRefs();
  const currentUser = options.currentUser || { id: 1, username: 'alice', display_name: 'Alice', is_admin: 1 };
  let currentChatId = options.currentChatId || 1;
  const alerts = [];
  const apiCalls = [];
  const api = async (url, init = {}) => {
    apiCalls.push({ url, init });
    if (typeof options.api === 'function') return options.api(url, init, { dom, apiCalls });
    if (/\/mention-targets$/.test(url)) {
      return {
        users: [
          { token: 'alice', user_id: 2, username: 'alice', display_name: 'Alice A' },
          { token: 'assist', is_ai_bot: true, bot_id: 7, display_name: 'Assist' },
        ],
      };
    }
    if (url === '/api/user/recent-emojis') return { emojis: [] };
    if (/\/messages$/.test(url)) return { id: 77, chat_id: currentChatId, user_id: currentUser.id, text: init.body?.text || '' };
    return {};
  };
  const state = root.composer.state.createComposerState({
    storage: window.localStorage,
    getCurrentUser: () => currentUser,
  });
  const text = root.composer.text.createComposerTextController({
    window,
    document: window.document,
    dom: appDom,
    state,
    customEmoji: root.customEmoji,
    formatters: root.formatters,
    esc: root.formatters.esc,
    actions: {
      isFloatingSurfaceVisible: isSurfaceOpen,
      isMobileLayoutViewport: () => false,
      queueIosViewportLayoutSync() {},
    },
  });
  const replyEdit = root.composer.replyEdit.createReplyEditController({
    window,
    document: window.document,
    dom: appDom,
    state,
    text,
    getCurrentUser: () => currentUser,
    getCurrentChatId: () => currentChatId,
    actions: {
      alert: (message) => alerts.push(message),
      isClientSideMessage: () => false,
      isPollMessage: () => false,
      hideFloatingMessageActions() {},
      copyTextToClipboard: async (value) => {
        replyEdit.__copied = value;
        return true;
      },
      showCenterToast() {},
      syncMentionOpenButton() {},
      refreshPollComposerActionState() {},
      refreshVoiceComposerState() {},
      clearComposerDraft() {},
      safeVibrate() {},
    },
  });
  const files = root.composer.files.createComposerFilesController({
    window,
    document: window.document,
    dom: appDom,
    state,
    config: {
      MAX_ATTACHMENTS: options.maxAttachments || 3,
      MAX_FILE_SIZE: options.maxFileSize || 1000,
      MAX_FILE_SIZE_LABEL: '1000 B',
    },
    esc: root.formatters.esc,
    formatSize: root.formatters.formatSize,
    actions: {
      alert: (message) => alerts.push(message),
      localAttachmentFromFile: async (file) => ({
        localId: `local-${file.name}`,
        file,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        type: file.type.startsWith('image/') ? 'image' : 'document',
      }),
      refreshPollComposerActionState() {},
      refreshVoiceComposerState() {},
      scheduleMobileViewportRecovery() {},
      bindTouchSafeButtonActivation(button, handler) {
        button?.addEventListener('click', (event) => handler({ event, startKeyboardOpen: false, keepKeyboardOpen: false }));
      },
      isMobileLayoutViewport: () => false,
      isFloatingSurfaceVisible: isSurfaceOpen,
      openFloatingSurface: openSurface,
      closeFloatingSurface: closeSurface,
    },
  });
  const outboxItems = [];
  const triedItems = [];
  const send = root.composer.send.createComposerSendController({
    window,
    dom: appDom,
    state,
    text,
    replyEdit,
    files,
    api,
    config: { MAX_MSG: 4096 },
    getCurrentChatId: () => currentChatId,
    messages: {
      outbox: {
        createMessageOutboxItem: (payload) => ({ client_id: `c${outboxItems.length + 1}`, chat_id: currentChatId, ...payload }),
        queueOutboxItem: async (item) => outboxItems.push(item),
        trySendOutboxItem: async (item) => triedItems.push(item),
      },
    },
    actions: {
      alert: (message) => alerts.push(message),
      analyzeOutgoingGrokImageRisk: async () => ({ risky: false }),
      resolveComposerAiOverridePayload: () => ({}),
      clearComposerDraft() {},
      syncMentionOpenButton() {},
      refreshVoiceComposerState() {},
      scheduleMobileViewportRecovery() {},
      playAppSound() {},
      scrollToBottom() {},
      applyMessageUpdate(message) {
        send.__updated = message;
      },
      captureScrollAnchor: () => null,
      saveCurrentScrollAnchor() {},
      loadChats: async () => {},
    },
  });
  const emoji = root.composer.emojiPicker.createEmojiPickerController({
    window,
    document: window.document,
    dom: appDom,
    state,
    text,
    storage: window.localStorage,
    customEmoji: root.customEmoji,
    formatters: root.formatters,
    esc: root.formatters.esc,
    t: (key) => key,
    api,
    getCurrentUser: () => currentUser,
    actions: {
      isSingleEmojiMessage: (value) => /^\p{Emoji}/u.test(value),
      scheduleScrollableItemCenter() {},
      createHorizontalSwipePager: () => ({ reset() {} }),
      isMobileComposerKeyboardOpen: () => false,
      isMobileLayoutViewport: () => false,
      focusComposerKeepKeyboard() {},
      forceMobileViewportLayoutSync() {},
      syncChatAreaMetrics() {},
      queueIosViewportLayoutSync() {},
      isFloatingSurfaceVisible: isSurfaceOpen,
      getFloatingViewportRect: () => ({ left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 }),
      measureFloatingSurface: () => ({ width: 254, height: 338 }),
      clamp: (value, min, max) => Math.max(min, Math.min(value, max)),
      positionFloatingElement(el, left, top) {
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
      },
      openFloatingSurface: openSurface,
      closeFloatingSurface: closeSurface,
    },
  });
  const mentions = root.composer.mentions.createMentionPickerController({
    window,
    document: window.document,
    dom: appDom,
    state,
    text,
    api,
    esc: root.formatters.esc,
    getCurrentChatId: () => currentChatId,
    getCurrentUser: () => currentUser,
    actions: {
      updateComposerAiOverrideState() {},
      syncContextConvertComposerButton() {},
      closeFloatingSurface: closeSurface,
      openFloatingSurface: openSurface,
      isMobileLayoutViewport: () => false,
      isMobileComposerKeyboardOpen: () => false,
      restoreComposerFocusAfterMentionPicker() {},
      refreshVoiceComposerState() {},
      focusComposerKeepKeyboard() {},
      openPrivateChatWithUser: async (userId) => {
        mentions.__openedUserId = userId;
      },
      consumeOutsidePickerDismissGesture() {},
      isPickerDismissPassThroughTarget: () => false,
    },
  });
  const typingPayloads = [];
  const typingDragDrop = root.composer.typingDragDrop.createTypingDragDropController({
    dom: appDom,
    state,
    files,
    getCurrentChatId: () => currentChatId,
    actions: {
      sendWs: (payload) => {
        typingPayloads.push(payload);
        return true;
      },
    },
  });
  const poll = root.composer.pollComposer.createPollComposerController({
    window,
    document: window.document,
    dom: appDom,
    state,
    text,
    replyEdit,
    api,
    config: {
      POLL_MIN_OPTIONS: 2,
      POLL_MAX_OPTIONS: 5,
      POLL_CLOSE_PRESET_MS: { hour: 3600000 },
    },
    esc: root.formatters.esc,
    getCurrentChatId: () => currentChatId,
    getCurrentUser: () => currentUser,
    actions: {
      alert: (message) => alerts.push(message),
      normalizePollStyle: (style) => style || 'pulse',
      getPollComposerStyle: () => 'pulse',
      setPollComposerStyle() {},
      pollStyleMeta: (style) => ({ name: style, note: 'Preview' }),
      isPulsePoll: () => true,
      renderPollCard: () => '<div class="poll-card">poll</div>',
      syncPollComposerStyleUi() {},
      isCurrentNotesChat: () => false,
      syncChatAreaMetrics() {},
      openModal(id) {
        window.document.getElementById(id)?.classList.remove('hidden');
      },
      closeModal(id) {
        window.document.getElementById(id)?.classList.add('hidden');
      },
      clearComposerDraft() {},
      syncMentionOpenButton() {},
      refreshVoiceComposerState() {},
      updateChatListLastMessage() {},
      cacheMessage() {},
      isMessageDisplayed: () => false,
      appendMessage(message) {
        poll.__appended = message;
      },
      scrollToBottom() {},
      playAppSound() {},
      openPollStyleSettingsModal() {},
    },
  });

  return {
    dom,
    window,
    document: window.document,
    root,
    appDom,
    state,
    text,
    replyEdit,
    files,
    send,
    emoji,
    mentions,
    typingDragDrop,
    poll,
    alerts,
    apiCalls,
    outboxItems,
    triedItems,
    typingPayloads,
    setCurrentChatId(value) {
      currentChatId = value;
    },
  };
}

test('composer modules publish expected factories', () => {
  const dom = createAppDom();
  loadComposerRuntime(dom);
  const { composer } = dom.window.BananzaApp;

  assert.equal(typeof composer.state.createComposerState, 'function');
  assert.equal(typeof composer.text.createComposerTextController, 'function');
  assert.equal(typeof composer.replyEdit.createReplyEditController, 'function');
  assert.equal(typeof composer.files.createComposerFilesController, 'function');
  assert.equal(typeof composer.send.createComposerSendController, 'function');
  assert.equal(typeof composer.emojiPicker.createEmojiPickerController, 'function');
  assert.equal(typeof composer.mentions.createMentionPickerController, 'function');
  assert.equal(typeof composer.typingDragDrop.createTypingDragDropController, 'function');
  assert.equal(typeof composer.pollComposer.createPollComposerController, 'function');
  dom.window.close();
});

test('composer history APIs are exposed on state and text controllers', (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());

  assert.equal(typeof h.state.addComposerHistoryEntry, 'function');
  assert.equal(typeof h.state.getComposerHistoryEntries, 'function');
  assert.equal(typeof h.state.stepComposerHistory, 'function');
  assert.equal(typeof h.state.resetComposerHistoryNavigation, 'function');
  assert.equal(typeof h.state.resetComposerHistoryForCurrentUser, 'function');
  assert.equal(typeof h.text.handleComposerHistoryKeydown, 'function');
});

test('composer text reads, writes, inserts, serializes custom emoji, and resizes', (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());
  const token = h.root.customEmoji.CUSTOM_EMOJI_ITEMS[0]?.token;

  h.text.setComposerTextValue('hello');
  assert.equal(h.text.getComposerTextValue(), 'hello');
  h.appDom.msgInput.setSelectionRange(5, 5);
  h.text.insertComposerTextAtSelection(' world');
  assert.equal(h.text.getComposerTextValue(), 'hello world');

  assert.ok(token, 'Expected test custom emoji catalog to load');
  h.text.setComposerTextValue(token);
  assert.equal(h.text.getComposerTextValue(), token);
  assert.notEqual(h.appDom.msgInput.value, token, 'Composer stores custom emoji as marker clusters internally');

  h.text.autoResize();
  assert.match(h.appDom.msgInput.style.height, /px$/);
  h.text.animateSendButton();
  assert.equal(h.appDom.sendBtn.classList.contains('send-fly'), true);
});

test('reply/edit controller updates bars and copies selected message text', async (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());
  const row = h.document.createElement('div');
  row.className = 'msg-row';
  row.dataset.msgId = '12';
  row.__messageData = { id: 12, user_id: 1, text: 'hello copy', display_name: 'Alice' };
  row.__replyPayload = { id: 12, display_name: 'Alice', text: 'hello copy' };
  row.innerHTML = '<div class="msg-bubble"><div class="msg-text">hello copy</div></div>';
  h.appDom.messagesEl.appendChild(row);

  h.replyEdit.setReplyFromRow(row);
  assert.equal(h.state.getReplyTo().id, 12);
  assert.equal(h.appDom.replyBar.classList.contains('hidden'), false);
  h.replyEdit.clearReply();
  assert.equal(h.state.getReplyTo(), null);

  h.replyEdit.setEditFromRow(row);
  assert.equal(h.state.getEditTo().id, 12);
  assert.equal(h.text.getComposerTextValue(), 'hello copy');
  h.replyEdit.clearEdit({ clearInput: true });
  assert.equal(h.state.getEditTo(), null);
  assert.equal(h.text.getComposerTextValue(), '');

  const textNode = row.querySelector('.msg-text').firstChild;
  const range = h.document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, 5);
  h.window.getSelection().removeAllRanges();
  h.window.getSelection().addRange(range);
  assert.deepEqual(plain(h.replyEdit.getMessageCopyTextData(row)), { text: 'hello', hasMeaningfulContent: true });
  await h.replyEdit.copyMessageFromRow(row);
  assert.equal(h.replyEdit.__copied, 'hello');
});

test('file controller validates uploads and renders pending files', async (t) => {
  const h = createComposerHarness({ maxAttachments: 1, maxFileSize: 5 });
  t.after(() => h.window.close());

  const small = new h.window.File(['ok'], 'ok.txt', { type: 'text/plain' });
  const second = new h.window.File(['no'], 'two.txt', { type: 'text/plain' });
  const large = new h.window.File(['123456'], 'large.txt', { type: 'text/plain' });

  assert.equal(await h.files.uploadFiles([small, second]), false);
  assert.match(h.alerts.at(-1), /Use up to 1 attachments/);
  assert.equal(await h.files.uploadFiles([large]), false);
  assert.match(h.alerts.at(-1), /File too large/);
  assert.equal(await h.files.uploadFiles([small]), true);
  assert.equal(h.state.getPendingFiles().length, 1);
  assert.equal(h.appDom.pendingFileEl.classList.contains('hidden'), false);
  assert.match(h.appDom.pendingFileEl.textContent, /ok\.txt/);
  h.files.clearPendingFile();
  assert.equal(h.state.getPendingFiles().length, 0);
  assert.equal(h.appDom.pendingFileEl.classList.contains('hidden'), true);
});

test('attach menu routes gallery camera and file actions to separate inputs', (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());

  const clicked = [];
  const galleryInput = h.document.getElementById('fileInputGallery');
  const cameraInput = h.document.getElementById('fileInputCamera');
  const docsInput = h.document.getElementById('fileInputDocs');
  galleryInput.click = () => clicked.push('gallery');
  cameraInput.click = () => clicked.push('camera');
  docsInput.click = () => clicked.push('file');

  h.files.bindAttachMenuEvents();

  h.document.getElementById('attachMenuGallery').click();
  assert.deepEqual(clicked, ['gallery']);

  clicked.length = 0;
  h.document.getElementById('attachMenuCamera').click();
  assert.deepEqual(clicked, ['camera']);

  clicked.length = 0;
  h.document.getElementById('attachMenuFile').click();
  assert.deepEqual(clicked, ['file']);
});

test('send controller queues text payloads and patches edits', async (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());

  h.text.setComposerTextValue('hello');
  await h.send.sendMessage();
  assert.equal(h.outboxItems.length, 1);
  assert.equal(h.triedItems.length, 1);
  assert.equal(h.outboxItems[0].text, 'hello');
  assert.equal(h.text.getComposerTextValue(), '');

  h.state.setEditTo({ id: 44, text: 'old', allowEmpty: false });
  h.text.setComposerTextValue('new');
  await h.send.saveEditedMessage();
  assert.equal(h.apiCalls.at(-1).url, '/api/messages/44');
  assert.equal(h.apiCalls.at(-1).init.method, 'PATCH');
  assert.deepEqual(plain(h.apiCalls.at(-1).init.body), { text: 'new' });
});

test('composer history stores sent text per chat and skips consecutive duplicates', async (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());
  const key = 'bananza:composerHistory:v1:1';

  h.text.setComposerTextValue('first');
  await h.send.sendMessage();
  assert.deepEqual(JSON.parse(h.window.localStorage.getItem(key) || '{}'), { 1: ['first'] });

  h.text.setComposerTextValue('first');
  await h.send.sendMessage();
  assert.deepEqual(JSON.parse(h.window.localStorage.getItem(key) || '{}'), { 1: ['first'] });

  h.text.setComposerTextValue('second');
  await h.send.sendMessage();
  assert.deepEqual(JSON.parse(h.window.localStorage.getItem(key) || '{}'), { 1: ['first', 'second'] });

  h.setCurrentChatId(2);
  h.text.setComposerTextValue('chat two');
  await h.send.sendMessage();
  assert.deepEqual(JSON.parse(h.window.localStorage.getItem(key) || '{}'), {
    1: ['first', 'second'],
    2: ['chat two'],
  });

  h.state.setPendingFiles([{ name: 'only-file.txt', type: 'document' }]);
  await h.send.sendMessage();
  assert.deepEqual(JSON.parse(h.window.localStorage.getItem(key) || '{}'), {
    1: ['first', 'second'],
    2: ['chat two'],
  });
});

test('composer history arrows navigate only from an empty input or active history', (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());
  h.state.addComposerHistoryEntry(1, 'one');
  h.state.addComposerHistoryEntry(1, 'two');
  h.state.addComposerHistoryEntry(2, 'other chat');

  h.text.setComposerTextValue('manual');
  const manualUp = composerKey(h.window, 'ArrowUp');
  assert.equal(h.text.handleComposerHistoryKeydown(manualUp, 1), false);
  assert.equal(h.text.getComposerTextValue(), 'manual');
  assert.equal(manualUp.defaultPrevented, false);

  h.text.setComposerTextValue('');
  const firstUp = composerKey(h.window, 'ArrowUp');
  assert.equal(h.text.handleComposerHistoryKeydown(firstUp, 1), true);
  assert.equal(h.text.getComposerTextValue(), 'two');
  assert.equal(firstUp.defaultPrevented, true);

  assert.equal(h.text.handleComposerHistoryKeydown(composerKey(h.window, 'ArrowUp'), 1), true);
  assert.equal(h.text.getComposerTextValue(), 'one');

  assert.equal(h.text.handleComposerHistoryKeydown(composerKey(h.window, 'ArrowUp'), 1), true);
  assert.equal(h.text.getComposerTextValue(), 'one');

  assert.equal(h.text.handleComposerHistoryKeydown(composerKey(h.window, 'ArrowDown'), 1), true);
  assert.equal(h.text.getComposerTextValue(), 'two');

  assert.equal(h.text.handleComposerHistoryKeydown(composerKey(h.window, 'ArrowDown'), 1), true);
  assert.equal(h.text.getComposerTextValue(), '');
  assert.equal(h.state.composerHistoryNavigation.index, null);

  assert.equal(h.text.handleComposerHistoryKeydown(composerKey(h.window, 'ArrowDown'), 1), false);

  assert.equal(h.text.handleComposerHistoryKeydown(composerKey(h.window, 'ArrowUp'), 2), true);
  assert.equal(h.text.getComposerTextValue(), 'other chat');

  h.text.setComposerTextValue('');
  h.state.resetComposerHistoryNavigation();
  assert.equal(h.text.handleComposerHistoryKeydown(composerKey(h.window, 'ArrowUp', { ctrlKey: true }), 1), false);
});

test('emoji picker opens, switches category, inserts emoji, and remembers recent', async (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());

  await h.emoji.loadRecentEmojis();
  h.emoji.initEmojiPicker();
  assert.ok(h.appDom.emojiPicker.querySelector('.emoji-tab'));
  assert.equal(h.emoji.openEmojiPicker(h.appDom.emojiBtn), true);
  assert.equal(isSurfaceOpen(h.appDom.emojiPicker), true);

  const categories = h.emoji.getEmojiPickerCategories();
  const selected = h.emoji.setEmojiPickerCategory(categories[1], { reposition: false });
  assert.equal(selected, categories[1]);

  h.emoji.setEmojiPickerCategory(categories[0], { reposition: false });
  const item = h.appDom.emojiPicker.querySelector('.emoji-item');
  assert.ok(item);
  const value = item.dataset.emoji;
  item.dispatchEvent(new h.window.MouseEvent('click', { bubbles: true }));
  assert.equal(h.text.getComposerTextValue().includes(value), true);
  assert.deepEqual(plain(h.emoji.loadLocalRecentEmojis().slice(0, 1)), [value]);
  h.emoji.closeEmojiPicker({ immediate: true });
  assert.equal(isSurfaceOpen(h.appDom.emojiPicker), false);
});

test('mention picker opens on @ and inserts mention text', async (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());

  h.text.setComposerTextValue('hi @as');
  h.appDom.msgInput.setSelectionRange(h.appDom.msgInput.value.length, h.appDom.msgInput.value.length);
  await h.mentions.updateMentionPicker();
  const picker = h.document.getElementById('mentionPicker');
  assert.ok(picker);
  assert.equal(isSurfaceOpen(picker), true);
  assert.match(picker.textContent, /assist/);

  h.mentions.insertMentionTarget({ token: 'assist', is_ai_bot: true }, h.state.mentionPickerState);
  assert.equal(h.text.getComposerTextValue(), 'hi @assist ');
});

test('typing sends websocket payload and drop delegates to upload', async (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());

  h.typingDragDrop.sendTyping();
  assert.deepEqual(plain(h.typingPayloads), [{ type: 'typing', chatId: 1 }]);

  const dropped = new h.window.File(['ok'], 'drop.txt', { type: 'text/plain' });
  h.typingDragDrop.handleDrop({
    preventDefault() {},
    dataTransfer: { files: [dropped] },
  });
  await wait(h.window);
  assert.equal(h.state.getPendingFiles()[0].name, 'drop.txt');
});

test('poll composer adds/removes options and submits poll payload', async (t) => {
  const h = createComposerHarness();
  t.after(() => h.window.close());

  h.poll.resetPollComposer();
  h.poll.bindPollComposerEvents();
  h.document.getElementById('pollAddOptionBtn').click();
  assert.equal(h.state.pollComposerOptions.length, 3);
  h.appDom.pollOptionsList.querySelector('[data-poll-option-remove="2"]').click();
  assert.equal(h.state.pollComposerOptions.length, 2);

  h.appDom.pollQuestionInput.value = 'Lunch?';
  h.appDom.pollOptionsList.querySelector('[data-poll-option-index="0"]').value = 'Pizza';
  h.appDom.pollOptionsList.querySelector('[data-poll-option-index="1"]').value = 'Sushi';
  await h.poll.submitPollComposer();
  const call = h.apiCalls.find((item) => item.url === '/api/chats/1/messages');
  assert.ok(call);
  assert.equal(call.init.method, 'POST');
  assert.deepEqual(plain(call.init.body.poll.options), ['Pizza', 'Sushi']);
  assert.equal(call.init.body.text, 'Lunch?');
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
    send(payload) {
      this.lastPayload = payload;
    }
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
    if (/^\/api\/chats\/\d+\/pins$/.test(url.pathname)) return createJsonResponse(dom, { pins: [], events: [] });
    if (/^\/api\/chats\/\d+\/members$/.test(url.pathname)) return createJsonResponse(dom, []);
    if (/^\/api\/chats\/\d+\/mention-targets$/.test(url.pathname)) return createJsonResponse(dom, { users: [] });
    if (/^\/api\/chats\/\d+\/read$/.test(url.pathname)) return createJsonResponse(dom, {});
    if (/^\/api\/chats\/\d+\/context-convert/.test(url.pathname)) return createJsonResponse(dom, { enabled: false, bots: [] });
    if (/^\/api\/chats\/\d+\/chatshot/.test(url.pathname)) return createJsonResponse(dom, { enabled: false, ready: false });
    if (url.pathname === '/api/chats') return createJsonResponse(dom, [{ id: 1, type: 'group', name: 'One', last_message_id: 0, unread_count: 0 }]);
    if (/^\/api\/chats\/\d+\/messages$/.test(url.pathname)) {
      return createJsonResponse(dom, { messages: [], has_more_before: false, has_more_after: false, member_last_reads: {} });
    }
    throw new Error(`Unexpected composer fetch: ${url.pathname}`);
  };
}

async function bootFullApp() {
  const dom = createAppDom();
  installFullAppStubs(dom);
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

test('app bridge exposes composer state and dictation hooks after app boot', async (t) => {
  const dom = await bootFullApp();
  t.after(() => dom.window.close());
  const { document, BananzaAppBridge } = dom.window;

  assert.deepEqual(plain(BananzaAppBridge.getPendingFiles()), []);
  assert.equal(BananzaAppBridge.getReplyTo(), null);
  assert.equal(BananzaAppBridge.getEditTo(), null);
  assert.equal(BananzaAppBridge.insertDictatedText('dictated'), 'dictated');
  assert.equal(document.getElementById('msgInput').value, 'dictated');

  const row = document.createElement('div');
  row.className = 'msg-row';
  row.dataset.msgId = '9';
  row.__messageData = { id: 9, user_id: 2, text: 'reply source', display_name: 'Bob' };
  row.innerHTML = '<div class="msg-text">reply source</div>';
  document.getElementById('messages').appendChild(row);
  BananzaAppBridge.__testing.setReply(9, 'Bob', 'reply source', { id: 9, display_name: 'Bob', text: 'reply source' });
  BananzaAppBridge.updateReplyPreview(9, 'updated reply');
  assert.equal(BananzaAppBridge.getReplyTo().text, 'updated reply');
});

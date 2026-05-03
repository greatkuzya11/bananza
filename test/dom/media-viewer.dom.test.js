const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installVisualViewportMock,
  loadBrowserScript,
  loadBrowserScripts,
  setDocumentHidden,
} = require('../support/domHarness');

const VIDEO_NOTE_SCRIPTS = [
  'public/js/video-notes/video-note-shapes.js',
  'public/js/video-notes/VideoShapeRegistry.js',
  'public/js/video-notes/AudioNoteRecorderAdapter.js',
  'public/js/video-notes/VideoNoteRecorder.js',
  'public/js/video-notes/VideoNoteRenderer.js',
  'public/js/video-notes/MediaNoteComposerController.js',
  'public/js/video-notes/VideoNoteFeature.js',
];

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

  window.__testWebSockets = [];
  window.WebSocket = class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
      this.url = url;
      this.readyState = window.WebSocket.CONNECTING;
      window.__testWebSockets.push(this);
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
      const handled = await fetchHandler({ dom, window, url, input, init });
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
        throw new Error(`Unexpected fetch in media viewer DOM test: ${url.pathname}`);
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
  loadBrowserScript(dom, 'public/js/app.js');
  await ready;
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  return dom;
}

function installProgressSvgMocks(dom, { pathLength = 100 } = {}) {
  const { window } = dom;
  if (window.SVGElement?.prototype) {
    Object.defineProperty(window.SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      writable: true,
      value() {
        return pathLength;
      },
    });
  }
  const originalGetBoundingClientRect = window.Element.prototype.getBoundingClientRect;
  const buildRect = (width, height) => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON() {
      return this;
    },
  });
  window.Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
    if (this instanceof window.HTMLElement && this.classList.contains('msg-bubble')) {
      return buildRect(248, 104);
    }
    return originalGetBoundingClientRect.call(this);
  };
}

function installMockMediaElement(dom, mediaEl, initialState = {}) {
  assert.ok(mediaEl, 'Expected a media element to mock');
  const { window } = dom;
  const state = {
    duration: Number(initialState.duration ?? 0) || 0,
    currentTime: Number(initialState.currentTime ?? 0) || 0,
    paused: Object.prototype.hasOwnProperty.call(initialState, 'paused') ? Boolean(initialState.paused) : true,
    ended: Boolean(initialState.ended),
    readyState: Number(initialState.readyState ?? 0) || 0,
  };

  Object.defineProperty(mediaEl, 'duration', {
    configurable: true,
    get() {
      return state.duration;
    },
    set(value) {
      state.duration = Number(value || 0) || 0;
    },
  });
  Object.defineProperty(mediaEl, 'currentTime', {
    configurable: true,
    get() {
      return state.currentTime;
    },
    set(value) {
      state.currentTime = Number(value || 0) || 0;
    },
  });
  Object.defineProperty(mediaEl, 'paused', {
    configurable: true,
    get() {
      return state.paused;
    },
    set(value) {
      state.paused = Boolean(value);
    },
  });
  Object.defineProperty(mediaEl, 'ended', {
    configurable: true,
    get() {
      return state.ended;
    },
    set(value) {
      state.ended = Boolean(value);
    },
  });
  Object.defineProperty(mediaEl, 'readyState', {
    configurable: true,
    get() {
      return state.readyState;
    },
    set(value) {
      state.readyState = Number(value || 0) || 0;
    },
  });
  mediaEl.load = () => {};
  mediaEl.play = () => {
    state.paused = false;
    state.ended = false;
    mediaEl.dispatchEvent(new window.Event('play'));
    return Promise.resolve();
  };
  mediaEl.pause = () => {
    state.paused = true;
    mediaEl.dispatchEvent(new window.Event('pause'));
  };
  return state;
}

function getDasharrayFilledLength(node) {
  const raw = String(node?.getAttribute?.('stroke-dasharray') || '').trim();
  const [filled] = raw.split(/[\s,]+/).map((part) => Number(part || 0));
  return filled;
}

async function waitForViewportRecovery(dom, delayMs = 240) {
  await new Promise((resolve) => dom.window.setTimeout(resolve, delayMs));
}

async function wait(dom, delayMs = 0) {
  await new Promise((resolve) => dom.window.setTimeout(resolve, delayMs));
}

async function openMobileKeyboard(dom, input, { height = 420 } = {}) {
  input.focus();
  dom.visualViewportMock.setAndDispatch('resize', { height });
  await wait(dom, 30);
}

function emitWsMessage(dom, payload) {
  const sockets = Array.isArray(dom.window.__testWebSockets) ? dom.window.__testWebSockets : [];
  const socket = sockets[sockets.length - 1];
  assert.ok(socket, 'Expected a fake WebSocket instance');
  socket.onmessage?.({ data: JSON.stringify(payload) });
}

function getMobileSceneSnapshot(dom) {
  return dom.window.BananzaAppBridge.__testing.getMobileBaseSceneSnapshot();
}

function getMediaViewerState(dom) {
  return dom.window.BananzaAppBridge.__testing.getMediaViewerState();
}

function assertNear(actual, expected, tolerance = 1e-6, label = 'value') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
  );
}

function assertMobileScene(dom, scene) {
  const snapshot = getMobileSceneSnapshot(dom);
  assert.equal(snapshot.scene, scene);
  if (scene === 'sidebar') {
    assert.equal(snapshot.sidebar.mobileSceneHidden, false);
    assert.equal(snapshot.sidebar.sidebarHidden, false);
    assert.equal(snapshot.sidebar.inert, false);
    assert.equal(snapshot.chatArea.mobileSceneHidden, true);
    assert.equal(snapshot.chatArea.inert, true);
  } else {
    assert.equal(snapshot.sidebar.sidebarHidden, true);
    assert.equal(snapshot.sidebar.mobileSceneHidden, true);
    assert.equal(snapshot.sidebar.inert, true);
    assert.equal(snapshot.chatArea.mobileSceneHidden, false);
    assert.equal(snapshot.chatArea.inert, false);
  }
}

function createTouchPoint({ clientX = 0, clientY = 0, identifier = 1 } = {}) {
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

function createTouchStartEvent(window, { clientX = 0, clientY = 0, identifier = 1 } = {}) {
  const touchPoint = createTouchPoint({ identifier, clientX, clientY });
  return createTouchEvent(window, 'touchstart', {
    touches: [touchPoint],
    changedTouches: [touchPoint],
  });
}

function createTouchEndEvent(window, { clientX = 0, clientY = 0, identifier = 1 } = {}) {
  return createTouchEvent(window, 'touchend', {
    touches: [],
    changedTouches: [createTouchPoint({ identifier, clientX, clientY })],
  });
}

function createPrimaryPointerEvent(
  window,
  type = 'pointerdown',
  {
    pointerType = 'touch',
    pointerId = 1,
    clientX = 0,
    clientY = 0,
  } = {}
) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'button', {
    configurable: true,
    value: 0,
  });
  Object.defineProperty(event, 'pointerType', {
    configurable: true,
    value: pointerType,
  });
  Object.defineProperty(event, 'pointerId', {
    configurable: true,
    value: pointerId,
  });
  Object.defineProperty(event, 'clientX', {
    configurable: true,
    value: clientX,
  });
  Object.defineProperty(event, 'clientY', {
    configurable: true,
    value: clientY,
  });
  return event;
}

function dispatchPointerTap(window, target, { emitClick = false, pointerType = 'touch' } = {}) {
  const pointerDown = createPrimaryPointerEvent(window, 'pointerdown', { pointerType });
  const pointerUp = createPrimaryPointerEvent(window, 'pointerup', { pointerType });
  target.dispatchEvent(pointerDown);
  target.dispatchEvent(pointerUp);
  if (emitClick) {
    target.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }));
  }
  return { pointerDown, pointerUp };
}

function dispatchTouchTap(window, target, { emitClick = false } = {}) {
  const touchStart = createTouchStartEvent(window);
  const touchEnd = createTouchEndEvent(window);
  target.dispatchEvent(touchStart);
  target.dispatchEvent(touchEnd);
  if (emitClick) {
    target.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }));
  }
  return { touchStart, touchEnd };
}

function appendMessageRow(dom, {
  id = 101,
  userId = 2,
  text = 'Hello from the test row',
} = {}) {
  const { document } = dom.window;
  const messagesEl = document.getElementById('messages');
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.dataset.msgId = String(id);
  row.innerHTML = `
    <div class="msg-content">
      <div class="msg-bubble">
        <div class="msg-text">${text}</div>
        <div class="msg-actions">
          <button type="button" class="msg-react-btn">🙂</button>
        </div>
      </div>
    </div>
  `;
  row.__messageData = {
    id,
    user_id: userId,
    text,
    is_deleted: false,
    created_at: '2026-04-28T12:00:00.000Z',
  };
  row.__replyPayload = {
    id,
    display_name: 'Bob',
    text,
  };
  messagesEl.appendChild(row);
  return row;
}

function appendImageMessageRow(dom, {
  id = 101,
  userId = 2,
  text = 'Image test row',
  src = `https://example.com/image-${id}.jpg`,
} = {}) {
  const row = appendMessageRow(dom, { id, userId, text });
  const bubble = row.querySelector('.msg-bubble');
  bubble.insertAdjacentHTML(
    'beforeend',
    `<img class="msg-image" src="${src}" alt="Image ${id}">`
  );
  row.__messageData.file_type = 'image';
  row.__messageData.file_name = `image-${id}.jpg`;
  row.__messageData.file_mime = 'image/jpeg';
  return row;
}

function installMessagesViewportMock(dom, {
  viewportTop = 100,
  viewportHeight = 240,
  viewportWidth = 320,
  rowHeight = 60,
} = {}) {
  const { window } = dom;
  const { document } = window;
  const messagesEl = document.getElementById('messages');
  const chatArea = document.getElementById('chatArea');
  const originalGetBoundingClientRect = window.Element.prototype.getBoundingClientRect;
  let scrollTop = 0;

  const getRows = () => [...messagesEl.querySelectorAll('.msg-row[data-msg-id]')];
  const getContentHeight = () => getRows().length * rowHeight;
  const getMaxScrollTop = () => Math.max(0, getContentHeight() - viewportHeight);
  const clampScrollTop = (value) => Math.max(0, Math.min(getMaxScrollTop(), Number(value) || 0));
  const isChatSceneHidden = () => Boolean(
    window.innerWidth <= 768
    && chatArea instanceof window.HTMLElement
    && (chatArea.classList.contains('mobile-scene-hidden') || chatArea.hasAttribute('inert'))
  );
  const buildRect = (top, height = rowHeight, width = viewportWidth) => ({
    x: 0,
    y: top,
    top,
    left: 0,
    right: width,
    bottom: top + height,
    width,
    height,
    toJSON() {
      return this;
    },
  });

  Object.defineProperty(messagesEl, 'clientHeight', {
    configurable: true,
    get() {
      return isChatSceneHidden() ? 0 : viewportHeight;
    },
  });
  Object.defineProperty(messagesEl, 'offsetHeight', {
    configurable: true,
    get() {
      return isChatSceneHidden() ? 0 : viewportHeight;
    },
  });
  Object.defineProperty(messagesEl, 'clientWidth', {
    configurable: true,
    get() {
      return isChatSceneHidden() ? 0 : viewportWidth;
    },
  });
  Object.defineProperty(messagesEl, 'offsetWidth', {
    configurable: true,
    get() {
      return isChatSceneHidden() ? 0 : viewportWidth;
    },
  });
  Object.defineProperty(messagesEl, 'scrollHeight', {
    configurable: true,
    get() {
      return isChatSceneHidden() ? 0 : getContentHeight();
    },
  });
  Object.defineProperty(messagesEl, 'scrollTop', {
    configurable: true,
    get() {
      return scrollTop;
    },
    set(value) {
      scrollTop = clampScrollTop(value);
    },
  });
  messagesEl.scrollTo = (optionsOrTop, maybeTop) => {
    if (typeof optionsOrTop === 'object' && optionsOrTop) {
      messagesEl.scrollTop = optionsOrTop.top;
      return;
    }
    messagesEl.scrollTop = maybeTop ?? optionsOrTop;
  };
  messagesEl.getBoundingClientRect = () => (
    isChatSceneHidden()
      ? buildRect(0, 0, 0)
      : buildRect(viewportTop, viewportHeight, viewportWidth)
  );

  window.Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
    if (this === messagesEl) {
      return isChatSceneHidden()
        ? buildRect(0, 0, 0)
        : buildRect(viewportTop, viewportHeight, viewportWidth);
    }
    if (this instanceof window.HTMLElement && this.classList.contains('msg-row') && messagesEl.contains(this)) {
      if (isChatSceneHidden()) return buildRect(0, 0, 0);
      const rowIndex = getRows().indexOf(this);
      if (rowIndex >= 0) {
        const top = viewportTop + (rowIndex * rowHeight) - scrollTop;
        return buildRect(top, rowHeight, viewportWidth);
      }
    }
    return originalGetBoundingClientRect.call(this);
  };

  return {
    messagesEl,
    get scrollTop() {
      return scrollTop;
    },
    setScrollTop(value) {
      messagesEl.scrollTop = value;
      return scrollTop;
    },
    getBottomScrollTop() {
      return getMaxScrollTop();
    },
    rowHeight,
    viewportHeight,
  };
}

function createChatFixture(chatId, name, { lastMessageId = chatId * 100 + 12, ...overrides } = {}) {
  return {
    id: chatId,
    name,
    type: 'group',
    last_message_id: lastMessageId,
    last_read_id: lastMessageId,
    first_unread_id: null,
    unread_count: 0,
    created_by: 1,
    members: [],
    notify_enabled: 1,
    sounds_enabled: 1,
    allow_unpin_any_pin: 0,
    avatar_url: '',
    avatar_color: '#5eb5f7',
    ...overrides,
  };
}

function createChatMessages(chatId, count, { startId = chatId * 100 } = {}) {
  return Array.from({ length: count }, (_, index) => {
    const id = startId + index + 1;
    return {
      id,
      chat_id: chatId,
      user_id: index % 2 === 0 ? 2 : 1,
      display_name: index % 2 === 0 ? 'Bob' : 'Alice',
      avatar_color: index % 2 === 0 ? '#7bc862' : '#5eb5f7',
      avatar_url: '',
      text: `Chat ${chatId} message ${index + 1}`,
      file_id: null,
      file_name: null,
      file_stored: null,
      file_type: null,
      file_mime: null,
      file_size: 0,
      created_at: `2026-04-29T12:${String(index).padStart(2, '0')}:00.000Z`,
      is_deleted: 0,
      is_voice_note: 0,
      is_video_note: 0,
      mentions: [],
      reactions: [],
      reply_to_id: null,
      reply_text: null,
      reply_is_voice_note: 0,
      poll: null,
      forwarded_from_chat_id: null,
      forwarded_from_message_id: null,
      ai_generated: 0,
      ai_bot_id: 0,
      client_status: null,
    };
  });
}

function createIncomingMessage(chatId, messageId, overrides = {}) {
  return {
    id: messageId,
    chat_id: chatId,
    user_id: 2,
    display_name: 'Bob',
    avatar_color: '#7bc862',
    avatar_url: '',
    text: `Incoming message ${messageId}`,
    file_id: null,
    file_name: null,
    file_stored: null,
    file_type: null,
    file_mime: null,
    file_size: 0,
    created_at: '2026-04-29T21:05:00.000Z',
    is_deleted: 0,
    is_voice_note: 0,
    is_video_note: 0,
    mentions: [],
    reactions: [],
    reply_to_id: null,
    reply_text: null,
    reply_is_voice_note: 0,
    poll: null,
    forwarded_from_chat_id: null,
    forwarded_from_message_id: null,
    ai_generated: 0,
    ai_bot_id: 0,
    client_status: null,
    ...overrides,
  };
}

function createVoiceNoteMessage(chatId, messageId, overrides = {}) {
  return createIncomingMessage(chatId, messageId, {
    text: '',
    file_id: 800 + Number(messageId || 0),
    file_name: `voice-${messageId}.ogg`,
    file_stored: `voice-${messageId}.ogg`,
    file_type: 'audio',
    file_mime: 'audio/ogg',
    file_size: 2_048,
    is_voice_note: 1,
    is_video_note: 0,
    voice_duration_ms: 24_000,
    media_note_duration_ms: 24_000,
    transcription_status: 'idle',
    transcription_text: '',
    transcription_provider: '',
    transcription_model: '',
    transcription_error: '',
    ...overrides,
  });
}

function createVideoNoteMessage(chatId, messageId, overrides = {}) {
  return createIncomingMessage(chatId, messageId, {
    text: '',
    file_id: 1_200 + Number(messageId || 0),
    file_name: `video-note-${messageId}.webm`,
    file_stored: `video-note-${messageId}.webm`,
    file_type: 'video',
    file_mime: 'video/webm',
    file_size: 4_096,
    file_poster_available: true,
    is_voice_note: 1,
    is_video_note: 1,
    voice_duration_ms: 18_000,
    media_note_duration_ms: 18_000,
    video_note_shape_id: 'banana-fat',
    video_note_shape_snapshot: null,
    transcription_status: 'idle',
    transcription_text: '',
    transcription_provider: '',
    transcription_model: '',
    transcription_error: '',
    ...overrides,
  });
}

function createVideoMessage(chatId, messageId, overrides = {}) {
  return createIncomingMessage(chatId, messageId, {
    text: `Video message ${messageId}`,
    file_id: 500 + Number(messageId || 0),
    file_name: `clip-${messageId}.mp4`,
    file_stored: `clip-${messageId}.mp4`,
    file_type: 'video',
    file_mime: 'video/mp4',
    file_size: 1_024,
    file_poster_available: true,
    ...overrides,
  });
}

function createChatFetchHandler(chatMessagesByChatId) {
  return ({ dom, url }) => {
    const messagesMatch = url.pathname.match(/^\/api\/chats\/(\d+)\/messages$/);
    if (messagesMatch) {
      const chatId = Number(messagesMatch[1]);
      const messages = chatMessagesByChatId[chatId] || [];
      return createJsonResponse(dom, {
        messages,
        pin_events: [],
        has_more_before: false,
        has_more_after: false,
        member_last_reads: [],
      });
    }
    const pinsMatch = url.pathname.match(/^\/api\/chats\/(\d+)\/pins$/);
    if (pinsMatch) {
      return createJsonResponse(dom, []);
    }
    return null;
  };
}

function createComposerInteractionFetchHandler({
  chatMessagesByChatId = {},
  mentionTargetsByChatId = {},
  contextConvertAvailabilityByChatId = {},
} = {}) {
  const chatFetchHandler = createChatFetchHandler(chatMessagesByChatId);
  return ({ dom, window, url, input, init }) => {
    const handled = chatFetchHandler({ dom, window, url, input, init });
    if (handled) return handled;
    const mentionMatch = url.pathname.match(/^\/api\/chats\/(\d+)\/mention-targets$/);
    if (mentionMatch) {
      const chatId = Number(mentionMatch[1]);
      return createJsonResponse(dom, {
        targets: mentionTargetsByChatId[chatId] || [],
      });
    }
    const contextConvertBotsMatch = url.pathname.match(/^\/api\/chats\/(\d+)\/context-convert-bots$/);
    if (contextConvertBotsMatch) {
      const chatId = Number(contextConvertBotsMatch[1]);
      return createJsonResponse(dom, contextConvertAvailabilityByChatId[chatId] || {
        enabled: false,
        bots: [],
      });
    }
    const transformMatch = url.pathname.match(/^\/api\/chats\/(\d+)\/context-convert$/);
    if (transformMatch && String(init?.method || '').toUpperCase() === 'POST') {
      return createJsonResponse(dom, { text: 'Converted text' });
    }
    return null;
  };
}

function createMediaPlaybackFetchHandler({
  chatMessagesByChatId = {},
  mentionTargetsByChatId = {},
  contextConvertAvailabilityByChatId = {},
  features = {},
} = {}) {
  const composerHandler = createComposerInteractionFetchHandler({
    chatMessagesByChatId,
    mentionTargetsByChatId,
    contextConvertAvailabilityByChatId,
  });
  return ({ dom, window, url, input, init }) => {
    if (url.pathname === '/api/features') {
      return createJsonResponse(dom, {
        voice_notes_enabled: true,
        auto_transcribe_on_send: false,
        voice_note_ui_mode: 'compact',
        ...features,
      });
    }
    return composerHandler({ dom, window, url, input, init });
  };
}

async function openSingleChatDom({
  chat = createChatFixture(1, 'Chat A'),
  chatMessagesByChatId = null,
  mentionTargetsByChatId = {},
  contextConvertAvailabilityByChatId = {},
} = {}) {
  const chatId = Number(chat.id || 1);
  const dom = await bootAppDom({
    fetchHandler: createComposerInteractionFetchHandler({
      chatMessagesByChatId: chatMessagesByChatId || { [chatId]: [] },
      mentionTargetsByChatId,
      contextConvertAvailabilityByChatId,
    }),
  });
  dom.window.BananzaAppBridge.__testing.setChats([chat]);
  await dom.window.BananzaAppBridge.__testing.openChat(chatId);
  await wait(dom, 60);
  return dom;
}

async function openMediaPlaybackDom({
  activeChat = createChatFixture(1, 'Chat A'),
  chats = null,
  chatMessagesByChatId = null,
  features = {},
} = {}) {
  const allChats = Array.isArray(chats) && chats.length
    ? chats
    : [activeChat, createChatFixture(2, 'Chat B', { lastMessageId: 0 })];
  const dom = await bootAppDom({
    fetchHandler: createMediaPlaybackFetchHandler({
      chatMessagesByChatId: chatMessagesByChatId || { [Number(activeChat.id || 1)]: [] },
      features,
    }),
  });
  installProgressSvgMocks(dom);
  dom.window.HTMLMediaElement.prototype.load = function load() {};
  dom.window.HTMLMediaElement.prototype.play = function play() {
    return Promise.resolve();
  };
  dom.window.HTMLMediaElement.prototype.pause = function pause() {};
  loadBrowserScript(dom, 'public/js/messageCache.js');
  await dom.window.messageCache.init(1);
  await dom.window.messageCache.clearUserCache();
  await dom.window.messageCache.init(1);
  loadBrowserScript(dom, 'public/js/voice.js');
  loadBrowserScripts(dom, VIDEO_NOTE_SCRIPTS);
  await wait(dom, 60);
  dom.window.BananzaAppBridge.__testing.setChats(allChats);
  await dom.window.BananzaAppBridge.__testing.openChat(Number(activeChat.id || 1));
  await wait(dom, 120);
  return dom;
}

function createReadTrackingFetchHandler(chatMessagesByChatId, initialChats = []) {
  const chatFetchHandler = createChatFetchHandler(chatMessagesByChatId);
  const chatRows = (Array.isArray(initialChats) ? initialChats : []).map((chat) => ({ ...chat }));
  const readCalls = [];
  return {
    readCalls,
    handler: ({ dom, window, url, input, init }) => {
      if (url.pathname === '/api/chats') {
        return createJsonResponse(dom, chatRows.map((chat) => ({ ...chat })));
      }
      const handled = chatFetchHandler({ dom, window, url, input, init });
      if (handled) return handled;
      const readMatch = url.pathname.match(/^\/api\/chats\/(\d+)\/read$/);
      if (!readMatch) return null;
      let payload = {};
      if (typeof init?.body === 'string' && init.body) {
        try {
          payload = JSON.parse(init.body);
        } catch {}
      } else if (init?.body && typeof init.body === 'object') {
        payload = init.body;
      }
      readCalls.push({
        chatId: Number(readMatch[1]),
        lastReadId: Number(payload?.lastReadId || 0),
      });
      const chat = chatRows.find((row) => Number(row.id) === Number(readMatch[1]));
      if (chat) {
        chat.last_read_id = Math.max(Number(chat.last_read_id || 0), Number(payload?.lastReadId || 0));
        if (!chat.last_message_id || Number(chat.last_read_id || 0) >= Number(chat.last_message_id || 0)) {
          chat.unread_count = 0;
          chat.first_unread_id = null;
        }
      }
      return createJsonResponse(dom, { ok: true });
    },
  };
}

test('media viewer close suppresses follow-up click-through to settings', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const imageViewer = document.getElementById('imageViewer');
  const closeBtn = imageViewer.querySelector('.iv-close');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');

  imageViewer.classList.remove('hidden');
  const touchEnd = createTouchEndEvent(dom.window, { clientX: 12, clientY: 12 });
  closeBtn.dispatchEvent(touchEnd);

  assert.equal(imageViewer.classList.contains('hidden'), true);

  settingsBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  assert.equal(settingsModal.classList.contains('hidden'), true);
});

test('settings button still opens settings without preceding media-viewer close', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');

  settingsBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  assert.equal(settingsModal.classList.contains('hidden'), false);
});

test('off-center pinch keeps the fullscreen image anchored under the fingers', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const slideMidX = 190;
  const slideMidY = 650;
  const startTouches = [
    createTouchPoint({ identifier: 1, clientX: 120, clientY: 620 }),
    createTouchPoint({ identifier: 2, clientX: 260, clientY: 680 }),
  ];
  const moveTouches = [
    createTouchPoint({ identifier: 1, clientX: 90, clientY: 590 }),
    createTouchPoint({ identifier: 2, clientX: 290, clientY: 710 }),
  ];

  BananzaAppBridge.__testing.openMediaViewer('https://example.com/pinch-test.jpg', 'image');
  await wait(dom, 0);

  const slide = document.querySelector('#ivStrip .iv-slide');
  assert.ok(slide, 'Expected an image slide in the media viewer');

  slide.dispatchEvent(createTouchEvent(dom.window, 'touchstart', { touches: startTouches }));
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchmove', { touches: moveTouches }));

  const state = getMediaViewerState(dom);
  const baseDist = Math.hypot(
    startTouches[1].clientX - startTouches[0].clientX,
    startTouches[1].clientY - startTouches[0].clientY
  );
  const nextDist = Math.hypot(
    moveTouches[1].clientX - moveTouches[0].clientX,
    moveTouches[1].clientY - moveTouches[0].clientY
  );
  const expectedScale = nextDist / baseDist;
  const viewerCenterX = dom.window.innerWidth / 2;
  const viewerCenterY = dom.window.innerHeight / 2;
  const expectedPanX = slideMidX - viewerCenterX - (slideMidX - viewerCenterX) * expectedScale;
  const expectedPanY = slideMidY - viewerCenterY - (slideMidY - viewerCenterY) * expectedScale;
  const anchoredX = viewerCenterX + (slideMidX - viewerCenterX) * state.scale + state.panX;
  const anchoredY = viewerCenterY + (slideMidY - viewerCenterY) * state.scale + state.panY;

  assertNear(state.scale, expectedScale, 1e-6, 'scale');
  assertNear(state.panX, expectedPanX, 1e-6, 'panX');
  assertNear(state.panY, expectedPanY, 1e-6, 'panY');
  assertNear(anchoredX, slideMidX, 1e-6, 'anchoredX');
  assertNear(anchoredY, slideMidY, 1e-6, 'anchoredY');
  assert.match(state.transform, /translate3d\(.+\) scale\(/);
});

test('double tap zoom targets the tapped area in the fullscreen media viewer', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const tapX = 96;
  const tapY = 680;
  const expectedScale = 2.5;

  BananzaAppBridge.__testing.openMediaViewer('https://example.com/double-tap-test.jpg', 'image');
  await wait(dom, 0);

  const slide = document.querySelector('#ivStrip .iv-slide');
  assert.ok(slide, 'Expected an image slide in the media viewer');
  slide.dispatchEvent(new dom.window.MouseEvent('dblclick', {
    bubbles: true,
    cancelable: true,
    clientX: tapX,
    clientY: tapY,
  }));

  const state = getMediaViewerState(dom);
  const viewerCenterX = dom.window.innerWidth / 2;
  const viewerCenterY = dom.window.innerHeight / 2;
  const expectedPanX = (tapX - viewerCenterX) * (1 - expectedScale);
  const expectedPanY = (tapY - viewerCenterY) * (1 - expectedScale);
  const anchoredX = viewerCenterX + (tapX - viewerCenterX) * state.scale + state.panX;
  const anchoredY = viewerCenterY + (tapY - viewerCenterY) * state.scale + state.panY;

  assertNear(state.scale, expectedScale, 1e-6, 'scale');
  assertNear(state.panX, expectedPanX, 1e-6, 'panX');
  assertNear(state.panY, expectedPanY, 1e-6, 'panY');
  assertNear(anchoredX, tapX, 1e-6, 'anchoredX');
  assertNear(anchoredY, tapY, 1e-6, 'anchoredY');
});

test('dragging a zoomed image pans it without moving the gallery strip', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  BananzaAppBridge.__testing.openMediaViewer('https://example.com/pan-test.jpg', 'image');
  await wait(dom, 0);

  const slide = document.querySelector('#ivStrip .iv-slide');
  const strip = document.getElementById('ivStrip');
  assert.ok(slide, 'Expected an image slide in the media viewer');

  slide.dispatchEvent(new dom.window.MouseEvent('dblclick', {
    bubbles: true,
    cancelable: true,
    clientX: 220,
    clientY: 520,
  }));
  const beforePan = getMediaViewerState(dom);

  const startTouch = createTouchPoint({ identifier: 11, clientX: 220, clientY: 520 });
  const movedTouch = createTouchPoint({ identifier: 11, clientX: 260, clientY: 565 });
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchstart', { touches: [startTouch] }));
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchmove', { touches: [movedTouch] }));

  const state = getMediaViewerState(dom);
  assertNear(state.panX, beforePan.panX + 40, 1e-6, 'panX');
  assertNear(state.panY, beforePan.panY + 45, 1e-6, 'panY');
  assert.equal(strip.style.transform, 'translateX(0px)');
});

test('gallery swipe stays disabled while zoomed, and navigation resets zoom state', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const firstSrc = 'https://example.com/gallery-1.jpg';
  const secondSrc = 'https://example.com/gallery-2.jpg';

  appendImageMessageRow(dom, { id: 301, src: firstSrc, text: 'Gallery one' });
  appendImageMessageRow(dom, { id: 302, src: secondSrc, text: 'Gallery two' });

  BananzaAppBridge.__testing.openMediaViewer(firstSrc, 'image');
  await wait(dom, 0);

  let slide = document.querySelector('#ivStrip .iv-slide');
  const strip = document.getElementById('ivStrip');
  const nextBtn = document.querySelector('.iv-next');
  assert.ok(slide, 'Expected the first gallery slide to render');
  assert.ok(nextBtn, 'Expected a next button for multi-image galleries');

  slide.dispatchEvent(new dom.window.MouseEvent('dblclick', {
    bubbles: true,
    cancelable: true,
    clientX: 250,
    clientY: 520,
  }));
  let state = getMediaViewerState(dom);
  assert.ok(state.scale > 1, 'Expected the image to be zoomed in before the swipe');

  const swipeStart = createTouchPoint({ identifier: 21, clientX: 300, clientY: 500 });
  const swipeMove = createTouchPoint({ identifier: 21, clientX: 160, clientY: 500 });
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchstart', { touches: [swipeStart] }));
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchmove', { touches: [swipeMove] }));
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchend', {
    touches: [],
    changedTouches: [swipeMove],
  }));
  state = getMediaViewerState(dom);
  assert.ok(state.scale > 1, 'Expected swipe navigation to stay disabled while zoomed');
  assert.equal(strip.style.transform, 'translateX(0px)');

  nextBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 0);

  state = getMediaViewerState(dom);
  assert.equal(strip.style.transform, 'translateX(-390px)');
  assert.equal(state.scale, 1);
  assert.equal(state.panX, 0);
  assert.equal(state.panY, 0);

  BananzaAppBridge.__testing.closeMediaViewer();
  state = getMediaViewerState(dom);
  assert.equal(state.scale, 1);
  assert.equal(state.panX, 0);
  assert.equal(state.panY, 0);
  assert.equal(state.transform, '');

  BananzaAppBridge.__testing.openMediaViewer(firstSrc, 'image');
  await wait(dom, 0);

  slide = document.querySelector('#ivStrip .iv-slide');
  assert.ok(slide, 'Expected the first gallery slide after reopening the viewer');
  const swipeAtScaleOneStart = createTouchPoint({ identifier: 31, clientX: 280, clientY: 500 });
  const swipeAtScaleOneMove = createTouchPoint({ identifier: 31, clientX: 180, clientY: 500 });
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchstart', { touches: [swipeAtScaleOneStart] }));
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchmove', { touches: [swipeAtScaleOneMove] }));
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchend', {
    touches: [],
    changedTouches: [swipeAtScaleOneMove],
  }));
  await wait(dom, 0);

  assert.equal(strip.style.transform, 'translateX(-390px)');
  state = getMediaViewerState(dom);
  assert.equal(state.scale, 1);
  assert.equal(state.panX, 0);
  assert.equal(state.panY, 0);
});

test('app resume recovers stale mobile viewport height without a final resize event', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');

  assert.equal(app.style.height, '844px');

  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await new Promise((resolve) => dom.window.setTimeout(resolve, 30));
  assert.equal(app.style.height, '420px');

  dom.visualViewportMock.set({ height: 844 });
  dom.window.dispatchEvent(new dom.window.Event('focus'));
  await waitForViewportRecovery(dom);

  assert.equal(app.style.height, '844px');
});

test('uploading media recovers stale mobile viewport height without a final resize event', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const fileInputGallery = document.getElementById('fileInputGallery');
  const pendingFile = document.getElementById('pendingFile');

  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await new Promise((resolve) => dom.window.setTimeout(resolve, 30));
  assert.equal(app.style.height, '420px');

  dom.visualViewportMock.set({ height: 844 });
  Object.defineProperty(fileInputGallery, 'files', {
    configurable: true,
    value: [new dom.window.File(['image'], 'photo.jpg', { type: 'image/jpeg' })],
  });
  fileInputGallery.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await waitForViewportRecovery(dom);

  assert.equal(app.style.height, '844px');
  assert.equal(pendingFile.classList.contains('hidden'), false);
});

test('emoji picker keeps the mobile composer attached when the keyboard is already open', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const originalFocus = msgInput.focus.bind(msgInput);
  let focusCalls = 0;

  msgInput.focus = (...args) => {
    focusCalls += 1;
    const result = originalFocus(...args);
    dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
    return result;
  };

  originalFocus();
  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await wait(dom, 30);
  assert.equal(app.style.height, '420px');

  const mouseDown = new dom.window.MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
  });
  emojiBtn.dispatchEvent(mouseDown);
  assert.equal(mouseDown.defaultPrevented, true);

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  dom.window.setTimeout(() => {
    msgInput.blur();
    dom.visualViewportMock.setAndDispatch('resize', { height: 844 });
  }, 25);
  await waitForViewportRecovery(dom, 320);

  assert.equal(emojiPicker.classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
  assert.ok(focusCalls >= 1);
});

test('emoji picker inserts emoji without focusing the composer when the keyboard is closed', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const msgInput = document.getElementById('msgInput');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  let focusCalls = 0;
  msgInput.focus = () => {
    focusCalls += 1;
  };

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));

  const firstEmoji = emojiPicker.querySelector('.emoji-item');
  assert.ok(firstEmoji, 'Expected at least one emoji item in the picker');

  firstEmoji.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  assert.notEqual(msgInput.value, '');
  assert.equal(focusCalls, 0);
  assert.notEqual(document.activeElement, msgInput);
});

test('search button opens on touchend, survives the synthetic click and focuses the mobile search input', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchPanel = document.getElementById('searchPanel');
  const searchInput = document.getElementById('searchInput');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  assert.equal(app.style.height, '420px');

  const { touchStart } = dispatchTouchTap(dom.window, searchBtn, { emitClick: true });
  await wait(dom, 80);

  assert.equal(touchStart.defaultPrevented, true);
  assert.equal(searchPanel.getAttribute('aria-hidden'), 'false');
  assert.equal(document.activeElement, searchInput);
  assert.equal(app.style.height, '420px');
  assertMobileScene(dom, 'chat');
});

test('chat info button opens on pointerup without a synthetic click and dismisses the mobile keyboard', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const chatInfoBtn = document.getElementById('chatInfoBtn');
  const chatInfoModal = document.getElementById('chatInfoModal');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  assert.equal(app.style.height, '420px');

  const { pointerDown } = dispatchPointerTap(dom.window, chatInfoBtn);
  dom.visualViewportMock.set({ height: 844 });
  await waitForViewportRecovery(dom, 320);

  assert.equal(pointerDown.defaultPrevented, true);
  assert.equal(chatInfoModal.classList.contains('hidden'), false);
  assert.equal(app.style.height, '844px');
  assert.notEqual(document.activeElement, msgInput);
});

test('mention picker opens on pointerup without a synthetic click and keeps the mobile composer attached', async (t) => {
  const dom = await openSingleChatDom({
    mentionTargetsByChatId: {
      1: [
        { user_id: 2, username: 'bob', token: 'bob', display_name: 'Bob', avatar_color: '#7bc862' },
      ],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const mentionOpenBtn = document.getElementById('mentionOpenBtn');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);

  dispatchPointerTap(dom.window, mentionOpenBtn);
  await wait(dom, 80);

  const mentionPicker = document.getElementById('mentionPicker');
  assert.ok(mentionPicker, 'Expected mention picker to be created');
  assert.equal(mentionPicker.classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('attach button opens on touchend without a synthetic click and keeps the mobile composer attached', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const attachBtn = document.getElementById('attachBtn');
  const attachMenu = document.getElementById('attachMenu');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);

  const { touchStart } = dispatchTouchTap(dom.window, attachBtn);
  await wait(dom, 40);

  assert.equal(touchStart.defaultPrevented, true);
  assert.equal(attachMenu.classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('composer context convert opens on pointerup without a synthetic click and keeps the mobile composer attached', async (t) => {
  const dom = await openSingleChatDom({
    chat: createChatFixture(1, 'Chat A', { context_transform_enabled: 1 }),
    contextConvertAvailabilityByChatId: {
      1: {
        enabled: true,
        bots: [{ id: 7, name: 'Banana Convert', provider: 'openai' }],
      },
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const composerContextConvertBtn = document.getElementById('composerContextConvertBtn');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  msgInput.value = 'Draft to convert';
  msgInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await wait(dom, 80);

  assert.equal(composerContextConvertBtn.classList.contains('hidden'), false);

  dispatchPointerTap(dom.window, composerContextConvertBtn);
  await wait(dom, 80);

  const picker = document.getElementById('contextConvertPicker');
  assert.ok(picker, 'Expected context convert picker to be created');
  assert.equal(picker.classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('context convert all-chat admin toggle is inactive when the bot is disabled', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  BananzaAppBridge.__testing.setContextConvertAdminState('openai', {
    bots: [{
      id: 77,
      name: 'Global Convert',
      enabled: false,
      available_in_all_chats: true,
      response_model: 'gpt-4o-mini',
      transform_prompt: 'Rewrite clearly.',
    }],
    chats: [{ id: 1, name: 'Chat A', type: 'group' }],
    chatSettings: [],
    models: { response: ['gpt-4o-mini'] },
  }, 77);

  const enabledToggle = document.getElementById('contextConvertBotEnabled');
  const allChatsToggle = document.getElementById('contextConvertBotAvailableAllChats');
  const chatEnabledToggle = document.getElementById('contextConvertBotChatEnabled');
  const chatSave = document.getElementById('contextConvertBotChatSave');

  assert.equal(enabledToggle.checked, false);
  assert.equal(allChatsToggle.checked, true);
  assert.equal(allChatsToggle.disabled, true);
  assert.equal(chatEnabledToggle.checked, true);
  assert.equal(chatEnabledToggle.disabled, true);
  assert.equal(chatSave.disabled, true);

  enabledToggle.checked = true;
  enabledToggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(allChatsToggle.disabled, false);

  enabledToggle.checked = false;
  enabledToggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(allChatsToggle.disabled, true);
});

test('mention picker lets the search button act immediately on one touch gesture', async (t) => {
  const dom = await openSingleChatDom({
    mentionTargetsByChatId: {
      1: [
        { user_id: 2, username: 'bob', token: 'bob', display_name: 'Bob', avatar_color: '#7bc862' },
      ],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const mentionOpenBtn = document.getElementById('mentionOpenBtn');
  const searchBtn = document.getElementById('searchBtn');
  const searchPanel = document.getElementById('searchPanel');
  const searchInput = document.getElementById('searchInput');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);

  mentionOpenBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 80);
  assert.equal(document.getElementById('mentionPicker').classList.contains('hidden'), false);

  dispatchTouchTap(dom.window, searchBtn, { emitClick: true });
  await wait(dom, 80);

  assert.equal(document.getElementById('mentionPicker').classList.contains('hidden'), true);
  assert.equal(searchPanel.getAttribute('aria-hidden'), 'false');
  assert.equal(document.activeElement, searchInput);
  assert.equal(app.style.height, '420px');
});

test('mention picker lets chat info and back act immediately on one tap', async (t) => {
  const mentionTargetsByChatId = {
    1: [
      { user_id: 2, username: 'bob', token: 'bob', display_name: 'Bob', avatar_color: '#7bc862' },
    ],
  };

  {
    const dom = await openSingleChatDom({ mentionTargetsByChatId });
    t.after(() => {
      dom.window.close();
    });
    const { document, BananzaAppBridge } = dom.window;
    const msgInput = document.getElementById('msgInput');
    const mentionOpenBtn = document.getElementById('mentionOpenBtn');
    const chatInfoBtn = document.getElementById('chatInfoBtn');
    const chatInfoModal = document.getElementById('chatInfoModal');

    BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
    await wait(dom, 40);
    await openMobileKeyboard(dom, msgInput);
    mentionOpenBtn.dispatchEvent(new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }));
    await wait(dom, 80);

    dispatchPointerTap(dom.window, chatInfoBtn);
    dom.visualViewportMock.set({ height: 844 });
    await waitForViewportRecovery(dom, 320);

    assert.equal(document.getElementById('mentionPicker').classList.contains('hidden'), true);
    assert.equal(chatInfoModal.classList.contains('hidden'), false);
  }

  {
    const dom = await openSingleChatDom({ mentionTargetsByChatId });
    t.after(() => {
      dom.window.close();
    });
    const { document, BananzaAppBridge } = dom.window;
    const app = document.getElementById('app');
    const msgInput = document.getElementById('msgInput');
    const mentionOpenBtn = document.getElementById('mentionOpenBtn');
    const backBtn = document.getElementById('backBtn');

    BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
    await wait(dom, 40);
    await openMobileKeyboard(dom, msgInput);
    mentionOpenBtn.dispatchEvent(new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }));
    await wait(dom, 80);

    dispatchPointerTap(dom.window, backBtn);
    dom.visualViewportMock.set({ height: 844 });
    await waitForViewportRecovery(dom, 520);

    assert.equal(document.getElementById('mentionPicker').classList.contains('hidden'), true);
    assert.equal(app.style.height, '844px');
    assertMobileScene(dom, 'sidebar');
  }
});

test('context convert picker lets search act immediately on one touch gesture', async (t) => {
  const dom = await openSingleChatDom({
    chat: createChatFixture(1, 'Chat A', { context_transform_enabled: 1 }),
    contextConvertAvailabilityByChatId: {
      1: {
        enabled: true,
        bots: [{ id: 7, name: 'Banana Convert', provider: 'openai' }],
      },
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchPanel = document.getElementById('searchPanel');
  const searchInput = document.getElementById('searchInput');
  const composerContextConvertBtn = document.getElementById('composerContextConvertBtn');
  const row = appendMessageRow(dom, { id: 401, text: 'Just a row' });
  const bubble = row.querySelector('.msg-bubble');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  msgInput.value = 'Draft to convert';
  msgInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await wait(dom, 80);

  composerContextConvertBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 80);
  assert.equal(document.getElementById('contextConvertPicker').classList.contains('hidden'), false);

  dispatchTouchTap(dom.window, searchBtn, { emitClick: true });
  await wait(dom, 80);

  assert.equal(document.getElementById('contextConvertPicker').classList.contains('hidden'), true);
  assert.equal(searchPanel.getAttribute('aria-hidden'), 'false');
  assert.equal(document.activeElement, searchInput);
  assert.equal(app.style.height, '420px');
});

test('context convert picker outside message taps only close the picker without side effects', async (t) => {
  const dom = await openSingleChatDom({
    chat: createChatFixture(1, 'Chat A', { context_transform_enabled: 1 }),
    contextConvertAvailabilityByChatId: {
      1: {
        enabled: true,
        bots: [{ id: 7, name: 'Banana Convert', provider: 'openai' }],
      },
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const msgInput = document.getElementById('msgInput');
  const composerContextConvertBtn = document.getElementById('composerContextConvertBtn');
  const row = appendMessageRow(dom, { id: 402, text: 'Tap outside context convert picker' });
  const bubble = row.querySelector('.msg-bubble');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  msgInput.value = 'Draft to convert';
  msgInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await wait(dom, 80);
  composerContextConvertBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 80);
  assert.equal(document.getElementById('contextConvertPicker').classList.contains('hidden'), false);

  bubble.dispatchEvent(createPrimaryPointerEvent(dom.window, 'pointerdown'));
  bubble.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 40);

  assert.equal(document.getElementById('contextConvertPicker').classList.contains('hidden'), true);
  assert.equal(row.classList.contains('actions-open'), false);
  assert.equal(document.activeElement, msgInput);
});

test('mention picker outside message taps only close the picker without side effects', async (t) => {
  const dom = await openSingleChatDom({
    mentionTargetsByChatId: {
      1: [
        { user_id: 2, username: 'bob', token: 'bob', display_name: 'Bob', avatar_color: '#7bc862' },
      ],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const mentionOpenBtn = document.getElementById('mentionOpenBtn');
  const row = appendMessageRow(dom, { id: 402, text: 'Tap outside mention picker' });
  const bubble = row.querySelector('.msg-bubble');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  mentionOpenBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 80);
  assert.equal(document.getElementById('mentionPicker').classList.contains('hidden'), false);

  bubble.dispatchEvent(createPrimaryPointerEvent(dom.window, 'pointerdown'));
  bubble.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 40);

  assert.equal(document.getElementById('mentionPicker').classList.contains('hidden'), true);
  assert.equal(row.classList.contains('actions-open'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('emoji picker closes when navigating back out of the mobile chat view', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge, history } = dom.window;
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', {
    hideInactive: true,
    syncChatMetrics: true,
  });
  await wait(dom, 40);
  history.replaceState({ chat: 1 }, '');

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 40);
  assert.equal(emojiPicker.classList.contains('hidden'), false);
  assert.equal(getMobileSceneSnapshot(dom).scene, 'chat');

  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  await wait(dom, 320);

  assert.equal(emojiPicker.classList.contains('hidden'), true);
  assertMobileScene(dom, 'sidebar');
});

test('mobile chat exit popstate uses the resolved chat scene instead of raw sidebar-hidden state', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge, history } = dom.window;
  const sidebar = document.getElementById('sidebar');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', {
    hideInactive: true,
    syncChatMetrics: true,
  });
  await wait(dom, 40);
  history.replaceState({ chat: 1 }, '');
  sidebar.classList.remove('sidebar-hidden');

  assert.equal(sidebar.classList.contains('mobile-scene-hidden'), true);
  assert.equal(getMobileSceneSnapshot(dom).scene, 'chat');

  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  await wait(dom, 320);

  assertMobileScene(dom, 'sidebar');
  assert.equal(history.state?.view, 'chatlist');
  assert.equal(Object.prototype.hasOwnProperty.call(history.state || {}, 'chat'), false);
});

test('mobile chat exit popstate normalizes stale chat history without another history.back call', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { BananzaAppBridge, history } = dom.window;
  let historyBackCalls = 0;
  const originalBack = history.back.bind(history);

  history.back = (...args) => {
    historyBackCalls += 1;
    return originalBack(...args);
  };
  BananzaAppBridge.__testing.setMobileBaseScene('chat', {
    hideInactive: true,
    syncChatMetrics: true,
  });
  await wait(dom, 40);
  history.replaceState({ chat: 1 }, '');

  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  await wait(dom, 320);

  assert.equal(historyBackCalls, 0);
  assertMobileScene(dom, 'sidebar');
  assert.equal(history.state?.view, 'chatlist');
  assert.equal(Object.prototype.hasOwnProperty.call(history.state || {}, 'chat'), false);
});

test('mobile chat list scene hard-hides the chat area and keeps it hidden across resume and settings', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');

  assertMobileScene(dom, 'sidebar');

  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
  await waitForViewportRecovery(dom, 320);
  assertMobileScene(dom, 'sidebar');

  settingsBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 40);

  assert.equal(settingsModal.classList.contains('hidden'), false);
  assertMobileScene(dom, 'sidebar');
});

test('mobile chat scene hard-hides the sidebar and keeps it hidden while search is open', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const searchBtn = document.getElementById('searchBtn');
  const searchPanel = document.getElementById('searchPanel');
  const searchClose = document.getElementById('searchClose');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', {
    hideInactive: true,
    syncChatMetrics: true,
  });
  await wait(dom, 40);
  assertMobileScene(dom, 'chat');

  searchBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 40);

  assert.equal(searchPanel.getAttribute('aria-hidden'), 'false');
  assertMobileScene(dom, 'chat');

  searchClose.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 320);

  assert.equal(searchPanel.getAttribute('aria-hidden'), 'true');
  assertMobileScene(dom, 'chat');
});

test('scroll-to-bottom keeps native click activation when the mobile keyboard is closed', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const msgInput = document.getElementById('msgInput');
  const scrollBottomBtn = document.getElementById('scrollBottomBtn');
  const layout = installMessagesViewportMock(dom);

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true });

  for (let index = 0; index < 12; index += 1) {
    appendMessageRow(dom, {
      id: 500 + index,
      text: `Scroll row ${index + 1}`,
    });
  }

  layout.setScrollTop(layout.rowHeight * 3);
  let focusCalls = 0;
  msgInput.focus = () => {
    focusCalls += 1;
  };

  const pointerDown = createPrimaryPointerEvent(dom.window, 'pointerdown', { pointerType: 'touch' });
  scrollBottomBtn.dispatchEvent(pointerDown);
  scrollBottomBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 40);

  assert.equal(pointerDown.defaultPrevented, false);
  assert.equal(layout.scrollTop, layout.getBottomScrollTop());
  assert.equal(focusCalls, 0);
  assert.notEqual(document.activeElement, msgInput);
});

test('scroll-to-bottom stays keyboard-neutral when the mobile keyboard is already open', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const scrollBottomBtn = document.getElementById('scrollBottomBtn');
  const layout = installMessagesViewportMock(dom);

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true });

  for (let index = 0; index < 12; index += 1) {
    appendMessageRow(dom, {
      id: 700 + index,
      text: `Keyboard row ${index + 1}`,
    });
  }

  layout.setScrollTop(layout.rowHeight * 3);
  msgInput.focus();
  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await wait(dom, 30);
  assert.equal(app.style.height, '420px');

  const pointerDown = createPrimaryPointerEvent(dom.window, 'pointerdown', { pointerType: 'touch' });
  const pointerUp = createPrimaryPointerEvent(dom.window, 'pointerup', { pointerType: 'touch' });
  scrollBottomBtn.dispatchEvent(pointerDown);
  scrollBottomBtn.dispatchEvent(pointerUp);
  await wait(dom, 40);

  assert.equal(pointerDown.defaultPrevented, true);
  assert.equal(layout.scrollTop, layout.getBottomScrollTop());
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('restore scroll position reopens chat A at the saved anchor after visiting chat B', async (t) => {
  const chatMessages = {
    1: createChatMessages(1, 12),
    2: createChatMessages(2, 8),
  };
  const dom = await bootAppDom({
    fetchHandler: createChatFetchHandler(chatMessages),
  });
  t.after(() => {
    dom.window.close();
  });
  const { BananzaAppBridge } = dom.window;
  const layout = installMessagesViewportMock(dom);

  BananzaAppBridge.__testing.setScrollRestoreMode('restore');
  BananzaAppBridge.__testing.setChats([
    createChatFixture(1, 'Chat A'),
    createChatFixture(2, 'Chat B'),
  ]);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);
  layout.setScrollTop(layout.rowHeight * 3);

  await BananzaAppBridge.__testing.openChat(2);
  await wait(dom, 80);
  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);

  assert.equal(layout.scrollTop, layout.rowHeight * 3);
});

test('restore scroll position reopens the same chat at the saved anchor after returning to the chat list', async (t) => {
  const chatMessages = {
    1: createChatMessages(1, 12),
  };
  const dom = await bootAppDom({
    fetchHandler: createChatFetchHandler(chatMessages),
  });
  t.after(() => {
    dom.window.close();
  });
  const { BananzaAppBridge } = dom.window;
  const layout = installMessagesViewportMock(dom);

  BananzaAppBridge.__testing.setScrollRestoreMode('restore');
  BananzaAppBridge.__testing.setChats([
    createChatFixture(1, 'Chat A'),
  ]);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);
  layout.setScrollTop(layout.rowHeight * 2);

  BananzaAppBridge.__testing.revealSidebarFromChat();
  await wait(dom, 40);
  assert.equal(
    BananzaAppBridge.__testing.readScrollAnchors()['1']?.messageId,
    chatMessages[1][2].id
  );
  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);

  assert.equal(layout.scrollTop, layout.rowHeight * 2);
});

test('revealing the sidebar blurs focused controls inside chatArea before it becomes inert', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const backBtn = document.getElementById('backBtn');
  const chatArea = document.getElementById('chatArea');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true });
  backBtn.focus();
  assert.equal(document.activeElement, backBtn);

  BananzaAppBridge.__testing.revealSidebarFromChat();
  await wait(dom, 40);

  assert.notEqual(document.activeElement, backBtn);
  assert.equal(chatArea.hasAttribute('inert'), true);
  assert.equal(chatArea.getAttribute('aria-hidden'), 'true');
});

test('visibility hide flushes the current chat anchor so restore survives a fast app hide', async (t) => {
  const chatMessages = {
    1: createChatMessages(1, 12),
  };
  const dom = await bootAppDom({
    fetchHandler: createChatFetchHandler(chatMessages),
  });
  t.after(() => {
    dom.window.close();
  });
  const { BananzaAppBridge } = dom.window;
  const layout = installMessagesViewportMock(dom);

  BananzaAppBridge.__testing.setScrollRestoreMode('restore');
  BananzaAppBridge.__testing.setChats([
    createChatFixture(1, 'Chat A'),
  ]);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);
  layout.setScrollTop(layout.rowHeight * 4);

  setDocumentHidden(dom.window.document, true);
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));

  assert.equal(
    BananzaAppBridge.__testing.readScrollAnchors()['1']?.messageId,
    chatMessages[1][4].id
  );
});

test('when restore scroll position is disabled the chat reopens at the bottom', async (t) => {
  const chatMessages = {
    1: createChatMessages(1, 12),
    2: createChatMessages(2, 8),
  };
  const dom = await bootAppDom({
    fetchHandler: createChatFetchHandler(chatMessages),
  });
  t.after(() => {
    dom.window.close();
  });
  const { BananzaAppBridge } = dom.window;
  const layout = installMessagesViewportMock(dom);

  BananzaAppBridge.__testing.setScrollRestoreMode('bottom');
  BananzaAppBridge.__testing.setChats([
    createChatFixture(1, 'Chat A'),
    createChatFixture(2, 'Chat B'),
  ]);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);
  layout.setScrollTop(layout.rowHeight * 3);

  await BananzaAppBridge.__testing.openChat(2);
  await wait(dom, 80);
  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);

  assert.equal(layout.scrollTop, layout.getBottomScrollTop());
});

test('short unread chats send a read receipt on open without requiring a scroll event', async (t) => {
  const chatMessages = {
    1: createChatMessages(1, 2, { startId: 8 }),
  };
  const chatList = [
    {
      ...createChatFixture(1, 'Chat A', { lastMessageId: 10 }),
      last_read_id: 9,
      first_unread_id: 10,
      unread_count: 1,
    },
  ];
  const { handler, readCalls } = createReadTrackingFetchHandler(chatMessages, chatList);
  const dom = await bootAppDom({
    fetchHandler: handler,
  });
  t.after(() => {
    dom.window.close();
  });
  const { BananzaAppBridge } = dom.window;

  installMessagesViewportMock(dom);
  BananzaAppBridge.__testing.setChats(chatList);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 420);

  assert.ok(readCalls.some((call) => call.chatId === 1 && call.lastReadId === 10));
  let chatState = BananzaAppBridge.__testing.getChats().find((chat) => chat.id === 1);
  assert.equal(chatState.last_read_id, 10);
  assert.equal(chatState.unread_count, 0);
  assert.equal(chatState.first_unread_id, null);

  BananzaAppBridge.__testing.revealSidebarFromChat();
  await wait(dom, 80);

  chatState = BananzaAppBridge.__testing.getChats().find((chat) => chat.id === 1);
  assert.equal(chatState.last_read_id, 10);
  assert.equal(chatState.unread_count, 0);
  assert.equal(chatState.first_unread_id, null);
});

test('opening a longer unread chat away from the bottom does not auto-send a read receipt', async (t) => {
  const chatMessages = {
    1: createChatMessages(1, 12),
  };
  const chatList = [
    {
      ...createChatFixture(1, 'Chat A'),
      last_read_id: 104,
      first_unread_id: 105,
      unread_count: 8,
    },
  ];
  const { handler, readCalls } = createReadTrackingFetchHandler(chatMessages, chatList);
  const dom = await bootAppDom({
    fetchHandler: handler,
  });
  t.after(() => {
    dom.window.close();
  });
  const { BananzaAppBridge } = dom.window;

  installMessagesViewportMock(dom);
  BananzaAppBridge.__testing.setChats(chatList);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 420);

  const chatState = BananzaAppBridge.__testing.getChats().find((chat) => chat.id === 1);
  assert.equal(readCalls.length, 0);
  assert.equal(chatState.last_read_id, 104);
  assert.equal(chatState.unread_count, 8);
  assert.equal(chatState.first_unread_id, 105);
});

test('highlighted chats keep unread messages when the mobile sidebar is visible', async (t) => {
  const chatMessages = {
    1: createChatMessages(1, 1, { startId: 9 }),
  };
  const chatList = [
    {
      ...createChatFixture(1, 'greatkuzya', { lastMessageId: 10 }),
      last_read_id: 10,
      first_unread_id: null,
      unread_count: 0,
    },
  ];
  const { handler, readCalls } = createReadTrackingFetchHandler(chatMessages, chatList);
  const dom = await bootAppDom({
    fetchHandler: handler,
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  installMessagesViewportMock(dom);
  BananzaAppBridge.__testing.setChats(chatList);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 420);
  BananzaAppBridge.__testing.revealSidebarFromChat();
  await wait(dom, 420);

  assertMobileScene(dom, 'sidebar');

  emitWsMessage(dom, {
    type: 'message',
    message: createIncomingMessage(1, 11, {
      text: 'greatkuzya: 559',
    }),
  });
  await wait(dom, 420);

  const chatState = BananzaAppBridge.__testing.getChats().find((chat) => chat.id === 1);
  const unreadBadge = document.querySelector('.chat-item[data-chat-id="1"] .unread-badge');

  assert.equal(readCalls.length, 0);
  assert.equal(chatState.last_read_id, 10);
  assert.equal(chatState.last_message_id, 11);
  assert.equal(chatState.unread_count, 1);
  assert.equal(chatState.first_unread_id, 11);
  assert.equal(unreadBadge?.textContent?.trim(), '1');
});

test('settings modal dismisses the mobile keyboard and restores the composer dock', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');

  msgInput.focus();
  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await wait(dom, 30);
  assert.equal(app.style.height, '420px');

  settingsBtn.dispatchEvent(createPrimaryPointerEvent(dom.window, 'pointerdown'));
  settingsBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  dom.visualViewportMock.set({ height: 844 });
  await waitForViewportRecovery(dom, 320);

  assert.equal(settingsModal.classList.contains('hidden'), false);
  assert.equal(app.style.height, '844px');
  assert.notEqual(document.activeElement, msgInput);
  assertMobileScene(dom, 'sidebar');
});

test('fullscreen media viewer dismisses the mobile keyboard and leaves no gap on close', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const imageViewer = document.getElementById('imageViewer');

  msgInput.focus();
  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await wait(dom, 30);
  assert.equal(app.style.height, '420px');

  BananzaAppBridge.__testing.openMediaViewer('https://example.com/test-image.jpg', 'image');
  dom.visualViewportMock.set({ height: 844 });
  await waitForViewportRecovery(dom, 320);

  assert.equal(imageViewer.classList.contains('hidden'), false);
  assert.equal(app.style.height, '844px');
  assert.notEqual(document.activeElement, msgInput);

  BananzaAppBridge.__testing.closeMediaViewer();
  await waitForViewportRecovery(dom, 320);

  assert.equal(imageViewer.classList.contains('hidden'), true);
  assert.equal(app.style.height, '844px');
});

test('inline video messages render a poster when one is available', async (t) => {
  const chatMessages = {
    1: [createVideoMessage(1, 811, { file_stored: 'clip-inline.mp4', file_name: 'clip-inline.mp4' })],
  };
  const dom = await bootAppDom({
    fetchHandler: createChatFetchHandler(chatMessages),
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  installMessagesViewportMock(dom);
  BananzaAppBridge.__testing.setChats([
    createChatFixture(1, 'Chat A'),
  ]);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);

  const videoEl = document.querySelector('.msg-video video');
  assert.ok(videoEl);
  assert.match(videoEl.getAttribute('poster') || '', /\/uploads\/clip-inline\.mp4\/poster$/);
});

test('fullscreen gallery video slides keep the server poster', async (t) => {
  const chatMessages = {
    1: [createVideoMessage(1, 812, { file_stored: 'clip-gallery.mp4', file_name: 'clip-gallery.mp4' })],
  };
  const dom = await bootAppDom({
    fetchHandler: createChatFetchHandler(chatMessages),
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const imageViewer = document.getElementById('imageViewer');

  installMessagesViewportMock(dom);
  BananzaAppBridge.__testing.setChats([
    createChatFixture(1, 'Chat A'),
  ]);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);

  BananzaAppBridge.__testing.openMediaViewer('/uploads/clip-gallery.mp4/preview', 'video');
  await wait(dom, 30);

  const viewerVideo = imageViewer.querySelector('.iv-slide video');
  assert.equal(imageViewer.classList.contains('hidden'), false);
  assert.ok(viewerVideo);
  assert.match(viewerVideo.getAttribute('poster') || '', /\/uploads\/clip-gallery\.mp4\/poster$/);
});

test('the first ordinary message tap only dismisses the mobile keyboard', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const row = appendMessageRow(dom, { id: 201, userId: 2, text: 'Tap me once' });
  const bubble = row.querySelector('.msg-bubble');

  msgInput.focus();
  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await wait(dom, 30);
  assert.equal(app.style.height, '420px');

  bubble.dispatchEvent(createPrimaryPointerEvent(dom.window, 'pointerdown'));
  dom.visualViewportMock.set({ height: 844 });
  bubble.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await waitForViewportRecovery(dom, 320);

  assert.equal(row.classList.contains('actions-open'), false);
  assert.equal(app.style.height, '844px');
  assert.notEqual(document.activeElement, msgInput);
});

test('a background tap dismisses the mobile keyboard and redocks the composer', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const messagesEl = document.getElementById('messages');

  msgInput.focus();
  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await wait(dom, 30);
  assert.equal(app.style.height, '420px');

  messagesEl.dispatchEvent(createPrimaryPointerEvent(dom.window, 'pointerdown'));
  dom.visualViewportMock.set({ height: 844 });
  messagesEl.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await waitForViewportRecovery(dom, 320);

  assert.equal(app.style.height, '844px');
  assert.notEqual(document.activeElement, msgInput);
});

test('reply and edit flows still focus the composer when text entry is requested', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const msgInput = document.getElementById('msgInput');
  const row = appendMessageRow(dom, { id: 301, userId: 1, text: 'Editable draft' });

  BananzaAppBridge.__testing.setReply(91, 'Bob', 'Quoted text');
  assert.equal(document.activeElement, msgInput);

  msgInput.blur();
  BananzaAppBridge.__testing.setEditFromRow(row);

  assert.equal(document.activeElement, msgInput);
  assert.equal(msgInput.value, 'Editable draft');
});

test('mobile back navigation dismisses the keyboard and removes the composer gap', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const backBtn = document.getElementById('backBtn');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', {
    hideInactive: true,
    syncChatMetrics: true,
  });
  await wait(dom, 40);
  assertMobileScene(dom, 'chat');
  msgInput.focus();
  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await wait(dom, 30);
  assert.equal(app.style.height, '420px');

  backBtn.dispatchEvent(createPrimaryPointerEvent(dom.window, 'pointerdown'));
  backBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  dom.visualViewportMock.set({ height: 844 });
  await waitForViewportRecovery(dom, 520);

  assert.equal(app.style.height, '844px');
  assert.notEqual(document.activeElement, msgInput);
  assertMobileScene(dom, 'sidebar');
});

test('voice note restores playback position after leaving and reopening the chat', async (t) => {
  const chatA = createChatFixture(1, 'Chat A', { lastMessageId: 411 });
  const chatB = createChatFixture(2, 'Chat B', { lastMessageId: 0 });
  const message = createVoiceNoteMessage(1, 411);
  const dom = await openMediaPlaybackDom({
    activeChat: chatA,
    chats: [chatA, chatB],
    chatMessagesByChatId: {
      1: [message],
      2: [],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  const firstAudio = document.querySelector('.msg-row[data-msg-id="411"] audio');
  installMockMediaElement(dom, firstAudio, {
    duration: 24,
    currentTime: 9.5,
    paused: true,
    ended: false,
    readyState: 1,
  });
  firstAudio.dispatchEvent(new dom.window.Event('loadedmetadata'));
  await wait(dom, 30);

  await BananzaAppBridge.__testing.openChat(2);
  await wait(dom, 80);
  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);

  const reopenedAudio = document.querySelector('.msg-row[data-msg-id="411"] audio');
  installMockMediaElement(dom, reopenedAudio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  reopenedAudio.dispatchEvent(new dom.window.Event('loadedmetadata'));
  await wait(dom, 240);

  assert.ok(Math.abs(Number(reopenedAudio.currentTime || 0) - 9.5) < 0.2);
  assert.equal(reopenedAudio.paused, true);
});

test('video note restores playback position after leaving and reopening the chat', async (t) => {
  const chatA = createChatFixture(1, 'Chat A', { lastMessageId: 422 });
  const chatB = createChatFixture(2, 'Chat B', { lastMessageId: 0 });
  const message = createVideoNoteMessage(1, 422);
  const dom = await openMediaPlaybackDom({
    activeChat: chatA,
    chats: [chatA, chatB],
    chatMessagesByChatId: {
      1: [message],
      2: [],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  const firstVideo = document.querySelector('.msg-row[data-msg-id="422"] .video-note-video');
  installMockMediaElement(dom, firstVideo, {
    duration: 18,
    currentTime: 6.75,
    paused: true,
    ended: false,
    readyState: 1,
  });
  firstVideo.dispatchEvent(new dom.window.Event('loadedmetadata'));
  await wait(dom, 30);

  await BananzaAppBridge.__testing.openChat(2);
  await wait(dom, 80);
  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);

  const reopenedVideo = document.querySelector('.msg-row[data-msg-id="422"] .video-note-video');
  installMockMediaElement(dom, reopenedVideo, {
    duration: 18,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  reopenedVideo.dispatchEvent(new dom.window.Event('loadedmetadata'));
  await wait(dom, 240);

  assert.ok(Math.abs(Number(reopenedVideo.currentTime || 0) - 6.75) < 0.2);
  assert.equal(reopenedVideo.paused, true);
});

test('voice note keeps completed progress state after leaving and reopening the chat', async (t) => {
  const chatA = createChatFixture(1, 'Chat A', { lastMessageId: 433 });
  const chatB = createChatFixture(2, 'Chat B', { lastMessageId: 0 });
  const message = createVoiceNoteMessage(1, 433);
  const dom = await openMediaPlaybackDom({
    activeChat: chatA,
    chats: [chatA, chatB],
    chatMessagesByChatId: {
      1: [message],
      2: [],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  let row = document.querySelector('.msg-row[data-msg-id="433"]');
  let audio = row.querySelector('audio');
  let fill = row.querySelector('.voice-note-progress-fill');
  installMockMediaElement(dom, audio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  audio.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  audio.currentTime = 24;
  audio.ended = true;
  audio.paused = true;
  audio.dispatchEvent(new dom.window.Event('ended'));
  await wait(dom, 40);

  const voiceMeta = JSON.parse(JSON.stringify((await dom.window.messageCache.readChatMeta(1))?.mediaPlaybackCompleted || {}));
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 100) < 0.1);
  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(row.__messageData, 'voice-note-audio'), true);
  assert.ok(Number(voiceMeta['voice-note-audio:433']) > 0);

  await BananzaAppBridge.__testing.openChat(2);
  await wait(dom, 80);
  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 100);

  row = document.querySelector('.msg-row[data-msg-id="433"]');
  audio = row.querySelector('audio');
  fill = row.querySelector('.voice-note-progress-fill');
  installMockMediaElement(dom, audio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  audio.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(row.__messageData, 'voice-note-audio'), true);
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 100) < 0.1);
});

test('video note keeps completed progress state after leaving and reopening the chat', async (t) => {
  const chatA = createChatFixture(1, 'Chat A', { lastMessageId: 444 });
  const chatB = createChatFixture(2, 'Chat B', { lastMessageId: 0 });
  const message = createVideoNoteMessage(1, 444);
  const dom = await openMediaPlaybackDom({
    activeChat: chatA,
    chats: [chatA, chatB],
    chatMessagesByChatId: {
      1: [message],
      2: [],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  let row = document.querySelector('.msg-row[data-msg-id="444"]');
  let video = row.querySelector('.video-note-video');
  let fill = row.querySelector('.video-note-progress-fill');
  installMockMediaElement(dom, video, {
    duration: 18,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  video.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  video.currentTime = 18;
  video.ended = true;
  video.paused = true;
  video.dispatchEvent(new dom.window.Event('ended'));
  await wait(dom, 40);

  const videoMeta = JSON.parse(JSON.stringify((await dom.window.messageCache.readChatMeta(1))?.mediaPlaybackCompleted || {}));
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 100) < 0.1);
  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(row.__messageData, 'video-note-video'), true);
  assert.ok(Number(videoMeta['video-note-video:444']) > 0);

  await BananzaAppBridge.__testing.openChat(2);
  await wait(dom, 80);
  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 100);

  row = document.querySelector('.msg-row[data-msg-id="444"]');
  video = row.querySelector('.video-note-video');
  fill = row.querySelector('.video-note-progress-fill');
  installMockMediaElement(dom, video, {
    duration: 18,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  video.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(row.__messageData, 'video-note-video'), true);
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 100) < 0.1);
});

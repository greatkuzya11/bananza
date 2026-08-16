const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installVisualViewportMock,
  loadAppScript,
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

const CALL_SCRIPTS = [
  'public/js/calls/CallStore.js',
  'public/js/calls/CallMedia.js',
  'public/js/calls/CallNotifications.js',
  'public/js/calls/CallFeature.js',
];

function createJsonResponse(dom, data, init = {}) {
  return new dom.window.Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function installAppRuntimeStubs(dom, { fetchHandler = null, currentUserOverrides = {} } = {}) {
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
    ...currentUserOverrides,
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
        throw new Error(`Unexpected fetch in media viewer DOM test: ${url.pathname}`);
    }
  };
}

async function bootAppDom(options = {}) {
  const { i18nStub = null, beforeLoad = null, ...runtimeOptions } = options;
  const dom = createAppDom();
  installAppRuntimeStubs(dom, runtimeOptions);
  if (typeof beforeLoad === 'function') beforeLoad(dom);
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
  if (i18nStub) dom.window.BananzaI18n = i18nStub;
  loadBrowserScript(dom, 'public/js/qip-infium-original.js');
  loadBrowserScript(dom, 'public/js/qip-hd.js');
  loadAppScript(dom);
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
    Object.defineProperty(window.SVGElement.prototype, 'getPointAtLength', {
      configurable: true,
      writable: true,
      value(length) {
        const svg = this.ownerSVGElement;
        const rawViewBox = String(svg?.getAttribute?.('viewBox') || '').trim().split(/[\s,]+/).map(Number);
        const viewBoxWidth = Number.isFinite(svg?.viewBox?.baseVal?.width) && svg.viewBox.baseVal.width > 0
          ? svg.viewBox.baseVal.width
          : (rawViewBox[2] || 248);
        return {
          x: (Math.max(0, Math.min(pathLength, Number(length || 0))) / pathLength) * viewBoxWidth,
          y: 0,
        };
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
    if (this instanceof window.SVGElement && this.classList.contains('voice-note-progress')) {
      return buildRect(248, 104);
    }
    if (this instanceof window.SVGElement && this.classList.contains('video-note-progress')) {
      return buildRect(248, 350);
    }
    if (this instanceof window.HTMLElement && this.classList.contains('call-recording-card')) {
      return buildRect(320, 84);
    }
    if (this instanceof window.SVGElement && this.classList.contains('call-recording-progress')) {
      return buildRect(320, 84);
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

function setIosNavigator(window) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: 'iPhone',
  });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: 5,
  });
}

function setWindowInnerHeight(dom, height) {
  Object.defineProperty(dom.window, 'innerHeight', {
    configurable: true,
    value: height,
  });
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

function dispatchTouchDrag(window, target, {
  identifier = 1,
  startX = 320,
  startY = 420,
  moveX = 240,
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
  rowHeightForRow = null,
} = {}) {
  const { window } = dom;
  const { document } = window;
  const messagesEl = document.getElementById('messages');
  const chatArea = document.getElementById('chatArea');
  const originalGetBoundingClientRect = window.Element.prototype.getBoundingClientRect;
  let scrollTop = 0;

  const getRows = () => [...messagesEl.querySelectorAll('.msg-row[data-msg-id]')];
  const getRowHeight = (row) => {
    if (typeof rowHeightForRow === 'function') {
      const customHeight = Number(rowHeightForRow(row));
      if (Number.isFinite(customHeight) && customHeight > 0) return customHeight;
    }
    return rowHeight;
  };
  const getContentHeight = () => getRows().reduce((sum, row) => sum + getRowHeight(row), 0);
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
      const rows = getRows();
      const rowIndex = rows.indexOf(this);
      if (rowIndex >= 0) {
        const offsetTop = rows.slice(0, rowIndex).reduce((sum, row) => sum + getRowHeight(row), 0);
        const height = getRowHeight(this);
        const top = viewportTop + offsetTop - scrollTop;
        return buildRect(top, height, viewportWidth);
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

function createRuCallArtifactI18nStub() {
  const map = {
    'Call AI summary': 'AI-сводка звонка',
    Ready: 'Готово',
    Error: 'Ошибка',
    Retry: 'Повторить',
    Open: 'Открыть',
    'Show more': 'Далее',
    'No artifacts yet': 'Артефакты еще не готовы',
    Close: 'Закрыть',
    'callArtifact.summary': 'Саммари',
    'callArtifact.tasks': 'Задачи',
    'callArtifact.decisions': 'Решения',
  };
  return {
    t(key, params = {}) {
      let value = map[key] || key;
      Object.entries(params || {}).forEach(([name, replacement]) => {
        value = value.replaceAll(`{${name}}`, String(replacement));
      });
      return value;
    },
    text(value, params = {}) {
      return this.t(value, params);
    },
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

function createCallMessage(chatId, messageId, overrides = {}) {
  const callId = Number(overrides.call_id || overrides.call?.id || overrides.call_message?.call_id || messageId + 1000);
  const mixedRecording = Object.prototype.hasOwnProperty.call(overrides, 'mixed_recording')
    ? overrides.mixed_recording
    : {
        id: callId + 2000,
        call_id: callId,
        status: 'completed',
        duration_ms: 24_000,
        size_bytes: 4096,
        mime_type: 'audio/ogg',
        url: `/api/calls/${callId}/recording/mixed`,
      };
  return createIncomingMessage(chatId, messageId, {
    text: 'Video call',
    is_call_message: true,
    call: {
      id: callId,
      call_id: callId,
      status: 'ended',
      duration_ms: 24_000,
      ended_reason: 'ended',
      can_join: false,
      mixed_recording: mixedRecording,
      ...(overrides.call || {}),
    },
    call_message: {
      call_id: callId,
      status: 'ended',
      duration_ms: 24_000,
      ended_reason: 'ended',
      mixed_recording: mixedRecording,
      ...(overrides.call_message || {}),
    },
    ...overrides,
  });
}

function findCallPayloadById(chatMessagesByChatId, callId) {
  const targetId = Number(callId || 0);
  if (!targetId) return null;
  return Object.values(chatMessagesByChatId || {})
    .flat()
    .flatMap((message) => [message?.call, message?.call_message])
    .find((call) => Number(call?.id || call?.call_id || 0) === targetId) || null;
}

function findCallTranscriptRunPayload(chatMessagesByChatId, runId) {
  const targetId = Number(runId || 0);
  if (!targetId) return null;
  for (const message of Object.values(chatMessagesByChatId || {}).flat()) {
    const calls = [message?.call, message?.call_message];
    for (const call of calls) {
      if (!call) continue;
      const runs = [
        call.primary_transcript_run,
        ...(Array.isArray(call.transcript_runs) ? call.transcript_runs : []),
      ].filter(Boolean);
      const run = runs.find((item) => Number(item?.id || 0) === targetId);
      if (run) return { call, run };
    }
  }
  return null;
}

function loadCallFeatureScripts(dom) {
  loadBrowserScripts(dom, CALL_SCRIPTS);
  dom.window.dispatchEvent(new dom.window.Event('bananza:ready'));
}

function loadContextChatShotRuntimeForTest(dom) {
  loadBrowserScript(dom, 'public/js/app/ai-admin/context-chatshot-runtime.js');
  dom.window.BananzaAppBridge.__testing.installAiAdminRuntimeModulesForTest();
}

function createCallArtifactMessage(chatId, messageId, overrides = {}) {
  const batchId = Number(overrides.batch_id || overrides.call_artifact_batch?.id || messageId + 3000);
  const callId = Number(overrides.call_id || overrides.call_artifact_batch?.call_id || messageId + 1000);
  return createIncomingMessage(chatId, messageId, {
    text: '',
    is_call_artifact_message: true,
    call_artifact_batch: {
      id: batchId,
      call_id: callId,
      transcript_run_id: batchId + 100,
      message_id: messageId,
      requested_by: 1,
      status: 'completed',
      error: '',
      runs: [],
      created_at: '2026-04-29T21:05:00.000Z',
      updated_at: '2026-04-29T21:05:00.000Z',
      completed_at: '2026-04-29T21:06:00.000Z',
      ...(overrides.call_artifact_batch || {}),
    },
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
    const chatShotMatch = url.pathname.match(/^\/api\/chats\/(\d+)\/chatshot$/);
    if (chatShotMatch) {
      const chatId = Number(chatShotMatch[1]);
      return createJsonResponse(dom, {
        chatId,
        enabled: false,
        requested_enabled: false,
        botId: null,
        style: 'comic',
        ready: false,
        message_count: (chatMessagesByChatId[chatId] || []).length,
        bots: [],
        selectedBot: null,
      });
    }
    return null;
  };
}

function createComposerInteractionFetchHandler({
  chatMessagesByChatId = {},
  mentionTargetsByChatId = {},
  contextConvertAvailabilityByChatId = {},
  chatShotStateByChatId = {},
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
    const chatShotMatch = url.pathname.match(/^\/api\/chats\/(\d+)\/chatshot$/);
    if (chatShotMatch) {
      const chatId = Number(chatShotMatch[1]);
      return createJsonResponse(dom, chatShotStateByChatId[chatId] || {
        chatId,
        enabled: false,
        requested_enabled: false,
        botId: null,
        style: 'comic',
        ready: false,
        message_count: (chatMessagesByChatId[chatId] || []).length,
        bots: [],
        selectedBot: null,
      });
    }
    const transformMatch = url.pathname.match(/^\/api\/chats\/(\d+)\/context-convert$/);
    if (transformMatch && String(init?.method || '').toUpperCase() === 'POST') {
      return createJsonResponse(dom, { text: 'Converted text' });
    }
    const restoreMatch = url.pathname.match(/^\/api\/messages\/(\d+)\/context-convert\/restore-original$/);
    if (restoreMatch && String(init?.method || '').toUpperCase() === 'POST') {
      const messageId = Number(restoreMatch[1]);
      const message = Object.values(chatMessagesByChatId)
        .flat()
        .find((item) => Number(item?.id || 0) === messageId) || {};
      return createJsonResponse(dom, {
        ok: true,
        message: {
          ...message,
          id: messageId,
          text: 'Restored original',
          context_transform_original_available: 0,
          edited_at: '2026-04-29T22:15:00.000Z',
        },
      });
    }
    return null;
  };
}

function createMediaPlaybackFetchHandler({
  chatMessagesByChatId = {},
  mentionTargetsByChatId = {},
  contextConvertAvailabilityByChatId = {},
  chatShotStateByChatId = {},
  features = {},
  callTranscribeRequests = null,
} = {}) {
  const composerHandler = createComposerInteractionFetchHandler({
    chatMessagesByChatId,
    mentionTargetsByChatId,
    contextConvertAvailabilityByChatId,
    chatShotStateByChatId,
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
    const transcriptRunMatch = url.pathname.match(/^\/api\/calls\/transcript-runs\/(\d+)$/);
    if (transcriptRunMatch) {
      const payload = findCallTranscriptRunPayload(chatMessagesByChatId, Number(transcriptRunMatch[1]));
      if (payload) {
        return createJsonResponse(dom, {
          call: payload.call,
          run: payload.run,
          transcript_text: payload.run.transcript_text || '',
          segments: Array.isArray(payload.run.segments) ? payload.run.segments : [],
        });
      }
    }
    const callTranscriptMatch = url.pathname.match(/^\/api\/calls\/(\d+)\/transcript$/);
    if (callTranscriptMatch) {
      const call = findCallPayloadById(chatMessagesByChatId, Number(callTranscriptMatch[1]));
      if (call) {
        const run = call.primary_transcript_run || (Array.isArray(call.transcript_runs) ? call.transcript_runs[0] : null);
        return createJsonResponse(dom, {
          call,
          run,
          ai_notes: call.ai_notes || null,
          transcript_text: run?.transcript_text || call.ai_notes?.transcript_text || '',
          segments: Array.isArray(run?.segments) ? run.segments : [],
        });
      }
    }
    const callTranscribeRetryMatch = url.pathname.match(/^\/api\/calls\/(\d+)\/transcribe\/retry$/);
    if (callTranscribeRetryMatch && String(init?.method || '').toUpperCase() === 'POST') {
      callTranscribeRequests?.push({
        callId: Number(callTranscribeRetryMatch[1]),
        method: String(init?.method || 'GET').toUpperCase(),
      });
      return createJsonResponse(dom, { run: { id: 1, status: 'queued' }, call: { id: Number(callTranscribeRetryMatch[1]) }, message: null });
    }
    return composerHandler({ dom, window, url, input, init });
  };
}

async function openSingleChatDom({
  chat = createChatFixture(1, 'Chat A'),
  chatMessagesByChatId = null,
  mentionTargetsByChatId = {},
  contextConvertAvailabilityByChatId = {},
  chatShotStateByChatId = {},
  loadContextRuntime = false,
  beforeLoad = null,
} = {}) {
  const chatId = Number(chat.id || 1);
  const dom = await bootAppDom({
    beforeLoad,
    fetchHandler: createComposerInteractionFetchHandler({
      chatMessagesByChatId: chatMessagesByChatId || { [chatId]: [] },
      mentionTargetsByChatId,
      contextConvertAvailabilityByChatId,
      chatShotStateByChatId,
    }),
  });
  if (loadContextRuntime) loadContextChatShotRuntimeForTest(dom);
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
  i18nStub = null,
  callTranscribeRequests = null,
  currentUserOverrides = {},
} = {}) {
  const allChats = Array.isArray(chats) && chats.length
    ? chats
    : [activeChat, createChatFixture(2, 'Chat B', { lastMessageId: 0 })];
  const dom = await bootAppDom({
    i18nStub,
    currentUserOverrides,
    fetchHandler: createMediaPlaybackFetchHandler({
      chatMessagesByChatId: chatMessagesByChatId || { [Number(activeChat.id || 1)]: [] },
      features,
      callTranscribeRequests,
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

test('media viewer close button auto-hides and touch release reveals it', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  BananzaAppBridge.__testing.openMediaViewer('https://example.com/auto-hide-close.jpg', 'image');
  await wait(dom, 0);

  const imageViewer = document.getElementById('imageViewer');
  const slide = document.querySelector('#ivStrip .iv-slide');
  assert.ok(slide, 'Expected an image slide in the media viewer');
  assert.equal(imageViewer.classList.contains('iv-close-hidden'), false);

  await wait(dom, 3150);
  assert.equal(imageViewer.classList.contains('iv-close-hidden'), true);

  const tapStart = createTouchPoint({ identifier: 61, clientX: 190, clientY: 520 });
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchstart', { touches: [tapStart] }));
  assert.equal(imageViewer.classList.contains('iv-close-hidden'), true);

  slide.dispatchEvent(createTouchEvent(dom.window, 'touchend', {
    touches: [],
    changedTouches: [tapStart],
  }));
  assert.equal(imageViewer.classList.contains('iv-close-hidden'), false);

  await wait(dom, 3150);
  assert.equal(imageViewer.classList.contains('iv-close-hidden'), true);
});

test('media viewer gallery swipe does not reveal the hidden close button', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const firstSrc = 'https://example.com/swipe-close-1.jpg';
  const secondSrc = 'https://example.com/swipe-close-2.jpg';

  appendImageMessageRow(dom, { id: 331, src: firstSrc, text: 'Swipe close one' });
  appendImageMessageRow(dom, { id: 332, src: secondSrc, text: 'Swipe close two' });

  BananzaAppBridge.__testing.openMediaViewer(firstSrc, 'image');
  await wait(dom, 0);

  const imageViewer = document.getElementById('imageViewer');
  const slide = document.querySelector('#ivStrip .iv-slide');
  assert.ok(slide, 'Expected the first gallery slide to render');
  imageViewer.classList.add('iv-close-hidden');

  const swipeStart = createTouchPoint({ identifier: 71, clientX: 300, clientY: 520 });
  const swipeMove = createTouchPoint({ identifier: 71, clientX: 160, clientY: 520 });
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchstart', { touches: [swipeStart] }));
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchmove', { touches: [swipeMove] }));
  slide.dispatchEvent(createTouchEvent(dom.window, 'touchend', {
    touches: [],
    changedTouches: [swipeMove],
  }));
  await wait(dom, 0);

  const state = getMediaViewerState(dom);
  assert.equal(state.galleryIndex, 1);
  assert.equal(imageViewer.classList.contains('iv-close-hidden'), true);
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

test('Android-style resized viewport keeps the mobile composer docked to the keyboard', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);

  msgInput.focus();
  setWindowInnerHeight(dom, 420);
  dom.visualViewportMock.setAndDispatch('resize', { height: 420 });
  await wait(dom, 80);

  const snapshot = BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot();
  assert.equal(snapshot.keyboardOpen, true);
  assert.equal(snapshot.chatKeyboardLayout, true);
  assert.equal(snapshot.appHeight, '420px');
  assert.equal(snapshot.mobileViewportHeight, '420px');
  assert.equal(app.style.height, '420px');
});

test('iOS visual viewport offset keeps the mobile composer docked to stable keyboard bottom', async (t) => {
  const dom = await openSingleChatDom({
    beforeLoad: ({ window }) => setIosNavigator(window),
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const root = document.documentElement;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);

  msgInput.focus();
  dom.visualViewportMock.setAndDispatch('resize', { height: 430, offsetTop: 64 });
  await wait(dom, 80);

  let snapshot = BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot();
  assert.equal(root.classList.contains('is-ios-webkit'), true);
  assert.equal(snapshot.keyboardOpen, true);
  assert.equal(snapshot.chatKeyboardLayout, true);
  assert.equal(snapshot.iosKeyboardOpen, true);
  assert.equal(snapshot.iosChatKeyboardLayout, true);
  assert.equal(snapshot.iosViewportTop, '64px');
  assert.equal(snapshot.iosViewportHeight, '430px');
  assert.equal(snapshot.iosViewportBottom, '494px');
  assert.equal(app.style.height, '494px');

  dom.visualViewportMock.setAndDispatch('scroll', { height: 430, offsetTop: 128 });
  await wait(dom, 80);

  snapshot = BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot();
  assert.equal(snapshot.iosViewportTop, '64px');
  assert.equal(snapshot.iosViewportHeight, '430px');
  assert.equal(snapshot.iosViewportBottom, '494px');
  assert.equal(root.style.getPropertyValue('--mobile-visual-viewport-bottom'), '494px');
  assert.equal(app.style.height, '494px');
});

test('mobile composer vertical drag is swallowed while the keyboard is open', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const inputArea = document.querySelector('.input-area');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  assert.equal(app.style.height, '420px');

  inputArea.dispatchEvent(createTouchEvent(dom.window, 'touchstart', {
    touches: [createTouchPoint({ identifier: 51, clientX: 180, clientY: 380 })],
  }));
  const move = createTouchEvent(dom.window, 'touchmove', {
    touches: [createTouchPoint({ identifier: 51, clientX: 180, clientY: 300 })],
  });
  inputArea.dispatchEvent(move);

  assert.equal(move.defaultPrevented, true);
  assert.equal(app.style.height, '420px');
});

test('mobile composer textarea swipe navigates sent message history without input events', async (t) => {
  const dom = await openSingleChatDom({
    beforeLoad: ({ window }) => {
      window.localStorage.setItem('bananza:composerHistory:v1:1', JSON.stringify({
        1: ['older sent text', 'newer sent text'],
      }));
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const msgInput = document.getElementById('msgInput');
  let inputEvents = 0;

  msgInput.addEventListener('input', () => {
    inputEvents += 1;
  });

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);

  let swipe = dispatchTouchDrag(dom.window, msgInput, {
    identifier: 81,
    startX: 180,
    startY: 380,
    moveX: 180,
    moveY: 300,
    endX: 180,
    endY: 300,
  });
  assert.equal(swipe.moveEvent.defaultPrevented, true);
  assert.equal(msgInput.value, 'newer sent text');
  assert.equal(inputEvents, 0);

  swipe = dispatchTouchDrag(dom.window, msgInput, {
    identifier: 82,
    startX: 180,
    startY: 380,
    moveX: 180,
    moveY: 300,
    endX: 180,
    endY: 300,
  });
  assert.equal(swipe.moveEvent.defaultPrevented, true);
  assert.equal(msgInput.value, 'older sent text');
  assert.equal(inputEvents, 0);

  swipe = dispatchTouchDrag(dom.window, msgInput, {
    identifier: 83,
    startX: 180,
    startY: 300,
    moveX: 180,
    moveY: 380,
    endX: 180,
    endY: 380,
  });
  assert.equal(swipe.moveEvent.defaultPrevented, true);
  assert.equal(msgInput.value, 'newer sent text');

  swipe = dispatchTouchDrag(dom.window, msgInput, {
    identifier: 84,
    startX: 180,
    startY: 300,
    moveX: 180,
    moveY: 380,
    endX: 180,
    endY: 380,
  });
  assert.equal(swipe.moveEvent.defaultPrevented, true);
  assert.equal(msgInput.value, '');
  assert.equal(inputEvents, 0);
});

test('mobile composer toolbar button drags are swallowed while the keyboard is open', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const attachBtn = document.getElementById('attachBtn');
  const emojiBtn = document.getElementById('emojiBtn');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);

  for (const [index, button] of [attachBtn, emojiBtn].entries()) {
    const identifier = 61 + index;
    button.dispatchEvent(createTouchEvent(dom.window, 'touchstart', {
      touches: [createTouchPoint({ identifier, clientX: 36 + (index * 42), clientY: 382 })],
    }));
    const move = createTouchEvent(dom.window, 'touchmove', {
      touches: [createTouchPoint({ identifier, clientX: 36 + (index * 42), clientY: 300 })],
    });
    button.dispatchEvent(move);

    assert.equal(move.defaultPrevented, true);
    assert.equal(app.style.height, '420px');
    button.dispatchEvent(createTouchEvent(dom.window, 'touchend', {
      touches: [],
      changedTouches: [createTouchPoint({ identifier, clientX: 36 + (index * 42), clientY: 300 })],
    }));
  }
});

test('mobile keyboard dock ignores visual viewport scroll while composer is focused', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);

  assert.equal(BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot().mobileViewportTop, '0px');

  dom.visualViewportMock.setAndDispatch('scroll', { offsetTop: 80 });
  await wait(dom, 80);

  const snapshot = BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot();
  assert.equal(snapshot.keyboardOpen, true);
  assert.equal(snapshot.chatKeyboardLayout, true);
  assert.equal(snapshot.mobileViewportTop, '0px');
  assert.equal(app.style.height, '420px');
});

test('mobile emoji picker drag cannot pan the keyboard dock', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  dispatchTouchTap(dom.window, emojiBtn);
  await wait(dom, 80);

  assert.equal(emojiPicker.classList.contains('hidden'), false);

  emojiPicker.dispatchEvent(createTouchEvent(dom.window, 'touchstart', {
    touches: [createTouchPoint({ identifier: 53, clientX: 90, clientY: 260 })],
  }));
  const move = createTouchEvent(dom.window, 'touchmove', {
    touches: [createTouchPoint({ identifier: 53, clientX: 90, clientY: 180 })],
  });
  emojiPicker.dispatchEvent(move);

  assert.equal(move.defaultPrevented, true);
  assert.equal(app.style.height, '420px');
});

test('mobile composer allows textarea internal scroll instead of swallowing it', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const msgInput = document.getElementById('msgInput');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  dom.window.localStorage.setItem('bananza:composerHistory:v1:1', JSON.stringify({
    1: ['should not replace textarea scroll'],
  }));

  Object.defineProperty(msgInput, 'clientHeight', {
    configurable: true,
    value: 40,
  });
  Object.defineProperty(msgInput, 'scrollHeight', {
    configurable: true,
    value: 160,
  });
  Object.defineProperty(msgInput, 'scrollTop', {
    configurable: true,
    writable: true,
    value: 20,
  });

  msgInput.dispatchEvent(createTouchEvent(dom.window, 'touchstart', {
    touches: [createTouchPoint({ identifier: 52, clientX: 180, clientY: 380 })],
  }));
  const move = createTouchEvent(dom.window, 'touchmove', {
    touches: [createTouchPoint({ identifier: 52, clientX: 180, clientY: 300 })],
  });
  msgInput.dispatchEvent(move);

  assert.equal(move.defaultPrevented, true);
  assert.equal(msgInput.scrollTop, 100);
  assert.equal(msgInput.value, '');
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

test('emoji picker stays above the composer when visual viewport is offset by mobile keyboard', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const buttonRect = {
    x: 52,
    y: 372,
    top: 372,
    left: 52,
    right: 88,
    bottom: 408,
    width: 36,
    height: 36,
    toJSON() {
      return this;
    },
  };

  emojiBtn.getBoundingClientRect = () => buttonRect;
  Object.defineProperty(emojiPicker, 'offsetWidth', {
    configurable: true,
    get() {
      return 300;
    },
  });
  Object.defineProperty(emojiPicker, 'offsetHeight', {
    configurable: true,
    get() {
      return 280;
    },
  });

  dom.visualViewportMock.setAndDispatch('resize', {
    height: 420,
    offsetTop: 180,
  });

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 40);

  const pickerTop = Number.parseInt(emojiPicker.style.top, 10);
  const pickerHeight = emojiPicker.offsetHeight;
  assert.equal(emojiPicker.classList.contains('hidden'), false);
  assert.ok(Number.isFinite(pickerTop), 'Expected emoji picker to receive a top position');
  assert.ok(
    pickerTop + pickerHeight <= buttonRect.top - 8,
    `Expected picker bottom (${pickerTop + pickerHeight}) to stay above composer button (${buttonRect.top})`
  );
  assert.equal(emojiPicker.style.maxHeight, '320px');
});

test('emoji picker anchors above the grown composer row', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const inputRow = document.querySelector('.input-row');
  const buttonRect = {
    x: 52,
    y: 372,
    top: 372,
    left: 52,
    right: 88,
    bottom: 408,
    width: 36,
    height: 36,
    toJSON() {
      return this;
    },
  };
  const rowRect = {
    x: 16,
    y: 320,
    top: 320,
    left: 16,
    right: 374,
    bottom: 408,
    width: 358,
    height: 88,
    toJSON() {
      return this;
    },
  };

  emojiBtn.getBoundingClientRect = () => buttonRect;
  inputRow.getBoundingClientRect = () => rowRect;
  Object.defineProperty(emojiPicker, 'offsetWidth', {
    configurable: true,
    get() {
      return 300;
    },
  });
  Object.defineProperty(emojiPicker, 'offsetHeight', {
    configurable: true,
    get() {
      return 280;
    },
  });

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 40);

  const pickerTop = Number.parseInt(emojiPicker.style.top, 10);
  const pickerHeight = emojiPicker.offsetHeight;
  assert.ok(Number.isFinite(pickerTop), 'Expected emoji picker to receive a top position');
  assert.ok(
    pickerTop + pickerHeight <= rowRect.top - 8,
    `Expected picker bottom (${pickerTop + pickerHeight}) to stay above composer row (${rowRect.top})`
  );
});

test('emoji picker closes on outside pointerdown only', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const messagesEl = document.getElementById('messages');

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 40);
  assert.equal(emojiPicker.classList.contains('hidden'), false);

  emojiPicker.dispatchEvent(createPrimaryPointerEvent(dom.window, 'pointerdown', { pointerType: 'mouse' }));
  await wait(dom, 40);
  assert.equal(emojiPicker.classList.contains('hidden'), false);

  messagesEl.dispatchEvent(createPrimaryPointerEvent(dom.window, 'pointerdown', { pointerType: 'mouse' }));
  await wait(dom, 320);
  assert.equal(emojiPicker.classList.contains('hidden'), true);
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
  msgInput.value = 'Existing text';
  msgInput.selectionStart = msgInput.selectionEnd = 0;

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

  assert.match(msgInput.value, /^Existing text/);
  assert.notEqual(msgInput.value, 'Existing text');
  assert.equal(focusCalls, 0);
  assert.notEqual(document.activeElement, msgInput);
});

test('emoji picker shows recent as the second tab and stores picked emoji locally', async (t) => {
  const recentRequests = [];
  const dom = await bootAppDom({
    fetchHandler: async ({ dom, url, init }) => {
      if (url.pathname !== '/api/user/recent-emojis') return null;
      if ((init.method || 'GET').toUpperCase() === 'POST') {
        const body = JSON.parse(init.body || '{}');
        recentRequests.push(body.emoji);
        return createJsonResponse(dom, { emojis: [body.emoji] });
      }
      return createJsonResponse(dom, { emojis: [] });
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));

  const tabs = Array.from(emojiPicker.querySelectorAll('.emoji-tab')).map((tab) => tab.textContent);
  assert.equal(tabs[0], '😀');
  assert.equal(tabs[1], '🕘');

  const picked = emojiPicker.querySelector('.emoji-item');
  assert.ok(picked, 'Expected a picker emoji item');
  picked.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  assert.equal(recentRequests[0], picked.textContent);

  emojiPicker.querySelectorAll('.emoji-tab')[1].dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  assert.equal(emojiPicker.querySelector('.emoji-item')?.textContent, picked.textContent);
});

test('emoji picker keeps local recent order after syncing a standard emoji', async (t) => {
  const serverRecent = ['рџЂ', 'рџ”Ґ', 'рџЋ‰'];
  const dom = await bootAppDom({
    beforeLoad: (dom) => {
      dom.window.localStorage.setItem('bananza:recentEmojis:v1:1', JSON.stringify([
        ':qip-hd-qippda-aa:',
        ':qip-infium-001:',
      ]));
    },
    fetchHandler: async ({ dom, url, init }) => {
      if (url.pathname !== '/api/user/recent-emojis') return null;
      if ((init.method || 'GET').toUpperCase() === 'POST') {
        const body = JSON.parse(init.body || '{}');
        return createJsonResponse(dom, { emojis: [body.emoji, ...serverRecent] });
      }
      return createJsonResponse(dom, { emojis: serverRecent });
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));

  const standardItem = emojiPicker.querySelector('.emoji-item:not(.custom-emoji-item)');
  assert.ok(standardItem, 'Expected a standard emoji item');
  const pickedEmoji = standardItem.dataset.emoji || standardItem.textContent;
  standardItem.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));

  emojiPicker.querySelectorAll('.emoji-tab')[1].dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  const recentValues = Array.from(emojiPicker.querySelectorAll('.emoji-item'))
    .map((item) => item.dataset.emoji || item.textContent);
  assert.deepEqual(recentValues.slice(0, 3), [
    pickedEmoji,
    ':qip-hd-qippda-aa:',
    ':qip-infium-001:',
  ]);
});

test('emoji picker recent tab is capped at 32 items from the server', async (t) => {
  const serverRecent = [
    '😀','😃','😄','😁','😆','😅','😂','🙂',
    '😉','😊','😍','🤩','😘','😋','😜','🤪',
    '🤔','😎','🥳','😭','😡','👍','👎','❤️',
    '🎉','🍕','🌿','🚗','💡','🐶','🍌','⚡',
    '🔥','💯','⭐','🌟','✨','🚀','🛸','🎮',
  ];
  const dom = await bootAppDom({
    fetchHandler: async ({ dom, url }) => {
      if (url.pathname !== '/api/user/recent-emojis') return null;
      return createJsonResponse(dom, { emojis: serverRecent });
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));

  emojiPicker.querySelectorAll('.emoji-tab')[1].dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  const recentItems = Array.from(emojiPicker.querySelectorAll('.emoji-item')).map((item) => item.textContent);
  assert.equal(recentItems.length, 32);
  assert.deepEqual(recentItems, serverRecent.slice(0, 32));
});

test('emoji picker exposes QIP tabs and inserts GIF previews into the composer', async (t) => {
  const recentRequests = [];
  const dom = await bootAppDom({
    fetchHandler: async ({ dom, url, init }) => {
      if (url.pathname !== '/api/user/recent-emojis') return null;
      if ((init.method || 'GET').toUpperCase() === 'POST') {
        const body = JSON.parse(init.body || '{}');
        recentRequests.push(body.emoji);
        return createJsonResponse(dom, { emojis: [body.emoji] });
      }
      return createJsonResponse(dom, { emojis: [] });
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const msgInput = document.getElementById('msgInput');
  const composerRichPreview = document.getElementById('composerRichPreview');
  const inputRow = document.querySelector('.input-row');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));

  const qipTab = Array.from(emojiPicker.querySelectorAll('.emoji-tab'))
    .find((tab) => tab.textContent === 'QIP');
  assert.ok(qipTab, 'Expected the QiP tab to be present');
  const qipHdTab = Array.from(emojiPicker.querySelectorAll('.emoji-tab'))
    .find((tab) => tab.textContent === 'QIP HD');
  assert.ok(qipHdTab, 'Expected the QIP HD tab to be present');
  qipTab.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  const qipItem = emojiPicker.querySelector('.emoji-item.qip-infium-emoji-item');
  assert.ok(qipItem, 'Expected QiP image items in the picker');
  assert.equal(qipItem.dataset.emoji, ':qip-infium-001:');
  assert.match(qipItem.querySelector('img')?.getAttribute('src') || '', /\/assets\/emoji\/qip-infium-original\/001\.gif$/);

  qipItem.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  assert.notEqual(msgInput.value, ':qip-infium-001:');
  assert.ok(msgInput.value.length < ':qip-infium-001:'.length);
  assert.ok(composerRichPreview.querySelector('img.composer-rich-emoji'));
  assert.match(composerRichPreview.querySelector('img')?.getAttribute('src') || '', /\/assets\/emoji\/qip-infium-original\/001\.gif$/);
  assert.equal(recentRequests[0], ':qip-infium-001:');
  let storedRecent = JSON.parse(dom.window.localStorage.getItem('bananza:recentEmojis:v1:1') || '[]');
  assert.deepEqual(storedRecent, [':qip-infium-001:']);
  msgInput.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
    key: 'Backspace',
    bubbles: true,
    cancelable: true,
  }));
  assert.equal(msgInput.value, '');

  msgInput.value = '';
  msgInput.selectionStart = msgInput.selectionEnd = 0;
  msgInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

  qipHdTab.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  const qipHdItem = emojiPicker.querySelector('.emoji-item.custom-emoji-item[data-emoji=":qip-hd-qippda-aa:"]');
  assert.ok(qipHdItem, 'Expected QIP HD image items in the picker');
  assert.match(qipHdItem.querySelector('img')?.getAttribute('src') || '', /\/assets\/emoji\/qip-hd\/qippda_aa\.gif$/);
  assert.equal(qipHdItem.querySelector('img')?.getAttribute('width'), '48');

  qipHdItem.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  assert.notEqual(msgInput.value, ':qip-hd-qippda-aa:');
  assert.ok(msgInput.value.length < ':qip-hd-qippda-aa:'.length);
  assert.match(composerRichPreview.querySelector('img')?.getAttribute('src') || '', /\/assets\/emoji\/qip-hd\/qippda_aa\.gif$/);
  assert.equal(composerRichPreview.querySelector('img')?.getAttribute('width'), '24');
  assert.equal(composerRichPreview.querySelector('img')?.getAttribute('height'), '20');
  assert.equal(inputRow.classList.contains('is-rich-emoji-multiline'), false);
  assert.equal(recentRequests[1], ':qip-hd-qippda-aa:');
  storedRecent = JSON.parse(dom.window.localStorage.getItem('bananza:recentEmojis:v1:1') || '[]');
  assert.deepEqual(storedRecent.slice(0, 2), [':qip-hd-qippda-aa:', ':qip-infium-001:']);
  msgInput.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
    key: 'Backspace',
    bubbles: true,
    cancelable: true,
  }));
  assert.equal(msgInput.value, '');
});

test('emoji picker recent tab can display QIP tokens next to Unicode emoji', async (t) => {
  const dom = await bootAppDom({
    fetchHandler: async ({ dom, url }) => {
      if (url.pathname !== '/api/user/recent-emojis') return null;
      return createJsonResponse(dom, { emojis: [':qip-hd-qippda-aa:', ':qip-infium-001:', '\uD83D\uDE00'] });
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));

  emojiPicker.querySelectorAll('.emoji-tab')[1].dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  const qipItem = emojiPicker.querySelector('.emoji-item.qip-infium-emoji-item[data-emoji=":qip-infium-001:"]');
  assert.ok(qipItem, 'Expected a QiP recent item');
  assert.ok(qipItem.querySelector('img.qip-infium-emoji'));
  const qipHdItem = emojiPicker.querySelector('.emoji-item.custom-emoji-item[data-emoji=":qip-hd-qippda-aa:"]');
  assert.ok(qipHdItem, 'Expected a QIP HD recent item');
  assert.ok(qipHdItem.querySelector('img.qip-hd-emoji'));
  assert.ok(emojiPicker.querySelector('.emoji-item[data-emoji="\uD83D\uDE00"]'));
});

test('emoji picker restores QIP recent tokens from local storage after reload', async (t) => {
  const recentBackfillRequests = [];
  const dom = await bootAppDom({
    beforeLoad: (dom) => {
      dom.window.localStorage.setItem('bananza:recentEmojis:v1:1', JSON.stringify([
        ':qip-hd-qippda-aa:',
        ':qip-hd-nope:',
        'not-an-emoji',
        ':qip-infium-001:',
      ]));
    },
    fetchHandler: async ({ dom, url, init }) => {
      if (url.pathname !== '/api/user/recent-emojis') return null;
      if ((init.method || 'GET').toUpperCase() === 'POST') {
        const body = JSON.parse(init.body || '{}');
        recentBackfillRequests.push(body.emoji);
        return createJsonResponse(dom, { emojis: [body.emoji] });
      }
      return createJsonResponse(dom, { emojis: [] });
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));

  emojiPicker.querySelectorAll('.emoji-tab')[1].dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  const qipHdItem = emojiPicker.querySelector('.emoji-item.custom-emoji-item[data-emoji=":qip-hd-qippda-aa:"]');
  assert.ok(qipHdItem, 'Expected a local-storage QIP HD recent item');
  assert.ok(qipHdItem.querySelector('img.qip-hd-emoji'));
  const qipItem = emojiPicker.querySelector('.emoji-item.qip-infium-emoji-item[data-emoji=":qip-infium-001:"]');
  assert.ok(qipItem, 'Expected a local-storage QIP recent item');
  assert.ok(qipItem.querySelector('img.qip-infium-emoji'));
  assert.deepEqual(
    JSON.parse(dom.window.localStorage.getItem('bananza:recentEmojis:v1:1') || '[]').slice(0, 2),
    [':qip-hd-qippda-aa:', ':qip-infium-001:'],
  );
  assert.deepEqual(recentBackfillRequests.sort(), [':qip-hd-qippda-aa:', ':qip-infium-001:'].sort());
});

test('emoji recent sync keeps local QIP tokens when the server rejects backfill', async (t) => {
  const warnings = [];
  const postRequests = [];
  const dom = await bootAppDom({
    beforeLoad: (dom) => {
      dom.window.localStorage.setItem('bananza:recentEmojis:v1:1', JSON.stringify([
        ':qip-hd-qippda-aa:',
      ]));
      dom.window.console.warn = (...args) => warnings.push(args.map(String).join(' '));
    },
    fetchHandler: async ({ dom, url, init }) => {
      if (url.pathname !== '/api/user/recent-emojis') return null;
      if ((init.method || 'GET').toUpperCase() === 'POST') {
        const body = JSON.parse(init.body || '{}');
        postRequests.push(body.emoji);
        return createJsonResponse(dom, { error: 'Invalid emoji' }, { status: 400 });
      }
      return createJsonResponse(dom, { emojis: [] });
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));
  assert.deepEqual(postRequests, [':qip-hd-qippda-aa:']);
  assert.equal(warnings.some((line) => line.includes('[emoji] recent')), false);

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));
  emojiPicker.querySelectorAll('.emoji-tab')[1].dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));

  const qipHdItem = emojiPicker.querySelector('.emoji-item.custom-emoji-item[data-emoji=":qip-hd-qippda-aa:"]');
  assert.ok(qipHdItem, 'Expected the rejected server token to remain in local recents');
  qipHdItem.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));
  assert.deepEqual(postRequests, [':qip-hd-qippda-aa:']);
  assert.equal(warnings.some((line) => line.includes('[emoji] recent')), false);
});

test('QIP tokens render as inline images and single-token messages are enlarged', async (t) => {
  const chatId = 1;
  const dom = await openSingleChatDom({
    chat: createChatFixture(chatId, 'QiP Chat', { lastMessageId: 103 }),
    chatMessagesByChatId: {
      [chatId]: [
        createIncomingMessage(chatId, 101, { text: ':qip-infium-001:' }),
        createIncomingMessage(chatId, 102, {
          text: 'Hello :qip-infium-002: :qip-hd-qippda-aa: https://example.com @alice',
          mentions: [{ token: 'alice', username: 'alice', user_id: 33, is_ai_bot: 0 }],
        }),
        createIncomingMessage(chatId, 103, { text: ':qip-hd-qippda-aa:' }),
      ],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;

  const singleRow = document.querySelector('.msg-row[data-msg-id="101"]');
  assert.ok(singleRow.classList.contains('emoji-only-message'));
  const largeQip = singleRow.querySelector('.msg-text img.qip-infium-emoji--large');
  assert.ok(largeQip, 'Expected a large QiP image for a single-token message');
  assert.match(largeQip.getAttribute('src'), /\/assets\/emoji\/qip-infium-original\/001\.gif$/);
  assert.equal(largeQip.getAttribute('width'), '72');

  const mixedRow = document.querySelector('.msg-row[data-msg-id="102"]');
  assert.equal(mixedRow.classList.contains('emoji-only-message'), false);
  const inlineQip = mixedRow.querySelector('.msg-text img.custom-emoji-img.qip-infium-emoji:not(.custom-emoji-img--large)');
  assert.ok(inlineQip, 'Expected an inline QiP image inside mixed text');
  assert.match(inlineQip.getAttribute('src'), /\/assets\/emoji\/qip-infium-original\/002\.gif$/);
  assert.equal(inlineQip.getAttribute('width'), '20');
  const inlineQipHd = mixedRow.querySelector('.msg-text img.custom-emoji-img.qip-hd-emoji');
  assert.ok(inlineQipHd, 'Expected an inline QIP HD image inside mixed text');
  assert.match(inlineQipHd.getAttribute('src'), /\/assets\/emoji\/qip-hd\/qippda_aa\.gif$/);
  assert.equal(inlineQipHd.getAttribute('width'), '24');
  assert.equal(mixedRow.querySelector('.msg-text a')?.getAttribute('href'), 'https://example.com');
  assert.equal(mixedRow.querySelector('.msg-text .mention-link')?.dataset.mentionUserId, '33');

  const hdSingleRow = document.querySelector('.msg-row[data-msg-id="103"]');
  assert.ok(hdSingleRow.classList.contains('emoji-only-message'));
  const largeQipHd = hdSingleRow.querySelector('.msg-text img.custom-emoji-img--large.qip-hd-emoji');
  assert.ok(largeQipHd, 'Expected a large QIP HD image for a single-token message');
  assert.match(largeQipHd.getAttribute('src'), /\/assets\/emoji\/qip-hd\/qippda_aa\.gif$/);
  assert.equal(largeQipHd.getAttribute('width'), '64');
});

test('mobile chat list pull refresh label is localized and positioned inside the pull gap', async (t) => {
  const pullRefreshTranslations = {
    'Pull to refresh': '\u041f\u043e\u0442\u044f\u043d\u0438\u0442\u0435 \u0434\u043b\u044f \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f',
    'Release to refresh': '\u041e\u0442\u043f\u0443\u0441\u0442\u0438\u0442\u0435 \u0434\u043b\u044f \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f',
    'Refreshing chats...': '\u041e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u043c \u0447\u0430\u0442\u044b...',
    'Reloading app...': '\u041f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435...',
  };
  const dom = await bootAppDom({
    i18nStub: {
      t: (key) => pullRefreshTranslations[key] || key,
      text: (key) => pullRefreshTranslations[key] || key,
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const surface = document.getElementById('chatFolderListSurface');
  const chatList = document.getElementById('chatList');
  const indicator = document.getElementById('chatListPullIndicator');
  const chip = indicator.querySelector('.chat-list-pull-chip');
  const label = document.getElementById('chatListPullLabel');

  await wait(dom, 80);

  const makeRect = ({ top, left = 0, width = 390, height }) => ({
    x: left,
    y: top,
    top,
    left,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON() {
      return this;
    },
  });
  Object.defineProperty(surface, 'clientHeight', {
    configurable: true,
    value: 700,
  });
  surface.getBoundingClientRect = () => makeRect({ top: 92, height: 700 });
  chatList.getBoundingClientRect = () => makeRect({ top: 100, height: 660 });
  chip.getBoundingClientRect = () => makeRect({ top: 0, width: 156, height: 34 });
  chatList.scrollTop = 0;

  chatList.dispatchEvent(createTouchEvent(dom.window, 'touchstart', {
    touches: [createTouchPoint({ clientY: 100 })],
  }));
  const move = createTouchEvent(dom.window, 'touchmove', {
    touches: [createTouchPoint({ clientY: 220 })],
  });
  chatList.dispatchEvent(move);

  const listTopInSurface = 8;
  const chipHeight = 34;
  const offset = Number.parseFloat(chatList.style.paddingTop);
  const indicatorTop = Number.parseFloat(indicator.style.top);

  assert.equal(move.defaultPrevented, true);
  assert.ok(offset >= 64, `Expected pull offset above threshold, got ${offset}`);
  assert.equal(label.dataset.i18n, 'Release to refresh');
  assert.equal(label.textContent, '\u041e\u0442\u043f\u0443\u0441\u0442\u0438\u0442\u0435 \u0434\u043b\u044f \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f');
  assert.ok(indicatorTop >= listTopInSurface, `Expected indicator inside pull gap, got top ${indicatorTop}`);
  assert.ok(
    indicatorTop + chipHeight <= listTopInSurface + offset,
    `Expected indicator bottom inside pull gap, got ${indicatorTop + chipHeight} for gap ${listTopInSurface + offset}`
  );
});

test('search button opens on touchend, survives the synthetic click and focuses the mobile search input', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const chatInfoBtn = document.getElementById('chatInfoBtn');
  const chatHeaderActions = document.getElementById('chatHeaderActions');
  const searchBtn = document.getElementById('searchBtn');
  const searchPanel = document.getElementById('searchPanel');
  const searchInput = document.getElementById('searchInput');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  assert.equal(app.style.height, '420px');

  chatInfoBtn.click();
  assert.equal(chatHeaderActions.classList.contains('is-open'), true);

  const { touchStart } = dispatchTouchTap(dom.window, searchBtn, { emitClick: true });
  await wait(dom, 80);

  assert.equal(touchStart.defaultPrevented, true);
  assert.equal(searchPanel.getAttribute('aria-hidden'), 'false');
  assert.equal(chatHeaderActions.classList.contains('is-open'), false);
  assert.equal(document.activeElement, searchInput);
  assert.equal(app.style.height, '420px');
  assertMobileScene(dom, 'chat');
});

test('chat header actions start collapsed and the gear toggles them with spin feedback', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const chatHeaderActions = document.getElementById('chatHeaderActions');
  const chatInfoBtn = document.getElementById('chatInfoBtn');
  const searchBtn = document.getElementById('searchBtn');
  const chatSettingsActionBtn = document.getElementById('chatSettingsActionBtn');

  assert.ok(chatHeaderActions);
  assert.equal(chatHeaderActions.classList.contains('is-open'), false);
  assert.equal(chatHeaderActions.getAttribute('aria-hidden'), 'true');
  assert.equal(chatInfoBtn.getAttribute('aria-expanded'), 'false');
  assert.equal(searchBtn.tabIndex, -1);
  assert.equal(chatSettingsActionBtn.tabIndex, -1);

  chatInfoBtn.click();
  assert.equal(chatHeaderActions.classList.contains('is-open'), true);
  assert.equal(chatHeaderActions.getAttribute('aria-hidden'), 'false');
  assert.equal(chatInfoBtn.getAttribute('aria-expanded'), 'true');
  assert.equal(chatInfoBtn.classList.contains('is-spinning'), true);
  assert.notEqual(searchBtn.tabIndex, -1);
  assert.notEqual(chatSettingsActionBtn.tabIndex, -1);

  chatInfoBtn.click();
  assert.equal(chatHeaderActions.classList.contains('is-open'), false);
  assert.equal(chatHeaderActions.getAttribute('aria-hidden'), 'true');
  assert.equal(chatInfoBtn.getAttribute('aria-expanded'), 'false');
  assert.equal(searchBtn.tabIndex, -1);
  assert.equal(chatSettingsActionBtn.tabIndex, -1);
});

test('chat settings action opens on pointerup without a synthetic click and dismisses the mobile keyboard', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const chatInfoBtn = document.getElementById('chatInfoBtn');
  const chatHeaderActions = document.getElementById('chatHeaderActions');
  const chatSettingsActionBtn = document.getElementById('chatSettingsActionBtn');
  const chatInfoModal = document.getElementById('chatInfoModal');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);
  assert.equal(app.style.height, '420px');

  chatInfoBtn.click();
  assert.equal(chatHeaderActions.classList.contains('is-open'), true);

  const { pointerDown } = dispatchPointerTap(dom.window, chatSettingsActionBtn);
  dom.visualViewportMock.set({ height: 844 });
  await waitForViewportRecovery(dom, 320);

  assert.equal(pointerDown.defaultPrevented, true);
  assert.equal(chatInfoModal.classList.contains('hidden'), false);
  assert.equal(chatHeaderActions.classList.contains('is-open'), false);
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
    loadContextRuntime: true,
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
  loadContextChatShotRuntimeForTest(dom);
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

test('mention picker lets chat settings action and back act immediately on one tap', async (t) => {
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
    const chatSettingsActionBtn = document.getElementById('chatSettingsActionBtn');
    const chatInfoModal = document.getElementById('chatInfoModal');

    BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
    await wait(dom, 40);
    chatInfoBtn.click();
    await wait(dom, 20);
    await openMobileKeyboard(dom, msgInput);
    mentionOpenBtn.dispatchEvent(new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }));
    await wait(dom, 80);

    dispatchPointerTap(dom.window, chatSettingsActionBtn);
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
    loadContextRuntime: true,
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
    loadContextRuntime: true,
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

test('avatar mention menu suppresses the follow-up click on links underneath', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const messagesEl = document.getElementById('messages');
  const msgInput = document.getElementById('msgInput');
  const avatar = document.createElement('div');
  avatar.className = 'msg-group-avatar';
  avatar.dataset.userId = '2';
  avatar.dataset.displayName = 'Bob';
  avatar.dataset.mentionToken = 'bob';
  avatar.dataset.isAiBot = '0';
  messagesEl.appendChild(avatar);
  const row = appendMessageRow(dom, { id: 403, text: '<a href="https://example.com" id="ghostClickLink">example.com</a>' });
  const link = row.querySelector('#ghostClickLink');
  let linkClicked = false;
  link.addEventListener('click', () => {
    linkClicked = true;
  });

  avatar.dispatchEvent(createPrimaryPointerEvent(dom.window, 'pointerdown'));
  const menu = document.getElementById('avatarUserMenu');
  assert.ok(menu);
  assert.equal(menu.classList.contains('hidden'), false);

  const mentionButton = menu.querySelector('[data-avatar-action="mention"]');
  mentionButton.dispatchEvent(createPrimaryPointerEvent(dom.window, 'pointerdown'));
  assert.equal(msgInput.value, '@bob ');

  const followupClick = new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });
  link.dispatchEvent(followupClick);

  assert.equal(followupClick.defaultPrevented, true);
  assert.equal(linkClicked, false);
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

test('floating scroll date follows the first visible message while scrolling', async (t) => {
  const firstDate = '2026-04-28T12:00:00.000Z';
  const secondDate = '2026-04-29T12:00:00.000Z';
  const messages = createChatMessages(1, 8).map((message, index) => ({
    ...message,
    created_at: index < 4
      ? firstDate.replace('12:00', `12:0${index}`)
      : secondDate.replace('12:00', `12:0${index - 4}`),
  }));
  const dom = await bootAppDom({
    fetchHandler: createChatFetchHandler({ 1: messages }),
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const messagesEl = document.getElementById('messages');
  const layout = installMessagesViewportMock(dom, {
    viewportHeight: 180,
    rowHeight: 50,
  });
  const expectedDate = (iso) => new Date(iso).toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  BananzaAppBridge.__testing.setChats([
    createChatFixture(1, 'Chat A', { lastMessageId: messages[messages.length - 1].id }),
  ]);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);

  const separatorCount = messagesEl.querySelectorAll('.date-separator').length;
  layout.setScrollTop(0);
  messagesEl.dispatchEvent(new dom.window.Event('scroll'));
  await wait(dom, 40);

  const indicator = document.getElementById('scrollDateIndicator');
  assert.equal(indicator?.textContent, expectedDate(firstDate));
  assert.equal(indicator?.classList.contains('is-visible'), true);

  layout.setScrollTop(layout.rowHeight * 4);
  messagesEl.dispatchEvent(new dom.window.Event('scroll'));
  await wait(dom, 40);

  assert.equal(indicator.textContent, expectedDate(secondDate));
  assert.equal(indicator.classList.contains('is-visible'), true);
  assert.equal(layout.scrollTop, layout.rowHeight * 4);
  assert.equal(messagesEl.querySelectorAll('.date-separator').length, separatorCount);
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

test('composer drafts are scoped to the chat being opened', async (t) => {
  const chatMessages = {
    1: createChatMessages(1, 4),
    2: createChatMessages(2, 4),
  };
  const dom = await bootAppDom({
    fetchHandler: createChatFetchHandler(chatMessages),
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const msgInput = document.getElementById('msgInput');
  const inputEvent = () => new dom.window.Event('input', { bubbles: true });

  BananzaAppBridge.__testing.setChats([
    createChatFixture(1, 'Chat A'),
    createChatFixture(2, 'Chat B'),
  ]);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);
  msgInput.value = 'Draft for A';
  msgInput.dispatchEvent(inputEvent());

  await BananzaAppBridge.__testing.openChat(2);
  await wait(dom, 80);
  assert.equal(msgInput.value, '');

  msgInput.value = 'Draft for B';
  msgInput.dispatchEvent(inputEvent());

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);
  assert.equal(msgInput.value, 'Draft for A');

  await BananzaAppBridge.__testing.openChat(2);
  await wait(dom, 80);
  assert.equal(msgInput.value, 'Draft for B');

  const storedDrafts = JSON.parse(dom.window.localStorage.getItem('bananza:composerDrafts:v1:1') || '{}');
  assert.deepEqual(storedDrafts, {
    1: 'Draft for A',
    2: 'Draft for B',
  });
});

test('composer drafts are restored from localStorage after app reload', async (t) => {
  const chatMessages = {
    1: createChatMessages(1, 4),
  };
  const dom = await bootAppDom({
    beforeLoad(nextDom) {
      nextDom.window.localStorage.setItem('bananza:composerDrafts:v1:1', JSON.stringify({
        1: 'Persisted draft',
      }));
    },
    fetchHandler: createChatFetchHandler(chatMessages),
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const msgInput = document.getElementById('msgInput');

  BananzaAppBridge.__testing.setChats([
    createChatFixture(1, 'Chat A'),
  ]);

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);

  assert.equal(msgInput.value, 'Persisted draft');
});

test('microphone mode setting persists through Settings and bridge', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge, localStorage } = dom.window;
  const toggle = document.getElementById('settingsMicrophoneMode');

  assert.equal(BananzaAppBridge.getMicrophoneMode(), 'voice_message');
  BananzaAppBridge.__testing.openSettingsModal();
  assert.equal(toggle.checked, true);

  toggle.checked = false;
  toggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

  assert.equal(localStorage.getItem('microphoneMode'), 'dictation');
  assert.equal(BananzaAppBridge.getMicrophoneMode(), 'dictation');

  toggle.checked = true;
  BananzaAppBridge.__testing.openSettingsModal();
  assert.equal(toggle.checked, false);
});

test('insertDictatedText inserts at cursor and saves composer draft', async (t) => {
  const dom = await bootAppDom({
    fetchHandler: createChatFetchHandler({ 1: [] }),
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge, localStorage } = dom.window;
  const msgInput = document.getElementById('msgInput');
  let inputEvents = 0;

  BananzaAppBridge.__testing.setChats([
    createChatFixture(1, 'Chat A'),
  ]);
  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 80);

  msgInput.addEventListener('input', () => {
    inputEvents += 1;
  });
  msgInput.value = 'Hello !';
  msgInput.setSelectionRange(6, 6);

  const nextValue = BananzaAppBridge.insertDictatedText('dictated');

  assert.equal(nextValue, 'Hello dictated!');
  assert.equal(msgInput.value, 'Hello dictated!');
  assert.equal(inputEvents, 1);
  assert.equal(
    JSON.parse(localStorage.getItem('bananza:composerDrafts:v1:1') || '{}')['1'],
    'Hello dictated!'
  );
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

test('ordinary message taps keep the mobile keyboard and open actions', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const row = appendMessageRow(dom, { id: 201, userId: 2, text: 'Tap me once' });
  const bubble = row.querySelector('.msg-bubble');

  await openMobileKeyboard(dom, msgInput);
  assert.equal(app.style.height, '420px');

  const { pointerDown } = dispatchPointerTap(dom.window, bubble);
  await wait(dom, 80);

  assert.equal(pointerDown.defaultPrevented, false);
  assert.equal(row.classList.contains('actions-open'), true);
  assert.equal(app.style.height, '420px');
  assert.equal(document.activeElement, msgInput);
});

test('touch message taps clear long-press state while keeping the keyboard', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const reactionPicker = document.getElementById('reactionPicker');
  const row = appendMessageRow(dom, { id: 203, userId: 2, text: 'Touch tap me' });
  const bubble = row.querySelector('.msg-bubble');

  await openMobileKeyboard(dom, msgInput);
  const { touchEnd } = dispatchTouchTap(dom.window, bubble);
  await wait(dom, 620);

  assert.equal(touchEnd.defaultPrevented, true);
  assert.equal(row.classList.contains('actions-open'), true);
  assert.equal(reactionPicker.classList.contains('hidden'), true);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('background taps keep the mobile keyboard and only clear floating message actions', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const messagesEl = document.getElementById('messages');
  const row = appendMessageRow(dom, { id: 202, userId: 2, text: 'Actions first' });
  const bubble = row.querySelector('.msg-bubble');

  await openMobileKeyboard(dom, msgInput);
  assert.equal(app.style.height, '420px');

  dispatchPointerTap(dom.window, bubble);
  await wait(dom, 80);
  assert.equal(row.classList.contains('actions-open'), true);

  const { pointerUp } = dispatchPointerTap(dom.window, messagesEl);
  await wait(dom, 80);

  assert.equal(pointerUp.defaultPrevented, true);
  assert.equal(row.classList.contains('actions-open'), false);
  assert.equal(app.style.height, '420px');
  assert.equal(document.activeElement, msgInput);
});

test('mobile message swipe reply and edit keep the keyboard attached', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const replyBar = document.getElementById('replyBar');
  const replyRow = appendMessageRow(dom, { id: 211, userId: 2, text: 'Reply by swipe' });
  const editRow = appendMessageRow(dom, { id: 212, userId: 1, text: 'Edit by swipe' });

  await openMobileKeyboard(dom, msgInput);
  assert.equal(app.style.height, '420px');

  dispatchTouchDrag(dom.window, replyRow.querySelector('.msg-bubble'), {
    identifier: 71,
    startX: 320,
    startY: 360,
    moveX: 250,
    endX: 250,
  });
  await wait(dom, 80);

  assert.equal(replyBar.classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');

  dispatchTouchDrag(dom.window, editRow.querySelector('.msg-bubble'), {
    identifier: 72,
    startX: 90,
    startY: 360,
    moveX: 160,
    endX: 160,
  });
  await wait(dom, 80);

  assert.equal(msgInput.value, 'Edit by swipe');
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('vertical message drags do not trigger mobile reply or edit gestures', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const msgInput = document.getElementById('msgInput');
  const replyBar = document.getElementById('replyBar');
  const row = appendMessageRow(dom, { id: 221, userId: 1, text: 'Vertical scroll candidate' });

  await openMobileKeyboard(dom, msgInput);
  const { moveEvent } = dispatchTouchDrag(dom.window, row.querySelector('.msg-bubble'), {
    identifier: 73,
    startX: 180,
    startY: 380,
    moveX: 182,
    moveY: 310,
    endX: 182,
    endY: 310,
  });
  await wait(dom, 80);

  assert.equal(moveEvent.defaultPrevented, false);
  assert.equal(replyBar.classList.contains('hidden'), true);
  assert.equal(msgInput.value, '');
});

test('mobile message action buttons keep the keyboard for reply edit and react', async (t) => {
  const dom = await openSingleChatDom({
    chatMessagesByChatId: {
      1: [createIncomingMessage(1, 231, { user_id: 1, display_name: 'Alice', text: 'Action editable' })],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const replyBar = document.getElementById('replyBar');
  const reactionPicker = document.getElementById('reactionPicker');
  const row = document.querySelector('.msg-row[data-msg-id="231"]');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);

  dispatchPointerTap(dom.window, row.querySelector('.msg-reply-btn'));
  await wait(dom, 80);

  assert.equal(replyBar.classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');

  dispatchPointerTap(dom.window, row.querySelector('.msg-edit-btn'));
  await wait(dom, 80);

  assert.equal(msgInput.value, 'Action editable');
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');

  dispatchPointerTap(dom.window, row.querySelector('.msg-react-btn'));
  await wait(dom, 80);

  assert.equal(reactionPicker.classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('mobile message context convert action keeps the keyboard attached', async (t) => {
  const dom = await openSingleChatDom({
    chat: createChatFixture(1, 'Chat A', { context_transform_enabled: 1 }),
    chatMessagesByChatId: {
      1: [createIncomingMessage(1, 232, { user_id: 1, display_name: 'Alice', text: 'Transform this' })],
    },
    contextConvertAvailabilityByChatId: {
      1: {
        enabled: true,
        bots: [{ id: 7, name: 'Banana Convert', provider: 'openai' }],
      },
    },
    loadContextRuntime: true,
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const row = document.querySelector('.msg-row[data-msg-id="232"]');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 140);
  await openMobileKeyboard(dom, msgInput);

  const contextConvertBtn = row.querySelector('.msg-context-convert-btn');
  assert.ok(contextConvertBtn, 'Expected a message context convert action');

  dispatchPointerTap(dom.window, contextConvertBtn);
  await wait(dom, 100);

  assert.equal(document.getElementById('contextConvertPicker').classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('context transform restore original action updates the message and disappears', async (t) => {
  const dom = await openSingleChatDom({
    chatMessagesByChatId: {
      1: [
        createIncomingMessage(1, 233, {
          text: 'Transformed text',
          context_transform_original_available: 1,
        }),
        createIncomingMessage(1, 234, {
          text: 'Plain text',
          context_transform_original_available: 0,
        }),
      ],
    },
    loadContextRuntime: true,
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const transformedRow = document.querySelector('.msg-row[data-msg-id="233"]');
  const plainRow = document.querySelector('.msg-row[data-msg-id="234"]');

  const restoreBtn = transformedRow.querySelector('.msg-restore-original-btn');
  assert.ok(restoreBtn, 'Expected restore-original action for transformed message');
  assert.equal(plainRow.querySelector('.msg-restore-original-btn'), null);
  assert.match(restoreBtn.getAttribute('title') || '', /Restore original|Вернуть оригинал/);

  transformedRow.querySelector('.msg-bubble').dispatchEvent(new dom.window.MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 120,
    clientY: 300,
  }));
  await wait(dom, 40);
  assert.ok(document.querySelector('#reactionPicker .msg-restore-original-btn'), 'Expected restore action in long-press/right-click strip');

  dispatchPointerTap(dom.window, restoreBtn);
  await wait(dom, 120);

  const updatedRow = document.querySelector('.msg-row[data-msg-id="233"]');
  assert.equal(updatedRow.querySelector('.msg-text')?.textContent, 'Restored original');
  assert.equal(updatedRow.querySelector('.msg-restore-original-btn'), null);
});

test('mobile long-press reaction picker keeps the keyboard attached', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const reactionPicker = document.getElementById('reactionPicker');
  const row = appendMessageRow(dom, { id: 241, userId: 2, text: 'Long press me' });
  const bubble = row.querySelector('.msg-bubble');
  const touch = createTouchPoint({ identifier: 74, clientX: 180, clientY: 360 });
  const dateSeparator = document.createElement('div');
  dateSeparator.className = 'date-separator';
  dateSeparator.innerHTML = '<span>28 April 2026</span>';
  row.before(dateSeparator);

  await openMobileKeyboard(dom, msgInput);
  const dateRange = document.createRange();
  dateRange.selectNodeContents(dateSeparator.querySelector('span'));
  const selection = dom.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(dateRange);

  const touchStart = createTouchEvent(dom.window, 'touchstart', {
    touches: [touch],
    changedTouches: [touch],
  });
  bubble.dispatchEvent(touchStart);

  assert.equal(touchStart.defaultPrevented, false);
  assert.equal(row.classList.contains('reaction-long-press-pending'), true);
  assert.equal(selection.toString(), '28 April 2026');
  await wait(dom, 560);

  assert.equal(reactionPicker.classList.contains('hidden'), false);
  assert.equal(row.classList.contains('reaction-long-press-pending'), false);
  assert.equal(selection.rangeCount, 0);
  assert.equal(selection.toString(), '');
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');

  bubble.dispatchEvent(createTouchEvent(dom.window, 'touchend', {
    touches: [],
    changedTouches: [touch],
  }));
  await wait(dom, 80);

  assert.equal(row.classList.contains('actions-open'), false);
  assert.equal(document.activeElement, msgInput);
});

test('mobile long-press pending state clears when the gesture ends, cancels, or moves', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const reactionPicker = document.getElementById('reactionPicker');
  const row = appendMessageRow(dom, { id: 242, userId: 2, text: 'Cancel long press' });
  const bubble = row.querySelector('.msg-bubble');
  const startTouch = createTouchPoint({ identifier: 75, clientX: 180, clientY: 360 });

  bubble.dispatchEvent(createTouchEvent(dom.window, 'touchstart', {
    touches: [startTouch],
    changedTouches: [startTouch],
  }));
  assert.equal(row.classList.contains('reaction-long-press-pending'), true);
  bubble.dispatchEvent(createTouchEvent(dom.window, 'touchend', {
    touches: [],
    changedTouches: [startTouch],
  }));
  assert.equal(row.classList.contains('reaction-long-press-pending'), false);

  bubble.dispatchEvent(createTouchEvent(dom.window, 'touchstart', {
    touches: [startTouch],
    changedTouches: [startTouch],
  }));
  assert.equal(row.classList.contains('reaction-long-press-pending'), true);
  bubble.dispatchEvent(createTouchEvent(dom.window, 'touchcancel', {
    touches: [],
    changedTouches: [startTouch],
  }));
  assert.equal(row.classList.contains('reaction-long-press-pending'), false);

  bubble.dispatchEvent(createTouchEvent(dom.window, 'touchstart', {
    touches: [startTouch],
    changedTouches: [startTouch],
  }));
  assert.equal(row.classList.contains('reaction-long-press-pending'), true);
  const movedTouch = createTouchPoint({ identifier: 75, clientX: 195, clientY: 360 });
  bubble.dispatchEvent(createTouchEvent(dom.window, 'touchmove', {
    touches: [movedTouch],
    changedTouches: [movedTouch],
  }));
  assert.equal(row.classList.contains('reaction-long-press-pending'), false);

  await wait(dom, 540);
  assert.equal(reactionPicker.classList.contains('hidden'), true);
});

test('mobile text selection does not start the long-press reaction picker', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const reactionPicker = document.getElementById('reactionPicker');
  const row = appendMessageRow(dom, { id: 243, userId: 2, text: 'Keep this selection' });
  const text = row.querySelector('.msg-text');
  const range = document.createRange();
  range.selectNodeContents(text);
  const selection = dom.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const touch = createTouchPoint({ identifier: 76, clientX: 180, clientY: 360 });
  const touchStart = createTouchEvent(dom.window, 'touchstart', {
    touches: [touch],
    changedTouches: [touch],
  });

  text.dispatchEvent(touchStart);
  await wait(dom, 540);

  assert.equal(touchStart.defaultPrevented, false);
  assert.equal(row.classList.contains('reaction-long-press-pending'), false);
  assert.equal(reactionPicker.classList.contains('hidden'), true);
  assert.equal(selection.toString(), 'Keep this selection');
});

test('mobile pending attachment removal keeps the keyboard attached', async (t) => {
  const dom = await openSingleChatDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const fileInputGallery = document.getElementById('fileInputGallery');
  const pendingFile = document.getElementById('pendingFile');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  await openMobileKeyboard(dom, msgInput);

  Object.defineProperty(fileInputGallery, 'files', {
    configurable: true,
    value: [new dom.window.File(['image'], 'photo.jpg', { type: 'image/jpeg' })],
  });
  fileInputGallery.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await wait(dom, 100);

  const removeBtn = pendingFile.querySelector('.pending-file-remove');
  assert.ok(removeBtn, 'Expected pending attachment remove button');
  assert.equal(pendingFile.classList.contains('hidden'), false);

  const { touchStart, touchEnd } = dispatchTouchTap(dom.window, removeBtn);
  await wait(dom, 100);

  assert.equal(touchStart.defaultPrevented, true);
  assert.equal(touchEnd.defaultPrevented, true);
  assert.equal(BananzaAppBridge.getPendingFiles().length, 0);
  assert.equal(pendingFile.classList.contains('hidden'), true);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('mobile reply close keeps the keyboard attached', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const replyBar = document.getElementById('replyBar');
  const replyBarClose = document.getElementById('replyBarClose');

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  BananzaAppBridge.__testing.setReply(91, 'Bob', 'Quoted text');
  await openMobileKeyboard(dom, msgInput);

  const { touchStart, touchEnd } = dispatchTouchTap(dom.window, replyBarClose);
  await wait(dom, 100);

  assert.equal(touchStart.defaultPrevented, true);
  assert.equal(touchEnd.defaultPrevented, true);
  assert.equal(BananzaAppBridge.getReplyTo(), null);
  assert.equal(replyBar.classList.contains('hidden'), true);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('mobile edit close keeps the keyboard attached', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const attachBtn = document.getElementById('attachBtn');
  const replyBar = document.getElementById('replyBar');
  const replyBarClose = document.getElementById('replyBarClose');
  const row = appendMessageRow(dom, { id: 251, userId: 1, text: 'Editable close target' });

  BananzaAppBridge.__testing.setMobileBaseScene('chat', { hideInactive: true, syncChatMetrics: true });
  await wait(dom, 40);
  BananzaAppBridge.__testing.setEditFromRow(row);
  await openMobileKeyboard(dom, msgInput);

  const { touchStart, touchEnd } = dispatchTouchTap(dom.window, replyBarClose);
  await wait(dom, 100);

  assert.equal(touchStart.defaultPrevented, true);
  assert.equal(touchEnd.defaultPrevented, true);
  assert.equal(BananzaAppBridge.getEditTo(), null);
  assert.equal(replyBar.classList.contains('hidden'), true);
  assert.equal(attachBtn.disabled, false);
  assert.equal(msgInput.value, '');
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('mobile reaction more popover and tabs keep the keyboard attached', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const reactionPicker = document.getElementById('reactionPicker');
  const reactionEmojiPopover = document.getElementById('reactionEmojiPopover');
  const row = appendMessageRow(dom, { id: 261, userId: 2, text: 'Open more reactions' });
  const bubble = row.querySelector('.msg-bubble');
  const touch = createTouchPoint({ identifier: 75, clientX: 180, clientY: 360 });

  await openMobileKeyboard(dom, msgInput);
  bubble.dispatchEvent(createTouchEvent(dom.window, 'touchstart', {
    touches: [touch],
    changedTouches: [touch],
  }));
  await wait(dom, 560);

  const moreBtn = reactionPicker.querySelector('.reaction-more-button');
  assert.ok(moreBtn, 'Expected reaction more button');

  const { touchStart, touchEnd } = dispatchTouchTap(dom.window, moreBtn);
  await wait(dom, 100);

  assert.equal(touchStart.defaultPrevented, true);
  assert.equal(touchEnd.defaultPrevented, true);
  assert.equal(reactionPicker.classList.contains('hidden'), false);
  assert.equal(reactionEmojiPopover.classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');

  const tabs = Array.from(reactionEmojiPopover.querySelectorAll('.reaction-emoji-tab'));
  assert.ok(tabs.length > 1, 'Expected multiple reaction emoji tabs');
  const targetTab = tabs[1];
  dispatchTouchTap(dom.window, targetTab);
  await wait(dom, 100);

  assert.equal(targetTab.classList.contains('active'), true);
  assert.equal(reactionEmojiPopover.classList.contains('hidden'), false);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
});

test('mobile reaction emoji item keeps the keyboard attached after applying a reaction', async (t) => {
  const reactionRequests = [];
  const dom = await bootAppDom({
    fetchHandler: async ({ dom, url, init }) => {
      const match = url.pathname.match(/^\/api\/messages\/(\d+)\/reactions$/);
      if (!match || String(init?.method || '').toUpperCase() !== 'POST') return null;
      const body = JSON.parse(init.body || '{}');
      reactionRequests.push({ messageId: Number(match[1]), emoji: body.emoji });
      return createJsonResponse(dom, {
        reactions: [{ emoji: body.emoji, user_id: 1 }],
      });
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const app = document.getElementById('app');
  const msgInput = document.getElementById('msgInput');
  const reactionPicker = document.getElementById('reactionPicker');
  const reactionEmojiPopover = document.getElementById('reactionEmojiPopover');
  const row = appendMessageRow(dom, { id: 262, userId: 2, text: 'Pick more reaction' });
  const bubble = row.querySelector('.msg-bubble');
  const touch = createTouchPoint({ identifier: 76, clientX: 180, clientY: 360 });

  await openMobileKeyboard(dom, msgInput);
  bubble.dispatchEvent(createTouchEvent(dom.window, 'touchstart', {
    touches: [touch],
    changedTouches: [touch],
  }));
  await wait(dom, 560);
  dispatchTouchTap(dom.window, reactionPicker.querySelector('.reaction-more-button'));
  await wait(dom, 100);

  const item = reactionEmojiPopover.querySelector('.reaction-emoji-item');
  assert.ok(item, 'Expected an additional reaction emoji item');

  const { touchStart, touchEnd } = dispatchTouchTap(dom.window, item);
  await wait(dom, 360);

  assert.equal(touchStart.defaultPrevented, true);
  assert.equal(touchEnd.defaultPrevented, true);
  assert.equal(reactionRequests.length, 1);
  assert.equal(reactionRequests[0].messageId, 262);
  assert.equal(reactionRequests[0].emoji, item.dataset.emoji);
  assert.equal(reactionPicker.classList.contains('hidden'), true);
  assert.equal(reactionEmojiPopover.classList.contains('hidden'), true);
  assert.equal(document.activeElement, msgInput);
  assert.equal(app.style.height, '420px');
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

test('voice outbox shows transcription pending immediately when auto-transcribe is enabled', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 0 });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: { 1: [] },
    features: { auto_transcribe_on_send: true },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge, Blob } = dom.window;
  const voiceBlob = new Blob(['voice'], { type: 'audio/wav' });

  await dom.window.messageCache.upsertOutboxItem({
    clientId: 'c-voice-auto-transcribe',
    chatId: 1,
    userId: 1,
    status: 'queued',
    kind: 'voice',
    autoTranscribe: true,
    createdAt: new Date().toISOString(),
    text: null,
    replyToId: null,
    reply: null,
    attachments: [{
      localId: 'voice',
      file: voiceBlob,
      name: 'voice-note.wav',
      size: voiceBlob.size || 0,
      mime: 'audio/wav',
      type: 'audio',
    }],
    voice: {
      blob: voiceBlob,
      name: 'voice-note.wav',
      durationMs: 1200,
      sampleRate: 16000,
      mime: 'audio/wav',
    },
  });

  await BananzaAppBridge.__testing.openChat(1);
  await wait(dom, 160);

  const row = document.querySelector('.msg-row[data-client-id="c-voice-auto-transcribe"]');
  assert.ok(row, 'Expected optimistic voice row');
  assert.equal(row.__messageData.transcription_status, 'pending');
  assert.ok(row.classList.contains('voice-note-transcription-pending'));
  assert.equal(row.querySelector('.voice-transcribe-btn'), null);
  assert.match(row.querySelector('.voice-transcription-inline.pending')?.textContent || '', /Transcription|Расшифров/);
});

test('outbox websocket echo promotes the optimistic message row in place', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 0 });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: { 1: [] },
  });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  const item = {
    clientId: 'c-stable-promote',
    chatId: 1,
    userId: 1,
    status: 'sending',
    kind: 'message',
    createdAt: '2026-04-29T22:00:00.000Z',
    text: 'Stable send',
    replyToId: null,
    reply: null,
    attachments: [],
  };

  const row = BananzaAppBridge.__testing.renderOutboxItem(item);
  assert.ok(row, 'Expected optimistic row');
  row.classList.remove('entering');

  const serverMessage = createIncomingMessage(1, 901, {
    user_id: 1,
    username: 'alice',
    display_name: 'Alice',
    avatar_color: '#5eb5f7',
    text: 'Stable send',
    client_id: item.clientId,
    is_read: false,
  });
  emitWsMessage(dom, { type: 'message', message: serverMessage });
  await wait(dom, 30);

  const promoted = document.querySelector('.msg-row[data-msg-id="901"]');
  assert.equal(promoted, row);
  assert.equal(row.dataset.outbox, undefined);
  assert.equal(row.dataset.clientId, item.clientId);
  assert.equal(row.classList.contains('client-sending'), false);
  assert.equal(row.classList.contains('entering'), false);
  assert.equal(document.querySelectorAll('.msg-row[data-msg-id="901"]').length, 1);
  assert.equal(row.querySelector('.msg-text')?.textContent, 'Stable send');
  assert.ok(row.querySelector('.msg-actions'), 'Expected confirmed message actions');

  await BananzaAppBridge.__testing.completeOutboxSend(item, serverMessage);
  await wait(dom, 30);

  assert.equal(document.querySelector('.msg-row[data-msg-id="901"]'), row);
  assert.equal(document.querySelectorAll('.msg-row[data-msg-id="901"]').length, 1);
});

test('message update rerenders without replacing the message row or re-entering', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 902 });
  const message = createIncomingMessage(1, 902, {
    user_id: 1,
    username: 'alice',
    display_name: 'Alice',
    avatar_color: '#5eb5f7',
    text: 'Before edit',
  });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: { 1: [] },
  });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.appendMessage(message);
  await wait(dom, 20);
  const row = document.querySelector('.msg-row[data-msg-id="902"]');
  assert.ok(row, 'Expected rendered message row');
  row.classList.remove('entering');

  BananzaAppBridge.__testing.applyMessageUpdate({
    ...message,
    text: 'After edit',
    edited_at: '2026-04-29T22:01:00.000Z',
  });
  await wait(dom, 20);

  assert.equal(document.querySelector('.msg-row[data-msg-id="902"]'), row);
  assert.equal(row.classList.contains('entering'), false);
  assert.equal(row.querySelector('.msg-text')?.textContent, 'After edit');
  assert.ok(row.querySelector('.msg-edited'), 'Expected edited marker after update');
});

test('reaction updates keep the existing message row', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 903 });
  const message = createIncomingMessage(1, 903, {
    text: 'React in place',
  });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: { 1: [] },
  });
  t.after(() => {
    dom.window.close();
  });

  const { document, BananzaAppBridge } = dom.window;
  BananzaAppBridge.__testing.appendMessage(message);
  await wait(dom, 20);
  const row = document.querySelector('.msg-row[data-msg-id="903"]');
  assert.ok(row, 'Expected rendered message row');
  row.classList.remove('entering');

  emitWsMessage(dom, {
    type: 'reaction',
    chatId: 1,
    messageId: 903,
    reactions: [{ user_id: 1, emoji: '\uD83D\uDC4D' }],
    action: 'added',
    actorId: 1,
    targetUserId: 2,
  });
  await wait(dom, 20);

  assert.equal(document.querySelector('.msg-row[data-msg-id="903"]'), row);
  assert.equal(row.classList.contains('entering'), false);
  assert.equal(row.querySelectorAll('.reaction-badge').length, 1);
  assert.equal(row.__messageData.reactions.length, 1);
});

test('voice transcription update keeps bottom scroll after transcript expands bubble', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 608 });
  const baseMessages = createChatMessages(1, 5, { startId: 600 });
  const voiceMessage = createVoiceNoteMessage(1, 608, {
    created_at: '2026-04-29T12:08:00.000Z',
    transcription_status: 'pending',
  });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [...baseMessages, voiceMessage],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const layout = installMessagesViewportMock(dom, {
    viewportHeight: 180,
    rowHeight: 48,
    rowHeightForRow(row) {
      if (row?.dataset?.msgId === '608' && row.querySelector('.voice-transcription-compact-text')) {
        return 168;
      }
      return 48;
    },
  });

  layout.setScrollTop(layout.getBottomScrollTop());
  assert.equal(layout.scrollTop, layout.getBottomScrollTop());

  emitWsMessage(dom, {
    type: 'message_transcription',
    chatId: 1,
    messageId: 608,
    status: 'completed',
    text: 'Это длинная расшифровка голосового сообщения, которая делает облачко заметно выше и должна оставить чат в самом низу.',
    provider: 'test',
    model: 'mock',
    error: '',
  });
  await wait(dom, 220);

  const row = dom.window.document.querySelector('.msg-row[data-msg-id="608"]');
  assert.match(row.querySelector('.voice-transcription-compact-text')?.textContent || '', /длинная расшифровка/);
  assert.equal(layout.scrollTop, layout.getBottomScrollTop());
});

test('video note banana progress outline seeks without starting paused video', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 501 });
  const message = createVideoNoteMessage(1, 501, {
    video_note_shape_id: 'banana-fat',
    media_note_duration_ms: 18_000,
  });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;

  const row = document.querySelector('.msg-row[data-msg-id="501"]');
  const video = row.querySelector('.video-note-video');
  const hit = row.querySelector('.video-note-progress-hit');
  const mediaState = installMockMediaElement(dom, video, {
    duration: 18,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  video.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  hit.dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 124,
    clientY: 0,
  }));
  await wait(dom, 20);

  assert.ok(Math.abs(Number(video.currentTime || 0) - 9) < 0.2);
  assert.equal(mediaState.paused, true);
});

test('video note circle progress outline uses the active shape path for seeking', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 502 });
  const message = createVideoNoteMessage(1, 502, {
    video_note_shape_id: 'circle',
    media_note_duration_ms: 18_000,
  });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;

  const row = document.querySelector('.msg-row[data-msg-id="502"]');
  const video = row.querySelector('.video-note-video');
  const hit = row.querySelector('.video-note-progress-hit');
  const note = row.querySelector('.video-note');
  installMockMediaElement(dom, video, {
    duration: 18,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  video.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  assert.equal(note.dataset.shapeId, 'circle');
  hit.dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 124,
    clientY: 0,
  }));
  await wait(dom, 20);

  assert.ok(Math.abs(Number(video.currentTime || 0) - 9) < 0.2);
});

test('video note progress outline can seek an upper adjacent message when the lower stage receives the pointer event', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 504 });
  const upperMessage = createVideoNoteMessage(1, 503, { media_note_duration_ms: 18_000 });
  const lowerMessage = createVideoNoteMessage(1, 504, { media_note_duration_ms: 18_000 });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [upperMessage, lowerMessage],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;

  const upperRow = document.querySelector('.msg-row[data-msg-id="503"]');
  const lowerRow = document.querySelector('.msg-row[data-msg-id="504"]');
  const upperVideo = upperRow.querySelector('.video-note-video');
  const lowerVideo = lowerRow.querySelector('.video-note-video');
  installMockMediaElement(dom, upperVideo, {
    duration: 18,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  installMockMediaElement(dom, lowerVideo, {
    duration: 18,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });

  const upperSvg = upperRow.querySelector('.video-note-progress');
  const lowerSvg = lowerRow.querySelector('.video-note-progress');
  const rectFor = (top) => ({
    x: 0,
    y: top,
    top,
    left: 0,
    right: 248,
    bottom: top + 350,
    width: 248,
    height: 350,
    toJSON() {
      return this;
    },
  });
  upperSvg.getBoundingClientRect = () => rectFor(0);
  lowerSvg.getBoundingClientRect = () => rectFor(24);

  upperVideo.dispatchEvent(new dom.window.Event('durationchange'));
  lowerVideo.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  lowerRow.querySelector('.video-note-stage').dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 124,
    clientY: 0,
  }));
  await wait(dom, 20);

  assert.ok(Math.abs(Number(upperVideo.currentTime || 0) - 9) < 0.2);
  assert.equal(Number(lowerVideo.currentTime || 0), 0);
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

test('voice note progress outline seeks without starting paused audio', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 455 });
  const message = createVoiceNoteMessage(1, 455, { voice_duration_ms: 24_000 });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;

  const row = document.querySelector('.msg-row[data-msg-id="455"]');
  const audio = row.querySelector('audio');
  const hit = row.querySelector('.voice-note-progress-hit');
  const fill = row.querySelector('.voice-note-progress-fill');
  const mediaState = installMockMediaElement(dom, audio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  audio.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  hit.dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 124,
    clientY: 0,
  }));
  await wait(dom, 20);

  assert.ok(Math.abs(Number(audio.currentTime || 0) - 12) < 0.2);
  assert.equal(mediaState.paused, true);
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 50) < 1);
});

test('voice note progress outline clears completed state when seeking', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 466 });
  const message = createVoiceNoteMessage(1, 466, { voice_duration_ms: 24_000 });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  const row = document.querySelector('.msg-row[data-msg-id="466"]');
  const audio = row.querySelector('audio');
  const hit = row.querySelector('.voice-note-progress-hit');
  const fill = row.querySelector('.voice-note-progress-fill');
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
  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(row.__messageData, 'voice-note-audio'), true);
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 100) < 0.1);

  hit.dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 124,
    clientY: 0,
  }));
  await wait(dom, 20);

  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(row.__messageData, 'voice-note-audio'), false);
  assert.ok(Math.abs(Number(audio.currentTime || 0) - 12) < 0.2);
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 50) < 1);
});

test('call recording card renders media controls and seeks without starting paused audio', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 467 });
  const message = createCallMessage(1, 467, {
    call: { started_by_name: 'Kuzya' },
  });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;

  const row = document.querySelector('.msg-row[data-msg-id="467"]');
  const audio = row.querySelector('.call-recording-audio');
  const play = row.querySelector('.call-recording-play');
  const hit = row.querySelector('.call-recording-progress-hit');
  const fill = row.querySelector('.call-recording-progress-fill');
  const card = row.querySelector('.call-recording-card.has-call-recording');
  assert.ok(card);
  assert.ok(card.querySelector('.call-message-icon'));
  const meta = card.querySelector('.call-message-meta');
  const metaItems = meta.querySelectorAll('.call-message-meta-item');
  assert.ok(metaItems.length >= 2);
  assert.equal(meta.textContent.includes(' / '), false);
  assert.match(card.textContent, /Video call|Видеозвонок/);
  assert.ok(audio);
  assert.ok(play);
  assert.ok(hit);
  const audioSrc = audio.getAttribute('src') || '';
  assert.match(audioSrc, /[?&]token=test-token(?:$|&)/);
  assert.equal(audioSrc.includes('getToken'), false);

  const mediaState = installMockMediaElement(dom, audio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  audio.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  hit.dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 160,
    clientY: 0,
  }));
  await wait(dom, 20);

  assert.ok(Math.abs(Number(audio.currentTime || 0) - 12) < 0.2);
  assert.equal(mediaState.paused, true);
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 50) < 1);
});

test('completed call transcript moves re-transcribe into admin transcript modal', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 470 });
  const callId = 1470;
  const transcriptRun = {
    id: 71,
    call_id: callId,
    provider: 'voice',
    resolved_provider: 'vosk',
    strategy: 'hybrid',
    strategy_label: 'Hybrid',
    status: 'completed',
    transcript_ready: true,
    transcript_text: 'ready transcript',
  };
  const message = createCallMessage(1, 470, {
    call_id: callId,
    call: {
      id: callId,
      call_id: callId,
      status: 'ended',
      duration_ms: 24_000,
      can_join: false,
      mixed_recording: {
        id: callId + 2000,
        call_id: callId,
        status: 'completed',
        duration_ms: 24_000,
        size_bytes: 4096,
        mime_type: 'audio/ogg',
        url: `/api/calls/${callId}/recording/mixed`,
      },
      primary_transcript_run: transcriptRun,
      transcript_runs: [transcriptRun],
    },
    call_message: {
      call_id: callId,
      status: 'ended',
      duration_ms: 24_000,
      can_join: false,
      mixed_recording: {
        id: callId + 2000,
        call_id: callId,
        status: 'completed',
        duration_ms: 24_000,
        size_bytes: 4096,
        mime_type: 'audio/ogg',
        url: `/api/calls/${callId}/recording/mixed`,
      },
      primary_transcript_run: transcriptRun,
      transcript_runs: [transcriptRun],
    },
  });
  const callTranscribeRequests = [];
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
    callTranscribeRequests,
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  loadCallFeatureScripts(dom);
  await wait(dom, 80);

  assert.equal(document.querySelector(`[data-call-card-retranscribe="${callId}"]`), null);
  const transcriptButton = document.querySelector(`[data-call-card-transcript="${callId}"]`);
  assert.ok(transcriptButton);
  transcriptButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(dom, 80);

  const modal = document.getElementById('callTranscriptModal');
  assert.ok(modal);
  assert.equal(modal.classList.contains('hidden'), false);
  assert.equal(modal.querySelectorAll('.call-transcript-body.modal-body').length, 1);
  assert.equal(document.getElementById('callTranscriptDownload'), null);
  assert.equal(modal.textContent.includes('Download'), false);
  assert.equal(document.getElementById('callTranscriptText')?.textContent, 'ready transcript');
  assert.ok(document.getElementById('callTranscriptCopy'));

  const retranscribe = document.getElementById('callTranscriptRetranscribe');
  assert.ok(retranscribe);
  assert.equal(retranscribe.classList.contains('hidden'), false);
  assert.match(retranscribe.textContent, /Re-transcribe|Расшифровать заново/);
  retranscribe.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(dom, 40);

  assert.deepEqual(callTranscribeRequests, [{ callId, method: 'POST' }]);
});

test('completed call transcript hides re-transcribe for non-admin users', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 471 });
  const callId = 1471;
  const transcriptRun = {
    id: 72,
    call_id: callId,
    provider: 'voice',
    resolved_provider: 'vosk',
    strategy: 'hybrid',
    strategy_label: 'Hybrid',
    status: 'completed',
    transcript_ready: true,
    transcript_text: 'member transcript',
  };
  const message = createCallMessage(1, 471, {
    call_id: callId,
    call: {
      id: callId,
      call_id: callId,
      status: 'ended',
      duration_ms: 24_000,
      can_join: false,
      primary_transcript_run: transcriptRun,
      transcript_runs: [transcriptRun],
    },
    call_message: {
      call_id: callId,
      status: 'ended',
      duration_ms: 24_000,
      can_join: false,
      primary_transcript_run: transcriptRun,
      transcript_runs: [transcriptRun],
    },
  });
  const callTranscribeRequests = [];
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
    callTranscribeRequests,
    currentUserOverrides: { is_admin: 0 },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  loadCallFeatureScripts(dom);
  await wait(dom, 80);

  assert.equal(document.querySelector(`[data-call-card-retranscribe="${callId}"]`), null);
  document.querySelector(`[data-call-card-transcript="${callId}"]`)?.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await wait(dom, 80);

  const modal = document.getElementById('callTranscriptModal');
  assert.ok(modal);
  assert.equal(document.getElementById('callTranscriptText')?.textContent, 'member transcript');
  assert.equal(document.getElementById('callTranscriptDownload'), null);
  assert.equal(document.getElementById('callTranscriptRetranscribe')?.classList.contains('hidden'), true);
  assert.deepEqual(callTranscribeRequests, []);
});

test('voice call card keeps voice label even when call payload falls back to defaults', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 469 });
  const message = createCallMessage(1, 469, {
    text: 'Voice call',
    call: {
      started_by_name: 'Kuzya',
      media_kind: '',
      mediaKind: '',
    },
    call_message: {
      media_kind: '',
      mediaKind: '',
    },
  });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;

  const card = document.querySelector('.msg-row[data-msg-id="469"] .call-recording-card');
  assert.ok(card);
  assert.ok(card.classList.contains('is-voice-call-card'));
  assert.equal(card.querySelector('.call-message-icon-voice')?.textContent.trim(), String.fromCodePoint(0x260E, 0xFE0F));
  assert.match(card.textContent, /Audio call|Аудиозвонок/);
  assert.doesNotMatch(card.textContent, /Video call|Видеозвонок/);
});

test('call recording contour seek clears completed state and updates fill', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 468 });
  const message = createCallMessage(1, 468);
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  const row = document.querySelector('.msg-row[data-msg-id="468"]');
  const audio = row.querySelector('.call-recording-audio');
  const hit = row.querySelector('.call-recording-progress-hit');
  const fill = row.querySelector('.call-recording-progress-fill');
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
  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(row.__messageData, 'call-recording-audio'), true);
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 100) < 0.1);

  hit.dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 160,
    clientY: 0,
  }));
  await wait(dom, 20);

  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(row.__messageData, 'call-recording-audio'), false);
  assert.ok(Math.abs(Number(audio.currentTime || 0) - 12) < 0.2);
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 50) < 1);
});

test('call recording contour can seek an upper adjacent card when the lower card receives the pointer event', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 470 });
  const upperMessage = createCallMessage(1, 469, { call_id: 1469 });
  const lowerMessage = createCallMessage(1, 470, { call_id: 1470 });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [upperMessage, lowerMessage],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;

  const upperRow = document.querySelector('.msg-row[data-msg-id="469"]');
  const lowerRow = document.querySelector('.msg-row[data-msg-id="470"]');
  const upperAudio = upperRow.querySelector('.call-recording-audio');
  const lowerAudio = lowerRow.querySelector('.call-recording-audio');
  installMockMediaElement(dom, upperAudio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  installMockMediaElement(dom, lowerAudio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });

  const rectFor = (top) => ({
    x: 0,
    y: top,
    top,
    left: 0,
    right: 320,
    bottom: top + 84,
    width: 320,
    height: 84,
    toJSON() { return this; },
  });
  upperRow.querySelector('.call-recording-card').getBoundingClientRect = () => rectFor(0);
  upperRow.querySelector('.call-recording-progress').getBoundingClientRect = () => rectFor(0);
  lowerRow.querySelector('.call-recording-card').getBoundingClientRect = () => rectFor(34);
  lowerRow.querySelector('.call-recording-progress').getBoundingClientRect = () => rectFor(34);
  upperAudio.dispatchEvent(new dom.window.Event('durationchange'));
  lowerAudio.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  lowerRow.querySelector('.call-recording-card').dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 160,
    clientY: 0,
  }));
  await wait(dom, 20);

  assert.ok(Math.abs(Number(upperAudio.currentTime || 0) - 12) < 0.2);
  assert.equal(Number(lowerAudio.currentTime || 0), 0);
});

test('call AI summary modal uses one scroll body and expands long artifacts', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 471 });
  const longText = [
    '## Коротко',
    'Кузя и Наташа обсудили прошедший день.',
    '',
    '## Основные темы',
    ...Array.from({ length: 24 }, (_, index) => `- Пункт обсуждения ${index + 1}`),
  ].join('\n');
  const message = createCallArtifactMessage(1, 471, {
    call_artifact_batch: {
      runs: [
        {
          id: 9101,
          artifact_key: 'summary',
          key: 'summary',
          label: 'Summary',
          status: 'completed',
          result_text: longText,
        },
        {
          id: 9102,
          artifact_key: 'tasks',
          key: 'tasks',
          label: 'Tasks',
          status: 'completed',
          result_text: '1. Позвонить завтра\n2. Проверить настройки',
        },
        {
          id: 9103,
          artifact_key: 'decisions',
          key: 'decisions',
          label: 'Decisions',
          status: 'error',
          result_text: '',
          error: 'Model timeout',
        },
        {
          id: 9104,
          artifact_key: 'callshot',
          key: 'callshot',
          label: 'CallShot',
          status: 'completed',
          result_text: '',
          file: {
            id: 91040,
            original_name: 'callshot.png',
            stored_name: 'callshot.png',
            mime_type: 'image/png',
            size: 1234,
            type: 'image',
            url: '/uploads/callshot.png',
          },
        },
      ],
    },
  });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
    i18nStub: createRuCallArtifactI18nStub(),
  });
  t.after(() => dom.window.close());
  const { document } = dom.window;

  document.querySelector('[data-call-artifacts-open]').click();
  await wait(dom, 20);

  const modal = document.getElementById('callArtifactsModal');
  assert.ok(modal);
  assert.equal(document.querySelectorAll('#callArtifactsModal').length, 1);
  const header = modal.querySelector('.modal-header');
  const close = modal.querySelector('.modal-close');
  assert.ok(header);
  assert.equal(close?.parentElement, header);
  assert.equal(header.lastElementChild, close);
  assert.equal(header.querySelector('h3')?.textContent.trim(), 'AI-сводка звонка');

  const body = modal.querySelector('.call-artifacts-body.modal-body');
  assert.ok(body);
  assert.equal(modal.querySelectorAll('.call-artifacts-body').length, 1);
  assert.equal(modal.querySelectorAll('.call-transcript-text, .call-artifact-section, pre').length, 0);
  assert.equal(modal.textContent.includes('Call AI summary'), false);
  assert.equal(modal.textContent.includes('Ready'), false);
  assert.equal(modal.textContent.includes('Готово'), false);
  assert.ok(modal.textContent.includes('Саммари'));
  const completedStatuses = modal.querySelectorAll('.call-artifact-status.is-completed.is-icon-only');
  assert.equal(completedStatuses.length, 3);
  assert.equal(completedStatuses[0].textContent.trim(), '\u2713');
  assert.equal(completedStatuses[0].getAttribute('aria-label'), 'Готово');
  assert.equal(completedStatuses[0].getAttribute('title'), 'Готово');

  const collapsed = modal.querySelector('[data-call-artifact-text="9101"]');
  const shortText = modal.querySelector('[data-call-artifact-text="9102"]');
  const more = modal.querySelector('[data-call-artifact-more="9101"]');
  assert.ok(collapsed?.classList.contains('is-collapsed'));
  assert.ok(more);
  assert.match(more.textContent, /\u2192/);
  assert.equal(modal.querySelector('[data-call-artifact-more="9102"]'), null);
  assert.ok(shortText);
  assert.equal(modal.querySelector('[data-call-artifact-retry="9103"]')?.textContent.trim(), 'Повторить');

  more.click();
  assert.equal(collapsed.classList.contains('is-collapsed'), false);
  assert.equal(modal.querySelector('[data-call-artifact-more="9101"]'), null);

  let callshotButton = modal.querySelector('[data-call-artifact-image="9104"]');
  assert.ok(callshotButton);
  callshotButton.click();
  await wait(dom, 20);
  const imageViewer = document.getElementById('imageViewer');
  assert.equal(imageViewer.classList.contains('hidden'), false);
  assert.ok(imageViewer.querySelector('.iv-slide img')?.getAttribute('src')?.endsWith('/uploads/callshot.png'));

  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  await wait(dom, 20);
  assert.equal(imageViewer.classList.contains('hidden'), true);
  assert.equal(modal.classList.contains('hidden'), false);

  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  await wait(dom, 320);
  assert.equal(modal.classList.contains('hidden'), true);

  document.querySelector('[data-call-artifacts-open]').click();
  await wait(dom, 20);
  assert.equal(modal.classList.contains('hidden'), false);
  callshotButton = modal.querySelector('[data-call-artifact-image="9104"]');
  assert.ok(callshotButton);

  Object.defineProperty(dom.window, 'isSecureContext', {
    configurable: true,
    value: true,
  });
  dom.window.navigator.clipboard = {
    write() {
      return Promise.resolve();
    },
  };
  dom.window.ClipboardItem = class ClipboardItem {
    static supports(type) {
      return type === 'image/png';
    }

    constructor(items) {
      this.items = items;
    }
  };
  dom.window.navigator.canShare = () => true;
  dom.window.navigator.share = () => Promise.resolve();
  callshotButton.dispatchEvent(new dom.window.MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 160,
    clientY: 320,
  }));
  await wait(dom, 20);
  const mediaContextMenu = document.getElementById('mediaContextMenu');
  assert.equal(mediaContextMenu.classList.contains('hidden'), false);
  assert.equal(mediaContextMenu.getAttribute('aria-hidden'), 'false');
  assert.ok(mediaContextMenu.textContent.includes('callshot.png'));
  ['Copy image', 'Copy link', 'Save', 'Share'].forEach((label) => {
    assert.ok(mediaContextMenu.textContent.includes(label), `Expected media menu action: ${label}`);
  });
  assert.equal(mediaContextMenu.textContent.includes('React'), false);
  assert.equal(mediaContextMenu.textContent.includes('Forward'), false);
});

test('voice note progress outline can seek an upper adjacent message when the lower bubble receives the pointer event', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 478 });
  const upperMessage = createVoiceNoteMessage(1, 477, { voice_duration_ms: 24_000 });
  const lowerMessage = createVoiceNoteMessage(1, 478, { voice_duration_ms: 24_000 });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [upperMessage, lowerMessage],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;

  const upperRow = document.querySelector('.msg-row[data-msg-id="477"]');
  const lowerRow = document.querySelector('.msg-row[data-msg-id="478"]');
  const upperAudio = upperRow.querySelector('audio');
  const lowerAudio = lowerRow.querySelector('audio');
  installMockMediaElement(dom, upperAudio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  installMockMediaElement(dom, lowerAudio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });

  const upperSvg = upperRow.querySelector('.voice-note-progress');
  const lowerSvg = lowerRow.querySelector('.voice-note-progress');
  const rectFor = (top) => ({
    x: 0,
    y: top,
    top,
    left: 0,
    right: 248,
    bottom: top + 104,
    width: 248,
    height: 104,
    toJSON() {
      return this;
    },
  });
  upperSvg.getBoundingClientRect = () => rectFor(0);
  lowerSvg.getBoundingClientRect = () => rectFor(24);

  upperAudio.dispatchEvent(new dom.window.Event('durationchange'));
  lowerAudio.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  lowerRow.querySelector('.msg-bubble').dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 124,
    clientY: 0,
  }));
  await wait(dom, 20);

  assert.ok(Math.abs(Number(upperAudio.currentTime || 0) - 12) < 0.2);
  assert.equal(Number(lowerAudio.currentTime || 0), 0);
});

test('voice note bubble pointerdown away from the outline avoids expensive SVG hit-test', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 480 });
  const upperMessage = createVoiceNoteMessage(1, 479, { voice_duration_ms: 24_000 });
  const lowerMessage = createVoiceNoteMessage(1, 480, { voice_duration_ms: 24_000 });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [upperMessage, lowerMessage],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, SVGElement } = dom.window;

  const upperRow = document.querySelector('.msg-row[data-msg-id="479"]');
  const lowerRow = document.querySelector('.msg-row[data-msg-id="480"]');
  const upperAudio = upperRow.querySelector('audio');
  const lowerAudio = lowerRow.querySelector('audio');
  installMockMediaElement(dom, upperAudio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  installMockMediaElement(dom, lowerAudio, {
    duration: 24,
    currentTime: 0,
    paused: true,
    ended: false,
    readyState: 1,
  });
  upperAudio.dispatchEvent(new dom.window.Event('durationchange'));
  lowerAudio.dispatchEvent(new dom.window.Event('durationchange'));
  await wait(dom, 40);

  const originalGetPointAtLength = SVGElement.prototype.getPointAtLength;
  let getPointCalls = 0;
  SVGElement.prototype.getPointAtLength = function countedGetPointAtLength(length) {
    getPointCalls += 1;
    return originalGetPointAtLength.call(this, length);
  };

  lowerRow.querySelector('.msg-bubble').dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 124,
    clientY: 52,
  }));
  await wait(dom, 20);

  assert.equal(getPointCalls, 0);
  assert.equal(Number(upperAudio.currentTime || 0), 0);
  assert.equal(Number(lowerAudio.currentTime || 0), 0);
});

test('video note progress outline clears completed state when seeking', async (t) => {
  const chat = createChatFixture(1, 'Chat A', { lastMessageId: 505 });
  const message = createVideoNoteMessage(1, 505, { media_note_duration_ms: 18_000 });
  const dom = await openMediaPlaybackDom({
    activeChat: chat,
    chats: [chat],
    chatMessagesByChatId: {
      1: [message],
    },
  });
  t.after(() => {
    dom.window.close();
  });
  const { document, BananzaAppBridge } = dom.window;

  const row = document.querySelector('.msg-row[data-msg-id="505"]');
  const video = row.querySelector('.video-note-video');
  const hit = row.querySelector('.video-note-progress-hit');
  const fill = row.querySelector('.video-note-progress-fill');
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
  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(row.__messageData, 'video-note-video'), true);
  assert.ok(Math.abs(getDasharrayFilledLength(fill) - 100) < 0.1);

  hit.dispatchEvent(new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 124,
    clientY: 0,
  }));
  await wait(dom, 20);

  assert.equal(BananzaAppBridge.isMediaPlaybackCompleted(row.__messageData, 'video-note-video'), false);
  assert.ok(Math.abs(Number(video.currentTime || 0) - 9) < 0.2);
  assert.ok(getDasharrayFilledLength(fill) < 100);
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

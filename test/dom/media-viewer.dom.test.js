const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  installVisualViewportMock,
  loadBrowserScript,
  setDocumentHidden,
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

async function waitForViewportRecovery(dom, delayMs = 240) {
  await new Promise((resolve) => dom.window.setTimeout(resolve, delayMs));
}

async function wait(dom, delayMs = 0) {
  await new Promise((resolve) => dom.window.setTimeout(resolve, delayMs));
}

function getMobileSceneSnapshot(dom) {
  return dom.window.BananzaAppBridge.__testing.getMobileBaseSceneSnapshot();
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

function createTouchEndEvent(window, { clientX = 0, clientY = 0, identifier = 1 } = {}) {
  const event = new window.Event('touchend', { bubbles: true, cancelable: true });
  const touch = { identifier, clientX, clientY };
  Object.defineProperties(event, {
    touches: { configurable: true, value: [] },
    changedTouches: { configurable: true, value: [touch] },
  });
  return event;
}

function createPrimaryPointerEvent(window, type = 'pointerdown', { pointerType = 'touch' } = {}) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'button', {
    configurable: true,
    value: 0,
  });
  Object.defineProperty(event, 'pointerType', {
    configurable: true,
    value: pointerType,
  });
  return event;
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

function createChatFixture(chatId, name, { lastMessageId = chatId * 100 + 12 } = {}) {
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

test('emoji picker closes when navigating back out of the mobile chat view', async (t) => {
  const dom = await bootAppDom();
  t.after(() => {
    dom.window.close();
  });
  const { document } = dom.window;
  const sidebar = document.getElementById('sidebar');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  emojiBtn.dispatchEvent(new dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 40));
  assert.equal(emojiPicker.classList.contains('hidden'), false);

  sidebar.classList.add('sidebar-hidden');
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

  assert.equal(emojiPicker.classList.contains('hidden'), true);
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

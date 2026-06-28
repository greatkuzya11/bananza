const { test, expect } = require('@playwright/test');

const {
  getContext,
  installMediaMocks,
  makeUser,
  openPrivateChat,
  registerViaUi,
} = require('./helpers');

async function installFakeVisualViewport(page, options = {}) {
  await page.addInitScript(({ ios = false } = {}) => {
    if (ios) {
      const iosNavigator = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        platform: 'iPhone',
        maxTouchPoints: 5,
      };
      for (const [key, value] of Object.entries(iosNavigator)) {
        try {
          Object.defineProperty(window.navigator, key, {
            configurable: true,
            get() { return value; },
          });
        } catch {}
      }
    }

    const listeners = new Map();
    const state = {
      width: window.innerWidth || document.documentElement.clientWidth || 412,
      height: window.innerHeight || document.documentElement.clientHeight || 844,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
    };
    const fake = {
      get width() { return state.width; },
      get height() { return state.height; },
      get offsetTop() { return state.offsetTop; },
      get offsetLeft() { return state.offsetLeft; },
      get pageTop() { return state.offsetTop; },
      get pageLeft() { return state.offsetLeft; },
      get scale() { return state.scale; },
      addEventListener(type, callback) {
        if (typeof callback !== 'function') return;
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(callback);
      },
      removeEventListener(type, callback) {
        listeners.get(type)?.delete(callback);
      },
      dispatchEvent(event) {
        const type = event?.type || '';
        for (const callback of listeners.get(type) || []) {
          callback.call(fake, event);
        }
        const handler = fake[`on${type}`];
        if (typeof handler === 'function') handler.call(fake, event);
        return true;
      },
      onresize: null,
      onscroll: null,
    };

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      get() { return fake; },
    });

    window.__bananzaSetVisualViewport = (next = {}, eventType = 'resize') => {
      Object.assign(state, {
        width: Number(next.width ?? state.width) || state.width,
        height: Number(next.height ?? state.height) || state.height,
        offsetTop: Number(next.offsetTop ?? state.offsetTop) || 0,
        offsetLeft: Number(next.offsetLeft ?? state.offsetLeft) || 0,
        scale: Number(next.scale ?? state.scale) || 1,
      });
      fake.dispatchEvent(new Event(eventType));
    };
  }, options);
}

async function setFakeVisualViewport(page, next, eventType = 'resize') {
  await page.evaluate(({ nextViewport, type }) => {
    window.__bananzaSetVisualViewport(nextViewport, type);
  }, { nextViewport: next, type: eventType });
}

async function readFullVisualViewportHeight(page) {
  return page.evaluate(() => window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 844);
}

async function readComposerLayout(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const inputArea = document.querySelector('#chatView .input-area');
    const chatView = document.getElementById('chatView');
    const header = document.querySelector('#chatView .chat-header');
    const messages = document.getElementById('messages');
    const msgInput = document.getElementById('msgInput');
    const inputRect = inputArea.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const messagesRect = messages.getBoundingClientRect();
    const msgRect = msgInput.getBoundingClientRect();
    const rows = Array.from(messages.querySelectorAll('.msg-row[data-msg-id]'));
    const lastMessageRect = rows.length
      ? rows[rows.length - 1].getBoundingClientRect()
      : { top: 0, bottom: 0, height: 0 };
    const lateSpacerHeight = Array.from(messages.querySelectorAll('.keyboard-late-layout-test'))
      .reduce((total, node) => total + (node.getBoundingClientRect().height || 0), 0);
    const chatViewStyle = window.getComputedStyle(chatView);
    const cssViewportTop = parseFloat(root.style.getPropertyValue('--mobile-visual-viewport-top')) || 0;
    const cssViewportHeight = parseFloat(root.style.getPropertyValue('--mobile-visual-viewport-height')) || 0;
    const cssViewportBottom = parseFloat(root.style.getPropertyValue('--mobile-visual-viewport-bottom')) || (cssViewportTop + cssViewportHeight);
    const cssIosViewportTop = parseFloat(root.style.getPropertyValue('--ios-visual-viewport-top')) || 0;
    const cssIosViewportBottom = parseFloat(root.style.getPropertyValue('--ios-visual-viewport-bottom')) || cssViewportBottom;
    const cssInputHeight = parseFloat(root.style.getPropertyValue('--mobile-chat-input-area-height')) || 0;
    const messagesStyle = window.getComputedStyle(messages);
    return {
      cssInputHeight,
      cssViewportBottom,
      cssIosViewportTop,
      cssIosViewportBottom,
      fakeViewportHeight: window.visualViewport.height,
      fakeViewportTop: window.visualViewport.offsetTop,
      headerTop: headerRect.top,
      headerBottom: headerRect.bottom,
      headerHeight: headerRect.height,
      inputBottom: inputRect.bottom,
      inputTop: inputRect.top,
      inputHeight: inputRect.height,
      messagesTop: messagesRect.top,
      messagesBottom: messagesRect.bottom,
      messagesScrollTop: messages.scrollTop,
      messagesScrollHeight: messages.scrollHeight,
      messagesClientHeight: messages.clientHeight,
      messagesBottomGap: Math.max(0, messages.scrollHeight - messages.scrollTop - messages.clientHeight),
      messagesPaddingBottom: parseFloat(messagesStyle.paddingBottom) || 0,
      lastMessageBottom: lastMessageRect.bottom,
      lastMessageHeight: lastMessageRect.height,
      lateSpacerHeight,
      msgHeight: msgRect.height,
      chatViewPaddingTop: parseFloat(chatViewStyle.paddingTop) || 0,
      snapshot: window.BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot(),
    };
  });
}

async function appendSyntheticKeyboardMessages(page, finalKind) {
  await page.evaluate(({ kind }) => {
    const bridge = window.BananzaAppBridge;
    const testing = bridge.__testing;
    const chatId = Number(bridge.getCurrentChatId?.() || 0);
    const currentUser = bridge.getCurrentUser?.() || {};
    const otherUserId = (Number(currentUser.id || 0) || 1) + 1000;
    const baseId = kind === 'call-card' ? 880000 : (kind === 'voice-note' ? 890000 : 900000);
    const createdBase = Date.now();
    const common = {
      chat_id: chatId,
      user_id: otherUserId,
      display_name: 'Keyboard Bot',
      username: 'keyboard_bot',
      avatar_color: '#65aadd',
      is_read: true,
    };
    for (let index = 0; index < 30; index += 1) {
      testing.appendMessage({
        ...common,
        id: baseId + index,
        text: `Keyboard anchor filler ${index + 1}: long enough to make the message list scroll on mobile.`,
        created_at: new Date(createdBase + index * 1000).toISOString(),
      });
    }
    if (kind === 'call-card') {
      testing.appendMessage({
        ...common,
        id: baseId + 100,
        is_call_message: true,
        call: {
          id: baseId + 100,
          status: 'ended',
          media_kind: 'voice',
          room_mode: 'room',
          started_by_name: 'admin',
          duration_ms: 11000,
          can_join: false,
        },
        created_at: new Date(createdBase + 31000).toISOString(),
      });
    } else if (kind === 'voice-note') {
      testing.appendMessage({
        ...common,
        id: baseId + 100,
        file_id: baseId + 100,
        file_type: 'audio',
        file_name: 'voice-note.webm',
        file_stored: `keyboard-voice-note-${baseId}.webm`,
        is_voice_note: true,
        is_video_note: false,
        voice_duration_ms: 11000,
        transcription_status: 'idle',
        created_at: new Date(createdBase + 31000).toISOString(),
      });
    } else {
      testing.appendMessage({
        ...common,
        id: baseId + 100,
        text: 'Keyboard anchor final plain text message.',
        created_at: new Date(createdBase + 31000).toISOString(),
      });
    }
    const messages = document.getElementById('messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  }, { kind: finalKind });
}

async function scrollMessagesToBottom(page) {
  await page.evaluate(() => {
    const messages = document.getElementById('messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  });
}

async function growLastMessageSoon(page, height = 64) {
  await page.evaluate((spacerHeight) => {
    const messages = document.getElementById('messages');
    const rows = Array.from(messages?.querySelectorAll('.msg-row[data-msg-id]') || []);
    const lastRow = rows[rows.length - 1];
    const bubble = lastRow?.querySelector('.msg-bubble');
    if (!bubble) return;
    setTimeout(() => {
      const spacer = document.createElement('div');
      spacer.className = 'keyboard-late-layout-test';
      spacer.style.height = `${Math.max(0, Number(spacerHeight) || 0)}px`;
      spacer.style.minHeight = spacer.style.height;
      spacer.style.pointerEvents = 'none';
      bubble.appendChild(spacer);
    }, 60);
  }, height);
}

async function waitForLateMessageGrowth(page, previousHeight = 0) {
  const previous = Math.round(Math.max(0, Number(previousHeight) || 0));
  await expect.poll(async () => {
    const layout = await readComposerLayout(page);
    return Math.round(layout.lateSpacerHeight);
  }).toBeGreaterThan(previous);
}

async function expectIosKeyboardListAnchored(page) {
  await expect.poll(async () => {
    const layout = await readComposerLayout(page);
    return Math.round(layout.messagesBottomGap);
  }).toBeLessThanOrEqual(2);

  const layout = await readComposerLayout(page);
  expect(Math.round(layout.headerTop)).toBe(0);
  expect(Math.abs(Math.round(layout.inputBottom) - Math.round(layout.cssIosViewportBottom))).toBeLessThanOrEqual(2);
  expect(Math.round(layout.messagesBottom)).toBeLessThanOrEqual(Math.round(layout.inputTop) + 1);
  expect(Math.round(layout.lastMessageBottom)).toBeGreaterThanOrEqual(
    Math.round(layout.messagesBottom - layout.messagesPaddingBottom) - 2
  );
  return layout;
}

test('mobile composer stays docked when multiline paste causes visual viewport drift', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only regression');

  await installFakeVisualViewport(page);
  await installMediaMocks(page);

  const { bobUser } = getContext();
  const member = makeUser('pwcmp');

  await registerViaUi(page, member);
  await openPrivateChat(page, bobUser.displayName);

  const input = page.locator('#msgInput');
  await input.focus();
  await setFakeVisualViewport(page, { height: 430, offsetTop: 0 });

  await expect.poll(async () => {
    return page.evaluate(() => window.BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot());
  }).toMatchObject({
    keyboardOpen: true,
    chatKeyboardLayout: true,
  });

  const before = await readComposerLayout(page);
  const keyboardDockBottom = Math.round(before.inputBottom);

  await input.fill([
    'Draw a restaurant logo that is called fishdildos.',
    'That means fish and dildo.',
    'Keep it minimalist and clean.',
    'Use a short visual mark.',
  ].join('\n'));

  const afterPaste = await readComposerLayout(page);
  const pasteBottomDelta = Math.abs(Math.round(afterPaste.inputBottom) - keyboardDockBottom);
  const pasteKeyboardGap = keyboardDockBottom - Math.round(afterPaste.inputBottom);
  expect(pasteBottomDelta).toBeLessThanOrEqual(2);
  expect(Math.max(0, pasteKeyboardGap)).toBeLessThanOrEqual(2);
  expect(Math.round(afterPaste.cssViewportBottom)).toBe(keyboardDockBottom);

  const inputGrowth = Math.max(0, afterPaste.msgHeight - before.msgHeight);
  const viewportDrift = Math.max(48, Math.min(110, Math.round(inputGrowth || 64)));
  await setFakeVisualViewport(page, { height: 430 - viewportDrift, offsetTop: 0 });

  await expect.poll(async () => {
    const layout = await readComposerLayout(page);
    return Math.abs(Math.round(layout.inputBottom) - keyboardDockBottom);
  }).toBeLessThanOrEqual(2);

  const finalLayout = await readComposerLayout(page);
  const finalKeyboardGap = keyboardDockBottom - Math.round(finalLayout.inputBottom);
  expect(Math.round(finalLayout.fakeViewportHeight)).toBe(430 - viewportDrift);
  expect(Math.round(finalLayout.cssViewportBottom)).toBe(keyboardDockBottom);
  expect(Math.max(0, finalKeyboardGap)).toBeLessThanOrEqual(2);
  expect(finalLayout.snapshot.dockActive).toBeTruthy();
});

test('iOS mobile composer stays docked when visual viewport starts below the browser toolbar', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only regression');

  await installFakeVisualViewport(page, { ios: true });
  await installMediaMocks(page);

  const { bobUser } = getContext();
  const member = makeUser('pwios');

  await registerViaUi(page, member);
  await openPrivateChat(page, bobUser.displayName);

  const input = page.locator('#msgInput');
  await input.focus();
  await setFakeVisualViewport(page, { height: 430, offsetTop: 64 });

  await expect.poll(async () => {
    return page.evaluate(() => window.BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot());
  }).toMatchObject({
    keyboardOpen: true,
    chatKeyboardLayout: true,
    iosKeyboardOpen: true,
    iosChatKeyboardLayout: true,
  });

  const initialLayout = await readComposerLayout(page);
  const dockBottom = Math.round(initialLayout.cssIosViewportBottom);
  expect(Math.round(initialLayout.cssIosViewportTop)).toBe(64);
  expect(dockBottom).toBe(494);
  expect(Math.abs(Math.round(initialLayout.inputBottom) - dockBottom)).toBeLessThanOrEqual(2);
  expect(Math.round(initialLayout.headerTop)).toBe(0);
  expect(Math.round(initialLayout.chatViewPaddingTop)).toBe(Math.round(initialLayout.headerHeight));
  expect(Math.round(initialLayout.messagesTop)).toBeGreaterThanOrEqual(Math.round(initialLayout.headerBottom) - 1);

  await setFakeVisualViewport(page, { height: 430, offsetTop: 128 }, 'scroll');

  await expect.poll(async () => {
    const layout = await readComposerLayout(page);
    return Math.abs(Math.round(layout.inputBottom) - dockBottom);
  }).toBeLessThanOrEqual(2);

  const driftLayout = await readComposerLayout(page);
  expect(Math.round(driftLayout.headerTop)).toBe(0);
  expect(Math.round(driftLayout.cssIosViewportBottom)).toBe(494);
  expect(Math.round(driftLayout.messagesTop)).toBeGreaterThanOrEqual(Math.round(driftLayout.headerBottom) - 1);
});

[
  ['text-message', 'text message'],
  ['call-card', 'call card'],
  ['voice-note', 'voice note'],
].forEach(([finalKind, label]) => {
  test(`iOS keyboard keeps message list anchored with ${label} as the last message`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only regression');

    await installFakeVisualViewport(page, { ios: true });
    await installMediaMocks(page);

    const { bobUser } = getContext();
    const member = makeUser(`pwios${finalKind.replace(/[^a-z]/g, '')}`);

    await registerViaUi(page, member);
    await openPrivateChat(page, bobUser.displayName);

    const fullViewportHeight = await readFullVisualViewportHeight(page);
    await appendSyntheticKeyboardMessages(page, finalKind);
    await scrollMessagesToBottom(page);
    await expect.poll(async () => {
      const layout = await readComposerLayout(page);
      return Math.round(layout.messagesBottomGap);
    }).toBeLessThanOrEqual(2);

    const input = page.locator('#msgInput');
    await input.focus();
    const beforeFirstGrowth = (await readComposerLayout(page)).lateSpacerHeight;
    await growLastMessageSoon(page, finalKind === 'call-card' ? 72 : 56);
    await setFakeVisualViewport(page, { height: 430, offsetTop: 64 });
    await waitForLateMessageGrowth(page, beforeFirstGrowth);

    const firstOpen = await expectIosKeyboardListAnchored(page);
    expect(Math.round(firstOpen.cssIosViewportTop)).toBe(64);
    expect(Math.round(firstOpen.cssIosViewportBottom)).toBe(494);

    await input.evaluate((el) => el.blur());
    await setFakeVisualViewport(page, { height: fullViewportHeight, offsetTop: 0 });
    await page.waitForTimeout(240);
    await scrollMessagesToBottom(page);

    await input.focus();
    const beforeSecondGrowth = (await readComposerLayout(page)).lateSpacerHeight;
    await growLastMessageSoon(page, finalKind === 'call-card' ? 72 : 56);
    await setFakeVisualViewport(page, { height: 430, offsetTop: 64 });
    await waitForLateMessageGrowth(page, beforeSecondGrowth);

    const secondOpen = await expectIosKeyboardListAnchored(page);
    expect(Math.round(secondOpen.cssIosViewportTop)).toBe(64);
    expect(Math.round(secondOpen.cssIosViewportBottom)).toBe(494);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await input.evaluate((el) => el.blur());
      await page.waitForTimeout(240);
      await scrollMessagesToBottom(page);

      await input.focus();
      const beforeStickyGrowth = (await readComposerLayout(page)).lateSpacerHeight;
      await growLastMessageSoon(page, finalKind === 'call-card' ? 72 : 56);
      await setFakeVisualViewport(page, { height: 430, offsetTop: 64 }, cycle % 2 ? 'scroll' : 'resize');
      await waitForLateMessageGrowth(page, beforeStickyGrowth);

      const stickyOpen = await expectIosKeyboardListAnchored(page);
      expect(Math.round(stickyOpen.cssIosViewportTop)).toBe(64);
      expect(Math.round(stickyOpen.cssIosViewportBottom)).toBe(494);
    }
  });
});

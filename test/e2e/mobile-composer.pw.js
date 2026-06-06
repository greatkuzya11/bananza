const { test, expect } = require('@playwright/test');

const {
  getContext,
  installMediaMocks,
  makeUser,
  openPrivateChat,
  registerViaUi,
} = require('./helpers');

async function installFakeVisualViewport(page) {
  await page.addInitScript(() => {
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
  });
}

async function setFakeVisualViewport(page, next, eventType = 'resize') {
  await page.evaluate(({ nextViewport, type }) => {
    window.__bananzaSetVisualViewport(nextViewport, type);
  }, { nextViewport: next, type: eventType });
}

async function readComposerLayout(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const inputArea = document.querySelector('#chatView .input-area');
    const msgInput = document.getElementById('msgInput');
    const inputRect = inputArea.getBoundingClientRect();
    const msgRect = msgInput.getBoundingClientRect();
    const cssViewportTop = parseFloat(root.style.getPropertyValue('--mobile-visual-viewport-top')) || 0;
    const cssViewportHeight = parseFloat(root.style.getPropertyValue('--mobile-visual-viewport-height')) || 0;
    const cssInputHeight = parseFloat(root.style.getPropertyValue('--mobile-chat-input-area-height')) || 0;
    return {
      cssInputHeight,
      cssViewportBottom: cssViewportTop + cssViewportHeight,
      fakeViewportHeight: window.visualViewport.height,
      inputBottom: inputRect.bottom,
      inputHeight: inputRect.height,
      msgHeight: msgRect.height,
      snapshot: window.BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot(),
    };
  });
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

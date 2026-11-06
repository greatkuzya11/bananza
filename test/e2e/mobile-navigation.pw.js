const { test, expect } = require('./fixtures');

const {
  createApiSession,
  getContext,
  installMediaMocks,
  makeUser,
  openExistingChat,
  openPrivateChat,
  registerViaUi,
} = require('./helpers');

async function expectMobileScene(page, scene) {
  await expect.poll(async () => {
    return page.evaluate(() => window.BananzaAppBridge.__testing.getMobileBaseSceneSnapshot());
  }).toMatchObject(scene === 'sidebar'
    ? {
      scene: 'sidebar',
      sidebar: { sidebarHidden: false, mobileSceneHidden: false, inert: false },
      chatArea: { mobileSceneHidden: true, inert: true },
    }
    : {
      scene: 'chat',
      sidebar: { sidebarHidden: true, mobileSceneHidden: true, inert: true },
      chatArea: { mobileSceneHidden: false, inert: false },
    });
}

function hasSidebarRevealAnimation(calls = []) {
  return calls.some((call) => {
    const frames = Array.isArray(call?.frames) ? call.frames : [];
    const firstFrame = frames[0] || {};
    const lastFrame = frames[frames.length - 1] || {};
    return firstFrame.transform === 'translate3d(-100%,0,0)'
      && lastFrame.transform === 'translate3d(0,0,0)'
      && Number(call?.duration || 0) >= 240;
  });
}

async function installSidebarRevealProbe(page) {
  await page.evaluate(() => {
    if (window.__sidebarRevealDebug) {
      window.__sidebarRevealDebug.calls = [];
      return;
    }
    const sidebar = document.getElementById('sidebar');
    if (!(sidebar instanceof HTMLElement)) {
      throw new Error('Sidebar not found');
    }
    const originalAnimate = typeof sidebar.animate === 'function'
      ? sidebar.animate.bind(sidebar)
      : null;
    window.__sidebarRevealDebug = { calls: [] };
    if (!originalAnimate) return;
    sidebar.animate = function patchedSidebarAnimate(frames, options) {
      const normalizedFrames = Array.isArray(frames)
        ? frames.map((frame) => ({ transform: String(frame?.transform || '') }))
        : [];
      window.__sidebarRevealDebug.calls.push({
        frames: normalizedFrames,
        duration: Number(options?.duration || 0),
        historyState: history.state || null,
        scene: document.documentElement.dataset.mobileScene || null,
      });
      return originalAnimate(frames, options);
    };
  });
}

test('mobile chat exit animates for header back button and browser back', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only regression');

  await installMediaMocks(page);

  const { bobUser } = getContext();
  const member = makeUser('pwback');

  await registerViaUi(page, member);
  await installSidebarRevealProbe(page);
  await openPrivateChat(page, bobUser.displayName);
  await expectMobileScene(page, 'chat');

  await page.evaluate(() => {
    window.__sidebarRevealDebug.calls = [];
  });
  await page.locator('#backBtn').click();
  await expectMobileScene(page, 'sidebar');
  const inAppBackCalls = await page.evaluate(() => window.__sidebarRevealDebug.calls.slice());
  expect(
    hasSidebarRevealAnimation(inAppBackCalls),
    `Expected sidebar reveal animation for #backBtn, got ${JSON.stringify(inAppBackCalls)}`
  ).toBeTruthy();

  await openExistingChat(page, bobUser.displayName);
  await expectMobileScene(page, 'chat');

  await page.evaluate(() => {
    window.__sidebarRevealDebug.calls = [];
  });
  await page.goBack();
  await expectMobileScene(page, 'sidebar');
  const browserBackCalls = await page.evaluate(() => window.__sidebarRevealDebug.calls.slice());
  expect(
    hasSidebarRevealAnimation(browserBackCalls),
    `Expected sidebar reveal animation for browser back, got ${JSON.stringify(browserBackCalls)}`
  ).toBeTruthy();
});

test('cached chat refresh preserves media, current scroll, draft and a single route entry', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only regression');
  await installMediaMocks(page);
  const user = makeUser('pwstableopen');
  await registerViaUi(page, user);
  await page.evaluate(() => window.BananzaAppearance.apply(document, { theme: 'banan-hero', mode: 'glass' }));
  await openPrivateChat(page, getContext().bobUser.displayName);
  const api = createApiSession();
  await api.login(user);
  const chatId = await page.evaluate(() => window.BananzaAppBridge.getCurrentChatId());
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 900;
    canvas.getContext('2d').fillRect(0, 0, 300, 900);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const file = await api.uploadFile({ filename: 'entry-portrait.png', mimeType: 'image/png', body: Buffer.from(image, 'base64') });
  const photo = await api.request(`/api/chats/${chatId}/messages`, { method: 'POST', json: { fileIds: [file.id] } });
  await api.request(`/api/messages/${photo.data.id}/pin`, { method: 'POST', json: {} });
  for (let index = 0; index < 24; index += 1) {
    await api.request(`/api/chats/${chatId}/messages`, { method: 'POST', json: { text: `Stable history ${index}: ${'message text '.repeat(12)}` } });
  }
  await page.evaluate(id => window.BananzaAppBridge.openChat(id), chatId);
  await expect(page.locator('#messages .msg-image')).toHaveCount(1);
  await page.locator('#messages .msg-image').evaluate(img => img.decode());
  await expect.poll(() => page.evaluate(() => window.BananzaAppBridge.__testing.openChatState().chatOpenInProgress)).toBe(false);
  await page.locator('#backBtn').click();
  await expectMobileScene(page, 'sidebar');

  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requested = false;
  let refreshed = false;
  await page.route(`**/api/chats/${chatId}/messages?*`, async route => {
    if (new URL(route.request().url()).searchParams.has('before')) return route.continue();
    requested = true;
    await gate;
    const response = await route.fetch();
    await route.fulfill({ response });
    refreshed = true;
  });
  try {
    await page.evaluate(() => {
      window.__entryFrames = [];
      const sample = () => {
        const messages = document.getElementById('messages');
        const image = messages.querySelector('.msg-image');
        if (document.documentElement.dataset.mobileScene === 'chat' && image) {
          window.__entryFrames.push({
            imageHeight: image.getBoundingClientRect().height,
            gap: messages.scrollHeight - messages.clientHeight - messages.scrollTop,
          });
        }
        window.__entryFrame = requestAnimationFrame(sample);
      };
      window.__entryFrame = requestAnimationFrame(sample);
    });
    await openExistingChat(page, getContext().bobUser.displayName);
    await expectMobileScene(page, 'chat');
    await expect.poll(() => requested).toBe(true);
    const frames = await page.evaluate(() => {
      cancelAnimationFrame(window.__entryFrame);
      return window.__entryFrames;
    });
    expect(frames.length).toBeGreaterThan(0);
    expect(Math.max(...frames.map(frame => Math.abs(frame.gap)))).toBeLessThanOrEqual(2);
    const heights = frames.map(frame => frame.imageHeight);
    expect(Math.min(...heights)).toBeGreaterThan(100);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2);
    await page.evaluate(() => {
      const messages = document.getElementById('messages');
      const row = [...messages.querySelectorAll('.msg-row')].find(row => row.textContent.includes('Stable history 10:'));
      messages.scrollTop += row.getBoundingClientRect().top - messages.getBoundingClientRect().top - 20;
      window.__entryProbe = {
        image: messages.querySelector('.msg-image'), row,
        offset: row.getBoundingClientRect().top - messages.getBoundingClientRect().top,
        historyLength: history.length,
      };
    });
    await page.locator('#msgInput').fill('Draft typed while refreshing');
    // Keep an unsaved selection/reply state too: reopening must not run clearReply.
    await page.evaluate(() => window.BananzaAppBridge.__testing.setReply({ id: 123, display_name: 'Test', text: 'Keep reply' }));
    // Capture after the reply bar has changed the available message height.
    await page.evaluate(() => {
      window.__entryProbe.offset = window.__entryProbe.row.getBoundingClientRect().top - document.getElementById('messages').getBoundingClientRect().top;
    });
    release();
    await expect.poll(() => refreshed).toBe(true);
    await page.waitForTimeout(650);
    const result = await page.evaluate(() => {
      const messages = document.getElementById('messages');
      const probe = window.__entryProbe;
      return {
        sameImage: messages.querySelector('.msg-image') === probe.image,
        sameRow: probe.row.isConnected,
        drift: probe.row.getBoundingClientRect().top - messages.getBoundingClientRect().top - probe.offset,
        historyDelta: history.length - probe.historyLength,
      };
    });
    expect(result).toMatchObject({ sameImage: true, sameRow: true, historyDelta: 0 });
    expect(Math.abs(result.drift)).toBeLessThanOrEqual(2);
    await expect(page.locator('#msgInput')).toHaveValue('Draft typed while refreshing');
    await expect(page.locator('#replyBar')).toBeVisible();
  } finally {
    release();
  }
});

test('mobile chat exit normalizes stacked chat history for one-tap back flows', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only regression');

  await installMediaMocks(page);

  const { bobUser, bobUserId } = getContext();
  const member = makeUser('pwstack');
  const secondPeer = makeUser('pwpeer');

  const secondPeerSession = createApiSession();
  await secondPeerSession.register(secondPeer);

  await registerViaUi(page, member);

  const memberSession = createApiSession();
  await memberSession.login(member);
  await memberSession.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: bobUserId },
  });
  const secondChat = await memberSession.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: secondPeerSession.user.id },
  });

  await page.reload();
  await expect(page.locator('#chatList')).toContainText(bobUser.displayName);
  await expect(page.locator('#chatList')).toContainText(secondPeer.displayName);
  await installSidebarRevealProbe(page);

  await openExistingChat(page, bobUser.displayName);
  await page.evaluate(async (chatId) => {
    await window.BananzaAppBridge.__testing.openChat(chatId);
  }, secondChat.data.id);
  await expect(page.locator('#chatTitle')).toContainText(secondPeer.displayName);
  await expectMobileScene(page, 'chat');

  await page.evaluate(() => {
    window.__sidebarRevealDebug.calls = [];
  });
  await page.locator('#backBtn').click();
  await expectMobileScene(page, 'sidebar');
  const stackedHeaderBack = await page.evaluate(() => ({
    calls: window.__sidebarRevealDebug.calls.slice(),
    historyState: history.state || null,
    backLocked: Boolean(document.getElementById('backBtn').__isNavigating),
  }));
  expect(
    hasSidebarRevealAnimation(stackedHeaderBack.calls),
    `Expected stacked sidebar reveal animation for #backBtn, got ${JSON.stringify(stackedHeaderBack.calls)}`
  ).toBeTruthy();
  expect(stackedHeaderBack.historyState).toMatchObject({ view: 'chatlist' });
  expect(stackedHeaderBack.historyState?.chat).toBeUndefined();
  expect(stackedHeaderBack.backLocked).toBeFalsy();

  await openExistingChat(page, bobUser.displayName);
  await page.evaluate(async (chatId) => {
    await window.BananzaAppBridge.__testing.openChat(chatId);
  }, secondChat.data.id);
  await expect(page.locator('#chatTitle')).toContainText(secondPeer.displayName);
  await expectMobileScene(page, 'chat');

  await page.evaluate(() => {
    window.__sidebarRevealDebug.calls = [];
  });
  await page.goBack();
  await expectMobileScene(page, 'sidebar');
  const stackedBrowserBack = await page.evaluate(() => ({
    calls: window.__sidebarRevealDebug.calls.slice(),
    historyState: history.state || null,
  }));
  expect(
    hasSidebarRevealAnimation(stackedBrowserBack.calls),
    `Expected stacked sidebar reveal animation for browser back, got ${JSON.stringify(stackedBrowserBack.calls)}`
  ).toBeTruthy();
  expect(stackedBrowserBack.historyState).toMatchObject({ view: 'chatlist' });
  expect(stackedBrowserBack.historyState?.chat).toBeUndefined();
});

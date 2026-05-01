const { test, expect } = require('@playwright/test');

const {
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

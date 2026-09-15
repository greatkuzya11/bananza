const { test, expect } = require('@playwright/test');
const { installMediaMocks, makeUser, registerViaUi, openPrivateChat, getContext } = require('./helpers');

test('saved glass appearance has no legacy icons or underlying welcome scene during slow reload', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  await registerViaUi(page, makeUser('startupglass'), { appearance: false });
  const mobile = testInfo.project.name.includes('mobile');
  if (mobile) await page.setViewportSize({ width: 360, height: 780 });
  for (const theme of ['pearl', 'tokyo-night']) {
    await page.evaluate(async theme => {
      await window.BananzaAppBridge.api('/api/user/visual-mode', { method: 'PATCH', body: { mode: 'glass' } });
      const response = await window.BananzaAppBridge.api('/api/user/theme', { method: 'PATCH', body: { theme } });
      localStorage.setItem('user', JSON.stringify(response.user));
    }, theme);
    let releaseIcons, releaseBoot;
    const iconsGate = new Promise(resolve => { releaseIcons = resolve; });
    const bootGate = new Promise(resolve => { releaseBoot = resolve; });
    await page.route('**/js/ui-icons.js?*', async route => { await iconsGate; await route.continue(); });
    await page.route('**/js/sounds.js', async route => { await bootGate; await route.continue(); });
    try {
      await page.reload({ waitUntil: 'commit' });
      await expect(page.locator('html')).toHaveAttribute('data-visual-mode', 'glass');
      await expect(page.locator('html')).toHaveAttribute('data-ui-theme', theme);
      for (const selector of ['.sidebar-header h2', '#chatSearchToggle', '#chatFoldersBtn', '#newChatBtn', '#settingsBtn']) {
        await expect(page.locator(`${selector} > .ui-glyph`)).toBeVisible();
        await expect(page.locator(`${selector} > .ui-icon-legacy`)).toBeHidden();
      }
      if (mobile) {
        await expect(page.locator('#chatArea')).toHaveCSS('visibility', 'hidden');
        await expect(page.locator('#emptyState')).toBeHidden();
      } else {
        await expect(page.locator('.empty-icon > .ui-icon-legacy')).toBeHidden();
        await expect(page.locator('.empty-icon > .ui-glyph')).toBeVisible();
      }
      // Playwright's screenshot waits for fonts.ready, which waits for this deliberately blocked parser.
      const cdp = await page.context().newCDPSession(page);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      await require('node:fs/promises').writeFile(testInfo.outputPath(`before-icons-${theme}.png`), Buffer.from(shot.data, 'base64'));
      await cdp.detach();
      releaseIcons();
      // The icon observer must work while later parser-blocking app scripts are still loading.
      await expect(page.locator('#attachBtn > .ui-glyph')).toBeAttached();
      const dynamic = await page.evaluate(async () => {
        const button = document.createElement('button');
        button.className = 'icon-btn'; button.textContent = '\u2699';
        document.querySelector('.sidebar-header').append(button);
        await new Promise(requestAnimationFrame);
        const result = { icon: button.querySelector('.ui-glyph')?.dataset.icon,
          legacy: button.querySelector('.ui-icon-legacy') && getComputedStyle(button.querySelector('.ui-icon-legacy')).display };
        button.remove(); return result;
      });
      expect(dynamic).toEqual({ icon: 'settings', legacy: 'none' });
    } finally {
      releaseIcons(); releaseBoot();
      await page.waitForLoadState('domcontentloaded');
      await page.unroute('**/js/ui-icons.js?*');
      await page.unroute('**/js/sounds.js');
    }
    await expect(page.locator('#chatList .chat-item').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean(window.BananzaAppBridge?.api))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`loaded-${theme}.png`), animations: 'disabled' });
  }
  await openPrivateChat(page, getContext().bobUser.displayName);
  await expect(page.locator('#chatView')).toBeVisible();
  await expect(page.locator('#chatArea')).toHaveCSS('visibility', 'visible');
  if (mobile) {
    await page.locator('#backBtn').click();
    await expect(page.locator('#chatArea')).toBeHidden();
    await expect(page.locator('#chatList')).toBeVisible();
  }
});

const { test, expect } = require('./fixtures');
const { installMediaMocks, makeUser, registerViaUi, getContext, openPrivateChat } = require('./helpers');

test('chat header glass stays continuous while the action capsule collapses', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  await registerViaUi(page, makeUser('capsulepaint'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  const toggle = page.locator('#chatInfoBtn');
  for (const width of [438, 320, 584]) {
    await page.setViewportSize({ width, height: 780 });
    if (!await toggle.isVisible()) {
      await page.locator('#chatList .chat-item').filter({ hasText: getContext().bobUser.displayName }).first().click();
    }
    await page.evaluate(() => window.BananzaAppearance.apply(document, { theme: 'bananza', mode: 'glass' }));
    await page.mouse.move(0, 100);
    await page.waitForTimeout(500);
    const bounds = await page.locator('.chat-header').boundingBox();
    // The capsule is inset from the top. Its animation must never repaint a seam
    // across this uninterrupted strip of the glass surface (as in the reported video).
    const clip = { x: bounds.x, y: bounds.y, width: bounds.width, height: 2 };
    const baseline = await page.screenshot({ clip });
    await toggle.evaluate(el => el.click());
    await page.waitForTimeout(500);
    await toggle.evaluate(el => el.click());
    for (let frame = 0; frame < 12; frame++) {
      const strip = await page.screenshot({ clip });
      if (!strip.equals(baseline)) {
        await testInfo.attach('baseline-strip', { body: baseline, contentType: 'image/png' });
        await testInfo.attach('current-strip', { body: strip, contentType: 'image/png' });
      }
      expect(strip.equals(baseline), `glass seam at width ${width}, frame ${frame}`).toBe(true);
    }
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.locator('.chat-header').screenshot({ path: testInfo.outputPath(`closed-${width}.png`) });
  }
});

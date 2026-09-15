const { test, expect } = require('@playwright/test');
const { installMediaMocks, makeUser, registerViaUi } = require('./helpers');

// Exercise layout with native scrollbar gutters, which headless Chromium normally hides.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test('settings gear rotation never adds a sidebar gutter or shifts its center', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  await registerViaUi(page, makeUser('gearoverflow'));
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({ width: 360, height: 780 });
  for (const theme of ['pearl', 'tokyo-night']) {
    await page.evaluate(theme => window.BananzaAppearance.apply(document, { theme, mode: 'glass' }), theme);
    const before = await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar'), button = document.getElementById('settingsBtn');
      const measure = () => {
        const box = button.getBoundingClientRect(), footer = button.parentElement.getBoundingClientRect();
        return { width: sidebar.clientWidth, centerX: box.x + box.width / 2, centerY: box.y + box.height / 2,
          footerY: footer.y, scrollTop: sidebar.scrollTop };
      };
      window.gearLayoutFrames = [];
      button.addEventListener('animationstart', () => {
        const animation = button.getAnimations().find(a => a.animationName === 'chatHeaderActionSpin');
        if (!animation) return;
        const duration = animation.effect.getTiming().duration;
        animation.pause();
        for (const progress of [0, 0.1, 0.25, 0.45, 0.65, 0.85, 0.99]) {
          animation.currentTime = duration * progress;
          window.gearLayoutFrames.push(measure());
        }
        animation.currentTime = 0;
        animation.play();
      }, { once: true });
      return measure();
    });
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsModal')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.gearLayoutFrames.length)).toBe(7);
    for (const frame of await page.evaluate(() => window.gearLayoutFrames)) {
      expect(frame.width).toBe(before.width);
      expect(frame.centerX).toBeCloseTo(before.centerX, 1);
      expect(frame.centerY).toBeCloseTo(before.centerY, 1);
      expect(frame.footerY).toBeCloseTo(before.footerY, 1);
      expect(frame.scrollTop).toBe(0);
    }
    const body = page.locator('#settingsModal .modal-body');
    expect(await body.evaluate(el => { el.scrollTop = 120; return el.scrollTop; })).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath(`settings-${theme}.png`), animations: 'disabled' });
    await page.locator('#settingsModal .modal-close').click();
    await expect(page.locator('#settingsModal')).toBeHidden();
    expect(await page.locator('#chatList').evaluate(el => {
      const filler = document.createElement('div'); filler.style.height = '1800px'; el.append(filler);
      el.scrollTop = 120; const scrolled = el.scrollTop; filler.remove(); el.scrollTop = 0; return scrolled;
    })).toBeGreaterThan(0);
  }
});

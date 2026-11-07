const { test, expect } = require('./fixtures');
const { installMediaMocks, makeUser, registerViaUi, openPrivateChat, openExistingChat, openPollComposer, getContext } = require('./helpers');

async function expectPollGeometry(page) {
  const geometry = await page.locator('#pollComposerModal').evaluate((modal) => {
    const body = modal.querySelector('.modal-body');
    const submit = modal.querySelector('#pollSubmitBtn').getBoundingClientRect();
    const content = modal.querySelector('.modal-content').getBoundingClientRect();
    const rows = [...modal.querySelectorAll('.poll-option-editor')].map((row) => {
      const center = (el) => { const r = el.getBoundingClientRect(); return r.y + r.height / 2; };
      const input = row.querySelector('input');
      const button = row.querySelector('button');
      return {
        offset: Math.max(Math.abs(center(input) - center(button)), Math.abs(center(input) - center(row.firstElementChild))),
        buttonWidth: button.getBoundingClientRect().width,
        margin: getComputedStyle(input).marginBottom,
        border: getComputedStyle(input).borderTopWidth,
      };
    });
    return { rows, overflow: body.scrollWidth - body.clientWidth,
      submitBottom: submit.bottom, contentBottom: content.bottom, viewportHeight: innerHeight };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.submitBottom).toBeLessThanOrEqual(geometry.contentBottom);
  expect(geometry.submitBottom).toBeLessThanOrEqual(geometry.viewportHeight);
  for (const row of geometry.rows) {
    expect(row.offset).toBeLessThanOrEqual(1);
    expect(row.buttonWidth).toBe(44);
    expect(row.margin).toBe('0px');
    expect(row.border).toBe('0px');
  }
}

test('poll composer aligns options and keeps actions accessible across layouts and styles', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  await installMediaMocks(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await registerViaUi(page, makeUser('pollui'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  await openPollComposer(page, { mobile: testInfo.project.name.includes('mobile') });
  const modal = page.locator('#pollComposerModal');
  const preview = page.locator('#pollComposerPreview');
  const toggle = page.locator('#pollPreviewToggle');
  const options = page.locator('#pollOptionsList input');
  await expect(modal.locator('.modal-close > svg')).toHaveCount(1);
  await expect(options.first()).toHaveAttribute('placeholder', '\u0412\u0430\u0440\u0438\u0430\u043d\u0442 1');
  await page.locator('#pollQuestionInput').fill('Where should we meet this weekend?');
  await options.nth(0).fill('A long answer with enough text to fill the available space '.repeat(2));
  await options.nth(1).fill('At the park');

  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expectPollGeometry(page);
    const wide = await modal.locator('.modal-content').evaluate(el => el.clientWidth >= 720);
    if (wide) {
      await expect(toggle).toBeHidden();
      await expect(preview).toBeVisible();
    } else {
      await expect(toggle).toBeVisible();
      await expect(preview).toBeHidden();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(preview).toBeVisible();
      await toggle.click();
    }
    await expect(options.nth(1)).toHaveValue('At the park');
    for (const theme of ['bananza', 'pearl']) {
      for (const mode of ['classic', 'glass']) {
        await page.evaluate(({ theme, mode }) => window.BananzaAppearance.apply(document, { theme, mode }), { theme, mode });
        await expectPollGeometry(page);
      }
    }
    await page.evaluate(() => window.BananzaAppearance.apply(document, { theme: 'bananza', mode: 'glass' }));
    await modal.locator('.modal-body').evaluate(el => { el.scrollTop = 0; });
    await modal.screenshot({ path: testInfo.outputPath(`poll-${width}.png`) });
  }

  for (const style of ['stack', 'orbit', 'pulse']) {
    await page.locator('#pollComposerStyleBtn').click();
    await page.locator(`[data-poll-style-option="${style}"]`).click();
    await page.locator('#pollStyleSettingsModal .modal-close').click();
    await expect(preview.locator(`.poll-card--${style}`)).toBeVisible();
    await expect(page.locator('#pollComposerStyleBtn > span')).toHaveAttribute('data-i18n', 'Change');
    await expectPollGeometry(page);
    await modal.screenshot({ path: testInfo.outputPath(`poll-style-${style}.png`) });
  }

  await page.evaluate(() => window.BananzaI18n.setLanguage('en'));
  await expect(options.first()).toHaveAttribute('placeholder', 'Option 1');
  await expect(modal.locator('[data-poll-option-remove="0"]')).toHaveAttribute('aria-label', 'Remove option 1');
  await expect(options.nth(1)).toHaveValue('At the park');
  for (let i = 2; i < 10; i += 1) await page.locator('#pollAddOptionBtn').click();
  await expect(page.locator('#pollAddOptionBtn')).toBeDisabled();
  await expect(page.locator('#pollOptionsCount')).toHaveText('10/10');
  await modal.locator('[data-poll-option-remove="4"]').click();
  await expect(options.nth(4)).toBeFocused();
  await expect(page.locator('#pollAddOptionBtn')).toBeEnabled();
  await expectPollGeometry(page);
  await page.setViewportSize({ width: 390, height: 430 });
  await options.nth(8).fill('Last option');
  await expectPollGeometry(page);
  await page.locator('#pollQuestionInput').fill('');
  await page.locator('#pollSubmitBtn').click();
  await expect(page.locator('#pollComposerStatus')).not.toBeEmpty();
  await expectPollGeometry(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await toggle.click();
  await expect(preview).toBeVisible();
  await modal.locator('.modal-close').click();
  if (!(await page.locator('#attachBtn').isVisible())) await openExistingChat(page, getContext().bobUser.displayName);
  await openPollComposer(page, { mobile: true });
  await expect(preview).toBeHidden();
  await expect(options).toHaveCount(2);
  await expect(page.locator('#pollComposerStatus')).toBeEmpty();

  // A software keyboard can shrink only visualViewport while innerHeight stays unchanged.
  await options.last().focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 430 });
    Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: 24 });
    window.visualViewport.dispatchEvent(new Event('resize'));
    window.visualViewport.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('html')).toHaveClass(/is-mobile-keyboard-open/);
  await expect.poll(async () => (await page.locator('#pollSubmitBtn').boundingBox()).y
    + (await page.locator('#pollSubmitBtn').boundingBox()).height).toBeLessThanOrEqual(454);
  expect((await modal.locator('.modal-header').boundingBox()).y).toBeGreaterThanOrEqual(24);
  await options.last().fill('Keyboard draft');
  await page.evaluate(() => {
    delete window.visualViewport.height;
    delete window.visualViewport.offsetTop;
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect(options.last()).toHaveValue('Keyboard draft');
  await expectPollGeometry(page);
});

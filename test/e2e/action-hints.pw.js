const { test, expect } = require('./fixtures');
const { installMediaMocks, registerViaUi, makeUser, openSidebarActions, openPrivateChat, getContext } = require('./helpers');

test('capsule hints translate, fit the viewport and consume long presses without consuming the next tap', async ({ page }) => {
  await installMediaMocks(page);
  await page.route(/\/api\/(features|calls\/active)$/, async route => {
    const response = await route.fetch();
    const data = await response.json();
    const enabled = { calls_enabled: true, livekit_ready: true };
    await route.fulfill({ response, json: route.request().url().endsWith('/features')
      ? { ...data, ...enabled } : { ...data, settings: { ...data.settings, ...enabled } } });
  });
  await registerViaUi(page, makeUser('hints'));
  await page.setViewportSize({ width: 584, height: 780 });
  const hint = page.locator('#actionHintTooltip');
  const cdp = await page.context().newCDPSession(page);
  const interventions = [];
  await cdp.send('Log.enable');
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (entry.text.includes('Ignored attempt to cancel')) interventions.push(entry.text);
  });
  async function holdButton(id, expected) {
    const button = page.locator(`#${id}`);
    await page.waitForTimeout(450); // Let staggered entry and capsule resizing settle before using touch coordinates.
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    await button.evaluate(el => {
      el.dataset.activationEvents = '0';
      for (const name of ['pointerup', 'touchend', 'click']) el.addEventListener(name, () => {
        el.dataset.activationEvents = String(Number(el.dataset.activationEvents) + 1);
      }, { once: true });
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText(expected);
    const cancellationAttempts = await button.evaluate(el => {
      const event = new Event('touchend', { bubbles: true, cancelable: false });
      let attempts = 0;
      event.preventDefault = () => { attempts++; };
      el.dispatchEvent(event);
      return attempts;
    });
    expect(cancellationAttempts).toBe(0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await button.dispatchEvent('click'); // Delayed compatibility clicks must also be consumed.
    await expect(button).toHaveAttribute('data-activation-events', '0');
  }
  await page.evaluate(() => window.BananzaI18n.setLanguage('ru'));
  await holdButton('sidebarActionsToggle', 'Показать действия с чатами');
  await expect(page.locator('#sidebarActionsToggle')).toHaveAttribute('aria-expanded', 'false');
  await openSidebarActions(page);
  for (const [id, ru, en] of [
    ['chatSearchToggle', 'Поиск чатов', 'Search chats'],
    ['chatFoldersBtn', 'Папки чатов', 'Chat folders'],
    ['newChatBtn', 'Новый чат', 'New Chat'],
  ]) {
    await holdButton(id, ru);
    await page.evaluate(() => window.BananzaI18n.setLanguage('en'));
    await expect(hint).toHaveText(en);
    await page.evaluate(() => window.BananzaI18n.setLanguage('ru'));
  }
  await openPrivateChat(page, getContext().bobUser.displayName);
  await holdButton('chatInfoBtn', 'Показать действия чата');
  await page.locator('#chatInfoBtn').click();
  await page.evaluate(() => {
    const shot = document.getElementById('chatShotBtn');
    shot.classList.remove('hidden');
    shot.disabled = false;
  });
  await page.evaluate(() => window.BananzaI18n.setLanguage('en'));
  for (const [id, text] of [
    ['chatInfoBtn', 'Hide chat actions'], ['searchBtn', 'Search messages'],
    ['chatSettingsActionBtn', 'Chat settings'], ['callStartBtn', 'Start video call'],
    ['callVoiceStartBtn', 'Start voice call'], ['chatShotBtn', 'ChatShot'],
  ]) {
    await holdButton(id, text);
    await expect(page.locator('#chatInfoBtn')).toHaveAttribute('aria-expanded', 'true');
  }
  const actions = page.locator('#chatHeaderActions');
  await expect(actions).toHaveCSS('overflow-x', 'clip');
  await page.setViewportSize({ width: 320, height: 780 });
  await expect(actions).toHaveCSS('overflow-x', 'auto');
  await actions.evaluate(el => { el.scrollLeft = 0; });
  const firstAction = await page.locator('#searchBtn').boundingBox();
  const x = firstAction.x + firstAction.width / 2;
  const y = firstAction.y + firstAction.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (const distance of [15, 30, 60]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - distance, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => actions.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await expect(page.locator('#chatInfoBtn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#searchPanel')).toHaveAttribute('aria-hidden', 'true');
  expect(interventions).toEqual([]);
  await page.setViewportSize({ width: 584, height: 780 });
  await expect(actions).toHaveCSS('overflow-x', 'clip');
  expect(await actions.evaluate(el => el.scrollLeft)).toBe(0);
  await page.locator('#chatSettingsActionBtn').click();
  await expect(page.locator('#chatInfoModal')).toBeVisible();
  await expect(hint).toBeHidden();
  await page.locator('#chatInfoModal .modal-close').click();
  await page.setViewportSize({ width: 320, height: 780 });
  await page.locator('#chatInfoBtn').hover();
  await expect(hint).toHaveText('Show chat actions');
  await expect(hint).toBeVisible();
  await page.evaluate(() => window.BananzaI18n.setLanguage('ru'));
  await expect(hint).toHaveText('Показать действия чата');
  expect(await hint.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 8 && r.right <= innerWidth - 8; })).toBe(true);
  await page.screenshot({ path: test.info().outputPath('action-hint-ru.png') });
  await page.mouse.move(5, 300);
  await expect(hint).toBeHidden();
  await page.keyboard.press('Tab');
  await page.locator('#chatInfoBtn').focus();
  await expect(hint).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hint).toBeHidden();
  const box = await page.locator('#chatInfoBtn').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 10, y: box.y + 20 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 26, y: box.y + 20 }] });
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(hint).toBeHidden();
  await expect(page.locator('#chatInfoBtn')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#chatInfoBtn').click();
  await expect(page.locator('#chatInfoBtn')).toHaveAttribute('aria-expanded', 'true');
});

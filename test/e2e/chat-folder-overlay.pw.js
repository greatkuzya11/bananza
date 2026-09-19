const { test, expect } = require('@playwright/test');
const { installMediaMocks, makeUser, loginViaUi, createApiSession } = require('./helpers');

test('folder strip overlays scrolling chats and retains clicks, gestures and adaptive clearance', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  const user = makeUser('overlay');
  const api = createApiSession();
  await api.register(user);
  const chatIds = [];
  for (let i = 0; i < 22; i += 1) {
    const { data } = await api.request('/api/chats', {
      method: 'POST', json: { type: 'group', name: `Overlay chat ${i + 1}`, memberIds: [] },
    });
    chatIds.push(data.id);
    if (i < 4) await api.request(`/api/chats/${data.id}/sidebar-pin`, { method: 'PUT', json: { pinned: true } });
  }
  const { data: { folder } } = await api.request('/api/chat-folders', {
    method: 'POST', json: { name: 'Overlay folder', chatIds },
  });
  await api.request('/api/user/chat-folder-strip-visibility', { method: 'PATCH', json: { show_in_all_chats: true } });
  await loginViaUi(page, user);
  const list = page.locator('#chatList');
  const bar = page.locator('#activeChatFolderBar');
  const chip = page.locator(`#activeChatFolderStrip [data-folder-chip="${folder.id}"]`);
  await expect(bar).toBeVisible();
  await expect(list.locator('.chat-item').filter({ hasText: 'Overlay chat' })).toHaveCount(22);

  for (const mode of ['classic', 'rich', 'glass']) {
    for (const theme of ['pearl', 'tokyo-night']) {
      await page.evaluate(({ mode, theme }) => window.BananzaAppearance.apply(document, { mode, theme }), { mode, theme });
      await list.evaluate(el => { el.scrollTop = 0; });
      await expect.poll(() => page.evaluate(() => {
        const bar = document.getElementById('activeChatFolderBar');
        const list = document.getElementById('chatList');
        return Math.abs(parseFloat(getComputedStyle(list, '::before').height) - bar.offsetHeight);
      })).toBeLessThan(1);
      const initial = await page.evaluate(() => {
        const bar = document.getElementById('activeChatFolderBar').getBoundingClientRect();
        const list = document.getElementById('chatList');
        return { top: bar.top, bottom: bar.bottom, listTop: list.getBoundingClientRect().top,
          firstTop: list.firstElementChild.getBoundingClientRect().top };
      });
      expect(initial.listTop).toBeCloseTo(initial.top, 1);
      expect(initial.firstTop).toBeGreaterThanOrEqual(initial.bottom - 1);
      await list.evaluate(el => { el.scrollTop = 130; });
      const scrolled = await page.evaluate(() => {
        const bar = document.getElementById('activeChatFolderBar');
        const list = document.getElementById('chatList');
        const button = bar.querySelector('button');
        const rect = button.getBoundingClientRect();
        return { top: bar.getBoundingClientRect().top, firstTop: list.firstElementChild.getBoundingClientRect().top,
          hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('button') === button,
          blur: getComputedStyle(bar).backdropFilter, background: getComputedStyle(bar).backgroundColor };
      });
      expect(scrolled.top).toBeCloseTo(initial.top, 1);
      expect(scrolled.firstTop).toBeLessThan(initial.top);
      expect(scrolled.hit).toBe(true);
      expect(scrolled.blur).toBe('none');
      expect(scrolled.background).toBe('rgba(0, 0, 0, 0)');
      if (mode === 'glass') await page.screenshot({ path: testInfo.outputPath(`overlay-${theme}.png`) });
    }
  }

  await chip.click();
  await expect(chip).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => window.BananzaAppBridge.getCurrentChatId())).toBeFalsy();
  await expect(list.locator('.chat-item')).toHaveCount(22);

  // Drag a scrolled folder: the temporary page must preserve the same scroll position.
  await page.evaluate(() => { document.documentElement.dataset.modalAnimation = 'soft'; });
  await list.evaluate(el => { el.scrollTop = 130; });
  const box = await list.boundingBox();
  await page.mouse.move(box.x + 70, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 180, { steps: 4 });
  const swipePage = page.locator('.chat-folder-swipe-page[data-folder-swipe-role="current"]');
  await expect(swipePage).toBeAttached();
  expect(await swipePage.evaluate(el => el.scrollTop)).toBe(130);
  await expect(bar).toBeVisible();
  await page.mouse.move(box.x + box.width - 20, box.y + 180, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#activeChatFolderStrip [data-folder-chip="0"]')).toHaveAttribute('aria-selected', 'true');

  // ResizeObserver must follow actual bar size, independently of refresh padding.
  await bar.evaluate(el => { el.style.paddingBottom = '24px'; });
  await expect.poll(() => page.evaluate(() => {
    const bar = document.getElementById('activeChatFolderBar');
    return parseFloat(getComputedStyle(document.getElementById('chatList'), '::before').height) === bar.offsetHeight;
  })).toBe(true);
  await bar.evaluate(el => { el.style.paddingBottom = ''; });
  await page.locator('#chatSearchToggle').click();
  await page.locator('#chatSearch').fill('Overlay chat 1');
  await expect(list.locator('.chat-item')).toHaveCount(11);
  await page.locator('#chatSearchClear').click();

  if (testInfo.project.name.includes('mobile')) {
    await page.setViewportSize({ width: 360, height: 780 });
    await list.evaluate(el => { el.scrollTop = 0; });
    await expect.poll(() => page.evaluate(() => document.getElementById('sidebar').classList.contains('is-chat-list-refreshing'))).toBe(false);
    await list.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const touch = y => new Touch({ identifier: 1, target: el, clientX: rect.x + 100, clientY: y });
      for (const [type, y] of [['touchstart', rect.y + 150], ['touchmove', rect.y + 230]]) {
        el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: [touch(y)] }));
      }
    });
    await expect(page.locator('#sidebar')).toHaveClass(/is-chat-list-pull-visible/);
    const refreshLayout = await page.evaluate(() => {
      const bar = document.getElementById('activeChatFolderBar');
      const list = document.getElementById('chatList');
      return { barBottom: bar.getBoundingClientRect().bottom, barHeight: bar.offsetHeight,
        indicatorTop: document.getElementById('chatListPullIndicator').getBoundingClientRect().top,
        spacer: parseFloat(getComputedStyle(list, '::before').height), padding: parseFloat(getComputedStyle(list).paddingTop) };
    });
    expect(refreshLayout.spacer).toBe(refreshLayout.barHeight);
    expect(refreshLayout.padding).toBeGreaterThan(0);
    expect(refreshLayout.indicatorTop).toBeGreaterThanOrEqual(refreshLayout.barBottom);
    await list.dispatchEvent('touchcancel', { touches: [] });
    await expect.poll(() => list.evaluate(el => getComputedStyle(el).paddingTop)).toBe('0px');
  }

  await api.request('/api/user/chat-folder-strip-visibility', { method: 'PATCH', json: { show_in_all_chats: false } });
  await expect(bar).toBeHidden();
  await expect.poll(() => list.evaluate(el => getComputedStyle(el, '::before').height)).toBe('0px');
});

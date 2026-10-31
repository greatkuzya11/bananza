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

  const expectSwipeBack = async ({ dx, folderId, edge = false, cancel = false }) => {
    await expect(page.locator('.chat-folder-list-surface')).not.toHaveClass(/is-folder-(switching|swipe-(dragging|settling|preparing|paging))/);
    await list.evaluate(el => { el.scrollTop = 130; });
    const motion = await list.evaluate(async (el, { dx, edge, cancel, touchInput }) => {
      const surface = el.closest('.chat-folder-list-surface');
      const rect = surface.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      const y = rect.y + 180;
      const dispatch = (phase, offset) => {
        if (touchInput) {
          const touch = new Touch({ identifier: 42, target: el, clientX: x + offset, clientY: y });
          el.dispatchEvent(new TouchEvent(`touch${phase}`, {
            bubbles: true, cancelable: true,
            touches: phase === 'start' || phase === 'move' ? [touch] : [],
            changedTouches: [touch],
          }));
        } else {
          const type = { start: 'mousedown', move: 'mousemove', end: 'mouseup' }[phase];
          el.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true, button: 0,
            buttons: phase === 'end' ? 0 : 1, clientX: x + offset, clientY: y,
          }));
        }
      };
      dispatch('start', 0);
      dispatch('move', dx);
      const track = surface.querySelector('.chat-folder-swipe-track');
      const currentPage = surface.querySelector('[data-folder-swipe-role="current"]');
      const target = edge ? surface : track;
      const visiblePage = edge ? surface : currentPage;
      const dragged = visiblePage.getBoundingClientRect().left - rect.left;
      // Commit the dragged position before releasing, then inspect the actual CSS transition.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      dispatch(cancel ? 'cancel' : 'end', dx);
      const animation = target.getAnimations().find(entry => entry.transitionProperty === 'transform');
      if (!animation) throw new Error('Expected a swipe return transition');
      animation.pause();
      animation.currentTime = Number(animation.effect.getTiming().duration) / 2;
      const halfway = visiblePage.getBoundingClientRect().left - rect.left;
      const pageScroll = visiblePage.scrollTop;
      animation.play();
      return { dragged, halfway, pageScroll, hasPager: Boolean(track) };
    }, { dx, edge, cancel, touchInput: testInfo.project.name.includes('mobile') });
    expect(motion.hasPager).toBe(!edge);
    expect(Math.sign(motion.dragged)).toBe(Math.sign(dx));
    expect(Math.abs(motion.halfway)).toBeLessThan(Math.abs(motion.dragged));
    expect(motion.halfway * Math.sign(dx)).toBeGreaterThanOrEqual(-1);
    if (!edge) expect(motion.pageScroll).toBe(130);
    await expect(page.locator('.chat-folder-list-surface')).not.toHaveClass(/is-folder-swipe-(dragging|settling|preparing|paging)/);
    await expect(page.locator('.chat-folder-swipe-stage')).toHaveCount(0);
    await expect(list).not.toHaveClass(/is-folder-swipe-source/);
    await expect(page.locator(`#activeChatFolderStrip [data-folder-chip="${folderId}"]`)).toHaveAttribute('aria-selected', 'true');
    expect(await list.evaluate(el => el.scrollTop)).toBe(130);
    expect(await page.evaluate(() => window.BananzaAppBridge.getCurrentChatId())).toBeFalsy();
  };

  await page.evaluate(() => { document.documentElement.dataset.modalAnimation = 'soft'; });
  await expectSwipeBack({ dx: 40, folderId: folder.id });
  await expectSwipeBack({ dx: -40, folderId: folder.id, edge: true });
  if (testInfo.project.name.includes('mobile')) {
    // Cancellation must return even when the gesture has crossed the commit threshold.
    await expectSwipeBack({ dx: 140, folderId: folder.id, cancel: true });
  }

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

  await expectSwipeBack({ dx: -40, folderId: 0 });
  await expectSwipeBack({ dx: 40, folderId: 0, edge: true });

  // ResizeObserver must follow actual bar size, independently of refresh padding.
  await bar.evaluate(el => { el.style.height = `${el.offsetHeight + 24}px`; });
  await expect.poll(() => page.evaluate(() => {
    const bar = document.getElementById('activeChatFolderBar');
    return parseFloat(getComputedStyle(document.getElementById('chatList'), '::before').height) === bar.offsetHeight;
  })).toBe(true);
  await bar.evaluate(el => { el.style.height = ''; });
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

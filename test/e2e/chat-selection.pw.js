const { test, expect } = require('./fixtures');
const { openSidebarActions, installMediaMocks, makeUser, loginViaUi, createApiSession } = require('./helpers');

test('selected chats can be deleted together after one confirmation', async ({ page }) => {
  await installMediaMocks(page);
  const user = makeUser('delete-bulk');
  const api = createApiSession();
  await api.register(user);
  const ids = [];
  for (const name of ['Delete batch Alpha', 'Delete batch Beta', 'Keep untouched']) {
    const { data } = await api.request('/api/chats', { method: 'POST', json: { type: 'group', name, memberIds: [] } });
    ids.push(data.id);
  }
  const errors = [];
  const deletes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'DELETE') deletes.push(new URL(request.url()).pathname);
  });
  await loginViaUi(page, user);
  await openSidebarActions(page);
  await page.locator('#chatSearchToggle').click();
  await page.locator('#chatSearch').fill('Delete batch');
  const row = id => page.locator(`#chatList [data-chat-id="${id}"]`);
  await expect(row(ids[0])).toBeVisible();
  await row(ids[0]).click({ modifiers: ['Control'] });
  await row(ids[1]).click();
  const action = name => page.locator(`[data-selection-action="${name}"]`);
  await action('actions').click();
  await action('delete').click();
  await expect(page.locator('#appDialog')).toBeVisible();
  await expect(page.locator('#appDialogMessage')).toContainText('(2)');
  await page.keyboard.press('Escape');
  await expect(page.locator('#appDialog')).toBeHidden();
  await expect(page.locator('#chatList input:checked')).toHaveCount(2);
  expect(deletes).toEqual([]);
  await action('actions').click();
  await action('delete').click();
  await page.locator('#appDialog button[type="submit"]').click();
  await expect(page.locator('#chatSelectionPanel')).toBeHidden();
  await expect(row(ids[0])).toHaveCount(0);
  await expect(row(ids[1])).toHaveCount(0);
  expect(deletes).toEqual(ids.slice(0, 2).map(id => `/api/chats/${id}`));
  const { data: chats } = await api.request('/api/chats');
  expect(chats.some(chat => chat.id === ids[2])).toBe(true);
  expect(chats.some(chat => ids.slice(0, 2).includes(chat.id))).toBe(false);
  expect(errors).toEqual([]);
});

test('bulk actions in a filtered folder persist, isolate unselected chats and recover from a partial failure', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await installMediaMocks(page);
  const user = makeUser('folder-bulk');
  const api = createApiSession();
  await api.register(user);
  const ids = [];
  for (const name of ['Batch Selected Alpha', 'Batch Selected Beta', 'Batch Other', 'Outside folder']) {
    const { data } = await api.request('/api/chats', { method: 'POST', json: { type: 'group', name, memberIds: [] } });
    ids.push(data.id);
  }
  const { data: { folder: source } } = await api.request('/api/chat-folders', { method: 'POST', json: { name: 'Source', chatIds: ids.slice(0, 3) } });
  const { data: { folder: target } } = await api.request('/api/chat-folders', { method: 'POST', json: { name: 'Target', chatIds: [] } });
  await api.request(`/api/chats/${ids[0]}/preferences`, { method: 'PUT', json: { notify_enabled: true, sounds_enabled: false } });
  await api.request(`/api/chats/${ids[1]}/preferences`, { method: 'PUT', json: { notify_enabled: false, sounds_enabled: true } });
  await api.request('/api/user/chat-folder-strip-visibility', { method: 'PATCH', json: { show_in_all_chats: true } });
  const preferences = async id => (await api.request(`/api/chats/${id}/preferences`)).data.preferences;
  const members = async id => (await api.request('/api/chat-folders')).data.folders.find(folder => folder.id === id).chat_ids.sort((a, b) => a - b);
  const untouched = await Promise.all(ids.slice(2).map(preferences));
  const errors = [];
  const writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (['POST', 'PUT', 'DELETE'].includes(request.method())) {
      writes.push({ path: new URL(request.url()).pathname, method: request.method(), body: request.postDataJSON() });
    }
  });
  await loginViaUi(page, user);
  await page.locator(`[data-folder-chip="${source.id}"]`).click();
  await expect(page.locator('#chatList .chat-item')).toHaveCount(3);
  await openSidebarActions(page);
  await page.locator('#chatSearchToggle').click();
  await page.locator('#chatSearch').fill('Batch Selected');
  await expect(page.locator('#chatList .chat-item')).toHaveCount(2);
  const panel = page.locator('#chatSelectionPanel');
  const row = id => page.locator(`#chatList [data-chat-id="${id}"]`);
  const menu = page.locator('#chatContextMenu');
  const action = name => panel.locator(`[data-selection-action="${name}"]`);
  const cdp = testInfo.project.name.includes('mobile') ? await page.context().newCDPSession(page) : null;
  const selectVisible = async () => {
    if (cdp) {
      const box = await row(ids[0]).boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      await expect(menu).toBeVisible();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await row(ids[0]).click({ button: 'right' });
    await menu.locator('[data-chat-action="select-chat"]').click();
    await action('actions').click();
    await action('all').click();
    await expect(page.locator('#chatList input:checked')).toHaveCount(2);
  };

  await selectVisible();
  await action('actions').click();
  await action('folders').click();
  const beforeAdd = writes.length;
  await action(`folder:${target.id}`).click();
  await expect(panel).toBeHidden();
  expect(await members(target.id)).toEqual(ids.slice(0, 2));
  expect(await members(source.id)).toEqual(ids.slice(0, 3));
  const addRequests = writes.slice(beforeAdd).filter(request => request.path === `/api/chat-folders/${target.id}/chats`);
  expect(addRequests).toHaveLength(1);
  expect(addRequests[0].body.chatIds.sort((a, b) => a - b)).toEqual(ids.slice(0, 2));

  for (const command of ['notify-off', 'notify-on', 'sound-off', 'sound-on']) {
    const field = command.startsWith('notify') ? 'notify_enabled' : 'sounds_enabled';
    const otherField = field === 'notify_enabled' ? 'sounds_enabled' : 'notify_enabled';
    const before = await Promise.all(ids.slice(0, 2).map(preferences));
    await selectVisible();
    await action('actions').click();
    const beforeWrites = writes.length;
    // Hold the first real request to verify that UI changes and repeated launches are blocked.
    let release;
    if (command === 'notify-off') {
      const gate = new Promise(resolve => { release = resolve; });
      await page.route(`**/api/chats/${ids[0]}/preferences`, async route => { await gate; await route.continue(); }, { times: 1 });
    }
    await action(command).click();
    if (release) {
      await expect(panel).toHaveAttribute('aria-busy', 'true');
      await expect(action('actions')).toBeDisabled();
      await expect(action('cancel')).toBeDisabled();
      await action('actions').dispatchEvent('click');
      await row(ids[1]).click();
      await expect(page.locator('#chatList input:checked')).toHaveCount(2);
      release();
    }
    await expect(panel).toBeHidden();
    const changed = writes.slice(beforeWrites).filter(request => request.path.endsWith('/preferences'));
    expect(changed.map(request => request.path)).toEqual(ids.slice(0, 2).map(id => `/api/chats/${id}/preferences`));
    for (const request of changed) expect(request.body).toEqual({ [field]: command.endsWith('-on') });
    for (const [index, id] of ids.slice(0, 2).entries()) {
      const after = await preferences(id);
      expect(after[field]).toBe(command.endsWith('-on'));
      expect(after[otherField]).toBe(before[index][otherField]);
    }
    expect(await Promise.all(ids.slice(2).map(preferences))).toEqual(untouched);
  }

  // Inject one HTTP failure; the other deletion still reaches the real server.
  await page.route(`**/api/chat-folders/${source.id}/chats/${ids[1]}`, route => route.fulfill({ status: 503, json: { error: 'Temporary test failure' } }), { times: 1 });
  await selectVisible();
  await action('actions').click();
  await action('remove').click();
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#chatList input:checked')).toHaveCount(1);
  await expect(row(ids[1]).locator('input')).toBeChecked();
  await expect(row(ids[0])).toHaveCount(0);
  expect(await members(source.id)).toEqual(ids.slice(1, 3));
  await expect(page.locator('#centerToast')).toHaveText(/(?:Обновлено чатов|Updated chats): 1\. (?:Не удалось|Failed): 1\./);
  await action('actions').click();
  await action('remove').click();
  await expect(panel).toBeHidden();
  expect(await members(source.id)).toEqual([ids[2]]);
  expect(await members(target.id)).toEqual(ids.slice(0, 2));
  await page.reload();
  await expect(page.locator(`[data-folder-chip="${source.id}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(row(ids[2])).toBeVisible();
  await expect(row(ids[0])).toHaveCount(0);
  await page.locator(`[data-folder-chip="${target.id}"]`).click();
  await expect(page.locator('#chatList .chat-item')).toHaveCount(2);
  for (const id of ids.slice(0, 2)) {
    await expect(row(id)).toBeVisible();
    expect(await preferences(id)).toMatchObject({ notify_enabled: true, sounds_enabled: true });
  }
  expect((await api.request('/api/chats')).data.map(chat => chat.id)).toEqual(expect.arrayContaining(ids));
  expect(errors).toEqual([]);
});

test('chat hold, selection and bulk actions work with mouse and touch', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  const user = makeUser('selection');
  const api = createApiSession();
  await api.register(user);
  const ids = [];
  for (const name of ['Alpha', 'Beta', 'Gamma']) {
    const { data } = await api.request('/api/chats', { method: 'POST', json: { type: 'group', name: `Selection ${name}`, memberIds: [] } });
    ids.push(data.id);
  }
  const { data: { folder } } = await api.request('/api/chat-folders', { method: 'POST', json: { name: 'Selection folder', chatIds: [] } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await loginViaUi(page, user);
  const row = id => page.locator(`#chatList .chat-item[data-chat-id="${id}"]`);
  await expect(row(ids[0])).toBeVisible();
  const menu = page.locator('#chatContextMenu');
  const panel = page.locator('#chatSelectionPanel');
  const mobile = testInfo.project.name.includes('mobile');
  const cdp = mobile ? await page.context().newCDPSession(page) : null;
  const hold = async id => {
    const box = await row(id).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    else { await page.mouse.move(x, y); await page.mouse.down(); }
    await expect(menu).toBeVisible();
    // Keep holding beyond the old click-suppression deadline.
    await page.waitForTimeout(1000);
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
    await expect(menu).toBeVisible();
  };
  await hold(ids[0]);
  expect(await page.evaluate(() => window.BananzaAppBridge.getCurrentChatId())).toBeFalsy();
  await row(ids[0]).dispatchEvent('contextmenu', { bubbles: true });
  await expect(menu).toBeVisible();
  // A real WS list refresh must not dismiss the open menu.
  await api.request(`/api/chats/${ids[2]}/preferences`, { method: 'PUT', json: { sounds_enabled: false } });
  await page.waitForTimeout(350);
  await expect(menu).toBeVisible();
  await menu.locator('[data-chat-action="select-chat"]').click();
  await expect(panel).toBeVisible();
  await expect(row(ids[0]).locator('input')).toBeChecked();
  await row(ids[1]).click();
  await expect(row(ids[1]).locator('input')).toBeChecked();
  expect(await page.evaluate(() => window.BananzaAppBridge.getCurrentChatId())).toBeFalsy();
  await panel.locator('[data-selection-action="actions"]').click();
  await page.screenshot({ path: testInfo.outputPath('chat-selection.png') });
  await panel.locator('[data-selection-action="notify-off"]').click();
  await expect(panel).toBeHidden();
  for (const id of ids.slice(0, 2)) {
    const { data } = await api.request(`/api/chats/${id}/preferences`);
    expect(data.preferences.notify_enabled).toBe(false);
  }
  if (!mobile) {
    await row(ids[0]).click({ modifiers: ['Control'] });
    await expect(row(ids[0]).locator('input')).toBeChecked();
  } else {
    await hold(ids[0]);
    await menu.locator('[data-chat-action="select-chat"]').click();
  }
  await row(ids[1]).click();
  await panel.locator('[data-selection-action="actions"]').click();
  await panel.locator('[data-selection-action="folders"]').click();
  await panel.locator(`[data-selection-action="folder:${folder.id}"]`).click();
  await expect(panel).toBeHidden();
  const { data } = await api.request('/api/chat-folders');
  expect(data.folders.find(item => item.id === folder.id).chat_ids).toEqual(expect.arrayContaining(ids.slice(0, 2)));
  await row(ids[0]).click();
  await expect.poll(() => page.evaluate(() => window.BananzaAppBridge.getCurrentChatId())).toBe(ids[0]);
  expect(errors).toEqual([]);
});

test('selection keeps geometry and consistent paint across themes, with accessible keyboard controls', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  const user = makeUser('selection-layout');
  const api = createApiSession();
  await api.register(user);
  const ids = [];
  for (const name of ['Alpha', 'Beta', 'Gamma']) {
    const { data } = await api.request('/api/chats', { method: 'POST', json: { type: 'group', name: `Layout ${name}`, memberIds: [] } });
    ids.push(data.id);
    await api.request(`/api/chats/${data.id}/messages`, { method: 'POST', json: { text: `Preview for ${name}` } });
  }
  await loginViaUi(page, user);
  const row = id => page.locator(`#chatList .chat-item[data-chat-id="${id}"]`);
  const panel = page.locator('#chatSelectionPanel');
  const actions = panel.locator('[data-selection-action="actions"]');
  const geometry = () => page.evaluate(ids => {
    const rect = el => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    };
    return [rect(document.querySelector('.sidebar-header')), rect(document.getElementById('chatList')),
      ...ids.flatMap(id => {
        const row = document.querySelector(`#chatList [data-chat-id="${id}"]`);
        return [row, ...row.querySelectorAll('.chat-item-avatar, .chat-item-name, .chat-item-time, .chat-item-preview')].map(rect);
      })];
  }, ids);
  const paint = id => row(id).evaluate(el => {
    const s = getComputedStyle(el);
    return { background: s.backgroundColor, image: s.backgroundImage, shadow: s.boxShadow, color: s.color,
      preview: getComputedStyle(el.querySelector('.chat-item-last')).color };
  });
  await expect(row(ids[0])).toBeVisible();
  // Opening a real chat retains the active row on desktop; mobile returns to the list.
  await row(ids[0]).click();
  if (testInfo.project.name.includes('mobile')) await page.locator('#backBtn').click();
  await expect(row(ids[0])).toBeVisible();
  await openSidebarActions(page);
  await page.locator('#chatSearchToggle').click();
  await page.locator('#chatSearch').fill('Layout');
  await expect(page.locator('#chatList .chat-item')).toHaveCount(3);

  for (const mode of ['classic', 'rich', 'glass']) {
    for (const theme of ['pearl', 'tokyo-night']) {
      await page.evaluate(({ mode, theme }) => window.BananzaAppearance.apply(document, { mode, theme }), { mode, theme });
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
      const before = await geometry();
      const normalPaint = await paint(ids[0]);
      await row(ids[0]).click({ modifiers: ['Control'] });
      await expect(panel).toBeVisible();
      await expect(row(ids[0]).locator('input')).toBeChecked();
      await row(ids[1]).click();
      expect(await geometry()).toEqual(before);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
      expect(await paint(ids[0])).toEqual(await paint(ids[1]));
      await row(ids[0]).hover();
      await page.waitForTimeout(200);
      expect(await paint(ids[0])).toEqual(await paint(ids[1]));
      await row(ids[2]).hover();
      await expect(row(ids[0]).locator('.chat-selection-badge')).toBeVisible();
      await expect(row(ids[2]).locator('.chat-selection-badge')).toBeHidden();
      await page.screenshot({ path: testInfo.outputPath(`selection-${mode}-${theme}.png`) });
      await actions.click();
      expect(await geometry()).toEqual(before);
      await expect(panel.locator('.chat-selection-actions')).toBeVisible();
      // Outside click closes the menu without changing selection.
      await page.locator('.sidebar-footer').click({ position: { x: 3, y: 3 } });
      await expect(panel.locator('.chat-selection-actions')).toHaveCount(0);
      await expect(row(ids[1]).locator('input')).toBeChecked();
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
      expect(await geometry()).toEqual(before);
      expect(await paint(ids[0])).toEqual(normalPaint);
    }
  }

  await row(ids[0]).click({ modifiers: ['Control'] });
  const checkbox = row(ids[0]).locator('input');
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).not.toBeChecked();
  await expect(panel.locator('.chat-selection-count')).toHaveText(/0/);
  await expect(actions).toBeEnabled();
  await actions.click();
  await expect(panel.locator('[data-selection-action="notify-on"]')).toBeDisabled();
  await panel.locator('[data-selection-action="all"]').click();
  await expect(page.locator('#chatList input:checked')).toHaveCount(3);
  await page.locator('#chatList input').first().focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#chatList input').nth(1)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#chatList input:checked')).toHaveCount(2);
  await actions.click();
  await panel.locator('[data-selection-action="folders"]').click();
  await expect(panel.locator('.chat-selection-actions')).toContainText(/Нет пользовательских папок|No custom folders/);
  await page.keyboard.press('Escape');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.chat-selection-actions')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

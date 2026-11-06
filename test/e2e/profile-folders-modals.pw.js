const { test, expect } = require('./fixtures');
const { installMediaMocks, makeUser, loginViaUi, createApiSession } = require('./helpers');

async function surfaceStyle(page, selector) {
  return page.locator(`${selector} .modal-content`).evaluate(el => {
    const style = getComputedStyle(el);
    const header = getComputedStyle(el.querySelector('.modal-header'));
    return { background: style.background, radius: style.borderRadius, width: style.width,
      headerPadding: header.padding, shadow: style.boxShadow };
  });
}

async function expectContainedModal(page, selector) {
  await expect.poll(() => page.locator(selector).evaluate(el => {
    const rect = el.querySelector('.modal-content').getBoundingClientRect();
    return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
      && Math.abs(rect.left + rect.width / 2 - innerWidth / 2) < 1
      && Math.abs(rect.top + rect.height / 2 - innerHeight / 2) < 1;
  })).toBe(true);
  const body = page.locator(`${selector} .modal-body`);
  expect(await body.evaluate(el => getComputedStyle(el).overflowY)).toBe('auto');
  expect(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
}

test('profile and folders share modal layout and preserve navigation and nested dialogs', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await installMediaMocks(page);
  const user = makeUser('modals');
  const api = createApiSession();
  await api.register(user);
  const folderIds = [];
  for (let i = 0; i < 18; i += 1) {
    const { data: { folder } } = await api.request('/api/chat-folders', {
      method: 'POST', json: { name: `Folder ${i + 1} with a long readable name`, chatIds: [] },
    });
    folderIds.push(folder.id);
  }
  await loginViaUi(page, user);
  const picker = page.locator('#chatFolderPicker');
  const profile = page.locator('#menuDrawer');

  for (const mode of ['classic', 'glass']) {
    for (const theme of ['pearl', 'tokyo-night']) {
      await page.evaluate(({ mode, theme }) => window.BananzaAppearance.apply(document, { mode, theme }), { mode, theme });
      await page.locator('#settingsBtn').click();
      await expectContainedModal(page, '#settingsModal');
      const reference = await surfaceStyle(page, '#settingsModal');
      await page.locator('#settingsModal .modal-close').click();
      await expect(page.locator('#settingsModal')).toBeHidden();

      await page.locator('#currentUserInfo').click();
      await expect(profile).toHaveAttribute('aria-modal', 'true');
      await page.locator('#profileUserStatusSelect').selectOption('custom');
      await page.locator('#profileCustomStatus').fill('Profile layout check');
      await expectContainedModal(page, '#menuDrawer');
      expect(await surfaceStyle(page, '#menuDrawer')).toEqual(reference);
      await page.locator('#saveProfileBtn').scrollIntoViewIfNeeded();
      await expect(page.locator('#saveProfileBtn')).toBeInViewport();
      await page.locator('#profileLogoutBtn').scrollIntoViewIfNeeded();
      await expect(page.locator('#profileLogoutBtn')).toBeInViewport();
      await expect(profile.locator('.modal-header')).toBeInViewport();
      await profile.locator('.modal-body').evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: testInfo.outputPath(`profile-${mode}-${theme}.png`) });
      await profile.locator('.modal-close').click();
      await expect(profile).toBeHidden();

      await page.locator('#chatFoldersBtn').click();
      await expect(picker).toHaveAttribute('role', 'dialog');
      await expect(picker).toHaveAttribute('aria-modal', 'true');
      await expectContainedModal(page, '#chatFolderPicker');
      expect(await surfaceStyle(page, '#chatFolderPicker')).toEqual(reference);
      await expect(picker.locator('[data-folder-select]')).toHaveCount(19);
      await expect(picker.locator('[data-folder-id="0"] [data-chat-folder-strip-toggle]')).toHaveCount(0);
      expect(await picker.locator('.chat-folder-picker-list').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      await picker.locator('[data-folder-select]').last().scrollIntoViewIfNeeded();
      await expect(picker.locator('[data-folder-select]').last()).toBeInViewport();
      await expect(picker.locator('.modal-header')).toBeInViewport();
      await picker.locator('.modal-body').evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: testInfo.outputPath(`folders-${mode}-${theme}.png`) });
      await picker.locator('.modal-close').click();
      await expect(picker).toBeHidden();
      await expect(page.locator('#chatFoldersBtn')).toBeFocused();
    }
  }

  await page.locator('#chatFoldersBtn').click();
  const toggle = picker.locator('[data-chat-folder-strip-toggle]');
  const wasPressed = await toggle.getAttribute('aria-pressed');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', wasPressed === 'true' ? 'false' : 'true');
  await expect(toggle).toBeEnabled();
  await expect(picker).toHaveAttribute('aria-modal', 'true');

  for (const action of ['rename-folder', 'delete-folder']) {
    await picker.locator(`[data-folder-menu="${folderIds[0]}"]`).click();
    await page.locator(`#chatFolderContextMenu [data-folder-action="${action}"]`).click();
    await expect(page.locator('#appDialog')).toHaveAttribute('aria-modal', 'true');
    await expect(picker).toHaveAttribute('inert', '');
    if (action === 'rename-folder') await page.keyboard.press('Escape');
    else await page.goBack();
    await expect(page.locator('#appDialog')).toBeHidden();
    await expect(picker).toHaveAttribute('aria-modal', 'true');
    await expect(picker.locator(`[data-folder-menu="${folderIds[0]}"]`)).toBeFocused();
    await expect(picker.locator('[data-folder-select]')).toHaveCount(19);
  }

  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(page.locator('#chatFoldersBtn')).toBeFocused();
  await page.locator('#chatFoldersBtn').click();
  await picker.click({ position: { x: 2, y: 2 } });
  await expect(picker).toBeHidden();
  await page.locator('#chatFoldersBtn').click();
  await picker.locator(`[data-folder-menu="${folderIds[0]}"]`).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#chatFolderContextMenu')).toBeHidden();
  await expect(picker).toHaveAttribute('aria-modal', 'true');
  await picker.locator(`[data-folder-menu="${folderIds[0]}"]`).click();
  await page.goBack();
  await expect(picker).toBeHidden();
  await expect(page.locator('#chatFolderContextMenu')).toBeHidden();
  await page.locator('#chatFoldersBtn').click();
  await picker.locator(`[data-folder-select="${folderIds[0]}"]`).click();
  await expect(picker).toBeHidden();
  await expect(page.locator(`#activeChatFolderStrip [data-folder-chip="${folderIds[0]}"]`)).toHaveAttribute('aria-selected', 'true');

  if (testInfo.project.name.includes('mobile')) {
    await page.setViewportSize({ width: 360, height: 480 });
    await page.locator('#currentUserInfo').click();
    await page.locator('#profileName').focus();
    await expectContainedModal(page, '#menuDrawer');
    await page.locator('#saveProfileBtn').scrollIntoViewIfNeeded();
    await expect(page.locator('#saveProfileBtn')).toBeInViewport();
    await page.locator('#profileLogoutBtn').scrollIntoViewIfNeeded();
    await expect(page.locator('#profileLogoutBtn')).toBeInViewport();
  }
});

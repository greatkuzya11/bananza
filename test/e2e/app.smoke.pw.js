const { test, expect } = require('@playwright/test');

const {
  createApiSession,
  getContext,
  installMediaMocks,
  loginViaUi,
  makeUser,
  openExistingChat,
  openPollComposer,
  openPrivateChat,
  registerViaUi,
  sendComposerMessage,
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

async function openSearchPanelFromHeader(page) {
  await page.locator('#chatInfoBtn').click();
  await expect(page.locator('#chatHeaderActions')).toHaveClass(/is-open/);
  await page.locator('#searchBtn').click();
}

test('UI flow covers register, private chat creation, sending, search and poll composer', async ({ page }, testInfo) => {
  await installMediaMocks(page);

  const { bobUser } = getContext();
  const member = makeUser('pwui');

  await registerViaUi(page, member);
  await openPrivateChat(page, bobUser.displayName);
  await sendComposerMessage(page, 'Playwright hello');

  await openSearchPanelFromHeader(page);
  await page.locator('#searchInput').fill('Playwright hello');
  await expect(page.locator('#searchResults')).toContainText('Playwright hello');

  await openPollComposer(page, { mobile: testInfo.project.name.includes('mobile') });
  const optionInputs = page.locator('#pollOptionsList input[data-poll-option-index]');
  await page.locator('#pollQuestionInput').fill('Which banana day works best?');
  await optionInputs.nth(0).fill('Friday');
  await optionInputs.nth(1).fill('Saturday');
  await page.locator('#pollSubmitBtn').click();
  await expect(page.locator('#messages')).toContainText('Which banana day works best?');

  if (testInfo.project.name.includes('mobile')) {
    await expectMobileScene(page, 'chat');

    for (let index = 0; index < 2; index += 1) {
      await openSearchPanelFromHeader(page);
      await expect(page.locator('#searchPanel')).toHaveAttribute('aria-hidden', 'false');
      await expectMobileScene(page, 'chat');
      await page.locator('#searchClose').click();
      await expect(page.locator('#searchPanel')).toHaveAttribute('aria-hidden', 'true');
      await expectMobileScene(page, 'chat');

      await page.locator('#backBtn').click();
      await expectMobileScene(page, 'sidebar');

      await page.locator('#settingsBtn').click();
      await expect(page.locator('#settingsModal')).toBeVisible();
      await expectMobileScene(page, 'sidebar');
      await page.locator('#settingsModal .modal-close').click();
      await expect(page.locator('#settingsModal')).toBeHidden();
      await expectMobileScene(page, 'sidebar');

      await page.locator('#menuBtn').click();
      await expect(page.locator('#menuDrawer')).toBeVisible();
      await expect(page.locator('#profileForm')).toBeVisible();
      await expect(page.locator('#profileName')).toHaveValue(member.displayName);
      await expect(page.locator('#profileUsername')).toContainText(`@${member.username}`);
      await expect(page.locator('#colorPicker input[name="profileAvatarColor"]')).toHaveCount(16);
      await page.locator('#profileUserStatusSelect').selectOption('custom');
      await page.locator('#profileCustomStatus').fill('Writing profile layout check');
      const profileModalBox = await page.locator('#menuDrawer .profile-settings-modal').boundingBox();
      expect(profileModalBox?.y || 0).toBeLessThanOrEqual(90);
      const profileLayout = await page.locator('#menuDrawer .profile-settings-body').evaluate((el) => {
        const modal = el.closest('.profile-settings-modal');
        const logout = document.getElementById('profileLogoutBtn');
        const modalRect = modal.getBoundingClientRect();
        const logoutRect = logout.getBoundingClientRect();
        const initialScrollTop = el.scrollTop;
        el.scrollTop = 1;
        const canScrollBody = el.scrollTop > 0;
        el.scrollTop = initialScrollTop;
        return {
          bodyClientHeight: el.clientHeight,
          bodyScrollHeight: el.scrollHeight,
          canScrollBody,
          bodyOverflowY: getComputedStyle(el).overflowY,
          modalTop: modalRect.top,
          modalBottom: modalRect.bottom,
          logoutTop: logoutRect.top,
          logoutBottom: logoutRect.bottom,
        };
      });
      expect(profileLayout.logoutTop).toBeGreaterThanOrEqual(profileLayout.modalTop - 1);
      expect(profileLayout.logoutBottom).toBeLessThanOrEqual(profileLayout.modalBottom + 1);
      expect(profileLayout.bodyOverflowY).toBe('auto');
      expect(profileLayout.canScrollBody).toBe(profileLayout.bodyScrollHeight > profileLayout.bodyClientHeight);
      await page.locator('#colorPicker .color-swatch').nth(1).click();
      await expect(page.locator('#colorPicker input[name="profileAvatarColor"]').nth(1)).toBeChecked();
      await expectMobileScene(page, 'sidebar');
      await page.locator('#menuDrawer .modal-close').click();
      await expect(page.locator('#menuDrawer')).toBeHidden();
      await expectMobileScene(page, 'sidebar');

      await openExistingChat(page, bobUser.displayName);
      await expectMobileScene(page, 'chat');
    }
  }
});

test('realtime chat flow and media-note ui hooks work with mocked browser media APIs', async ({ browser, page }) => {
  await installMediaMocks(page);

  const { baseUrl, adminUser, bobUser, bobUserId } = getContext();
  const adminSession = createApiSession();

  await adminSession.login(adminUser);
  await adminSession.request('/api/admin/voice-settings', {
    method: 'PUT',
    json: {
      voice_notes_enabled: true,
      auto_transcribe_on_send: false,
      active_provider: 'openai',
      openai_api_key: 'sk-voice-smoke',
    },
  });
  await adminSession.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: bobUserId },
  });

  await loginViaUi(page, adminUser);
  await openExistingChat(page, bobUser.displayName);

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await installMediaMocks(secondPage);
  await loginViaUi(secondPage, bobUser);
  await openExistingChat(secondPage, adminUser.displayName);

  await sendComposerMessage(secondPage, 'Realtime from second page');
  await expect(page.locator('#messages')).toContainText('Realtime from second page');

  await page.locator('#msgInput').fill('');
  await expect(page.locator('#sendBtn')).toHaveAttribute('data-media-note-mode', /audio|video/);

  const sendBtn = page.locator('#sendBtn');
  await sendBtn.dispatchEvent('pointerdown', { pointerId: 1, button: 0, pointerType: 'mouse' });
  await expect(sendBtn).toHaveClass(/is-hold-armed/);
  await page.locator('body').dispatchEvent('pointerup', { pointerId: 1, button: 0, pointerType: 'mouse' });
  await expect(sendBtn).toHaveAttribute('data-media-note-mode', 'video');

  await secondContext.close();
  await page.goto(`${baseUrl}/`);
});

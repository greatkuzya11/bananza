const { test, expect } = require('@playwright/test');

const {
  clickMessageAction,
  expectMobileScene,
  getCurrentChatId,
  getContext,
  installFakeVisualViewport,
  installMediaMocks,
  isDesktopProject,
  isMobileProject,
  makeUser,
  messageRowByText,
  openExistingChat,
  openMessageActions,
  openPrivateChat,
  registerViaUi,
  sendComposerMessage,
  setFakeVisualViewport,
  setupContextConvertForChat,
} = require('./helpers');

async function createContextReadyPrivateChat(page, member, botName) {
  const { bobUser } = getContext();
  await registerViaUi(page, member);
  await openPrivateChat(page, bobUser.displayName);
  const chatId = await getCurrentChatId(page);
  await setupContextConvertForChat(chatId, { name: botName });
  await page.reload();
  await expect(page.locator('#chatList')).toBeVisible();
  const titleAlreadyOpen = await page.locator('#chatTitle').filter({ hasText: bobUser.displayName }).count();
  if (!titleAlreadyOpen) {
    await openExistingChat(page, bobUser.displayName);
  }
  return chatId;
}

async function chooseFirstContextConvertBot(page) {
  const pickerItem = page.locator('#contextConvertPicker .context-convert-picker-item').first();
  await expect(pickerItem).toBeVisible();
  await pickerItem.click();
}

test('desktop context transform can restore the first original message text', async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo), 'desktop-only full context transform flow');

  await installMediaMocks(page);

  const member = makeUser('pwctx');
  const originalText = `Original context text ${Date.now()}`;

  await createContextReadyPrivateChat(page, member, `PW Convert ${Date.now().toString(36)}`);
  await sendComposerMessage(page, originalText);

  let row = messageRowByText(page, originalText);
  await expect(row.locator('.msg-context-convert-btn')).toHaveCount(1);
  await clickMessageAction(page, row, '.msg-context-convert-btn', testInfo);
  await chooseFirstContextConvertBot(page);

  row = messageRowByText(page, 'Mock OpenAI response');
  await expect(row).toBeVisible();
  await expect(row.locator('.msg-restore-original-btn')).toHaveCount(1);

  await row.click({ button: 'right' });
  await expect(page.locator('#reactionPicker')).toBeVisible();
  const restoreButton = page.locator('#reactionPicker .msg-restore-original-btn');
  await expect(restoreButton).toHaveAttribute('data-message-id', /[1-9]\d*/);
  await expect(restoreButton).toBeEnabled();
  const restoreRequest = page.waitForRequest((request) => (
    request.url().includes('/context-convert/restore-original')
    && request.method() === 'POST'
  ));
  await restoreButton.click();
  await restoreRequest;
  const restoredRow = messageRowByText(page, originalText);
  await expect(restoredRow).toBeVisible();
  await expect(restoredRow.locator('.msg-restore-original-btn')).toHaveCount(0);
});

test('mobile reaction and context restore actions keep the chat scene and keyboard dock stable', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(!isMobileProject(testInfo), 'mobile-only action smoke');

  await installFakeVisualViewport(page);
  await installMediaMocks(page);

  const member = makeUser('pwmctx');
  const originalText = `Mobile context original ${Date.now()}`;

  await createContextReadyPrivateChat(page, member, `PW Mobile ${Date.now().toString(36)}`);
  await sendComposerMessage(page, originalText);

  const input = page.locator('#msgInput');
  await input.focus();
  await setFakeVisualViewport(page, { height: 430, offsetTop: 0 });
  await expect.poll(async () => {
    return page.evaluate(() => window.BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot());
  }).toMatchObject({
    keyboardOpen: true,
    chatKeyboardLayout: true,
  });

  let row = messageRowByText(page, originalText);
  await openMessageActions(page, row, testInfo);
  await expectMobileScene(page, 'chat');
  await page.locator('.msg-actions.actions-floating-open .msg-react-btn').tap();
  await expect(page.locator('#reactionPicker')).toBeVisible();
  await page.locator('#reactionPicker [data-reaction-action="toggle"]').first().click({ force: true });
  await expectMobileScene(page, 'chat');

  await openMessageActions(page, row, testInfo);
  await page.locator('.msg-actions.actions-floating-open .msg-context-convert-btn').tap();
  await chooseFirstContextConvertBot(page);
  row = messageRowByText(page, 'Mock OpenAI response');
  await expect(row).toBeVisible();

  await openMessageActions(page, row, testInfo);
  await page.locator('.msg-actions.actions-floating-open .msg-react-btn').tap();
  await expect(page.locator('#reactionPicker')).toBeVisible();
  const restoreButton = page.locator('#reactionPicker .msg-restore-original-btn');
  await expect(restoreButton).toHaveAttribute('data-message-id', /[1-9]\d*/);
  await expect(restoreButton).toBeEnabled();
  const restoreRequest = page.waitForRequest((request) => (
    request.url().includes('/context-convert/restore-original')
    && request.method() === 'POST'
  ));
  await restoreButton.tap();
  await restoreRequest;
  await expect(messageRowByText(page, originalText)).toBeVisible();
  await expectMobileScene(page, 'chat');
  await expect.poll(async () => {
    const snapshot = await page.evaluate(() => window.BananzaAppBridge.__testing.getMobileKeyboardDockSnapshot());
    return Boolean(snapshot.keyboardOpen && snapshot.chatKeyboardLayout && snapshot.dockActive);
  }).toBeTruthy();
});

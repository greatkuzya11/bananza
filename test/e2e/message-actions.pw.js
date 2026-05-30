const { test, expect } = require('@playwright/test');

const {
  clickMessageAction,
  getContext,
  installMediaMocks,
  isDesktopProject,
  makeUser,
  messageRowByText,
  openPrivateChat,
  registerViaUi,
  sendComposerMessage,
} = require('./helpers');

test('desktop message actions cover reply, edit, react, pin, unpin and delete', async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo), 'desktop-only full message action flow');

  await installMediaMocks(page);

  const member = makeUser('pwact');
  const sourceText = `Action source ${Date.now()}`;
  const replyText = `Action reply ${Date.now()}`;
  const editedText = `Action edited ${Date.now()}`;
  const { bobUser } = getContext();

  await registerViaUi(page, member);
  await openPrivateChat(page, bobUser.displayName);
  await sendComposerMessage(page, sourceText);

  let sourceRow = messageRowByText(page, sourceText);
  await clickMessageAction(page, sourceRow, '.msg-reply-btn', testInfo);
  await expect(page.locator('#replyBar')).toBeVisible();
  await expect(page.locator('#replyBarText')).toContainText(sourceText);
  await sendComposerMessage(page, replyText);
  const replyRow = messageRowByText(page, replyText);
  await expect(replyRow.locator('.msg-reply-text')).toContainText(sourceText);

  sourceRow = messageRowByText(page, sourceText);
  await clickMessageAction(page, sourceRow, '.msg-edit-btn', testInfo);
  await expect(page.locator('#replyBar')).toHaveClass(/edit-bar/);
  await page.locator('#msgInput').fill(editedText);
  await page.locator('#sendBtn').click();
  const editedRow = messageRowByText(page, editedText);
  await expect(editedRow.locator('.msg-edited')).toBeVisible();

  await clickMessageAction(page, editedRow, '.msg-react-btn', testInfo);
  await expect(page.locator('#reactionPicker')).toBeVisible();
  await page.locator('#reactionPicker [data-reaction-action="toggle"]').first().click();
  await expect(editedRow.locator('.reaction-badge.mine')).toBeVisible();

  await clickMessageAction(page, editedRow, '.msg-pin-btn', testInfo);
  await expect(editedRow.locator('.msg-pin-btn.active')).toBeVisible();
  await expect(page.locator('#pinnedBar')).toBeVisible();

  await clickMessageAction(page, editedRow, '.msg-pin-btn', testInfo);
  await expect(editedRow.locator('.msg-pin-btn.active')).toHaveCount(0);

  const editedMessageId = await editedRow.getAttribute('data-msg-id');
  await editedRow.hover();
  await editedRow.locator('.msg-delete-btn').click({ force: true });
  await expect(page.locator(`.msg-row[data-msg-id="${editedMessageId}"] .msg-deleted`)).toBeVisible();
});

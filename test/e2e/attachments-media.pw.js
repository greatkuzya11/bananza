const fs = require('fs');

const { test, expect } = require('@playwright/test');

const {
  getContext,
  installMediaMocks,
  isDesktopProject,
  makeUser,
  messageRowByText,
  openPrivateChat,
  registerViaUi,
} = require('./helpers');

const PNG_BYTES = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360606060000000040001F61738550000000049454E44AE426082',
  'hex'
);

test('desktop attachments upload image previews and document cards through the composer', async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo), 'desktop-only attachment flow');

  await installMediaMocks(page);

  const member = makeUser('pwfile');
  const { bobUser } = getContext();
  const imageName = `pw-image-${Date.now()}.png`;
  const documentName = `pw-note-${Date.now()}.txt`;
  const imagePath = testInfo.outputPath(imageName);
  const documentPath = testInfo.outputPath(documentName);
  const imageCaption = `Image upload ${Date.now()}`;
  const documentCaption = `Document upload ${Date.now()}`;

  fs.writeFileSync(imagePath, PNG_BYTES);
  fs.writeFileSync(documentPath, 'Playwright attachment document');

  await registerViaUi(page, member);
  await openPrivateChat(page, bobUser.displayName);

  await page.locator('#fileInput').setInputFiles(imagePath);
  await expect(page.locator('#pendingFile')).toContainText(imageName);
  await page.locator('#msgInput').fill(imageCaption);
  await page.locator('#sendBtn').click();
  const imageRow = messageRowByText(page, imageCaption);
  await expect(imageRow.locator('.msg-image')).toBeVisible();
  await expect(imageRow.locator('.msg-image')).toHaveAttribute('alt', imageName);

  await imageRow.locator('.msg-image').click();
  await expect(page.locator('#imageViewer')).toBeVisible();
  await page.locator('#imageViewer .iv-close').click();
  await expect(page.locator('#imageViewer')).toBeHidden();

  await page.locator('#fileInputDocs').setInputFiles(documentPath);
  await expect(page.locator('#pendingFile')).toContainText(documentName);
  await page.locator('#msgInput').fill(documentCaption);
  await page.locator('#sendBtn').click();
  const documentRow = messageRowByText(page, documentCaption);
  await expect(documentRow.locator('.msg-file')).toBeVisible();
  await expect(documentRow.locator('.msg-file-name')).toContainText(documentName);
  await expect(documentRow.locator('.msg-file')).toHaveAttribute('download', documentName);
});

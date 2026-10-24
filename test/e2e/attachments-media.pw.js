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
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWJiYGD4DwAAAP//cGajQwAAAAZJREFUAwABDgEC81VxbAAAAABJRU5ErkJggg==',
  'base64'
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


test('mixed album stays compact, opens hidden images and survives reload', async ({ page }, testInfo) => {
  const member = makeUser('pwalbum');
  await registerViaUi(page, member);
  await openPrivateChat(page, getContext().bobUser.displayName);
  const images = [];
  for (let i = 0; i < 8; i++) {
    const data = await page.evaluate(index => {
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = index % 2 ? 600 : 300;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = ['#318b9b', '#b58046', '#7f6bad', '#659054', '#bd667f'][index % 5];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff'; ctx.font = '64px sans-serif';
      ctx.fillText(String(index + 1), 40, 100);
      return canvas.toDataURL('image/png').split(',')[1];
    }, i);
    images.push({ name: `photo-${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  }
  await page.locator('#fileInputGallery').setInputFiles(images);
  await expect(page.locator('.pending-file-thumb')).toHaveCount(8);
  await expect.poll(() => page.locator('.pending-file-thumb').evaluateAll(images => images.every(img => img.naturalWidth > 0))).toBe(true);
  await page.locator('#fileInputDocs').setInputFiles([
    { name: 'report.txt', mimeType: 'text/plain', buffer: Buffer.from('report') },
    { name: 'remove-me.txt', mimeType: 'text/plain', buffer: Buffer.from('remove') },
  ]);
  await expect(page.locator('.pending-file-card')).toHaveCount(10);
  await page.locator('.pending-file-card').last().locator('.pending-file-remove').click();
  await expect(page.locator('.pending-file-card')).toHaveCount(9);
  const caption = `Mixed album ${Date.now()}`;
  await page.locator('#msgInput').fill(caption);
  for (const [theme, mode] of [['pearl', 'classic'], ['bananza', 'classic'], ['rose-pine', 'glass']]) {
    await page.evaluate(({ theme, mode }) => window.BananzaAppearance.apply(document, { theme, mode }, false), { theme, mode });
    await expect(page.locator('.pending-file-strip')).toBeVisible();
    const rect = await page.locator('#pendingFile').boundingBox();
    expect(rect.height).toBeLessThan(125);
    await page.screenshot({ path: testInfo.outputPath(`composer-${theme}-${mode}.png`) });
  }
  await page.locator('#sendBtn').click();
  const row = messageRowByText(page, caption);
  await expect(row.locator('.msg-album-tile:visible')).toHaveCount(4);
  await expect(row.locator('.msg-album-more > span').first()).toHaveText('+4');
  await expect(row.locator('.msg-file-name')).toHaveText('report.txt');
  await expect(row).not.toHaveAttribute('data-outbox', '1');
  await expect.poll(async () => (await row.locator('.msg-bubble').boundingBox())?.width || Infinity).toBeLessThanOrEqual(345);
  const id = await row.getAttribute('data-msg-id');
  await row.locator('.msg-album-more').click();
  await expect(page.locator('#imageViewer')).toBeHidden();
  await expect(row.locator('.msg-album-tile:visible')).toHaveCount(8);
  await row.screenshot({ path: testInfo.outputPath('album-expanded.png') });
  await row.locator('.msg-album-tile').nth(3).click();
  await expect(page.locator('#imageViewer')).toBeVisible();
  await expect(page.locator('#imageViewer .iv-slide')).toHaveCount(8);
  if (isDesktopProject(testInfo)) {
    await page.locator('#imageViewer .iv-next').click();
  } else {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 300 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 100, y: 300 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
  await expect.poll(() => page.evaluate(() => window.BananzaAppBridge.__testing.getMediaViewerState().galleryIndex)).toBe(4);
  await expect(page.locator('#ivStrip')).toBeVisible();
  if (isDesktopProject(testInfo)) {
    await page.locator('#imageViewer .iv-close').click();
  } else {
    const cdp = await page.context().newCDPSession(page);
    for (const distance of [30, 180]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 250 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 205, y: 250 + distance }] });
      expect(await page.locator('#ivStrip').evaluate(el => el.style.transform)).toContain(`, ${distance}px)`);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      if (distance === 30) {
        await expect(page.locator('#imageViewer')).toBeVisible();
        await expect.poll(() => page.locator('#ivStrip').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)).toBe(0);
      }
    }
    await cdp.detach();
    await expect(page.locator('#imageViewer')).toBeHidden();
  }
  await row.locator('.msg-album-collapse').click();
  await expect(row.locator('.msg-album-tile:visible')).toHaveCount(4);
  for (const [theme, mode] of [['pearl', 'classic'], ['bananza', 'classic'], ['rose-pine', 'glass']]) {
    await page.evaluate(({ theme, mode }) => window.BananzaAppearance.apply(document, { theme, mode }, false), { theme, mode });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`album-${theme}-${mode}.png`) });
  }
  await page.reload();
  const restored = page.locator(`.msg-row[data-msg-id="${id}"]`);
  await expect(restored.locator('.msg-album-tile:visible')).toHaveCount(4);
  await expect(restored.locator('.msg-file')).toHaveAttribute('download', 'report.txt');
  await page.evaluate(messageId => {
    const source = document.querySelector(`[data-msg-id="${messageId}"]`).__messageData;
    window.BananzaAppBridge.__testing.setReply(source.id, source.display_name, source.text, source);
  }, id);
  await page.locator('#fileInputGallery').setInputFiles(images.slice(0, 2));
  await page.locator('#msgInput').fill('Reply with album');
  await expect(page.locator('#replyBar')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('composer-reply.png') });
});


test('media swipes quote thumbnails and let the author edit, retry and remove attachments', async ({ page }, testInfo) => {
  await registerViaUi(page, makeUser('pwmediaedit'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  const image = name => ({ name, mimeType: 'image/png', buffer: PNG_BYTES });
  await page.locator('#fileInputGallery').setInputFiles(['one.png', 'two.png', 'three.png'].map(image));
  await page.locator('#fileInputDocs').setInputFiles({ name: 'original.txt', mimeType: 'text/plain', buffer: Buffer.from('original') });
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#msgInput').fill('Original media caption');
  await page.locator('#sendBtn').click();
  let original = messageRowByText(page, 'Original media caption');
  await expect(original).not.toHaveAttribute('data-outbox', '1');
  const id = await original.getAttribute('data-msg-id');
  original = page.locator(`.msg-row[data-msg-id="${id}"]`);
  const swipe = async direction => {
    const tile = original.locator('.msg-album-tile').first();
    await tile.scrollIntoViewIfNeeded();
    const box = await tile.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    if (isDesktopProject(testInfo)) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + direction * 70, y, { steps: 5 });
      await page.mouse.up();
    } else {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (const offset of [15, 35, 70]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + direction * offset, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    }
    await expect(page.locator('#imageViewer')).toBeHidden();
  };
  await swipe(-1);
  await expect(page.locator('#replyBar .quote-attachment')).toHaveCount(4);
  await expect(page.locator('#replyBar .quote-attachment img')).toHaveCount(3);
  await page.locator('#msgInput').fill('Comment on the album');
  await page.locator('#sendBtn').click();
  let reply = messageRowByText(page, 'Comment on the album');
  await expect(reply).not.toHaveAttribute('data-outbox', '1');
  await expect(reply.locator('.msg-reply .quote-attachment')).toHaveCount(4);
  await page.reload();
  reply = messageRowByText(page, 'Comment on the album');
  await expect(reply.locator('.msg-reply img')).toHaveCount(3);
  await swipe(1);
  await expect(page.locator('#replyBar')).toHaveClass(/edit-bar/);
  await expect(page.locator('.pending-file-card')).toHaveCount(4);
  await expect(page.locator('.pending-file-thumb')).toHaveCount(3);
  await expect(page.locator('#attachBtn')).toBeEnabled();
  const chooserEvent = page.waitForEvent('filechooser');
  await page.locator('.pending-file-card').filter({ hasText: 'one.png' }).locator('.pending-file-replace').click();
  await (await chooserEvent).setFiles(image('replacement.png'));
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.pending-file-card').first()).toContainText('replacement.png');
  await page.locator('.pending-file-card').filter({ hasText: 'original.txt' }).locator('.pending-file-remove').click();
  await expect(page.locator('.pending-file-card')).toHaveCount(3);
  await page.locator('#fileInputDocs').setInputFiles({ name: 'replacement.txt', mimeType: 'text/plain', buffer: Buffer.from('new') });
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#msgInput').fill('Edited album caption');
  for (const [theme, mode] of [['pearl', 'classic'], ['bananza', 'classic'], ['rose-pine', 'glass']]) {
    await page.evaluate(({ theme, mode }) => window.BananzaAppearance.apply(document, { theme, mode }, false), { theme, mode });
    await page.screenshot({ path: testInfo.outputPath(`edit-media-${theme}-${mode}.png`) });
  }
  let uploads = 0;
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/upload')) uploads += 1; });
  await page.route(`**/api/messages/${id}`, route => route.fulfill({ status: 500, json: { error: 'Retry edit' } }), { times: 1 });
  await page.locator('#sendBtn').click();
  await expect(page.locator('.app-dialog-message')).toHaveText('Retry edit');
  await page.locator('.app-dialog [type="submit"]').click();
  await expect(page.locator('.pending-file-card')).toHaveCount(4);
  await expect(page.locator('#msgInput')).toHaveValue('Edited album caption');
  await page.locator('#sendBtn').click();
  await expect(page.locator('#replyBar')).toBeHidden();
  await expect(original.locator('.msg-text')).toHaveText('Edited album caption');
  await expect(original.locator('.msg-file-name')).toHaveText('replacement.txt');
  await expect(reply.locator('.quote-attachment[title="replacement.png"]')).toHaveCount(1);
  expect(uploads).toBe(2);
  await page.reload();
  await expect(original.locator('.msg-file-name')).toHaveText('replacement.txt');
  await expect(reply.locator('.quote-attachment[title="replacement.png"]')).toHaveCount(1);
  await swipe(1);
  await page.locator('.pending-file-remove').first().click();
  await page.locator('#replyBarClose').click();
  await expect(original.locator('.msg-album-tile')).toHaveCount(3);
  await swipe(1);
  await page.locator('.pending-files-clear').click();
  await page.locator('#sendBtn').click();
  await expect(original.locator('.msg-album, .msg-file')).toHaveCount(0);
  await expect(reply.locator('.quote-attachment')).toHaveCount(0);
});

test('failed album resumes remaining upload after a browser reload', async ({ page }) => {
  await registerViaUi(page, makeUser('pwretry'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  let uploadAttempts = 0;
  await page.route('**/api/upload', async route => {
    uploadAttempts++;
    if (uploadAttempts === 2) return route.abort('failed');
    return route.continue();
  });
  await page.locator('#fileInputDocs').setInputFiles([
    { name: 'first.txt', mimeType: 'text/plain', buffer: Buffer.from('first persistent blob') },
    { name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('second persistent blob') },
  ]);
  const caption = `Retry album ${Date.now()}`;
  await page.locator('#msgInput').fill(caption);
  await page.locator('#sendBtn').click();
  const row = messageRowByText(page, caption);
  await expect(row).toHaveClass(/client-failed/);
  await expect(row.locator('.msg-file')).toHaveCount(2);
  const clientId = await row.getAttribute('data-client-id');
  await page.reload();
  await expect(row).toBeVisible();
  const retry = row.locator('.msg-retry-btn');
  if (await retry.isVisible()) await retry.click();
  await expect(row).not.toHaveAttribute('data-outbox', '1');
  await expect(row.locator('.msg-file')).toHaveCount(2);
  expect(uploadAttempts).toBe(3);
  expect(await row.evaluate(el => el.__messageData.client_id)).toBe(clientId);
  await expect(row.locator('.msg-file').nth(1)).toHaveAttribute('download', 'second.txt');
});

test('attachment preparation shows loading before the thumbnail is ready', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      const ready = decode.call(this);
      if (!this.src.startsWith('blob:')) return ready;
      return Promise.all([ready, new Promise(resolve => { window.releaseAttachmentPreview = resolve; })]);
    };
  });
  await registerViaUi(page, makeUser('pwprepare'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  await page.locator('#fileInputGallery').setInputFiles({ name: 'preparing.png', mimeType: 'image/png', buffer: PNG_BYTES });
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.pending-file-spinner')).toBeVisible();
  await expect(page.locator('.pending-file-details [role="status"]')).not.toBeEmpty();
  await expect(page.locator('#sendBtn')).toBeDisabled();
  for (const [theme, mode] of [['pearl', 'classic'], ['bananza', 'classic'], ['rose-pine', 'glass']]) {
    await page.evaluate(({ theme, mode }) => window.BananzaAppearance.apply(document, { theme, mode }, false), { theme, mode });
    await page.screenshot({ path: testInfo.outputPath(`preparing-${theme}-${mode}.png`) });
  }
  await page.evaluate(() => window.releaseAttachmentPreview());
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.pending-file-spinner')).toHaveCount(0);
  await expect(page.locator('#sendBtn')).toBeEnabled();
  await expect(page.locator('.pending-file-thumb')).toBeVisible();
});

test('attachment upload shows feedback during storage, each upload and final send', async ({ page }, testInfo) => {
  await registerViaUi(page, makeUser('pwtransfer'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  await page.evaluate(() => {
    const save = window.messageCache.upsertOutboxItem;
    let held = false;
    window.messageCache.upsertOutboxItem = async function (item) {
      if (!held && item.attachments?.length) {
        held = true;
        await new Promise(resolve => { window.finishOutboxSave = resolve; });
      }
      return save.call(this, item);
    };
  });
  const uploads = [];
  let finishMessage;
  await page.route('**/api/upload', async route => {
    await new Promise(resolve => { uploads.push(resolve); });
    await route.continue();
  });
  await page.route('**/api/chats/*/messages', async route => {
    if (route.request().method() === 'POST') await new Promise(resolve => { finishMessage = resolve; });
    await route.continue();
  });
  try {
    await page.locator('#fileInputDocs').setInputFiles([
      { name: 'first.txt', mimeType: 'text/plain', buffer: Buffer.from('first file') },
      { name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('second file') },
    ]);
    const caption = `Visible transfer ${Date.now()}`;
    await page.locator('#msgInput').fill(caption);
    await page.locator('#sendBtn').click();
    const row = messageRowByText(page, caption);
    const status = row.locator('.msg-transfer-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText(/Подготовка к отправке|Preparing to send/);
    await page.evaluate(() => window.finishOutboxSave());
    await expect.poll(() => uploads.length).toBe(1);
    await expect(status).toContainText(/1.*2/);
    await expect(status.locator('.msg-transfer-spinner')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('upload-in-progress.png') });
    uploads[0]();
    await expect.poll(() => uploads.length).toBe(2);
    await expect(status).toContainText(/2.*2/);
    await expect(status.locator('progress')).toHaveAttribute('value', '1');
    uploads[1]();
    await expect.poll(() => Boolean(finishMessage)).toBe(true);
    await expect(status).toContainText(/Отправка сообщения|Sending message/);
    finishMessage();
    await expect(row).not.toHaveAttribute('data-outbox', '1');
    await expect(row.locator('.msg-transfer-status')).toHaveCount(0);
  } finally {
    uploads.forEach(finish => finish());
    finishMessage?.();
  }
});

test('file preparation starts only after confirming the native file selection', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      const ready = decode.call(this);
      if (!this.src.startsWith('blob:')) return ready;
      return Promise.all([ready, new Promise(resolve => { window.finishSelectedPreview = resolve; })]);
    };
  });
  await registerViaUi(page, makeUser('pwpicker'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  for (const inputId of ['fileInput', 'fileInputGallery', 'fileInputCamera', 'fileInputDocs']) {
    const chooserEvent = page.waitForEvent('filechooser');
    await page.evaluate(id => document.getElementById(id).click(), inputId);
    const chooser = await chooserEvent;
    await expect(page.locator('#pendingFile')).toBeHidden();
    await expect(page.locator('.pending-file-spinner')).toHaveCount(0);
    await chooser.setFiles({ name: `${inputId}.png`, mimeType: 'image/png', buffer: PNG_BYTES });
    await expect(page.locator('#pendingFile')).toBeVisible();
    await expect(page.locator('.pending-file-spinner')).toBeVisible();
    await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#sendBtn')).toBeDisabled();
    await expect.poll(() => page.evaluate(() => typeof window.finishSelectedPreview)).toBe('function');
    if (inputId === 'fileInput') await page.screenshot({ path: testInfo.outputPath('confirmed-file-preparing.png') });
    await page.evaluate(() => { window.finishSelectedPreview(); delete window.finishSelectedPreview; });
    await expect(page.locator('.pending-file-thumb')).toBeVisible();
    await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#sendBtn')).toBeEnabled();
    await page.locator('.pending-files-clear').click();
    await expect(page.locator('#pendingFile')).toBeHidden();
  }
});

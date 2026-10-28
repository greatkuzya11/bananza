const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { test, expect } = require('@playwright/test');
const { getContext, createApiSession, loginViaUi, isDesktopProject } = require('./helpers');

test('admin image history pages and fullscreen gallery work above settings on desktop and mobile', async ({ page }, testInfo) => {
  const context = getContext();
  const session = createApiSession();
  await session.login(context.adminUser);
  const mention = 'history' + Date.now();
  const { data: { bot } } = await session.request('/api/admin/local-image-bots', {
    method: 'POST', json: { name: 'Image history browser test', mention },
  });
  const { data: chat } = await session.request('/api/chats/private', { method: 'POST', json: { targetUserId: context.bobUserId } });
  const frames = await page.evaluate(() => Array.from({ length: 26 }, (_, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = ['#287f91', '#7655a2', '#b66835'][index % 3];
    ctx.fillRect(0, 0, 640, 400);
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(320, 150, 85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('History image ' + (index + 1), 320, 310);
    return canvas.toDataURL('image/png').split(',')[1];
  }));
  const db = new Database(path.join(context.appDir, 'bananza.db'));
  try {
    const source = Number(db.prepare('INSERT INTO messages(chat_id,user_id,text) VALUES(?,?,?)')
      .run(chat.id, context.bobUserId, 'Draw a banana by the sea').lastInsertRowid);
    for (let i = 0; i < 26; i++) {
      const stored = mention + '-' + i + '.png';
      const bytes = Buffer.from(frames[i], 'base64');
      fs.writeFileSync(path.join(context.appDir, 'uploads', stored), bytes);
      const fileId = Number(db.prepare('INSERT INTO files(original_name,stored_name,mime_type,size,type,uploaded_by) VALUES(?,?,?,?,?,?)')
        .run(stored, stored, 'image/png', bytes.length, 'image', context.adminUserId).lastInsertRowid);
      db.prepare('INSERT INTO messages(chat_id,user_id,file_id,reply_to_id,ai_generated,ai_bot_id) VALUES(?,?,?,?,1,?)')
        .run(chat.id, bot.user_id, fileId, source, bot.id);
    }
  } finally { db.close(); }
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await loginViaUi(page, context.adminUser);
  await page.locator('#settingsBtn').click();
  await page.evaluate((id) => window.BananzaBotImages.open(id), bot.id);
  const modal = page.locator('#botImageHistoryModal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.bot-image-history-preview')).toHaveCount(25);
  await page.locator('#botImageHistoryNext').click();
  await expect(modal.locator('.bot-image-history-preview')).toHaveCount(1);
  await expect(page.locator('#botImageHistoryNext')).toBeDisabled();
  await page.locator('#botImageHistoryUser').selectOption(String(context.bobUserId));
  await expect(modal.locator('.bot-image-history-preview')).toHaveCount(25);
  await expect(page.locator('#botImageHistoryPrevious')).toBeDisabled();
  await expect.poll(() => modal.locator('.bot-image-history-preview img').first().evaluate((img) => img.naturalWidth)).toBe(640);
  await page.screenshot({ path: testInfo.outputPath('image-history.png') });
  await modal.locator('.bot-image-history-preview').first().click();
  const viewer = page.locator('#imageViewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('.iv-slide')).toHaveCount(25);
  if (isDesktopProject(testInfo)) {
    await viewer.locator('.iv-next').click();
  } else {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 300 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 100, y: 300 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
  await expect.poll(() => page.evaluate(() => window.BananzaAppBridge.__testing.getMediaViewerState().galleryIndex)).toBe(1);
  await expect.poll(() => viewer.locator('.iv-slide').nth(1).locator('img').evaluate((img) => img.naturalWidth)).toBe(640);
  await page.screenshot({ path: testInfo.outputPath('image-history-viewer.png') });
  if (isDesktopProject(testInfo)) {
    await viewer.locator('.iv-slide').nth(1).dblclick({ position: { x: 200, y: 200 } });
    await expect.poll(() => page.evaluate(() => window.BananzaAppBridge.__testing.getMediaViewerState().scale)).toBeGreaterThan(1);
  }
  await viewer.locator('.iv-close').click();
  await expect(viewer).toBeHidden();
  await expect(modal).toBeVisible();
  await expect(page.locator('#botImageHistoryUser')).toHaveValue(String(context.bobUserId));
  await expect(page.locator('#botImageHistoryPrevious')).toBeDisabled();
  expect((await modal.locator('.modal-content').boundingBox()).width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(errors).toEqual([]);
});

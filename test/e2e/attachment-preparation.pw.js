const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { registerViaUi, openPrivateChat, makeUser, getContext } = require('./helpers');

test('preview plus opens attachment choices and appends a file', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.startsWith('mobile');
  await registerViaUi(page, makeUser('pwpreviewadd'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  await page.locator('#fileInputDocs').setInputFiles({ name: 'first.txt', mimeType: 'text/plain', buffer: Buffer.from('First') });
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  const plus = page.locator('.pending-file-add');
  const chooserPromise = page.waitForEvent('filechooser');
  if (mobile) {
    await plus.tap();
    await expect(page.locator('#attachMenu')).toBeVisible();
    await expect(page.locator('#attachMenu')).toHaveCSS('opacity', '1');
    await page.locator('#attachMenuFile').tap();
  } else {
    await plus.click();
  }
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('Second') });
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.pending-file-name')).toHaveText(['first.txt', 'second.txt']);
  if (mobile) {
    // The plus is an opener too: a second tap closes the menu instead of
    // dismissing it on pointerdown and immediately reopening it on pointerup.
    await plus.tap();
    await expect(page.locator('#attachMenu')).toHaveCSS('opacity', '1');
    await plus.tap();
    await expect(page.locator('#attachMenu')).toBeHidden();
  }
});

test('closing previews consumes the retargeted touch click and centers the close icon', async ({ page }, testInfo) => {
  await registerViaUi(page, makeUser('pwpreviewclose'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWJiYGD4DwAAAP//cGajQwAAAAZJREFUAwABDgEC81VxbAAAAABJRU5ErkJggg==', 'base64');
  const file = { name: 'behind-preview.png', mimeType: 'image/png', buffer: png };
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#sendBtn').click();
  const photo = page.locator('.msg-row:not([data-outbox="1"]) .msg-image').last();
  await expect(photo).toBeVisible();
  for (const style of ['soft', 'none']) {
    await page.evaluate(style => {
      window.BananzaAppBridge.openAnimationSettingsModal();
      document.querySelector(`[data-modal-animation-style="${style}"]`).click();
      window.BananzaAppBridge.closeManagedModal('animationSettingsModal', { immediate: true });
    }, style);
    await page.locator('#fileInput').setInputFiles(file);
    await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#pendingFile')).toHaveCSS('opacity', '1');
    const point = await page.locator('.pending-files-clear').evaluate(button => {
      const panel = button.parentElement.getBoundingClientRect();
      const icon = button.querySelector('svg').getBoundingClientRect();
      return { x: icon.x + icon.width / 2, y: icon.y + icon.height / 2, centerOffset: icon.y + icon.height / 2 - (panel.y + panel.height / 2) };
    });
    expect(Math.abs(point.centerOffset)).toBeLessThanOrEqual(1);
    // Place real message media beneath the dismiss target, independent of viewport width.
    await photo.evaluate((image, point) => {
      Object.assign(image.style, { position: 'fixed', left: `${point.x - 30}px`, top: `${point.y - 30}px`, width: '60px', height: '60px', zIndex: '1' });
    }, point);
    await page.locator('.pending-files-clear').evaluate((button, point) => {
      const options = { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 7, clientX: point.x, clientY: point.y };
      button.dispatchEvent(new PointerEvent('pointerdown', options));
      button.dispatchEvent(new PointerEvent('pointerup', options));
      // The target has become inert; browsers can now deliver the compatibility
      // click to the image beneath it rather than the removed close button.
      document.elementFromPoint(point.x, point.y).dispatchEvent(new MouseEvent('click', { ...options, detail: 1 }));
    }, point);
    await expect(page.locator('#pendingFile')).toBeHidden();
    await expect(page.locator('#imageViewer')).toBeHidden();
    expect(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.classList.contains('msg-image'), point)).toBe(true);
    // A deliberate new gesture at the same position must still open the photo.
    if (testInfo.project.name.startsWith('mobile')) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await expect(page.locator('#imageViewer')).toBeVisible();
    await page.locator('#imageViewer .iv-close').click();
    await expect(page.locator('#imageViewer')).toBeHidden();
    await photo.evaluate(image => image.removeAttribute('style'));
  }
});

test('individual preview cards animate and the scrollbar only appears while scrolling more than three files', async ({ page }, testInfo) => {
  await registerViaUi(page, makeUser('pwcardmotion'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  const chooseAnimation = async style => page.evaluate(style => {
    window.BananzaAppBridge.openAnimationSettingsModal();
    document.querySelector(`[data-modal-animation-style="${style}"]`).click();
    const speed = document.getElementById('settingsAnimationSpeed');
    speed.value = '1';
    speed.dispatchEvent(new Event('input', { bubbles: true }));
    window.BananzaAppBridge.closeManagedModal('animationSettingsModal', { immediate: true });
  }, style);
  await chooseAnimation('lift');
  const files = start => Array.from({ length: 3 }, (_, index) => ({
    name: `file-${start + index}.txt`, mimeType: 'text/plain', buffer: Buffer.from('Document'),
  }));
  const panel = page.locator('#pendingFile');
  const strip = panel.locator('.pending-file-strip');
  const indicatorOpacity = () => panel.locator('.pending-file-scrollbar').evaluate(el => getComputedStyle(el).opacity);
  await page.locator('#fileInputDocs').setInputFiles(files(0));
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  await expect(panel).toHaveCSS('opacity', '1');
  await strip.evaluate(el => { el.scrollLeft = 100; window.firstPreviewCard = el.querySelector('.pending-file-card'); window.previewStrip = el; });
  await expect(strip).not.toHaveClass(/has-many-attachments/);
  expect(await indicatorOpacity()).toBe('0');
  await page.locator('#fileInputDocs').setInputFiles(files(3));
  await expect(panel.locator('.pending-file-card:not(.pending-file-receiving)')).toHaveCount(6);
  const addition = await strip.evaluate(el => {
    const card = el.querySelector('.pending-file-card:last-of-type');
    const animation = card.getAnimations()[0];
    const css = getComputedStyle(el.parentElement);
    const normalizedTransform = document.createElement('div').style;
    normalizedTransform.transform = css.getPropertyValue('--floating-enter-transform').trim();
    return {
      sameStrip: el === window.previewStrip, sameFirst: el.querySelector('.pending-file-card') === window.firstPreviewCard,
      duration: animation?.effect.getTiming().duration,
      expectedDuration: parseFloat(css.getPropertyValue('--floating-duration-base')) * 1000 * parseFloat(css.getPropertyValue('--modal-animation-speed-factor')),
      transform: animation?.effect.getKeyframes()[0].transform,
      expectedTransform: normalizedTransform.transform,
    };
  });
  expect(addition.sameStrip).toBe(true);
  expect(addition.sameFirst).toBe(true);
  expect(addition.duration).toBeCloseTo(addition.expectedDuration);
  expect(addition.transform).toBe(addition.expectedTransform);
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  await page.evaluate(() => Promise.allSettled([...document.querySelectorAll('.pending-file-card')].flatMap(card => card.getAnimations().map(animation => animation.finished))));
  await expect(strip).toHaveClass(/has-many-attachments/);
  await expect(strip).not.toHaveClass(/is-scrolling/);
  expect(await indicatorOpacity()).toBe('0');
  await strip.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await expect(strip).toHaveClass(/is-scrolling/);
  expect(await indicatorOpacity()).toBe('1');
  await page.screenshot({ path: testInfo.outputPath('preview-scrollbar-moving.png') });
  await expect(strip).not.toHaveClass(/is-scrolling/);
  expect(await indicatorOpacity()).toBe('0');
  const removed = await strip.evaluate(el => {
    const card = el.querySelector('.pending-file-card:last-of-type');
    card.querySelector('.pending-file-remove').click();
    const animation = card.getAnimations()[0];
    const css = getComputedStyle(el.parentElement);
    return { inert: card.inert, files: window.BananzaAppBridge.getPendingFiles().length,
      duration: animation?.effect.getTiming().duration,
      expectedDuration: parseFloat(css.getPropertyValue('--floating-close-duration-base')) * 1000 * parseFloat(css.getPropertyValue('--modal-animation-speed-factor')) };
  });
  expect(removed.inert).toBe(true);
  expect(removed.files).toBe(5);
  expect(removed.duration).toBeCloseTo(removed.expectedDuration);
  await expect(panel.locator('.pending-file-card')).toHaveCount(5);
  await chooseAnimation('none');
  const remaining = await strip.evaluate(el => {
    for (let index = 0; index < 2; index++) el.querySelector('.pending-file-card:last-of-type .pending-file-remove').click();
    return el.querySelectorAll('.pending-file-card').length;
  });
  expect(remaining).toBe(3);
  await strip.evaluate(el => { el.scrollLeft = 0; });
  await expect(strip).not.toHaveClass(/has-many-attachments|is-scrolling/);
  expect(await indicatorOpacity()).toBe('0');
  await chooseAnimation('lift');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#fileInputDocs').setInputFiles([{ name: 'reduced.txt', mimeType: 'text/plain', buffer: Buffer.from('Reduced') }]);
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  expect(await strip.evaluate(el => el.querySelector('.pending-file-card:last-of-type').getAnimations().length)).toBe(0);
  expect(await strip.evaluate(el => {
    el.querySelector('.pending-file-card:last-of-type .pending-file-remove').click();
    return el.querySelectorAll('.pending-file-card').length;
  })).toBe(3);
  await panel.locator('.pending-files-clear').click();
  await expect(panel).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Four thumbnails overflow; three fit. Neither the scrollbar nor a closing
  // card's transform may change the panel height or create a vertical scrollbar.
  await panel.evaluate(el => { el.style.maxWidth = '360px'; });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWJiYGD4DwAAAP//cGajQwAAAAZJREFUAwABDgEC81VxbAAAAABJRU5ErkJggg==', 'base64');
  await page.locator('#fileInput').setInputFiles(Array.from({ length: 4 }, (_, index) => ({ name: `${index}.png`, mimeType: 'image/png', buffer: png })));
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  await expect(panel).toHaveCSS('opacity', '1');
  await expect(strip).toHaveClass(/is-scrollable/);
  const before = await panel.boundingBox();
  await strip.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await expect(panel.locator('.pending-file-scrollbar')).toHaveCSS('opacity', '1');
  expect((await panel.boundingBox()).height).toBe(before.height);
  const dimensions = await strip.evaluate(async el => {
    const card = el.querySelector('.pending-file-card:last-of-type');
    card.querySelector('.pending-file-remove').click();
    const animation = card.getAnimations()[0];
    animation.pause();
    animation.currentTime = animation.effect.getTiming().duration / 2;
    await new Promise(requestAnimationFrame);
    const css = getComputedStyle(el);
    return { height: el.closest('.pending-file').getBoundingClientRect().height, scrollbar: css.scrollbarWidth, overflowY: css.overflowY };
  });
  expect(dimensions.height).toBe(before.height);
  expect(dimensions.scrollbar).toBe('none');
  expect(dimensions.overflowY).toBe('hidden');
  await page.screenshot({ path: testInfo.outputPath('preview-removing-fourth.png') });
  await strip.evaluate(el => el.querySelector('.is-removing').getAnimations().forEach(animation => animation.play()));
  await expect(panel.locator('.pending-file-card')).toHaveCount(3);
  await expect(strip).not.toHaveClass(/is-scrollable|is-scrolling/);
  await expect(panel.locator('.pending-file-scrollbar')).toHaveCSS('opacity', '0');
  expect((await panel.boundingBox()).height).toBe(before.height);
  expect((await panel.boundingBox()).y).toBe(before.y);
});

test('removing attachments preserves the preview strip scroll position', async ({ page }) => {
  await registerViaUi(page, makeUser('pwpreviewscroll'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  await page.locator('#fileInputDocs').setInputFiles(Array.from({ length: 10 }, (_, index) => ({
    name: `file-${index}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`File ${index}`),
  })));
  const panel = page.locator('#pendingFile');
  const strip = panel.locator('.pending-file-strip');
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  await expect(panel).toHaveCSS('opacity', '1');
  const before = await strip.evaluate(el => {
    const cards = el.querySelectorAll('.pending-file-card');
    el.scrollLeft = cards[2].offsetLeft - cards[0].offsetLeft;
    return el.scrollLeft;
  });
  expect(before).toBeGreaterThan(0);
  await panel.locator('.pending-file-card').nth(2).locator('.pending-file-remove').click();
  await expect(panel.locator('.pending-file-card')).toHaveCount(9);
  expect(await strip.evaluate(el => el.scrollLeft)).toBeCloseTo(before, 0);
  await panel.locator('.pending-file-card').nth(2).locator('.pending-file-remove').click();
  expect(await strip.evaluate(el => el.scrollLeft)).toBeCloseTo(before, 0);
  await strip.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await panel.locator('.pending-file-card').last().locator('.pending-file-remove').click();
  const end = await strip.evaluate(el => ({ left: el.scrollLeft, max: el.scrollWidth - el.clientWidth }));
  expect(end.left).toBeGreaterThan(0);
  expect(end.left).toBeCloseTo(end.max, 0);
});

test('preview panel follows modal animation settings and survives reopening during close', async ({ page }) => {
  await registerViaUi(page, makeUser('pwanimatedpreview'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  const panel = page.locator('#pendingFile');
  const chooseAnimation = async style => page.evaluate(style => {
    window.BananzaAppBridge.openAnimationSettingsModal();
    document.querySelector(`[data-modal-animation-style="${style}"]`).click();
    const speed = document.getElementById('settingsAnimationSpeed');
    speed.value = '3';
    speed.dispatchEvent(new Event('input', { bubbles: true }));
    window.BananzaAppBridge.closeManagedModal('animationSettingsModal', { immediate: true });
  }, style);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWJiYGD4DwAAAP//cGajQwAAAAZJREFUAwABDgEC81VxbAAAAABJRU5ErkJggg==', 'base64');
  for (const style of ['soft', 'lift', 'zoom', 'slide', 'fade', 'none']) {
    await chooseAnimation(style);
    const composerHeight = await page.locator('.input-area').evaluate(el => el.getBoundingClientRect().height);
    await page.locator('#fileInput').setInputFiles({ name: `${style}.png`, mimeType: 'image/png', buffer: png });
    await expect(panel).toHaveClass(/is-open/);
    await expect(panel).toHaveAttribute('aria-busy', 'false');
    await expect(panel).toHaveCSS('opacity', '1');
    const settings = await panel.evaluate(el => {
      const actual = getComputedStyle(el);
      const shared = getComputedStyle(document.getElementById('attachMenu'));
      return {
        duration: actual.transitionDuration, sharedDuration: shared.transitionDuration,
        transform: actual.getPropertyValue('--floating-close-transform'), sharedTransform: shared.getPropertyValue('--floating-close-transform'),
        position: actual.position,
      };
    });
    expect(settings.duration).toBe(settings.sharedDuration);
    expect(settings.transform).toBe(settings.sharedTransform);
    expect(settings.position).toBe('absolute');
    expect(await page.locator('.input-area').evaluate(el => el.getBoundingClientRect().height)).toBe(composerHeight);
    const closing = await panel.evaluate(async el => {
      const src = el.querySelector('img').src;
      el.querySelector('.pending-files-clear').click();
      const result = { hidden: el.classList.contains('hidden'), closing: el.classList.contains('is-closing'), cards: el.querySelectorAll('.pending-file-card').length, inert: el.inert };
      if (!result.hidden) result.previewRetained = (await fetch(src)).ok;
      return result;
    });
    if (style === 'none') expect(closing.hidden).toBe(true);
    else {
      expect(closing.closing).toBe(true);
      expect(closing.cards).toBe(1);
      expect(closing.previewRetained).toBe(true);
    }
    expect(closing.inert).toBe(true);
    expect(await page.locator('.input-area').evaluate(el => el.getBoundingClientRect().height)).toBe(composerHeight);
    await expect(panel).toBeHidden();
    await expect(panel.locator('.pending-file-card')).toHaveCount(0);
  }
  await chooseAnimation('soft');
  await page.locator('#fileInputDocs').setInputFiles({ name: 'old.txt', mimeType: 'text/plain', buffer: Buffer.from('old') });
  await expect(panel).toHaveCSS('opacity', '1');
  await panel.evaluate(el => el.querySelector('.pending-files-clear').click());
  await page.locator('#fileInputDocs').setInputFiles({ name: 'new.txt', mimeType: 'text/plain', buffer: Buffer.from('new') });
  await expect(panel).toHaveCSS('opacity', '1');
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  await expect(panel.locator('.pending-file-card')).toContainText('new.txt');
  // An old opacity transitionend must not finalize the interrupted close.
  await panel.evaluate(el => el.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' })));
  await expect(panel).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(panel).toHaveCSS('transition-duration', '0s');
  await panel.evaluate(el => el.querySelector('.pending-files-clear').click());
  await expect(panel).toHaveClass(/hidden/);
});

test('gallery return shows receipt while the browser has not delivered any files yet', async ({ page }, testInfo) => {
  await registerViaUi(page, makeUser('pwreturn'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  const chooserEvent = page.waitForEvent('filechooser');
  await page.evaluate(() => document.getElementById('fileInputGallery').click());
  const chooser = await chooserEvent;
  await expect(page.locator('#pendingFile')).toBeHidden();
  // Model the OS returning focus BEFORE the browser finishes importing the
  // selection. setInputFiles alone skips this interval entirely.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
  await expect(page.locator('.pending-file-receiving')).toBeVisible();
  await expect(page.locator('.pending-file-spinner')).toBeVisible();
  await expect(page.locator('#sendBtn')).toBeDisabled();
  expect(await page.locator('#fileInputGallery').evaluate(input => input.files.length)).toBe(0);
  await page.locator('#msgInput').fill('Caption before files arrive');
  for (const [theme, mode] of [['pearl', 'classic'], ['bananza', 'classic'], ['rose-pine', 'glass']]) {
    await page.evaluate(({ theme, mode }) => window.BananzaAppearance.apply(document, { theme, mode }, false), { theme, mode });
    await expect(page.locator('#pendingFile')).toHaveCSS('opacity', '1');
    const layout = await page.locator('#pendingFile').evaluate(panel => {
      const composer = panel.parentElement.getBoundingClientRect();
      const preview = panel.getBoundingClientRect();
      const style = getComputedStyle(panel);
      return { gap: composer.top - preview.bottom, blur: style.backdropFilter, background: style.backgroundColor };
    });
    expect(layout.gap).toBeGreaterThanOrEqual(7);
    if (mode === 'glass') expect(layout.blur).toContain('blur(');
    else expect(layout.background).toContain('0.9');
    await page.screenshot({ path: testInfo.outputPath(`gallery-return-${theme}-${mode}.png`) });
  }
  await page.evaluate(() => window.BananzaAppBridge.__testing.setReply(1, 'Reply', 'Message with attachments'));
  const previewBox = await page.locator('#pendingFile').boundingBox();
  const replyBox = await page.locator('#replyBar').boundingBox();
  expect(previewBox.y + previewBox.height).toBeLessThan(replyBox.y);
  await page.screenshot({ path: testInfo.outputPath('gallery-return-with-reply.png') });
  await expect(page.locator('.pending-file-receiving')).toBeVisible();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWJiYGD4DwAAAP//cGajQwAAAAZJREFUAwABDgEC81VxbAAAAABJRU5ErkJggg==', 'base64');
  await chooser.setFiles({ name: 'from-gallery.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.pending-file-receiving')).toHaveCount(0);
  await expect(page.locator('img.pending-file-thumb')).toBeVisible();
  await expect(page.locator('#msgInput')).toHaveValue('Caption before files arrive');
  await expect(page.locator('#sendBtn')).toBeEnabled();
});

test('busy thumbnail decoding does not block typing or cancelling a photo', async ({ page }) => {
  let requested = 0;
  await page.route('**/image-preview-worker.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const busy = ++requested === 1 ? 'const until = performance.now() + 3000; while (performance.now() < until) {}\n' : '';
    await route.fulfill({ response, body: busy + source });
  });
  await registerViaUi(page, makeUser('pwbusy'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWJiYGD4DwAAAP//cGajQwAAAAZJREFUAwABDgEC81VxbAAAAABJRU5ErkJggg==', 'base64');
  await page.locator('#fileInput').setInputFiles(['cancel.png', 'keep.png'].map(name => ({ name, mimeType: 'image/png', buffer: png })));
  await expect.poll(() => requested).toBe(1);
  const started = Date.now();
  await page.locator('#msgInput').fill('Still responsive');
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'true');
  await page.locator('.pending-file-remove').first().click();
  expect(Date.now() - started).toBeLessThan(2000);
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.pending-file-card')).toHaveCount(1);
  await expect(page.locator('.pending-file-card')).toContainText('keep.png');
  await expect(page.locator('img.pending-file-thumb')).toBeVisible();
  await expect(page.locator('#msgInput')).toHaveValue('Still responsive');
  await expect(page.locator('#sendBtn')).toBeEnabled();
});

test('browsers without OffscreenCanvas still produce a small preview', async ({ page }) => {
  await page.addInitScript(() => { window.OffscreenCanvas = undefined; });
  await registerViaUi(page, makeUser('pwfallback'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 2000;
    return canvas.toDataURL().split(',')[1];
  });
  await page.locator('#fileInput').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => page.locator('img.pending-file-thumb').evaluate(img => [img.naturalWidth, img.naturalHeight])).toEqual([64, 128]);
});

test('large photo album keeps the composer responsive and uses small thumbnails', async ({ page }, testInfo) => {
  await registerViaUi(page, makeUser('pwlarge'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  // Actual 24 megapixel files, not a delayed mock of Image.decode().
  const jpg = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 6000; canvas.height = 4000;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 6000, 4000);
    gradient.addColorStop(0, '#087dad'); gradient.addColorStop(1, '#fedcba');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 6000, 4000);
    return canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
  });
  const paths = Array.from({ length: 10 }, (_, index) => {
    const path = testInfo.outputPath(`large-${index}.jpg`);
    fs.writeFileSync(path, Buffer.from(jpg, 'base64'));
    return path;
  });
  await page.evaluate(() => {
    window.preparationFrames = [];
    window.trackPreparation = true;
    const frame = time => {
      window.preparationFrames.push(time);
      if (window.trackPreparation) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.locator('#fileInput').setInputFiles(paths);
  await expect(page.locator('.pending-file-spinner').first()).toBeVisible();
  await page.locator('#msgInput').fill('Typing during preparation');
  await expect(page.locator('#msgInput')).toHaveValue('Typing during preparation');
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  const measurements = await page.evaluate(() => {
    window.trackPreparation = false;
    return {
      maxFrameGap: Math.max(...window.preparationFrames.slice(1).map((time, index) => time - window.preparationFrames[index])),
      sizes: [...document.querySelectorAll('.pending-file-thumb')].map(img => [img.naturalWidth, img.naturalHeight]),
    };
  });
  console.log('Large album preparation', JSON.stringify(measurements));
  expect(measurements.sizes).toHaveLength(10);
  for (const [width, height] of measurements.sizes) {
    expect(width).toBeGreaterThan(0);
    expect(Math.max(width, height)).toBeLessThanOrEqual(128);
  }
  expect(measurements.maxFrameGap).toBeLessThan(1000);
});

test('a large document on disk does not block the composer before its card appears', async ({ page }, testInfo) => {
  const path = testInfo.outputPath('large-document.bin');
  const fd = fs.openSync(path, 'w');
  try { fs.ftruncateSync(fd, 100 * 1024 * 1024); } finally { fs.closeSync(fd); }
  await registerViaUi(page, makeUser('pwlargedoc'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  await page.locator('#fileInputDocs').setInputFiles(path);
  await expect(page.locator('.pending-file-spinner')).toBeVisible();
  await page.locator('#msgInput').fill('Large document caption');
  await expect(page.locator('#pendingFile')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.pending-file-card')).toContainText('large-document.bin');
  await expect(page.locator('#msgInput')).toHaveValue('Large document caption');
  await expect(page.locator('#sendBtn')).toBeEnabled();
});

test('real files keep preparation feedback visible without mocked decoding or network delays', async ({ page }, testInfo) => {
  await registerViaUi(page, makeUser('pwmeasure'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#087dad'; ctx.fillRect(0, 0, 1200, 900);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  for (const file of [
    { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') },
    { name: 'document.txt', mimeType: 'text/plain', buffer: Buffer.alloc(1024 * 1024, 65) },
  ]) {
    await page.evaluate(() => {
      window.preparationTimes = [];
      const target = document.getElementById('pendingFile');
      window.preparationObserver = new MutationObserver(() => {
        const busy = target.getAttribute('aria-busy') === 'true';
        if (window.preparationTimes.at(-1)?.busy !== busy) window.preparationTimes.push({ busy, at: performance.now() });
      });
      window.preparationObserver.observe(target, { attributes: true, childList: true, subtree: true });
    });
    await page.locator('#fileInput').setInputFiles(file);
    await expect(page.locator('.pending-file-spinner')).toBeVisible();
    if (file.name === 'photo.png') await page.screenshot({ path: testInfo.outputPath('real-file-preparing.png') });
    await page.waitForFunction(() => document.getElementById('pendingFile').getAttribute('aria-busy') === 'false');
    const transitions = await page.evaluate(() => window.preparationTimes);
    const started = transitions.find(phase => phase.busy);
    const finished = transitions.find(phase => !phase.busy && phase.at > started?.at);
    expect(finished.at - started.at).toBeGreaterThanOrEqual(450);
    await expect(page.locator('#sendBtn')).toBeEnabled();
    await expect(page.locator('.pending-file-card')).toContainText(file.name);
    await page.evaluate(() => window.preparationObserver.disconnect());
    await page.locator('.pending-files-clear').click();
  }
});

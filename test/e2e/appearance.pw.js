const { test, expect } = require('@playwright/test');
const { installMediaMocks, makeUser, registerViaUi, loginViaUi, getContext, createApiSession, openPrivateChat, sendComposerMessage } = require('./helpers');
const catalog = require('../../public/js/appearance');

test('glass pinned messages fit the panel and preserve scrolling and unpin actions', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  const user = makeUser('glasspins');
  await registerViaUi(page, user);
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({ width: 360, height: 780 });
  await openPrivateChat(page, getContext().bobUser.displayName);
  const api = createApiSession(); await api.login(user);
  const chatId = await page.evaluate(() => window.BananzaAppBridge.getCurrentChatId());
  for (const text of ['A pinned message with a long title that must wrap without hiding the author or escaping the panel. '.repeat(3), 'Second pinned message']) {
    const message = await api.request(`/api/chats/${chatId}/messages`, { method: 'POST', json: { text } });
    await api.request(`/api/messages/${message.data.id}/pin`, { method: 'POST', json: {} });
  }
  await expect(page.locator('#pinnedBar .pinned-bar-item')).toHaveCount(2);
  for (const theme of ['pearl', 'banan-hero']) {
    await page.evaluate(theme => {
      window.BananzaAppearance.apply(document, { theme, mode: 'glass' });
      document.getElementById('chatView').classList.add('has-chat-background');
      document.getElementById('chatBackgroundLayer').style.backgroundImage = 'repeating-linear-gradient(35deg, #10262c 0 3px, #e2b651 3px 6px)';
    }, theme);
    await expect(page.locator('#pinnedBar .pinned-bar-icon .ui-glyph').first()).toHaveAttribute('data-icon', 'pin');
    const layout = await page.locator('#pinnedBar').evaluate(bar => {
      const viewport = bar.querySelector('.pinned-bar-viewport');
      return { blur: getComputedStyle(bar).backdropFilter, overflow: bar.scrollWidth - bar.clientWidth,
        items: [...bar.querySelectorAll('.pinned-bar-item')].map(item => {
          const r = item.getBoundingClientRect(), title = item.querySelector('strong').getBoundingClientRect(), meta = item.querySelector('small').getBoundingClientRect();
          return { height: r.height, viewport: viewport.clientHeight, top: title.top - r.top, gap: meta.top - title.bottom, bottom: r.bottom - meta.bottom, border: getComputedStyle(item).borderLeftWidth };
        }) };
    });
    expect(layout.blur).toContain('blur('); expect(layout.overflow).toBeLessThanOrEqual(1);
    for (const item of layout.items) {
      expect(item.height).toBe(item.viewport); expect(item.top).toBeGreaterThanOrEqual(3);
      expect(item.gap).toBeGreaterThanOrEqual(2); expect(item.bottom).toBeGreaterThanOrEqual(3); expect(item.border).toBe('0px');
    }
    await page.locator('.pinned-bar-viewport').evaluate(el => { el.scrollTop = el.clientHeight; });
    await expect(page.locator('.pinned-bar-count')).toHaveText('2/2');
    await page.screenshot({ path: testInfo.outputPath(`pins-${theme}.png`), animations: 'disabled' });
  }
  await page.locator('.pinned-bar-item.active').click();
  await page.locator('.pinned-bar-close').click();
  await expect(page.locator('.pinned-bar-item')).toHaveCount(1);
  await page.locator('.pinned-bar-close').click();
  await expect(page.locator('#pinnedBar')).toBeHidden();
});

test('toggle thumbs have symmetric insets in both states and all designs', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  await registerViaUi(page, makeUser('toggles'));
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#settingsBtn').click();
  for (const mode of ['glass', 'classic', 'rich']) {
    await page.evaluate(mode => window.BananzaAppearance.apply(document, { theme: 'banan-hero', mode }), mode);
    for (const checked of [false, true]) {
      await page.locator('#settingsModal .toggle-switch input').evaluateAll((inputs, checked) => {
        inputs.forEach(input => { input.checked = checked; });
      }, checked);
      // Let legacy transitions finish as well before comparing their geometry.
      await page.locator('#settingsModal').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)));
      const insets = await page.locator('#settingsModal .toggle-slider').evaluateAll(sliders => sliders.map(el => {
        const track = getComputedStyle(el), thumb = getComputedStyle(el, '::before');
        const matrix = thumb.transform === 'none' ? new DOMMatrix() : new DOMMatrix(thumb.transform);
        const left = parseFloat(track.borderLeftWidth) + parseFloat(thumb.left) + matrix.m41;
        const bottom = parseFloat(track.borderBottomWidth) + parseFloat(thumb.bottom);
        return { left, right: el.offsetWidth - left - parseFloat(thumb.width), bottom,
          top: el.offsetHeight - bottom - parseFloat(thumb.height) };
      }));
      expect(insets.length).toBeGreaterThanOrEqual(5);
      for (const inset of insets) {
        expect(inset.top).toBe(3); expect(inset.bottom).toBe(3);
        expect(checked ? inset.right : inset.left).toBe(3);
        expect(checked ? inset.left : inset.right).toBe(21);
      }
      if (mode === 'glass') await page.screenshot({ path: testInfo.outputPath(`toggles-${checked ? 'on' : 'off'}.png`), animations: 'disabled' });
    }
  }
  await page.evaluate(() => window.BananzaAppearance.apply(document, { theme: 'pearl', mode: 'glass' }));
  const input = page.locator('#settingsSendEnter');
  await input.locator('..').click();
  await expect(input).not.toBeChecked();
  await input.locator('..').click();
  await expect(input).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('toggles-pearl.png'), animations: 'disabled' });
});

test('sidebar settings gear spins only in glass and respects reduced motion', async ({ page }) => {
  await installMediaMocks(page);
  await registerViaUi(page, makeUser('settingsspin'));
  await page.evaluate(() => {
    window.settingsGearAnimations = [];
    document.getElementById('settingsBtn').addEventListener('animationstart', event => {
      window.settingsGearAnimations.push(event.animationName);
    });
  });
  for (const mode of ['glass', 'classic', 'rich', 'glass']) {
    await page.evaluate(mode => {
      window.BananzaAppearance.apply(document, { theme: 'pearl', mode });
      window.settingsGearAnimations = [];
    }, mode);
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#settingsModal')).toBeVisible();
    if (mode === 'glass') {
      await expect.poll(() => page.evaluate(() => window.settingsGearAnimations)).toEqual(['chatHeaderActionSpin']);
    } else {
      expect(await page.evaluate(() => window.settingsGearAnimations)).toEqual([]);
    }
    await expect(page.locator('#settingsBtn')).not.toHaveClass(/is-spinning/);
    await page.locator('#settingsModal .modal-close').click();
    await expect(page.locator('#settingsModal')).toBeHidden();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { window.settingsGearAnimations = []; });
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settingsModal')).toBeVisible();
  await expect(page.locator('#settingsBtn')).toHaveCSS('animation-name', 'none');
  expect(await page.evaluate(() => window.settingsGearAnimations)).toEqual([]);
});

test('chat header icons are distinct in glass and keep legacy symbols in older designs', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  // Show call controls without requiring an external LiveKit service for this UI check.
  await page.route(/\/api\/(features|calls\/active)$/, async route => {
    const response = await route.fetch();
    const data = await response.json();
    const enabled = { calls_enabled: true, livekit_ready: true };
    await route.fulfill({ response, json: route.request().url().endsWith('/features')
      ? { ...data, ...enabled } : { ...data, settings: { ...data.settings, ...enabled } } });
  });
  await registerViaUi(page, makeUser('headericons'));
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({ width: 360, height: 780 });
  await openPrivateChat(page, getContext().bobUser.displayName);
  await page.locator('#chatInfoBtn').click();
  await expect(page.locator('#chatInfoBtn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#callVoiceStartBtn .ui-glyph')).toHaveAttribute('data-icon', 'phone');
  await expect(page.locator('#callVoiceStartBtn')).toBeVisible();
  for (const mode of ['glass', 'classic', 'rich', 'glass']) {
    await page.evaluate(mode => window.BananzaAppearance.apply(document, { theme: 'lavender', mode }), mode);
    for (const [id, icon] of Object.entries({ chatInfoBtn: 'settings', chatSettingsActionBtn: 'ellipsis', callVoiceStartBtn: 'phone', callStartBtn: 'video' })) {
      const button = page.locator(`#${id}`);
      await expect(button.locator('> .ui-glyph')).toHaveAttribute('data-icon', icon);
      if (mode === 'glass') {
        await expect(button.locator('> .ui-glyph')).toBeVisible();
        await expect(button.locator('> .ui-icon-legacy')).toBeHidden();
      } else {
        await expect(button.locator('> .ui-glyph')).toBeHidden();
        await expect(button.locator('> .ui-icon-legacy')).toBeVisible();
      }
    }
    await expect(page.locator('#callVoiceStartBtn .ui-icon-legacy')).toHaveText('\u260e\ufe0f');
    await expect(page.locator('#chatInfoBtn .ui-icon-legacy')).toHaveText('\u2699\ufe0f');
    await page.screenshot({ path: testInfo.outputPath(`header-icons-${mode}.png`), animations: 'disabled' });
  }
  await page.locator('#chatSettingsActionBtn').click();
  await expect(page.locator('#chatInfoModal')).toBeVisible();
});

test('active glass chat keeps row geometry and uses a soft fill without an outline', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  await registerViaUi(page, makeUser('chatframe'));
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({ width: 360, height: 780 });
  const row = page.locator('#chatList .chat-item').first();
  await expect(row).toBeVisible();
  for (const theme of ['lavender', 'bananza']) {
    await page.evaluate(theme => window.BananzaAppearance.apply(document, { theme, mode: 'glass' }), theme);
    const geometry = await row.evaluate(el => {
      const bounds = () => [el, el.querySelector('.chat-item-avatar'), el.querySelector('.chat-item-body'), el.querySelector('.chat-item-top')].map(node => {
        const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
      });
      el.classList.remove('active'); const before = bounds();
      el.classList.add('active'); const after = bounds();
      const s = getComputedStyle(el);
      return { before, after, shadow: s.boxShadow,
        widths: ['Top', 'Right', 'Bottom', 'Left'].map(side => s[`border${side}Width`]),
        colors: ['Top', 'Right', 'Bottom', 'Left'].map(side => s[`border${side}Color`]) };
    });
    expect(geometry.after).toEqual(geometry.before);
    expect(geometry.shadow).toBe('none');
    expect(geometry.widths).toEqual(['1px', '1px', '1px', '1px']);
    expect(geometry.colors).toEqual(Array(4).fill('rgba(0, 0, 0, 0)'));
    await expect(row).toHaveCSS('background-color', theme === 'lavender' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.18)');
    await page.screenshot({ path: testInfo.outputPath(`active-chat-${theme}.png`), animations: 'disabled' });
  }
  await row.click();
  await expect(page.locator('#chatView')).toBeVisible();
});

test('settings and dynamically mounted controls use monochrome local icons', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  await loginViaUi(page, getContext().adminUser);
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({ width: 360, height: 780 });
  await page.locator('#settingsBtn').click();
  for (const theme of ['pearl', 'bananza']) {
    await page.evaluate(theme => window.BananzaAppearance.apply(document, { theme, mode: 'glass' }), theme);
    for (const [id, icon] of Object.entries({ settingsChangePassword: 'lock', settingsApiTokensPanel: 'key-round', settingsVideoNotePanel: 'clapperboard', settingsBackupPanel: 'hard-drive', settingsYandexAiPanel: 'bird', settingsDeepSeekAiPanel: 'whale', settingsQwenAiPanel: 'brain', settingsAiInitiativesPanel: 'message-circle' })) {
      await expect(page.locator(`#${id} > .ui-glyph`)).toHaveAttribute('data-icon', icon);
      const glyph = page.locator(`#${id} > .ui-glyph`);
      await expect(glyph).toHaveCSS('color', theme === 'pearl' ? 'rgb(36, 36, 36)' : 'rgb(238, 238, 238)');
      await expect(glyph).toHaveCSS('width', '20px');
    }
    const remaining = await page.locator('#settingsModal .settings-item').evaluateAll(buttons => buttons.flatMap(button => {
      const clone = button.cloneNode(true);
      clone.querySelectorAll('.ui-icon-legacy, .ui-glyph').forEach(el => el.remove());
      return /^\p{Extended_Pictographic}/u.test(clone.textContent.trim()) ? [button.id || clone.textContent] : [];
    }));
    expect(remaining).toEqual([]);
    const icons = await page.locator('#settingsModal button.settings-item > .ui-glyph').evaluateAll(nodes => nodes.map(node => node.dataset.icon));
    expect(new Set(icons).size, `Repeated settings icons: ${icons.join(', ')}`).toBe(icons.length);
    await page.locator('#settingsAiInitiativesPanel').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`settings-icons-${theme}.png`), animations: 'disabled' });
  }
  await page.locator('#settingsVideoNotePanel').click();
  await expect(page.locator('#videoNoteAdminModal')).toBeVisible();
});

test('glass tab selection outlines the whole control on modal and login pages', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  await registerViaUi(page, makeUser('glasstabs'));
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({ width: 360, height: 780 });
  await page.locator('#newChatBtn').click();
  await expect(page.locator('#newChatModal')).toBeVisible();
  async function checkSelected(tab) {
    await expect(tab).toHaveClass(/active/);
    await tab.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const style = await tab.evaluate(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return { borders: ['Top', 'Right', 'Bottom', 'Left'].map(side => [s[`border${side}Width`], s[`border${side}Color`]]),
        background: s.backgroundColor, height: r.height, overflow: el.scrollWidth - el.clientWidth, right: r.right, viewport: innerWidth };
    });
    expect(style.borders.map(b => b[0])).toEqual(['1px', '1px', '1px', '1px']);
    expect(new Set(style.borders.map(b => b[1])).size).toBe(1);
    expect(style.borders[0][1]).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.height).toBeGreaterThanOrEqual(44);
    expect(style.overflow).toBeLessThanOrEqual(1);
    expect(style.right).toBeLessThanOrEqual(style.viewport);
  }
  for (const theme of ['pearl', 'bananza']) {
    await page.evaluate(theme => window.BananzaAppearance.apply(document, { theme, mode: 'glass' }), theme);
    for (const name of ['private', 'group', 'document', 'folder']) {
      const tab = page.locator(`#newChatModal .modal-tab[data-tab="${name}"]`);
      await tab.click();
      await checkSelected(tab);
    }
    const positions = await page.locator('#newChatModal .modal-tab').evaluateAll(tabs => tabs.map(tab => {
      const rect = tab.getBoundingClientRect(); return { width: rect.width, top: rect.top };
    }));
    expect(Math.max(...positions.map(p => p.width)) - Math.min(...positions.map(p => p.width))).toBeLessThanOrEqual(1);
    expect(new Set(positions.map(p => p.top)).size).toBe(1);
    await page.screenshot({ path: testInfo.outputPath(`modal-tabs-${theme}.png`), animations: 'disabled' });
  }
  await page.evaluate(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); });
  await page.goto(`${getContext().baseUrl}/login.html`);
  for (const theme of ['pearl', 'bananza']) {
    await page.evaluate(theme => window.BananzaAppearance.apply(document, { theme, mode: 'glass' }), theme);
    for (const name of ['register', 'login']) {
      const tab = page.locator(`.tab[data-tab="${name}"]`);
      await tab.click();
      await checkSelected(tab);
    }
    await page.screenshot({ path: testInfo.outputPath(`login-tabs-${theme}.png`), animations: 'disabled' });
  }
  await page.evaluate(() => window.BananzaAppearance.apply(document, { theme: 'bananza', mode: 'classic' }));
  await expect(page.locator('.tab.active')).toHaveCSS('border-bottom-width', '2px');
});

async function openTheme(page) {
  await page.locator('#settingsBtn').click();
  await page.locator('#settingsThemePanel').click();
  await expect(page.locator('#themeSettingsModal')).toBeVisible();
}

test('glass theme selection, persistence and cancellation work in the real UI', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await registerViaUi(page, makeUser('glassui'), { appearance: false });
  await openTheme(page);
  await page.locator('[data-visual-mode-option="glass"]').click();
  await expect(page.locator('#settingsVisualModeStatus')).toContainText(/Saved|Сохранено/);
  await page.locator('[data-theme="pearl"]').click();
  await expect(page.locator('#settingsThemeStatus')).toContainText(/Saved|Сохранено/);
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
  await page.screenshot({ path: testInfo.outputPath('theme-pearl.png') });
  await page.reload();
  await expect(page.locator('#chatList')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-visual-mode', 'glass');
  await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'pearl');
  await openPrivateChat(page, getContext().bobUser.displayName);
  await sendComposerMessage(page, 'Glass: readable messages, replies and controls.');
  await expect(page.locator('.msg-text').last()).toContainText('Glass:');
  await page.screenshot({ path: testInfo.outputPath('chat-pearl.png') });
  await page.evaluate(() => { window.dialogResult = undefined; window.BananzaDialogs.confirm('Delete?').then(value => { window.dialogResult = value; }); });
  await expect(page.locator('#appDialog')).toBeVisible();
  await page.locator('#appDialog .app-dialog-cancel').click();
  await expect.poll(() => page.evaluate(() => window.dialogResult)).toBe(false);
  expect(errors).toEqual([]);
});

test('all palette and mode combinations render without overflow; modal inventory uses shared surfaces', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await installMediaMocks(page);
  await loginViaUi(page, getContext().adminUser);
  if (testInfo.project.name.includes('mobile')) await page.setViewportSize({ width: 360, height: 780 });
  await openTheme(page);
  for (const theme of catalog.themes) for (const mode of catalog.modes) {
    await page.evaluate(({ theme, mode }) => window.BananzaAppearance.apply(document, { theme, mode }), { theme: theme.id, mode: mode.id });
    await expect(page.locator('html')).toHaveAttribute('data-ui-theme', theme.id);
    const layout = await page.locator('#themeSettingsModal .modal-content').evaluate(el => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: innerWidth, overflow: el.scrollWidth - el.clientWidth };
    });
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(layout.width + 1);
    expect(layout.overflow).toBeLessThanOrEqual(2);
  }
  await page.evaluate(() => window.BananzaAppBridge.closeAllModals({ immediate: true }));
  const modals = await page.locator('.modal[id]').evaluateAll(nodes => nodes.map(node => node.id));
  for (const theme of ['pearl', 'bananza']) {
    await page.evaluate(theme => window.BananzaAppearance.apply(document, { theme, mode: 'glass' }), theme);
    for (const id of modals) {
      if (id === 'appDialog') continue;
      await page.evaluate(id => window.BananzaAppBridge.openManagedModal(id, { replaceStack: true }), id);
      await expect(page.locator(`#${id}`)).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${id}.png`), animations: 'disabled' });
      await page.evaluate(() => window.BananzaAppBridge.closeAllModals({ immediate: true }));
    }
  }
  await page.evaluate(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); });
  await page.goto(`${getContext().baseUrl}/login.html`);
  await expect(page.locator('html')).toHaveAttribute('data-visual-mode', 'glass');
  await page.screenshot({ path: testInfo.outputPath('login-glass.png') });
  await page.evaluate(() => { window.dialogResult = undefined; window.BananzaDialogs.prompt('URL', 'https://').then(value => { window.dialogResult = value; }); });
  await expect(page.locator('#appDialog')).toBeVisible();
  await page.locator('#appDialogInput').fill('https://example.com/');
  await page.locator('#appDialog [type="submit"]').click();
  await expect.poll(() => page.evaluate(() => window.dialogResult)).toBe('https://example.com/');
});

test('glass foregrounds meet contrast targets across light and dark palettes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'same color values on both viewports');
  await installMediaMocks(page);
  await registerViaUi(page, makeUser('contrast'));
  const results = await page.evaluate(() => {
    const probe = document.createElement('span'); document.body.appendChild(probe);
    const rgb = token => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number);
    };
    const lum = value => value.map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((v, x, i) => v + x * [.2126, .7152, .0722][i], 0);
    const ratio = (a, b) => { const l = [lum(rgb(a)), lum(rgb(b))].sort((a, b) => b - a); return (l[0] + .05) / (l[1] + .05); };
    const values = [];
    for (const theme of window.BananzaAppearance.themes) {
      window.BananzaAppearance.apply(document, { theme: theme.id, mode: 'glass' });
      for (const [fg, bg] of [['--text-primary', '--bg-other-msg'], ['--text-primary', '--bg-own-msg'], ['--text-time', '--bg-own-msg'], ['--text-secondary', '--bg-modal'], ['--on-accent', '--accent']]) {
        values.push({ theme: theme.id, fg, bg, ratio: ratio(fg, bg) });
      }
    }
    probe.remove(); return values;
  });
  for (const value of results) expect(value.ratio, JSON.stringify(value)).toBeGreaterThanOrEqual(4.5);
});

test('guest document link dialog preserves selection and cancellation', async ({ page }, testInfo) => {
  const api = createApiSession();
  await api.login(getContext().adminUser);
  const created = await api.request('/api/documents', { method: 'POST', json: { title: 'Glass document' } });
  const invite = await api.request(`/api/documents/${created.data.id}/invite-link`);
  await page.addInitScript(() => {
    localStorage.setItem('bananzaAppearance', JSON.stringify({ theme: 'pearl', mode: 'glass' }));
    localStorage.setItem('bananza.uiLanguage', 'en');
  });
  await page.goto(`${getContext().baseUrl}${invite.data.path}`);
  await expect(page.locator('#documentGuestStatus')).toContainText('Online');
  const editor = page.locator('.ProseMirror');
  await expect(editor).toBeVisible();
  if (testInfo.project.name.includes('mobile')) {
    await editor.locator('p').first().tap();
    await expect(editor).toHaveAttribute('contenteditable', 'true');
  }
  await editor.fill('A link in the glass document');
  await editor.press('ControlOrMeta+a');
  const linkButton = page.locator('.document-toolbar-btn').filter({ has: page.locator('[data-icon="external-link"]') });
  await linkButton.click();
  await expect(page.locator('#appDialog')).toBeVisible();
  await page.locator('#appDialog .app-dialog-cancel').click();
  await expect(page.locator('#appDialog')).toBeHidden();
  await expect(editor.locator('a')).toHaveCount(0);
  await expect(editor).toHaveAttribute('contenteditable', 'true');
  await expect(editor).toBeFocused();
  await editor.press('ControlOrMeta+a');
  await expect.poll(() => page.evaluate(() => window.getSelection().toString())).toBe('A link in the glass document');
  await linkButton.click();
  await page.locator('#appDialogInput').fill('https://example.com/');
  await page.locator('#appDialog [type="submit"]').click();
  await expect(editor.locator('a')).toHaveAttribute('href', 'https://example.com/');
  await page.screenshot({ path: testInfo.outputPath('guest-document.png') });
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await linkButton.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(linkButton).toBeFocused();
  expect(await linkButton.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  expect(await linkButton.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
});

test('glass accessibility preferences use solid surfaces and standalone calls inherit appearance', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('bananzaAppearance', JSON.stringify({ theme: 'pearl', mode: 'glass' })));
  await page.goto(`${getContext().baseUrl}/login.html`);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-reduced-transparency', value: 'reduce' },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ] });
  await page.evaluate(() => { window.BananzaDialogs.confirm('A long confirmation that must remain readable when transparency is reduced and interface text is enlarged.'); });
  const card = page.locator('#appDialog .modal-content');
  await expect(card).toBeVisible();
  expect(await card.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(252, 253, 255)');
  await page.evaluate(() => { document.documentElement.style.setProperty('text-size-adjust', '150%'); document.documentElement.style.setProperty('-webkit-text-size-adjust', '150%'); });
  expect(await card.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('dialog-large-text.png'), animations: 'disabled' });
  await page.locator('#appDialog .app-dialog-cancel').click();
  await expect(page.locator('#appDialog')).toBeHidden();
  await page.emulateMedia({ contrast: 'more', reducedMotion: 'reduce' });
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--glass-line').trim())).toBe('#253347');
  await page.goto(`${getContext().baseUrl}/call/invalid-glass-test-invite`);
  await expect(page.locator('html')).toHaveAttribute('data-visual-mode', 'glass');
  await expect(page.locator('#callExternalEnded')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('external-call.png'), animations: 'disabled' });
});

test('glass panels transmit the scene without a second dimming layer', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  await registerViaUi(page, makeUser('frost'));
  await page.evaluate(() => window.BananzaAppearance.apply(document, { theme: 'pearl', mode: 'glass' }));
  await openPrivateChat(page, getContext().bobUser.displayName);
  await sendComposerMessage(page, 'Glass surfaces let the colors and shapes of the conversation show through.');
  // On mobile the global settings button belongs to the hidden sidebar.
  await page.evaluate(() => window.BananzaAppBridge.openManagedModal('settingsModal'));
  for (const theme of ['pearl', 'bananza']) {
    await page.evaluate(theme => window.BananzaAppearance.apply(document, { theme, mode: 'glass' }), theme);
    const material = await page.locator('#settingsModal').evaluate(el => {
      const modal = getComputedStyle(el);
      const card = getComputedStyle(el.querySelector('.modal-content'));
      const alpha = color => { const parts = color.match(/[\d.]+/g).map(Number); return parts.length > 3 ? parts.at(-1) : 1; };
      return { overlay: alpha(modal.backgroundColor), scrim: Number(modal.getPropertyValue('--modal-backdrop-opacity')), card: alpha(card.backgroundColor), blur: card.backdropFilter };
    });
    expect(material.overlay).toBe(0);
    expect(material.scrim).toBeLessThanOrEqual(.2);
    expect(material.card).toBeLessThanOrEqual(.73);
    expect(material.blur).toContain('blur(');
    await page.screenshot({ path: testInfo.outputPath(`glass-${theme}.png`), animations: 'disabled' });
  }
});

test('incoming and outgoing glass messages remain translucent on wallpapers', async ({ page }, testInfo) => {
  await installMediaMocks(page);
  await registerViaUi(page, makeUser('glassmsg'));
  await openPrivateChat(page, getContext().bobUser.displayName);
  await sendComposerMessage(page, 'Outgoing glass message. The background should show through this bubble.');
  const bob = createApiSession(); await bob.login(getContext().bobUser);
  const chatId = await page.evaluate(() => window.BananzaAppBridge.getCurrentChatId());
  await bob.request(`/api/chats/${chatId}/messages`, { method: 'POST', json: { text: 'Incoming glass message. Text and timestamps remain readable.' } });
  await expect(page.locator('.msg-row.other .msg-text').last()).toContainText('Incoming glass message');
  for (const theme of ['pearl', 'bananza']) {
    await page.evaluate(theme => window.BananzaAppearance.apply(document, { theme, mode: 'glass' }), theme);
    for (const wallpaper of [false, true]) {
      await page.locator('.messages').evaluate((el, enabled) => {
        el.classList.toggle('has-bg', enabled);
        el.style.backgroundImage = enabled ? 'linear-gradient(125deg, #284b95, #78bba5 48%, #efd393)' : '';
      }, wallpaper);
      for (const side of ['own', 'other']) {
        const alpha = await page.locator(`.msg-row.${side} .msg-bubble`).last().evaluate(el => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = getComputedStyle(el).backgroundColor; ctx.fillRect(0, 0, 1, 1);
          return ctx.getImageData(0, 0, 1, 1).data[3] / 255;
        });
        expect(alpha, `${theme} wallpaper=${wallpaper} ${side}`).toBeGreaterThan(.5);
        expect(alpha, `${theme} wallpaper=${wallpaper} ${side}`).toBeLessThan(.8);
      }
      await page.screenshot({ path: testInfo.outputPath(`messages-${theme}-${wallpaper ? 'wallpaper' : 'default'}.png`), animations: 'disabled' });
    }
  }
  const contrast = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const pixel = (...layers) => {
      ctx.clearRect(0, 0, 1, 1);
      for (const color of layers) { ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); }
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };
    const lum = rgb => rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const results = [];
    for (const theme of window.BananzaAppearance.themes) {
      window.BananzaAppearance.apply(document, { theme: theme.id, mode: 'glass' });
      for (const side of ['own', 'other']) {
        const bubble = document.querySelector(`.msg-row.${side} .msg-bubble`);
        // Test both extreme wallpaper pixels, including the brightest point of the sheen.
        for (const wallpaper of ['#000', '#fff']) for (const sheen of ['transparent', theme.light ? '#ffffff38' : '#ffffff12']) {
          const bg = pixel(wallpaper, getComputedStyle(bubble).backgroundColor, sheen);
          for (const selector of ['.msg-text', '.msg-time']) {
            const fg = pixel(getComputedStyle(bubble.querySelector(selector)).color);
            const l = [lum(bg), lum(fg)].sort((a, b) => b - a);
            results.push({ theme: theme.id, side, wallpaper, sheen, selector, ratio: (l[0] + .05) / (l[1] + .05) });
          }
        }
      }
    }
    window.BananzaAppearance.apply(document, { theme: 'bananza', mode: 'glass' });
    return results;
  });
  expect(contrast.filter(value => value.ratio < 4.5)).toEqual([]);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  expect(await page.locator('.msg-row.own .msg-bubble').last().evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(43, 82, 120)');
});

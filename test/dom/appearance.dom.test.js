const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppDom, loadAppRuntimeScripts, loadBrowserScript } = require('../support/domHarness');
const catalog = require('../../public/js/appearance');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('appearance catalog applies all 33 combinations and restores a safe local preference', () => {
  const dom = createAppDom();
  try {
    assert.equal(catalog.themes.length, 11);
    assert.deepEqual(catalog.modeIds, ['classic', 'rich', 'glass']);
    for (const theme of catalog.themes) for (const mode of catalog.modes) {
      catalog.apply(dom.window.document, { theme: theme.id, mode: mode.id });
      assert.equal(dom.window.document.documentElement.dataset.colorScheme, theme.light ? 'light' : 'dark');
      assert.deepEqual(catalog.read(dom.window.localStorage), { theme: theme.id, mode: mode.id });
    }
    assert.deepEqual(Object.keys(JSON.parse(dom.window.localStorage.getItem(catalog.storageKey))).sort(), ['mode', 'theme']);
    dom.window.localStorage.setItem('user', JSON.stringify({ ui_theme: 'mint', ui_visual_mode: 'glass' }));
    assert.deepEqual(catalog.read(dom.window.localStorage), { theme: 'mint', mode: 'glass' });
    assert.deepEqual(catalog.normalize({ theme: 'unknown', mode: 'unknown' }), { theme: 'bananza', mode: 'classic' });
    dom.window.localStorage.setItem('user', '{bad');
    assert.deepEqual(catalog.read(dom.window.localStorage), { theme: 'bananza', mode: 'classic' });
  } finally { dom.window.close(); }
});

test('rapid appearance changes preserve independent choices and rollback to confirmed state', async () => {
  const dom = createAppDom(); loadAppRuntimeScripts(dom);
  const win = dom.window;
  let user = { ui_theme: 'bananza', ui_visual_mode: 'classic' };
  const state = { theme: 'bananza', mode: 'classic' };
  const pending = [];
  const ui = win.BananzaApp.settings.ui.createUiSettings({
    window: win, document: win.document, config: win.BananzaApp.config,
    getCurrentUser: () => user, setCurrentUser: value => { user = value; },
    state: {
      getCurrentUiTheme: () => state.theme, setCurrentUiTheme: value => { state.theme = value; },
      getCurrentVisualMode: () => state.mode, setCurrentVisualMode: value => { state.mode = value; },
    },
    api: (url, options) => new Promise((resolve, reject) => pending.push({ url, options, resolve, reject })),
  });
  try {
    const first = ui.selectUiTheme('pearl');
    const second = ui.selectVisualMode('glass');
    const third = ui.selectUiTheme('mint');
    await tick(); assert.equal(pending.length, 1);
    pending[0].resolve({ user: { ui_theme: 'pearl', ui_visual_mode: 'classic' } });
    await first; await tick(); assert.deepEqual(state, { theme: 'mint', mode: 'glass' });
    pending[1].resolve({ user: { ui_theme: 'pearl', ui_visual_mode: 'glass' } });
    await second; await tick();
    pending[2].reject(new Error('save failed')); await third;
    assert.deepEqual(state, { theme: 'pearl', mode: 'glass' });
    assert.equal(user.ui_theme, 'pearl'); assert.equal(user.ui_visual_mode, 'glass');
    assert.deepEqual(catalog.read(win.localStorage), { theme: 'pearl', mode: 'glass' });
    assert.equal(win.document.getElementById('settingsThemeStatus').textContent, 'Theme save failed');
    assert.equal(win.document.querySelectorAll('#settingsVisualModePicker [data-visual-mode-option]').length, 3);
    assert.equal(win.document.querySelector('#themeSettingsModal [data-visual-mode-option="glass"]').getAttribute('aria-pressed'), 'true');
  } finally { win.close(); }
});

test('managed dialogs preserve cancellation, nested stack and prompt text', async () => {
  const dom = createAppDom(); loadAppRuntimeScripts(dom); loadBrowserScript(dom, 'public/js/dialogs.js');
  const { window: win } = dom;
  try {
    const manager = win.BananzaApp.modalManager.createModalManager({ window: win, document: win.document });
    win.BananzaAppBridge = {
      registerManagedModal: manager.register, openManagedModal: manager.open,
      closeManagedModal: id => manager.close(id, { immediate: true }),
    };
    manager.open('settingsModal');
    const canceled = win.BananzaDialogs.confirm('<b>Delete?</b>'); await tick();
    assert.equal(manager.getStack().length, 2);
    assert.equal(win.document.querySelector('#appDialogMessage b'), null);
    win.document.querySelector('#appDialog .app-dialog-cancel').click();
    assert.equal(await canceled, false); assert.equal(manager.getTop().id, 'settingsModal');
    const approved = win.BananzaDialogs.confirm('Delete?'); await tick();
    win.document.querySelector('#appDialog [type="submit"]').click(); assert.equal(await approved, true);
    const prompt = win.BananzaDialogs.prompt('URL', 'https://'); await tick();
    win.document.querySelector('#appDialogInput').value = 'https://example.com/';
    win.document.querySelector('#appDialog [type="submit"]').click();
    assert.equal(await prompt, 'https://example.com/');
    const escape = win.BananzaDialogs.confirm('Delete?'); await tick();
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(await escape, false); assert.equal(manager.getTop().id, 'settingsModal');
    const back = win.BananzaDialogs.confirm('Delete?'); await tick();
    manager.closeTop({ immediate: true, fromHistory: true }); assert.equal(await back, false);
  } finally { win.close(); }
});

test('local UI icons preserve legacy labels and never decorate message emoji', async () => {
  const dom = createAppDom();
  const win = dom.window;
  try {
    const wrap = win.document.createElement('div');
    wrap.innerHTML = '<button id="iconTest">\u2709 Send</button><div class="settings-toggle-item"><span>\ud83c\udf99 Microphone</span></div><div class="msg-text"><button>\u2709 User content</button></div>';
    win.document.body.appendChild(wrap);
    loadBrowserScript(dom, 'public/js/ui-icons.js');
    await new Promise(resolve => win.setTimeout(resolve, 80));
    assert.equal(wrap.querySelector('#iconTest .ui-glyph').dataset.icon, 'send');
    assert.equal(wrap.querySelector('#iconTest').textContent, '\u2709 Send');
    assert.equal(wrap.querySelector('.settings-toggle-item .ui-glyph').dataset.icon, 'mic');
    assert.equal(wrap.querySelector('.msg-text .ui-glyph'), null);
    wrap.querySelector('#iconTest').textContent = '\ud83d\ude48 Hide';
    await new Promise(resolve => win.setTimeout(resolve, 80));
    assert.equal(wrap.querySelectorAll('#iconTest .ui-glyph').length, 1);
    assert.equal(wrap.querySelector('#iconTest .ui-glyph').dataset.icon, 'eye-off');
    const samples = { '\uD83C\uDFAC': 'clapperboard', '\uD83E\uDDF0': 'hard-drive', '\uD83D\uDC13': 'bird', '\uD83D\uDC0B': 'whale', '\uD83E\uDDE0': 'brain', '\uD83D\uDCAC': 'message-circle', '\uD83C\uDF4C': 'banana', '\uD83D\uDCE4': 'forward', '\uD83D\uDE42': 'smile' };
    for (const [symbol, name] of Object.entries(samples)) {
      const button = win.document.createElement('button');
      button.className = 'settings-item'; button.textContent = `${symbol} Label`;
      wrap.append(button);
      await new Promise(resolve => win.setTimeout(resolve, 40));
      assert.equal(button.querySelector('.ui-glyph')?.dataset.icon, name);
      assert.equal(button.textContent, `${symbol} Label`);
    }
    const reaction = win.document.createElement('div');
    reaction.className = 'reaction-picker';
    reaction.innerHTML = '<button data-emoji="\uD83C\uDF4C">\uD83C\uDF4C</button><button data-reaction-action="context-convert">\uD83C\uDF4C</button>';
    wrap.append(reaction);
    await new Promise(resolve => win.setTimeout(resolve, 40));
    assert.equal(reaction.querySelector('[data-emoji] .ui-glyph'), null);
    assert.equal(reaction.querySelector('[data-reaction-action] .ui-glyph')?.dataset.icon, 'banana');
  } finally { win.close(); }
});

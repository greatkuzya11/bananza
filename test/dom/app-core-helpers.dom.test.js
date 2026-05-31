const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  loadAppScript,
  loadAppShellScripts,
  loadBrowserScript,
  loadBrowserScripts,
} = require('../support/domHarness');

function loadCoreBase(dom) {
  loadAppShellScripts(dom);
  loadBrowserScripts(dom, [
    'public/js/app/config.js',
    'public/js/app/i18n-helpers.js',
    'public/js/app/formatters.js',
    'public/js/app/attachments.js',
  ]);
}

test('BananzaApp.config exposes immutable core constants', () => {
  const dom = createAppDom();
  loadBrowserScripts(dom, [
    'public/js/app/namespace.js',
    'public/js/app/config.js',
  ]);

  const { config } = dom.window.BananzaApp;
  assert.ok(config);
  assert.equal(config.WS_URL, 'ws://localhost:3000/ws');
  assert.equal(config.PAGE_SIZE, 50);
  assert.equal(config.MAX_ATTACHMENTS, 10);
  assert.equal(config.IMAGE_MIME_TYPES.has('image/png'), true);
  assert.equal(config.IMAGE_MIME_TYPES.add, undefined);
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.UI_THEMES), true);
  assert.equal(Object.isFrozen(config.UI_THEMES[0]), true);
  assert.throws(() => config.UI_THEMES.push({ id: 'x' }), /object is not extensible/);
});

test('i18n helpers use BananzaI18n and preserve app fallbacks', () => {
  const dom = createAppDom();
  loadBrowserScripts(dom, [
    'public/js/app/namespace.js',
    'public/js/app/i18n-helpers.js',
  ]);

  const helpers = dom.window.BananzaApp.i18nHelpers;
  assert.equal(helpers.t('Hello'), 'Hello');
  assert.equal(helpers.t(''), '');
  assert.equal(helpers.tx(null), '');
  assert.equal(helpers.tx('Raw'), 'Raw');

  dom.window.BananzaI18n = {
    t(key, params = {}) {
      return `t:${key}:${params.name || ''}`;
    },
    text(text, params = {}) {
      return `text:${text}:${params.name || ''}`;
    },
  };
  assert.equal(helpers.t('Hello', { name: 'Ada' }), 't:Hello:Ada');
  assert.equal(helpers.tx('Raw', { name: 'Ada' }), 'text:Raw:Ada');

  delete dom.window.BananzaI18n.text;
  assert.equal(helpers.tx('Raw', { name: 'Ada' }), 't:Raw:Ada');
});

test('formatters keep escaping and size formatting behavior', () => {
  const dom = createAppDom();
  loadBrowserScripts(dom, [
    'public/js/app/namespace.js',
    'public/js/app/i18n-helpers.js',
    'public/js/app/formatters.js',
  ]);

  const { formatters } = dom.window.BananzaApp;
  assert.equal(formatters.esc('<b>&</b>'), '&lt;b&gt;&amp;&lt;/b&gt;');
  assert.equal(formatters.formatSize(512), '512 B');
  assert.equal(formatters.formatSize(1536), '1.5 KB');
  assert.equal(formatters.formatSize(2 * 1024 * 1024), '2.0 MB');
});

test('attachment URL helpers preserve preview download poster and client URLs', () => {
  const dom = createAppDom();
  loadBrowserScripts(dom, [
    'public/js/app/namespace.js',
    'public/js/app/config.js',
    'public/js/app/attachments.js',
  ]);

  const helpers = dom.window.BananzaApp.attachments;
  assert.equal(helpers.getAttachmentPreviewUrl('file name.png'), '/uploads/file%20name.png/preview');
  assert.equal(helpers.getAttachmentDownloadUrl('file name.png'), '/uploads/file%20name.png');
  assert.equal(helpers.getAttachmentPosterUrl('file name.mp4'), '/uploads/file%20name.mp4/poster');

  const stored = { file_stored: 'clip 1.mp4', file_poster_available: true };
  assert.equal(helpers.getAttachmentPreviewUrl(stored), '/uploads/clip%201.mp4/preview');
  assert.equal(helpers.getAttachmentDownloadUrl(stored), '/uploads/clip%201.mp4');
  assert.equal(helpers.getAttachmentPosterUrl(stored), '/uploads/clip%201.mp4/poster');

  const client = { client_file_url: 'blob:client-file', client_poster_url: 'blob:poster' };
  assert.equal(helpers.getAttachmentPreviewUrl(client), 'blob:client-file');
  assert.equal(helpers.getAttachmentDownloadUrl(client), 'blob:client-file');
  assert.equal(helpers.getAttachmentPosterUrl(client), 'blob:poster');
});

test('custom emoji helper builds catalogs and escapes rendered HTML', () => {
  const dom = createAppDom();
  loadCoreBase(dom);
  dom.window.BananzaQipInfiumOriginal = {
    id: 'qip-infium-original',
    label: 'QIP <Original>',
    items: [
      { token: ':qip-infium-001:', src: '/emoji/qip&one.png', width: 20, height: 20, label: 'Smile <One>' },
      { token: ':not-valid:', src: '/emoji/nope.png' },
    ],
  };
  dom.window.BananzaQipHdEmojis = {
    id: 'qip-hd',
    label: 'QIP HD',
    items: [
      { token: ':qip-hd-fire:', src: '/emoji/fire.png', width: 64, height: 64, label: 'Fire' },
    ],
  };
  loadBrowserScript(dom, 'public/js/app/custom-emoji.js');

  const helper = dom.window.BananzaApp.customEmoji;
  assert.deepEqual(Array.from(helper.CUSTOM_EMOJI_CATALOGS, (catalog) => catalog.id), ['qip-infium-original', 'qip-hd']);
  assert.equal(helper.getCustomEmoji(':qip-infium-001:').label, 'Smile <One>');
  assert.equal(helper.isCustomEmojiToken(':qip-hd-fire:'), true);
  assert.equal(helper.isCustomEmojiToken(':not-valid:'), false);

  const html = helper.renderCustomEmojiHtml(':qip-infium-001:', { className: 'picked' });
  assert.match(html, /src="\/emoji\/qip&amp;one\.png"/);
  assert.match(html, /alt="Smile &lt;One&gt;"/);
  assert.match(html, /title="Smile &lt;One&gt;"/);

  const internal = helper.normalizeComposerTextToInternal('A :qip-infium-001: B');
  assert.equal(helper.serializeComposerTextValue(internal), 'A :qip-infium-001: B');
});

test('app.js still publishes BananzaAppBridge after core helpers load', () => {
  const dom = createAppDom();
  dom.window.localStorage.setItem('token', 'test-token');
  dom.window.localStorage.setItem('user', JSON.stringify({ id: 1, display_name: 'Alice' }));
  dom.window.fetch = async () => {
    throw new Error('Network disabled in app-core-helpers bridge test');
  };
  loadAppScript(dom);

  assert.ok(dom.window.BananzaAppBridge);
  assert.equal(typeof dom.window.BananzaAppBridge.t, 'function');
  assert.equal(typeof dom.window.BananzaAppBridge.getAttachmentPreviewUrl, 'function');
  assert.equal(typeof dom.window.BananzaAppBridge.__testing, 'object');
});

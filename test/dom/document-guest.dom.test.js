const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const rootDir = path.resolve(__dirname, '..', '..');
const documentHtml = fs.readFileSync(path.join(rootDir, 'public', 'document.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(rootDir, 'public', 'css', 'style.css'), 'utf8');
const guestScript = fs.readFileSync(path.join(rootDir, 'public', 'js', 'document-guest.js'), 'utf8');

function createGuestDom(storedUser) {
  const dom = new JSDOM(documentHtml, {
    url: 'http://127.0.0.1:3000/doc/test-token',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  if (storedUser) dom.window.localStorage.setItem('user', JSON.stringify(storedUser));
  dom.window.fetch = () => new Promise(() => {});
  dom.window.eval(guestScript);
  return dom;
}

test('document guest page applies the saved app theme', () => {
  const dom = createGuestDom({ ui_theme: 'tokyo-night', ui_visual_mode: 'rich' });
  assert.equal(dom.window.document.documentElement.dataset.uiTheme, 'tokyo-night');
  assert.equal(dom.window.document.documentElement.dataset.visualMode, 'rich');
});

test('document guest page falls back to the default theme for invalid stored values', () => {
  const dom = createGuestDom({ ui_theme: 'unknown-theme', ui_visual_mode: 'chaos' });
  assert.equal(dom.window.document.documentElement.dataset.uiTheme, 'bananza');
  assert.equal(dom.window.document.documentElement.dataset.visualMode, 'classic');
});

test('document guest page uses cache-busted document assets', () => {
  const dom = new JSDOM(documentHtml);
  const document = dom.window.document;
  assert.equal(document.querySelector('link[rel="stylesheet"]')?.getAttribute('href'), '/css/style.css?v=20260617-doc-keyboard-intent1');
  assert.ok([...document.querySelectorAll('script')].some((script) => script.getAttribute('src') === '/js/i18n.js?v=20260615-doc-chatshot2'));
  assert.ok([...document.querySelectorAll('script')].some((script) => script.getAttribute('src') === '/js/document-editor.bundle.js?v=20260617-doc-keyboard-intent1'));
  assert.ok([...document.querySelectorAll('script')].some((script) => script.getAttribute('src') === '/js/document-guest.js?v=20260614-doc-v2'));
  assert.equal(document.querySelector('.document-context-convert-btn'), null);
  assert.ok(![...document.querySelectorAll('script')].some((script) => String(script.getAttribute('src') || '').includes('context-chatshot-runtime')));
  assert.doesNotMatch(guestScript, /uploadImage\s*:/);
});

test('document guest page keeps the editor scrollable in both directions', () => {
  assert.match(styleCss, /\.document-guest-body\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styleCss, /\.document-guest-app\s*\{[^}]*height:\s*100dvh/s);
  assert.match(styleCss, /\.document-workspace--guest \.document-editor-shell\s*\{[^}]*overflow:\s*auto/s);
  assert.match(styleCss, /\.document-editor-shell\s*\{[^}]*touch-action\s*:\s*pan-x pan-y/s);
  assert.match(styleCss, /\.document-editor\s+\.ProseMirror\s*\{[^}]*transform-origin\s*:\s*0 0/s);
  assert.match(styleCss, /\.document-workspace--guest \.document-editor\s*\{[^}]*min-width:\s*max-content/s);
  assert.match(styleCss, /\.document-workspace--guest \.document-editor \.ProseMirror table\s*\{[^}]*width:\s*max-content/s);
});

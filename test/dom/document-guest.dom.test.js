const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const rootDir = path.resolve(__dirname, '..', '..');
const documentHtml = fs.readFileSync(path.join(rootDir, 'public', 'document.html'), 'utf8');
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
  assert.equal(document.querySelector('link[rel="stylesheet"]')?.getAttribute('href'), '/css/style.css?v=20260614-doc-mobile-topbar1');
  assert.ok([...document.querySelectorAll('script')].some((script) => script.getAttribute('src') === '/js/i18n.js?v=20260614-doc-settings1'));
  assert.ok([...document.querySelectorAll('script')].some((script) => script.getAttribute('src') === '/js/document-editor.bundle.js?v=20260614-doc-cursors-fresh3'));
  assert.ok([...document.querySelectorAll('script')].some((script) => script.getAttribute('src') === '/js/document-guest.js?v=20260614-doc-v2'));
});

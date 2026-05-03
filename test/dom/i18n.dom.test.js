const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const { repoRoot } = require('../support/paths');

function loadI18n(dom) {
  const source = fs.readFileSync(path.join(repoRoot, 'public', 'js', 'i18n.js'), 'utf8');
  vm.runInContext(source, dom.getInternalVMContext(), {
    filename: path.join(repoRoot, 'public', 'js', 'i18n.js'),
  });
  return dom.window.BananzaI18n;
}

test('i18n catalog has matching non-empty ru/en keys', () => {
  const dom = new JSDOM('<!doctype html><html lang="ru"><body></body></html>', {
    url: 'http://localhost/',
    runScripts: 'outside-only',
  });
  const i18n = loadI18n(dom);
  const ruKeys = Object.keys(i18n.catalog.ru).sort();
  const enKeys = Object.keys(i18n.catalog.en).sort();
  assert.deepEqual(enKeys, ruKeys);
  for (const key of ruKeys) {
    assert.ok(String(i18n.catalog.ru[key] || '').trim(), `Missing ru text for ${key}`);
    assert.ok(String(i18n.catalog.en[key] || '').trim(), `Missing en text for ${key}`);
  }
});

test('i18n translates static index and login shell text and attributes', () => {
  const html = fs.readFileSync(path.join(repoRoot, 'public', 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
  });
  const i18n = loadI18n(dom);
  const document = dom.window.document;

  i18n.setLanguage('ru');
  assert.equal(document.querySelector('#emptyState h3').textContent, 'Добро пожаловать в BananZa');
  assert.equal(document.getElementById('chatSearch').getAttribute('placeholder'), 'Искать чаты...');
  assert.equal(document.getElementById('settingsBtn').getAttribute('aria-label'), 'Настройки');

  i18n.setLanguage('en');
  assert.equal(document.querySelector('#emptyState h3').textContent, 'Welcome to BananZa');
  assert.equal(document.getElementById('chatSearch').getAttribute('placeholder'), 'Search chats...');
  assert.equal(document.getElementById('settingsBtn').getAttribute('aria-label'), 'Settings');

  const loginHtml = fs.readFileSync(path.join(repoRoot, 'public', 'login.html'), 'utf8');
  const loginDom = new JSDOM(loginHtml, {
    url: 'http://localhost/login.html',
    runScripts: 'outside-only',
  });
  const loginI18n = loadI18n(loginDom);
  loginI18n.setLanguage('ru');
  assert.equal(loginDom.window.document.querySelector('[data-tab="login"]').textContent, 'Войти');
  loginI18n.setLanguage('en');
  assert.equal(loginDom.window.document.querySelector('[data-tab="login"]').textContent, 'Sign In');
});

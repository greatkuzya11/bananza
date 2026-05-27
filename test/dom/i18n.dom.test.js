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

test('i18n translates chat list pull refresh states', () => {
  const dom = new JSDOM('<!doctype html><html lang="ru"><body></body></html>', {
    url: 'http://localhost/',
    runScripts: 'outside-only',
  });
  const i18n = loadI18n(dom);

  i18n.setLanguage('ru');
  assert.equal(i18n.t('Pull to refresh'), '\u041f\u043e\u0442\u044f\u043d\u0438\u0442\u0435 \u0434\u043b\u044f \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f');
  assert.equal(i18n.t('Release to refresh'), '\u041e\u0442\u043f\u0443\u0441\u0442\u0438\u0442\u0435 \u0434\u043b\u044f \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f');
  assert.equal(i18n.t('Refreshing chats...'), '\u041e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u043c \u0447\u0430\u0442\u044b...');
  assert.equal(i18n.t('Reloading app...'), '\u041f\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435...');

  i18n.setLanguage('en');
  assert.equal(i18n.t('Pull to refresh'), 'Pull to refresh');
  assert.equal(i18n.t('Release to refresh'), 'Release to refresh');
  assert.equal(i18n.t('Refreshing chats...'), 'Refreshing chats...');
  assert.equal(i18n.t('Reloading app...'), 'Reloading app...');
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
  assert.equal(document.getElementById('msgInput').getAttribute('placeholder'), '\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435...');
  assert.equal(document.getElementById('settingsBtn').getAttribute('aria-label'), 'Настройки');
  assert.equal(
    document.getElementById('settingsScreenRotationAllowed')?.closest('.settings-item')?.querySelector('span')?.textContent,
    '📱 Разрешить поворот экрана',
  );
  assert.equal(
    document.getElementById('settingsScreenRotationAllowed')?.closest('.settings-item')?.nextElementSibling?.textContent,
    'Если выключено, BananZa попробует удерживать мобильный интерфейс в портретном режиме в поддерживаемых браузерах.',
  );

  i18n.setLanguage('en');
  assert.equal(document.querySelector('#emptyState h3').textContent, 'Welcome to BananZa');
  assert.equal(document.getElementById('chatSearch').getAttribute('placeholder'), 'Search chats...');
  assert.equal(document.getElementById('msgInput').getAttribute('placeholder'), 'Message...');
  assert.equal(document.getElementById('settingsBtn').getAttribute('aria-label'), 'Settings');
  assert.equal(
    document.getElementById('settingsScreenRotationAllowed')?.closest('.settings-item')?.querySelector('span')?.textContent,
    '📱 Allow screen rotation',
  );
  assert.equal(
    document.getElementById('settingsScreenRotationAllowed')?.closest('.settings-item')?.nextElementSibling?.textContent,
    'When off, BananZa tries to keep the mobile UI in portrait mode on supported browsers.',
  );

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

test('i18n translates media menu labels and chat date chips', () => {
  const dom = new JSDOM('<!doctype html><html lang="ru"><body></body></html>', {
    url: 'http://localhost/',
    runScripts: 'outside-only',
  });
  const i18n = loadI18n(dom);
  const keys = [
    'Today',
    'Yesterday',
    'Copy text',
    'Copy image',
    'Copy link',
    'Share',
    'Reply',
    'Forward',
    'Save to notes',
    'Edit',
    'Pin',
    'Unpin',
    'React',
    'Pinned message',
    'Pinned messages',
    'Pinned by {name}',
    'Pin message',
    'Unpin message',
    'Unpin pinned message',
    'Pinned',
    'Copy image is not available',
    'Share is not available',
    'Image copied',
    'Text copied',
    'Link copied',
    'Could not copy text',
    'Could not copy link',
    'Download started',
  ];

  i18n.setLanguage('ru');
  assert.equal(i18n.t('Today'), '\u0421\u0435\u0433\u043e\u0434\u043d\u044f');
  assert.equal(i18n.t('Yesterday'), '\u0412\u0447\u0435\u0440\u0430');
  assert.equal(i18n.t('Copy text'), '\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0442\u0435\u043a\u0441\u0442');
  assert.equal(i18n.t('Copy image'), '\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435');
  assert.equal(i18n.t('Copy link'), '\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443');
  assert.equal(i18n.t('Share'), '\u041f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f');
  assert.equal(i18n.t('Reply'), '\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c');
  assert.equal(i18n.t('Forward'), '\u041f\u0435\u0440\u0435\u0441\u043b\u0430\u0442\u044c');
  assert.equal(i18n.t('Save to notes'), '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432 \u0437\u0430\u043c\u0435\u0442\u043a\u0438');
  assert.equal(i18n.t('Edit'), '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c');
  assert.equal(i18n.t('Pin'), '\u0417\u0430\u043a\u0440\u0435\u043f\u0438\u0442\u044c');
  assert.equal(i18n.t('Unpin'), '\u041e\u0442\u043a\u0440\u0435\u043f\u0438\u0442\u044c');
  assert.equal(i18n.t('React'), '\u0420\u0435\u0430\u043a\u0446\u0438\u044f');
  assert.equal(i18n.t('Pinned by {name}', { name: 'Kuzya' }), '\u0417\u0430\u043a\u0440\u0435\u043f\u0438\u043b(\u0430): Kuzya');
  assert.equal(i18n.t('Pin message'), '\u0417\u0430\u043a\u0440\u0435\u043f\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435');
  assert.equal(i18n.t('Unpin message'), '\u041e\u0442\u043a\u0440\u0435\u043f\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435');
  for (const key of keys) {
    assert.ok(i18n.t(key).trim(), `Missing ru text for ${key}`);
  }

  i18n.setLanguage('en');
  assert.equal(i18n.t('Today'), 'Today');
  assert.equal(i18n.t('Yesterday'), 'Yesterday');
  assert.equal(i18n.t('Copy image'), 'Copy image');
  assert.equal(i18n.t('Pinned by {name}', { name: 'Kuzya' }), 'Pinned by Kuzya');
  for (const key of keys) {
    assert.ok(i18n.t(key).trim(), `Missing en text for ${key}`);
  }
});

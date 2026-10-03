const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { waitFor, sleep } = require('../support/scenario');

const root = path.resolve(__dirname, '../..');
function setup(t) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'), {
    url: 'http://localhost', runScripts: 'outside-only',
  });
  const win = dom.window;
  win.TextDecoder = TextDecoder;
  win.eval(fs.readFileSync(path.join(root, 'public/js/i18n.js'), 'utf8'));
  win.eval(fs.readFileSync(path.join(root, 'public/js/app/admin/logs.js'), 'utf8'));
  let connection;
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    const body = new ReadableStream({ start(c) {
      connection = c;
      options.signal.addEventListener('abort', () => { try { c.error(new Error('aborted')); } catch {} });
    } });
    return { status: 200, ok: true, body };
  };
  const controller = win.BananzaApp.admin.logs.createLogsController({
    window: win, document: win.document, fetch,
    tx: (key, params) => win.BananzaI18n.t(key, params),
    getToken: () => 'test-token', getCurrentUser: () => ({ is_admin: 1 }),
    openModal: (id) => win.document.getElementById(id).classList.remove('hidden'),
  });
  t.after(() => { controller.close(); win.close(); });
  return { win, controller, requests,
    send: (event, data) => connection.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)),
    disconnect: () => connection.close(),
    el: (id) => win.document.getElementById(id),
  };
}

test('admin logs render safe text, filter, pause, cap the buffer and abort on close', async (t) => {
  const ui = setup(t);
  ui.controller.open();
  await sleep(10);
  assert.equal(ui.requests[0].options.headers.Authorization, 'Bearer test-token');
  assert.equal(ui.requests[0].url, '/api/admin/logs/stream');
  ui.send('reset', {});
  ui.send('entry', { id: '1', time: 'now', level: 'error', source: 'test', message: '<img src=x onerror=alert(1)>' });
  ui.send('entry', { id: '2', time: 'now', level: 'info', source: 'test', message: 'hello' });
  await waitFor(() => assert.equal(ui.el('adminLogsEntries').children.length, 2));
  assert.equal(ui.el('adminLogsEntries').querySelector('img'), null);
  ui.el('adminLogsLevel').value = 'error';
  ui.el('adminLogsLevel').dispatchEvent(new ui.win.Event('change'));
  assert.equal(ui.el('adminLogsEntries').children.length, 1);
  ui.el('adminLogsLevel').value = '';
  ui.el('adminLogsSearch').value = 'hello';
  ui.el('adminLogsSearch').dispatchEvent(new ui.win.Event('input'));
  await waitFor(() => assert.match(ui.el('adminLogsEntries').textContent, /hello/));
  assert.equal(ui.el('adminLogsEntries').children.length, 1);
  ui.el('adminLogsSearch').value = '';
  ui.el('adminLogsPause').click();
  const pausedText = ui.el('adminLogsEntries').textContent;
  for (let i = 0; i < 2100; i++) ui.send('entry', { id: String(i + 3), time: 'now', level: 'info', source: 'test', message: 'new-' + i });
  await sleep(150);
  assert.equal(ui.el('adminLogsEntries').textContent, pausedText);
  assert.equal(ui.el('adminLogsPause').getAttribute('aria-pressed'), 'true');
  ui.el('adminLogsPause').click();
  assert.equal(ui.el('adminLogsEntries').children.length, 2000);
  assert.match(ui.el('adminLogsEntries').lastChild.textContent, /new-2099/);
  ui.controller.close();
  assert.equal(ui.requests[0].options.signal.aborted, true);
  assert.equal(ui.el('adminLogsEntries').children.length, 0);
});

test('reconnect resets recent history and access denial stops further reconnects', async (t) => {
  const ui = setup(t);
  ui.controller.open();
  await sleep(10);
  ui.send('entry', { id: '1', time: 'now', level: 'info', source: 'test', message: 'old-entry' });
  await waitFor(() => assert.match(ui.el('adminLogsEntries').textContent, /old-entry/));
  ui.disconnect();
  await waitFor(() => assert.equal(ui.requests.length, 2), { timeoutMs: 2500 });
  ui.send('reset', {});
  ui.send('entry', { id: '2', time: 'now', level: 'info', source: 'test', message: 'new-entry' });
  await waitFor(() => assert.match(ui.el('adminLogsEntries').textContent, /new-entry/));
  assert.doesNotMatch(ui.el('adminLogsEntries').textContent, /old-entry/);
  ui.send('denied', {});
  await waitFor(() => assert.equal(ui.requests[1].options.signal.aborted, true));
  assert.equal(ui.el('adminLogsEntries').children.length, 0);
});

test('log controls and status messages have Russian and English translations', (t) => {
  const ui = setup(t);
  const i18n = ui.win.BananzaI18n;
  assert.equal(i18n.t('Server logs'), 'Логи сервера');
  assert.equal(i18n.t('Loaded log entries: {count}', { count: 5 }), 'Загружено записей: 5');
  for (const element of ui.win.document.querySelectorAll('#adminLogsModal [data-i18n]')) {
    const key = element.getAttribute('data-i18n');
    assert.notEqual(i18n.t(key), key, key);
  }
  i18n.setLanguage('en');
  assert.equal(i18n.t('Server logs'), 'Server logs');
  assert.equal(i18n.t('Loaded log entries: {count}', { count: 5 }), 'Loaded log entries: 5');
});

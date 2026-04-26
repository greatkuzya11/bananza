const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAppDom,
  loadBrowserScript,
} = require('../support/domHarness');

test('messageCache stores latest messages and supports patch/delete flow', async () => {
  const dom = createAppDom();
  loadBrowserScript(dom, 'public/js/messageCache.js');

  const cache = dom.window.messageCache;
  assert.ok(cache);

  assert.equal(await cache.init(17), true);
  await cache.upsertMessage({ id: 10, chat_id: 4, text: 'First' });
  await cache.upsertMessage({ id: 11, chat_id: 4, text: 'Second' });

  const latest = await cache.readLatest(4, { limit: 10 });
  assert.deepEqual(Array.from(latest, (item) => item.id), [10, 11]);

  await cache.patchMessage(4, 11, { text: 'Second patched', edited: true });
  const around = await cache.readAround(4, 11, { limit: 5 });
  assert.equal(around.find((item) => item.id === 11).text, 'Second patched');

  await cache.deleteMessage(4, 10);
  const afterDelete = await cache.readLatest(4, { limit: 10 });
  assert.deepEqual(Array.from(afterDelete, (item) => item.id), [11]);
});

test('messageCache persists pages and outbox records', async () => {
  const dom = createAppDom();
  loadBrowserScript(dom, 'public/js/messageCache.js');

  const cache = dom.window.messageCache;
  await cache.init(22);
  await cache.writePage(9, {
    direction: 'before',
    cursor: 50,
    messages: [
      { id: 48, chat_id: 9, text: 'Older 1' },
      { id: 49, chat_id: 9, text: 'Older 2' },
    ],
    hasMoreBefore: true,
    hasMoreAfter: false,
  });

  const page = await cache.readPage(9, 'before', 50);
  assert.equal(page.complete, true);
  assert.deepEqual(Array.from(page.messages, (item) => item.id), [48, 49]);
  assert.equal(page.hasMoreBefore, true);

  await cache.upsertOutboxItem({
    chatId: 9,
    clientId: 'local-1',
    text: 'Pending',
    status: 'pending',
  });
  const outbox = await cache.readOutbox(9);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].clientId, 'local-1');
});

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

test('messageCache preserves media playback completion inside chat meta', async () => {
  const dom = createAppDom();
  loadBrowserScript(dom, 'public/js/messageCache.js');

  const cache = dom.window.messageCache;
  const normalizeMetaMap = (value) => JSON.parse(JSON.stringify(value || null));
  await cache.init(31);

  await cache.writeChatMeta(6, {
    mediaPlaybackCompleted: {
      'voice-note-audio:11': 111,
      'video-note-video:12': 222,
    },
  });

  let meta = await cache.readChatMeta(6);
  assert.deepEqual(normalizeMetaMap(meta.mediaPlaybackCompleted), {
    'voice-note-audio:11': 111,
    'video-note-video:12': 222,
  });

  await cache.writeChatMeta(6, {
    minId: 10,
    maxId: 20,
    hasMoreBefore: false,
  });

  meta = await cache.readChatMeta(6);
  assert.deepEqual(normalizeMetaMap(meta.mediaPlaybackCompleted), {
    'voice-note-audio:11': 111,
    'video-note-video:12': 222,
  });

  await cache.writeChatMeta(6, {
    mediaPlaybackCompleted: {
      'video-note-video:12': 222,
    },
  });

  meta = await cache.readChatMeta(6);
  assert.deepEqual(normalizeMetaMap(meta.mediaPlaybackCompleted), {
    'video-note-video:12': 222,
  });

  await cache.writeChatMeta(6, {
    replaceRange: true,
    minId: 20,
    maxId: 40,
  });

  meta = await cache.readChatMeta(6);
  assert.deepEqual(normalizeMetaMap(meta.mediaPlaybackCompleted), {
    'video-note-video:12': 222,
  });
});

test('messageCache asset prefetch caches upload previews but skips non-image responses', async () => {
  const dom = createAppDom();
  const stored = new Map();
  const fetched = [];
  const cache = {
    async match(url) {
      return stored.get(String(url)) || null;
    },
    async put(url, response) {
      stored.set(String(url), response);
    },
  };

  dom.window.caches = {
    async open(name) {
      assert.equal(name, 'bananza-assets-v2');
      return cache;
    },
  };
  dom.window.fetch = async (url) => {
    fetched.push(String(url));
    const path = new URL(String(url), dom.window.location.origin).pathname;
    if (path.endsWith('/image-a/preview')) {
      return new dom.window.Response('image-a', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      });
    }
    if (path.endsWith('/voice-a/preview')) {
      return new dom.window.Response('voice-a', {
        status: 200,
        headers: { 'Content-Type': 'audio/ogg' },
      });
    }
    throw new Error(`Unexpected asset fetch: ${url}`);
  };
  loadBrowserScript(dom, 'public/js/messageCache.js');

  await dom.window.cacheAssets([
    '/uploads/image-a/preview',
    '/uploads/voice-a/preview',
    'https://example.test/uploads/image-b/preview',
    '/uploads/file.bin',
  ]);

  assert.deepEqual(fetched, [
    `${dom.window.location.origin}/uploads/image-a/preview`,
    `${dom.window.location.origin}/uploads/voice-a/preview`,
  ]);
  assert.ok(await cache.match(`${dom.window.location.origin}/uploads/image-a/preview`));
  assert.equal(await cache.match(`${dom.window.location.origin}/uploads/voice-a/preview`), null);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { repoRoot } = require('../support/paths');

function createServiceWorkerHarness() {
  const listeners = new Map();
  const stored = new Map();
  const fetchCalls = [];
  const cache = {
    async match(request) {
      return stored.get(request.url) || null;
    },
    async put(request, response) {
      stored.set(request.url, response);
    },
  };
  const context = {
    URL,
    Request,
    Response,
    caches: {
      async keys() {
        return [];
      },
      async delete() {
        return true;
      },
      async open(name) {
        assert.equal(name, 'bananza-assets-v2');
        return cache;
      },
    },
    fetch: async (request) => {
      fetchCalls.push(request.url);
      return new Response('image-preview', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      });
    },
    self: {
      location: { origin: 'https://bananza.test' },
      clients: {
        claim() {
          return Promise.resolve();
        },
        matchAll() {
          return Promise.resolve([]);
        },
        openWindow() {
          return Promise.resolve();
        },
      },
      registration: {
        showNotification() {
          return Promise.resolve();
        },
      },
      skipWaiting() {
        return Promise.resolve();
      },
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(
    fs.readFileSync(path.join(repoRoot, 'public', 'sw.js'), 'utf8'),
    context,
    { filename: 'public/sw.js' }
  );
  return { context, listeners, stored, fetchCalls };
}

async function dispatchFetch(listeners, request) {
  let responsePromise = null;
  listeners.get('fetch')({
    request,
    respondWith(promise) {
      responsePromise = Promise.resolve(promise);
    },
  });
  return responsePromise ? responsePromise : null;
}

test('service worker cache-first handles upload image previews', async () => {
  const { listeners, stored, fetchCalls } = createServiceWorkerHarness();
  const request = new Request('https://bananza.test/uploads/image-a/preview');

  const first = await dispatchFetch(listeners, request);
  assert.ok(first);
  assert.equal(await first.text(), 'image-preview');
  assert.deepEqual(fetchCalls, ['https://bananza.test/uploads/image-a/preview']);
  assert.ok(stored.get('https://bananza.test/uploads/image-a/preview'));

  const second = await dispatchFetch(listeners, request);
  assert.equal(await second.text(), 'image-preview');
  assert.deepEqual(fetchCalls, ['https://bananza.test/uploads/image-a/preview']);
});

test('service worker does not cache range requests', async () => {
  const { listeners } = createServiceWorkerHarness();
  const request = new Request('https://bananza.test/uploads/video-a/preview', {
    headers: { Range: 'bytes=0-10' },
  });

  assert.equal(await dispatchFetch(listeners, request), null);
});

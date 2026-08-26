const test = require('node:test');
const assert = require('node:assert/strict');

const yandex = require('../ai/yandex');

function withPatchedFetch(fetchImpl, run) {
  const previous = global.fetch;
  global.fetch = fetchImpl;
  return Promise.resolve().then(run).finally(() => { global.fetch = previous; });
}

test('generateText preserves retryable Yandex HTTP metadata', async () => {
  await withPatchedFetch(async () => ({
    ok: false,
    status: 503,
    async json() { return { message: 'Yandex temporarily unavailable' }; },
  }), async () => {
    await assert.rejects(() => yandex.generateText({
      apiKey: 'test-key',
      folderId: 'test-folder',
      model: 'yandexgpt-lite',
      user: 'Hello',
    }), (error) => {
      assert.match(error.message, /temporarily unavailable/);
      assert.equal(error.status, 503);
      assert.equal(error.code, 'HTTP_503');
      assert.equal(error.retryable, true);
      return true;
    });
  });
});

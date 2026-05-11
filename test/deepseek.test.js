const test = require('node:test');
const assert = require('node:assert/strict');

const deepseek = require('../ai/deepseek');

function withPatchedGlobals(patches, run) {
  const previous = {};
  for (const [key, value] of Object.entries(patches)) {
    previous[key] = global[key];
    global[key] = value;
  }
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        global[key] = value;
      }
    });
}

test('generateText uses the requested DeepSeek chat timeout', async () => {
  let capturedTimeout = null;

  await withPatchedGlobals({
    setTimeout(callback, ms) {
      capturedTimeout = ms;
      return { callback };
    },
    clearTimeout() {},
    fetch: async (_url, options) => {
      assert.equal(options.method, 'POST');
      assert.equal(options.signal.aborted, false);
      return {
        ok: true,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'DeepSeek ok' } }],
        }),
      };
    },
  }, async () => {
    const text = await deepseek.generateText({
      apiKey: 'test-key',
      model: 'deepseek-reasoner',
      user: 'Think slowly',
      timeoutMs: 900000,
    });

    assert.equal(text, 'DeepSeek ok');
    assert.equal(capturedTimeout, 900000);
  });
});

test('generateText reports DeepSeek timeout aborts with stable error text', async () => {
  await withPatchedGlobals({
    setTimeout(callback, ms) {
      assert.equal(ms, 30000);
      callback();
      return {};
    },
    clearTimeout() {},
    fetch: async (_url, options) => {
      assert.equal(options.signal.aborted, true);
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    },
  }, async () => {
    await assert.rejects(
      () => deepseek.generateText({
        apiKey: 'test-key',
        model: 'deepseek-chat',
        user: 'Hello',
        timeoutMs: 30000,
      }),
      /DeepSeek API request timed out/
    );
  });
});

const test = require('node:test');
const assert = require('node:assert/strict');

const qwen = require('../ai/qwen');

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

test('generateText sends OpenAI-compatible Qwen chat completions', async () => {
  let capturedUrl = '';
  let capturedBody = null;
  let capturedTimeout = null;

  await withPatchedGlobals({
    setTimeout(callback, ms) {
      capturedTimeout = ms;
      return { callback };
    },
    clearTimeout() {},
    fetch: async (url, options) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(options.body);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer local-qwen');
      assert.equal(options.signal.aborted, false);
      return {
        ok: true,
        text: async () => JSON.stringify({
          model: 'qwen3.6',
          choices: [{ message: { content: 'Qwen ok' } }],
        }),
      };
    },
  }, async () => {
    const text = await qwen.generateText({
      apiKey: 'local-qwen',
      baseUrl: 'http://qwen.local:8000/v1/',
      model: 'qwen3.6',
      system: 'System',
      user: 'Hello',
      timeoutMs: 900000,
    });

    assert.equal(capturedUrl, 'http://qwen.local:8000/v1/chat/completions');
    assert.equal(capturedBody.model, 'qwen3.6');
    assert.equal(capturedBody.stream, false);
    assert.deepEqual(capturedBody.messages, [
      { role: 'system', content: 'System' },
      { role: 'user', content: 'Hello' },
    ]);
    assert.equal(text, 'Qwen ok');
    assert.equal(capturedTimeout, 900000);
  });
});

test('generateText reports Qwen timeout aborts with stable error text', async () => {
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
      () => qwen.generateText({
        apiKey: 'local-qwen',
        model: 'qwen',
        user: 'Hello',
        timeoutMs: 30000,
      }),
      (error) => {
        assert.match(error.message, /Qwen API request timed out/);
        assert.equal(error.code, 'ETIMEDOUT');
        assert.equal(error.retryable, true);
        return true;
      }
    );
  });
});

test('generateText preserves retryable Qwen HTTP metadata', async () => {
  await withPatchedGlobals({
    fetch: async () => ({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: 'Too many requests' } }),
    }),
  }, async () => {
    await assert.rejects(() => qwen.generateText({ apiKey: 'local-qwen', user: 'Hello' }), (error) => {
      assert.match(error.message, /Too many requests/);
      assert.equal(error.status, 429);
      assert.equal(error.code, 'HTTP_429');
      assert.equal(error.retryable, true);
      return true;
    });
  });
});

test('listModelIds parses OpenAI-compatible Qwen models', async () => {
  await withPatchedGlobals({
    fetch: async (url, options) => {
      assert.equal(String(url), 'http://qwen.local:8000/v1/models');
      assert.equal(options.method, 'GET');
      assert.equal(options.headers.Authorization, 'Bearer local-qwen');
      return {
        ok: true,
        text: async () => JSON.stringify({
          data: [{ id: 'qwen3.6' }, { id: 'Qwen/Qwen3-Coder' }],
        }),
      };
    },
  }, async () => {
    const ids = await qwen.listModelIds({
      apiKey: 'local-qwen',
      baseUrl: 'http://qwen.local:8000/v1',
    });

    assert.deepEqual(ids, ['Qwen/Qwen3-Coder', 'qwen3.6']);
  });
});

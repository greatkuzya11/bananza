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
      (error) => {
        assert.match(error.message, /DeepSeek API request timed out/);
        assert.equal(error.code, 'ETIMEDOUT');
        assert.equal(error.retryable, true);
        return true;
      }
    );
  });
});

test('getUserBalance normalizes DeepSeek balance response', async () => {
  let capturedUrl = '';

  await withPatchedGlobals({
    fetch: async (url, options) => {
      capturedUrl = String(url);
      assert.equal(options.method, 'GET');
      assert.equal(options.headers.Authorization, 'Bearer test-key');
      return {
        ok: true,
        text: async () => JSON.stringify({
          is_available: true,
          balance_infos: [
            {
              currency: 'USD',
              total_balance: '12.34',
              granted_balance: '1.00',
              topped_up_balance: '11.34',
            },
          ],
        }),
      };
    },
  }, async () => {
    const balance = await deepseek.getUserBalance({ apiKey: 'test-key' });

    assert.equal(capturedUrl, 'https://api.deepseek.com/user/balance');
    assert.deepEqual(balance, {
      is_available: true,
      balance_infos: [
        {
          currency: 'USD',
          total_balance: '12.34',
          granted_balance: '1.00',
          topped_up_balance: '11.34',
        },
      ],
    });
  });
});

test('getUserBalance returns an empty balance list when DeepSeek omits entries', async () => {
  await withPatchedGlobals({
    fetch: async () => ({
      ok: true,
      text: async () => JSON.stringify({ is_available: false }),
    }),
  }, async () => {
    const balance = await deepseek.getUserBalance({ apiKey: 'test-key' });

    assert.deepEqual(balance, {
      is_available: false,
      balance_infos: [],
    });
  });
});

test('getUserBalance reports DeepSeek HTTP errors', async () => {
  await withPatchedGlobals({
    fetch: async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Invalid API key' } }),
    }),
  }, async () => {
    await assert.rejects(() => deepseek.getUserBalance({ apiKey: 'bad-key' }), (error) => {
      assert.match(error.message, /Invalid API key/);
      assert.equal(error.status, 401);
      assert.equal(error.code, 'HTTP_401');
      assert.equal(error.retryable, false);
      return true;
    });
  });
});

test('getUserBalance reports DeepSeek timeout aborts with stable error text', async () => {
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
      () => deepseek.getUserBalance({ apiKey: 'test-key', timeoutMs: 30000 }),
      /DeepSeek API request timed out/
    );
  });
});

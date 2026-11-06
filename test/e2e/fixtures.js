const { createHash } = require('crypto');
const { test: base, expect } = require('@playwright/test');

function getTestClientHeaders(testInfo = base.info()) {
  const hash = createHash('sha256')
    .update(`${testInfo.testId}:${testInfo.retry}:${testInfo.repeatEachIndex}:${testInfo.workerIndex}`)
    .digest();
  // The sandbox uses the application's existing trust-proxy setting. Give each
  // test a client IP so its requests share real limits without consuming another
  // test's quota. Keep the IP stable across pages, reloads and API setup calls.
  return { 'X-Forwarded-For': `10.${hash[0]}.${hash[1]}.${hash[2]}` };
}

const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, testInfo) => {
    await use({ ...extraHTTPHeaders, ...getTestClientHeaders(testInfo) });
  },
});

module.exports = { test, expect, getTestClientHeaders };

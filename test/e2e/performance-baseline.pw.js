const { test, expect } = require('@playwright/test');

const {
  createApiSession,
  getContext,
  installMediaMocks,
  openExistingChat,
} = require('./helpers');

const STARTUP_MARKS = [
  'bananza:script-start',
  'bananza:runtime-create-start',
  'bananza:runtime-create-end',
  'bananza:init-start',
  'bananza:auth-restore-start',
  'bananza:auth-restore-end',
  'bananza:shell-setup-start',
  'bananza:shell-setup-end',
  'bananza:post-auth-ui-start',
  'bananza:post-auth-ui-end',
  'bananza:chats-load-start',
  'bananza:chats-load-end',
  'bananza:chats-first-render',
  'bananza:app-interactive',
];

const STARTUP_MEASURES = [
  'bananza:startup-total',
  'bananza:runtime-create',
  'bananza:init-total',
  'bananza:auth-restore',
  'bananza:shell-setup',
  'bananza:post-auth-ui',
  'bananza:ws-connect-kickoff',
  'bananza:chats-load',
  'bananza:first-chat-list',
  'bananza:time-to-interactive',
];

const DEFERRED_STARTUP_MEASURES = [
  'bananza:sound-settings-load',
  'bananza:emoji-recent-load',
];

const OPEN_CHAT_MARKS = [
  'bananza:open-chat-start',
  'bananza:open-chat-data-ready',
  'bananza:open-chat-first-render',
  'bananza:open-chat-end',
  'bananza:open-chat-warmup-start',
  'bananza:open-chat-warmup-end',
];

const OPEN_CHAT_MEASURES = [
  'bananza:open-chat-total',
  'bananza:open-chat-data',
  'bananza:open-chat-render',
  'bananza:open-chat-network',
  'bananza:open-chat-warmup',
];

const FEATURE_PRELOAD_MEASURES = [
  'bananza:feature-preload:settings',
];

function assertNumericBucket(summary, bucketName, names) {
  const bucket = summary?.[bucketName] || {};
  for (const name of names) {
    expect(Number.isFinite(bucket[name]), `${bucketName}.${name} should be numeric`).toBe(true);
    expect(bucket[name], `${bucketName}.${name} should be non-negative`).toBeGreaterThanOrEqual(0);
    expect(bucket[name], `${bucketName}.${name} should stay below sanity ceiling`).toBeLessThan(30_000);
  }
}

function baselineFromSummary(summary) {
  const measures = summary?.measures || {};
  return {
    startupTotal: Math.round(measures['bananza:startup-total'] || 0),
    firstChatList: Math.round(measures['bananza:first-chat-list'] || 0),
    timeToInteractive: Math.round(measures['bananza:time-to-interactive'] || 0),
    authRestore: Math.round(measures['bananza:auth-restore'] || 0),
    chatsLoad: Math.round(measures['bananza:chats-load'] || 0),
    shellSetup: Math.round(measures['bananza:shell-setup'] || 0),
    postAuthUi: Math.round(measures['bananza:post-auth-ui'] || 0),
    soundSettings: Math.round(measures['bananza:sound-settings-load'] || 0),
    emojiRecent: Math.round(measures['bananza:emoji-recent-load'] || 0),
    openChatTotal: Math.round(measures['bananza:open-chat-total'] || 0),
    openChatData: Math.round(measures['bananza:open-chat-data'] || 0),
    openChatRender: Math.round(measures['bananza:open-chat-render'] || 0),
    openChatNetwork: Math.round(measures['bananza:open-chat-network'] || 0),
    openChatWarmup: Math.round(measures['bananza:open-chat-warmup'] || 0),
  };
}

async function getPerformanceSummary(page) {
  return page.evaluate(() => window.BananzaAppBridge.__testing.getPerformanceSummary());
}

async function installAuthenticatedSession(page, session) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, {
    token: session.token,
    user: session.user,
  });
}

test('frontend performance baseline exposes startup and open-chat timings', async ({ page }, testInfo) => {
  await installMediaMocks(page);

  const { baseUrl, adminUser, bobUser, bobUserId } = getContext();
  const adminSession = createApiSession();
  await adminSession.login(adminUser);
  await adminSession.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: bobUserId },
  });
  await installAuthenticatedSession(page, adminSession);

  await page.goto(baseUrl);
  await expect(page.locator('#chatList')).toBeVisible();
  await page.waitForFunction(() => {
    const summary = window.BananzaAppBridge?.__testing?.getPerformanceSummary?.();
    return Number.isFinite(summary?.marks?.['bananza:app-interactive']);
  });
  await page.waitForFunction(() => {
    const summary = window.BananzaAppBridge?.__testing?.getPerformanceSummary?.();
    return Number.isFinite(summary?.measures?.['bananza:feature-preload:settings']);
  });
  await page.waitForFunction(() => {
    const measures = window.BananzaAppBridge?.__testing?.getPerformanceSummary?.()?.measures || {};
    return Number.isFinite(measures['bananza:sound-settings-load'])
      && Number.isFinite(measures['bananza:emoji-recent-load']);
  });

  const startupSummary = await getPerformanceSummary(page);
  assertNumericBucket(startupSummary, 'marks', STARTUP_MARKS);
  assertNumericBucket(startupSummary, 'measures', STARTUP_MEASURES);
  assertNumericBucket(startupSummary, 'measures', DEFERRED_STARTUP_MEASURES);
  assertNumericBucket(startupSummary, 'measures', FEATURE_PRELOAD_MEASURES);

  await openExistingChat(page, bobUser.displayName);
  await page.waitForFunction(() => {
    const measures = window.BananzaAppBridge?.__testing?.getPerformanceSummary?.()?.measures || {};
    return Number.isFinite(measures['bananza:open-chat-total'])
      && Number.isFinite(measures['bananza:open-chat-warmup']);
  });

  const summary = await getPerformanceSummary(page);
  assertNumericBucket(summary, 'marks', OPEN_CHAT_MARKS);
  assertNumericBucket(summary, 'measures', OPEN_CHAT_MEASURES);
  expect(Array.isArray(summary.entries)).toBe(true);
  expect(summary.entries.length).toBeGreaterThan(0);

  console.log(`[perf-baseline:${testInfo.project.name}] ${JSON.stringify(baselineFromSummary(summary))}`);
});

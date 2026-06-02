const { test, expect } = require('@playwright/test');

const {
  createApiSession,
  getContext,
  installMediaMocks,
} = require('./helpers');

async function installAuthenticatedSession(page, session) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, {
    token: session.token,
    user: session.user,
  });
}

test('feature loader bridge exposes registered packs and avoids duplicate static scripts', async ({ page }) => {
  await installMediaMocks(page);

  const { baseUrl, adminUser } = getContext();
  const session = createApiSession();
  await session.login(adminUser);
  await installAuthenticatedSession(page, session);

  await page.goto(baseUrl);
  await expect(page.locator('#chatList')).toBeVisible();
  await page.waitForFunction(() => {
    return window.BananzaAppBridge?.__testing?.getFeatureLoaderState?.().length > 0;
  });

  const features = await page.evaluate(() => {
    return window.BananzaAppBridge.__testing.getFeatureLoaderState()
      .map((feature) => ({ name: feature.name, preload: feature.preload }))
      .sort((left, right) => left.name.localeCompare(right.name));
  });
  const featureNames = features.map((feature) => feature.name);
  expect(featureNames).toEqual([
    'admin',
    'ai-admin',
    'ai-admin-events',
    'ai-admin-runtime',
    'ai-admin-ui',
    'context-chatshot-runtime',
    'grok-risk-runtime',
    'grok-runtime',
    'interactions',
    'local-providers-runtime',
    'media-viewer',
    'openai-runtime',
    'search',
    'settings',
  ]);
  const preloadByFeature = Object.fromEntries(features.map((feature) => [feature.name, feature.preload]));
  expect(preloadByFeature.settings).toBe('idle');
  expect(preloadByFeature.admin).toBe('admin-idle');
  expect(preloadByFeature['ai-admin-ui']).toBe('admin-idle');
  expect(preloadByFeature['ai-admin-runtime']).toBe('manual');
  expect(preloadByFeature['openai-runtime']).toBe('interaction');

  const initialAppScriptCount = await page.locator('script[src*="/js/app/"]').count();
  expect(initialAppScriptCount).toBeLessThanOrEqual(95);
  await expect(page.locator('script[src*="/js/app/admin/"]')).toHaveCount(0);
  await expect(page.locator('script[src*="/js/app/ai-admin/shared.js"]')).toHaveCount(0);
  await expect(page.locator('script[src*="/js/app/ai-admin/events.js"]')).toHaveCount(0);
  await expect(page.locator('script[src*="/js/app/ai-admin/controller.js"]')).toHaveCount(0);
  await expect(page.locator('script[src*="/js/app/ai-admin/openai-runtime.js"]')).toHaveCount(0);
  await expect(page.locator('script[src*="/js/app/ai-admin/local-providers-runtime.js"]')).toHaveCount(0);
  await expect(page.locator('script[src*="/js/app/ai-admin/grok-runtime.js"]')).toHaveCount(0);
  await expect(page.locator('script[src*="/js/app/ai-admin/context-chatshot-runtime.js"]')).toHaveCount(0);
  await expect(page.locator('script[src*="/js/app/ai-admin/grok-image-risk-runtime.js"]')).toHaveCount(0);

  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settingsModal')).toBeVisible();
  await page.locator('#settingsAiBotsPanel').click();
  await expect(page.locator('#aiBotSettingsModal')).toBeVisible();
  await expect(page.locator('script[src*="/js/app/ai-admin/events.js"]')).toHaveCount(1);
  await expect(page.locator('script[src*="/js/app/ai-admin/openai-runtime.js"]')).toHaveCount(1);
  await expect(page.locator('script[src*="/js/app/ai-admin/local-providers-runtime.js"]')).toHaveCount(0);

  const adminIdleStates = await page.evaluate(() => {
    return window.BananzaAppBridge.__testing.preloadByStrategyForTest('admin-idle');
  });
  expect(adminIdleStates.map((state) => state.name).sort()).toEqual([
    'admin',
    'ai-admin-events',
    'ai-admin-ui',
  ]);
  expect(adminIdleStates.every((state) => state.status === 'loaded')).toBe(true);
  await expect(page.locator('script[src*="/js/app/admin/"]')).toHaveCount(3);
  await expect(page.locator('script[src*="/js/app/ai-admin/controller.js"]')).toHaveCount(1);
  await expect(page.locator('script[src*="/js/app/ai-admin/local-providers-runtime.js"]')).toHaveCount(0);

  const adminScriptsBefore = await page.locator('script[src*="/js/app/admin/"]').count();
  const adminState = await page.evaluate(() => {
    return window.BananzaAppBridge.__testing.loadFeatureForTest('admin');
  });
  const adminScriptsAfter = await page.locator('script[src*="/js/app/admin/"]').count();
  expect(adminScriptsBefore).toBe(3);
  expect(adminState.status).toBe('loaded');
  expect(adminScriptsAfter).toBe(3);
  await page.evaluate(() => window.BananzaAppBridge.__testing.loadFeatureForTest('admin'));
  await expect(page.locator('script[src*="/js/app/admin/"]')).toHaveCount(3);

  const contextRuntimeState = await page.evaluate(() => {
    return window.BananzaAppBridge.__testing.loadFeatureForTest('context-chatshot-runtime');
  });
  expect(contextRuntimeState.status).toBe('loaded');
  await expect(page.locator('script[src*="/js/app/ai-admin/context-chatshot-runtime.js"]')).toHaveCount(1);

  const aiAdminScriptsBefore = await page.locator('script[src*="/js/app/ai-admin/"]').count();
  const aiAdminState = await page.evaluate(() => {
    return window.BananzaAppBridge.__testing.loadFeatureForTest('ai-admin');
  });
  const aiAdminScriptsAfter = await page.locator('script[src*="/js/app/ai-admin/"]').count();
  expect(aiAdminState.status).toBe('loaded');
  expect(aiAdminState.loadedScripts.length).toBeGreaterThan(10);
  expect(aiAdminScriptsAfter).toBeGreaterThan(aiAdminScriptsBefore);
  await page.evaluate(() => window.BananzaAppBridge.__testing.loadFeatureForTest('ai-admin'));
  await expect(page.locator('script[src*="/js/app/ai-admin/"]')).toHaveCount(aiAdminScriptsAfter);

  const settingsScriptsBefore = await page.locator('script[src*="/js/app/settings/"]').count();
  const settingsState = await page.evaluate(() => {
    return window.BananzaAppBridge.__testing.preloadFeatureForTest('settings');
  });
  const settingsScriptsAfter = await page.locator('script[src*="/js/app/settings/"]').count();
  expect(settingsState.status).toBe('loaded');
  expect(settingsScriptsAfter).toBe(settingsScriptsBefore);

  const summary = await page.evaluate(() => window.BananzaAppBridge.__testing.getPerformanceSummary());
  expect(Number.isFinite(summary.measures['bananza:feature-load:admin'])).toBe(true);
  expect(Number.isFinite(summary.measures['bananza:feature-load:ai-admin'])).toBe(true);
  expect(Number.isFinite(summary.measures['bananza:feature-load:ai-admin-events'])).toBe(true);
  expect(Number.isFinite(summary.measures['bananza:feature-preload:admin'])).toBe(true);
  expect(Number.isFinite(summary.measures['bananza:feature-preload:ai-admin-ui'])).toBe(true);
  expect(Number.isFinite(summary.measures['bananza:feature-load:context-chatshot-runtime'])).toBe(true);
  expect(Number.isFinite(summary.measures['bananza:feature-load:openai-runtime'])).toBe(true);
  expect(Number.isFinite(summary.measures['bananza:feature-load:settings'])).toBe(true);
  expect(Number.isFinite(summary.measures['bananza:feature-preload:settings'])).toBe(true);
});

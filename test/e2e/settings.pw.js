const { test, expect } = require('@playwright/test');

const {
  installMediaMocks,
  isDesktopProject,
  makeUser,
  registerViaUi,
} = require('./helpers');

async function openLanguageSettings(page) {
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settingsModal')).toBeVisible();
  await page.locator('#settingsLanguagePanel').click();
  await expect(page.locator('#languageSettingsModal')).toBeVisible();
}

async function selectLanguage(page, language) {
  await page.locator(`#settingsLanguagePicker [data-language-option="${language}"]`).click();
  await expect.poll(async () => page.evaluate(() => document.documentElement.lang)).toBe(language);
}

test('desktop settings can change interface language and persist it after reload', async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo), 'desktop-only settings flow');

  await installMediaMocks(page);

  const member = makeUser('pwset');
  await registerViaUi(page, member);
  await expect.poll(async () => page.evaluate(() => document.documentElement.lang)).toBe('ru');

  await openLanguageSettings(page);
  await selectLanguage(page, 'en');
  await expect(page.locator('#settingsLanguagePanel')).toContainText('Interface language');
  await expect(page.locator('#msgInput')).toHaveAttribute('placeholder', 'Message...');

  await page.reload();
  await expect(page.locator('#chatList')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => document.documentElement.lang)).toBe('en');
  await expect(page.locator('#msgInput')).toHaveAttribute('placeholder', 'Message...');

  await openLanguageSettings(page);
  await selectLanguage(page, 'ru');
  await expect.poll(async () => page.evaluate(() => document.documentElement.lang)).toBe('ru');
});

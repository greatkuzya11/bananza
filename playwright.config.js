const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: path.join(__dirname, 'test', 'e2e'),
  testMatch: /.*\.pw\.js$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: path.join(__dirname, 'test', 'e2e', 'globalSetup.js'),
  globalTeardown: path.join(__dirname, 'test', 'e2e', 'globalTeardown.js'),
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});

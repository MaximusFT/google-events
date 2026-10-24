import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-angular',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5182',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: { command: 'node scripts/serve-angular.mjs', url: 'http://127.0.0.1:5182/shop', reuseExistingServer: false },
});

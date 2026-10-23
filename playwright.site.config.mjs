import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-site',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5181',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
  },
  webServer: {
    command: 'node scripts/serve-site-pilot.mjs 5181',
    url: 'http://127.0.0.1:5181',
    reuseExistingServer: false,
  },
});

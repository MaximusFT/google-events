import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser',
  testMatch: '**/*.pw.mjs',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174/neutral.html',
    reuseExistingServer: !process.env.CI,
  },
});

import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './browser-docs', workers: 1, reporter: 'list',
  use: { channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined), headless: true, screenshot: 'only-on-failure' },
  projects: [
    { name: 'root', use: { baseURL: 'http://127.0.0.1:5190/' } },
    { name: 'subpath', use: { baseURL: 'http://127.0.0.1:5190/relocated/project/' } },
  ],
  webServer: { command: 'node scripts/serve-docs.mjs --check', url: 'http://127.0.0.1:5190', reuseExistingServer: false },
});

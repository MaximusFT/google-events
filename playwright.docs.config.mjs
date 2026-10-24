import { defineConfig } from '@playwright/test';
const published = process.env.DOCS_URL;
if (published && !/^https?:\/\//.test(published)) throw new Error('DOCS_URL must be an HTTP(S) URL');
const publishedBase = published ? published.replace(/\/?$/, '/') : undefined;
export default defineConfig({
  testDir: './browser-docs', workers: 1, reporter: 'list',
  use: { channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined), headless: true, screenshot: 'only-on-failure' },
  projects: publishedBase ? [{ name: 'published', use: { baseURL: publishedBase } }] : [
    { name: 'root', use: { baseURL: 'http://127.0.0.1:5190/' } },
    { name: 'subpath', use: { baseURL: 'http://127.0.0.1:5190/relocated/project/' } },
  ],
  webServer: publishedBase ? undefined : { command: 'node scripts/serve-docs.mjs --check', url: 'http://127.0.0.1:5190', reuseExistingServer: false },
});

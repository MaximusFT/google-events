import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// Serve the actual artifacts; no Vite transforms, dependency resolution or HMR.
const files = new Map([
  ['classic.html', 'examples/browser/classic.html'], ['classic.js', 'examples/browser/classic.js'],
  ['module.html', 'examples/browser/module.html'], ['module.js', 'examples/browser/module.js'],
  ['index.js', 'dist/index.js'], ['track-events.global.js', 'dist/track-events.global.js'],
].map(([name, path]) => [`/${path}`, new URL(`../${path}`, import.meta.url)]));
let server, origin;
test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = files.get(path);
    if (!file) { response.writeHead(404).end(); return; }
    try {
      response.setHeader('Content-Type', path.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
      response.end(await readFile(file));
    } catch { response.writeHead(500).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

for (const format of ['classic', 'module']) {
  test(`${format}: standalone assets, inherited context, dynamic DOM and restart without duplicates`, async ({ page }) => {
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    await page.goto(`${origin}/examples/browser/${format}.html`);
    const output = page.locator('#events');
    await page.getByRole('button', { name: 'В избранное', exact: true }).click();
    await expect(output).toContainText('favorite_requested');
    await page.locator('#add').click();
    await page.getByRole('button', { name: 'Динамическое действие' }).click();
    await expect(output).toContainText('dynamic_requested');
    await page.locator('#stop').click();
    await page.getByRole('button', { name: 'Динамическое действие' }).click();
    await page.locator('#start').click();
    await page.locator('#start').click();
    await page.getByRole('button', { name: 'В избранное', exact: true }).click();
    const events = await output.textContent();
    expect(events.trim().split('\n').map(line => JSON.parse(line))).toEqual([
      { name: 'favorite_requested', trigger: 'click', properties: { product_id: 'SKU-AbC', price: 0 } },
      { name: 'dynamic_requested', trigger: 'click', properties: { product_id: 'SKU-AbC', price: 0 } },
      { name: 'favorite_requested', trigger: 'click', properties: { product_id: 'SKU-AbC', price: 0 } },
    ]);
    expect(await page.evaluate(() => window.dataLayer)).toBeUndefined();
    expect(await page.evaluate(() => Object.keys(window.TrackEvents ?? {}).sort())).toEqual(format === 'classic' ? [
      'createCallbackReceiver', 'createDataLayerReceiver', 'createGa4Receiver', 'createGtmReceiver', 'createTracker', 'createUmamiReceiver',
    ] : []);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

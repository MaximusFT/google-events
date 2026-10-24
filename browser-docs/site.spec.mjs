import { test, expect } from '@playwright/test';

const read = (page, id) => page.locator(id).textContent().then(JSON.parse);
test('direct section URLs, navigation and local search work without external services', async ({ page, baseURL }) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === new URL(baseURL).origin) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  await page.goto('docs/API.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('API нейтрального трекера');
  await page.reload();
  await expect(page.locator('.VPNavBarTitle')).toContainText('0.3.0');
  await page.getByRole('button', { name: 'Поиск по документации' }).click();
  await page.locator('#localsearch-input').fill('ambiguous-field');
  await expect(page.locator('.VPLocalSearchBox .result').first()).toBeVisible();
  await page.locator('.VPLocalSearchBox .result').first().click();
  await expect(page).toHaveURL(new RegExp(new URL(baseURL).pathname + 'docs/'));
  await page.getByRole('button', { name: 'Поиск по документации' }).click();
  await page.locator('#localsearch-input').fill('наследование');
  await expect(page.locator('.VPLocalSearchBox .result').first()).toBeVisible();
  await page.locator('.VPLocalSearchBox .result').first().click();
  const source = await page.request.get(new URL('examples/react/ProductCard.tsx', baseURL).href);
  expect(source.status()).toBe(200);
  expect(source.headers()['content-type']).not.toContain('text/html');
  expect(await source.text()).toContain('export function ProductCard');
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('playground explains sources, maps once to two receivers, validates and respects nested roots', async ({ page }) => {
  await page.goto('docs/PLAYGROUND.html');
  await expect(page.locator('#demo-action')).toBeEnabled();
  await page.locator('#demo-inspect').click();
  const initial = await read(page, '#demo-inspection');
  expect(initial.event.properties).toEqual({ placement: 'card', product_id: 'SKU-Demo', price: 0, available: false });
  expect(initial.boundary).toBe('demo-root');
  expect(initial.fields.placement.overridden[0].raw).toBe('page');
  expect(await read(page, '#demo-deliveries')).toEqual([]);
  await page.locator('#demo-action').click();
  await expect.poll(() => read(page, '#demo-deliveries')).toHaveLength(2);
  const deliveries = await read(page, '#demo-deliveries');
  expect(deliveries.map(item => item.receiver)).toEqual(['neutral', 'mapped']);
  expect(deliveries[1].payload).toEqual({ event: 'favorite_requested', ...initial.event.properties });
  await page.locator('#demo-price').fill('invalid');
  await page.locator('#demo-inspect').click();
  expect((await read(page, '#demo-inspection')).event).toBe(false);
  await page.locator('#demo-action').click();
  expect(await read(page, '#demo-deliveries')).toHaveLength(2);
  await page.locator('#demo-off').check();
  await page.locator('#nested-inspect').click();
  expect((await read(page, '#demo-inspection')).event.properties).toEqual({ product_id: 'SKU-Nested', price: 7.5 });
  await page.locator('#nested-action').click();
  await expect.poll(() => read(page, '#demo-deliveries')).toHaveLength(4);
  await page.locator('#demo-price').fill('0');
  await page.locator('#demo-inspect').click();
  expect((await read(page, '#demo-inspection')).issues.some(issue => issue.code === 'disabled')).toBe(true);
});

test('mobile reading and navigation stay inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('docs/CONTRACT.html');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Разделы', exact: true }).click();
  await page.locator('.VPSidebar').getByRole('link', { name: 'Первое событие', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Первое событие без привязки к аналитическому сервису');
});

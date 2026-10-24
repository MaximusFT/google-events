import { test, expect } from '@playwright/test';

const events = page => page.locator('#events').textContent().then(text => JSON.parse(text));
const event = (product, price, available, placement = 'title') => ({
  name: 'favorite_requested', trigger: 'click', properties: { product_id: product, price, available, placement },
});
test.beforeEach(async ({ page }) => {
  await page.goto('/shop');
  await expect(page.locator('#favorite')).toBeVisible();
});

test('AOT Angular: dynamic markup and current bindings use one scoped collector', async ({ page }) => {
  await page.locator('#favorite').click();
  await page.locator('#toggle-extra').click();
  await page.locator('#extra').click();
  await page.locator('#change-product').click();
  await page.locator('#favorite').click();
  await page.locator('#extra').click();
  await expect.poll(() => events(page)).toEqual([
    event('SKU-A', 12.5, true), event('SKU-A', 12.5, true, 'footer'),
    event('SKU-B', 0, false), event('SKU-B', 0, false, 'footer'),
  ]);
});

test('destroyed directive removes listeners from the detached root; remount delivers once', async ({ page }) => {
  await page.locator('#favorite').click();
  const oldButton = await page.locator('#favorite').elementHandle();
  await page.locator('#toggle-card').click();
  await expect(page.locator('#product')).toHaveCount(0);
  // A retained detached subtree still bubbles internally: this detects missing destroy(), not just removal from the page.
  expect(await oldButton.evaluate(button => !button.isConnected && !!button.closest('[data-track-root]'))).toBe(true);
  await oldButton.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await expect.poll(() => events(page)).toEqual([event('SKU-A', 12.5, true)]);
  await page.locator('#toggle-card').click();
  await page.locator('#favorite').click();
  await expect.poll(() => events(page)).toEqual([event('SKU-A', 12.5, true), event('SKU-A', 12.5, true)]);
});

test('Router navigation, return and browser back recreate the root without duplicate delivery', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#change-product').click();
  await page.locator('#favorite').click();
  const oldButton = await page.locator('#favorite').elementHandle();
  await page.getByRole('link', { name: 'О примере', exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator('#product')).toHaveCount(0);
  expect(await oldButton.evaluate(button => !button.isConnected && !!button.closest('[data-track-root]'))).toBe(true);
  await oldButton.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.goBack();
  await expect(page).toHaveURL(/\/shop$/);
  await page.locator('#favorite').click();
  await page.getByRole('link', { name: 'О примере', exact: true }).click();
  await page.getByRole('link', { name: 'Магазин', exact: true }).click();
  await page.locator('#favorite').click();
  await expect.poll(() => events(page)).toEqual([
    event('SKU-B', 0, false), event('SKU-A', 12.5, true), event('SKU-A', 12.5, true),
  ]);
  expect(errors).toEqual([]);
});

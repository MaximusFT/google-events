import { test, expect } from '@playwright/test';

const events = async (page) => JSON.parse(await page.locator('#pilot-events').textContent());

test('a successful favorite operation has one intent and one confirmed outcome', async ({ page }) => {
  await page.goto('/pilot.html');
  await page.locator('#card-context [data-track-placement="title"] button').click();
  await expect(page.locator('#operation-status')).toContainText('добавлен в избранное');
  expect((await events(page)).map((event) => event.name)).toEqual(['favorite_requested', 'favorite_added']);
  expect((await events(page))[0].properties.favorite).toBe(false);
  expect((await events(page))[1].properties.favorite).toBe(true);
  await page.locator('#card-context [data-track-placement="description"] button').click();
  await expect(page.locator('#operation-status')).toContainText('удалён из избранного');
  expect((await events(page)).map((event) => event.name)).toEqual(['favorite_requested', 'favorite_added', 'favorite_requested', 'favorite_removed']);
});

test('a failed operation does not emit success or change application state', async ({ page }) => {
  await page.goto('/pilot.html');
  await page.locator('#operation-failure').check();
  await page.locator('#card-context [data-track-placement="title"] button').click();
  await expect(page.locator('#operation-status')).toContainText('операция не выполнена');
  expect((await events(page)).map((event) => event.name)).toEqual(['favorite_requested', 'favorite_failed']);
  await expect(page.locator('#favorite-state')).toHaveText('В избранном: нет');
});

test('portal context and snapshots survive closing the source dialog during an operation', async ({ page }) => {
  await page.goto('/pilot.html');
  await page.locator('#open-modal').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Изменить избранное' }).click();
  await page.locator('#close-modal').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('#pilot-price').fill('19.99');
  await expect(page.locator('#operation-status')).toContainText('добавлен в избранное');
  const captured = await events(page);
  expect(captured).toHaveLength(2);
  expect(captured.every((event) => event.properties.placement === 'modal' && event.properties.price === 129.9)).toBe(true);
});

test('a product switch during the operation cannot attach the new product to the old outcome', async ({ page }) => {
  await page.goto('/pilot.html');
  await page.locator('#card-context [data-track-placement="title"] button').click();
  await page.locator('#product-picker').selectOption('1');
  await expect(page.locator('#operation-status')).toContainText('SKU-City: добавлен');
  expect((await events(page)).every((event) => event.properties.product_id === 'SKU-City')).toBe(true);
  await expect(page.locator('#favorite-state')).toHaveText('В избранном: нет');
});

test('analytics restrictions and invalid analytics fields never block the business operation', async ({ page }) => {
  await page.goto('/pilot.html');
  await page.locator('#analytics-allowed').uncheck();
  await page.locator('#card-context [data-track-placement="title"] button').click();
  await expect(page.locator('#favorite-state')).toHaveText('В избранном: да');
  expect(await events(page)).toEqual([]);
  expect(await page.evaluate(() => window.dataLayer ?? [])).toEqual([]);
  await page.locator('#analytics-allowed').check();
  await page.locator('#pilot-price').fill('invalid');
  await page.locator('#card-context [data-track-placement="description"] button').click();
  await expect(page.locator('#favorite-state')).toHaveText('В избранном: нет');
  expect(await events(page)).toEqual([]);
  await expect(page.locator('#pilot-diagnostics')).toContainText('Invalid number');
});

test('a second product carries zero price and false availability without leaking the first product', async ({ page }) => {
  await page.goto('/pilot.html');
  await page.locator('#product-picker').selectOption('1');
  await page.locator('#card-context [data-track-placement="description"] button').click();
  await expect(page.locator('#operation-status')).toContainText('SKU-Sample: добавлен');
  const captured = await events(page);
  expect(captured).toHaveLength(2);
  expect(captured.every((event) => event.properties.product_id === 'SKU-Sample' && event.properties.price === 0 && event.properties.available === false)).toBe(true);
});

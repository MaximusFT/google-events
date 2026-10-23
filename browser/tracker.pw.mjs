import { test, expect } from '@playwright/test';

test('three neutral actions carry typed product data to two receivers', async ({ page }) => {
  await page.goto('/neutral.html');
  await page.locator('#favorite-title svg').click();
  await page.locator('#favorite-modal').click();
  await page.locator('#favorite-footer').click();
  const events = await page.evaluate(() => window.dataLayer);
  expect(events.map((event) => event.placement)).toEqual(['title', 'modal', 'footer']);
  expect(events.every((event) => event.product_id === 'SKU-AbC' && event.price === 129.9 && event.available === true)).toBe(true);
  const custom = JSON.parse(await page.locator('#custom-output').textContent());
  expect(custom).toHaveLength(3);
});

test('inspect explains overrides without sending; disabled subtree is skipped', async ({ page }) => {
  await page.goto('/neutral.html');
  await page.locator('#inspect').click();
  const info = JSON.parse(await page.locator('#inspection').textContent());
  expect(info.boundary).toBe('#product');
  expect(info.fields.placement.element).toBe('#title-block');
  expect(info.fields.placement.overridden[0].raw).toBe('product');
  expect(await page.evaluate(() => window.dataLayer.length)).toBe(0);
  await page.locator('#disable-modal').check();
  await page.locator('#favorite-modal').click();
  expect(await page.evaluate(() => window.dataLayer.length)).toBe(0);
  await page.locator('#favorite-title').click();
  expect(await page.evaluate(() => window.dataLayer.length)).toBe(1);
});

test('required validation, zero/false and receiver failure work in the browser', async ({ page }) => {
  await page.goto('/neutral.html');
  await page.locator('#price').fill('invalid');
  await page.locator('#favorite-title').click();
  expect(await page.evaluate(() => window.dataLayer.length)).toBe(0);
  await expect(page.locator('#diagnostics')).toContainText('invalid-type');
  await page.locator('#price').fill('0');
  await page.locator('#available').uncheck();
  await page.locator('#fail-callback').check();
  await page.locator('#favorite-title').click();
  const event = await page.evaluate(() => window.dataLayer[0]);
  expect(event.price).toBe(0);
  expect(event.available).toBe(false);
  expect(JSON.parse(await page.locator('#custom-output').textContent())).toHaveLength(0);
  await expect(page.locator('#diagnostics')).toContainText('custom-analytics');
});

test('open shadow roots, slots, change, submit and lifecycle operate in a real DOM', async ({ page }) => {
  await page.goto('/neutral.html');
  const result = await page.evaluate(async () => {
    const { createTracker, createCallbackReceiver } = await import('/src/index.ts');
    const events = [];
    const host = document.createElement('div');
    host.setAttribute('data-track-root', '');
    host.innerHTML = '<button data-track-event="slot" slot="action">Slot</button><input type="checkbox" data-track-event="check" data-track-trigger="change"><form data-track-event="form" data-track-trigger="submit"><button>Submit</button></form>';
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<div data-track-placement="shadow"><button data-track-event="inside">Inside</button><slot name="action"></slot><slot></slot></div>';
    const tracker = createTracker({ root: host, receivers: [createCallbackReceiver({ name: 'capture', send: (event) => { events.push(event); } })] });
    tracker.start(); tracker.start();
    shadow.querySelector('button').click();
    host.querySelector('button').click();
    host.querySelector('input').click(); host.querySelector('input').click();
    host.querySelector('form').addEventListener('submit', (event) => event.preventDefault());
    host.querySelector('form button').click();
    tracker.stop(); shadow.querySelector('button').click();
    tracker.start(); shadow.querySelector('button').click();
    tracker.destroy(); shadow.querySelector('button').click();
    await tracker.flush();
    host.remove();
    return events;
  });
  expect(result.map((event) => event.name)).toEqual(['inside', 'slot', 'check', 'check', 'form', 'inside']);
  expect(result[0].properties.placement).toBe('shadow');
  expect(result[1].properties.placement).toBe('shadow');
});

test('legacy demo remains operational', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-event="favorite_add"]').first().click();
  expect(await page.evaluate(() => window.dataLayer[0].ecommerce['product-id'])).toBe('SKU-AbC');
  await page.locator('#simulate-error').check();
  await page.locator('[data-event="favorite_add"]').first().click();
  expect(await page.evaluate(() => window.dataLayer.length)).toBe(2);
  await expect(page.locator('#errors')).toContainText('custom-analytics');
});

test('React StrictMode does not duplicate sends and dynamic buttons inherit product context', async ({ page }) => {
  await page.goto('/react.html');
  await page.getByRole('button', { name: 'У заголовка' }).click();
  await expect(page.locator('#react-events')).toContainText('SKU-React');
  expect(await page.evaluate(() => window.dataLayer.length)).toBe(1);
  await page.locator('#show-footer').check();
  await page.getByRole('button', { name: 'В конце карточки' }).click();
  const events = JSON.parse(await page.locator('#react-events').textContent());
  expect(events).toHaveLength(2);
  expect(events[1].properties.placement).toBe('footer');
  expect(events[1].properties.product_id).toBe('SKU-React');
  expect(events[1].properties.price).toBe(129.9);
});

test('an iframe instance sends to its own dataLayer and closed shadow internals stay hidden', async ({ page }) => {
  await page.goto('/neutral.html');
  const result = await page.evaluate(async () => {
    const { createTracker } = await import('/src/index.ts');
    const iframe = document.createElement('iframe');
    const loaded = new Promise((resolve) => { iframe.onload = resolve; });
    iframe.srcdoc = '<section data-track-root data-track-product-id="FRAME"><button data-track-event="frame">Frame</button></section>';
    document.body.append(iframe);
    await loaded;
    const tracker = createTracker({ root: iframe.contentDocument });
    tracker.start();
    iframe.contentDocument.querySelector('button').click();
    await tracker.flush();
    const frameEvents = iframe.contentWindow.dataLayer;
    const parentCount = window.dataLayer.length;
    const host = document.createElement('div');
    host.setAttribute('data-track-root', '');
    document.body.append(host);
    const closed = host.attachShadow({ mode: 'closed' });
    closed.innerHTML = '<button data-track-event="closed">Hidden</button>';
    const externalTracker = createTracker({ root: host });
    externalTracker.start();
    closed.querySelector('button').click();
    const afterClosed = window.dataLayer.length;
    externalTracker.destroy(); tracker.destroy(); host.remove(); iframe.remove();
    return { frameEvents, parentCount, afterClosed };
  });
  expect(result.frameEvents).toEqual([{ name: 'frame', trigger: 'click', properties: { product_id: 'FRAME' } }]);
  expect(result.parentCount).toBe(0);
  expect(result.afterClosed).toBe(0);
});

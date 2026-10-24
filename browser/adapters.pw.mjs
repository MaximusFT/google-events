import { test, expect } from '@playwright/test';

test('one browser action routes to GA4, Umami and a GTM layer without SDK network requests', async ({ page }) => {
  const external = [];
  await page.route('**/*', route => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  await page.goto('/neutral.html');
  await page.evaluate(async () => {
    const { createTracker, createGa4Receiver, createUmamiReceiver, createGtmReceiver } = await import('/src/index.ts');
    const root = document.createElement('section');
    root.setAttribute('data-track-root', '');
    root.setAttribute('data-track-price', '0');
    root.setAttribute('data-track-available', 'false');
    root.innerHTML = '<button id="adapters-action" data-track-event="open">Adapter action</button>';
    document.body.prepend(root);
    const google = [], umami = [];
    const tracker = createTracker({ root, schema: { price: 'number', available: 'boolean' }, receivers: [
      createGa4Receiver({ measurementId: 'G-BROWSER', getClient: () => (...args) => { google.push(args); } }),
      createUmamiReceiver({ getClient: () => ({ track: (...args) => { umami.push(args); } }) }),
      createGtmReceiver({ layerName: 'adapterLayer' }),
    ] });
    window.adapterFixture = { tracker, google, umami, root };
    tracker.start(); tracker.start();
  });
  await page.locator('#adapters-action').click();
  const result = await page.evaluate(async () => {
    await window.adapterFixture.tracker.flush();
    const { google, umami, tracker, root } = window.adapterFixture;
    tracker.destroy(); root.remove();
    return { google, umami, layer: window.adapterLayer };
  });
  expect(result).toEqual({
    google: [['event', 'open', { price: 0, available: 'false', send_to: 'G-BROWSER' }]],
    umami: [['open', { price: 0, available: false }]],
    layer: [{ event: 'open', price: 0, available: false }],
  });
  expect(external).toEqual([]);
});

test('missing browser SDK does not block another provider; the next action uses the available client', async ({ page }) => {
  await page.goto('/neutral.html');
  await page.evaluate(async () => {
    const { createTracker, createGa4Receiver, createUmamiReceiver } = await import('/src/index.ts');
    const root = document.createElement('section');
    root.setAttribute('data-track-root', '');
    root.innerHTML = '<button id="late-adapter" data-track-event="open">Late SDK</button>';
    document.body.prepend(root);
    const google = [], other = [], failures = [];
    let client;
    const tracker = createTracker({ root, receivers: [
      createGa4Receiver({ measurementId: 'G-LATE', getClient: () => client }),
      createUmamiReceiver({ getClient: () => ({ track: (...args) => { other.push(args); } }) }),
    ], onError: failure => { failures.push(failure.receiver); } });
    window.adapterFixture = { tracker, google, other, failures, root, ready() { client = (...args) => { google.push(args); }; } };
    tracker.start();
  });
  await page.locator('#late-adapter').click();
  await page.evaluate(async () => { await window.adapterFixture.tracker.flush(); window.adapterFixture.ready(); });
  await page.locator('#late-adapter').click();
  const result = await page.evaluate(async () => {
    const fixture = window.adapterFixture;
    await fixture.tracker.flush(); fixture.tracker.destroy(); fixture.root.remove();
    return { google: fixture.google.length, other: fixture.other.length, failures: fixture.failures };
  });
  expect(result).toEqual({ google: 1, other: 2, failures: ['ga4'] });
});

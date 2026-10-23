import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createGoogleEvents, createCallbackReceiver, createDataLayerReceiver } from '../dist/index.js';

function fixture(t, options = {}) {
  const dom = new JSDOM('<section data-gtm-event data-ecomm-product-id="SKU-AbC"><button data-event="favorite_add" data-ecomm-event-name="add">Favorite</button></section>', { url: 'https://shop.example/' });
  const tracker = createGoogleEvents(options);
  t.after(() => { tracker.destroy(); dom.window.close(); });
  return { tracker, window: dom.window, document: dom.window.document, button: dom.window.document.querySelector('button') };
}

test('one DOM action reaches dataLayer and callback; callback can transform to a different schema', async (t) => {
  const received = [];
  const f = fixture(t, { receivers: [
    createDataLayerReceiver(),
    createCallbackReceiver({
      name: 'custom',
      filter: (event) => event.event === 'favorite_add',
      transform: (event) => ({ name: event.event, product: event.ecommerce['product-id'] }),
      send: (payload) => { received.push(payload); },
    }),
  ] });
  f.tracker.init({ root: f.document });
  f.button.click();
  await f.tracker.flush();
  assert.equal(f.window.dataLayer.length, 1);
  assert.deepEqual(received, [{ name: 'favorite_add', product: 'SKU-AbC' }]);
});

test('each receiver owns its event, including filter changes and delayed mutations', async (t) => {
  let finish;
  let altered;
  const f = fixture(t, { receivers: [
    createCallbackReceiver({
      name: 'mutating',
      filter: (event) => { event.data['link-place'] = 'filter'; return true; },
      send: (event) => {
        altered = event;
        event.event = 'changed';
        event.ecommerce['product-id'] = 'changed';
        return new Promise((resolve) => { finish = resolve; });
      },
    }),
    createDataLayerReceiver(),
  ] });
  const original = f.tracker.trackElement(f.button);
  assert.equal(original.event, 'favorite_add');
  assert.equal(original.ecommerce['product-id'], 'SKU-AbC');
  assert.equal(f.window.dataLayer[0].event, 'favorite_add');
  assert.equal(f.window.dataLayer[0].data['link-place'], '1');
  altered.data['link-place'] = 'later';
  finish();
  await f.tracker.flush();
  assert.equal(original.data['link-place'], '1');
  assert.equal(f.window.dataLayer[0].ecommerce['product-id'], 'SKU-AbC');
});

test('a blocked receiver is skipped without blocking others', async (t) => {
  let blockedCalls = 0;
  const received = [];
  const f = fixture(t, { receivers: [
    createCallbackReceiver({ name: 'blocked', filter: () => false, send: () => { blockedCalls++; } }),
    createCallbackReceiver({ name: 'allowed', send: (event) => { received.push(event); } }),
  ] });
  f.tracker.trackElement(f.button);
  await f.tracker.flush();
  assert.equal(blockedCalls, 0);
  assert.equal(received.length, 1);
  assert.equal(f.window.dataLayer, undefined);
});

test('filter, transform, sync send and async send failures are reported while healthy delivery continues', async (t) => {
  const failures = [];
  const f = fixture(t, { onError: (failure) => { failures.push(failure); }, receivers: [
    { name: 'filter-error', filter: () => { throw new Error('filter failed'); }, send: () => assert.fail('must not send') },
    createCallbackReceiver({ name: 'transform-error', transform: () => { throw new Error('transform failed'); }, send: () => assert.fail('must not send') }),
    { name: 'sync-error', send: (event) => { event.event = 'mutated'; throw new Error('sync failed'); } },
    { name: 'async-error', send: async () => { throw new Error('async failed'); } },
    createDataLayerReceiver(),
  ] });
  f.tracker.trackElement(f.button);
  await f.tracker.flush();
  assert.equal(f.window.dataLayer.length, 1);
  assert.deepEqual(failures.map((failure) => [failure.receiver, failure.phase]), [
    ['filter-error', 'filter'], ['transform-error', 'send'], ['sync-error', 'send'], ['async-error', 'send'],
  ]);
  for (const failure of failures) assert.equal(failure.event.event, 'favorite_add');
});

test('async receivers start independently and flush waits for their current sends', async (t) => {
  let finish;
  let healthy = 0;
  const f = fixture(t, { receivers: [
    { name: 'slow', send: () => new Promise((resolve) => { finish = resolve; }) },
    { name: 'fast', send: () => { healthy++; } },
  ] });
  f.tracker.trackElement(f.button);
  assert.equal(healthy, 1);
  let settled = false;
  const flushed = f.tracker.flush().then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  finish();
  await flushed;
  assert.equal(settled, true);
});

test('empty configuration collects without sending; init can replace or retain receivers', async (t) => {
  const f = fixture(t, { receivers: [] });
  const received = [];
  const event = f.tracker.trackElement(f.button);
  assert.equal(event.event, 'favorite_add');
  assert.equal(f.window.dataLayer, undefined);
  f.tracker.init({ root: f.document, receivers: [createCallbackReceiver({ name: 'only', send: (event) => { received.push(event); } })] });
  f.tracker.init({ root: f.document });
  f.button.click();
  await f.tracker.flush();
  assert.equal(received.length, 1);
  assert.equal(f.window.dataLayer, undefined);
  f.tracker.init({ root: f.document, receivers: [] });
  f.button.click();
  await f.tracker.flush();
  assert.equal(received.length, 1);
});

test('dataLayer supports a custom layer, preserves existing push and isolates a malformed layer', async (t) => {
  const pushes = [];
  const failures = [];
  const f = fixture(t, { onError: (failure) => { failures.push(failure); }, receivers: [
    createDataLayerReceiver({ name: 'invalid', layerName: 'broken' }),
    createDataLayerReceiver({ layerName: 'analyticsQueue', transform: (event) => ({ event: event.event, item: event.ecommerce['product-id'] }) }),
  ] });
  const existing = { push: (payload) => pushes.push(payload) };
  f.window.analyticsQueue = existing;
  f.window.broken = false;
  f.tracker.trackElement(f.button);
  await f.tracker.flush();
  assert.equal(f.window.analyticsQueue, existing);
  assert.deepEqual(pushes, [{ event: 'favorite_add', item: 'SKU-AbC' }]);
  assert.equal(failures[0].receiver, 'invalid');
});

test('error handlers cannot interrupt another receiver or leak an unhandled rejection', async (t) => {
  const f = fixture(t, { onError: async () => { throw new Error('handler failed'); }, receivers: [
    { name: 'broken', send: () => { throw new Error('send failed'); } },
    createDataLayerReceiver(),
  ] });
  const diagnostics = [];
  t.mock.method(console, 'error', (...args) => { diagnostics.push(args); });
  f.tracker.trackElement(f.button);
  await f.tracker.flush();
  assert.equal(f.window.dataLayer.length, 1);
  assert.equal(diagnostics[0][0], 'Analytics onError handler failed');
});

test('receiver names are validated and invalid reconfiguration leaves the previous listeners active', async (t) => {
  assert.throws(() => createGoogleEvents({ receivers: [{ name: '', send() {} }] }), /non-empty name/);
  const f = fixture(t);
  f.tracker.init({ root: f.document });
  assert.throws(() => f.tracker.init({ root: f.document, receivers: [
    { name: 'same', send() {} }, { name: 'same', send() {} },
  ] }), /Duplicate receiver name/);
  f.button.click();
  await f.tracker.flush();
  assert.equal(f.window.dataLayer.length, 1);
});

test('destroy removes DOM listeners but allows already-started delivery to finish', async (t) => {
  let finish;
  let sent = 0;
  const f = fixture(t, { receivers: [{ name: 'async', send: () => new Promise((resolve) => {
    finish = () => { sent++; resolve(); };
  }) }] });
  f.tracker.init({ root: f.document });
  f.button.click();
  f.tracker.destroy();
  f.button.click();
  finish();
  await f.tracker.flush();
  assert.equal(sent, 1);
});

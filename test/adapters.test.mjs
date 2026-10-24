import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createTracker, createGa4Receiver, createGtmReceiver, createUmamiReceiver, createDataLayerReceiver } from '../dist/index.js';

test('provider factories and inspect do not resolve clients, transform events or load SDKs', (t) => {
  const dom = new JSDOM('<button data-track-root data-track-event="open">Open</button>');
  const calls = [];
  const tracker = createTracker({ root: dom.window.document, receivers: [
    createGa4Receiver({ measurementId: 'G-TEST', getClient: () => { calls.push('client'); }, transform: () => { calls.push('map'); } }),
    createUmamiReceiver({ getClient: () => { calls.push('client'); } }),
  ] });
  t.after(() => { tracker.destroy(); dom.window.close(); });
  assert.deepEqual(calls, []);
  assert.deepEqual(tracker.inspect(dom.window.document.querySelector('button')).receivers, [{ name: 'ga4', selected: true }, { name: 'umami', selected: true }]);
  assert.deepEqual(calls, []);
  assert.equal(dom.window.document.querySelectorAll('script').length, 0);
});

test('one DOM click reaches three provider envelopes once, with isolated boolean policy and protected routing', async (t) => {
  const dom = new JSDOM('<section data-track-root data-track-price="0" data-track-available="false"><button data-track-event="open">Open</button></section>');
  const ga4 = [], umami = [];
  const client = { track(name, data) { assert.equal(this, client); umami.push([name, data]); } };
  const tracker = createTracker({ root: dom.window.document, schema: { price: 'number', available: 'boolean' }, receivers: [
    createGa4Receiver({ measurementId: 'G-TARGET', getClient: () => (...args) => { ga4.push(args); args[2].price = 99; } }),
    createUmamiReceiver({ getClient: () => client }),
    createGtmReceiver(),
  ] });
  t.after(() => { tracker.destroy(); dom.window.close(); });
  tracker.start(); tracker.start();
  dom.window.document.querySelector('button').click();
  await tracker.flush();
  assert.equal(ga4.length, 1);
  assert.equal(ga4[0][0], 'event');
  assert.equal(ga4[0][1], 'open');
  assert.equal(ga4[0][2].available, 'false');
  assert.equal(ga4[0][2].send_to, 'G-TARGET');
  assert.deepEqual(umami, [['open', { price: 0, available: false }]]);
  assert.deepEqual(dom.window.dataLayer, [{ event: 'open', price: 0, available: false }]);
  tracker.destroy();
  dom.window.document.querySelector('button').click();
  assert.equal(ga4.length, 1);
});

test('two GA4 instances route explicitly and cannot be redirected by transformed params', async () => {
  const calls = [];
  const source = { items: [{ item_id: 'SKU' }], send_to: 'G-SPOOF', enabled: false, value: 0 };
  const gtag = (...args) => { calls.push(args); args[2].items[0].item_id = 'mutated'; };
  const receivers = ['G-ONE', 'G-TWO'].map(measurementId => createGa4Receiver({
    name: measurementId, measurementId, getClient: () => gtag,
    transform: () => ({ name: 'purchase', params: source }),
  }));
  const tracker = createTracker({ receivers });
  tracker.track('confirmed');
  await tracker.flush();
  assert.deepEqual(calls.map(call => call[2].send_to), ['G-ONE', 'G-TWO']);
  assert.deepEqual(calls.map(call => [call[0], call[1], call[2].enabled, call[2].value]), [['event', 'purchase', 'false', 0], ['event', 'purchase', 'false', 0]]);
  assert.equal(source.items[0].item_id, 'SKU');
  assert.equal(source.send_to, 'G-SPOOF');
});

test('missing clients fail only that receiver; later events use a newly available client with no replay', async () => {
  let client;
  const calls = [], other = [], failures = [];
  const tracker = createTracker({ receivers: [
    createGa4Receiver({ measurementId: 'G-TEST', getClient: () => client }),
    createUmamiReceiver({ getClient: () => ({ track: (...args) => { other.push(args); } }) }),
  ], onError: failure => { failures.push(failure); } });
  tracker.track('first');
  await tracker.flush();
  assert.deepEqual(failures.map(failure => [failure.receiver, failure.phase]), [['ga4', 'send']]);
  assert.equal(other.length, 1);
  client = (...args) => { calls.push(args); };
  tracker.track('second');
  await tracker.flush();
  assert.deepEqual(calls.map(call => call[1]), ['second']);
  assert.equal(other.length, 2);
});

test('filters run before mapping and client lookup for both DOM-free provider adapters', async () => {
  const forbidden = () => assert.fail('Disabled receiver accessed mapping/client');
  const tracker = createTracker({ receivers: [
    createGa4Receiver({ measurementId: 'G-TEST', getClient: forbidden, transform: forbidden, filter: () => false }),
    createUmamiReceiver({ getClient: forbidden, transform: forbidden, filter: () => false }),
  ] });
  tracker.track('disabled');
  await tracker.flush();
});

test('returned SDK promises participate in flush and rejected sends do not interrupt other providers', async () => {
  let finish;
  let flushed = false;
  const failures = [], google = [];
  const tracker = createTracker({ receivers: [
    createUmamiReceiver({ getClient: () => ({ track: () => new Promise((resolve, reject) => { finish = () => reject(new Error('SDK failed')); }) }) }),
    createGa4Receiver({ measurementId: 'G-TEST', getClient: () => (...args) => { google.push(args); } }),
  ], onError: failure => { failures.push(failure); } });
  tracker.track('open');
  const flushing = tracker.flush().then(() => { flushed = true; });
  await Promise.resolve();
  assert.equal(flushed, false);
  assert.equal(google.length, 1);
  finish();
  await flushing;
  assert.equal(flushed, true);
  assert.deepEqual(failures.map(failure => failure.receiver), ['umami']);
});

test('GTM protects event, preserves a custom layer push, copies nested mapped data and keeps generic dataLayer neutral', async (t) => {
  const dom = new JSDOM('');
  t.after(() => dom.window.close());
  const pushed = [];
  dom.window.queue = { push: payload => { pushed.push(payload); } };
  const mapped = { event: 'mapped', ecommerce: { items: [{ item_id: 'SKU' }] } };
  const tracker = createTracker({ receivers: [
    createGtmReceiver({ window: dom.window, layerName: 'queue' }),
    createGtmReceiver({ name: 'mapped-gtm', window: dom.window, layerName: 'queue', transform: () => mapped }),
    createDataLayerReceiver({ window: dom.window }),
  ] });
  tracker.track('real', { event: 'spoof' });
  await tracker.flush();
  assert.deepEqual(pushed[0], { event: 'real' });
  assert.deepEqual(dom.window.dataLayer, [{ name: 'real', trigger: 'manual', properties: { event: 'spoof' } }]);
  pushed[1].ecommerce.items[0].item_id = 'changed';
  assert.equal(mapped.ecommerce.items[0].item_id, 'SKU');
});

test('GA4 validates configuration, mapped names and parameter guards without truncation', async () => {
  assert.throws(() => createGa4Receiver({ measurementId: '', getClient() {} }), /measurementId/);
  assert.throws(() => createGa4Receiver({ measurementId: 'G-X' }), /getClient/);
  assert.throws(() => createGa4Receiver({ measurementId: 'G-X', getClient() {}, maxParameters: 0 }), /maxParameters/);
  const failures = [];
  const payloads = [{ name: 'x'.repeat(41), params: {} }, { name: 'bad-name', params: {} }, { name: 'valid', params: [] }, { name: 'valid', params: { n: Infinity } }, { name: 'valid', params: { a: 1, b: 2 } }];
  for (const payload of payloads) {
    const tracker = createTracker({ receivers: [createGa4Receiver({ measurementId: 'G-X', maxParameters: 1, getClient: () => assert.fail('Invalid payload reached SDK'), transform: () => payload })], onError: failure => { failures.push(failure); } });
    tracker.track('original'); await tracker.flush();
  }
  assert.equal(failures.length, payloads.length);
});

test('Umami rejects malformed and oversized flat data before resolving the client', async () => {
  assert.throws(() => createUmamiReceiver({}), /getClient/);
  const failures = [];
  const payloads = [
    { name: 'x'.repeat(51), data: {} }, { name: 'ok', data: null },
    { name: 'ok', data: { text: 'x'.repeat(501) } }, { name: 'ok', data: { nested: {} } },
    { name: 'ok', data: { n: Infinity } }, { name: 'ok', data: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`key${i}`, i])) },
  ];
  for (const payload of payloads) {
    const tracker = createTracker({ receivers: [createUmamiReceiver({ getClient: () => assert.fail('Invalid payload reached SDK'), transform: () => payload })], onError: failure => { failures.push(failure); } });
    tracker.track('original'); await tracker.flush();
  }
  assert.equal(failures.length, payloads.length);
});

test('GTM transform errors and malformed queues are reported without a browser-global fallback', async (t) => {
  const dom = new JSDOM('');
  t.after(() => dom.window.close());
  dom.window.bad = {};
  const failures = [];
  const tracker = createTracker({ receivers: [
    createGtmReceiver({ name: 'bad-event', window: dom.window, transform: () => ({ event: '' }) }),
    createGtmReceiver({ name: 'bad-queue', window: dom.window, layerName: 'bad' }),
    createGtmReceiver({ name: 'no-window' }),
  ], onError: failure => { failures.push(failure); } });
  tracker.track('open'); await tracker.flush();
  assert.deepEqual(failures.map(failure => failure.receiver), ['bad-event', 'bad-queue', 'no-window']);
});

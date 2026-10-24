import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createTracker, createCallbackReceiver } from '../dist/index.js';
import { createSingleReceiverTracker, createMultiReceiverTracker, createIsolatedTrackers } from '../examples/configuration.mjs';

const card = '<section data-track-root data-track-product-id="SKU-AbC" data-track-price="0" data-track-available="false"><button data-track-event="favorite_requested">Favorite</button></section>';

function fixture(t, html = card) {
  const dom = new JSDOM(html);
  t.after(() => dom.window.close());
  return dom.window.document;
}

test('configuration recipe: one destination receives typed context once and respects teardown', (t) => {
  const document = fixture(t);
  const sent = [];
  const tracker = createSingleReceiverTracker(document, event => { sent.push(event); });
  t.after(() => tracker.destroy());
  tracker.start(); tracker.start();
  document.querySelector('button').click();
  assert.deepEqual(sent, [{ name: 'favorite_requested', trigger: 'click', properties: { product_id: 'SKU-AbC', price: 0, available: false } }]);
  tracker.destroy();
  document.querySelector('button').click();
  assert.equal(sent.length, 1);
});

test('configuration recipe: two mappings, explicit collision precedence and live permission apply independently', (t) => {
  const document = fixture(t);
  document.querySelector('button').setAttribute('data-track-item-id', 'unmapped-value');
  const primary = [], secondary = [];
  let allowed = true;
  const tracker = createMultiReceiverTracker(document, {
    primary: payload => { primary.push({ event: payload.event, params: { ...payload.params } }); payload.params.price = 99; },
    secondary: payload => { secondary.push(payload); },
  }, () => allowed);
  t.after(() => tracker.destroy());
  tracker.start(); tracker.start();
  const info = tracker.inspect(document.querySelector('button'));
  assert.deepEqual(info.receivers, [{ name: 'primary', selected: true }, { name: 'secondary', selected: true }]);
  assert.deepEqual([primary.length, secondary.length], [0, 0]);
  document.querySelector('button').click();
  assert.deepEqual(primary[0], { event: 'wishlist_click', params: { item_id: 'SKU-AbC', price: 0, available: false } });
  assert.deepEqual(secondary[0], { name: 'favorite_requested', data: { product_id: 'SKU-AbC', item_id: 'unmapped-value', price: 0, available: false } });
  tracker.track('catalog_viewed', { product_id: 'SKU-AbC' });
  assert.deepEqual([primary.length, secondary.length], [1, 2]);
  allowed = false;
  document.querySelector('button').click();
  tracker.track('favorite_added', { product_id: 'SKU-AbC' });
  assert.deepEqual([primary.length, secondary.length], [1, 2]);
  assert.ok(tracker.inspect(document.querySelector('button')).receivers.every(receiver => !receiver.selected));
  allowed = true;
  document.querySelector('button').click();
  assert.deepEqual([primary.length, secondary.length], [2, 3]);
  tracker.destroy();
  document.querySelector('button').click();
  assert.deepEqual([primary.length, secondary.length], [2, 3]);
});

test('configuration recipe: independent roots keep context and cleanup scoped', (t) => {
  const document = fixture(t, `<main>${card}<section data-track-root data-track-product-id="OTHER"><button data-track-event="favorite_requested">Other</button></section></main>`);
  const roots = document.querySelectorAll('section');
  const left = [], right = [];
  const trackers = createIsolatedTrackers(roots[0], roots[1], { left: event => { left.push(event); }, right: event => { right.push(event); } });
  t.after(() => { trackers.left.destroy(); trackers.right.destroy(); });
  trackers.left.start(); trackers.right.start(); trackers.right.start();
  roots[0].querySelector('button').click(); roots[1].querySelector('button').click();
  assert.deepEqual(left.map(event => event.properties.product_id), ['SKU-AbC']);
  assert.deepEqual(right.map(event => event.properties.product_id), ['OTHER']);
  trackers.left.destroy();
  roots[0].querySelector('button').click(); roots[1].querySelector('button').click();
  assert.deepEqual([left.length, right.length], [1, 2]);
});

test('configuration precedence: per-event replaces a full field definition, and final-name/manual values win', (t) => {
  const document = fixture(t, '<section data-track-root data-track-total="10"><button data-track-event="required">Go</button></section>');
  const tracker = createTracker({
    root: document,
    schema: { amount: { type: 'number', attribute: 'data-track-total', required: true } },
    events: { optional: { amount: 'string' } },
    receivers: [],
  });
  assert.equal(tracker.track('required'), false);
  assert.deepEqual(tracker.track('optional').properties, {});
  const changed = tracker.trackElement(document.querySelector('button'), { name: 'optional', trigger: 'manual', properties: { amount: 'override' } });
  assert.deepEqual(changed, { name: 'optional', trigger: 'manual', properties: { amount: 'override', total: '10' } });
  // The optional replacement did not retain either required:true or the old data-track-total alias.
  assert.equal(tracker.inspect(document.querySelector('button')).event.properties.amount, 10);
});

test('ambiguous aliases on the same element block delivery in either attribute order, even with a manual override', (t) => {
  const sent = [], diagnostics = [];
  for (const attributes of ['data-track-sku="A" data-track-item-id="B"', 'data-track-item-id="B" data-track-sku="A"']) {
    const document = fixture(t, `<button data-track-root data-track-event="open" ${attributes}>Go</button>`);
    const tracker = createTracker({ root: document, schema: { item_id: { type: 'string', attribute: 'data-track-sku' } },
      receivers: [createCallbackReceiver({ name: 'log', send: event => { sent.push(event); } })], onDiagnostic: info => { diagnostics.push(info); } });
    const button = document.querySelector('button');
    const preview = tracker.inspect(button);
    assert.equal(preview.event, false);
    assert.equal(preview.issues.find(issue => issue.code === 'ambiguous-field').field, 'item_id');
    assert.deepEqual(preview.receivers, []);
    assert.equal(tracker.trackElement(button, { properties: { item_id: 'override' } }), false);
  }
  assert.equal(sent.length, 0);
  assert.equal(diagnostics.length, 2);
});

test('normalization collisions block once per field; the same field on ancestors remains nearest-wins', (t) => {
  const document = fixture(t, '<section data-track-root data-track-sku="parent"><button data-track-event="open" data-track-item-id="child">Go</button></section>');
  const tracker = createTracker({ root: document, schema: { item_id: { type: 'string', attribute: 'data-track-sku' } }, receivers: [] });
  const button = document.querySelector('button');
  assert.equal(tracker.inspect(button).event.properties.item_id, 'child');
  button.setAttribute('data-track-item_id', 'third');
  button.setAttribute('data-track-sku', 'fourth');
  const blocked = tracker.inspect(button);
  assert.equal(blocked.event, false);
  assert.equal(blocked.issues.filter(issue => issue.code === 'ambiguous-field').length, 1);
});

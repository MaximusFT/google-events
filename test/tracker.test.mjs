import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createTracker, createCallbackReceiver, createDataLayerReceiver } from '../dist/index.js';

function fixture(t, markup, config = {}) {
  const dom = new JSDOM(markup, { url: 'https://shop.example/' });
  const tracker = createTracker({ root: dom.window.document, ...config });
  t.after(() => { tracker.destroy(); dom.window.close(); });
  return { tracker, window: dom.window, document: dom.window.document, get events() { return dom.window.dataLayer ?? []; } };
}
const product = `<section data-track-root data-track-product-id="SKU-AbC" data-track-price="0" data-track-available="false">
  <div data-track-placement="title"><button data-track-event="favorite_add"><svg><path/></svg></button></div>
  <div data-track-placement="modal"><button data-track-event="favorite_add">Favorite</button></div>
  <div data-track-placement="footer"><button data-track-event="favorite_add">Favorite</button></div>
</section>`;
const schema = { product_id: { type: 'string', required: true }, price: 'number', available: 'boolean' };

test('neutral events preserve product identity and typed zero/false across three placements', (t) => {
  const f = fixture(t, product, { schema });
  f.tracker.start();
  f.document.querySelector('path').dispatchEvent(new f.window.MouseEvent('click', { bubbles: true }));
  for (const button of [...f.document.querySelectorAll('button')].slice(1)) button.click();
  assert.deepEqual(f.events.map((event) => event.properties.placement), ['title', 'modal', 'footer']);
  for (const event of f.events) assert.deepEqual(event, {
    name: 'favorite_add', trigger: 'click', properties: { product_id: 'SKU-AbC', price: 0, available: false, placement: event.properties.placement },
  });
});

test('inspect explains winning and overridden values, boundary, and selected receivers without sending', (t) => {
  let sends = 0;
  const f = fixture(t, '<main data-track-price="999"><section data-track-root data-track-price="10"><button data-track-event="buy" data-track-price="5">Buy</button></section></main>', {
    schema: { price: 'number' }, receivers: [
      createCallbackReceiver({ name: 'allowed', send: () => { sends++; } }),
      createCallbackReceiver({ name: 'blocked', filter: () => false, send: () => { sends++; } }),
    ],
  });
  const button = f.document.querySelector('button');
  const inspected = f.tracker.inspect(button);
  assert.equal(inspected.event.properties.price, 5);
  assert.equal(inspected.action, button);
  assert.equal(inspected.boundary, f.document.querySelector('section'));
  assert.equal(inspected.fields.price.element, button);
  assert.equal(inspected.fields.price.raw, '5');
  assert.equal(inspected.fields.price.value, 5);
  assert.deepEqual(inspected.fields.price.overridden.map((source) => source.raw), ['10']);
  assert.deepEqual(inspected.receivers, [{ name: 'allowed', selected: true }, { name: 'blocked', selected: false }]);
  assert.equal(sends, 0);
  assert.equal(f.events.length, 0);
});

test('optional invalid fields are omitted with diagnostics; required failures block the event', (t) => {
  const diagnostics = [];
  const f = fixture(t, product, { schema, onDiagnostic: (info) => diagnostics.push(info) });
  const button = f.document.querySelector('button');
  button.setAttribute('data-track-price', 'NaN');
  const event = f.tracker.trackElement(button);
  assert.equal(event.properties.price, undefined);
  assert.equal(diagnostics[0].issues[0].blocking, false);
  button.setAttribute('data-track-product-id', '');
  assert.equal(f.tracker.trackElement(button), false);
  assert.equal(f.events.length, 1);
  assert.equal(f.tracker.inspect(button).fields.product_id.raw, '');
  assert.equal(f.tracker.inspect(button).fields.product_id.overridden[0].raw, 'SKU-AbC');
});

test('empty optional strings, false and zero differ from absent required fields', () => {
  const received = [];
  const tracker = createTracker({ schema: { id: { type: 'string', required: true }, n: 'number', flag: 'boolean', note: 'string' },
    receivers: [createCallbackReceiver({ name: 'callback', send: (event) => { received.push(event); } })] });
  assert.equal(tracker.track('event', { n: 0, flag: false }), false);
  assert.deepEqual(tracker.track('event', { id: 'Case', n: '0', flag: 'false', note: '' }), {
    name: 'event', trigger: 'manual', properties: { id: 'Case', n: 0, flag: false, note: '' },
  });
  assert.equal(received.length, 1);
});

test('number and boolean parsing rejects partial, infinite, blank and ambiguous values', () => {
  const tracker = createTracker({ schema: { n: 'number', flag: 'boolean' }, receivers: [] });
  for (const n of ['12EUR', 'Infinity', '', ' ', '0x10', Infinity, NaN]) {
    assert.equal(tracker.track('event', { n }).properties.n, undefined);
  }
  for (const flag of ['yes', '1', '', 'False']) assert.equal(tracker.track('event', { flag }).properties.flag, undefined);
  assert.equal(tracker.track('event', { n: '-1.25e2', flag: 'true' }).properties.n, -125);
});

test('per-event schema can require checkout fields without blocking unrelated actions', () => {
  const tracker = createTracker({ events: { purchase: { amount: { type: 'number', required: true } } }, receivers: [] });
  assert.equal(tracker.track('browse', {}).name, 'browse');
  assert.equal(tracker.track('purchase', {}), false);
  assert.equal(tracker.track('purchase', { amount: '12.5' }).properties.amount, 12.5);
});

test('schema can map a full attribute to a camelCase property without duplicate keys', (t) => {
  const f = fixture(t, product, { schema: { productId: { type: 'string', attribute: 'data-track-product-id' } } });
  const inspected = f.tracker.inspect(f.document.querySelector('button'));
  assert.equal(inspected.event.properties.productId, 'SKU-AbC');
  assert.equal(inspected.event.properties.product_id, undefined);
});

test('nested roots, off and configured root enforce isolation', (t) => {
  const f = fixture(t, '<main data-track-secret="outside"><section id="app" data-track-root data-track-secret="parent"><div data-track-root><button data-track-event="inner">Go</button></div><div data-track-off><button data-track-event="off">Off</button></div></section><button id="outside" data-track-event="outside">Outside</button></main>');
  f.tracker.start(f.document.getElementById('app'));
  for (const button of f.document.querySelectorAll('button')) button.click();
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].properties.secret, undefined);
  assert.equal(f.tracker.inspect(f.document.getElementById('outside')).issues[0].code, 'outside-root');
  assert.equal(f.tracker.trackElement(f.document.querySelector('[data-track-event="off"]')), false);
});

test('explicit actions, root on action, nested actions and current DOM data determine tracking', (t) => {
  const f = fixture(t, '<section data-track-root><button>Unmarked</button><div data-track-event="parent"><button data-track-event="child">Child</button></div></section><button data-track-root data-track-event="self" data-track-count="1">Self</button>');
  f.tracker.start();
  for (const button of f.document.querySelectorAll('button')) button.click();
  assert.deepEqual(f.events.map((event) => event.name), ['child', 'self']);
  const button = f.document.querySelector('[data-track-event="self"]');
  button.setAttribute('data-track-count', '2');
  button.click();
  assert.equal(f.events[2].properties.count, '2');
});

test('start is idempotent, stop/destroy remove listeners, dynamic elements work after restart', (t) => {
  const f = fixture(t, '<section data-track-root><button data-track-event="click">Go</button></section>');
  f.tracker.start(); f.tracker.start();
  f.document.querySelector('button').click();
  assert.equal(f.events.length, 1);
  f.tracker.stop();
  f.document.querySelector('button').click();
  assert.equal(f.events.length, 1);
  f.tracker.start();
  f.document.querySelector('section').insertAdjacentHTML('beforeend', '<button data-track-event="dynamic">New</button>');
  f.document.querySelector('[data-track-event="dynamic"]').click();
  f.tracker.destroy();
  f.document.querySelector('button').click();
  assert.deepEqual(f.events.map((event) => event.name), ['click', 'dynamic']);
});

test('change, submit and manual triggers are explicit and form values are never harvested', (t) => {
  const f = fixture(t, '<section data-track-root><input type="checkbox" data-track-event="change" data-track-trigger="change" value="private"><form data-track-event="submit" data-track-trigger="submit"><input value="private"><button>Submit</button></form><button type="button" data-track-event="manual" data-track-trigger="manual">Manual</button></section>');
  f.tracker.start();
  const input = f.document.querySelector('input');
  input.click(); input.click();
  const form = f.document.querySelector('form');
  form.dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true }));
  f.document.querySelector('[data-track-event="manual"]').click();
  assert.deepEqual(f.events.map((event) => event.trigger), ['change', 'change', 'submit']);
  assert.deepEqual(f.events.map((event) => event.properties), [{}, {}, {}]);
  assert.equal(f.tracker.trackElement(f.document.querySelector('[data-track-event="manual"]')).trigger, 'manual');
});

test('manual overrides share validation and can reuse a snapshot after DOM removal', (t) => {
  const f = fixture(t, product, { schema });
  const button = f.document.querySelector('button');
  const snapshot = f.tracker.inspect(button).event;
  assert.equal(f.tracker.trackElement(button, { name: 'favorite_added', trigger: 'manual', properties: { price: 12.5 } }).properties.price, 12.5);
  button.remove();
  assert.equal(f.tracker.track('favorite_added', snapshot.properties).properties.product_id, 'SKU-AbC');
});

test('open shadow DOM and slotted actions use their host context', (t) => {
  const f = fixture(t, '<section data-track-root data-track-placement="host"><div id="host"><button slot="action" data-track-event="slotted">Slot</button></div></section>');
  const shadow = f.document.getElementById('host').attachShadow({ mode: 'open' });
  shadow.innerHTML = '<div data-track-placement="shadow"><button data-track-event="inside">Inside</button><slot name="action"></slot></div>';
  f.tracker.start();
  shadow.querySelector('button').click();
  f.document.querySelector('button').click();
  assert.deepEqual(f.events.map((event) => event.properties.placement), ['shadow', 'shadow']);
});

test('neutral receivers isolate properties and inspect captures filter errors without sending', async (t) => {
  const received = [];
  const f = fixture(t, product, { receivers: [
    createCallbackReceiver({ name: 'mutating', send: (event) => { event.properties.product_id = 'changed'; } }),
    createCallbackReceiver({ name: 'copy', send: (event) => { received.push(event); } }),
    createCallbackReceiver({ name: 'blocked', filter: () => { throw new Error('filter'); }, send: () => assert.fail() }),
  ], onError: () => {} });
  const button = f.document.querySelector('button');
  const info = f.tracker.inspect(button);
  assert.equal(info.receivers[2].selected, false);
  assert.equal(info.receivers[2].error.message, 'filter');
  assert.equal(received.length, 0);
  f.tracker.trackElement(button);
  await f.tracker.flush();
  assert.equal(received[0].properties.product_id, 'SKU-AbC');
});

test('diagnostics are isolated from delivery and invalid schema is rejected at construction', (t) => {
  const f = fixture(t, product, { schema, onDiagnostic: (info) => { info.event.properties.product_id = 'mutated'; } });
  const button = f.document.querySelector('button');
  button.setAttribute('data-track-price', 'bad');
  assert.equal(f.tracker.trackElement(button).properties.product_id, 'SKU-AbC');
  assert.equal(f.events[0].properties.product_id, 'SKU-AbC');
  assert.throws(() => createTracker({ schema: { id: { type: 'string', attribute: 'data-track-event' } } }), /Invalid field/);
  assert.throws(() => createTracker({ schema: { one: { type: 'string', attribute: 'data-track-x' }, two: { type: 'string', attribute: 'data-track-x' } } }), /Duplicate field/);
});

test('SSR and manual-only trackers work without global browser objects', async () => {
  const received = [];
  const tracker = createTracker({ automatic: false, receivers: [createCallbackReceiver({ name: 'callback', send: async (event) => { received.push(event); } })] });
  assert.equal(tracker.start(), false);
  tracker.track('server', { count: 0, enabled: false });
  await tracker.flush();
  assert.equal(received[0].properties.enabled, false);
});

test('dataLayer can transform the neutral event into a provider-specific payload', (t) => {
  const f = fixture(t, product, { receivers: [createDataLayerReceiver({ transform: (event) => ({ event: event.name, item_id: event.properties.product_id }) })] });
  f.tracker.trackElement(f.document.querySelector('button'));
  assert.deepEqual(f.events, [{ event: 'favorite_add', item_id: 'SKU-AbC' }]);
});

test('event names, trigger values and action boundaries are validated', (t) => {
  const f = fixture(t, '<div data-track-event="outside"><section data-track-root><button id="unmarked">Unmarked</button><button id="empty" data-track-event="">Empty</button><button id="trigger" data-track-event="action" data-track-trigger="invalid">Invalid</button></section></div>');
  assert.equal(f.tracker.inspect(f.document.getElementById('unmarked')).issues[0].code, 'missing-action');
  assert.equal(f.tracker.inspect(f.document.getElementById('empty')).issues[0].code, 'missing-event');
  assert.equal(f.tracker.inspect(f.document.getElementById('trigger')).issues[0].code, 'invalid-trigger');
  assert.equal(f.tracker.track('', {}), false);
  assert.equal(f.events.length, 0);
});

test('capture retains context before action removal, survives stopPropagation and cleans up listeners', (t) => {
  const f = fixture(t, product, { capture: true });
  const button = f.document.querySelector('button');
  button.addEventListener('click', (event) => { event.stopPropagation(); button.remove(); });
  f.tracker.start();
  f.tracker.start();
  button.click();
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].properties.product_id, 'SKU-AbC');
  f.document.querySelector('[data-track-root]').append(button);
  f.tracker.stop();
  button.click();
  assert.equal(f.events.length, 1);
  f.document.querySelector('[data-track-root]').append(button);
  f.tracker.start();
  button.click();
  assert.equal(f.events.length, 2);
  f.document.querySelector('[data-track-root]').append(button);
  f.tracker.destroy();
  button.click();
  assert.equal(f.events.length, 2);
});

test('bubble remains default and respects stopPropagation', (t) => {
  const f = fixture(t, product);
  f.tracker.start();
  f.document.querySelector('button').addEventListener('click', (event) => event.stopPropagation());
  f.document.querySelector('button').click();
  assert.equal(f.events.length, 0);
});

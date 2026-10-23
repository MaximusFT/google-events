import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import googleEvents, { createGoogleEvents } from '../dist/index.js';

function fixture(t, markup) {
  const dom = new JSDOM(markup, { url: 'https://shop.example/products/SKU-AbC' });
  const tracker = createGoogleEvents();
  const { document } = dom.window;
  t.after(() => { tracker.destroy(); dom.window.close(); });
  return { tracker, document, window: dom.window, get events() { return dom.window.dataLayer ?? []; } };
}

test('three buttons inherit one product and their own placement, without leaking outer context', (t) => {
  const f = fixture(t, `
    <main data-gtm-document-type="outside" data-ecomm-product-brand="outside">
      <section data-gtm-event data-ecomm-product-id="SKU-AbC" data-ecomm-product-name="Product Case"
               data-ecomm-product-sale-price="0" data-gtm-category="Shoes">
        <div data-gtm-link-place="title"><button data-event="Favorite_Add" data-ecomm-event-name="add"><svg><path/></svg></button></div>
        <div data-gtm-link-place="modal"><button data-event="Favorite_Add" data-ecomm-event-name="add">Favorite</button></div>
        <div data-gtm-link-place="footer"><button data-event="Favorite_Add" data-ecomm-event-name="add">Favorite</button></div>
      </section>
    </main>`);
  f.tracker.init({ root: f.document, tags: { category: 'category' } });
  f.document.querySelector('path').dispatchEvent(new f.window.MouseEvent('click', { bubbles: true }));
  for (const button of [...f.document.querySelectorAll('button')].slice(1)) button.click();
  assert.equal(f.events.length, 3);
  assert.deepEqual(f.events.map((event) => event.data['link-place']), ['title', 'modal', 'footer']);
  for (const event of f.events) {
    assert.equal(event.event, 'Favorite_Add');
    assert.equal(event.ecommerce['product-id'], 'SKU-AbC');
    assert.equal(event.ecommerce['product-name'], 'Product Case');
    assert.equal(event.ecommerce['product-sale-price'], '0');
    assert.equal(event.ecommerce['product-brand'], undefined);
    assert.equal(event.data['document-type'], undefined);
    assert.equal(event.data.category, 'Shoes');
  }
});

test('nearest custom data wins, aliases read the source attribute and values update between clicks', (t) => {
  const f = fixture(t, '<section data-gtm-event data-gtm-product-id="outer"><div data-gtm-product-id="inner"><button>Go</button></div></section>');
  f.tracker.init({ root: f.document, tags: { product: 'product-id' } });
  const button = f.document.querySelector('button');
  button.click();
  assert.equal(f.events[0].data.product, 'inner');
  button.setAttribute('data-gtm-product-id', 'SKU-New');
  button.click();
  assert.equal(f.events[1].data.product, 'SKU-New');
});

test('empty hierarchy boundary stops collection and includes its own data', (t) => {
  const f = fixture(t, '<section data-gtm-event data-gtm-component-name="outside"><div data-gtm-component-name-root="" data-gtm-component-name="inside"><button data-gtm-component-name="button">Go</button></div></section>');
  const button = f.document.querySelector('button');
  const root = f.document.querySelector('section');
  assert.equal(f.tracker.findInParents(button, root, 'data-gtm-component-name'), 'inside > button');
  assert.equal(f.tracker.findInParents(root, root, 'data-gtm-component-name'), 'outside');
  assert.doesNotThrow(() => f.tracker.findInParents(button, f.document.documentElement, 'data-missing'));
  assert.equal(f.tracker.getParentElement(f.document.documentElement), null);
});

test('nested scopes isolate all fields, including ecommerce', (t) => {
  const f = fixture(t, '<section data-gtm-event data-gtm-category="outer" data-ecomm-product-id="outer"><div data-gtm-event><button data-ecomm-event-name="add">Go</button></div></section>');
  f.tracker.init({ root: f.document, tags: { category: 'category' } });
  f.document.querySelector('button').click();
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].data.category, undefined);
  assert.equal(f.events[0].ecommerce['product-id'], undefined);
});

test('normalization preserves zero, false, numbers, arrays and string case', () => {
  const source = { quantity: 0, available: false, price: 12.5, id: 'SKU-AbC', empty: '', absent: null,
    nested: { flag: false }, items: [0, false, '', null, { name: 'Case' }] };
  assert.deepEqual(googleEvents.removeEmptyAndLowerCase(source), {
    quantity: 0, available: false, price: 12.5, id: 'SKU-AbC', nested: { flag: false }, items: [0, false, { name: 'Case' }],
  });
  assert.equal(source.items.length, 5);
});

test('reinit sends once, destroy removes listeners, restarting handles dynamic buttons', (t) => {
  const f = fixture(t, '<section data-gtm-event><button>Go</button></section>');
  f.tracker.init({ root: f.document });
  f.tracker.init({ root: f.document });
  f.document.querySelector('button').click();
  assert.equal(f.events.length, 1);
  f.tracker.destroy();
  f.document.querySelector('button').click();
  assert.equal(f.events.length, 1);
  f.tracker.init({ root: f.document });
  const button = f.document.createElement('button');
  button.textContent = 'New';
  f.document.querySelector('section').append(button);
  button.click();
  assert.equal(f.events.length, 2);
});

test('checkbox and radio remain enabled after repeated interactions', (t) => {
  const f = fixture(t, '<section data-gtm-event><input type="checkbox" data-gtm-link-label="Choice"><input type="radio"></section>');
  f.tracker.init({ root: f.document });
  const [checkbox, radio] = f.document.querySelectorAll('input');
  checkbox.click(); checkbox.click(); radio.click(); radio.click();
  assert.equal(f.events.length, 4);
  assert.deepEqual(f.events.slice(0, 2).map((event) => event.data['link-type']), ['checkbox checked', 'checkbox unchecked']);
  assert.equal(checkbox.hasAttribute('data-gtm-off'), false);
  assert.equal(radio.hasAttribute('data-gtm-off'), false);
});

test('off on an ancestor suppresses actions; scope marker can itself be a button', (t) => {
  const f = fixture(t, '<section data-gtm-event><div data-gtm-off=""><button>Off</button></div></section><button data-gtm-event data-event="Self">Self</button>');
  f.tracker.init({ root: f.document });
  for (const button of f.document.querySelectorAll('button')) button.click();
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].event, 'Self');
});

test('missing linked search field does not throw or emit an invalid event', (t) => {
  const f = fixture(t, '<section data-gtm-event><button data-gtm-add-details-search="missing:id">Search</button></section>');
  assert.equal(f.tracker.trackElement(f.document.querySelector('button')), false);
  assert.equal(f.events.length, 0);
});

test('relative URLs preserve case and external URLs retain their full address', (t) => {
  const f = fixture(t, '<section data-gtm-event><a href="/Products/SKU-AbC?Token=AbC#Details">Local</a><a href="https://other.example/Case?Token=AbC">External</a><a href="https://shop.example.evil/Case">Other origin</a></section>');
  for (const link of f.document.querySelectorAll('a')) f.tracker.trackElement(link);
  assert.deepEqual(f.events.map((event) => event.data['link-url']), [
    '/Products/SKU-AbC?Token=AbC#Details', 'https://other.example/Case?Token=AbC', 'https://shop.example.evil/Case',
  ]);
});

test('manual mode sends only on explicit calls, and instance settings are isolated', (t) => {
  const f = fixture(t, '<section data-gtm-event data-gtm-custom="Value"><button>Go</button></section>');
  f.tracker.init({ root: f.document, automatic: false, tags: { custom: 'custom' } });
  const button = f.document.querySelector('button');
  button.click();
  assert.equal(f.events.length, 0);
  f.tracker.trackElement(button);
  assert.equal(f.events[0].data.custom, 'Value');
  const other = createGoogleEvents();
  assert.equal(other.trackElement(button).data.custom, undefined);
});

test('configured subtree cannot use a scope or context from outside it', (t) => {
  const f = fixture(t, '<main data-gtm-event data-gtm-category="outside"><div id="scope"><button>Ignore</button><section data-gtm-event><button>Track</button></section></div><button>Outside</button></main>');
  f.tracker.init({ root: f.document.getElementById('scope'), tags: { category: 'category' } });
  for (const button of f.document.querySelectorAll('button')) button.click();
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].data.category, undefined);
});

test('open shadow roots and slotted buttons inherit host context without crashing', (t) => {
  const f = fixture(t, '<section data-gtm-event data-gtm-link-place="host"><div id="host"><button slot="action">Slotted</button></div></section>');
  const shadow = f.document.getElementById('host').attachShadow({ mode: 'open' });
  shadow.innerHTML = '<div data-gtm-link-place="shadow"><button>Inside</button><slot name="action"></slot></div>';
  f.tracker.init({ root: f.document });
  shadow.querySelector('button').click();
  f.document.querySelector('button').click();
  assert.equal(f.events.length, 2);
  assert.deepEqual(f.events.map((event) => event.data['link-place']), ['shadow', 'shadow']);
});

test('select uses change and repeated field edits are not disabled', (t) => {
  const f = fixture(t, '<section data-gtm-event><select><option>A</option><option>B</option></select><input value="First"></section>');
  f.tracker.init({ root: f.document });
  const select = f.document.querySelector('select');
  select.dispatchEvent(new f.window.Event('change', { bubbles: true }));
  select.dispatchEvent(new f.window.FocusEvent('focusout', { bubbles: true }));
  const input = f.document.querySelector('input');
  input.dispatchEvent(new f.window.FocusEvent('focusout', { bubbles: true }));
  input.value = 'Second';
  input.dispatchEvent(new f.window.FocusEvent('focusout', { bubbles: true }));
  assert.deepEqual(f.events.map((event) => event.action), ['change', 'focusout', 'focusout']);
});

test('ESM and CommonJS entry points load without browser globals', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const entry of [pkg.main, pkg.module, pkg.types]) assert.ok(existsSync(new URL('../' + entry, import.meta.url)));
  const require = createRequire(import.meta.url);
  assert.equal(typeof require('../dist/index.cjs').createGoogleEvents, 'function');
  const output = execFileSync(process.execPath, ['--input-type=module', '-e',
    "import tracker from '@maximusft/google-events'; console.log(tracker.init());"], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(output.trim(), 'false');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as library from '../dist/index.js';

test('the actual demo displays both deliveries, reports a callback failure and clears its panels', async (t) => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://demo.example/', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  dom.window.demoLibrary = library;
  const script = document.querySelector('script[type="module"]').textContent;
  // Execute the demo's own code using the built library rather than Vite's module URL.
  const importStatement = "import { createGoogleEvents, createDataLayerReceiver, createCallbackReceiver } from '/src/index.ts';";
  assert.ok(script.includes(importStatement));
  dom.window.eval(script.replace(importStatement, 'const { createGoogleEvents, createDataLayerReceiver, createCallbackReceiver } = window.demoLibrary;'));

  const button = document.querySelector('[data-event="favorite_add"]');
  button.click();
  await Promise.resolve();
  const panel = (id) => JSON.parse(document.getElementById(id).textContent);
  assert.equal(panel('output')[0].ecommerce['product-id'], 'SKU-AbC');
  assert.deepEqual(panel('callback-output'), [{ name: 'favorite_add', properties: { productId: 'SKU-AbC', placement: 'title' } }]);

  document.getElementById('simulate-error').checked = true;
  button.click();
  await Promise.resolve();
  assert.equal(panel('output').length, 2);
  assert.equal(panel('callback-output').length, 1);
  assert.equal(panel('errors')[0].receiver, 'custom-analytics');

  document.getElementById('clear').click();
  await Promise.resolve();
  assert.equal(document.getElementById('output').textContent, 'Пока нет событий.');
  assert.equal(document.getElementById('callback-output').textContent, 'Пока нет событий.');
  assert.equal(document.getElementById('errors').textContent, 'Ошибок нет.');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createTracker, createCallbackReceiver } from '../dist/index.js';

// Expected payloads are authored in the specification, independent of the collector implementation.
const specification = readFileSync(new URL('../docs/CONTRACT.md', import.meta.url), 'utf8');
const examples = [...specification.matchAll(/^### (C\d+)\. ([^\r\n]+)([\s\S]*?)(?=^### C\d+\.|^## 6\.)/gm)];
assert.equal(examples.length, 8, 'All eight contract examples must remain executable');

for (const [, id, title, body] of examples) {
  test(`contract ${id}: ${title}`, (t) => {
    const html = body.match(/```html\r?\n([\s\S]*?)\r?\n```/)[1];
    const expected = JSON.parse(body.match(/```json\r?\n([\s\S]*?)\r?\n```/)[1]);
    const dom = new JSDOM(html);
    const tracker = createTracker({ root: dom.window.document, schema: { price: 'number', available: 'boolean' }, receivers: [] });
    t.after(() => { tracker.destroy(); dom.window.close(); });
    const info = tracker.inspect(dom.window.document.querySelector('#target'));
    assert.deepEqual({ event: info.event, issues: info.issues.map(({ code, field, blocking }) => ({ code, ...(field === undefined ? {} : { field }), blocking })) }, expected);
  });
}

test('contract: an unmarked area collects up to the configured root including its data', (t) => {
  const dom = new JSDOM('<main data-track-secret="outside"><section id="app" data-track-placement="app"><button data-track-event="open">Open</button></section></main>');
  const tracker = createTracker({ root: dom.window.document.querySelector('#app'), receivers: [] });
  t.after(() => { tracker.destroy(); dom.window.close(); });
  assert.deepEqual(tracker.inspect(dom.window.document.querySelector('button')).event, {
    name: 'open', trigger: 'click', properties: { placement: 'app' },
  });
});

test('contract: overlapping independent trackers each deliver the same click to their own receiver', (t) => {
  const dom = new JSDOM('<section data-track-root><button data-track-event="open">Open</button></section>');
  const received = [[], []];
  const trackers = received.map((events, index) => createTracker({
    root: index === 0 ? dom.window.document : dom.window.document.querySelector('section'),
    receivers: [createCallbackReceiver({ name: `receiver-${index}`, send: (event) => { events.push(event); } })],
  }));
  t.after(() => { trackers.forEach((tracker) => tracker.destroy()); dom.window.close(); });
  trackers.forEach((tracker) => tracker.start());
  dom.window.document.querySelector('button').click();
  assert.deepEqual(received.map((events) => events.length), [1, 1]);
  assert.deepEqual(received[0][0], received[1][0]);
});

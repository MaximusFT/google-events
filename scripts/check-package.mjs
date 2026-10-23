import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('..', import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run this check through npm run test:package');
const tempBase = resolve(tmpdir());
const taskDir = mkdtempSync(join(tempBase, 'google-events-package-'));
const consumer = join(taskDir, 'consumer');
const run = (args, cwd) => execFileSync(process.execPath, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

try {
  const [packed] = JSON.parse(run([npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', taskDir], workspace));
  assert.deepEqual(packed.files.map((file) => file.path).sort(), [
    'LICENSE', 'README.md', 'CHANGELOG.md', 'docs/CONTRACT.md', 'docs/LEGACY.md', 'docs/MIGRATION.md', 'docs/RELEASE.md', 'docs/SITE_PILOT.md',
    'docs/index.md', 'docs/getting-started.md', 'docs/DOCUMENTATION_PLAN.md', 'docs/ARCHITECTURE.md', 'docs/CONFIGURATION.md',
    'docs/integrations/README.md', 'docs/integrations/TEMPLATE.md',
    'docs/integrations/ga4.md', 'docs/integrations/gtm.md', 'docs/integrations/umami.md',
    'docs/integrations/plausible.md', 'docs/integrations/posthog.md', 'docs/integrations/mixpanel.md',
    'docs/integrations/amplitude.md', 'docs/integrations/matomo.md',
    'examples/react/ProductCard.tsx', 'examples/react/main.tsx', 'examples/configuration.mjs', 'package.json', 'dist/index.js', 'dist/index.js.map',
    'dist/index.cjs', 'dist/index.cjs.map', 'dist/index.d.ts', 'dist/index.d.cts',
  ].sort());
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'package-consumer', private: true, type: 'module' }));
  run([npmCli, 'install', join(taskDir, packed.filename), '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], consumer);

  writeFileSync(join(consumer, 'smoke.mjs'), `
    import assert from 'node:assert/strict';
    import tracker, { createTracker, createGoogleEvents, createCallbackReceiver, createDataLayerReceiver } from '@maximusft/google-events';
    assert.equal(tracker.init(), false);
    assert.equal(typeof createGoogleEvents().destroy, 'function');
    assert.equal(typeof createCallbackReceiver({ name: 'callback', send() {} }).send, 'function');
    assert.equal(createDataLayerReceiver().name, 'dataLayer');
    const events = [];
    const neutral = createTracker({ receivers: [createCallbackReceiver({ name: 'neutral', send: (event) => { events.push(event); } })] });
    assert.equal(neutral.start(), false);
    assert.equal(neutral.track('smoke', { enabled: false }).properties.enabled, false);
    assert.equal(events.length, 1);
    const { createSingleReceiverTracker } = await import('./node_modules/@maximusft/google-events/examples/configuration.mjs');
    const exampleEvents = [];
    const example = createSingleReceiverTracker(undefined, (event) => { exampleEvents.push(event); });
    assert.equal(example.track('example', { product_id: 'Package', price: 0 }).properties.price, 0);
    assert.equal(exampleEvents.length, 1);
  `);
  writeFileSync(join(consumer, 'smoke.cjs'), `
    const assert = require('node:assert/strict');
    const { default: tracker, createTracker, createGoogleEvents, createCallbackReceiver, createDataLayerReceiver } = require('@maximusft/google-events');
    assert.equal(tracker.init(), false);
    assert.equal(typeof createGoogleEvents().destroy, 'function');
    assert.equal(typeof createCallbackReceiver({ name: 'callback', send() {} }).send, 'function');
    assert.equal(createDataLayerReceiver().name, 'dataLayer');
    const events = [];
    const neutral = createTracker({ receivers: [createCallbackReceiver({ name: 'neutral', send: (event) => { events.push(event); } })] });
    assert.equal(neutral.start(), false);
    assert.equal(neutral.track('smoke', { enabled: false }).properties.enabled, false);
    assert.equal(events.length, 1);
  `);
  run([join(consumer, 'smoke.mjs')], consumer);
  run([join(consumer, 'smoke.cjs')], consumer);

  const typeExample = `
    import tracker, { createGoogleEvents, createTracker, createCallbackReceiver, createDataLayerReceiver, type AnalyticsEvent, type TrackEvent, type TrackInspection } from '@maximusft/google-events';
    tracker.init({ automatic: false });
    const instance = createGoogleEvents();
    const result: AnalyticsEvent | false = instance.trackElement(document.createElement('button'));
    if (result) console.log(result.event);
    const callback = createCallbackReceiver({
      name: 'custom',
      transform: (event) => ({ name: event.event, length: event.event.length }),
      send: (payload) => { const count: number = payload.length; console.log(count); },
    });
    const typedTracker = createGoogleEvents({ receivers: [callback, createDataLayerReceiver()], onError: (failure) => { console.log(failure.receiver); } });
    const completion: Promise<void> = typedTracker.flush();
    void completion;
    const neutral = createTracker({
      schema: { price: { type: 'number', required: true } },
      receivers: [createDataLayerReceiver<TrackEvent>(), createCallbackReceiver<TrackEvent>({ name: 'neutral', send: (event) => { console.log(event.name); } })],
    });
    const inspection: TrackInspection = neutral.inspect(document.createElement('button'));
    const neutralEvent: TrackEvent | false = neutral.track('buy', { price: 0 });
    void inspection; void neutralEvent;
    // @ts-expect-error A legacy receiver cannot consume the neutral contract.
    createTracker({ receivers: [createCallbackReceiver<AnalyticsEvent>({ name: 'wrong', send() {} })] });
  `;
  writeFileSync(join(consumer, 'types.mts'), typeExample);
  writeFileSync(join(consumer, 'types.cts'), typeExample);
  run([join(workspace, 'node_modules/typescript/lib/tsc.js'), '--noEmit', '--strict',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2020',
    '--lib', 'ES2020,DOM', join(consumer, 'types.mts'), join(consumer, 'types.cts')], consumer);
  console.log('Package passed: exact contents, clean install, ESM/CJS imports and NodeNext types.');
} finally {
  // Verify the absolute target before recursively removing this check's temporary directory.
  assert.equal(dirname(resolve(taskDir)), tempBase);
  assert.ok(resolve(taskDir).startsWith(join(tempBase, 'google-events-package-')));
  rmSync(taskDir, { recursive: true, force: true });
}

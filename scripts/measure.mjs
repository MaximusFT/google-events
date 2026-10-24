import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { cpus, platform, arch, release } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const artifacts = ['index.js', 'index.cjs', 'track-events.global.js'].map(name => {
  const bytes = readFileSync(new URL(`dist/${name}`, root));
  return { name, bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length,
    sha256: createHash('sha256').update(bytes).digest('hex') };
});
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
let report;
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>DOM collection measurement</title>');
  await page.addScriptTag({ path: fileURLToPath(new URL('../dist/track-events.global.js', import.meta.url)) });
  const samples = await page.evaluate(() => {
    const warmup = 200, batches = 25, iterations = 200;
    return [12, 256].map(depth => {
      const root = document.createElement('section');
      root.setAttribute('data-track-root', '');
      root.setAttribute('data-track-price', '0');
      document.body.append(root);
      let parent = root;
      for (let level = 1; level < depth; level++) {
        const child = document.createElement('div');
        if (level % 4 === 0) child.setAttribute('data-track-placement', `level-${level}`);
        parent.append(child); parent = child;
      }
      const button = document.createElement('button');
      button.setAttribute('data-track-event', 'measure');
      parent.append(button);
      const tracker = TrackEvents.createTracker({ root, schema: { price: 'number' }, receivers: [] });
      const collect = () => {
        const event = tracker.trackElement(button);
        if (!event || event.properties.price !== 0) throw new Error('Invalid measurement fixture');
      };
      for (let index = 0; index < warmup; index++) collect();
      const batchMilliseconds = [];
      for (let batch = 0; batch < batches; batch++) {
        const start = performance.now();
        for (let index = 0; index < iterations; index++) collect();
        batchMilliseconds.push(performance.now() - start);
      }
      tracker.destroy(); root.remove();
      const sorted = batchMilliseconds.slice().sort((a, b) => a - b);
      return { ancestorElements: depth, warmup, batches, iterations,
        medianMillisecondsPerCall: sorted[Math.floor(sorted.length / 2)] / iterations,
        p95BatchMeanMillisecondsPerCall: sorted[Math.ceil(sorted.length * 0.95) - 1] / iterations,
        batchMilliseconds };
    });
  });
  report = { measuredAt: new Date().toISOString(), packageVersion: JSON.parse(readFileSync(new URL('package.json', root))).version,
    node: process.version, browser: browser.version(), os: `${platform()} ${release()} ${arch()}`,
    cpu: cpus()[0]?.model, method: 'Headless browser, trackElement(), receivers: [], no listeners/network; root + depth-1 divs, then action; price=0 at root, placement repeated every 4 levels; unminified bundles, gzip level 9, source maps excluded.',
    artifacts, samples };
} finally { await browser.close(); }
if (process.argv.includes('--write')) {
  const directory = new URL('../docs/benchmarks/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  writeFileSync(new URL('browser.json', directory), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));

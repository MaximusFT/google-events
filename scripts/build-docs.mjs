import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const website = resolve(root, 'website');
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run through npm run docs:build or docs:check');
const run = (args, cwd = root, env = process.env) => execFileSync(process.execPath, [npmCli, ...args], { cwd, env, stdio: 'inherit' });
run(['ci', '--no-audit', '--no-fund'], website);
run(['run', 'build']);
// Only generated, fixed children of website may be reset. Sources and library dist are preserved.
for (const name of ['content', 'public']) {
  const target = resolve(website, name);
  assert.equal(dirname(target), website);
  rmSync(target, { recursive: true, force: true });
}
const copy = (source, target) => { mkdirSync(dirname(target), { recursive: true }); cpSync(source, target, { recursive: true }); };
copy(resolve(root, 'docs'), resolve(website, 'content/docs'));
for (const name of ['README.md', 'PROJECT_PLAN.md', 'ROADMAP.md']) copy(resolve(root, name), resolve(website, 'content', name));
copy(resolve(website, 'index.md'), resolve(website, 'content/index.md'));
for (const path of ['examples/react/ProductCard.tsx', 'examples/angular/src/track-context.directive.ts', 'examples/angular/src/event-log.ts', 'examples/configuration.mjs', 'examples/browser', 'docs/benchmarks/browser.json']) copy(resolve(root, path), resolve(website, 'content/public', path));
for (const name of ['index.js', 'track-events.global.js']) copy(resolve(root, 'dist', name), resolve(website, 'content/public/dist', name));
const modes = process.argv.includes('--check') ? [
  { base: '/', output: 'dist' }, { base: '/relocated/project/', output: 'dist-subpath' },
] : [{ base: process.env.DOCS_BASE ?? '/', output: 'dist' }];
for (const { base, output } of modes) {
  // TSX examples are downloadable source files, not extensionless VitePress pages.
  run(['run', 'build'], website, { ...process.env, DOCS_BASE: base, DOCS_OUTPUT: output, VITE_EXTRA_EXTENSIONS: 'tsx' });
  writeFileSync(resolve(website, '.vitepress', output, 'build-info.json'), JSON.stringify({ base,
    apiVersion: JSON.parse(readFileSync(resolve(root, 'package.json'))).version, generator: 'vitepress@1.6.4' }) + '\n');
}
if (process.argv.includes('--check')) {
  execFileSync(process.execPath, [resolve(root, 'scripts/check-docs-links.mjs')], { cwd: root, stdio: 'inherit' });
  run(['exec', '--', 'playwright', 'test', '--config', 'playwright.docs.config.mjs']);
}

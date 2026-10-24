import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const example = fileURLToPath(new URL('../examples/angular/', import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run through npm run prepare:angular');
const tempBase = resolve(tmpdir());
const taskDir = mkdtempSync(join(tempBase, 'track-events-angular-'));
try {
  const run = (args, cwd, stdio = 'inherit') => execFileSync(process.execPath, [npmCli, ...args], { cwd, stdio, encoding: 'utf8' });
  run(['ci', '--no-audit', '--no-fund'], example);
  const [packed] = JSON.parse(run(['pack', '--ignore-scripts', '--json', '--pack-destination', taskDir], workspace, ['ignore', 'pipe', 'pipe']));
  // Install the consumer artifact, without a source alias/symlink or a volatile tarball in the lockfile.
  // npm 10's optional-peer resolver crashes on this Angular toolchain; use a scoped pinned npm, not a global upgrade.
  run(['exec', '--yes', '--package=npm@11.6.2', '--', 'npm', 'install', join(taskDir, packed.filename),
    '--no-save', '--package-lock=false', '--ignore-scripts', '--no-audit', '--no-fund'], example);
} finally {
  assert.equal(dirname(resolve(taskDir)), tempBase);
  assert.ok(resolve(taskDir).startsWith(join(tempBase, 'track-events-angular-')));
  rmSync(taskDir, { recursive: true, force: true });
}

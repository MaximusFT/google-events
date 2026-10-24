import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

for (const name of ['dist', 'dist-subpath']) {
  const root = fileURLToPath(new URL(`../website/.vitepress/${name}/`, import.meta.url));
  const { base } = JSON.parse(readFileSync(resolve(root, 'build-info.json')));
  const files = readdirSync(root, { recursive: true }).filter(file => file.endsWith('.html'));
  const ids = new Map();
  const read = path => {
    if (!ids.has(path)) {
      const dom = new JSDOM(readFileSync(path, 'utf8'));
      ids.set(path, new Set([...dom.window.document.querySelectorAll('[id]')].map(node => node.id)));
      dom.window.close();
    }
    return ids.get(path);
  };
  let checked = 0;
  for (const file of files) {
    // Downloadable standalone examples have their own base; audit the generated documentation pages here.
    if (file.startsWith(`examples${sep}`)) continue;
    const path = resolve(root, file);
    const document = new JSDOM(readFileSync(path, 'utf8')).window;
    const page = new URL(base + file.split(sep).join('/'), 'https://docs.invalid');
    for (const node of document.document.querySelectorAll('[href], [src]')) {
      const value = node.getAttribute('href') ?? node.getAttribute('src');
      if (!value || /^(?:https?:|mailto:|data:|tel:|javascript:)/.test(value)) continue;
      const url = new URL(value, page);
      if (url.origin !== page.origin) continue;
      assert.ok(url.pathname.startsWith(base), `${file}: link escapes base: ${value}`);
      const local = decodeURIComponent(url.pathname.slice(base.length));
      let target = resolve(root, local);
      if (url.pathname.endsWith('/')) target = resolve(target, 'index.html');
      else if (!existsSync(target) && existsSync(target + '.html')) target += '.html';
      assert.ok(target.startsWith(resolve(root) + sep), `Link outside output: ${value}`);
      assert.ok(existsSync(target), `${file}: missing target ${value} -> ${relative(root, target)}`);
      if (url.hash && target.endsWith('.html')) assert.ok(read(target).has(decodeURIComponent(url.hash.slice(1))), `${file}: missing anchor ${value}`);
      checked++;
    }
    document.close();
  }
  console.log(`Docs ${base}: ${files.length} HTML files; ${checked} local links/assets/anchors passed.`);
}

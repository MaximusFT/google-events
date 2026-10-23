import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../src', import.meta.url));
const allowed = {
  core: ['core'],
  dom: ['core', 'dom'],
  delivery: ['core', 'delivery'],
  adapters: ['core', 'delivery', 'adapters'],
  debug: ['core', 'dom', 'delivery', 'debug'],
  legacy: ['core', 'dom', 'delivery', 'adapters', 'legacy'],
};
const files = Object.keys(allowed).flatMap((domain) => readdirSync(join(root, domain), { recursive: true })
  .filter((file) => file.endsWith('.ts')).map((file) => join(root, domain, file)));

test('domain imports respect direction, contain no SDK dependencies and have no cycles', () => {
  const graph = new Map();
  for (const file of files) {
    const domain = relative(root, file).split(sep)[0];
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const targets = [];
    function inspect(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) specifier = node.arguments[0];
      if (specifier && ts.isStringLiteral(specifier)) {
        const name = specifier.text;
        assert.ok(name.startsWith('.'), `${relative(root, file)} imports external dependency ${name}`);
        const target = resolve(dirname(file), name.replace(/\.js$/, '.ts'));
        assert.ok(existsSync(target), `Missing module: ${name}`);
        assert.ok(allowed[domain].includes(relative(root, target).split(sep)[0]), `${relative(root, file)} violates its domain boundary: ${name}`);
        targets.push(target);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
    graph.set(file, targets);
  }
  const complete = new Set();
  const active = new Set();
  function visit(file) {
    assert.ok(!active.has(file), `Circular domain dependency: ${relative(root, file)}`);
    if (complete.has(file)) return;
    active.add(file);
    for (const target of graph.get(file) ?? []) visit(target);
    active.delete(file);
    complete.add(file);
  }
  for (const file of files) visit(file);
});

test('core contains no DOM globals or node types', () => {
  const browserNames = new Set(['window', 'document', 'Element', 'Document', 'Node', 'ShadowRoot', 'HTMLElement']);
  for (const file of files.filter((file) => relative(root, file).startsWith('core' + sep))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function inspect(node) {
      if (ts.isIdentifier(node)) assert.ok(!browserNames.has(node.text), `${relative(root, file)} uses DOM identifier ${node.text}`);
      ts.forEachChild(node, inspect);
    }
    inspect(source);
  }
});

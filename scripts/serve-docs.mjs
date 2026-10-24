import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../website/.vitepress/', import.meta.url));
const testMode = process.argv.includes('--check');
const rootInfo = JSON.parse(await readFile(resolve(directory, 'dist/build-info.json'), 'utf8'));
const mounts = testMode ? [{ base: '/relocated/project/', path: 'dist-subpath' }, { base: '/', path: 'dist' }] : [{ base: rootInfo.base, path: 'dist' }];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ts': 'text/plain; charset=utf-8', '.tsx': 'text/plain; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const mount = mounts.find(item => url.pathname.startsWith(item.base));
    if (!mount) { response.writeHead(404).end(); return; }
    const root = resolve(directory, mount.path);
    let path = resolve(root, decodeURIComponent(url.pathname.slice(mount.base.length)) || 'index.html');
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if ((await stat(path).catch(() => null))?.isDirectory()) path = resolve(path, 'index.html');
    else if (!extname(path)) path += '.html';
    response.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
}).listen(5190, '127.0.0.1', () => console.log(`Documentation preview: http://127.0.0.1:5190${rootInfo.base}`));

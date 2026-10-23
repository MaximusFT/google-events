import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.env.SITE_PILOT_DIR ?? fileURLToPath(new URL('../../ma-x.im-v3/out', import.meta.url)));
const port = Number(process.argv[2] ?? 5180);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };
createServer(async (request, response) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (path !== root && !path.startsWith(root + sep)) throw new Error('Outside export');
    let file = path;
    try {
      if ((await stat(file)).isDirectory()) {
        try { await stat(resolve(file, 'index.html')); file = resolve(file, 'index.html'); }
        catch { file += '.html'; }
      }
    }
    catch { file += '.html'; }
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Static site pilot: http://127.0.0.1:${port} (${root})`));

// A tiny static server for the frontend while building: `node serve.ts` (or --port 8787).
// It is not part of the entry — app/ is served by any static file server — it just saves
// typing `python3 -m http.server` when the frontend is opened from this repository.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./app/', import.meta.url));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = Number(portIndex === -1 ? process.env.PORT || 8080 : args[portIndex + 1]);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    const rel = normalize(path === '/' ? '/index.html' : path).replace(/^([/\\])+/, '');
    const file = join(root, rel);
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': types[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
}).listen(port, () => {
  console.log(`serving app/ at http://localhost:${port}`);
});
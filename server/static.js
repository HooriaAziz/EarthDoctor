import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { config } from './config.js';
const root = resolve(config.root, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
export async function serveStatic(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) return false;
  let path;
  try { path = resolve(root, '.' + decodeURIComponent(url.pathname)); } catch { return false; }
  if (!path.startsWith(root + sep) && path !== root) return false;
  if (path === root) path = resolve(root, 'index.html');
  try {
    const info = await stat(path);
    if (!info.isFile()) return false;
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end();
    else createReadStream(path).on('error', () => res.destroy()).pipe(res);
    return true;
  } catch { return false; }
}

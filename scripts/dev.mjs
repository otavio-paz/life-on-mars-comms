import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import config from '../api/config.js';
import auth from '../api/auth.js';
import messages from '../api/messages.js';
import { securityHeaders } from '../lib/security.js';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT || 4000);
const handlers = { config, auth, messages };
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain' };
const server = http.createServer(async (req, res) => {
  for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value);
  res.setHeader('Cache-Control', 'no-store');
  try {
    const path = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
    if (path.startsWith('/api/')) {
      const name = path.slice(5);
      if (!Object.hasOwn(handlers, name)) { res.writeHead(404); res.end(); return; }
      const handler = handlers[name];
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 50000) { res.writeHead(413); res.end(); return; } }
      try { req.body = body ? JSON.parse(body) : undefined; } catch { res.writeHead(400); res.end('{"error":"Invalid JSON"}'); return; }
      res.status = code => { res.statusCode = code; return res; }; res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
      await handler(req, res); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    // Serve only public Jekyll sources. Never expose .env, server code or database scripts.
    let file;
    if (path === '/' || path === '/index.html') file = resolve(root, 'index.html');
    else if (path === '/mission.json') file = resolve(root, '_data/mission.json');
    else if (path.startsWith('/assets/') && !path.split('/').some(p => p.startsWith('.') || p.includes('\\'))) file = resolve(root, `.${path}`);
    else { res.writeHead(404); res.end('Not found'); return; }
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    let content = await readFile(file);
    if (path === '/' || path === '/index.html') {
      const layout = await readFile(resolve(root, '_layouts/default.html'), 'utf8');
      // Local preview of this project's one layout. Production uses real Jekyll.
      content = Buffer.from(layout.replace('{{ content }}', content.toString().replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')));
    }
    res.setHeader('Content-Type', `${types[extname(file)] || 'application/octet-stream'}${/\.(html|css|js|json|svg)$/.test(file) ? '; charset=utf-8' : ''}`);
    res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : content);
  } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`DELAY local preview: http://localhost:${port}\nJekyll layout preview + local API. Unconfigured services run in demo mode.`));

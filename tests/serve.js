// Minimal static file server for the test suite (dev only, never deployed).
const http = require('http');
const fs = require('fs');
const path = require('path');

// RTR_SERVE_ROOT lets tests/mutate.js serve a mutated copy of the app instead of the repo
const ROOT = path.resolve(process.env.RTR_SERVE_ROOT || path.join(__dirname, '..'));
const PORT = Number(process.env.RTR_TEST_PORT || 4173);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'readytoroll.html' : url);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));

/**
 * Simple proxy server to bypass CORS for local development
 * Usage: node server.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=["']?(.+?)["']?$/);
    if (match) env[match[1].trim()] = match[2].trim();
  });
}

const PORT = 8888;
const API_BASE = 'https://usable.dev';

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve config with environment variables
  if (req.url === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      API_TOKEN: env.USABLE_API_TOKEN || '',
      WORKSPACE_ID: env.USABLE_WORKSPACE_ID || '',
      FRAGMENT_TYPE_ID: env.USABLE_FRAGMENT_TYPE_ID || ''
    }));
    return;
  }

  // Proxy API requests
  if (req.url.startsWith('/api/')) {
    proxyRequest(req, res);
    return;
  }

  // Serve static files
  serveStatic(req, res);
});

/**
 * Proxy requests to Usable.dev API
 */
function proxyRequest(req, res) {
  const targetUrl = new URL(req.url, API_BASE);
  
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const options = {
      hostname: targetUrl.hostname,
      port: 443,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || ''
      }
    };

    const proxyReq = https.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      console.error('Proxy error:', err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Proxy error' }));
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
}

/**
 * Serve static files
 */
function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath.split('?')[0]);
  
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

server.listen(PORT, () => {
  console.log(`
╭─────────────────────────────────────────╮
│  Usable Kanban Server                   │
├─────────────────────────────────────────┤
│  Local:  http://localhost:${PORT}          │
│  API:    ${API_BASE}/api (proxied)   │
╰─────────────────────────────────────────╯
`);
});

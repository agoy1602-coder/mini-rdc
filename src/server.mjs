import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { mcpHandler } from './mcp.mjs';
import { rgSearch } from './rg.mjs';
import { listDirectory, readTextFile, safePath } from './fs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const PORT = Number(process.env.MINI_RDC_PORT || 8787);
const HOST = process.env.MINI_RDC_HOST || '127.0.0.1';
const TOKEN = process.env.MINI_RDC_TOKEN || '';
const REQUEST_TIMEOUT_MS = 30_000;
const mcpNodeHandler = toNodeHandler(mcpHandler);

function authorized(req) {
  if (!TOKEN) return true;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {'content-type':'application/json; charset=utf-8'});
  res.end(body);
}

function run(command, args = []) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: process.env.HOME, shell: false });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function body(req) {
  let text = '';
  for await (const chunk of req) text += chunk;
  if (!text) return {};
  if (text.length > 65536) throw new Error('Request body too large');
  return JSON.parse(text);
}

async function request(req, res) {
  if (!authorized(req)) {
    res.setHeader('www-authenticate', 'Bearer');
    return json(res, 401, { error: 'Authentication required' });
  }
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname === '/mcp') return mcpNodeHandler(req, res);
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, name: 'mini-rdc', version: '0.4.0' });
  }
  if (req.method === 'GET' && url.pathname === '/api/system') {
    const rg = await run('rg', ['--version']);
    return json(res, 200, { node: process.version, rg: rg.stdout.split('\n')[0], platform: process.platform, arch: process.arch });
  }
  if (req.method === 'GET' && url.pathname === '/api/fs/list') {
    const input = url.searchParams.get('path') || '.';
    return json(res, 200, { path: input, entries: await listDirectory(input) });
  }
  if (req.method === 'GET' && url.pathname === '/api/fs/read') {
    const input = url.searchParams.get('path');
    return json(res, 200, { path: input, content: await readTextFile(input) });
  }
  if (req.method === 'POST' && url.pathname === '/api/search') {
    const input = await body(req);
    const target = safePath(input.path || '.');
    return json(res, 200, await rgSearch({ ...input, path: target }));
  }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = await readFile(path.join(WEB, 'index.html'));
    res.writeHead(200, {'content-type':'text/html; charset=utf-8'});
    return res.end(html);
  }
  if (req.method === 'GET' && url.pathname === '/app.js') {
    const js = await readFile(path.join(WEB, 'app.js'));
    res.writeHead(200, {'content-type':'text/javascript; charset=utf-8'});
    return res.end(js);
  }
  res.writeHead(404, {'content-type':'text/plain; charset=utf-8'});
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  req.setTimeout(REQUEST_TIMEOUT_MS, () => res.destroy());
  res.setHeader('x-content-type-options', 'nosniff');
  request(req, res).catch(error => json(res, 400, { error: error.message }));
});

server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = REQUEST_TIMEOUT_MS;
server.listen(PORT, HOST, () => console.log(`Mini-RDC listening at http://${HOST}:${PORT}`));

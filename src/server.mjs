import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const PORT = Number(process.env.MINI_RDC_PORT || 8787);
const HOST = process.env.MINI_RDC_HOST || '127.0.0.1';

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function run(command, args = []) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: process.env.HOME, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function request(req, res) {
  if (req.url === '/api/health') {
    return json(res, 200, { ok: true, name: 'mini-rdc', version: '0.1.0' });
  }
  if (req.url === '/api/system') {
    const node = process.version;
    const rg = await run('rg', ['--version']);
    return json(res, 200, { node, rg: rg.stdout.split('\n')[0], platform: process.platform, arch: process.arch });
  }
  if (req.url === '/' || req.url === '/index.html') {
    const body = await readFile(path.join(WEB, 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(body);
  }
  if (req.url === '/app.js') {
    const body = await readFile(path.join(WEB, 'app.js'));
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    return res.end(body);
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  request(req, res).catch((error) => json(res, 500, { error: error.message }));
});

server.listen(PORT, HOST, () => {
  console.log(`Mini-RDC listening at http://${HOST}:${PORT}`);
});

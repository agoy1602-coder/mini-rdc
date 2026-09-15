import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
function value(flag, fallback = '') {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
function has(flag) { return args.includes(flag); }

const port = Number(value('--port', process.env.MINI_RDC_PORT || '8787'));
const host = '127.0.0.1';
const token = process.env.MINI_RDC_TOKEN || randomBytes(24).toString('hex');
const named = has('--named');
const quick = !named && !has('--no-tunnel');
const tunnelToken = process.env.TUNNEL_TOKEN || '';

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Port must be an integer from 1024 to 65535');
}
if (!/^[A-Za-z0-9._~-]{16,256}$/.test(token)) {
  throw new Error('MINI_RDC_TOKEN must be 16-256 safe characters');
}
if (named && !tunnelToken) {
  throw new Error('Named tunnel requires TUNNEL_TOKEN in the environment');
}

const env = {
  ...process.env,
  MINI_RDC_HOST: host,
  MINI_RDC_PORT: String(port),
  MINI_RDC_TOKEN: token,
};

const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 750).unref();
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

const server = spawn(process.execPath, ['src/server.mjs'], {
  cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'],
});
children.push(server);
server.stdout.on('data', chunk => process.stdout.write(`[mini-rdc] ${chunk}`));
server.stderr.on('data', chunk => process.stderr.write(`[mini-rdc] ${chunk}`));
server.on('error', error => { console.error(`[mini-rdc] ${error.message}`); stop(1); });
server.on('exit', code => {
  if (!stopping) {
    console.error(`[mini-rdc] server exited with code ${code}`);
    stop(code || 1);
  }
});

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Mini-RDC did not start within 5 seconds')), 5000);
  server.stdout.on('data', chunk => {
    if (chunk.toString().includes('Mini-RDC listening')) {
      clearTimeout(timer);
      resolve();
    }
  });
});

console.log(`REMOTE_TOKEN=${token}`);
console.log(`LOCAL_URL=http://${host}:${port}`);

if (!quick && !named) {
  console.log('REMOTE_TUNNEL=disabled');
  await new Promise(() => {});
}

const tunnelArgs = named
  ? ['tunnel', '--no-autoupdate', 'run']
  : ['tunnel', '--url', `http://${host}:${port}`];
const tunnelEnv = named ? { ...env, TUNNEL_TOKEN: tunnelToken } : env;
const tunnel = spawn('cloudflared', tunnelArgs, {
  cwd: process.cwd(), env: tunnelEnv, stdio: ['ignore', 'pipe', 'pipe'],
});
children.push(tunnel);
let announced = false;

function tunnelOutput(chunk) {
  const text = chunk.toString();
  process.stdout.write(`[cloudflared] ${text}`);
  const match = text.match(/https:\/\/[-a-z0-9]+\.(?:trycloudflare\.com|[a-z0-9.-]+\.ts\.net)/i);
  if (match && !announced) {
    announced = true;
    console.log(`REMOTE_URL=${match[0]}`);
    console.log(`REMOTE_MCP_URL=${match[0]}/mcp`);
    console.log('Use REMOTE_TOKEN as Authorization: Bearer <token>.');
  }
}

tunnel.stdout.on('data', tunnelOutput);
tunnel.stderr.on('data', tunnelOutput);
tunnel.on('error', error => { console.error(`[cloudflared] ${error.message}`); stop(1); });
tunnel.on('exit', code => {
  if (!stopping) {
    console.error(`[cloudflared] exited with code ${code}`);
    stop(code || 1);
  }
});

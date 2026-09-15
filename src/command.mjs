import { spawn } from 'node:child_process';

const MAX_OUTPUT = 64 * 1024;
const DEFAULT_TIMEOUT = 10_000;
const MAX_TIMEOUT = 30_000;

const POLICIES = {
  pwd: args => args.length === 0,
  whoami: args => args.length === 0,
  uname: args => args.length === 1 && args[0] === '-a',
  df: args => args.length === 1 && args[0] === '-h',
  node: args => args.length === 1 && args[0] === '--version',
  npm: args => args.length === 1 && args[0] === '--version',
  python: args => args.length === 1 && args[0] === '--version',
  git: args => isSafeGit(args),
};

function isSafeGit(args) {
  if (args.length === 0) return false;
  const allowed = new Set(['status', 'log', 'diff', 'branch', 'rev-parse']);
  if (!allowed.has(args[0])) return false;
  if (args[0] === 'status') return args.every(a => ['status', '--short', '--branch'].includes(a));
  if (args[0] === 'log') return args.every(a => /^-([0-9]+)$/.test(a) || a === '--oneline' || a === '--decorate');
  if (args[0] === 'diff') return args.every(a => a === 'diff' || a === '--stat' || a === '--');
  if (args[0] === 'branch') return args.length === 2 && args[1] === '--show-current';
  return args.length === 2 && args[1] === '--show-toplevel';
}

function validate(command, args) {
  if (!POLICIES[command]) throw new Error(`Command is not allowed: ${command}`);
  if (!Array.isArray(args) || args.some(a => typeof a !== 'string')) throw new Error('args must be an array of strings');
  if (!POLICIES[command](args)) throw new Error(`Arguments are not allowed for: ${command}`);
}

export function runControlledCommand({ command, args = [], timeoutMs = DEFAULT_TIMEOUT }) {
  validate(command, args);
  const timeout = Math.min(Math.max(Number(timeoutMs) || DEFAULT_TIMEOUT, 100), MAX_TIMEOUT);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.env.HOME, shell: false });
    let stdout = '';
    let stderr = '';
    let truncated = false;
    const append = (target, chunk) => {
      const text = chunk.toString();
      const remaining = MAX_OUTPUT - stdout.length - stderr.length;
      if (remaining <= 0) { truncated = true; return target; }
      if (text.length > remaining) { truncated = true; return target + text.slice(0, remaining); }
      return target + text;
    };
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 500);
    }, timeout);
    child.on('error', reject);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ command, args, code, signal, stdout, stderr, truncated });
    });
  });
}

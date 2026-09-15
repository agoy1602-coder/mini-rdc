import { spawn } from 'node:child_process';

function runGit(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: process.env.HOME, shell: false });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

export async function gitStatus(input = '.') {
  const result = await runGit(['-C', input, 'status', '--short', '--branch']);
  if (result.code !== 0) throw new Error(result.stderr.trim() || 'git status failed');
  return { path: input, output: result.stdout };
}

export async function gitLog(input = '.', limit = 20) {
  const count = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const result = await runGit(['-C', input, 'log', `-${count}`, '--oneline', '--decorate']);
  if (result.code !== 0) throw new Error(result.stderr.trim() || 'git log failed');
  return { path: input, output: result.stdout };
}

export async function gitDiff(input = '.') {
  const result = await runGit(['-C', input, 'diff', '--stat', '--']);
  if (result.code !== 0) throw new Error(result.stderr.trim() || 'git diff failed');
  return { path: input, output: result.stdout };
}

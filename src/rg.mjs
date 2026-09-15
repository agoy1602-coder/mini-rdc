import { spawn } from 'node:child_process';

export function rgSearch({ pattern, path = process.env.HOME, glob, ignoreCase = false, context = 0, maxResults = 100 }) {
  return new Promise((resolve, reject) => {
    if (!pattern || typeof pattern !== 'string') return reject(new Error('pattern is required'));
    const args = ['--json', '--line-number', '--no-heading', '--color', 'never'];
    if (ignoreCase) args.push('-i');
    if (glob) args.push('--glob', glob);
    if (context > 0) args.push('-C', String(Math.min(context, 20)));
    args.push(pattern, path);
    const child = spawn('rg', args, { cwd: process.env.HOME, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code > 1) return reject(new Error(stderr.trim() || `rg exited with ${code}`));
      const results = [];
      for (const line of stdout.split('\n')) {
        if (!line) continue;
        try {
          const item = JSON.parse(line);
          if (item.type === 'match') results.push(item.data);
          if (results.length >= maxResults) break;
        } catch {}
      }
      resolve({ count: results.length, truncated: results.length >= maxResults, results });
    });
  });
}

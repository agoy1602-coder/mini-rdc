import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';

const HOME = path.resolve(process.env.HOME || '.');

export function safePath(input = '.') {
  const target = path.resolve(HOME, input);
  if (target !== HOME && !target.startsWith(`${HOME}${path.sep}`)) {
    throw new Error('Path is outside the Termux home directory');
  }
  return target;
}

export async function listDirectory(input = '.') {
  const target = safePath(input);
  const entries = await readdir(target, { withFileTypes: true });
  return entries.map(entry => ({
    name: entry.name,
    type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function readTextFile(input) {
  const target = safePath(input);
  const info = await stat(target);
  if (!info.isFile()) throw new Error('Path is not a file');
  if (info.size > 1024 * 1024) throw new Error('File exceeds 1 MiB read limit');
  return readFile(target, 'utf8');
}

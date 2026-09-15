import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { listDirectory, readTextFile, safePath } from './fs.mjs';
import { rgSearch } from './rg.mjs';
import { gitStatus, gitLog, gitDiff } from './git.mjs';

function text(value) { return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] }; }

export const mcpHandler = createMcpHandler(() => {
  const server = new McpServer({ name: 'mini-rdc', version: '0.3.0' });

  server.registerTool('fs_list', { description: 'List a safe directory inside Termux HOME.', inputSchema: z.object({ path: z.string().default('.') }) }, async ({ path }) => text(await listDirectory(path)));
  server.registerTool('fs_read', { description: 'Read a UTF-8 text file inside Termux HOME, limited to 1 MiB.', inputSchema: z.object({ path: z.string() }) }, async ({ path }) => text(await readTextFile(path)));
  server.registerTool('rg_search', { description: 'Search Termux HOME with ripgrep without a shell.', inputSchema: z.object({ pattern: z.string().min(1), path: z.string().default('.'), glob: z.string().optional(), ignoreCase: z.boolean().default(false), context: z.number().int().min(0).max(20).default(0), maxResults: z.number().int().min(1).max(100).default(100) }) }, async (input) => text(await rgSearch({ ...input, path: safePath(input.path) })));
  server.registerTool('git_status', { description: 'Show read-only Git status for a repository inside Termux HOME.', inputSchema: z.object({ path: z.string().default('.') }) }, async ({ path }) => text(await gitStatus(path)));
  server.registerTool('git_log', { description: 'Show recent read-only Git commits for a repository inside Termux HOME.', inputSchema: z.object({ path: z.string().default('.'), limit: z.number().int().min(1).max(50).default(20) }) }, async ({ path, limit }) => text(await gitLog(path, limit)));
  server.registerTool('git_diff', { description: 'Show a read-only Git diff summary for a repository inside Termux HOME.', inputSchema: z.object({ path: z.string().default('.') }) }, async ({ path }) => text(await gitDiff(path)));

  return server;
});

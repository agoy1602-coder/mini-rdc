import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const base = process.env.MINI_RDC_URL || 'http://127.0.0.1:8787';
const token = process.env.MINI_RDC_TOKEN || '';
const headers = token ? { Authorization: `Bearer ${token}` } : {};

async function http(path) {
  const r = await fetch(`${base}${path}`, { headers });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

const health = await http('/api/health');
if (!health.ok || health.name !== 'mini-rdc') throw new Error('health check failed');
console.log('HEALTH_OK');

const client = new Client({ name: 'mini-rdc-regression', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
  requestInit: { headers },
});
await client.connect(transport);
const tools = await client.listTools();
const names = tools.tools.map(tool => tool.name);
for (const name of ['fs_list', 'fs_read', 'rg_search', 'git_status', 'git_log', 'git_diff']) {
  if (!names.includes(name)) throw new Error(`missing tool: ${name}`);
}
console.log('TOOLS_OK');
const result = await client.callTool({ name: 'fs_list', arguments: { path: 'mini-rdc' } });
if (result.isError || result.content?.[0]?.type !== 'text') throw new Error('fs_list failed');
console.log('TOOL_CALL_OK');
await client.close();
console.log('REGRESSION_OK');

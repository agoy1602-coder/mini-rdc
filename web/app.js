const $ = (id) => document.querySelector(id);
const dot = $('#dot');
const status = $('#status');
const system = $('#system');
const files = $('#files');
const viewer = $('#viewer');
const viewerPath = $('#viewerPath');

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function refresh() {
  try {
    const [health, info] = await Promise.all([api('/api/health'), api('/api/system')]);
    dot.classList.add('ok');
    status.textContent = `${health.name} ${health.version} • connected`;
    system.textContent = [`Node: ${info.node}`, `ripgrep: ${info.rg}`, `Platform: ${info.platform}`, `Architecture: ${info.arch}`].join('\n');
    await loadFiles($('#path').value || '.');
    await loadGit();
  } catch (error) {
    dot.classList.remove('ok');
    status.textContent = `Connection error: ${error.message}`;
    system.textContent = '';
  }
}

async function loadFiles(path) {
  try {
    const data = await api(`/api/fs/list?path=${encodeURIComponent(path)}`);
    $('#path').value = data.path;
    $('#crumb').textContent = `Termux home / ${data.path}`;
    files.innerHTML = '';
    if (data.path !== '.') {
      const up = document.createElement('li');
      up.innerHTML = '<button>↩ Parent directory</button>';
      up.querySelector('button').onclick = () => loadFiles(parentPath(data.path));
      files.append(up);
    }
    for (const entry of data.entries) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = entry.type === 'directory' ? `📁 ${entry.name}` : `📄 ${entry.name}`;
      button.onclick = () => entry.type === 'directory' ? loadFiles(joinPath(data.path, entry.name)) : loadFile(joinPath(data.path, entry.name));
      li.append(button);
      files.append(li);
    }
  } catch (error) { files.innerHTML = `<li class="muted">${escapeHtml(error.message)}</li>`; }
}

function joinPath(base, name) { return base === '.' ? name : `${base}/${name}`; }
function parentPath(value) { const parts = value.split('/').filter(Boolean); parts.pop(); return parts.length ? parts.join('/') : '.'; }
function escapeHtml(value) { return value.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function loadFile(path) {
  try {
    const data = await api(`/api/fs/read?path=${encodeURIComponent(path)}`);
    viewerPath.textContent = data.path;
    viewer.textContent = data.content;
  } catch (error) { viewerPath.textContent = 'Read error'; viewer.textContent = error.message; }
}

async function loadGit() {
  const path = $('#gitPath').value || '.';
  try {
    const query = `?path=${encodeURIComponent(path)}`;
    const [statusData, logData, diffData] = await Promise.all([
      api(`/api/git/status${query}`),
      api(`/api/git/log${query}&limit=8`),
      api(`/api/git/diff${query}`),
    ]);
    $('#gitStatus').textContent = statusData.output || 'Working tree clean.';
    $('#gitLog').textContent = logData.output || 'No commits.';
    $('#gitDiff').textContent = diffData.output || 'No working-tree changes.';
  } catch (error) {
    $('#gitStatus').textContent = `Git error: ${error.message}`;
    $('#gitLog').textContent = '';
    $('#gitDiff').textContent = '';
  }
}

async function search() {
  const pattern = $('#pattern').value.trim();
  if (!pattern) return;
  $('#results').textContent = 'Searching…';
  try {
    const data = await api('/api/search', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ pattern, path:$('#searchPath').value || '.', maxResults:100 }) });
    $('#results').textContent = data.results.map((item) => `${item.path.text}:${item.line_number}: ${item.lines.text.trim()}`).join('\n') || 'No matches.';
  } catch (error) { $('#results').textContent = error.message; }
}

$('#refresh').addEventListener('click', refresh);
$('#go').addEventListener('click', () => loadFiles($('#path').value || '.'));
$('#search').addEventListener('click', search);
$('#gitRefresh').addEventListener('click', loadGit);
$('#pattern').addEventListener('keydown', (event) => { if (event.key === 'Enter') search(); });
refresh();
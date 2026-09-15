const dot = document.querySelector('#dot');
const status = document.querySelector('#status');
const system = document.querySelector('#system');

async function refresh() {
  try {
    const [health, info] = await Promise.all([
      fetch('/api/health').then((r) => r.json()),
      fetch('/api/system').then((r) => r.json()),
    ]);
    dot.classList.add('ok');
    status.textContent = `${health.name} ${health.version} • connected`;
    system.textContent = [
      `Node: ${info.node}`,
      `ripgrep: ${info.rg}`,
      `Platform: ${info.platform}`,
      `Architecture: ${info.arch}`,
    ].join('\n');
  } catch (error) {
    dot.classList.remove('ok');
    status.textContent = `Connection error: ${error.message}`;
    system.textContent = '';
  }
}

document.querySelector('#refresh').addEventListener('click', refresh);
refresh();

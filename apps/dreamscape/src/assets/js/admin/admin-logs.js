import { AdminAPI } from './admin-api.js';
import { formatDateTime } from './admin-utils.js';

async function loadLogs() {
  const tbody = document.getElementById('logs-table');
  tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Loading…</td></tr>`;
  try {
    const { logs } = await AdminAPI.getLogs();
    if (!logs.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No logs yet</td></tr>`;
      return;
    }
    tbody.innerHTML = logs.map(l => `
      <tr class="${l.error ? 'table-danger' : ''}">
        <td class="text-muted small">${formatDateTime(l.createdAt)}</td>
        <td><code>${l.action}</code></td>
        <td><span class="badge ${l.result === 200 ? 'bg-green-lt' : 'bg-red-lt'}">${l.result}</span></td>
        <td class="text-muted small">${l.error ? `<span class="text-danger">${l.error}</span>` : JSON.stringify(l.params || {})}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">${err.message}</td></tr>`;
  }
}

export function initLogsView() {
  document.getElementById('refresh-logs').addEventListener('click', loadLogs);
}

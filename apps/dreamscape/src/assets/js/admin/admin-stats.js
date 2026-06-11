import { AdminAPI } from './admin-api.js';
import { formatDate } from './admin-utils.js';

const MAIN_APP_URL = 'https://daily.habitualos.com';

function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function loadingRow(cols) {
  return `<tr><td colspan="${cols}" class="text-center text-muted py-3">
    <span class="loading-placeholder">Loading…</span>
  </td></tr>`;
}

function errorRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="text-center text-danger py-3">${msg}</td></tr>`;
}

async function loadUsers() {
  const tbody = document.getElementById('users-table');
  tbody.innerHTML = loadingRow(4);
  try {
    const { members } = await AdminAPI.getUsers();
    if (!members.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No users yet</td></tr>`;
      return;
    }
    tbody.innerHTML = members.map(m => `
      <tr>
        <td><strong>${m.name || '—'}</strong></td>
        <td><code class="text-muted">${m.userId}</code></td>
        <td>${m.lastPracticedAt ? formatDate(m.lastPracticedAt) : '—'}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary sign-in-as-btn" data-userid="${m.userId}">
            Sign in as…
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = errorRow(4, err.message);
  }
}

async function loadSessions() {
  const tbody = document.getElementById('sessions-table');
  tbody.innerHTML = loadingRow(5);
  try {
    const { sessions } = await AdminAPI.getSessions();
    if (!sessions.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No sessions yet</td></tr>`;
      return;
    }
    tbody.innerHTML = sessions.map(s => `
      <tr>
        <td>${s._name || s._userId}</td>
        <td>${formatDate(s.startedAt)}</td>
        <td>${formatDuration(s.duration)}</td>
        <td><span class="badge ${s.state === 'completed' ? 'bg-green-lt' : 'bg-yellow-lt'}">${s.state || '—'}</span></td>
        <td class="text-muted small">${s.note ? s.note.substring(0, 60) : '—'}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = errorRow(5, err.message);
  }
}

export function initUsageView() {
  document.getElementById('refresh-stats').addEventListener('click', () => {
    loadUsers();
    loadSessions();
  });

  document.getElementById('users-table').addEventListener('click', async (e) => {
    const btn = e.target.closest('.sign-in-as-btn');
    if (!btn) return;
    const targetUserId = btn.dataset.userid;
    btn.disabled = true;
    btn.textContent = 'Opening…';
    try {
      const { token } = await AdminAPI.signInAs(targetUserId);
      window.open(`${MAIN_APP_URL}/?su=${token}`, '_blank');
    } catch (err) {
      alert(`Sign in failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in as…';
    }
  });

  loadUsers();
  loadSessions();
}

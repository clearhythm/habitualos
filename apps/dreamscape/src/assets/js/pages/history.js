import { initPresence } from '../presence.js';
import { get } from '../api.js';
import { getUserId } from '../auth/auth.js';

initPresence();

async function loadHistory() {
  const userId = getUserId();
  if (!userId) return;

  try {
    const sessions = await get(`/api/user-sessions?userId=${encodeURIComponent(userId)}`);
    renderSessions(Array.isArray(sessions) ? sessions : []);
  } catch (_) {}
}

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s > 0 ? s + 's' : ''}`.trim() : `${s}s`;
}

function renderSessions(sessions) {
  const feed = document.getElementById('session-feed');
  if (!feed) return;

  if (!sessions.length) {
    feed.innerHTML = '<p class="empty-state">Nothing yet.</p>';
    return;
  }

  const sorted = sessions.slice().sort((a, b) => {
    const aAt = a.stoppedAt?.seconds ? a.stoppedAt.seconds * 1000 : (a.startedAt || 0);
    const bAt = b.stoppedAt?.seconds ? b.stoppedAt.seconds * 1000 : (b.startedAt || 0);
    return bAt - aAt;
  });

  feed.innerHTML = sorted.map(s => {
    const startMs = s.startedAt instanceof Object ? s.startedAt?.seconds * 1000 : s.startedAt;
    return `
      <div class="session-row">
        <div class="session-type">${escapeHtml(s.practiceType || 'Practice')}</div>
        <div class="session-meta">
          ${s.duration ? formatDuration(s.duration) + ' · ' : ''}${relativeTime(startMs)}
        </div>
        ${s.note ? `<div class="session-note">${escapeHtml(s.note)}</div>` : ''}
      </div>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadHistory();

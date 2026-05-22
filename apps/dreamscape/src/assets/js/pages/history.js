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

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s > 0 ? ' ' + s + 's' : ''}` : `${s}s`;
}

function formatDate(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function renderSessions(sessions) {
  const feed = document.getElementById('session-feed');
  if (!feed) return;

  if (!sessions.length) {
    feed.innerHTML = '<p class="empty-state">You ready to begin?</p><div style="text-align:center;margin-top:0.25rem"><a href="/practice/" class="practice-pill">practice</a></div>';
    return;
  }

  const sorted = sessions.slice().sort((a, b) => {
    const aAt = a._stoppedAt?.seconds ? a._stoppedAt.seconds * 1000 : (a._startedAt || 0);
    const bAt = b._stoppedAt?.seconds ? b._stoppedAt.seconds * 1000 : (b._startedAt || 0);
    return bAt - aAt;
  });

  feed.innerHTML = sorted.map(s => {
    const startMs = s._startedAt instanceof Object ? s._startedAt.seconds * 1000 : (s._startedAt || null);
    const dur = formatDuration(s.duration);
    return `
      <div class="session-row">
        <div class="session-row-header">
          <div class="session-type">${escapeHtml(s.practiceType || 'Practice')}</div>
          ${dur ? `<div class="session-duration">${dur}</div>` : ''}
        </div>
        ${startMs ? `
        <div class="session-when">
          <span>${formatDate(startMs)}</span>
          <span>${formatTime(startMs)}</span>
        </div>` : ''}
        ${s.note ? `<div class="session-note">${escapeHtml(s.note)}</div>` : ''}
      </div>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadHistory();

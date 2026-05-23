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
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'today';
  if (d.toDateString() === yesterday.toDateString()) return 'yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
    const aAt = a._stoppedAt ? (a._stoppedAt.seconds ?? a._stoppedAt._seconds) * 1000 : (a._startedAt || 0);
    const bAt = b._stoppedAt ? (b._stoppedAt.seconds ?? b._stoppedAt._seconds) * 1000 : (b._startedAt || 0);
    return bAt - aAt;
  });

  feed.innerHTML = sorted.map((s, i) => {
    const isLast = i === sorted.length - 1;
    const startMs = s._startedAt instanceof Object
      ? (s._startedAt.seconds ?? s._startedAt._seconds) * 1000
      : (s._startedAt || null);
    const dur = formatDuration(s.durationSeconds);
    return `
      <div class="session-row${isLast ? ' session-row--last' : ''}">
        <div class="session-row-header">
          <div class="session-type">${escapeHtml(s.practiceName || 'Practice')}</div>
          ${dur ? `<div class="session-duration">${dur}</div>` : ''}
        </div>
        ${startMs ? `
        <div class="session-when">
          <span class="session-date">${formatDate(startMs)}</span>
          <span class="session-time">${formatTime(startMs)}</span>
        </div>` : ''}
        ${s.note ? `<div class="session-note">${escapeHtml(s.note)}</div>` : ''}
      </div>`;
  }).join('') + '<div style="text-align:center;padding:2rem 0 1rem"><a href="/practice/" class="practice-pill">practice</a></div>';
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadHistory();

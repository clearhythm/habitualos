import { get, post } from '../api.js';

const MOCK_QUEUE = [
  { practiceLogId: 'roi-001',   userId: 'mock-roi',   name: "Ro'i",  lastPracticedAt: 0, lastPracticedLabel: '2 hours ago',  chime: { notes: [-7,  0,  4], timing: [0, 0.35, 0.70] } },
  { practiceLogId: 'yuki-001',  userId: 'mock-yuki',  name: 'Yuki',  lastPracticedAt: 0, lastPracticedLabel: 'this morning', chime: { notes: [0,   5, 12], timing: [0, 0.18, 0.62] } },
  { practiceLogId: 'frank-001', userId: 'mock-frank', name: 'Frank', lastPracticedAt: 0, lastPracticedLabel: 'yesterday',    chime: { notes: [-12, 2,  9], timing: [0, 0.08, 0.24] } },
  { practiceLogId: 'sarah-001', userId: 'mock-sarah', name: 'Sarah', lastPracticedAt: 0, lastPracticedLabel: '3 days ago',   chime: { notes: [-5,  4,  7], timing: [0, 0.52, 0.74] } },
];

const MOCK_LS_KEY = 'dp-witness-witnessed';

export function isMockMode() {
  return new URLSearchParams(window.location.search).has('mockWitness');
}

function sameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function dayPeriod(date) {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export function timeAgo(ms) {
  if (!ms) return null;
  const diff  = Date.now() - ms;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins} minutes ago`;

  const practiceDate = new Date(ms);
  const now          = new Date();
  const yesterday    = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameCalendarDay(practiceDate, now)) {
    const period = dayPeriod(practiceDate);
    if (period !== dayPeriod(now)) return `this ${period}`;
    return `${hours} hours ago`;
  }
  if (sameCalendarDay(practiceDate, yesterday)) {
    return dayPeriod(practiceDate) === 'evening' ? 'last night' : 'yesterday';
  }
  return `${Math.floor(diff / 86400000)} days ago`;
}

export async function fetchWitnessQueue(userId) {
  if (isMockMode()) {
    const witnessed = new Set(JSON.parse(localStorage.getItem(MOCK_LS_KEY) ?? '[]'));
    return MOCK_QUEUE.filter(s => !witnessed.has(s.practiceLogId));
  }
  const { queue } = await get(`/api/witness-queue-get?userId=${encodeURIComponent(userId)}`);
  return (queue || []).map(item => ({
    ...item,
    lastPracticedLabel: timeAgo(item.lastPracticedAt),
  }));
}

export async function markWitnessedSeen(userId) {
  if (isMockMode()) return;
  await post('/api/witnessed-by-mark-seen', { userId });
}

export async function markWitnessed({ witnessId, practicerId, practiceLogId }) {
  if (isMockMode()) {
    const witnessed = new Set(JSON.parse(localStorage.getItem(MOCK_LS_KEY) ?? '[]'));
    witnessed.add(practiceLogId);
    localStorage.setItem(MOCK_LS_KEY, JSON.stringify([...witnessed]));
    return;
  }
  await post('/api/witness-log-create', { witnessId, practicerId, practiceLogId });
}

import { requireSignIn } from '/assets/js/auth/auth-guard.js';
import { initializeUser } from '/assets/js/auth/auth.js';

requireSignIn();

const userId = initializeUser();

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function saveCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify({ ...value, timestamp: Date.now() })); } catch {}
}
function challengeChanged(newData, cached) {
  if (!cached || !cached.data) return true;
  const d = cached.data;
  return newData.streak !== d.streak
    || newData.completedDays.join() !== d.completedDays.join()
    || (newData.partialDays || []).join() !== (d.partialDays || []).join();
}

function getRank(checkins) {
  if (checkins <= 2) return { emoji: '🌱', name: 'Seedling' };
  if (checkins <= 5) return { emoji: '🌿', name: 'Sprout' };
  if (checkins <= 10) return { emoji: '🌺', name: 'Budding' };
  if (checkins <= 20) return { emoji: '🌸', name: 'Blooming' };
  if (checkins <= 50) return { emoji: '🌻', name: 'Full Bloom' };
  return { emoji: '🌼', name: 'Garden' };
}

function renderStats(totalCheckins) {
  const rank = getRank(totalCheckins);
  document.getElementById('rank-emoji').textContent = rank.emoji;
  document.getElementById('rank-name').textContent = rank.name;
  const c = totalCheckins;
  document.getElementById('rank-subtitle').textContent =
    `You logged ${c} ${c === 1 ? 'practice' : 'practices'}`;
}

async function loadStats() {
  const cached = readCache('obi_stats_cache');
  if (cached) renderStats(cached.totalCheckins);

  try {
    const response = await fetch(`/.netlify/functions/practice-list?userId=${userId}&_=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    if (data.success) {
      const totalCheckins = data.practices.reduce((sum, p) => sum + (p.checkins || 0), 0);
      if (!cached || cached.totalCheckins !== totalCheckins) {
        renderStats(totalCheckins);
      }
      saveCache('obi_stats_cache', { totalCheckins });
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

let challengeData = null;
let selectedDay = null;

function renderChallenge(data) {
  challengeData = data;
  document.getElementById('march-challenge-block').style.display = 'block';

  const s = data.streak;
  const streakEl = document.getElementById('challenge-streak-label');
  streakEl.textContent = s > 0 ? `🌞 ${s} day${s === 1 ? '' : 's'} streak` : 'No current streak';

  const calendar = document.getElementById('home-calendar');
  calendar.innerHTML = '';

  for (let day = 1; day <= 31; day++) {
    const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
    const isToday = day === data.dayNumber;
    const isComplete = data.completedDays.includes(dateStr);
    const isPartial = (data.partialDays || []).includes(dateStr);
    const isMissed = data.missedDays.includes(dateStr);

    const details = (data.dayDetails || {})[dateStr] || {};
    const partialSymbol = details.jogging ? '◐' : '◑';

    const sq = document.createElement('div');
    sq.dataset.day = day;
    sq.style.cssText = `
      width: 26px; height: 26px; border-radius: 3px; font-size: 11px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      background: ${isComplete ? '#4d9618' : isPartial ? '#9ab845' : isMissed ? '#f39c12' : isToday ? '#3498db' : '#f0f0f0'};
      color: ${isComplete || isPartial || isMissed || isToday ? '#fff' : '#ccc'};
    `;
    sq.textContent = isComplete ? '●' : isPartial ? partialSymbol : isMissed ? '○' : isToday ? '○' : '·';
    sq.addEventListener('click', () => selectDay(day));
    calendar.appendChild(sq);
  }

  selectDay(data.dayNumber);
}

async function loadChallenge() {
  const cached = readCache('obi_challenge_cache');
  if (cached && cached.data && cached.data.dayNumber) {
    renderChallenge(cached.data);
  }

  try {
    const res = await fetch(`/api/challenge-status?userId=${userId}&_=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success && data.dayNumber) {
      if (challengeChanged(data, cached)) {
        renderChallenge(data);
      }
      saveCache('obi_challenge_cache', { data });
      localStorage.removeItem('obi_cache_dirty');
    }
  } catch (error) {
    console.error('Error loading challenge:', error);
  }
}

function selectDay(day) {
  selectedDay = day;
  const data = challengeData;
  const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
  const details = (data.dayDetails || {})[dateStr] || { jogging: false, lasso: false };
  const isToday = day === data.dayNumber;
  const isFuture = day > data.dayNumber;

  document.getElementById('selected-day-label').innerHTML = `Day ${day} <span style="color:#bbb; font-weight:400;">of 31</span>`;
  document.getElementById('selected-day-actions').style.display = 'flex';

  const baseBtn = `padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; text-decoration: none; border: 2px solid transparent;`;
  function styleBtn(el, done) {
    if (done) {
      el.style.cssText = baseBtn + `color: #fff; background: #4d9618;`;
      el.textContent = `${el.dataset.doneIcon} ${el.dataset.label}`;
    } else if (isToday) {
      el.style.cssText = baseBtn + `border-color: #ddd; color: #555; background: transparent;`;
      el.textContent = `${el.dataset.emoji} ${el.dataset.label}`;
    } else if (isFuture) {
      el.style.cssText = baseBtn + `border-color: #ddd; color: #aaa; background: transparent;`;
      el.textContent = `${el.dataset.emoji} ${el.dataset.label}`;
    } else {
      el.style.cssText = baseBtn + `border-color: #ddd; color: #aaa; background: transparent;`;
      el.textContent = `⊗ ${el.dataset.label}`;
    }
  }

  const jogBtn = document.getElementById('log-jogging-link');
  const lassoBtn = document.getElementById('log-lasso-link');
  styleBtn(jogBtn, details.jogging);
  styleBtn(lassoBtn, details.lasso);

  const notClickable = !isToday;
  [jogBtn, lassoBtn].forEach(btn => {
    btn.style.pointerEvents = notClickable ? 'none' : '';
    btn.style.cursor = notClickable ? 'default' : 'pointer';
  });

  document.querySelectorAll('#home-calendar div').forEach(sq => {
    sq.style.outline = Number(sq.dataset.day) === day ? '2px solid #333' : 'none';
    sq.style.outlineOffset = '1px';
  });
}

document.getElementById('prev-day-btn').addEventListener('click', () => {
  if (selectedDay > 1) selectDay(selectedDay - 1);
});
document.getElementById('next-day-btn').addEventListener('click', () => {
  if (selectedDay < 31) selectDay(selectedDay + 1);
});

loadStats();
loadChallenge();

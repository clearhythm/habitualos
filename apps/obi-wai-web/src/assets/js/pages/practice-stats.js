import { requireSignIn } from '/assets/js/auth/auth-guard.js';
import { initializeUser } from '/assets/js/auth/auth.js';

requireSignIn();

const userId = initializeUser();

function getRank(checkins) {
  if (checkins <= 2) return { emoji: '🌱', name: 'Seedling' };
  if (checkins <= 5) return { emoji: '🌿', name: 'Sprout' };
  if (checkins <= 10) return { emoji: '🌺', name: 'Budding' };
  if (checkins <= 20) return { emoji: '🌸', name: 'Blooming' };
  if (checkins <= 50) return { emoji: '🌻', name: 'Full Bloom' };
  return { emoji: '🌼', name: 'Garden' };
}

async function loadStats() {
  try {
    const response = await fetch(`/.netlify/functions/practice-list?userId=${userId}&_=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    if (data.success) {
      const totalCheckins = data.practices.reduce((sum, p) => sum + (p.checkins || 0), 0);
      const uniquePractices = data.practices.length;
      const rank = getRank(totalCheckins);
      document.getElementById('rank-emoji').textContent = rank.emoji;
      document.getElementById('rank-name').textContent = rank.name;
      document.getElementById('rank-subtitle').textContent =
        `You logged ${totalCheckins} ${totalCheckins === 1 ? 'practice' : 'practices'}.`;
      document.getElementById('checkins-count').textContent = totalCheckins;
      document.getElementById('practices-count').textContent = uniquePractices;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

async function loadChallenge() {
  try {
    const response = await fetch(`/api/challenge-status?userId=${userId}&_=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    if (!data.success || !data.dayNumber) return;

    document.getElementById('challenge-block').style.display = 'block';

    const s = data.streak;
    document.getElementById('challenge-meta').textContent =
      `Day ${data.dayNumber} of 31${s > 0 ? ` · 🌞 ${s} day${s === 1 ? '' : 's'} streak` : ''}`;

    const jogStatus = document.getElementById('goal-jogging-status');
    jogStatus.textContent = data.todayJogging ? '✓ done' : '○ not yet';
    jogStatus.style.color = data.todayJogging ? '#4d9618' : '#999';

    const lassoStatus = document.getElementById('goal-lasso-status');
    lassoStatus.textContent = data.todayLasso ? '✓ done' : '○ not yet';
    lassoStatus.style.color = data.todayLasso ? '#4d9618' : '#999';

    const checkins = data.todayCheckIns || [];
    if (checkins.length > 0) {
      const timingLabel = { pre: 'Pre-practice', partial: 'Mid-day', post: 'Post-practice' };
      const block = document.getElementById('checkin-block');
      block.innerHTML = checkins.map((ci, i) => {
        const label = ci.timing ? timingLabel[ci.timing] : (checkins.length > 1 ? `Check-in ${i + 1}` : "Today's Check-in");
        return `
          <div style="padding: 0.875rem 1rem; background: #f9f6ff; border-radius: 8px; border-left: 3px solid #9b59b6; ${i > 0 ? 'margin-top: 0.5rem;' : ''}">
            <div style="font-size: 0.75rem; color: #9b59b6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">${label}</div>
            <div style="display: flex; gap: 1.25rem; flex-wrap: wrap; font-size: 0.9rem; color: #555;">
              <span>Resistance: <strong>${ci.resistance}/5</strong></span>
              <span>Self-efficacy: <strong>${ci.selfEfficacy}/5</strong></span>
              <span>Inner access: <strong>${ci.innerAccess}/5</strong></span>
            </div>
          </div>`;
      }).join('');
      block.style.display = 'block';
    } else {
      document.getElementById('checkin-pending').style.display = 'block';
    }

    const calendar = document.getElementById('challenge-calendar');
    for (let day = 1; day <= 31; day++) {
      const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
      const isToday = day === data.dayNumber;
      const isComplete = data.completedDays.includes(dateStr);
      const isPartial = (data.partialDays || []).includes(dateStr);
      const isMissed = data.missedDays.includes(dateStr);
      const details = (data.dayDetails || {})[dateStr] || {};
      const partialSymbol = details.jogging ? '◐' : '◑';

      const sq = document.createElement('div');
      sq.title = dateStr;
      sq.style.cssText = `
        width: 22px; height: 22px; border-radius: 3px; font-size: 11px;
        display: flex; align-items: center; justify-content: center;
        background: ${isComplete ? '#4d9618' : isPartial ? '#9ab845' : isMissed ? '#f39c12' : isToday ? '#3498db' : '#f0f0f0'};
        color: ${isComplete || isPartial || isMissed || isToday ? '#fff' : '#ccc'};
      `;
      sq.textContent = isComplete ? '●' : isPartial ? partialSymbol : isMissed ? '○' : isToday ? '○' : '·';
      calendar.appendChild(sq);
    }
  } catch (error) {
    console.error('Error loading challenge:', error);
  }
}

loadStats();
loadChallenge();

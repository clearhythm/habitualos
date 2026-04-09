import { requireSignIn } from '/assets/js/auth/auth-guard.js';
import { initializeUser } from '/assets/js/auth/auth.js';

requireSignIn();

const userId = initializeUser();
const loadingEl = document.getElementById('loading');
const listEl = document.getElementById('practices-list');
const noPracticesEl = document.getElementById('no-practices');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getRelativeTime(date) {
  if (!date || isNaN(date.getTime())) return 'recently';
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
  if (diffMonths < 12) return `${diffMonths} months ago`;
  return `${diffYears} years ago`;
}

async function loadPractices() {
  try {
    const response = await fetch(`/.netlify/functions/practice-list?userId=${userId}&_=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();

    loadingEl.style.display = 'none';

    if (!data.success || !data.practices || data.practices.length === 0) {
      noPracticesEl.style.display = 'block';
      return;
    }

    const sortedPractices = data.practices.map(practice => ({
      name: practice.name || 'Unnamed Practice',
      count: practice.checkins || 0,
      lastPracticed: practice._updatedAt || practice._createdAt
    }));

    listEl.innerHTML = sortedPractices.map(practice => {
      const lastDate = new Date(practice.lastPracticed);
      const relativeTime = getRelativeTime(lastDate);
      const encodedName = encodeURIComponent(practice.name);

      return `
        <a
          href="/practice/detail/?name=${encodedName}"
          style="display: block; text-decoration: none; padding: 1.5rem; background: white; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 1rem; transition: all 0.2s; color: inherit;"
          onmouseover="this.style.background='#f9f9f9'; this.style.borderColor='#0066cc'"
          onmouseout="this.style.background='white'; this.style.borderColor='#ddd'"
        >
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem; color: #333;">
                ${escapeHtml(practice.name)}
              </div>
              <div style="font-size: 0.9rem; color: #666;">
                Last practiced ${relativeTime}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.5rem; font-weight: 600; color: #0066cc;">
                ${practice.count}
              </div>
              <div style="font-size: 0.85rem; color: #999;">
                check-in${practice.count === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </a>
      `;
    }).join('');

    listEl.style.display = 'block';

  } catch (error) {
    console.error('Error loading practices:', error);
    loadingEl.textContent = 'Error loading practices. Please try again.';
  }
}

loadPractices();

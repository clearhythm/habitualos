import { requireSignIn } from '/assets/js/auth/auth-guard.js';
import { initializeUser } from '/assets/js/auth/auth.js';
import { renderPracticeEntryContent, initObiWaiEntries } from '/assets/js/practice-entry-renderer.js';

requireSignIn();

const userId = initializeUser();
const loadingEl = document.getElementById('loading');
const detailEl = document.getElementById('practice-detail');
const noCheckinsEl = document.getElementById('no-checkins');

const urlParams = new URLSearchParams(window.location.search);
const practiceName = urlParams.get('name') || '';

async function loadPracticeDetail() {
  try {
    const response = await fetch(`/.netlify/functions/practice-logs-list?userId=${userId}&_=${Date.now()}`, {
      cache: 'no-store'
    });

    const data = await response.json();

    loadingEl.style.display = 'none';

    if (!data.success || !data.practices) {
      noCheckinsEl.style.display = 'block';
      return;
    }

    const filteredPractices = data.practices.filter(p =>
      (p.practice_name || '').toLowerCase() === practiceName.toLowerCase()
    );

    if (filteredPractices.length === 0) {
      noCheckinsEl.style.display = 'block';
      return;
    }

    const displayName = filteredPractices[0].practice_name || 'Unnamed Practice';
    document.getElementById('practice-name').textContent = displayName;
    document.getElementById('practice-stats').textContent =
      `${filteredPractices.length} check-in${filteredPractices.length === 1 ? '' : 's'}`;

    filteredPractices.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const checkinsHtml = filteredPractices.map(practice => {
      const date = new Date(practice.timestamp);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });

      return `
        <div style="padding: 1.5rem; background: white; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div>
              <div style="font-weight: 600; color: #333; margin-bottom: 0.25rem;">
                ${dateStr}
              </div>
              <div style="font-size: 0.9rem; color: #999;">
                ${timeStr}
              </div>
            </div>
            ${practice.duration ? `
              <div style="text-align: right;">
                <div style="font-size: 1.25rem; font-weight: 600; color: #0066cc;">
                  ${practice.duration}
                </div>
                <div style="font-size: 0.85rem; color: #666;">
                  minutes
                </div>
              </div>
            ` : ''}
          </div>

          ${renderPracticeEntryContent(practice, {
            expandableInline: true,
            showFeedbackIcon: true
          })}
        </div>
      `;
    }).join('');

    document.getElementById('checkins-list').innerHTML = checkinsHtml;
    detailEl.style.display = 'block';

    initObiWaiEntries();

  } catch (error) {
    console.error('Error loading practice detail:', error);
    loadingEl.textContent = 'Error loading practice detail. Please try again.';
  }
}

loadPracticeDetail();

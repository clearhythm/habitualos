import { requireSignIn } from '/assets/js/auth/auth-guard.js';
import { initializeUser } from '/assets/js/auth/auth.js';
import { renderPracticeEntryContent, initObiWaiEntries } from '/assets/js/practice-entry-renderer.js';

requireSignIn();

async function loadPractices() {
  const userId = initializeUser();

  try {
    const response = await fetch(`/.netlify/functions/practice-logs-list?userId=${userId}&_=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    const data = await response.json();

    const loading = document.getElementById('loading');
    const listEl = document.getElementById('practices-list');
    const noPracticesEl = document.getElementById('no-practices');

    loading.style.display = 'none';

    if (!data.success || data.practices.length === 0) {
      noPracticesEl.style.display = 'block';
      return;
    }

    listEl.style.display = 'block';

    const practicesHtml = data.practices.map(practice => {
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
                ${practice.practice_name || 'Practice'}
              </div>
              <div style="font-weight: 600; color: #666; margin-bottom: 0.25rem; font-size: 0.95rem;">
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
          ${renderPracticeEntryContent(practice, { expandableInline: true, showFeedbackIcon: true })}
        </div>
      `;
    }).join('');

    listEl.innerHTML = practicesHtml;
    initObiWaiEntries();

  } catch (error) {
    console.error('Error loading practices:', error);
    document.getElementById('loading').innerHTML = `<div style="color: #d32f2f;">Failed to load practices. Please refresh the page.</div>`;
  }
}

loadPractices();

window.addEventListener('pageshow', (event) => {
  if (event.persisted) loadPractices();
});

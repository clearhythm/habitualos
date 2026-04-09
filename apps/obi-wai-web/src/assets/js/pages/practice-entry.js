import { requireSignIn } from '/assets/js/auth/auth-guard.js';
import { initializeUser } from '/assets/js/auth/auth.js';
import { initExpandWisdom, displayObiWaiQuote, initFeedbackButtons } from '/assets/js/obi-wai-quote.js';

requireSignIn();

const userId = initializeUser();

const loadingEl = document.getElementById('loading');
const notFoundEl = document.getElementById('entry-not-found');
const responseEl = document.getElementById('obi-wan-response');
const obiWanMessage = document.getElementById('obi-wan-message');
const obiWanExpanded = document.getElementById('obi-wan-expanded');
const obiWanExpandedText = document.getElementById('obi-wan-expanded-text');
const expandButton = document.getElementById('expandWisdom');
const expandContainer = document.getElementById('obi-wan-expand-container');

let currentPracticeId = null;

initExpandWisdom({ expandButton, expandedContent: obiWanExpanded, expandContainer });

initFeedbackButtons({
  thumbsUp: document.getElementById('thumbsUp'),
  thumbsDown: document.getElementById('thumbsDown'),
  getPracticeId: () => currentPracticeId
});

async function loadEntry() {
  const urlParams = new URLSearchParams(window.location.search);
  const practiceId = urlParams.get('id');

  if (!practiceId) {
    loadingEl.style.display = 'none';
    notFoundEl.style.display = 'block';
    return;
  }

  try {
    const response = await fetch(`/.netlify/functions/practice-logs-list?userId=${userId}&_=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();

    if (data.success) {
      const practice = data.practices.find(p => p.id === practiceId);

      if (practice && practice.obi_wan_message) {
        currentPracticeId = practice.id;

        document.getElementById('practice-name').textContent = practice.practice_name || 'Practice';
        const date = new Date(practice.timestamp);
        document.getElementById('practice-date').textContent = date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        displayObiWaiQuote({
          message: practice.obi_wan_message,
          expanded: practice.obi_wan_expanded,
          messageEl: obiWanMessage,
          expandedEl: obiWanExpanded,
          expandedTextEl: obiWanExpandedText,
          expandButton,
          expandContainer
        });

        if (practice.obi_wan_feedback) {
          const thumbsUp = document.getElementById('thumbsUp');
          const thumbsDown = document.getElementById('thumbsDown');
          if (practice.obi_wan_feedback === 'thumbs_up') {
            thumbsUp.style.background = '#d4edda';
            thumbsUp.classList.add('selected');
            thumbsDown.style.opacity = '0.3';
          } else if (practice.obi_wan_feedback === 'thumbs_down') {
            thumbsDown.style.background = '#f8d7da';
            thumbsDown.classList.add('selected');
            thumbsUp.style.opacity = '0.3';
          }
        }

        loadingEl.style.display = 'none';
        responseEl.style.display = 'block';
      } else {
        loadingEl.style.display = 'none';
        notFoundEl.style.display = 'block';
      }
    } else {
      loadingEl.style.display = 'none';
      notFoundEl.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading entry:', error);
    loadingEl.style.display = 'none';
    notFoundEl.style.display = 'block';
  }
}

loadEntry();

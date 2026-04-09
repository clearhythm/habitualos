import { requireSignIn } from '/assets/js/auth/auth-guard.js';
import { initializeUser } from '/assets/js/auth/auth.js';
import { getPracticeChatState, clearPracticeChatState } from '/assets/js/practice-chat-state.js';
import { initExpandWisdom, displayObiWaiQuote, initFeedbackButtons } from '/assets/js/obi-wai-quote.js';

requireSignIn();

const form = document.getElementById('practiceForm');
const formContainer = document.getElementById('practice-form');
const responseContainer = document.getElementById('obi-wan-response');
const obiWanMessage = document.getElementById('obi-wan-message');
const obiWanExpanded = document.getElementById('obi-wan-expanded');
const expandButton = document.getElementById('expandWisdom');
const expandContainer = document.getElementById('obi-wan-expand-container');
const submitBtn = document.getElementById('submitBtn');

const userId = initializeUser();

// Pre-fill practice from URL param (e.g., ?prefill=Jogging)
const urlPractice = new URLSearchParams(window.location.search).get('prefill');
if (urlPractice) {
  const input = document.getElementById('practice_name');
  if (input) input.value = urlPractice;
}

// Check for suggested practice from chat and pre-fill (skip if ?prefill= was used)
const chatState = getPracticeChatState();
if (!urlPractice && chatState && chatState.suggestedPractice) {
  const practiceNameInput = document.getElementById('practice_name');
  practiceNameInput.value = chatState.suggestedPractice;

  const practiceNameContainer = practiceNameInput.parentElement;
  const label = practiceNameContainer.querySelector('label');

  const indicator = document.createElement('span');
  indicator.id = 'obi-wai-suggestion-indicator';
  indicator.innerHTML = ' <span style="color: #9b59b6; font-weight: 400;">✨ suggested by Obi-Wai</span>';
  label.appendChild(indicator);

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.id = 'clear-suggestion-btn';
  clearButton.textContent = '✕ Clear suggestion';
  clearButton.style.cssText = 'background: none; border: none; color: #999; font-size: 0.85rem; cursor: pointer; text-decoration: underline; margin-left: 0.5rem;';
  clearButton.onmouseover = () => clearButton.style.color = '#666';
  clearButton.onmouseout = () => clearButton.style.color = '#999';
  clearButton.onclick = () => {
    clearPracticeChatState();
    practiceNameInput.value = '';
    indicator.remove();
    clearButton.remove();
    practiceNameInput.focus();
  };
  label.appendChild(clearButton);
}

let currentPracticeId = null;
let practiceCount = 0;

function getFlowerStage(count) {
  if (count <= 2) return { emoji: '🌱', label: 'Seedling', size: '4rem' };
  if (count <= 5) return { emoji: '🌿', label: 'Sprout', size: '4.5rem' };
  if (count <= 10) return { emoji: '🌺', label: 'Budding', size: '5rem' };
  if (count <= 20) return { emoji: '🌸', label: 'Blooming', size: '5.5rem' };
  if (count <= 50) return { emoji: '🌻', label: 'Full Bloom', size: '6rem' };
  return { emoji: '🌼', label: 'Garden', size: '6.5rem' };
}

function renderFlower(count) {
  const actualCount = Math.max(1, count || 1);
  const stage = getFlowerStage(actualCount);
  const flowerEmoji = document.getElementById('flower-emoji');
  const flowerLabel = document.getElementById('flower-label');
  flowerEmoji.textContent = stage.emoji;
  flowerEmoji.style.fontSize = stage.size;
  flowerLabel.textContent = `${stage.label} • ${actualCount} ${actualCount === 1 ? 'practice' : 'practices'}`;
}

initExpandWisdom({ expandButton, expandedContent: obiWanExpanded, expandContainer });

initFeedbackButtons({
  thumbsUp: document.getElementById('thumbsUp'),
  thumbsDown: document.getElementById('thumbsDown'),
  getPracticeId: () => currentPracticeId
});

async function checkForPracticeView() {
  const urlParams = new URLSearchParams(window.location.search);
  const practiceId = urlParams.get('practice');

  if (practiceId) {
    formContainer.style.display = 'none';

    try {
      const response = await fetch(`/.netlify/functions/practice-logs-list?userId=${userId}&_=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();

      if (data.success) {
        const practice = data.practices.find(p => p.id === practiceId);

        if (practice && practice.obi_wan_message) {
          currentPracticeId = practice.id;
          practiceCount = data.practices.length;

          displayObiWaiQuote({
            message: practice.obi_wan_message,
            expanded: practice.obi_wan_expanded,
            messageEl: obiWanMessage,
            expandedEl: obiWanExpanded,
            expandButton,
            expandContainer
          });

          const continueBtn = document.getElementById('obiWanContinue');
          const newBtn = continueBtn.cloneNode(true);
          continueBtn.parentNode.replaceChild(newBtn, continueBtn);
          newBtn.textContent = 'Back to History';
          newBtn.addEventListener('click', () => window.location.href = '/practice/history/');

          responseContainer.style.display = 'block';
        } else {
          formContainer.style.display = 'block';
        }
      }
    } catch (error) {
      console.error('Error loading practice:', error);
      formContainer.style.display = 'block';
    }
  }
}

checkForPracticeView();

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  submitBtn.disabled = true;
  submitBtn.textContent = 'Recording...';

  const formData = {
    userId,
    practice_name: document.getElementById('practice_name').value || null,
    duration: document.getElementById('duration').value ? parseInt(document.getElementById('duration').value) : null,
    reflection: document.getElementById('reflection').value || null
  };

  try {
    const response = await fetch('/.netlify/functions/practice-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('obi_cache_dirty', '1');
      currentPracticeId = data.practice.id;
      practiceCount = data.practice_count;

      formContainer.style.display = 'none';

      if (data.obi_wan_appeared) {
        displayObiWaiQuote({
          message: data.obi_wan_message,
          expanded: data.obi_wan_expanded,
          messageEl: obiWanMessage,
          expandedEl: obiWanExpanded,
          expandButton,
          expandContainer
        });
        responseContainer.style.display = 'block';
      } else {
        renderFlower(practiceCount);
        document.getElementById('system-success').style.display = 'block';
      }
    } else {
      alert('Error: ' + data.error);
      submitBtn.disabled = false;
      submitBtn.textContent = 'I Did It ✓';
    }
  } catch (error) {
    console.error('Error submitting practice:', error);
    alert('Failed to submit practice. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'I Did It ✓';
  }
});

document.getElementById('systemAnotherPractice').addEventListener('click', resetForm);

document.getElementById('obiWanContinue').addEventListener('click', () => {
  renderFlower(practiceCount);
  responseContainer.style.display = 'none';
  document.getElementById('system-success').style.display = 'block';
});

function resetForm() {
  form.reset();
  currentPracticeId = null;
  submitBtn.disabled = false;
  submitBtn.textContent = 'I Did It ✓';
  document.getElementById('system-success').style.display = 'none';
  responseContainer.style.display = 'none';
  formContainer.style.display = 'block';
}

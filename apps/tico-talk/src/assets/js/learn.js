// /learn/ — text-based teach-then-drill practice, validated through live
// testing: Tico presents a section's real facts first (no quiz), then a
// realistic guest asks ordinary questions about it. First real network
// dependency in this app's practice flow (previous scenarios are scripted).
const picker = document.getElementById('learn-picker');
const teach = document.getElementById('learn-teach');
const drill = document.getElementById('learn-drill');
const transcript = document.getElementById('learn-transcript');
const answerForm = document.getElementById('learn-answer-form');
const answerInput = document.getElementById('learn-answer-input');
const sendButton = document.getElementById('learn-send-btn');

function updateSendButton() {
  sendButton.disabled = answerInput.value.trim().length === 0;
}

// Auto-resize textarea as the user types — reset to auto first so
// scrollHeight re-measures from a collapsed state, otherwise it only
// ever grows.
answerInput?.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = `${this.scrollHeight}px`;
  updateSendButton();
});

// Desktop: Enter submits. Mobile (coarse pointer): Enter inserts a
// newline, matching native textarea behavior. Shift+Enter always inserts
// a newline on both.
answerInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) {
      e.preventDefault();
      answerForm.requestSubmit();
    }
  }
});

let currentSection = null;
let chatHistory = [];
let awaitingResponse = false;

function showPhase(phase) {
  picker.hidden = phase !== 'picker';
  teach.hidden = phase !== 'teach';
  drill.hidden = phase !== 'drill';
}

// Picker → Teach
document.querySelectorAll('.learn-picker .competency-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    currentSection = pill.dataset.section;
    document.querySelectorAll('.learn-teach__section').forEach((section) => {
      section.hidden = section.dataset.section !== currentSection;
    });
    showPhase('teach');
  });
});

// Back links, from either Teach or Drill
document.querySelectorAll('.learn-back').forEach((link) => {
  link.addEventListener('click', () => {
    currentSection = null;
    chatHistory = [];
    if (transcript) transcript.innerHTML = '';
    showPhase('picker');
  });
});

// Teach → Drill
document.querySelectorAll('.learn-start-drill').forEach((button) => {
  button.addEventListener('click', () => {
    showPhase('drill');
    startDrill();
  });
});

function appendLine(speaker, text) {
  const line = document.createElement('p');
  if (speaker === 'tico-aside') {
    line.className = 'tico-aside';
    line.innerHTML = '<span class="tico-aside__label">Tico</span>' + text;
  } else {
    line.className = `transcript-line transcript-line--${speaker}`;
    line.textContent = text;
  }
  transcript.appendChild(line);
  line.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function appendThinking() {
  const line = document.createElement('p');
  line.className = 'transcript-line transcript-line--guest learn-thinking';
  line.textContent = 'Tico’s thinking…';
  transcript.appendChild(line);
  line.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return line;
}

async function sendTurn(message) {
  awaitingResponse = true;
  answerInput.disabled = true;
  sendButton.disabled = true;
  const thinkingLine = appendThinking();

  try {
    const response = await fetch('/api/learn-drill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: currentSection, message, chatHistory })
    });
    const data = await response.json();
    thinkingLine.remove();

    if (!data.success) {
      appendLine('tico-aside', data.error || 'Something went wrong reaching Tico — try again in a moment.');
      return;
    }

    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: data.guest });

    appendLine('guest', data.guest);
    if (data.ticoAside) appendLine('tico-aside', data.ticoAside);

    if (data.done) {
      appendLine('tico-aside', 'That’s a good stopping point for this section — nice work.');
      answerForm.hidden = true;
    }
  } catch (err) {
    thinkingLine.remove();
    appendLine('tico-aside', 'Couldn’t reach Tico just now — check your connection and try again.');
  } finally {
    awaitingResponse = false;
    answerInput.disabled = false;
    updateSendButton();
    answerInput.focus();
  }
}

function startDrill() {
  chatHistory = [];
  transcript.innerHTML = '';
  answerForm.hidden = false;
  sendTurn('Let’s get started.');
}

answerForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (awaitingResponse) return;
  const message = answerInput.value.trim();
  if (!message) return;
  appendLine('user', message);
  answerInput.value = '';
  answerInput.style.height = 'auto';
  updateSendButton();
  sendTurn(message);
});

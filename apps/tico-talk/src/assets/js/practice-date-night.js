// Date Night — same working tap-to-talk scaffolding as practice.js (state
// machine: waiting → recording → processing → auto-advance), reused rather
// than duplicated conceptually, but kept as its own file since practice.js
// stays untouched. New here: Tico speaks as an occasional coworker aside
// (a distinct, rarer beat), not a per-turn coach, and the line used is a
// true, non-fabricated procedural observation — not invented psychology.
const transcript = document.querySelector('.transcript');
const talkBtn = document.querySelector('.talk-btn');
const talkLabel = document.querySelector('.talk-bar__label');

const AUTO_DELAY_MS = 900;
const PROCESSING_DELAY_MS = 1800;

const turns = [
  { speaker: 'user', text: 'Hi there! Welcome in — how many in your group today?', auto: false },
  { speaker: 'guest', text: 'Table for two please. Do you have anything outside?', auto: true },
  { speaker: 'tico-aside', text: "Nice — asking party size right away means you won't have to double back once you're walking them to the table.", auto: true },
  { speaker: 'user', text: "We've got a nice patio — right this way.", auto: false },
];
let turnIndex = 0;

function appendLine(turn) {
  const line = document.createElement('p');
  if (turn.speaker === 'tico-aside') {
    line.className = 'tico-aside';
    line.innerHTML = '<span class="tico-aside__label">Tico leans over</span>' + turn.text;
  } else {
    line.className = `transcript-line transcript-line--${turn.speaker}`;
    line.textContent = turn.text;
  }
  transcript.appendChild(line);
  line.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

const STATE_LABELS = {
  waiting: 'Tap to talk',
  recording: 'Tap when done',
  processing: 'One moment…',
  listening: '',
  done: 'Shift continues',
};

let currentState = null;

function setState(state) {
  currentState = state;
  if (!talkBtn) return;
  talkBtn.disabled = state !== 'waiting' && state !== 'recording';
  talkBtn.classList.toggle('is-processing', state === 'processing');
  talkBtn.classList.toggle('is-recording', state === 'recording');
  if (talkLabel) talkLabel.textContent = STATE_LABELS[state];
}

function playAutoTurns() {
  if (turnIndex >= turns.length) { setState('done'); return; }
  const next = turns[turnIndex];
  if (!next.auto) { setState('waiting'); return; }
  setState('listening');
  setTimeout(() => {
    appendLine(next);
    turnIndex++;
    playAutoTurns();
  }, AUTO_DELAY_MS);
}

talkBtn?.addEventListener('click', () => {
  if (talkBtn.disabled) return;

  if (currentState === 'waiting') {
    setState('recording');
    return;
  }

  setState('processing');
  setTimeout(() => {
    appendLine(turns[turnIndex]);
    turnIndex++;
    playAutoTurns();
  }, PROCESSING_DELAY_MS);
});

playAutoTurns();
